"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, doc, updateDoc, increment, getDoc, where, setDoc, getDocs, deleteDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { PlusIcon, CheckCircleIcon, XCircleIcon, XMarkIcon, UserIcon, ChatBubbleLeftIcon } from "@heroicons/react/24/outline";
import Toast from "@/components/Toast";

import Comment from "@/components/Comment";
import RepBadge from "@/components/RepBadge";
import Navbar from "@/components/Navbar";

interface Post {
  id: string;
  title: string;
  description: string;
  category: string;
  postedBy: string;
  postedAt: string;
  userId?: string;
  userEmail?: string;
  communityId?: string;
  communityName?: string;
  submessId?: string;
  submessName?: string;
}

interface FirestorePost {
  title: string;
  description: string;
  type: string;
  userId: string;
  createdAt: any;
  userEmail?: string;
  communityId?: string;
  communityName?: string;
  submessId?: string;
  submessName?: string;
}

interface UserCommunity {
  communityId: string;
  communityName: string;
  role: 'member' | 'admin';
  joinedAt: any;
}

interface CommunityFilter {
  communityId: string;
  communityName: string;
  selected: boolean;
}

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<{ username?: string; reputation?: number } | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [userCommunities, setUserCommunities] = useState<UserCommunity[]>([]);
  const [communityFilters, setCommunityFilters] = useState<CommunityFilter[]>([]);
  const [showCommunityFilter, setShowCommunityFilter] = useState(false);
  const [communitySubmesses, setCommunitySubmesses] = useState<{[key: string]: any[]}>({});
  const [submessCounts, setSubmessCounts] = useState<{[key: string]: {[key: string]: number}}>({});
  const [activeTab, setActiveTab] = useState<string>('All');
  const [showModal, setShowModal] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [postsUnsubscribe, setPostsUnsubscribe] = useState<(() => void) | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: '',
    communityId: '',
    submessId: ''
  });
  const [toast, setToast] = useState({
    message: '',
    type: 'success' as 'success' | 'error',
    isVisible: false
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCommunityFilter, setSelectedCommunityFilter] = useState<string>('all');
  const router = useRouter();

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

  const loadUserCommunities = async (userId: string) => {
    try {
      const userCommunitiesRef = collection(db, 'users', userId, 'communities');
      const q = query(userCommunitiesRef, orderBy('joinedAt', 'desc'));
      
      const unsubscribe = onSnapshot(q, async (snapshot) => {
        const userCommunityData: UserCommunity[] = snapshot.docs.map(doc => ({
          ...doc.data()
        })) as UserCommunity[];
        setUserCommunities(userCommunityData);
        
        // Initialize community filters
        const filters: CommunityFilter[] = userCommunityData.map(uc => ({
          communityId: uc.communityId,
          communityName: uc.communityName,
          selected: true // Default to showing all communities
        }));
        setCommunityFilters(filters);
        
        // Load submesses for each community
        const submessesData: {[key: string]: any[]} = {};
        const submessCountsData: {[key: string]: {[key: string]: number}} = {};
        
        for (const community of userCommunityData) {
          try {
            const communityRef = doc(db, 'communities', community.communityId);
            const communitySnap = await getDoc(communityRef);
            if (communitySnap.exists()) {
              const communityData = communitySnap.data();
              submessesData[community.communityId] = communityData.submesses || [];
              
              // Calculate submess counts
              const counts: {[key: string]: number} = {};
              const communityPosts = posts.filter(post => post.communityId === community.communityId);
              communityData.submesses?.forEach((submess: any) => {
                counts[submess.name] = communityPosts.filter(post => post.submessName === submess.name).length;
              });
              submessCountsData[community.communityId] = counts;
            }
          } catch (error) {
            console.error('Error loading community submesses:', error);
          }
        }
        setCommunitySubmesses(submessesData);
        setSubmessCounts(submessCountsData);
      });

      return unsubscribe;
    } catch (error) {
      console.error('Error loading user communities:', error);
    }
  };

  const loadPosts = () => {
    console.log('=== LOADING POSTS START ===');
    console.log('Firebase db object:', db);
    
    try {
      const postsRef = collection(db, 'posts');
      console.log('Posts collection reference:', postsRef);
      
      // Try without ordering first to see if that's the issue
      const q = query(postsRef);
      console.log('Query created:', q);

      const unsubscribe = onSnapshot(q, (snapshot) => {
        console.log('=== POSTS SNAPSHOT RECEIVED ===');
        console.log('Snapshot empty:', snapshot.empty);
        console.log('Number of documents:', snapshot.docs.length);
        
        if (snapshot.empty) {
          console.log('No documents found in posts collection');
          setPosts([]);
          return;
        }
        
        const firestorePosts: (FirestorePost & { id: string })[] = snapshot.docs.map(doc => {
          const data = doc.data();
          console.log('Document ID:', doc.id);
          console.log('Document data:', data);
          return {
            id: doc.id,
            ...data
          };
        }) as (FirestorePost & { id: string })[];

        console.log('Firestore posts before sorting:', firestorePosts);

        // Sort manually by createdAt
        firestorePosts.sort((a, b) => {
          const aTime = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
          const bTime = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
          return bTime - aTime; // Descending order
        });

        const convertedPosts: Post[] = firestorePosts.map(post => {
          console.log('Converting post:', post);
          
          // Use the submess name if available, otherwise use the type
          const category = post.submessName || post.type || 'General';
          
          console.log('Original type:', post.type, 'Converted category:', category);
          
          const convertedPost = {
            id: post.id || '',
            title: post.title,
            description: post.description,
            category: category,
            postedBy: post.userEmail?.split('@')[0] || 'Anonymous',
            postedAt: post.createdAt?.toDate ? post.createdAt.toDate().toISOString() : new Date().toISOString(),
            userId: post.userId,
            userEmail: post.userEmail,
            communityId: post.communityId,
            communityName: post.communityName,
            submessId: post.submessId,
            submessName: post.submessName
          };
          
          console.log('Final converted post:', convertedPost);
          return convertedPost;
        });

        console.log('Final converted posts:', convertedPosts);
        setPosts(convertedPosts);
        console.log('=== LOADING POSTS END ===');
      }, (error) => {
        console.error('=== ERROR LOADING POSTS ===');
        console.error('Error details:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
      });

      return unsubscribe;
    } catch (error) {
      console.error('=== ERROR IN LOADPOSTS FUNCTION ===');
      console.error('Error:', error);
      return () => {}; // Return empty function
    }
  };

  const formatTimeAgo = (date: Date): string => {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type, isVisible: true });
  };





  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Form submitted!', e);
    if (!user) {
      console.error('No user found');
      showToast('You must be logged in to create a post', 'error');
      return;
    }

    console.log('Creating post with data:', formData);
    console.log('Current user:', user.uid);

    setIsSubmitting(true);
    try {
      const postData: any = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        type: formData.type,
        userId: user.uid,
        createdAt: serverTimestamp(),
        userEmail: user.email || ''
      };

      // Only add community fields if a community is selected
      if (formData.communityId && formData.communityId.trim() !== '') {
        postData.communityId = formData.communityId;
        const selectedCommunity = userCommunities.find(uc => uc.communityId === formData.communityId);
        if (selectedCommunity) {
          postData.communityName = selectedCommunity.communityName;
        }
        
        // Add submess information if selected
        if (formData.submessId && formData.submessId.trim() !== '') {
          postData.submessId = formData.submessId;
          // We'll need to get the submess name from the community data
          // For now, we'll use the submessId as the name
          postData.submessName = formData.submessId;
        }
      }

      console.log('Post data to be saved:', postData);

      const docRef = await addDoc(collection(db, 'posts'), postData);
      console.log('Post created successfully with ID:', docRef.id);

      // Update user reputation (+10 for creating a post)
      const userRef = doc(db, 'users', user.uid);
      
      // Check if user profile exists, create it if it doesn't
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        // Create user profile if it doesn't exist
        const username = user.email?.split('@')[0] || 'User';
        await setDoc(userRef, {
          email: user.email || '',
          username: username,
          reputation: 10, // Start with 10 since they just created a post
          postsCount: 1,
          commentsCount: 0,
          communitiesCount: 0,
          joinDate: serverTimestamp()
        });
        console.log('Created missing user profile');
      } else {
        // Update existing profile
        await updateDoc(userRef, {
          reputation: increment(10),
          postsCount: increment(1)
        });
      }

      console.log('User reputation updated successfully');

      setShowModal(false);
      setFormData({ title: '', description: '', type: '', communityId: '', submessId: '' });
      showToast(`Post created! +10 reputation gained!`, 'success');
    } catch (error) {
      console.error('Error creating post:', error);
      showToast(`Error creating post: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };



  const toggleCommunityFilter = (communityId: string) => {
    setCommunityFilters(prev => 
      prev.map(filter => 
        filter.communityId === communityId 
          ? { ...filter, selected: !filter.selected }
          : filter
      )
    );
  };

  const selectAllCommunities = () => {
    setCommunityFilters(prev => 
      prev.map(filter => ({ ...filter, selected: true }))
    );
  };

  const clearAllCommunities = () => {
    setCommunityFilters(prev => 
      prev.map(filter => ({ ...filter, selected: false }))
    );
  };

  const deleteAllTestData = async () => {
    if (!user) return;
    
    if (!confirm('This will delete ALL posts and communities. Are you sure?')) {
      return;
    }
    
    try {
      // Delete all posts
      const postsRef = collection(db, 'posts');
      const postsSnapshot = await getDocs(postsRef);
      
      for (const doc of postsSnapshot.docs) {
        await deleteDoc(doc.ref);
      }
      
      // Delete all communities
      const communitiesRef = collection(db, 'communities');
      const communitiesSnapshot = await getDocs(communitiesRef);
      
      for (const doc of communitiesSnapshot.docs) {
        await deleteDoc(doc.ref);
      }
      
      // Delete user's community memberships
      const userCommunitiesRef = collection(db, 'users', user.uid, 'communities');
      const userCommunitiesSnapshot = await getDocs(userCommunitiesRef);
      
      for (const doc of userCommunitiesSnapshot.docs) {
        await deleteDoc(doc.ref);
      }
      
      alert('All test data deleted successfully!');
    } catch (error) {
      console.error('Error deleting test data:', error);
      alert('Error deleting test data. Please try again.');
    }
  };

  const filteredPosts = posts.filter(post => {
    console.log('Filtering post:', post.title, 'Category:', post.category, 'Active tab:', activeTab);
    
    // Filter by search query
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase();
      const matchesSearch = 
        post.title.toLowerCase().includes(query) ||
        post.description.toLowerCase().includes(query) ||
        (post.communityName && post.communityName.toLowerCase().includes(query)) ||
        (post.submessName && post.submessName.toLowerCase().includes(query)) ||
        post.postedBy.toLowerCase().includes(query);
      
      if (!matchesSearch) {
        return false;
      }
    }
    
    // Filter by category/submess
    if (activeTab !== 'All' && post.category !== activeTab) {
      console.log('Post filtered out by category');
      return false;
    }
    
    // Filter by community selection
    if (selectedCommunityFilter !== 'all') {
      if (post.communityId !== selectedCommunityFilter) {
        return false;
      }
    }
    
    // Filter by selected communities (legacy filter)
    if (communityFilters.length > 0) {
      console.log('Community filters active:', communityFilters);
      
      // Check if any community filter is selected
      const hasSelectedFilter = communityFilters.some(filter => filter.selected);
      
      if (!hasSelectedFilter) {
        // No filters selected, show all posts
        console.log('No community filters selected, showing post');
        return true;
      }
      
      if (post.communityId) {
        // Post belongs to a community, check if that community is selected
        const isSelected = communityFilters.some(filter => 
          filter.communityId === post.communityId && filter.selected
        );
        console.log('Post has communityId:', post.communityId, 'Selected:', isSelected);
        return isSelected;
      } else {
        // Post doesn't belong to any community, show it if any filter is selected
        // (this allows general posts to show when communities are being filtered)
        console.log('Post has no communityId, showing it');
        return true;
      }
    }
    
    console.log('No community filters, showing post');
    return true;
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUser(user);
        await loadUserProfile(user.uid);
        await loadUserCommunities(user.uid);
        
        // Set up posts listener
        const unsubscribePosts = loadPosts();
        setPostsUnsubscribe(() => unsubscribePosts);
      } else {
        router.push("/login");
      }
    });

    return () => {
      unsubscribe();
    };
  }, [router]);

  // Reset active tab when communities are filtered
  useEffect(() => {
    const selectedCommunities = communityFilters.filter(filter => filter.selected);
    let availableSubmesses: string[] = [];
    
    if (selectedCommunities.length === 0) {
      availableSubmesses = ['All', ...new Set(posts.map(post => post.category).filter(cat => cat !== 'All'))];
    } else {
      const selectedCommunityIds = selectedCommunities.map(c => c.communityId);
      const submessSet = new Set<string>();
      
      selectedCommunityIds.forEach(communityId => {
        const submesses = communitySubmesses[communityId] || [];
        submesses.forEach((submess: any) => {
          if (submess.name !== 'All') {
            submessSet.add(submess.name);
          }
        });
      });
      
      availableSubmesses = ['All', ...Array.from(submessSet)];
    }
    
    // If current active tab is not available, reset to 'All'
    if (!availableSubmesses.includes(activeTab)) {
      setActiveTab('All');
    }
  }, [communityFilters, communitySubmesses, posts, activeTab]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar userProfile={userProfile} />
      
      {/* Mobile Layout */}
      <div className="lg:hidden">

        {/* Mobile Content */}
        <div className="px-4 py-6 pt-12">
          {/* Search Posts - Mobile */}
          <div className="bg-white rounded-xl shadow-sm border p-4 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Search Posts</h3>
            <fieldset className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search posts, communities, or topics..."
                className="w-full px-4 py-3 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-500"
              />
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </fieldset>
          </div>

          {/* Filter Posts Section */}
          <div className="bg-white rounded-xl shadow-sm border p-4 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Filter Posts</h3>
            </div>
            
            {/* Community Dropdown Filter */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Community
              </label>
              <select
                value={selectedCommunityFilter}
                onChange={(e) => setSelectedCommunityFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
              >
                <option value="all">All Communities (Latest Posts)</option>
                {userCommunities.map((community) => (
                  <option key={community.communityId} value={community.communityId}>
                    {community.communityName}
                  </option>
                ))}
              </select>
            </div>


          </div>

          {/* Category Tabs */}
          <div className="flex space-x-2 mb-6 overflow-x-auto scrollbar-hide">
                          {(() => {
                // Get submesses from selected communities only
                const selectedCommunities = communityFilters.filter(filter => filter.selected);
                let availableSubmesses: string[] = [];
                
                if (selectedCommunities.length === 0) {
                  // No communities selected, show all submesses
                  availableSubmesses = ['All', ...new Set(posts.map(post => post.category).filter(cat => cat !== 'All'))];
                } else {
                  // Get submesses from selected communities only
                  const selectedCommunityIds = selectedCommunities.map(c => c.communityId);
                  const submessSet = new Set<string>();
                  
                  selectedCommunityIds.forEach(communityId => {
                    const submesses = communitySubmesses[communityId] || [];
                    submesses.forEach((submess: any) => {
                      if (submess.name !== 'All') {
                        submessSet.add(submess.name);
                      }
                    });
                  });
                  
                  availableSubmesses = ['All', ...Array.from(submessSet)];
                }
                
                return availableSubmesses.map((tab) => {
                  const postCount = tab === 'All' ? 
                    filteredPosts.length : 
                    filteredPosts.filter(post => post.category === tab).length;
                  
                  return (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap flex items-center space-x-2 ${
                        activeTab === tab
                          ? 'bg-blue-600 text-white'
                          : 'bg-white text-gray-600 border border-gray-200'
                      }`}
                    >
                      <span>{tab}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs ${
                        activeTab === tab
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100 text-gray-500'
                      }`}>
                        {postCount}
                      </span>
                    </button>
                  );
                });
              })()}
          </div>



          {/* Posts */}
          <div className="space-y-4">
            {filteredPosts.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-gray-400 mb-4">
                  <svg className="mx-auto h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-sm text-gray-500 mb-3">
                  {activeTab === 'All' ? 'No posts yet' : `No posts in ${activeTab}`}
                </p>
                <button
                  onClick={() => setShowModal(true)}
                  className="inline-flex items-center px-3 py-2 bg-blue-600 text-white rounded-md text-sm"
                >
                  <PlusIcon className="h-4 w-4 mr-1" />
                  New Post
                </button>
              </div>
            ) : (
              filteredPosts.map((post) => (
                <div 
                  key={post.id} 
                  className="bg-white rounded-lg p-4 border border-gray-200 cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => {
                    setSelectedPost(post);
                    setShowComments(true);
                  }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-gray-900">{post.postedBy}</span>
                      <RepBadge score={0} size="sm" />
                      {post.communityName && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/community/${post.communityId || ''}`);
                          }}
                          className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full hover:bg-blue-200 transition-colors"
                        >
                          {post.communityName}
                        </button>
                      )}
                      {post.submessName && (
                        <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                          {post.submessName}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-400">
                      {formatTimeAgo(new Date(post.postedAt))}
                    </span>
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">{post.title}</h3>
                  <p className="text-sm text-gray-600 mb-4 line-clamp-3">{post.description}</p>
                  <div className="flex space-x-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedPost(post);
                        setShowComments(true);
                      }}
                      className="flex-1 flex items-center justify-center px-3 py-2 bg-gray-100 text-gray-700 rounded-md text-sm hover:bg-gray-200 transition-colors"
                    >
                      <ChatBubbleLeftIcon className="h-4 w-4 mr-1" />
                      Comments (0)
                    </button>
                    <button
                      onClick={() => {
                        // Navigate to chat page with the post author
                        const chatId = [user?.uid, post.userId].sort().join('_');
                        router.push(`/chat/${chatId}`);
                      }}
                      className="flex-1 flex items-center justify-center px-3 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 transition-colors"
                    >
                      <ChatBubbleLeftIcon className="h-4 w-4 mr-1" />
                      Chat
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>


      </div>

      {/* Desktop Layout */}
      <div className="hidden lg:block">

        {/* Desktop Content - Modified Layout */}
        <div className="max-w-7xl mx-auto px-6 py-8 pt-16">
          <div className="grid grid-cols-3 gap-8">
            {/* Left Column - Filter Controls */}
            <div className="space-y-6">
              {/* Filter Posts Section */}
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-semibold text-gray-900">Filter Posts</h3>
                </div>
                
                {/* Community Dropdown Filter */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Community
                  </label>
                  <select
                    value={selectedCommunityFilter}
                    onChange={(e) => setSelectedCommunityFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  >
                    <option value="all">All Communities (Latest Posts)</option>
                    {userCommunities.map((community) => (
                      <option key={community.communityId} value={community.communityId}>
                        {community.communityName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
                <div className="space-y-3">
                  <button
                    onClick={() => router.push('/posts')}
                    className="w-full flex items-center justify-between p-3 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                        <PlusIcon className="h-4 w-4 text-white" />
                      </div>
                      <span className="font-medium text-gray-900">Create Community</span>
                    </div>
                    <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Communities You May Like */}
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Communities You May Like</h2>
                <div className="space-y-3">
                  <div className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium text-gray-900">ULM Computer Science</h3>
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">Study</span>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">Connect with CS students, share resources, and form study groups.</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">127 members</span>
                      <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">Join</button>
                    </div>
                  </div>
                  
                  <div className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium text-gray-900">ULM International Students</h3>
                      <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full">Social</span>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">Connect with fellow international students and share experiences.</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">89 members</span>
                      <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">Join</button>
                    </div>
                  </div>
                  
                  <div className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium text-gray-900">ULM Housing & Roommates</h3>
                      <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">Housing</span>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">Find roommates, housing options, and apartment recommendations.</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">203 members</span>
                      <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">Join</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Middle Column - Posts in 2-column grid */}
            <div className="col-span-2">
              {/* Search Box */}
              <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">Search Posts</h3>
                <fieldset className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search posts, communities, or topics..."
                    className="w-full px-4 py-3 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-500"
                  />
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                </fieldset>
              </div>

              {/* Category Tabs */}
              <div className="bg-white rounded-xl shadow-sm border p-4 mb-6">
                <div className="flex flex-wrap gap-2">
                  {(() => {
                    // Get submesses from selected communities only
                    const selectedCommunities = communityFilters.filter(filter => filter.selected);
                    let availableSubmesses: string[] = [];
                    
                    if (selectedCommunities.length === 0) {
                      // No communities selected, show all submesses
                      availableSubmesses = ['All', ...new Set(posts.map(post => post.category).filter(cat => cat !== 'All'))];
                    } else {
                      // Get submesses from selected communities only
                      const selectedCommunityIds = selectedCommunities.map(c => c.communityId);
                      const submessSet = new Set<string>();
                      
                      selectedCommunityIds.forEach(communityId => {
                        const submesses = communitySubmesses[communityId] || [];
                        submesses.forEach((submess: any) => {
                          if (submess.name !== 'All') {
                            submessSet.add(submess.name);
                          }
                        });
                      });
                      
                      availableSubmesses = ['All', ...Array.from(submessSet)];
                    }
                    
                    return availableSubmesses.map((tab) => {
                      const postCount = tab === 'All' ? 
                        filteredPosts.length : 
                        filteredPosts.filter(post => post.category === tab).length;
                      
                      return (
                        <button
                          key={tab}
                          onClick={() => setActiveTab(tab)}
                          className={`px-3 py-2 rounded-full text-sm font-medium flex items-center space-x-2 ${
                            activeTab === tab
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          <span>{tab}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs ${
                            activeTab === tab
                              ? 'bg-blue-500 text-white'
                              : 'bg-white text-gray-500'
                          }`}>
                            {postCount}
                          </span>
                        </button>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* Posts */}
              <div className="space-y-4">
                {filteredPosts.length === 0 ? (
                  <div className="bg-white rounded-xl shadow-sm border p-8 text-center">
                    <div className="text-gray-400 mb-4">
                      <svg className="mx-auto h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <p className="text-sm text-gray-500 mb-3">No posts in {activeTab}</p>
                    <button
                      onClick={() => setShowModal(true)}
                      className="inline-flex items-center px-3 py-2 bg-blue-600 text-white rounded-md text-sm"
                    >
                      <PlusIcon className="h-4 w-4 mr-1" />
                      New Post
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-6">
                                      {filteredPosts.map((post) => (
                    <div 
                      key={post.id} 
                      className="bg-white rounded-xl shadow-sm border p-6 cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => {
                        setSelectedPost(post);
                        setShowComments(true);
                      }}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          <span className="font-medium text-gray-900">{post.postedBy}</span>
                          <RepBadge score={0} size="sm" />
                          {post.communityName && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/community/${post.communityId || ''}`);
                              }}
                              className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full hover:bg-blue-200 transition-colors"
                            >
                              {post.communityName}
                            </button>
                          )}
                          {post.submessName && (
                            <span className="px-3 py-1 bg-green-100 text-green-800 text-sm rounded-full">
                              {post.submessName}
                            </span>
                          )}
                        </div>
                        <span className="text-sm text-gray-400">
                          {formatTimeAgo(new Date(post.postedAt))}
                        </span>
                      </div>
                      <h3 className="text-xl font-semibold text-gray-900 mb-3">{post.title}</h3>
                      <p className="text-gray-600 mb-4">{post.description}</p>
                        <div className="flex space-x-3">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedPost(post);
                              setShowComments(true);
                            }}
                            className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                          >
                            <ChatBubbleLeftIcon className="h-4 w-4 mr-2" />
                            Comments (0)
                          </button>
                          <button
                            onClick={() => {
                              // Navigate to chat page with the post author
                              const chatId = [user?.uid, post.userId].sort().join('_');
                              router.push(`/chat/${chatId}`);
                            }}
                            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                          >
                            <ChatBubbleLeftIcon className="h-4 w-4 mr-2" />
                            Chat
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Floating Create Post Button - Desktop */}
        <button
          onClick={() => setShowModal(true)}
          className="fixed bottom-8 right-8 w-16 h-16 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center z-30 transition-all duration-200 hover:scale-110 hidden lg:flex"
          style={{ boxShadow: '0 6px 25px rgba(59, 130, 246, 0.4)' }}
        >
          <PlusIcon className="h-7 w-7" />
        </button>
      </div>

      {/* Create Post Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-30">
          <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 rounded-t-xl">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">NEW POST</h2>
                <div className="flex items-center space-x-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setFormData({ title: '', description: '', type: '', communityId: '', submessId: '' });
                    }}
                    className="text-gray-500 hover:text-gray-700 text-sm font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
            
            <div className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              {userCommunities.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Post to Community (Required)
                  </label>
                  <select 
                    value={formData.communityId}
                    onChange={(e) => {
                      setFormData({ 
                        ...formData, 
                        communityId: e.target.value,
                        submessId: '' // Reset submess when community changes
                      });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                    required
                  >
                    <option value="">Select a Community</option>
                    {userCommunities.map((community) => (
                      <option key={community.communityId} value={community.communityId}>
                        {community.communityName}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {formData.communityId && communitySubmesses[formData.communityId] && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Post to Submess (Required)
                  </label>
                  <select 
                    value={formData.submessId}
                    onChange={(e) => setFormData({ ...formData, submessId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                    required
                  >
                    <option value="">Select a Submess</option>
                    {communitySubmesses[formData.communityId].map((submess) => (
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
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  placeholder="Enter post title"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  rows={4}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  placeholder="Enter post description"
                  required
                />
              </div>

              <div className="flex justify-end pt-4">
                <button
                  type="submit"
                  disabled={isSubmitting || !formData.title.trim() || !formData.description.trim()}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSubmitting ? 'Posting...' : 'Post'}
                </button>
              </div>

            </form>
            </div>
          </div>
        </div>
      )}

      {/* Community Filter Modal */}
      {showCommunityFilter && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 rounded-t-xl">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">Filter Communities</h2>
                <button
                  onClick={() => setShowCommunityFilter(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
            </div>
            
            <div className="p-6">
              <div className="mb-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-medium text-gray-900">Select Communities</h3>
                  <div className="flex space-x-2">
                    <button
                      onClick={selectAllCommunities}
                      className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                    >
                      Select All
                    </button>
                    <button
                      onClick={clearAllCommunities}
                      className="text-red-600 hover:text-red-700 text-sm font-medium"
                    >
                      Clear All
                    </button>
                  </div>
                </div>
                <p className="text-sm text-gray-500 mb-4">
                  Choose which communities' posts you want to see on your homepage
                </p>
              </div>

              <div className="space-y-3">
                {communityFilters.map((filter) => (
                  <div key={filter.communityId} className="flex items-center">
                    <input
                      type="checkbox"
                      id={filter.communityId}
                      checked={filter.selected}
                      onChange={() => toggleCommunityFilter(filter.communityId)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor={filter.communityId} className="ml-3 block text-sm text-gray-700">
                      {filter.communityName}
                    </label>
                  </div>
                ))}
              </div>

              <div className="mt-6 pt-4 border-t">
                <button
                  onClick={() => setShowCommunityFilter(false)}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  Apply Filters
                </button>
              </div>
            </div>
          </div>
        </div>
      )}



      {/* Comment Modal */}
      {showComments && selectedPost && selectedPost.userId && (
        <Comment
          postId={selectedPost.id}
          postUserId={selectedPost.userId}
          onClose={() => {
            setShowComments(false);
            setSelectedPost(null);
          }}
        />
      )}

      {/* Toast Notification */}
      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={() => setToast({ ...toast, isVisible: false })}
      />
    </div>
  );
} 