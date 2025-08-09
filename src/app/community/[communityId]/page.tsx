"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import { collection, doc, getDoc, getDocs, addDoc, query, where, orderBy, onSnapshot, updateDoc, increment, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { ArrowLeftIcon, UserGroupIcon, PlusIcon } from "@heroicons/react/24/outline";
import Navbar from "@/components/Navbar";
import PostInteractions from "@/components/PostInteractions";
import RepBadge from "@/components/RepBadge";

interface Community {
  id: string;
  name: string;
  description: string;
  memberCount: number;
  isPrivate: boolean;
  submesses: Array<{
    name: string;
    description: string;
  }>;
  members: { [key: string]: boolean };
  enrollmentQuestions?: Array<{
    id: string;
    question: string;
    type: 'text' | 'select';
    options?: string[];
    required: boolean;
  }>;
}

interface Post {
  id: string;
  title: string;
  description: string;
  category: string;
  postedBy: string;
  postedAt: string;
  userId: string;
  userEmail: string;
  communityId: string;
  communityName: string;
  submessId?: string;
  submessName?: string;
}

export default function CommunityPage() {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<{ username?: string; reputation?: number } | null>(null);
  const [community, setCommunity] = useState<Community | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMember, setIsMember] = useState(false);
  const [joining, setJoining] = useState(false);
  const [activeSubmesh, setActiveSubmesh] = useState<string>('All');
  const [showEnrollmentForm, setShowEnrollmentForm] = useState(false);
  const [enrollmentAnswers, setEnrollmentAnswers] = useState<{ [key: string]: string }>({});
  const router = useRouter();
  const params = useParams();
  const communityId = params.communityId as string;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUser(user);
        await loadUserProfile(user.uid);
        await loadCommunity();
        await loadCommunityPosts();
      } else {
        router.push("/login");
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router, communityId]);

  const loadUserProfile = async (userId: string) => {
    try {
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        setUserProfile(userSnap.data());
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  };

  const loadCommunity = async () => {
    try {
      const communityRef = doc(db, 'communities', communityId);
      const communitySnap = await getDoc(communityRef);
      
      if (communitySnap.exists()) {
        const communityData = { id: communitySnap.id, ...communitySnap.data() } as Community;
        setCommunity(communityData);
        
        if (user) {
          // Check membership using the same logic as Community component
          let userIsMember = false;
          
          // Check in community.members object
          if (communityData.members && typeof communityData.members === 'object') {
            userIsMember = communityData.members[user.uid] !== undefined;
          }
          
          // Double-check in user's communities collection
          if (!userIsMember) {
            try {
              const userCommunitiesRef = collection(db, 'users', user.uid, 'communities');
              const userCommunitiesSnap = await getDocs(userCommunitiesRef);
              const userCommunity = userCommunitiesSnap.docs.find(doc => doc.data().communityId === communityId);
              userIsMember = !!userCommunity;
            } catch (error) {
              console.error('Error checking user communities:', error);
            }
          }
          
          setIsMember(userIsMember);
        }
      }
    } catch (error) {
      console.error('Error loading community:', error);
    }
  };

  const loadCommunityPosts = () => {
    try {
      const postsRef = collection(db, 'posts');
      const q = query(
        postsRef, 
        where('communityId', '==', communityId),
        orderBy('createdAt', 'desc')
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const communityPosts: Post[] = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            title: data.title,
            description: data.description,
            category: data.submessName || data.type || 'General',
            postedBy: data.userEmail?.split('@')[0] || 'Anonymous',
            postedAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
            userId: data.userId,
            userEmail: data.userEmail,
            communityId: data.communityId,
            communityName: data.communityName,
            submessId: data.submessId,
            submessName: data.submessName
          };
        });
        setPosts(communityPosts);
      });

      return unsubscribe;
    } catch (error) {
      console.error('Error loading community posts:', error);
    }
  };

  const handleJoinClick = () => {
    if (!user || !community) return;
    
    // Check if community has enrollment questions
    if (community.isPrivate && community.enrollmentQuestions && community.enrollmentQuestions.length > 0) {
      setShowEnrollmentForm(true);
    } else {
      joinCommunity();
    }
  };

  const joinCommunity = async () => {
    if (!user || !community || joining) return;
    
    setJoining(true);
    try {
      if (community.isPrivate && community.enrollmentQuestions && community.enrollmentQuestions.length > 0) {
        // For private communities with enrollment questions, create a join request
        const joinRequestsRef = collection(db, 'communities', communityId, 'joinRequests');
        await addDoc(joinRequestsRef, {
          userId: user.uid,
          userEmail: user.email,
          username: userProfile?.username || user.email?.split('@')[0] || 'User',
          answers: enrollmentAnswers,
          requestedAt: serverTimestamp(),
          status: 'pending'
        });
        
        alert('Your join request has been submitted! Community admins will review it soon.');
        setShowEnrollmentForm(false);
        setEnrollmentAnswers({});
      } else {
        // For public communities or private without questions, join directly
        const communityRef = doc(db, 'communities', communityId);
        const updatedMembers = { ...community.members, [user.uid]: true };
        
        await updateDoc(communityRef, {
          members: updatedMembers,
          memberCount: increment(1)
        });
        
        // Add community to user's communities
        const userCommunityRef = doc(db, 'users', user.uid, 'communities', communityId);
        await setDoc(userCommunityRef, {
          communityId: communityId,
          communityName: community.name,
          role: 'member',
          joinedAt: serverTimestamp()
        });
        
        setIsMember(true);
        setCommunity(prev => prev ? { ...prev, members: updatedMembers, memberCount: prev.memberCount + 1 } : null);
      }
    } catch (error) {
      console.error('Error joining community:', error);
      alert('Error joining community. Please try again.');
    } finally {
      setJoining(false);
    }
  };

  const filteredPosts = posts.filter(post => {
    if (activeSubmesh === 'All') return true;
    return post.category === activeSubmesh;
  });

  const formatTimeAgo = (date: Date): string => {
    const now = Date.now();
    const diffInSeconds = Math.floor((now - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!community) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Community Not Found</h2>
          <p className="text-gray-600 mb-4">The community you're looking for doesn't exist.</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar userProfile={userProfile} />
      
      <div className="max-w-4xl mx-auto px-4 py-6 pt-8">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => router.back()}
              className="flex items-center text-gray-600 hover:text-gray-900"
            >
              <ArrowLeftIcon className="h-5 w-5 mr-2" />
              Back
            </button>
            
            {!isMember ? (
              <button
                onClick={handleJoinClick}
                disabled={joining}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center"
              >
                <PlusIcon className="h-4 w-4 mr-2" />
                {joining ? 'Joining...' : 'Join Mesh'}
              </button>
            ) : (
              <div className="bg-green-100 text-green-800 px-4 py-2 rounded-lg flex items-center">
                <span className="text-sm font-medium">✓ Joined</span>
              </div>
            )}
          </div>
          
          <div className="flex items-start space-x-4">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
              <UserGroupIcon className="h-8 w-8 text-blue-600" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{community.name}</h1>
              <p className="text-gray-600 mb-3">{community.description}</p>
              <div className="flex items-center space-x-4 text-sm text-gray-500">
                <span>{community.memberCount} members</span>
                <span>•</span>
                <span>{community.isPrivate ? 'Private' : 'Public'} mesh</span>
                {isMember && (
                  <>
                    <span>•</span>
                    <span className="text-green-600 font-medium">Member</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Private Mesh Access Check */}
        {community.isPrivate && !isMember ? (
          <div className="bg-white rounded-xl shadow-sm border p-8 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <UserGroupIcon className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Private Mesh</h3>
            <p className="text-gray-600 mb-4">
              This is a private mesh. You need to join to see posts and participate in discussions.
            </p>
            <button
              onClick={handleJoinClick}
              disabled={joining}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center mx-auto"
            >
              <PlusIcon className="h-4 w-4 mr-2" />
              {joining ? 'Joining...' : 'Join Mesh'}
            </button>
          </div>
        ) : (
          <>
            {/* Submesh Filters */}
            {community.submesses && community.submesses.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border p-4 mb-6">
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setActiveSubmesh('All')}
                    className={`px-3 py-1 rounded-full text-sm font-medium ${
                      activeSubmesh === 'All'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    All ({posts.length})
                  </button>
                  {community.submesses.map((submesh) => {
                    const count = posts.filter(post => post.category === submesh.name).length;
                    return (
                      <button
                        key={submesh.name}
                        onClick={() => setActiveSubmesh(submesh.name)}
                        className={`px-3 py-1 rounded-full text-sm font-medium ${
                          activeSubmesh === submesh.name
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {submesh.name} ({count})
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Posts */}
            <div className="space-y-4">
              {filteredPosts.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm border p-8 text-center">
                  <p className="text-gray-500">No posts in this mesh yet.</p>
                  {isMember && (
                    <p className="text-sm text-gray-400 mt-2">Be the first to create a post!</p>
                  )}
                </div>
              ) : (
                filteredPosts.map((post) => (
                  <div key={post.id} className="bg-white rounded-xl shadow-sm border p-6">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center text-sm text-gray-500 space-x-2">
                        <button
                          onClick={() => router.push(`/profile/${post.userId}`)}
                          className="font-medium text-gray-700 hover:text-blue-600 cursor-pointer"
                        >
                          {post.postedBy}
                        </button>
                        <span>•</span>
                        <span>{formatTimeAgo(new Date(post.postedAt))}</span>
                        {post.submessName && (
                          <>
                            <span>•</span>
                            <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">
                              {post.submessName}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    
                    <h3 
                      className="font-semibold text-gray-900 text-lg mb-3 cursor-pointer hover:text-blue-600"
                      onClick={() => router.push(`/post/${post.id}`)}
                    >
                      {post.title}
                    </h3>
                    
                    <p className="text-gray-700 mb-4 line-clamp-3">{post.description}</p>
                    
                    <PostInteractions
                      postId={post.id}
                      postUserId={post.userId}
                      onCommentClick={() => router.push(`/post/${post.id}`)}
                    />
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>

      {/* Enrollment Form Modal */}
      {showEnrollmentForm && community?.enrollmentQuestions && (
        <div className="fixed inset-0 bg-white/20 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl w-full max-w-md max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Join {community.name}</h3>
                <button
                  onClick={() => {
                    setShowEnrollmentForm(false);
                    setEnrollmentAnswers({});
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <p className="text-gray-600 mb-6">
                Please answer the following questions to join this private mesh:
              </p>
              
              <form onSubmit={(e) => { e.preventDefault(); joinCommunity(); }} className="space-y-4">
                {community.enrollmentQuestions.map((question) => (
                  <div key={question.id}>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {question.question}
                      {question.required && <span className="text-red-500 ml-1">*</span>}
                    </label>
                    
                    {question.type === 'text' ? (
                      <textarea
                        value={enrollmentAnswers[question.id] || ''}
                        onChange={(e) => setEnrollmentAnswers(prev => ({
                          ...prev,
                          [question.id]: e.target.value
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                        rows={3}
                        required={question.required}
                        placeholder="Your answer..."
                      />
                    ) : question.type === 'select' && question.options ? (
                      <select
                        value={enrollmentAnswers[question.id] || ''}
                        onChange={(e) => setEnrollmentAnswers(prev => ({
                          ...prev,
                          [question.id]: e.target.value
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                        required={question.required}
                      >
                        <option value="">Select an option</option>
                        {question.options.map((option, index) => (
                          <option key={index} value={option}>{option}</option>
                        ))}
                      </select>
                    ) : null}
                  </div>
                ))}
                
                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEnrollmentForm(false);
                      setEnrollmentAnswers({});
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={joining}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {joining ? 'Submitting...' : 'Submit Request'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}