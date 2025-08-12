"use client";

import { useState, useEffect } from "react";
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, doc, updateDoc, increment, where, getDoc, getDocs } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { PaperAirplaneIcon, UserGroupIcon, ShieldCheckIcon } from "@heroicons/react/24/outline";
import RepBadge from "./RepBadge";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";

interface CommunityPost {
  id: string;
  title: string;
  content: string;
  userId: string;
  userEmail: string;
  userRep: number;
  timestamp: any;
  isAnonymous: boolean;
  submessName?: string;
}

interface Submess {
  id: string;
  name: string;
  description: string;
  color: string;
}

interface CommunityProps {
  communityId: string;
  communityName: string;
  onClose: () => void;
}

export default function Community({ communityId, communityName, onClose }: CommunityProps) {
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [newPost, setNewPost] = useState({ title: '', content: '', isAnonymous: false, submessName: '' });
  const [loading, setLoading] = useState(false);
  const [userRep, setUserRep] = useState(0);
  const [communitySubmesses, setCommunitySubmesses] = useState<Submess[]>([]);
  const [selectedSubmess, setSelectedSubmess] = useState<string>('');
  const [communityData, setCommunityData] = useState<any>(null);
  const [isMember, setIsMember] = useState(false);
  const [membershipLoading, setMembershipLoading] = useState(true);
  const user = auth.currentUser;

  // Prevent body scroll when community modal is open (only when this component is rendered as a modal)
  useBodyScrollLock(true);

  useEffect(() => {
    if (!user) return;

    // Load user reputation
    const loadUserRep = async () => {
      try {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          setUserRep(userSnap.data()?.reputation || 0);
        }
      } catch (error) {
        console.error('Error loading user rep:', error);
      }
    };

    // Load community data and check membership
    const loadCommunityAndMembership = async () => {
      try {
        setMembershipLoading(true);
        
        // Load community data
        const communityRef = doc(db, 'communities', communityId);
        const communitySnap = await getDoc(communityRef);
        
        if (communitySnap.exists()) {
          const data = communitySnap.data();
          setCommunityData(data);
          
          // Check if user is a member using consistent format
          let userIsMember = false;
          
          // Check in community.members object
          if (data.members && typeof data.members === 'object') {
            userIsMember = data.members[user.uid] !== undefined;
          }
          
          // Double-check in user's communities collection
          if (!userIsMember) {
            const userCommunitiesRef = collection(db, 'users', user.uid, 'communities');
            const userCommunitiesSnap = await getDocs(userCommunitiesRef);
            const userCommunity = userCommunitiesSnap.docs.find(doc => doc.data().communityId === communityId);
            userIsMember = !!userCommunity;
          }
          
          setIsMember(userIsMember);
        }
      } catch (error) {
        console.error('Error loading community data:', error);
        setIsMember(false);
      } finally {
        setMembershipLoading(false);
      }
    };

    // Load community submesses
    const loadCommunitySubmesses = async () => {
      try {
        const communityRef = doc(db, 'communities', communityId);
        const communitySnap = await getDoc(communityRef);
        if (communitySnap.exists()) {
          const communityData = communitySnap.data();
          setCommunitySubmesses(communityData.submesses || []);
          if (communityData.submesses && communityData.submesses.length > 0) {
            setSelectedSubmess(communityData.submesses[0].name);
          }
        }
      } catch (error) {
        console.error('Error loading community submesses:', error);
      }
    };

    loadUserRep();
    loadCommunityAndMembership();
    loadCommunitySubmesses();

    // Load community posts from main posts collection
    const postsRef = collection(db, 'posts');
    const q = query(
      postsRef, 
      where('communityId', '==', communityId)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const communityPosts: CommunityPost[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as CommunityPost[];
      
      // Sort manually by createdAt since we can't use orderBy with where on different fields
      communityPosts.sort((a, b) => {
        const aTime = a.timestamp?.toDate ? a.timestamp.toDate().getTime() : 0;
        const bTime = b.timestamp?.toDate ? b.timestamp.toDate().getTime() : 0;
        return bTime - aTime; // Descending order
      });
      
      setPosts(communityPosts);
    });

    return unsubscribe;
  }, [user, communityId]);

  const addPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newPost.title.trim() || !newPost.content.trim()) return;

    // Check if submess is selected
    if (!selectedSubmess) {
      console.error('Please select a submess to post to.');
      return;
    }

    // Check if user is a member of this community (required for all communities, but especially private ones)
    try {
      const userCommunitiesRef = collection(db, 'users', user.uid, 'communities');
      const userCommunitiesSnap = await getDocs(userCommunitiesRef);
      const userCommunity = userCommunitiesSnap.docs.find(doc => doc.data().communityId === communityId);
      
      if (!userCommunity) {
        if (communityData?.isPrivate) {
          alert('You must be an approved member of this private community to post here.');
        } else {
          alert('You must be a member of this community to post here.');
        }
        return;
      }

      const membershipData = userCommunity.data();
      
      // Check if user is timed out in this community
      if (membershipData.timeoutUntil) {
        const timeoutDate = membershipData.timeoutUntil.toDate ? membershipData.timeoutUntil.toDate() : new Date(membershipData.timeoutUntil);
        if (timeoutDate > new Date()) {
          const timeLeft = timeoutDate.getTime() - Date.now();
          const minutesLeft = Math.ceil(timeLeft / (1000 * 60));
          alert(`You are timed out from posting in this community for ${minutesLeft} more minutes.`);
          return;
        }
      }

      // Check if user is banned
      if (membershipData.isBanned) {
        alert('You are banned from posting in this community.');
        return;
      }
    } catch (error) {
      console.error('Error checking membership status:', error);
      alert('Error checking your membership status. Please try again.');
      return;
    }

    // Anti-spam measures - Check for recent posts (max 3 posts per 15 minutes)
    const recentPosts = posts.filter(post => 
      post.userId === user.uid && 
      post.timestamp?.toDate && 
      (Date.now() - post.timestamp.toDate().getTime()) < 900000 // 15 minutes in milliseconds
    );

    if (recentPosts.length >= 3) {
      alert('You can only post 3 times per 15 minutes. Please wait before posting again.');
      return;
    }

    setLoading(true);
    try {
      // Post to main posts collection so it shows up in home
      const postsRef = collection(db, 'posts');
      await addDoc(postsRef, {
        title: newPost.title.trim(),
        description: newPost.content.trim(),
        type: selectedSubmess,
        userId: user.uid,
        userEmail: user.email,
        createdAt: serverTimestamp(),
        communityId: communityId,
        communityName: communityName,
        submessId: selectedSubmess,
        submessName: selectedSubmess,
        isAnonymous: newPost.isAnonymous
      });

      // Update user reputation (+5 for community post)
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        reputation: increment(5)
      });

      // Create notifications for community members (if not anonymous)
      if (!newPost.isAnonymous) {
        try {
          const { createPostNotification } = await import('./NotificationSystem');
          
          // Get community members
          const communityRef = doc(db, 'communities', communityId);
          const communitySnap = await getDoc(communityRef);
          
          if (communitySnap.exists()) {
            const communityData = communitySnap.data();
            const memberIds = Object.keys(communityData.members || {});
            
            // Get current user's name
            const currentUserRef = doc(db, 'users', user.uid);
            const currentUserSnap = await getDoc(currentUserRef);
            const currentUserName = currentUserSnap.exists() ? 
              (currentUserSnap.data()?.username || user.email?.split('@')[0] || 'Someone') : 
              'Someone';
            
            await createPostNotification(
              memberIds,
              user.uid,
              currentUserName,
              communityName,
              newPost.title.trim()
            );
          }
        } catch (error) {
          console.error('Error creating post notification:', error);
        }
      }

      setNewPost({ title: '', content: '', isAnonymous: false, submessName: '' });
    } catch (error) {
      console.error('Error adding post:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="fixed inset-0 bg-white/20 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl w-full max-w-4xl h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center space-x-3">
            <UserGroupIcon className="h-6 w-6 text-blue-600" />
            <div>
              <h3 className="font-semibold text-gray-900">{communityName}</h3>
              <p className="text-sm text-gray-500">Private Mesh</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <RepBadge score={userRep} size="sm" />
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex">
          {/* Posts */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-4">
              {posts.map((post) => (
                <div key={post.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-sm text-gray-900">
                        {post.isAnonymous ? 'Anonymous' : post.userEmail}
                      </span>
                      <RepBadge score={post.userRep} size="sm" showLabel={false} />
                      {post.isAnonymous && <ShieldCheckIcon className="h-4 w-4 text-gray-400" />}
                      {post.submessName && (
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                          {post.submessName}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-400">
                      {post.timestamp?.toDate ? 
                        post.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) :
                        'Just now'
                      }
                    </span>
                  </div>
                  <h4 className="font-semibold text-gray-900 mb-2">{post.title}</h4>
                  <p className="text-sm text-gray-700">{post.content}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Post Form */}
          <div className="w-80 border-l p-4">
            <h4 className="font-semibold text-gray-900 mb-4">Create Post</h4>
            
            {membershipLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              </div>
            ) : !isMember ? (
              <div className="text-center py-8">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-center justify-center w-12 h-12 mx-auto mb-3 bg-yellow-100 rounded-full">
                    <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <h3 className="text-sm font-medium text-yellow-800 mb-1">Members Only</h3>
                  <p className="text-xs text-yellow-700">
                    {communityData?.isPrivate 
                      ? "Join this private community to create posts"
                      : "Join this community to create posts"
                    }
                  </p>
                </div>
              </div>
            ) : (
              <form onSubmit={addPost} className="space-y-4">
              {/* Submess Selection */}
              {communitySubmesses.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Post to Submess (Required)
                  </label>
                  <select
                    value={selectedSubmess}
                    onChange={(e) => setSelectedSubmess(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                    required
                  >
                    <option value="">Select a Submess</option>
                    {communitySubmesses.map((submess) => (
                      <option key={submess.id} value={submess.name}>
                        {submess.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={newPost.title}
                  onChange={(e) => setNewPost({ ...newPost, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-500"
                  placeholder="Post title"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Content
                </label>
                <textarea
                  rows={4}
                  value={newPost.content}
                  onChange={(e) => setNewPost({ ...newPost, content: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-500"
                  placeholder="Share your thoughts..."
                  required
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="anonymous"
                  checked={newPost.isAnonymous}
                  onChange={(e) => setNewPost({ ...newPost, isAnonymous: e.target.checked })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="anonymous" className="ml-2 block text-sm text-gray-700">
                  Post anonymously
                </label>
              </div>

              <button
                type="submit"
                disabled={loading || !selectedSubmess}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {loading ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Posting...
                  </div>
                ) : (
                  <>
                    <PaperAirplaneIcon className="h-4 w-4 mr-2" />
                    Post
                  </>
                )}
              </button>


              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 