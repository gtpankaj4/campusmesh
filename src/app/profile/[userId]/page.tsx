"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import { collection, doc, getDoc, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { ArrowLeftIcon, UserIcon } from "@heroicons/react/24/outline";
import Navbar from "@/components/Navbar";
import RepBadge from "@/components/RepBadge";

interface UserProfile {
  username?: string;
  email: string;
  reputation: number;
  postsCount: number;
  commentsCount: number;
  communitiesCount: number;
  joinDate: any;
}

interface UserPost {
  id: string;
  title: string;
  description: string;
  type: string;
  createdAt: any;
  communityName?: string;
  submessName?: string;
}

interface UserCommunity {
  communityId: string;
  communityName: string;
  role: string;
  joinedAt: any;
}

export default function UserProfilePage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<{ username?: string; reputation?: number } | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [userPosts, setUserPosts] = useState<UserPost[]>([]);
  const [userCommunities, setUserCommunities] = useState<UserCommunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'posts' | 'communities'>('posts');
  const router = useRouter();
  const params = useParams();
  const userId = params.userId as string;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        await loadCurrentUserProfile(user.uid);
        await loadUserProfile();
        await loadUserPosts();
        await loadUserCommunities();
      } else {
        router.push("/login");
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router, userId]);

  const loadCurrentUserProfile = async (currentUserId: string) => {
    try {
      const userRef = doc(db, 'users', currentUserId);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        setCurrentUserProfile(userSnap.data());
      }
    } catch (error) {
      console.error('Error loading current user profile:', error);
    }
  };

  const loadUserProfile = async () => {
    try {
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        setUserProfile(userSnap.data() as UserProfile);
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  };

  const loadUserPosts = () => {
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
      console.error('Error loading user posts:', error);
    }
  };

  const loadUserCommunities = () => {
    try {
      const userCommunitiesRef = collection(db, 'users', userId, 'communities');
      const q = query(userCommunitiesRef, orderBy('joinedAt', 'desc'));
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const communities: UserCommunity[] = snapshot.docs.map(doc => ({
          ...doc.data()
        })) as UserCommunity[];
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!userProfile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">User Not Found</h2>
          <p className="text-gray-600 mb-4">The user profile you're looking for doesn't exist.</p>
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

  const isOwnProfile = currentUser?.uid === userId;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar userProfile={currentUserProfile} />
      
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
            
            {isOwnProfile && (
              <button
                onClick={() => router.push('/profile')}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                Edit Profile
              </button>
            )}
          </div>
          
          <div className="flex items-start space-x-6">
            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-3xl font-bold text-blue-600">
                {(userProfile.username || userProfile.email)?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                {userProfile.username || userProfile.email?.split('@')[0] || 'User'}
              </h1>
              <p className="text-gray-600 mb-3">{userProfile.email}</p>
              <div className="flex items-center space-x-4 mb-4">
                <RepBadge score={userProfile.reputation || 0} size="lg" />
                <span className="text-sm text-gray-500">
                  Member since {userProfile.joinDate?.toDate ? 
                    userProfile.joinDate.toDate().toLocaleDateString() : 'Recently'}
                </span>
              </div>
              
              {/* Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center bg-gray-50 rounded-lg p-3">
                  <p className="text-2xl font-bold text-gray-900">{userProfile.postsCount || 0}</p>
                  <p className="text-sm text-gray-500">Posts</p>
                </div>
                <div className="text-center bg-gray-50 rounded-lg p-3">
                  <p className="text-2xl font-bold text-gray-900">{userProfile.commentsCount || 0}</p>
                  <p className="text-sm text-gray-500">Comments</p>
                </div>
                <div className="text-center bg-gray-50 rounded-lg p-3">
                  <p className="text-2xl font-bold text-gray-900">{userCommunities.length}</p>
                  <p className="text-sm text-gray-500">Meshes</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm border mb-6">
          <div className="flex">
            <button
              onClick={() => setActiveTab('posts')}
              className={`flex-1 py-3 px-4 text-sm font-medium border-b-2 ${
                activeTab === 'posts'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500'
              }`}
            >
              Posts ({userPosts.length})
            </button>
            <button
              onClick={() => setActiveTab('communities')}
              className={`flex-1 py-3 px-4 text-sm font-medium border-b-2 ${
                activeTab === 'communities'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500'
              }`}
            >
              Meshes ({userCommunities.length})
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          {activeTab === 'posts' && (
            <div>
              {userPosts.length === 0 ? (
                <div className="text-center py-8">
                  <UserIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No posts yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {userPosts.map((post) => (
                    <div 
                      key={post.id} 
                      className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer"
                      onClick={() => router.push(`/post/${post.id}`)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-gray-900">{post.title}</h3>
                        <span className="text-xs text-gray-500">
                          {post.createdAt?.toDate ? 
                            formatTimeAgo(post.createdAt.toDate()) : 'Recently'}
                        </span>
                      </div>
                      <p className="text-gray-600 text-sm mb-2 line-clamp-2">{post.description}</p>
                      <div className="flex items-center space-x-2 text-xs text-gray-500">
                        {post.communityName && (
                          <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                            {post.communityName}
                          </span>
                        )}
                        {post.submessName && (
                          <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded-full">
                            {post.submessName}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'communities' && (
            <div>
              {userCommunities.length === 0 ? (
                <div className="text-center py-8">
                  <UserIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">Not a member of any meshes yet</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {userCommunities.map((community) => (
                    <div 
                      key={community.communityId}
                      className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer"
                      onClick={() => router.push(`/community/${community.communityId}`)}
                    >
                      <h3 className="font-semibold text-gray-900 mb-2">{community.communityName}</h3>
                      <div className="flex items-center justify-between text-sm text-gray-500">
                        <span className="capitalize">{community.role}</span>
                        <span>
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
  );
}