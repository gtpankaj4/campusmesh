"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import { collection, query, where, orderBy, onSnapshot, doc, getDoc, updateDoc, getDocs } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { PencilIcon, UserIcon, EnvelopeIcon, CalendarDaysIcon, AcademicCapIcon } from "@heroicons/react/24/outline";
import PostInteractions from "@/components/PostInteractions";
import RepBadge from "@/components/RepBadge";
import Navbar from "@/components/Navbar";

interface UserProfile {
  username?: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  email?: string;
  university?: string;
  bio?: string;
  coverColor?: string;
  showPostsToPublic?: boolean;
  showEmailToPublic?: boolean;
  reputation: number;
  postsCount: number;
  commentsCount: number;
  communitiesCount: number;
  joinDate: any;
  profileSetup?: boolean;
}

interface UserPost {
  id: string;
  title: string;
  description: string;
  type: string;
  userId?: string;
  createdAt: any;
  communityName?: string;
  submessName?: string;
  meshType?: string;
  upvotes?: number;
  downvotes?: number;
  commentsCount?: number;
}

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [userPosts, setUserPosts] = useState<UserPost[]>([]);
  const [userCommunities, setUserCommunities] = useState<any[]>([]);
  const [actualPostsCount, setActualPostsCount] = useState(0);
  const [actualCommentsCount, setActualCommentsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'posts' | 'communities'>('posts');
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUser(user);
        await loadUserProfile(user.uid);
        await loadUserPosts(user.uid);
        await loadUserCommunities(user.uid);
        await loadActualCounts(user.uid);
      } else {
        router.push("/login");
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  const loadUserProfile = async (userId: string) => {
    try {
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        const userData = userSnap.data() as UserProfile;
        setProfile(userData);
        
        // Only redirect to setup if user is accessing profile directly without username
        // Don't redirect if they're editing (we'll handle this in the UI)
      } else {
        // Create new user profile
        const newProfile: UserProfile = {
          reputation: 0,
          postsCount: 0,
          commentsCount: 0,
          communitiesCount: 0,
          joinDate: new Date()
        };
        setProfile(newProfile);
        // Don't redirect new users automatically
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  const loadUserPosts = async (userId: string) => {
    try {
      const postsRef = collection(db, 'posts');
      const q = query(postsRef, where('userId', '==', userId), orderBy('createdAt', 'desc'));
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const posts: UserPost[] = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as UserPost[];
        setUserPosts(posts);
      });

      return unsubscribe;
    } catch (error) {
      console.error('Error loading posts:', error);
    }
  };

  const loadUserCommunities = async (userId: string) => {
    try {
      const userCommunitiesRef = collection(db, 'users', userId, 'communities');
      const q = query(userCommunitiesRef, orderBy('joinedAt', 'desc'));
      
      const unsubscribe = onSnapshot(q, async (snapshot) => {
        const communities = [];
        
        for (const docSnap of snapshot.docs) {
          const communityData = docSnap.data();
          try {
            // Get full community details
            const communityRef = doc(db, 'communities', communityData.communityId);
            const communitySnap = await getDoc(communityRef);
            
            if (communitySnap.exists()) {
              communities.push({
                id: communityData.communityId,
                name: communityData.communityName,
                role: communityData.role,
                joinedAt: communityData.joinedAt,
                ...communitySnap.data()
              });
            }
          } catch (error) {
            console.error('Error loading community details:', error);
          }
        }
        
        setUserCommunities(communities);
      });

      return unsubscribe;
    } catch (error) {
      console.error('Error loading user communities:', error);
    }
  };

  const formatTimeAgo = (date: Date): string => {
    const now = Date.now();
    const diffInSeconds = Math.floor((now - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  };

  const loadActualCounts = async (userId: string) => {
    try {
      // Count all posts by user
      const postsRef = collection(db, 'posts');
      const postsQuery = query(postsRef, where('userId', '==', userId));
      const postsSnapshot = await getDocs(postsQuery);
      setActualPostsCount(postsSnapshot.size);

      // Count all comments by user across all posts
      let totalComments = 0;
      const allPostsSnapshot = await getDocs(collection(db, 'posts'));
      
      for (const postDoc of allPostsSnapshot.docs) {
        const commentsRef = collection(db, 'posts', postDoc.id, 'comments');
        const commentsQuery = query(commentsRef, where('userId', '==', userId));
        const commentsSnapshot = await getDocs(commentsQuery);
        totalComments += commentsSnapshot.size;
      }
      
      setActualCommentsCount(totalComments);
    } catch (error) {
      console.error('Error loading actual counts:', error);
    }
  };

  const togglePostVisibility = async () => {
    if (!user) return;
    
    try {
      const userRef = doc(db, 'users', user.uid);
      const newValue = !profile?.showPostsToPublic;
      
      await updateDoc(userRef, {
        showPostsToPublic: newValue
      });
      
      // Update local state
      setProfile(prev => prev ? { ...prev, showPostsToPublic: newValue } : null);
    } catch (error) {
      console.error('Error updating post visibility:', error);
    }
  };



  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar userProfile={profile} />
      
      <div className="max-w-6xl mx-auto px-4 py-6 pt-8">
        {/* Cover Section */}
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden mb-6">
          <div 
            className="h-48 relative"
            style={{ backgroundColor: profile?.coverColor || '#3B82F6' }}
          >
            <div className="absolute top-4 right-4">
              <button
                onClick={() => router.push('/profile/edit')}
                className="bg-white bg-opacity-90 backdrop-blur-sm text-gray-900 px-3 py-2 rounded-full hover:bg-opacity-100 transition-all flex items-center space-x-2 shadow-sm border border-gray-200"
                aria-label="Edit profile"
              >
                <PencilIcon className="h-4 w-4" />
                <span className="text-sm font-medium">Edit profile</span>
              </button>
            </div>
            
            <div className="absolute bottom-6 left-6 flex items-end space-x-4">
              <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-lg">
                <span className="text-3xl font-bold text-gray-700">
                  {profile?.firstName?.charAt(0)?.toUpperCase() || user?.email?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="text-white pb-2">
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold">
                  {profile?.displayName || `${profile?.firstName} ${profile?.lastName}` || profile?.username || user?.email?.split('@')[0] || 'User'}
                </h1>
                <p className="text-sm sm:text-base lg:text-lg opacity-90">@{profile?.username || 'username'}</p>
              </div>
            </div>
          </div>
          
          <div className="p-6">
            <hr className="mb-6" />
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column - Bio and Details */}
              <div className="lg:col-span-1">
                <div className="space-y-4">
                  {profile?.bio && (
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-2">About</h3>
                      <p className="text-gray-600">{profile.bio}</p>
                    </div>
                  )}
                  
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">Details</h3>
                    <div className="space-y-2 text-sm text-gray-600">
                      {profile?.university && (
                        <div className="flex items-center space-x-2">
                          <AcademicCapIcon className="h-4 w-4 text-gray-400" />
                          <span>{profile.university}</span>
                        </div>
                      )}
                      {(profile?.showEmailToPublic || user?.uid === user?.uid) && (
                        <div className="flex items-center space-x-2">
                          <EnvelopeIcon className="h-4 w-4 text-gray-400" />
                          <span>{profile?.email || user?.email}</span>
                        </div>
                      )}
                      <div className="flex items-center space-x-2">
                        <CalendarDaysIcon className="h-4 w-4 text-gray-400" />
                        <span>Member since {profile?.joinDate?.toDate ? 
                          profile.joinDate.toDate().toLocaleDateString() : 'Recently'}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RepBadge score={profile?.reputation || 0} size="sm" />
                        <span>{profile?.reputation || 0} reputation</span>
                      </div>
                    </div>
                  </div>

                  {/* Privacy Toggle */}
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-gray-900 text-sm">Show posts to visitors</h4>
                        <p className="text-xs text-gray-600">
                          {profile?.showPostsToPublic ? 'Your public posts are visible to everyone' : 'Your posts are only visible to mesh members'}
                        </p>
                      </div>
                      <button
                        onClick={() => togglePostVisibility()}
                        className={`w-11 h-6 rounded-full relative transition-colors ${profile?.showPostsToPublic ? 'bg-blue-600' : 'bg-gray-300'}`}
                      >
                        <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${profile?.showPostsToPublic ? 'translate-x-5' : 'translate-x-0.5'} shadow-sm`}></div>
                      </button>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="bg-blue-50 rounded-lg p-3">
                      <p className="text-xl font-bold text-blue-600">{actualPostsCount}</p>
                      <p className="text-xs text-blue-500">Posts</p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-3">
                      <p className="text-xl font-bold text-green-600">{actualCommentsCount}</p>
                      <p className="text-xs text-green-500">Comments</p>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-3">
                      <p className="text-xl font-bold text-purple-600">{userCommunities.length}</p>
                      <p className="text-xs text-purple-500">Meshes</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column - Posts */}
              <div className="lg:col-span-2">
                <div className="bg-gray-50 rounded-lg p-1 mb-6">
                  <div className="flex">
                    <button
                      onClick={() => setActiveTab('posts')}
                      className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors ${
                        activeTab === 'posts'
                          ? 'bg-white text-blue-600 shadow-sm'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      Posts ({userPosts.length})
                    </button>
                    <button
                      onClick={() => setActiveTab('communities')}
                      className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors ${
                        activeTab === 'communities'
                          ? 'bg-white text-blue-600 shadow-sm'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      Meshes ({userCommunities.length})
                    </button>
                  </div>
                </div>

                {/* Posts Content */}
                {activeTab === 'posts' && (
                  <div>
                    {userPosts.length === 0 ? (
                      <div className="text-center py-12">
                        <UserIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No posts yet</h3>
                        <p className="text-gray-500">Start sharing your thoughts with the community!</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {userPosts.map((post) => (
                          <div 
                            key={post.id} 
                            className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-all duration-200 flex flex-col h-full group cursor-pointer"
                            onClick={() => router.push(`/post/${post.id}`)}
                          >
                            <div className="p-4 pb-2">
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center text-xs text-gray-500 space-x-1">
                                  <button className="font-medium text-gray-700 hover:text-blue-600 cursor-pointer">
                                    @{profile?.username || user?.email?.split('@')[0] || 'user'}
                                  </button>
                                  {post.communityName && (
                                    <>
                                      <span>›</span>
                                      <span className="px-2 py-0.5 bg-stone-100 text-stone-700 rounded-md text-xs hover:bg-stone-200 cursor-pointer transition-colors" title={post.communityName}>
                                        {post.communityName}
                                      </span>
                                    </>
                                  )}
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
                                  {post.createdAt?.toDate ? 
                                    formatTimeAgo(post.createdAt.toDate()) : 'Recently'}
                                </span>
                              </div>
                              <h3 className="font-semibold text-gray-900 text-base leading-tight mb-2 cursor-pointer hover:text-blue-600 transition-colors line-clamp-2">
                                {post.title}
                              </h3>
                            </div>
                            
                            <div className="px-4 pb-3 flex-1">
                              <div className="text-gray-600 text-sm leading-relaxed">
                                <p className="line-clamp-3">{post.description}</p>
                                {post.description && post.description.length > 150 && (
                                  <button className="text-blue-600 hover:text-blue-700 text-xs mt-2 font-medium inline-flex items-center group-hover:underline">
                                    Read more
                                    <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
                                    </svg>
                                  </button>
                                )}
                              </div>
                            </div>
                            
                            <PostInteractions 
                              postId={post.id} 
                              postUserId={post.userId || user?.uid || ''} 
                              onCommentClick={() => router.push(`/post/${post.id}`)}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Communities Content */}
                {activeTab === 'communities' && (
                  <div>
                    {userCommunities.length === 0 ? (
                      <div className="text-center py-12">
                        <UserIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No meshes yet</h3>
                        <p className="text-gray-500">Join some meshes to connect with your community!</p>
                        <button
                          onClick={() => router.push('/community')}
                          className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                        >
                          Browse Meshes
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-4">
                        {userCommunities.map((community) => (
                          <div 
                            key={community.id} 
                            className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                            onClick={() => router.push(`/community/${community.id}?returnTo=/profile`)}
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center space-x-3 min-w-0 flex-1">
                                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                                  <span className="text-lg font-bold text-blue-600">
                                    {community.name?.charAt(0)?.toUpperCase()}
                                  </span>
                                </div>
                                <div className="min-w-0 flex-1">
                                  <h3 className="font-semibold text-gray-900 truncate">{community.name}</h3>
                                  <p className="text-sm text-gray-600 line-clamp-2 sm:line-clamp-1">{community.description}</p>
                                </div>
                              </div>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium flex-shrink-0 ml-2 ${
                                community.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                                community.role === 'moderator' ? 'bg-blue-100 text-blue-800' :
                                'bg-green-100 text-green-800'
                              }`}>
                                {community.role}
                              </span>
                            </div>
                            
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-sm text-gray-500 space-y-2 sm:space-y-0">
                              <div className="flex items-center space-x-4">
                                <span>{community.memberCount || 0} members</span>
                                <span>•</span>
                                <span>{community.isPrivate ? 'Private' : 'Public'}</span>
                              </div>
                              <span className="text-xs">
                                Joined {community.joinedAt?.toDate ? 
                                  community.joinedAt.toDate().toLocaleDateString() : 'Recently'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 