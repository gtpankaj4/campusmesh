"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import { collection, doc, getDoc, getDocs, addDoc, query, where, orderBy, onSnapshot, updateDoc, increment, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { ArrowLeftIcon, UserGroupIcon, PlusIcon, CogIcon } from "@heroicons/react/24/outline";
import Navbar from "@/components/Navbar";
import PostInteractions from "@/components/PostInteractions";
import RepBadge from "@/components/RepBadge";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";

// Add body scroll lock for modals
const useModalScrollLock = (showEnrollmentForm: boolean, showCreatePostModal: boolean) => {
  useBodyScrollLock(showEnrollmentForm || showCreatePostModal);
};

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
  moderators?: { [key: string]: boolean };
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
  const [userRole, setUserRole] = useState<'member' | 'moderator' | 'admin' | null>(null);
  const [joining, setJoining] = useState(false);
  const [activeSubmesh, setActiveSubmesh] = useState<string>('All');
  const [showEnrollmentForm, setShowEnrollmentForm] = useState(false);
  const [enrollmentAnswers, setEnrollmentAnswers] = useState<{ [key: string]: string }>({});
  const [showCreatePostModal, setShowCreatePostModal] = useState(false);
  const [postFormData, setPostFormData] = useState({
    title: '',
    description: '',
    submessId: ''
  });
  const [isSubmittingPost, setIsSubmittingPost] = useState(false);
  const router = useRouter();
  const params = useParams();
  const communityId = params.communityId as string;

  // Use scroll lock for modals
  useModalScrollLock(showEnrollmentForm, showCreatePostModal);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUser(user);
        await loadUserProfile(user.uid);
        await loadCommunity(user); // Pass user directly to avoid timing issues
        loadCommunityPosts();
      } else {
        router.push("/login");
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router, communityId]);

  // Re-check membership when community data changes
  useEffect(() => {
    if (user && community) {
      checkMembership(user, community);
    }
  }, [user, community]);

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

  const loadCommunity = async (currentUser?: User) => {
    try {
      const communityRef = doc(db, 'communities', communityId);
      const communitySnap = await getDoc(communityRef);
      
      if (communitySnap.exists()) {
        const communityData = { id: communitySnap.id, ...communitySnap.data() } as Community;
        setCommunity(communityData);
        
        // Use the passed user or the state user
        const userToCheck = currentUser || user;
        
        if (userToCheck) {
          await checkMembership(userToCheck, communityData);
        }
      }
    } catch (error) {
      console.error('Error loading community:', error);
    }
  };

  const checkMembership = async (currentUser: User, communityData: Community) => {
    try {
      let userIsMember = false;
      let role: 'member' | 'moderator' | 'admin' | null = null;
      
      // First check in community.members object
      if (communityData.members && typeof communityData.members === 'object') {
        userIsMember = communityData.members[currentUser.uid] !== undefined;
      }
      
      // Check if user is a moderator
      if (communityData.moderators && communityData.moderators[currentUser.uid]) {
        userIsMember = true;
        role = 'moderator';
      }
      
      // Get detailed role from user's communities collection
      if (userIsMember || !userIsMember) { // Always check for accurate role info
        try {
          const userCommunitiesRef = collection(db, 'users', currentUser.uid, 'communities');
          const userCommunitiesSnap = await getDocs(userCommunitiesRef);
          const userCommunity = userCommunitiesSnap.docs.find(doc => doc.data().communityId === communityId);
          
          if (userCommunity) {
            userIsMember = true;
            const userData = userCommunity.data();
            role = userData.role || 'member';
          }
        } catch (error) {
          console.error('Error checking user communities:', error);
        }
      }
      
      console.log('Membership check result:', { 
        userId: currentUser.uid, 
        communityId, 
        isMember: userIsMember,
        role,
        membersObject: communityData.members,
        moderatorsObject: communityData.moderators
      });
      
      setIsMember(userIsMember);
      setUserRole(role);
    } catch (error) {
      console.error('Error checking membership:', error);
      setIsMember(false);
      setUserRole(null);
    }
  };

  const loadCommunityPosts = () => {
    try {
      const postsRef = collection(db, 'posts');
      const q = query(
        postsRef, 
        where('communityId', '==', communityId)
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
        
        // Sort manually by createdAt since we can't use orderBy with where on different fields
        communityPosts.sort((a, b) => {
          const aTime = new Date(a.postedAt).getTime();
          const bTime = new Date(b.postedAt).getTime();
          return bTime - aTime; // Descending order (newest first)
        });
        
        console.log('Loaded community posts:', communityPosts.length, 'posts for community:', communityId);
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

  const createPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !community || isSubmittingPost) return;

    setIsSubmittingPost(true);
    try {
      const postData: any = {
        title: postFormData.title.trim(),
        description: postFormData.description.trim(),
        type: postFormData.submessId || 'General',
        userId: user.uid,
        createdAt: serverTimestamp(),
        userEmail: user.email || '',
        communityId: communityId,
        communityName: community.name
      };

      // Add submesh information if selected
      if (postFormData.submessId && postFormData.submessId.trim() !== '') {
        const selectedSubmesh = community.submesses?.find(s => s.name === postFormData.submessId);
        if (selectedSubmesh) {
          postData.submessId = postFormData.submessId;
          postData.submessName = postFormData.submessId;
        }
      }

      await addDoc(collection(db, 'posts'), postData);

      // Update user reputation (+10 for creating a post)
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      
      if (!userSnap.exists()) {
        const username = user.email?.split('@')[0] || 'User';
        await setDoc(userRef, {
          email: user.email || '',
          username: username,
          reputation: 10,
          postsCount: 1,
          commentsCount: 0,
          communitiesCount: 0,
          joinDate: serverTimestamp()
        });
      } else {
        await updateDoc(userRef, {
          reputation: increment(10),
          postsCount: increment(1)
        });
      }

      setShowCreatePostModal(false);
      setPostFormData({ title: '', description: '', submessId: '' });
      alert('Post created successfully! +10 reputation gained!');
    } catch (error) {
      console.error('Error creating post:', error);
      alert('Error creating post. Please try again.');
    } finally {
      setIsSubmittingPost(false);
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
      
      <div className="max-w-7xl mx-auto px-6 py-6 pt-8">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => router.push('/community')}
              className="flex items-center text-gray-600 hover:text-gray-900"
            >
              <ArrowLeftIcon className="h-5 w-5 mr-2" />
              Back
            </button>
            
            <div className="flex items-center space-x-3">
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
                <div className="flex items-center space-x-2 flex-wrap">
                  <div className="bg-green-100 text-green-800 px-3 py-2 rounded-lg flex items-center">
                    <span className="text-sm font-medium hidden sm:inline">✓ Joined</span>
                    <span className="text-sm font-medium sm:hidden">✓</span>
                  </div>
                  <button
                    onClick={() => setShowCreatePostModal(true)}
                    className="bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 flex items-center"
                  >
                    <PlusIcon className="h-4 w-4 sm:mr-1" />
                    <span className="hidden sm:inline">Create Post</span>
                  </button>
                  {(userRole === 'moderator' || userRole === 'admin') && (
                    <button
                      onClick={() => router.push(`/community/${communityId}/moderate`)}
                      className="bg-purple-600 text-white px-3 py-2 rounded-lg hover:bg-purple-700 flex items-center"
                    >
                      <CogIcon className="h-4 w-4 sm:mr-1" />
                      <span className="hidden sm:inline">Moderate</span>
                    </button>
                  )}
                </div>
              )}
            </div>
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
                    <span className={`font-medium ${
                      userRole === 'admin' ? 'text-purple-600' :
                      userRole === 'moderator' ? 'text-blue-600' :
                      'text-green-600'
                    }`}>
                      {userRole === 'admin' ? 'Admin' :
                       userRole === 'moderator' ? 'Moderator' :
                       'Member'}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Content Access Logic */}
        {community.isPrivate && !isMember ? (
          // Private community and user is not a member - show join prompt
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
          // Public community OR user is a member - show content
          <>
            {/* Submesh Filters */}
            {community.submesses && community.submesses.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border p-4 mb-6">
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setActiveSubmesh('All')}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium ${
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
                        className={`px-2.5 py-1 rounded-full text-xs font-medium ${
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

            {/* Community Info and Submeshes */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              {/* About Section */}
              <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">About</h3>
                <p className="text-gray-700 mb-4">{community.description}</p>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-900">Members:</span>
                    <span className="ml-2 text-gray-600">{community.memberCount}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-900">Type:</span>
                    <span className="ml-2 text-gray-600">{community.isPrivate ? 'Private' : 'Public'}</span>
                  </div>
                </div>
              </div>

              {/* Submeshes Section */}
              {community.submesses && community.submesses.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Submeshes</h3>
                  <div className="space-y-2">
                    {community.submesses.map((submesh, index) => (
                      <div key={index} className="p-3 bg-gray-50 rounded-lg">
                        <h4 className="font-medium text-gray-900 text-sm">{submesh.name}</h4>
                        <p className="text-xs text-gray-600 mt-1">{submesh.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Posts */}
            <div>
              {filteredPosts.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm border p-8 text-center">
                  <p className="text-gray-500">No posts in this mesh yet.</p>
                  {isMember && (
                    <p className="text-sm text-gray-400 mt-2">Be the first to create a post!</p>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredPosts.map((post) => {
                    const shouldTruncate = post.description.length > 120;
                    const displayText = shouldTruncate 
                      ? post.description.substring(0, 120) + '...' 
                      : post.description;
                    
                    return (
                      <div 
                        key={post.id} 
                        className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-all duration-200 flex flex-col h-full group"
                      >
                        {/* Header with breadcrumb style */}
                        <div className="p-4 pb-2">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center text-xs text-gray-500 space-x-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  router.push(`/profile/${post.userId}`);
                                }}
                                className="font-medium text-gray-700 hover:text-blue-600 cursor-pointer"
                              >
                                {post.postedBy}
                              </button>
                              {post.submessName && (
                                <>
                                  <span>›</span>
                                  <span className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded-md text-xs font-medium">
                                    {post.submessName}
                                  </span>
                                </>
                              )}
                            </div>
                            <span className="text-xs text-gray-400">
                              {formatTimeAgo(new Date(post.postedAt))}
                            </span>
                          </div>
                          
                          {/* Title */}
                          <h3 
                            className="font-semibold text-gray-900 text-base leading-tight mb-2 cursor-pointer hover:text-blue-600 transition-colors line-clamp-2"
                            onClick={() => router.push(`/post/${post.id}`)}
                          >
                            {post.title}
                          </h3>
                        </div>
                        
                        {/* Content */}
                        <div className="px-4 pb-3 flex-1">
                          <div className="text-gray-600 text-sm leading-relaxed">
                            <p className="line-clamp-3">{displayText}</p>
                            {shouldTruncate && (
                              <button
                                onClick={() => router.push(`/post/${post.id}`)}
                                className="text-blue-600 hover:text-blue-700 text-xs mt-2 font-medium inline-flex items-center group-hover:underline"
                              >
                                Read more
                                <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                              </button>
                            )}
                          </div>
                        </div>
                        
                        {/* Actions */}
                        <div className="border-t border-gray-100">
                          <PostInteractions
                            postId={post.id}
                            postUserId={post.userId}
                            onCommentClick={(e) => {
                              e?.stopPropagation();
                              router.push(`/post/${post.id}`);
                            }}
                            className="mt-0 pt-3 border-t-0"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Create Post Modal */}
      {showCreatePostModal && (
        <div className="fixed inset-0 bg-white/20 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Create Post in {community?.name}</h3>
                <button
                  onClick={() => {
                    setShowCreatePostModal(false);
                    setPostFormData({ title: '', description: '', submessId: '' });
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <form onSubmit={createPost} className="space-y-4">
                {/* Submesh Selection */}
                {community?.submesses && community.submesses.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Submesh (Optional)
                    </label>
                    <select
                      value={postFormData.submessId}
                      onChange={(e) => setPostFormData(prev => ({ ...prev, submessId: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                    >
                      <option value="">General</option>
                      {community.submesses.map((submesh) => (
                        <option key={submesh.name} value={submesh.name}>
                          {submesh.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={postFormData.title}
                    onChange={(e) => setPostFormData(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                    placeholder="What's your post about?"
                    required
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={postFormData.description}
                    onChange={(e) => setPostFormData(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                    rows={4}
                    placeholder="Share your thoughts..."
                    required
                  />
                </div>
                
                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreatePostModal(false);
                      setPostFormData({ title: '', description: '', submessId: '' });
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingPost}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isSubmittingPost ? 'Creating...' : 'Create Post'}
                  </button>
                </div>
              </form>
          </div>
        </div>
      )}

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