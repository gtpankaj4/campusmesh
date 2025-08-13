"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, doc, updateDoc, increment, getDoc, where, setDoc, getDocs, deleteDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { PlusIcon, CheckCircleIcon, XCircleIcon, XMarkIcon, UserIcon, ChatBubbleLeftIcon, ChevronDownIcon, UserGroupIcon, ArrowLeftIcon } from "@heroicons/react/24/outline";
import Toast from "@/components/Toast";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";

import Comment from "@/components/Comment";
import RepBadge from "@/components/RepBadge";
import Navbar from "@/components/Navbar";
import PostInteractions from "@/components/PostInteractions";

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
  const [isCategoryExpanded, setIsCategoryExpanded] = useState(false);
  const [isClient, setIsClient] = useState(false);
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
  const [meshSearchQuery, setMeshSearchQuery] = useState('');
  const [showMeshDropdown, setShowMeshDropdown] = useState(false);




  const [suggestedCommunities, setSuggestedCommunities] = useState<any[]>([]);
  const [joiningCommunity, setJoiningCommunity] = useState<string | null>(null);
  const router = useRouter();

  // Prevent body scroll when modals are open
  useBodyScrollLock(showCommunityFilter || showComments);

  // Fix hydration issues
  useEffect(() => {
    setIsClient(true);
  }, []);



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

  const isNewUser = (userProfile: any): boolean => {
    if (!userProfile?.joinDate) return false;
    
    const joinDate = userProfile.joinDate.toDate ? userProfile.joinDate.toDate() : new Date(userProfile.joinDate);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    return joinDate > thirtyDaysAgo;
  };

  const loadSuggestedCommunities = async () => {
    if (!user) return;
    
    try {
      // Get all public communities
      const communitiesRef = collection(db, 'communities');
      const q = query(communitiesRef, where('isPrivate', '==', false));
      const snapshot = await getDocs(q);
      
      // Get user's current community IDs
      const userCommunityIds = new Set(userCommunities.map(uc => uc.communityId));
      
      // Filter out communities user is already a member of
      const suggestions = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(community => !userCommunityIds.has(community.id))
        .slice(0, 3); // Show top 3 suggestions
        
      setSuggestedCommunities(suggestions);
    } catch (error) {
      console.error('Error loading suggested communities:', error);
    }
  };

  // Note: Private community post filtering is now handled by Firestore security rules

  const joinCommunity = async (communityId: string, communityName: string) => {
    if (!user || joiningCommunity) return;
    
    setJoiningCommunity(communityId);
    try {
      // Add user to community members
      const communityRef = doc(db, 'communities', communityId);
      const communitySnap = await getDoc(communityRef);
      
      if (communitySnap.exists()) {
        const communityData = communitySnap.data();
        const currentMembers = communityData.members || {};
        currentMembers[user.uid] = true;
        
        await updateDoc(communityRef, {
          members: currentMembers,
          memberCount: increment(1)
        });
        
        // Add community to user's communities
        const userCommunityRef = doc(db, 'users', user.uid, 'communities', communityId);
        await setDoc(userCommunityRef, {
          communityId: communityId,
          communityName: communityName,
          role: 'member',
          joinedAt: serverTimestamp()
        });
        
        showToast(`Successfully joined ${communityName}!`, 'success');
        
        // Refresh suggestions
        setTimeout(() => {
          loadSuggestedCommunities();
        }, 1000);
      }
    } catch (error) {
      console.error('Error joining community:', error);
      showToast('Failed to join mesh. Please try again.', 'error');
    } finally {
      setJoiningCommunity(null);
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

      const unsubscribe = onSnapshot(q, async (snapshot) => {
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
        
        // TEMPORARY: Disable aggressive client-side filtering, rely on Firestore rules
        console.log('🛡️ RELYING ON FIRESTORE RULES FOR SECURITY...');
        console.log('📊 User communities loaded:', userCommunities.length, userCommunities);
        
        // Only apply minimal filtering for new users with no communities
        let filteredPosts = convertedPosts;
        
        if (userProfile && isNewUser(userProfile) && userCommunities.length === 0) {
          console.log('👶 NEW USER: Filtering to show only general posts');
          filteredPosts = convertedPosts.filter(post => !post.communityId);
          console.log(`🔒 NEW USER FILTER: ${convertedPosts.length} posts → ${filteredPosts.length} posts (showing only general posts)`);
        } else {
          console.log('👤 EXISTING USER: Showing all posts (Firestore rules handle security)');
          filteredPosts = convertedPosts;
        }
        
        // For new users with no communities, show engaging public posts
        if (userProfile && isNewUser(userProfile) && userCommunities.length === 0) {
          console.log('New user with no communities detected, showing engaging public posts');
          
          try {
            // Only show general posts and public community posts for new users
            const publicAndGeneralPosts = filteredPosts.filter(post => 
              !post.communityId // Only general posts for new users
            );
            
            if (publicAndGeneralPosts.length === 0) {
              // No posts available for new user
              setPosts([]);
              console.log('No posts available for new user');
            } else {
              // Load comment counts for sorting by engagement
              const postsWithCounts = await Promise.all(publicAndGeneralPosts.map(async (post) => {
                try {
                  const commentsRef = collection(db, 'posts', post.id, 'comments');
                  const commentsSnapshot = await getDocs(commentsRef);
                  return { ...post, commentCount: commentsSnapshot.size };
                } catch (error) {
                  return { ...post, commentCount: 0 };
                }
              }));
              
              // Sort by engagement (comment count) descending, then by recency
              const sortedPosts = postsWithCounts.sort((a, b) => {
                if (b.commentCount !== a.commentCount) {
                  return b.commentCount - a.commentCount;
                }
                const aTime = new Date(a.postedAt).getTime();
                const bTime = new Date(b.postedAt).getTime();
                return bTime - aTime;
              });
              
              console.log('Sorted engaging posts for new user:', sortedPosts.length);
              setPosts(sortedPosts.map(({ commentCount, ...post }) => post));
            }
          } catch (error) {
            console.error('Error loading posts for new user:', error);
            setPosts(filteredPosts);
          }
        } else {
          // Regular user or new user with communities - show filtered posts
          setPosts(filteredPosts);
        }
        
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
    // Use a more stable approach to avoid hydration issues
    try {
      const now = Date.now();
      const diffInSeconds = Math.floor((now - date.getTime()) / 1000);

      if (diffInSeconds < 60) return 'Just now';
      if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
      if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
      return `${Math.floor(diffInSeconds / 86400)}d ago`;
    } catch (error) {
      // Fallback for hydration issues
      return 'Recently';
    }
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
      setMeshSearchQuery('');
      setShowMeshDropdown(false);
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
    
    // For now, let's disable this dangerous operation
    showToast('Data deletion disabled for safety. Contact admin if needed.', 'error');
    return;
    
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
      const userCommunitiesRef = collection(db, 'users', user!.uid, 'communities');
      const userCommunitiesSnapshot = await getDocs(userCommunitiesRef);
      
      for (const doc of userCommunitiesSnapshot.docs) {
        await deleteDoc(doc.ref);
      }
      
      showToast('All test data deleted successfully!', 'success');
    } catch (error) {
      console.error('Error deleting test data:', error);
      showToast('Error deleting test data. Please try again.', 'error');
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
      } else {
        router.push("/login");
      }
    });

    return () => {
      unsubscribe();
    };
  }, [router]);

  // Load posts after user and communities are loaded
  useEffect(() => {
    if (user && userProfile) {
      console.log('🔄 Setting up posts listener with user communities:', userCommunities.length);
      const unsubscribePosts = loadPosts();
      setPostsUnsubscribe(() => unsubscribePosts);
      
      return () => {
        if (unsubscribePosts) {
          unsubscribePosts();
        }
      };
    }
  }, [user, userProfile, userCommunities]); // Add userCommunities as dependency

  // Reset active tab when community filter changes
  useEffect(() => {
    let availableSubmesses: string[] = [];
    
    if (selectedCommunityFilter === 'all') {
      // Show all submesses from all communities
      const allSubmessSet = new Set<string>();
      Object.values(communitySubmesses).forEach((submesses: any[]) => {
        submesses.forEach((submess: any) => {
          if (submess.name && submess.name !== 'All') {
            allSubmessSet.add(submess.name);
          }
        });
      });
      availableSubmesses = ['All', ...Array.from(allSubmessSet)];
    } else {
      // Show only submesses from the selected community
      const submesses = communitySubmesses[selectedCommunityFilter] || [];
      const submessSet = new Set<string>();
      
      submesses.forEach((submess: any) => {
        if (submess.name !== 'All') {
          submessSet.add(submess.name);
        }
      });
      
      availableSubmesses = ['All', ...Array.from(submessSet)];
    }
    
    // If current active tab is not available, reset to 'All'
    if (!availableSubmesses.includes(activeTab)) {
      setActiveTab('All');
    }
  }, [selectedCommunityFilter, communitySubmesses, posts, activeTab]);



  // Load suggested communities when user communities change
  useEffect(() => {
    if (user && userCommunities.length >= 0) {
      loadSuggestedCommunities();
    }
  }, [user, userCommunities]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.mesh-dropdown-container')) {
        setShowMeshDropdown(false);
      }
    };

    if (showMeshDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showMeshDropdown]);



  // Early return for create post page
  if (showModal) {
    return (
      <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
        <Navbar userProfile={userProfile} />
        <div className="flex-1 overflow-y-auto overscroll-contain">
          <div className="max-w-2xl mx-auto px-4 py-6 pt-8 pb-6">
            {/* Header */}
            <div className="mb-8">
              <button
                onClick={() => {
                  setShowModal(false);
                  setFormData({ title: '', description: '', type: '', communityId: '', submessId: '' });
                  setMeshSearchQuery('');
                  setShowMeshDropdown(false);
                }}
                className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
              >
                <ArrowLeftIcon className="h-5 w-5 mr-2" />
                Back
              </button>
              
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <PlusIcon className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Create New Post</h1>
                  <p className="text-gray-600">Share something with your meshes</p>
                </div>
              </div>
            </div>

            {/* Form */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {userCommunities.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Mesh *
                  </label>
                  <div className="relative mesh-dropdown-container">
                    <input
                      type="text"
                      value={meshSearchQuery}
                      onChange={(e) => {
                        setMeshSearchQuery(e.target.value);
                        setShowMeshDropdown(true);
                      }}
                      onFocus={() => setShowMeshDropdown(true)}
                      placeholder="Select a mesh"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                      required={!formData.communityId}
                    />
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                      <ChevronDownIcon className="h-5 w-5 text-gray-400" />
                    </div>
                    
                    {showMeshDropdown && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {userCommunities
                          .filter(community => 
                            community.communityName.toLowerCase().includes(meshSearchQuery.toLowerCase())
                          )
                          .map((community) => (
                            <div
                              key={community.communityId}
                              onClick={() => {
                                setFormData({ 
                                  ...formData, 
                                  communityId: community.communityId,
                                  submessId: ''
                                });
                                setMeshSearchQuery(community.communityName);
                                setShowMeshDropdown(false);
                              }}
                              className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                            >
                              <div className="flex items-center space-x-3">
                                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                                  <span className="text-blue-600 font-bold text-sm">
                                    {community.communityName.charAt(0).toUpperCase()}
                                  </span>
                                </div>
                                <div className="font-medium text-gray-900">{community.communityName}</div>
                              </div>
                            </div>
                          ))}
                        {userCommunities.filter(community => 
                          community.communityName.toLowerCase().includes(meshSearchQuery.toLowerCase())
                        ).length === 0 && (
                          <div className="px-4 py-3 text-gray-500 text-center">
                            No meshes found
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {formData.communityId && communitySubmesses[formData.communityId] && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Submesh *
                  </label>
                  <select 
                    value={formData.submessId}
                    onChange={(e) => setFormData({ ...formData, submessId: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                    required
                  >
                    <option value="">Select Submesh</option>
                    {communitySubmesses[formData.communityId].map((submess) => (
                      <option key={submess.id} value={submess.name}>
                        {submess.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Title *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  placeholder="What's your post about?"
                  required
                  maxLength={120}
                />
                <p className="text-xs text-gray-500 mt-1">{formData.title.length}/120 characters</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description *
                </label>
                <textarea
                  rows={4}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  placeholder="Share your thoughts..."
                  required
                  maxLength={500}
                />
                <p className="text-xs text-gray-500 mt-1">{formData.description.length}/500 characters</p>
              </div>

              <div className="flex space-x-4 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setFormData({ title: '', description: '', type: '', communityId: '', submessId: '' });
                    setMeshSearchQuery('');
                    setShowMeshDropdown(false);
                  }}
                  className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !formData.title.trim() || !formData.description.trim()}
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {isSubmitting ? 'Creating...' : 'Create Post'}
                </button>
              </div>
            </form>
          </div>
        </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar userProfile={userProfile} />
      
      {/* Mobile Layout */}
      <div className="lg:hidden">

        {/* Mobile Content */}
        <div className="px-4 py-6 pt-8">
          {/* Search Posts - Mobile */}
          <div className="bg-white rounded-xl shadow-sm border p-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900">Search Posts</h3>
              <button
                onClick={() => setShowModal(true)}
                className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 flex items-center"
              >
                <PlusIcon className="h-4 w-4" />
              </button>
            </div>
            <fieldset className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search posts, meshes, or topics..."
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
                Select Mesh
              </label>
              <select
                value={selectedCommunityFilter}
                onChange={(e) => setSelectedCommunityFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
              >
                <option value="all">All Meshes (Latest Posts)</option>
                {userCommunities.map((community) => (
                  <option key={community.communityId} value={community.communityId}>
                    {community.communityName}
                  </option>
                ))}
              </select>
            </div>


          </div>

          {/* Expandable Category Section */}
          <div className="mb-6">
            <div className="bg-white border border-gray-200 rounded-lg">
              {/* Header with first line of categories */}
              <div 
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
                onClick={() => setIsCategoryExpanded(!isCategoryExpanded)}
              >
                <div className="flex space-x-2 overflow-x-auto scrollbar-hide flex-1 mr-4">
                  {(() => {
                    // Get submesses based on selected community filter
                    let availableSubmesses: string[] = [];
                    
                    if (selectedCommunityFilter === 'all') {
                      // Show all submesses from all communities
                      const allSubmessSet = new Set<string>();
                      Object.values(communitySubmesses).forEach((submesses: any[]) => {
                        submesses.forEach((submess: any) => {
                          if (submess.name && submess.name !== 'All') {
                            allSubmessSet.add(submess.name);
                          }
                        });
                      });
                      availableSubmesses = ['All', ...Array.from(allSubmessSet)];
                    } else {
                      // Show only submesses from the selected community
                      const submesses = communitySubmesses[selectedCommunityFilter] || [];
                      const submessSet = new Set<string>();
                      
                      submesses.forEach((submess: any) => {
                        if (submess.name !== 'All') {
                          submessSet.add(submess.name);
                        }
                      });
                      
                      availableSubmesses = ['All', ...Array.from(submessSet)];
                    }
                    
                    // Show ALL categories in the header
                    return availableSubmesses.map((tab) => {
                      const postCount = tab === 'All' ? 
                        filteredPosts.length : 
                        filteredPosts.filter(post => post.category === tab).length;
                      
                      return (
                        <button
                          key={tab}
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveTab(tab);
                          }}
                          className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap flex items-center space-x-1.5 ${
                            activeTab === tab
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          <span>{tab}</span>
                          <span className={`px-1.5 py-0.5 rounded-full text-xs ${
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
                <ChevronDownIcon 
                  className={`h-5 w-5 text-gray-400 transition-transform duration-200 ${
                    isCategoryExpanded ? 'rotate-180' : ''
                  }`} 
                />
              </div>
              
              {/* Expanded content */}
              {isCategoryExpanded && (
                <div className="border-t border-gray-200 p-4">
                  <div className="flex flex-wrap gap-2">
                    {(() => {
                      // Get submesses based on selected community filter
                      let availableSubmesses: string[] = [];
                      
                      if (selectedCommunityFilter === 'all') {
                        // Show all submesses from all communities
                        const allSubmessSet = new Set<string>();
                        Object.values(communitySubmesses).forEach((submesses: any[]) => {
                          submesses.forEach((submess: any) => {
                            if (submess.name && submess.name !== 'All') {
                              allSubmessSet.add(submess.name);
                            }
                          });
                        });
                        availableSubmesses = ['All', ...Array.from(allSubmessSet)];
                      } else {
                        // Show only submesses from the selected community
                        const submesses = communitySubmesses[selectedCommunityFilter] || [];
                        const submessSet = new Set<string>();
                        
                        submesses.forEach((submess: any) => {
                          if (submess.name !== 'All') {
                            submessSet.add(submess.name);
                          }
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
                            className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap flex items-center space-x-1.5 ${
                              activeTab === tab
                                ? 'bg-blue-600 text-white'
                                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                            }`}
                          >
                            <span>{tab}</span>
                            <span className={`px-1.5 py-0.5 rounded-full text-xs ${
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
                </div>
              )}
            </div>
          </div>



          {/* Posts */}
          <div>
            {filteredPosts.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-gray-400 mb-4">
                  <svg className="mx-auto h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                {userProfile && isNewUser(userProfile) && userCommunities.length === 0 ? (
                  <div className="space-y-4">
                    <p className="text-sm text-gray-500 mb-3">
                      Welcome! No posts available yet.
                    </p>
                    <p className="text-xs text-gray-400 mb-4">
                      Join some mesh to see posts from meshes, or create your own post!
                    </p>
                    <div className="flex flex-col sm:flex-row gap-2 justify-center">
                      <button
                        onClick={() => router.push('/community')}
                        className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-md text-sm hover:bg-green-700 transition-colors"
                      >
                        <UserGroupIcon className="h-4 w-4 mr-1" />
                        Find Mesh
                      </button>
                      <button
                        onClick={() => router.push('/create-community')}
                        className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 transition-colors"
                      >
                        <PlusIcon className="h-4 w-4 mr-1" />
                        Create Mesh
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
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
                )}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {filteredPosts.map((post, index) => {
                  const shouldTruncate = post.description.length > 150;
                  const displayText = shouldTruncate 
                    ? post.description.substring(0, 150) + '...' 
                    : post.description;
                  
                  // Smart community name truncation
                  const getCommunityDisplay = (communityName: string) => {
                    if (!communityName) return '';
                    if (communityName.length <= 15) return communityName;
                    return communityName.substring(0, 12) + '...';
                  };
                  
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
                            {post.communityName && (
                              <>
                                <span>›</span>
                                <span 
                                  className="px-2 py-0.5 bg-stone-100 text-stone-700 rounded-md text-xs hover:bg-stone-200 cursor-pointer transition-colors"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    router.push(`/community/${post.communityId || ''}`);
                                  }}
                                  title={post.communityName}
                                >
                                  {getCommunityDisplay(post.communityName)}
                                </span>
                              </>
                            )}
                            {post.submessName && (
                              <>
                                <span>›</span>
                                <span className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded-md text-xs font-medium">{post.submessName}</span>
                              </>
                            )}
                          </div>
                          <span className="text-xs text-gray-400">
                            {isClient ? formatTimeAgo(new Date(post.postedAt)) : 'Recently'}
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
                          postUserId={post.userId || ''}
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
              </>
            )}
          </div>
        </div>


      </div>

      {/* Desktop Layout */}
      <div className="hidden lg:block">

        {/* Desktop Content - Modified Layout */}
        <div className="max-w-7xl mx-auto px-6 py-8 pt-8">
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
                    Select Mesh
                  </label>
                  <select
                    value={selectedCommunityFilter}
                    onChange={(e) => setSelectedCommunityFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  >
                    <option value="all">All Meshes (Latest Posts)</option>
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
                      <span className="font-medium text-gray-900">Create Mesh</span>
                    </div>
                    <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Meshes You May Like */}
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Meshes You May Like</h2>
                <div className="space-y-3">
                  {suggestedCommunities.length === 0 ? (
                    <div className="text-center py-6">
                      <p className="text-gray-500 text-sm">No new meshes to suggest right now.</p>
                      <p className="text-gray-400 text-xs mt-1">Check back later for more communities!</p>
                    </div>
                  ) : (
                    suggestedCommunities.map((community) => {
                      const categoryColors: Record<string, string> = {
                        study: 'bg-blue-100 text-blue-800',
                        social: 'bg-purple-100 text-purple-800',
                        club: 'bg-green-100 text-green-800',
                        class: 'bg-yellow-100 text-yellow-800'
                      };
                      
                      return (
                        <div key={community.id} className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="font-medium text-gray-900">{community.name}</h3>
                            <span className={`px-2 py-1 text-xs rounded-full ${categoryColors[community.category] || 'bg-gray-100 text-gray-800'}`}>
                              {community.category?.charAt(0).toUpperCase() + community.category?.slice(1) || 'General'}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mb-2 line-clamp-2">{community.description}</p>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-500">
                              {community.memberCount || 0} members
                            </span>
                            <button
                              onClick={() => joinCommunity(community.id, community.name)}
                              disabled={joiningCommunity === community.id}
                              className="text-blue-600 hover:text-blue-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                            >
                              {joiningCommunity === community.id ? 'Joining...' : 'Join'}
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Middle Column - Posts in 2-column grid */}
            <div className="col-span-2">
              {/* Search Box */}
              <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-semibold text-gray-900">Search Posts</h3>
                  <button
                    onClick={() => setShowModal(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center"
                  >
                    <PlusIcon className="h-4 w-4 mr-2" />
                    <span>Create Post</span>
                  </button>
                </div>
                <fieldset className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search posts, meshes, or topics..."
                    className="w-full px-4 py-3 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-500"
                  />
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                </fieldset>
              </div>

              {/* Expandable Category Section */}
              <div className="mb-6">
                <div className="bg-white border border-gray-200 rounded-lg">
                  {/* Header with first line of categories */}
                  <div 
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
                    onClick={() => setIsCategoryExpanded(!isCategoryExpanded)}
                  >
                    <div className="flex space-x-2 overflow-x-auto scrollbar-hide flex-1 mr-4">
                      {(() => {
                        // Get submesses based on selected community filter
                        let availableSubmesses: string[] = [];
                        
                        if (selectedCommunityFilter === 'all') {
                          // Show all submesses from all communities
                          const allSubmessSet = new Set<string>();
                          Object.values(communitySubmesses).forEach((submesses: any[]) => {
                            submesses.forEach((submess: any) => {
                              if (submess.name && submess.name !== 'All') {
                                allSubmessSet.add(submess.name);
                              }
                            });
                          });
                          availableSubmesses = ['All', ...Array.from(allSubmessSet)];
                        } else {
                          // Show only submesses from the selected community
                          const submesses = communitySubmesses[selectedCommunityFilter] || [];
                          const submessSet = new Set<string>();
                          
                          submesses.forEach((submess: any) => {
                            if (submess.name !== 'All') {
                              submessSet.add(submess.name);
                            }
                          });
                          
                          availableSubmesses = ['All', ...Array.from(submessSet)];
                        }
                        
                        // Show ALL categories in the header for mobile
                        return availableSubmesses.map((tab) => {
                          const postCount = tab === 'All' ? 
                            filteredPosts.length : 
                            filteredPosts.filter(post => post.category === tab).length;
                          
                          return (
                            <button
                              key={tab}
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveTab(tab);
                              }}
                              className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap flex items-center space-x-1 ${
                                activeTab === tab
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                              }`}
                            >
                              <span>{tab}</span>
                              <span className={`px-1 py-0.5 rounded-full text-xs ${
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
                    <ChevronDownIcon 
                      className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${
                        isCategoryExpanded ? 'rotate-180' : ''
                      }`} 
                    />
                  </div>
                  
                  {/* Expanded content */}
                  {isCategoryExpanded && (
                    <div className="border-t border-gray-200 p-4">
                      <div className="flex flex-wrap gap-2">
                        {(() => {
                          // Get submesses based on selected community filter
                          let availableSubmesses: string[] = [];
                          
                          if (selectedCommunityFilter === 'all') {
                            // Show all submesses from all communities
                            const allSubmessSet = new Set<string>();
                            Object.values(communitySubmesses).forEach((submesses: any[]) => {
                              submesses.forEach((submess: any) => {
                                if (submess.name && submess.name !== 'All') {
                                  allSubmessSet.add(submess.name);
                                }
                              });
                            });
                            availableSubmesses = ['All', ...Array.from(allSubmessSet)];
                          } else {
                            // Show only submesses from the selected community
                            const submesses = communitySubmesses[selectedCommunityFilter] || [];
                            const submessSet = new Set<string>();
                            
                            submesses.forEach((submess: any) => {
                              if (submess.name !== 'All') {
                                submessSet.add(submess.name);
                              }
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
                                className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap flex items-center space-x-1.5 ${
                                  activeTab === tab
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                              >
                                <span>{tab}</span>
                                <span className={`px-1.5 py-0.5 rounded-full text-xs ${
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
                  )}
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
                    {userProfile && isNewUser(userProfile) && userCommunities.length === 0 ? (
                      <div className="space-y-4">
                        <p className="text-lg font-medium text-gray-700 mb-2">
                          Welcome to Campesh - Your Campus, Your Mesh!
                        </p>
                        <p className="text-sm text-gray-500 mb-4">
                          No posts available yet. Join some meshes to see posts from meshes, or create your own post to get started!
                        </p>
                        <div className="flex justify-center">
                          <button
                            onClick={() => router.push('/community')}
                            className="inline-flex items-center px-6 py-3 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
                          >
                            <UserGroupIcon className="h-5 w-5 mr-2" />
                            Find Meshes
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <p className="text-sm text-gray-500 mb-3">No posts in {activeTab}</p>
                        <button
                          onClick={() => setShowModal(true)}
                          className="inline-flex items-center px-3 py-2 bg-blue-600 text-white rounded-md text-sm"
                        >
                          <PlusIcon className="h-4 w-4 mr-1" />
                          New Post
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                      {filteredPosts.map((post, index) => {
                      const shouldTruncate = post.description.length > 120;
                      const displayText = shouldTruncate 
                        ? post.description.substring(0, 120) + '...' 
                        : post.description;
                      
                      // Smart community name truncation for mobile
                      const getCommunityDisplay = (communityName: string) => {
                        if (!communityName) return '';
                        if (communityName.length <= 12) return communityName;
                        return communityName.substring(0, 10) + '...';
                      };
                      
                      return (
                        <div 
                          key={post.id} 
                          className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-all duration-200 flex flex-col h-full group"
                        >
                          {/* Header with breadcrumb style */}
                          <div className="p-4 pb-2">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center text-xs text-gray-500 space-x-1 flex-1 min-w-0">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    router.push(`/profile/${post.userId}`);
                                  }}
                                  className="font-medium text-gray-700 hover:text-blue-600 cursor-pointer truncate"
                                >
                                  {post.postedBy}
                                </button>
                                {post.communityName && (
                                  <>
                                    <span className="shrink-0">›</span>
                                    <span 
                                      className="px-2 py-0.5 bg-stone-100 text-stone-700 rounded-md text-xs hover:bg-stone-200 cursor-pointer transition-colors truncate"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        router.push(`/community/${post.communityId || ''}`);
                                      }}
                                      title={post.communityName}
                                    >
                                      {getCommunityDisplay(post.communityName)}
                                    </span>
                                  </>
                                )}
                                {post.submessName && (
                                  <>
                                    <span className="shrink-0">›</span>
                                    <span className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded-md text-xs font-medium truncate">{post.submessName}</span>
                                  </>
                                )}
                              </div>
                              <span className="text-xs text-gray-400 shrink-0 ml-2">
                                {isClient ? formatTimeAgo(new Date(post.postedAt)) : 'Recently'}
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
                              postUserId={post.userId || ''}
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
                  </>
                )}
              </div>
            </div>
          </div>
        </div>


      </div>



      {/* Help Button - Mobile */}




      {/* Community Filter Modal */}
      {showCommunityFilter && (
        <div className="fixed inset-0 bg-white/20 backdrop-blur-sm flex items-center justify-center p-4 z-50">
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