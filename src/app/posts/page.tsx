"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, doc, getDoc, where, updateDoc, increment } from "firebase/firestore";
import { storage } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { auth, db } from "@/lib/firebase";
import { PlusIcon, UserIcon, UserGroupIcon, AcademicCapIcon, BookOpenIcon, HeartIcon, PhotoIcon, LockClosedIcon, GlobeAltIcon, XMarkIcon, ChatBubbleLeftIcon, PaperAirplaneIcon, ChevronDownIcon, ChevronUpIcon, TrashIcon, StarIcon } from "@heroicons/react/24/outline";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);
import Community from "@/components/Community";
import RepBadge from "@/components/RepBadge";
import Navbar from "@/components/Navbar";

interface EnrollmentQuestion {
  id: string;
  question: string;
  required: boolean;
  type: 'text' | 'select' | 'checkbox';
  options?: string[];
}

interface Submess {
  id: string;
  name: string;
  description: string;
  color: string;
}

interface CommunityGroup {
  id: string;
  name: string;
  description: string;
  category: 'study' | 'club' | 'class' | 'social';
  creatorId: string;
  creatorUsername: string;
  memberCount: number;
  isPrivate: boolean;
  allowAnonymous: boolean;
  photoURL?: string;
  createdAt: any;
  tags: string[];
  enrollmentQuestions: EnrollmentQuestion[];
  members: string[];
  university: string;
  semester?: string;
  courseCode?: string;
  submesses: Submess[];
}

interface UserCommunity {
  communityId: string;
  communityName: string;
  role: 'member' | 'admin';
  joinedAt: any;
}

export default function CommunitiesPage() {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<{ username?: string; reputation?: number; university?: string } | null>(null);
  const [communities, setCommunities] = useState<CommunityGroup[]>([]);
  const [userCommunities, setUserCommunities] = useState<UserCommunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCommunity, setShowCommunity] = useState(false);
  const [selectedCommunity, setSelectedCommunity] = useState<CommunityGroup | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'my' | 'study' | 'club' | 'class' | 'social'>('all');
  const [showCommunityProfile, setShowCommunityProfile] = useState(false);
  const [communityPosts, setCommunityPosts] = useState<any[]>([]);
  const [showCreatePostModal, setShowCreatePostModal] = useState(false);
  const [showPostModal, setShowPostModal] = useState(false);
  const [selectedPostForModal, setSelectedPostForModal] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'study' as 'study' | 'club' | 'class' | 'social',
    isPrivate: true,
    allowAnonymous: false,
    university: '',
    semester: '',
    courseCode: '',
    tags: '',
    enrollmentQuestions: [] as EnrollmentQuestion[],
    submesses: [] as Submess[]
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewURL, setPreviewURL] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [joiningCommunity, setJoiningCommunity] = useState<string | null>(null);
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

  const loadCommunities = async () => {
    try {
      const communitiesRef = collection(db, 'communities');
      const q = query(communitiesRef, orderBy('createdAt', 'desc'));
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const communityData: CommunityGroup[] = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as CommunityGroup[];
        setCommunities(communityData);
      });

      return unsubscribe;
    } catch (error) {
      console.error('Error loading communities:', error);
    }
  };

  const loadUserCommunities = async (userId: string) => {
    try {
      const userCommunitiesRef = collection(db, 'users', userId, 'communities');
      const q = query(userCommunitiesRef, orderBy('joinedAt', 'desc'));
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const userCommunityData: UserCommunity[] = snapshot.docs.map(doc => ({
          ...doc.data()
        })) as UserCommunity[];
        setUserCommunities(userCommunityData);
      });

      return unsubscribe;
    } catch (error) {
      console.error('Error loading user communities:', error);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUser(user);
        await loadUserProfile(user.uid);
        await loadCommunities();
        await loadUserCommunities(user.uid);
      } else {
        router.push("/login");
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        alert('Image size must be less than 5MB. Please choose a smaller image.');
        event.target.value = ''; // Clear the input
        return;
      }

      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Please select a valid image file (JPG, PNG, GIF, etc.).');
        event.target.value = ''; // Clear the input
        return;
      }

      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviewURL(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadImage = async (file: File): Promise<string> => {
    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      throw new Error('Image size must be less than 5MB');
    }

    // Check file type
    if (!file.type.startsWith('image/')) {
      throw new Error('Please select a valid image file');
    }

    try {
      console.log('Starting image upload...', { fileName: file.name, size: file.size });
      
      // Check if Firebase Storage is available
      if (!storage) {
        throw new Error('Firebase Storage is not configured. Please create the community without an image for now.');
      }
      
      // Create storage reference with better naming
      const timestamp = Date.now();
      const fileName = `${timestamp}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const storageRef = ref(storage, `community-photos/${fileName}`);
      
      // Upload with timeout
      const uploadPromise = uploadBytes(storageRef, file);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Upload timeout - please try again')), 15000); // 15 second timeout
      });
      
      console.log('Uploading to Firebase Storage...');
      const snapshot = await Promise.race([uploadPromise, timeoutPromise]) as any;
      
      console.log('Upload successful, getting download URL...');
      const downloadURL = await getDownloadURL(snapshot.ref);
      
      console.log('Image upload completed:', downloadURL);
      return downloadURL;
    } catch (error: any) {
      console.error('Image upload failed:', error);
      
      // Provide user-friendly error messages
      if (error.code === 'storage/unauthorized' || error.message?.includes('Storage is not configured')) {
        throw new Error('Firebase Storage is not set up. Please create the community without an image for now.');
      } else if (error.code === 'storage/canceled') {
        throw new Error('Upload was canceled');
      } else if (error.code === 'storage/unknown') {
        throw new Error('Network error - please check your connection');
      } else if (error.message?.includes('timeout')) {
        throw new Error('Upload timeout - please try a smaller image or check your connection');
      } else {
        throw new Error(error.message || 'Failed to upload image - please try again');
      }
    }
  };

  const addEnrollmentQuestion = () => {
    const newQuestion: EnrollmentQuestion = {
      id: Date.now().toString(),
      question: '',
      required: true,
      type: 'text'
    };
    setFormData({
      ...formData,
      enrollmentQuestions: [...formData.enrollmentQuestions, newQuestion]
    });
  };

  const updateEnrollmentQuestion = (index: number, field: keyof EnrollmentQuestion, value: any) => {
    const updatedQuestions = [...formData.enrollmentQuestions];
    updatedQuestions[index] = { ...updatedQuestions[index], [field]: value };
    setFormData({ ...formData, enrollmentQuestions: updatedQuestions });
  };

  const removeEnrollmentQuestion = (index: number) => {
    const updatedQuestions = formData.enrollmentQuestions.filter((_, i) => i !== index);
    setFormData({ ...formData, enrollmentQuestions: updatedQuestions });
  };

  const addSubmess = () => {
    const newSubmess: Submess = {
      id: Date.now().toString(),
      name: '',
      description: '',
      color: 'bg-blue-100 text-blue-800'
    };
    setFormData({
      ...formData,
      submesses: [...formData.submesses, newSubmess]
    });
  };

  const updateSubmess = (index: number, field: keyof Submess, value: string) => {
    const updatedSubmesses = [...formData.submesses];
    updatedSubmesses[index] = { ...updatedSubmesses[index], [field]: value };
    setFormData({ ...formData, submesses: updatedSubmesses });
  };

  const removeSubmess = (index: number) => {
    const updatedSubmesses = formData.submesses.filter((_, i) => i !== index);
    setFormData({ ...formData, submesses: updatedSubmesses });
  };

  const handleCreateCommunity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSubmitting(true);
    try {
      let photoURL = '';
      if (selectedFile) {
        setUploadProgress('Uploading image...');
        console.log('📸 Uploading community image...');
        photoURL = await uploadImage(selectedFile);
        console.log('✅ Image uploaded successfully:', photoURL);
        setUploadProgress('Creating community...');
      }

      // Always include "All" submess as the first submess
      const allSubmess = {
        id: "1",
        name: "All",
        description: "General posts for the community",
        color: "bg-gray-100 text-gray-800"
      };
      
      const communityData = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        category: formData.category,
        creatorId: user.uid,
        creatorUsername: userProfile?.username || user.email?.split('@')[0] || 'User',
        memberCount: 1,
        isPrivate: formData.isPrivate,
        allowAnonymous: formData.allowAnonymous,
        photoURL: null,
        university: formData.university.trim(),
        semester: formData.semester.trim(),
        courseCode: formData.courseCode.trim(),
        createdAt: serverTimestamp(),
        tags: formData.tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0),
        enrollmentQuestions: formData.enrollmentQuestions.filter(q => q.question.trim().length > 0),
        submesses: [allSubmess, ...formData.submesses.filter(s => s.name.trim().length > 0)],
        members: [user.uid]
      };

      const communityRef = await addDoc(collection(db, 'communities'), communityData);
      
      // Add user to their own community
      const userCommunityRef = collection(db, 'users', user.uid, 'communities');
      await addDoc(userCommunityRef, {
        communityId: communityRef.id,
        communityName: formData.name.trim(),
        role: 'admin',
        joinedAt: serverTimestamp()
      });
      
      setShowCreateModal(false);
      setFormData({ 
        name: '', 
        description: '', 
        category: 'study', 
        isPrivate: true, 
        allowAnonymous: false,
        university: '',
        semester: '',
        courseCode: '',
        tags: '', 
        enrollmentQuestions: [],
        submesses: []
      });
      setSelectedFile(null);
      setPreviewURL('');
      setUploadProgress('');
      
      console.log('✅ Community created successfully!');
    } catch (error: any) {
      console.error('❌ Error creating community:', error);
      
      // Show user-friendly error message
      let errorMessage = 'Failed to create community. Please try again.';
      if (error.message?.includes('image') || error.message?.includes('upload')) {
        errorMessage = `Image upload failed: ${error.message}`;
      } else if (error.message?.includes('permission') || error.message?.includes('unauthorized')) {
        errorMessage = 'Permission denied. Please refresh the page and try again.';
      } else if (error.message?.includes('network') || error.message?.includes('timeout')) {
        errorMessage = 'Network error. Please check your connection and try again.';
      }
      
      alert(errorMessage);
    } finally {
      setIsSubmitting(false);
      setUploadProgress('');
    }
  };

  const handleJoinCommunity = async (communityId: string, communityName: string) => {
    if (!user) return;
    
    setJoiningCommunity(communityId);
    try {
      // Check if user is already a member
      const isAlreadyMember = userCommunities.some(uc => uc.communityId === communityId);
      if (isAlreadyMember) {
        alert('You are already a member of this community!');
        return;
      }

      // Get community details to check if it allows anonymous joining
      const communityRef = doc(db, 'communities', communityId);
      const communitySnap = await getDoc(communityRef);
      
      if (!communitySnap.exists()) {
        alert('Community not found');
        return;
      }

      const communityData = communitySnap.data();
      
      // If community allows anonymous joining or is public, join directly
      if (communityData.allowAnonymous || !communityData.isPrivate) {
        // Add user to community
        const userCommunityRef = collection(db, 'users', user.uid, 'communities');
        await addDoc(userCommunityRef, {
          communityId: communityId,
          communityName: communityName,
          role: 'member',
          joinedAt: serverTimestamp()
        });

        // Update community member count
        await updateDoc(communityRef, {
          memberCount: increment(1),
          members: increment(1)
        });

        alert('Successfully joined the community!');
      } else {
        // For private communities, send join request to moderator
        try {
          const { createJoinRequestNotification } = await import('@/components/NotificationSystem');
          
          // Get user profile for notification
          const userRef = doc(db, 'users', user.uid);
          const userSnap = await getDoc(userRef);
          const userData = userSnap.exists() ? userSnap.data() : null;
          const userName = userData?.username || user.email?.split('@')[0] || 'Someone';
          
          await createJoinRequestNotification(
            communityData.creatorId,
            user.uid,
            userName,
            communityName
          );
          
          alert('Join request sent to community moderator!');
        } catch (error) {
          console.error('Error sending join request:', error);
          alert('Failed to send join request. Please try again.');
        }
      }
    } catch (error) {
      console.error('Error joining community:', error);
      alert('Failed to join community. Please try again.');
    } finally {
      setJoiningCommunity(null);
    }
  };

  const handleCommunityClick = async (community: CommunityGroup) => {
    setSelectedCommunity(community);
    setShowCommunityProfile(true);
    
    // Load community posts
    try {
      const postsRef = collection(db, 'posts');
      const q = query(
        postsRef,
        where('communityId', '==', community.id),
        orderBy('createdAt', 'desc')
      );
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const posts = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setCommunityPosts(posts);
      });

      return unsubscribe;
    } catch (error) {
      console.error('Error loading community posts:', error);
    }
  };



  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'study':
        return <BookOpenIcon className="h-5 w-5" />;
      case 'club':
        return <HeartIcon className="h-5 w-5" />;
      case 'class':
        return <AcademicCapIcon className="h-5 w-5" />;
      case 'social':
        return <UserGroupIcon className="h-5 w-5" />;
      default:
        return <UserGroupIcon className="h-5 w-5" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'study':
        return 'bg-blue-100 text-blue-800';
      case 'club':
        return 'bg-purple-100 text-purple-800';
      case 'class':
        return 'bg-green-100 text-green-800';
      case 'social':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredCommunities = communities.filter(community => {
    // First filter by tab
    let matchesTab = false;
    if (activeTab === 'my') {
      matchesTab = userCommunities.some(uc => uc.communityId === community.id);
    } else {
      matchesTab = activeTab === 'all' || community.category === activeTab;
    }
    
    // Then filter by search query
    if (!matchesTab) return false;
    
    if (!searchQuery.trim()) return true;
    
    const query = searchQuery.toLowerCase();
    return (
      community.name.toLowerCase().includes(query) ||
      community.description.toLowerCase().includes(query) ||
      community.tags.some(tag => tag.toLowerCase().includes(query)) ||
      community.university?.toLowerCase().includes(query) ||
      community.courseCode?.toLowerCase().includes(query)
    );
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar userProfile={userProfile} />
      
      {/* Mobile Layout */}
      <div className="lg:hidden">

        {/* User's Communities */}
        {userCommunities.length > 0 && (
          <div className="px-4 py-4 pt-12">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">My Communities</h2>
            <div className="flex space-x-3 overflow-x-auto scrollbar-hide">
              {userCommunities.map((userCommunity) => {
                const community = communities.find(c => c.id === userCommunity.communityId);
                if (!community) return null;
                
                return (
                  <div
                    key={userCommunity.communityId}
                    onClick={() => {
                      setSelectedCommunity(community);
                      setShowCommunity(true);
                    }}
                    className="flex-shrink-0 w-20 text-center cursor-pointer"
                  >
                    <div className="w-16 h-16 mx-auto rounded-full overflow-hidden border-2 border-blue-200 mb-2">
                      {community.photoURL ? (
                        <img src={community.photoURL} alt={community.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-blue-100 flex items-center justify-center">
                          <span className="text-lg font-bold text-blue-600">
                            {community.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-gray-600 line-clamp-2">{community.name}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Mobile Content */}
        <div className="px-4 py-6 pt-12">
          {/* Search Field */}
          <div className="mb-6">
            <fieldset className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for communities, classes, or topics..."
                className="w-full px-4 py-3 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-500"
              />
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </fieldset>
          </div>
          
          {/* Header with Category Tabs and Create Button */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex space-x-2 overflow-x-auto scrollbar-hide">
              {(['all', 'my', 'study', 'club', 'class', 'social'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
                    activeTab === tab
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-600 border border-gray-200'
                  }`}
                >
                  {tab === 'my' ? 'My Groups' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2 ml-4 flex-shrink-0"
            >
              <PlusIcon className="h-4 w-4" />
              <span>Create</span>
            </button>
          </div>

          {filteredCommunities.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-4">
                <UserGroupIcon className="mx-auto h-16 w-16" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No communities yet</h3>
              <p className="text-gray-500 mb-6">Create or join communities to connect with other students!</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
              >
                Create Community
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredCommunities.map((community) => (
                <div
                  key={community.id}
                  onClick={() => handleCommunityClick(community)}
                  className="bg-white rounded-lg p-4 border border-gray-200 hover:shadow-md transition-shadow cursor-pointer"
                >
                  <div className="flex items-start space-x-3 mb-3">
                    <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
                      {community.photoURL ? (
                        <img src={community.photoURL} alt={community.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-blue-100 flex items-center justify-center">
                          <span className="text-lg font-bold text-blue-600">
                            {community.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-gray-900">{community.name}</h3>
                          <p className="text-sm text-gray-500">{community.creatorUsername}</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-1 rounded-full text-xs ${getCategoryColor(community.category)}`}>
                            {community.category}
                          </span>
                          {community.isPrivate ? (
                            <LockClosedIcon className="h-4 w-4 text-gray-400" />
                          ) : (
                            <GlobeAltIcon className="h-4 w-4 text-gray-400" />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mb-3 line-clamp-2">{community.description}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-gray-500">{community.memberCount} members</span>
                      {community.university && (
                        <span className="text-xs text-gray-500">• {community.university}</span>
                      )}
                    </div>
                    <div className="flex space-x-2">
                      {community.tags.slice(0, 2).map((tag, index) => (
                        <span key={index} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  
                  {/* Join Button */}
                  <div className="mt-3 flex justify-end">
                    {userCommunities.some(uc => uc.communityId === community.id) ? (
                      <span className="px-3 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                        Member
                      </span>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleJoinCommunity(community.id, community.name);
                        }}
                        disabled={joiningCommunity === community.id}
                        className="px-3 py-1 bg-blue-600 text-white text-xs rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {joiningCommunity === community.id ? 'Joining...' : 'Join'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>


      </div>

      {/* Desktop Layout */}
      <div className="hidden lg:block">

        {/* Desktop Content */}
        <div className="max-w-7xl mx-auto px-6 py-8 pt-16">
          <div className="grid grid-cols-12 gap-8">
            {/* Left Sidebar */}
            <div className="col-span-3">
              <div className="bg-white rounded-xl shadow-sm border p-6 sticky top-8">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">Categories</h2>
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-lg transition-colors"
                    title="Create Community"
                  >
                    <PlusIcon className="h-4 w-4" />
                  </button>
                </div>
                <div className="space-y-2">
                  {(['all', 'my', 'study', 'club', 'class', 'social'] as const).map((tab) => {
                    const count = communities.filter(community => {
                      if (tab === 'my') {
                        return userCommunities.some(uc => uc.communityId === community.id);
                      }
                      return tab === 'all' || community.category === tab;
                    }).length;
                    return (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`w-full flex items-center justify-between p-3 rounded-lg text-left transition-colors ${
                          activeTab === tab
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <span className="font-medium">
                          {tab === 'my' ? 'My Groups' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </span>
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          activeTab === tab
                            ? 'bg-blue-100 text-blue-600'
                            : 'bg-gray-100 text-gray-500'
                        }`}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Main Content */}
            <div className="col-span-9">
              <div className="bg-white rounded-xl shadow-sm border p-6">
                {/* Header with Search and Create Button */}
                <div className="flex items-center space-x-4 mb-6">
                  <fieldset className="relative flex-1">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search for communities, classes, or topics..."
                      className="w-full px-4 py-3 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-500"
                    />
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                  </fieldset>
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center space-x-2 whitespace-nowrap"
                  >
                    <PlusIcon className="h-5 w-5" />
                    <span>Create Community</span>
                  </button>
                </div>
                {filteredCommunities.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-gray-400 mb-4">
                      <UserGroupIcon className="mx-auto h-16 w-16" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No communities yet</h3>
                    <p className="text-gray-500 mb-6">Create or join communities to connect with other students!</p>
                    <button
                      onClick={() => setShowCreateModal(true)}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                    >
                      Create Community
                    </button>
                  </div>
                ) : (
                  <div className="grid gap-6">
                    {filteredCommunities.map((community) => (
                      <div
                        key={community.id}
                        onClick={() => handleCommunityClick(community)}
                        className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow cursor-pointer"
                      >
                        <div className="flex items-start space-x-4 mb-4">
                          <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                            {community.photoURL ? (
                              <img src={community.photoURL} alt={community.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full bg-blue-100 flex items-center justify-center">
                                <span className="text-xl font-bold text-blue-600">
                                  {community.name.charAt(0).toUpperCase()}
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-start justify-between">
                              <div>
                                <h3 className="text-xl font-semibold text-gray-900">{community.name}</h3>
                                <p className="text-sm text-gray-500">Created by {community.creatorUsername}</p>
                              </div>
                              <div className="flex items-center space-x-2">
                                <span className={`px-3 py-1 rounded-full text-sm ${getCategoryColor(community.category)}`}>
                                  {community.category}
                                </span>
                                {community.isPrivate ? (
                                  <LockClosedIcon className="h-5 w-5 text-gray-400" />
                                ) : (
                                  <GlobeAltIcon className="h-5 w-5 text-gray-400" />
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                        <p className="text-gray-600 mb-4">{community.description}</p>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <span className="text-sm text-gray-500">{community.memberCount} members</span>
                            {community.university && (
                              <span className="text-sm text-gray-500">• {community.university}</span>
                            )}
                            {community.courseCode && (
                              <span className="text-sm text-gray-500">• {community.courseCode}</span>
                            )}
                          </div>
                          <div className="flex items-center space-x-2">
                            <div className="flex space-x-2">
                              {community.tags.map((tag, index) => (
                                <span key={index} className="px-3 py-1 bg-gray-100 text-gray-600 text-sm rounded-full">
                                  {tag}
                                </span>
                              ))}
                            </div>
                            
                            {/* Join Button */}
                            {userCommunities.some(uc => uc.communityId === community.id) ? (
                              <span className="px-3 py-1 bg-green-100 text-green-800 text-sm rounded-full">
                                Member
                              </span>
                            ) : (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleJoinCommunity(community.id, community.name);
                                }}
                                disabled={joiningCommunity === community.id}
                                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {joiningCommunity === community.id ? 'Joining...' : 'Join'}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Create Community Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 rounded-t-xl">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">CREATE COMMUNITY</h2>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => {
                      setShowCreateModal(false);
                      setFormData({ 
                        name: '', 
                        description: '', 
                        category: 'study', 
                        isPrivate: true, 
                        allowAnonymous: false,
                        university: '',
                        semester: '',
                        courseCode: '',
                        tags: '', 
                        enrollmentQuestions: [],
                        submesses: []
                      });
                      setSelectedFile(null);
                      setPreviewURL('');
                    }}
                    className="text-gray-500 hover:text-gray-700 text-sm font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateCommunity}
                    disabled={isSubmitting || !formData.name.trim() || !formData.description.trim()}
                    className="text-blue-600 hover:text-blue-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? 'Creating...' : 'Create'}
                  </button>
                </div>
              </div>
            </div>
            
            <div className="p-6">
              <form onSubmit={handleCreateCommunity} className="space-y-6">
                {/* Basic Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Community Name *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                      placeholder="e.g., CSCI 2000 Fall 2025"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Category *
                    </label>
                    <select 
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value as 'study' | 'club' | 'class' | 'social' })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                      required
                    >
                      <option value="study">Study Group</option>
                      <option value="club">Club</option>
                      <option value="class">Class</option>
                      <option value="social">Social</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description *
                  </label>
                  <textarea
                    rows={3}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                    placeholder="Describe your community"
                    required
                  />
                </div>

                {/* Course Information */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      University
                    </label>
                    <input
                      type="text"
                      value={formData.university}
                      onChange={(e) => setFormData({ ...formData, university: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                      placeholder="e.g., ULM"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Course Code
                    </label>
                    <input
                      type="text"
                      value={formData.courseCode}
                      onChange={(e) => setFormData({ ...formData, courseCode: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                      placeholder="e.g., CSCI 2000"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Semester
                    </label>
                    <input
                      type="text"
                      value={formData.semester}
                      onChange={(e) => setFormData({ ...formData, semester: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                      placeholder="e.g., Fall 2025"
                    />
                  </div>
                </div>



                {/* Privacy Settings */}
                <div className="space-y-3">
                  <h3 className="text-lg font-medium text-gray-900">Privacy Settings</h3>
                  <div className="space-y-3">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="private"
                        checked={formData.isPrivate}
                        onChange={(e) => setFormData({ ...formData, isPrivate: e.target.checked })}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor="private" className="ml-2 block text-sm text-gray-700">
                        Private community (invite-only)
                      </label>
                    </div>
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="anonymous"
                        checked={formData.allowAnonymous}
                        onChange={(e) => setFormData({ ...formData, allowAnonymous: e.target.checked })}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor="anonymous" className="ml-2 block text-sm text-gray-700">
                        Allow anonymous posts
                      </label>
                    </div>
                  </div>
                </div>

                {/* Submesses */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium text-gray-900">Submesses (Categories)</h3>
                    <button
                      type="button"
                      onClick={addSubmess}
                      className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                    >
                      + Add Submess
                    </button>
                  </div>
                  <p className="text-sm text-gray-500">Create categories within your community where members can post (e.g., Rides, Housing, Books, Help).</p>
                  
                  {/* Default "All" submess - always included */}
                  <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium text-gray-900">All (Default)</h4>
                      <span className="text-sm text-gray-500">Required</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Name
                        </label>
                        <input
                          type="text"
                          value="All"
                          disabled
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Description
                        </label>
                        <input
                          type="text"
                          value="General posts for the community"
                          disabled
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-500"
                        />
                      </div>
                    </div>
                    <div className="mt-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Color Theme
                      </label>
                      <select
                        value="bg-gray-100 text-gray-800"
                        disabled
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-500"
                      >
                        <option value="bg-gray-100 text-gray-800">Gray</option>
                      </select>
                    </div>
                  </div>
                  
                  {formData.submesses.map((submess, index) => (
                    <div key={submess.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-gray-900">Submess {index + 1}</h4>
                        <button
                          type="button"
                          onClick={() => removeSubmess(index)}
                          className="text-red-600 hover:text-red-700 text-sm"
                        >
                          Remove
                        </button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Name
                          </label>
                          <input
                            type="text"
                            value={submess.name}
                            onChange={(e) => updateSubmess(index, 'name', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                            placeholder="e.g., Rides, Housing, Books"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Description
                          </label>
                          <input
                            type="text"
                            value={submess.description}
                            onChange={(e) => updateSubmess(index, 'description', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                            placeholder="Brief description of this category"
                          />
                        </div>
                      </div>
                      <div className="mt-3">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Color Theme
                        </label>
                        <select
                          value={submess.color}
                          onChange={(e) => updateSubmess(index, 'color', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                        >
                          <option value="bg-blue-100 text-blue-800">Blue</option>
                          <option value="bg-green-100 text-green-800">Green</option>
                          <option value="bg-purple-100 text-purple-800">Purple</option>
                          <option value="bg-orange-100 text-orange-800">Orange</option>
                          <option value="bg-red-100 text-red-800">Red</option>
                          <option value="bg-yellow-100 text-yellow-800">Yellow</option>
                        </select>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Enrollment Questions */}
                {formData.isPrivate && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-medium text-gray-900">Enrollment Questions</h3>
                      <button
                        type="button"
                        onClick={addEnrollmentQuestion}
                        className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                      >
                        + Add Question
                      </button>
                    </div>
                    <p className="text-sm text-gray-500">These questions will be asked when someone wants to join your community.</p>
                    
                    {formData.enrollmentQuestions.map((question, index) => (
                      <div key={question.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-medium text-gray-900">Question {index + 1}</h4>
                          <button
                            type="button"
                            onClick={() => removeEnrollmentQuestion(index)}
                            className="text-red-600 hover:text-red-700 text-sm"
                          >
                            Remove
                          </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Question
                            </label>
                            <input
                              type="text"
                              value={question.question}
                              onChange={(e) => updateEnrollmentQuestion(index, 'question', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                              placeholder="e.g., What's your name?"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Type
                            </label>
                            <select
                              value={question.type}
                              onChange={(e) => updateEnrollmentQuestion(index, 'type', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                            >
                              <option value="text">Text</option>
                              <option value="select">Multiple Choice</option>
                              <option value="checkbox">Checkbox</option>
                            </select>
                          </div>
                        </div>
                        <div className="flex items-center mt-3">
                          <input
                            type="checkbox"
                            id={`required-${index}`}
                            checked={question.required}
                            onChange={(e) => updateEnrollmentQuestion(index, 'required', e.target.checked)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <label htmlFor={`required-${index}`} className="ml-2 block text-sm text-gray-700">
                            Required question
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tags (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={formData.tags}
                    onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                    placeholder="e.g., programming, homework, study"
                  />
                </div>

                {/* Submit Button */}
                <div className="sticky bottom-0 bg-white border-t pt-4 mt-6">
                  <button
                    type="submit"
                    disabled={isSubmitting || !formData.name.trim() || !formData.description.trim()}
                    className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    {isSubmitting ? (
                      <div className="flex items-center justify-center space-x-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>{uploadProgress || 'Creating...'}</span>
                      </div>
                    ) : (
                      'Create Community'
                    )}
                  </button>
                  
                  {selectedFile && isSubmitting && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFile(null);
                        setPreviewURL('');
                        if (fileInputRef.current) {
                          fileInputRef.current.value = '';
                        }
                      }}
                      className="w-full bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600 font-medium mt-2"
                    >
                      Skip Image & Continue
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Community Profile View */}
      {showCommunityProfile && selectedCommunity && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl w-full max-w-6xl h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b">
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                  {selectedCommunity.photoURL ? (
                    <img src={selectedCommunity.photoURL} alt={selectedCommunity.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-blue-100 flex items-center justify-center">
                      <span className="text-2xl font-bold text-blue-600">
                        {selectedCommunity.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{selectedCommunity.name}</h2>
                  <p className="text-sm text-gray-500">Created by {selectedCommunity.creatorUsername}</p>
                  <div className="flex items-center space-x-2 mt-1">
                    <span className={`px-3 py-1 rounded-full text-sm ${getCategoryColor(selectedCommunity.category)}`}>
                      {selectedCommunity.category}
                    </span>
                    {selectedCommunity.isPrivate ? (
                      <LockClosedIcon className="h-4 w-4 text-gray-400" />
                    ) : (
                      <GlobeAltIcon className="h-4 w-4 text-gray-400" />
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setShowCreatePostModal(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2"
                >
                  <PlusIcon className="h-4 w-4" />
                  <span>New Post</span>
                </button>
                <button
                  onClick={() => {
                    setShowCommunityProfile(false);
                    setSelectedCommunity(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Content - Vertical Layout */}
            <div className="flex-1 overflow-y-auto">
              {/* Community Info Section - Top */}
              <div className="p-6 border-b border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* About */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">About</h3>
                    <p className="text-gray-600 text-sm">{selectedCommunity.description}</p>
                    <div className="mt-3 space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Members:</span>
                        <span className="font-medium">{selectedCommunity.memberCount}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Creator:</span>
                        <span className="font-medium">{selectedCommunity.creatorUsername}</span>
                      </div>
                    </div>
                  </div>

                  {/* Course Info */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Course Info</h3>
                    <div className="space-y-2">
                      {selectedCommunity.university && (
                        <div className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                          {selectedCommunity.university}
                        </div>
                      )}
                      {selectedCommunity.courseCode && (
                        <div className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs font-medium">
                          {selectedCommunity.courseCode}
                        </div>
                      )}
                      {selectedCommunity.semester && (
                        <div className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium">
                          {selectedCommunity.semester}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Categories & Tags */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Categories & Tags</h3>
                    {selectedCommunity.submesses && selectedCommunity.submesses.length > 0 && (
                      <div className="mb-4">
                        <div className="space-y-1">
                          {selectedCommunity.submesses.slice(0, 3).map((submess) => (
                            <div key={submess.id} className="flex items-center justify-between text-xs">
                              <span className="font-medium text-gray-900">{submess.name}</span>
                              <span className={`px-2 py-1 rounded-full ${submess.color}`}>
                                {communityPosts.filter(post => post.submessName === submess.name).length}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {selectedCommunity.tags && selectedCommunity.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {selectedCommunity.tags.slice(0, 4).map((tag, index) => (
                          <span key={index} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Posts Section - Bottom */}
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Posts</h3>
                {communityPosts.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-gray-400 mb-4">
                      <svg className="mx-auto h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <p className="text-gray-500 mb-4">No posts yet in this community</p>
                    <button
                      onClick={() => setShowCreatePostModal(true)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Create First Post
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {communityPosts.map((post) => (
                      <div 
                        key={post.id} 
                        className="bg-white border border-gray-200 rounded-lg overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                        onClick={() => {
                          setSelectedPostForModal(post);
                          setShowPostModal(true);
                        }}
                      >
                        <div className="p-4 border-b border-gray-100">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center space-x-2">
                              <span className="font-medium text-gray-900">{post.userEmail?.split('@')[0] || 'Anonymous'}</span>
                              <RepBadge score={0} size="sm" />
                              {post.submessName && (
                                <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                                  {post.submessName}
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-gray-400">
                              {post.createdAt?.toDate ? 
                                post.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) :
                                'Just now'
                              }
                            </span>
                          </div>
                          <h4 className="font-semibold text-gray-900 mb-2">{post.title}</h4>
                          <p className="text-sm text-gray-700 line-clamp-2">{post.description}</p>
                        </div>
                        
                        <div className="px-4 py-3 bg-gray-50 flex items-center justify-between">
                          <PostCommentsButton postId={post.id} onClick={(e) => {
                            e.stopPropagation();
                            setSelectedPostForModal(post);
                            setShowPostModal(true);
                          }} />
                          
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              // Chat functionality
                            }}
                            className="flex items-center px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                          >
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
      )}

      {/* Post Modal */}
      {showPostModal && selectedPostForModal && (
        <PostModal
          post={selectedPostForModal}
          onClose={() => {
            setShowPostModal(false);
            setSelectedPostForModal(null);
          }}
        />
      )}

      {/* Create Post Modal */}
      {showCreatePostModal && selectedCommunity && (
        <Community
          communityId={selectedCommunity.id}
          communityName={selectedCommunity.name}
          onClose={() => {
            setShowCreatePostModal(false);
          }}
        />
      )}

      {/* Community Modal */}
      {showCommunity && selectedCommunity && (
        <Community
          communityId={selectedCommunity.id}
          communityName={selectedCommunity.name}
          onClose={() => {
            setShowCommunity(false);
            setSelectedCommunity(null);
          }}
        />
      )}
    </div>
  );
}

// Component to show real comment counts
function PostCommentsButton({ postId, onClick }: { postId: string; onClick: (e: any) => void }) {
  const [commentCount, setCommentCount] = useState(0);

  useEffect(() => {
    const commentsRef = collection(db, 'posts', postId, 'comments');
    const unsubscribe = onSnapshot(commentsRef, (snapshot) => {
      setCommentCount(snapshot.size);
    });
    return unsubscribe;
  }, [postId]);

  return (
    <button
      onClick={onClick}
      className="flex items-center text-gray-600 hover:text-blue-600 transition-colors text-sm"
    >
      <ChatBubbleLeftIcon className="h-4 w-4 mr-1" />
      Comments ({commentCount})
    </button>
  );
}

// Post Modal Component
interface PostModalProps {
  post: any;
  onClose: () => void;
}

function PostModal({ post, onClose }: PostModalProps) {
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [showCommentInput, setShowCommentInput] = useState(false);

  useEffect(() => {
    // Load comments for this post
    const commentsRef = collection(db, 'posts', post.id, 'comments');
    const q = query(commentsRef, orderBy('timestamp', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const postComments = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setComments(postComments);
    });

    return unsubscribe;
  }, [post.id]);

  const addComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !newComment.trim()) return;

    setLoading(true);
    try {
      const commentsRef = collection(db, 'posts', post.id, 'comments');
      const userRef = doc(db, 'users', auth.currentUser.uid);
      const userSnap = await getDoc(userRef);
      const userData = userSnap.exists() ? userSnap.data() : null;
      
      await addDoc(commentsRef, {
        text: newComment.trim(),
        userId: auth.currentUser.uid,
        userEmail: auth.currentUser.email,
        username: userData?.username || auth.currentUser.email?.split('@')[0] || 'User',
        timestamp: serverTimestamp(),
        userRep: userData?.reputation || 0
      });

      setNewComment("");
      setShowCommentInput(false);
    } catch (error) {
      console.error('Error adding comment:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">Post Details</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Post Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6">
            {/* Post Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-2">
                <span className="font-medium text-gray-900">
                  {post.userEmail?.split('@')[0] || 'Anonymous'}
                </span>
                <RepBadge score={0} size="sm" />
                {post.submessName && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                    {post.submessName}
                  </span>
                )}
              </div>
              <span className="text-sm text-gray-500">
                {post.createdAt?.toDate ? 
                  dayjs(post.createdAt.toDate()).fromNow() :
                  'Just now'
                }
              </span>
            </div>

            {/* Post Title and Content */}
            <h1 className="text-2xl font-bold text-gray-900 mb-4">{post.title}</h1>
            <div className="text-gray-700 whitespace-pre-wrap mb-6">{post.description}</div>

            {/* Post Actions */}
            <div className="flex items-center space-x-4 pb-4 border-b border-gray-200">
              <button
                onClick={() => setShowCommentInput(!showCommentInput)}
                className="flex items-center text-gray-600 hover:text-blue-600 transition-colors"
              >
                <ChatBubbleLeftIcon className="h-4 w-4 mr-1" />
                Comment
              </button>
              <span className="text-gray-500 text-sm">
                {comments.length} {comments.length === 1 ? 'comment' : 'comments'}
              </span>
            </div>

            {/* Comment Input - Facebook Style */}
            {showCommentInput && (
              <form onSubmit={addComment} className="mt-4 mb-6">
                <div className="flex space-x-3">
                  <div className="flex-1">
                    <textarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Write a comment..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                      rows={2}
                      autoFocus
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading || !newComment.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                  >
                    <PaperAirplaneIcon className="h-4 w-4" />
                  </button>
                </div>
              </form>
            )}

            {/* Comments */}
            <div className="space-y-4">
              {comments.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">No comments yet. Be the first to comment!</p>
                </div>
              ) : (
                comments.map((comment) => (
                  <div key={comment.id} className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-sm text-gray-900">{comment.username}</span>
                        <RepBadge score={comment.userRep || 0} size="sm" />
                      </div>
                      <span className="text-xs text-gray-400">
                        {comment.timestamp?.toDate ? 
                          dayjs(comment.timestamp.toDate()).fromNow() :
                          'Just now'
                        }
                      </span>
                    </div>
                    <p className="text-sm text-gray-700">{comment.text}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 