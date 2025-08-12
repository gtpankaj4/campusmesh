"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import { collection, query, where, orderBy, onSnapshot, doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
// No additional icons needed
import RepBadge from "@/components/RepBadge";
import Navbar from "@/components/Navbar";

interface UserProfile {
  reputation: number;
  postsCount: number;
  commentsCount: number;
  communitiesCount: number;
  joinDate: any;
}

interface UserPost {
  id: string;
  title: string;
  type: string;
  createdAt: any;
}

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [userPosts, setUserPosts] = useState<UserPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'posts' | 'communities'>('overview');
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUser(user);
        await loadUserProfile(user.uid);
        await loadUserPosts(user.uid);
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
        setProfile(userSnap.data() as UserProfile);
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
      
      {/* Mobile Layout */}
      <div className="lg:hidden">

        {/* Mobile Profile Content */}
        <div className="px-4 py-6 pt-8">
          {/* User Info */}
          <div className="bg-white rounded-lg p-6 mb-6">
            <div className="flex items-center space-x-4 mb-4">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-2xl font-bold text-blue-600">
                  {user?.email?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">{user?.email}</h2>
                <p className="text-sm text-gray-500">Member since {profile?.joinDate?.toDate ? 
                  profile.joinDate.toDate().toLocaleDateString() : 'Recently'}</p>
              </div>
            </div>
            
            <div className="flex justify-center mb-4">
              <RepBadge score={profile?.reputation || 0} size="lg" />
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 hover:scale-105 transition-transform duration-200">
                <p className="text-2xl font-bold text-blue-600">{profile?.postsCount || 0}</p>
                <p className="text-sm text-blue-500 font-medium">Posts</p>
              </div>
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 hover:scale-105 transition-transform duration-200">
                <p className="text-2xl font-bold text-green-600">{profile?.commentsCount || 0}</p>
                <p className="text-sm text-green-500 font-medium">Comments</p>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-xl p-4 hover:scale-105 transition-transform duration-200">
                <p className="text-2xl font-bold text-purple-600">{profile?.communitiesCount || 0}</p>
                <p className="text-sm text-purple-500 font-medium">Meshes</p>
              </div>
            </div>
          </div>

          {/* Mobile Tabs */}
          <div className="bg-white rounded-lg mb-6">
            <div className="flex">
              {(['overview', 'posts', 'communities'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-3 px-4 text-sm font-medium border-b-2 ${
                    activeTab === tab
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500'
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          <div className="bg-white rounded-lg p-4">
            {activeTab === 'overview' && (
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-900">Recent Activity</h3>
                {userPosts.slice(0, 3).map((post) => (
                  <div key={post.id} className="border-b border-gray-100 pb-3">
                    <p className="font-medium text-sm text-gray-900">{post.title}</p>
                    <p className="text-xs text-gray-500">{post.type} • {post.createdAt?.toDate ? 
                      post.createdAt.toDate().toLocaleDateString() : 'Recently'}</p>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'posts' && (
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-900">My Posts</h3>
                {userPosts.map((post) => (
                  <div key={post.id} className="border-b border-gray-100 pb-3">
                    <p className="font-medium text-sm text-gray-900">{post.title}</p>
                    <p className="text-xs text-gray-500">{post.type} • {post.createdAt?.toDate ? 
                      post.createdAt.toDate().toLocaleDateString() : 'Recently'}</p>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'communities' && (
              <div className="text-center py-8">
                <p className="text-gray-500">Communities feature coming soon!</p>
              </div>
            )}
          </div>
        </div>

        
      </div>

      {/* Desktop Layout */}
      <div className="hidden lg:block">

        {/* Desktop Content */}
        <div className="max-w-7xl mx-auto px-6 py-8 pt-8">
          <div className="grid grid-cols-12 gap-8">
            {/* Left Sidebar */}
            <div className="col-span-4">
              <div className="bg-white rounded-xl shadow-sm border p-6 sticky top-8">
                <div className="text-center mb-6">
                  <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-4xl font-bold text-blue-600">
                      {user?.email?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">{user?.email}</h2>
                  <p className="text-sm text-gray-500 mb-4">Member since {profile?.joinDate?.toDate ? 
                    profile.joinDate.toDate().toLocaleDateString() : 'Recently'}</p>
                  <RepBadge score={profile?.reputation || 0} size="lg" />
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4 text-center mb-6">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-2xl font-bold text-gray-900">{profile?.postsCount || 0}</p>
                    <p className="text-sm text-gray-500">Posts</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-2xl font-bold text-gray-900">{profile?.commentsCount || 0}</p>
                    <p className="text-sm text-gray-500">Comments</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-2xl font-bold text-gray-900">{profile?.communitiesCount || 0}</p>
                    <p className="text-sm text-gray-500">Communities</p>
                  </div>
                </div>

                {/* Navigation */}
                <div className="space-y-2">
                  {(['overview', 'posts', 'communities'] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`w-full text-left p-3 rounded-lg transition-colors ${
                        activeTab === tab
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <span className="font-medium">{tab.charAt(0).toUpperCase() + tab.slice(1)}</span>
                    </button>
                  ))}

                </div>
              </div>
            </div>

            {/* Main Content */}
            <div className="col-span-8">
              <div className="bg-white rounded-xl shadow-sm border p-6">
                {activeTab === 'overview' && (
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-6">Overview</h2>
                    <div className="space-y-6">
                      <div>
                        <h3 className="font-medium text-gray-900 mb-3">Recent Activity</h3>
                        {userPosts.slice(0, 5).map((post) => (
                          <div key={post.id} className="border-b border-gray-100 pb-3 mb-3">
                            <p className="font-medium text-gray-900">{post.title}</p>
                            <p className="text-sm text-gray-500">{post.type} • {post.createdAt?.toDate ? 
                              post.createdAt.toDate().toLocaleDateString() : 'Recently'}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'posts' && (
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-6">My Posts</h2>
                    <div className="space-y-4">
                      {userPosts.map((post) => (
                        <div key={post.id} className="border border-gray-200 rounded-lg p-4">
                          <p className="font-medium text-gray-900">{post.title}</p>
                          <p className="text-sm text-gray-500">{post.type} • {post.createdAt?.toDate ? 
                            post.createdAt.toDate().toLocaleDateString() : 'Recently'}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeTab === 'communities' && (
                  <div className="text-center py-12">
                    <div className="text-gray-400 mb-4">
                      <svg className="mx-auto h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Communities Coming Soon!</h3>
                    <p className="text-gray-500">Create and join private communities with your classmates.</p>
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