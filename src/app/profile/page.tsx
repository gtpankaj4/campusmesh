"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import { collection, query, where, orderBy, onSnapshot, doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { QuestionMarkCircleIcon, XMarkIcon } from "@heroicons/react/24/outline";
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
  const [showHelp, setShowHelp] = useState(false);
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
        <div className="px-4 py-6 pt-12">
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
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-gray-900">{profile?.postsCount || 0}</p>
                <p className="text-sm text-gray-500">Posts</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{profile?.commentsCount || 0}</p>
                <p className="text-sm text-gray-500">Comments</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{profile?.communitiesCount || 0}</p>
                <p className="text-sm text-gray-500">Communities</p>
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
        <div className="max-w-7xl mx-auto px-6 py-8 pt-16">
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
                  
                  {/* Help Button */}
                  <button
                    onClick={() => setShowHelp(true)}
                    className="w-full text-left p-3 rounded-lg transition-colors text-gray-600 hover:bg-gray-50 flex items-center"
                  >
                    <QuestionMarkCircleIcon className="h-5 w-5 mr-2" />
                    <span className="font-medium">Help</span>
                  </button>
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

      {/* Help Modal */}
      {showHelp && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 rounded-t-xl">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">Welcome to CampusMesh!</h2>
                <button
                  onClick={() => setShowHelp(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">What is CampusMesh?</h3>
                <p className="text-gray-600 mb-4">
                  CampusMesh is a student community platform designed to help you connect with fellow students, 
                  share resources, and organize activities within your university community.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">How Communities & Submesses Work</h3>
                <div className="bg-blue-50 rounded-lg p-4 mb-4">
                  <h4 className="font-semibold text-blue-900 mb-2">Communities</h4>
                  <p className="text-blue-800 text-sm mb-3">
                    Communities are groups like "Nepalese Student Association of ULM" or "CSCI 2000 Fall 2025". 
                    Each community can have multiple submesses (categories) for different types of posts.
                  </p>
                  
                  <h4 className="font-semibold text-blue-900 mb-2">Submesses</h4>
                  <p className="text-blue-800 text-sm">
                    Submesses are categories within communities. For example, the NSA ULM community might have submesses for:
                  </p>
                  <ul className="text-blue-800 text-sm mt-2 ml-4 list-disc">
                    <li><strong>Rides:</strong> Carpooling and transportation</li>
                    <li><strong>Housing:</strong> Roommate searches and housing</li>
                    <li><strong>Books:</strong> Textbook exchanges and study materials</li>
                    <li><strong>Help:</strong> Academic help and questions</li>
                  </ul>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">How to Use CampusMesh</h3>
                <div className="space-y-4">
                  <div className="flex items-start space-x-3">
                    <div className="bg-blue-100 text-blue-600 rounded-full w-6 h-6 flex items-center justify-center text-sm font-semibold flex-shrink-0 mt-0.5">
                      1
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">Join Communities</h4>
                      <p className="text-gray-600 text-sm">
                        Go to the Communities page to find and join communities relevant to your interests, classes, or organizations.
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-3">
                    <div className="bg-blue-100 text-blue-600 rounded-full w-6 h-6 flex items-center justify-center text-sm font-semibold flex-shrink-0 mt-0.5">
                      2
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">Create Posts</h4>
                      <p className="text-gray-600 text-sm">
                        When creating a post, you must select a community and a submess. This helps organize content and makes it easier for others to find relevant posts.
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-3">
                    <div className="bg-blue-100 text-blue-600 rounded-full w-6 h-6 flex items-center justify-center text-sm font-semibold flex-shrink-0 mt-0.5">
                      3
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">Filter and Browse</h4>
                      <p className="text-gray-600 text-sm">
                        Use the filters on the home page to view posts from specific communities or submesses. You can also browse all posts or filter by category.
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-3">
                    <div className="bg-blue-100 text-blue-600 rounded-full w-6 h-6 flex items-center justify-center text-sm font-semibold flex-shrink-0 mt-0.5">
                      4
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">Connect with Others</h4>
                      <p className="text-gray-600 text-sm">
                        Use the chat feature to connect with other students, ask questions, or collaborate on projects.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Building Reputation</h3>
                <p className="text-gray-600 text-sm mb-3">
                  Your reputation score increases when you:
                </p>
                <ul className="text-gray-600 text-sm ml-4 list-disc space-y-1">
                  <li>Create helpful posts (+10 reputation)</li>
                  <li>Post in communities (+5 reputation)</li>
                  <li>Receive positive feedback from other users</li>
                </ul>
                <p className="text-gray-600 text-sm mt-3">
                  Higher reputation gives you access to more features and shows others that you're a trusted community member.
                </p>
              </div>

              <div className="bg-green-50 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-green-900 mb-2">Ready to Get Started?</h3>
                <p className="text-green-800 text-sm mb-3">
                  Start by exploring communities, creating your first post, or connecting with other students through chat!
                </p>
                <button
                  onClick={() => setShowHelp(false)}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  Got it!
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 