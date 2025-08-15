"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { 
  collection, doc, getDoc, getDocs, updateDoc, deleteDoc, addDoc, 
  serverTimestamp, query, where, orderBy, increment 
} from 'firebase/firestore';
import { 
  TrashIcon, UserMinusIcon, ClockIcon, PlusIcon, XMarkIcon, 
  ShieldExclamationIcon, NoSymbolIcon, ArrowLeftIcon, CogIcon,
  ChatBubbleLeftIcon, UsersIcon, MagnifyingGlassIcon, UserIcon,
  CheckIcon, EyeIcon
} from '@heroicons/react/24/outline';
import Navbar from '@/components/Navbar';
import Toast from '@/components/Toast';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { fixSingleCommunityMemberCount } from '@/lib/memberCountUtils';

interface Community {
  id: string;
  name: string;
  description: string;
  creatorId: string;
  submesses: Submess[];
  members: { [key: string]: any };
  memberCount: number;
}

interface Submess {
  id: string;
  name: string;
  description: string;
  color: string;
}

interface CommunityPost {
  id: string;
  title: string;
  description: string;
  userId: string;
  userEmail: string;
  communityId: string;
  communityName: string;
  createdAt: any;
  submessName?: string;
}

interface CommunityMember {
  id: string;
  userId: string;
  userEmail: string;
  username?: string;
  role: 'member' | 'admin';
  joinedAt: any;
  isBanned?: boolean;
  banReason?: string;
  banExpiresAt?: any;
  timeoutUntil?: any;
}

interface JoinRequest {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  communityId: string;
  communityName: string;
  answers: { question: string; answer: string }[];
  status: 'pending' | 'approved' | 'rejected';
  createdAt: any;
  requestedAt?: any;
  reviewedAt?: any;
  reviewedBy?: string;
}

export default function CommunityModerationPage() {
  const [user] = useAuthState(auth);
  const [community, setCommunity] = useState<Community | null>(null);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [activeTab, setActiveTab] = useState<'posts' | 'members' | 'submeshes' | 'edit' | 'requests' | 'settings'>('posts');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [newSubmesh, setNewSubmesh] = useState({ name: '', description: '', color: '#3B82F6' });
  const [showAddSubmesh, setShowAddSubmesh] = useState(false);
  const [showTimeoutModal, setShowTimeoutModal] = useState(false);
  const [showBanModal, setShowBanModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<CommunityMember | null>(null);
  const [timeoutDuration, setTimeoutDuration] = useState('10');
  const [timeoutUnit, setTimeoutUnit] = useState<'minutes' | 'hours' | 'days'>('minutes');
  const [timeoutReason, setTimeoutReason] = useState('');
  const [banReason, setBanReason] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAnswersModal, setShowAnswersModal] = useState(false);
  const [selectedJoinRequest, setSelectedJoinRequest] = useState<JoinRequest | null>(null);
  const [toast, setToast] = useState({ message: '', type: 'success' as 'success' | 'error', isVisible: false });
  const [fixingMemberCount, setFixingMemberCount] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState({ 
    isVisible: false, 
    countdown: 10,
    timeoutId: null as NodeJS.Timeout | null
  });
  
  // Confirmation dialog states
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    type: 'danger' as 'danger' | 'warning' | 'info',
    confirmText: 'Confirm',
    cancelText: 'Cancel'
  });
  
  // Prevent body scroll when modals are open
  useBodyScrollLock(showTimeoutModal || showBanModal || showAnswersModal || confirmDialog.isOpen);
  
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const communityId = params.communityId as string;

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type, isVisible: true });
  };

  const showConfirmDialog = (
    title: string, 
    message: string, 
    onConfirm: () => void, 
    type: 'danger' | 'warning' | 'info' = 'danger',
    confirmText: string = 'Confirm',
    cancelText: string = 'Cancel'
  ) => {
    setConfirmDialog({
      isOpen: true,
      title,
      message,
      onConfirm,
      type,
      confirmText,
      cancelText
    });
  };

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    loadCommunityData();
  }, [user, communityId]);

  // Cleanup delete confirmation timeout on unmount
  useEffect(() => {
    return () => {
      if (deleteConfirmation.timeoutId) {
        clearInterval(deleteConfirmation.timeoutId);
      }
    };
  }, [deleteConfirmation.timeoutId]);

  // Cleanup delete confirmation timeout on unmount
  useEffect(() => {
    return () => {
      if (deleteConfirmation.timeoutId) {
        clearInterval(deleteConfirmation.timeoutId);
      }
    };
  }, [deleteConfirmation.timeoutId]);

  // Handle URL tab parameter for notification redirects
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'requests') {
      setActiveTab('requests');
    }
  }, [searchParams]);

  const loadCommunityData = async () => {
    try {
      setLoading(true);

      // Load community details
      const communityRef = doc(db, 'communities', communityId);
      const communitySnap = await getDoc(communityRef);
      
      if (!communitySnap.exists()) {
        showToast('Community not found', 'error');
        router.push('/posts');
        return;
      }

      const communityData = { id: communitySnap.id, ...communitySnap.data() } as Community;
      setCommunity(communityData);

      // Check if user is moderator/creator
      if (communityData.creatorId !== user!.uid) {
        // Check if user has admin role
        const userCommunitiesRef = collection(db, 'users', user!.uid, 'communities');
        const userCommunitiesSnap = await getDocs(userCommunitiesRef);
        const userCommunity = userCommunitiesSnap.docs.find(doc => doc.data().communityId === communityId);
        
        if (!userCommunity || userCommunity.data().role !== 'admin') {
          showToast('You do not have permission to moderate this community', 'error');
          router.push('/posts');
          return;
        }
      }

      // Load community posts
      await loadCommunityPosts();
      await loadCommunityMembers(communityData);
      await loadJoinRequests();

    } catch (error) {
      console.error('Error loading community data:', error);
      showToast('Failed to load community data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadCommunityPosts = async () => {
    try {
      const postsRef = collection(db, 'posts');
      const q = query(postsRef, where('communityId', '==', communityId));
      const postsSnap = await getDocs(q);
      
      const communityPosts: CommunityPost[] = postsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as CommunityPost[];

      // Sort manually by createdAt since we can't use orderBy with where on different fields
      communityPosts.sort((a, b) => {
        const aTime = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
        const bTime = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
        return bTime - aTime; // Descending order
      });

      setPosts(communityPosts);
    } catch (error) {
      console.error('Error loading community posts:', error);
    }
  };

  const loadCommunityMembers = async (communityData?: Community) => {
    try {
      const targetCommunity = communityData || community;
      if (!targetCommunity) return;

      // Use consistent member format checking (same as posts.tsx and Community.tsx)
      let memberIds: string[] = [];
      
      // First check the community.members object (our standard format)
      if (targetCommunity.members && typeof targetCommunity.members === 'object' && !Array.isArray(targetCommunity.members)) {
        // members stored as {userId: {joinedAt: ..., role: ...}}
        memberIds = Object.keys(targetCommunity.members);

      } else if (Array.isArray(targetCommunity.members)) {
        // Legacy format: members as array
        memberIds = targetCommunity.members;

      } else {
        // Fallback: search through all users' communities

        const allUsersRef = collection(db, 'users');
        const allUsersSnap = await getDocs(allUsersRef);
        
        const communityMembers: string[] = [];
        for (const userDoc of allUsersSnap.docs) {
          const userCommunitiesRef = collection(db, 'users', userDoc.id, 'communities');
          const userCommunitiesSnap = await getDocs(userCommunitiesRef);
          
          const userCommunity = userCommunitiesSnap.docs.find(doc => doc.data().communityId === communityId);
          if (userCommunity) {
            communityMembers.push(userDoc.id);
          }
        }
        memberIds = communityMembers;

      }

      if (memberIds.length === 0) {
        setMembers([]);
        return;
      }

      const memberPromises = memberIds.map(async (userId) => {
        try {
          // Get user's basic info first
          const userRef = doc(db, 'users', userId);
          const userSnap = await getDoc(userRef);
          const userData = userSnap.exists() ? userSnap.data() : {};

          // Get user's community membership details
          const userCommunitiesRef = collection(db, 'users', userId, 'communities');
          const userCommunitiesSnap = await getDocs(userCommunitiesRef);
          const membershipDoc = userCommunitiesSnap.docs.find(doc => doc.data().communityId === communityId);

          // Determine member's email and username
          let memberEmail = userData.email;
          let memberUsername = userData.username;
          
          // If no email in users collection, try to get from auth
          if (!memberEmail && auth.currentUser && auth.currentUser.uid === userId) {
            memberEmail = auth.currentUser.email;
          }
          
          // Generate fallback username
          if (!memberUsername) {
            if (memberEmail) {
              memberUsername = memberEmail.split('@')[0];
            } else {
              memberUsername = `User-${userId.slice(0, 6)}`;
            }
          }

          const member = {
            id: membershipDoc?.id || userId,
            userId: userId,
            userEmail: memberEmail || 'Unknown',
            username: memberUsername || 'Unknown',
            role: membershipDoc?.data()?.role || (userId === targetCommunity.creatorId ? 'admin' : 'member'),
            joinedAt: membershipDoc?.data()?.joinedAt || 
                     (Array.isArray(targetCommunity.members) ? null : targetCommunity.members?.[userId]?.joinedAt) || 
                     null,
            isBanned: membershipDoc?.data()?.isBanned || false,
            banReason: membershipDoc?.data()?.banReason || '',
            banExpiresAt: membershipDoc?.data()?.banExpiresAt || null,
            timeoutUntil: membershipDoc?.data()?.timeoutUntil || null,
          } as CommunityMember;

          return member;
        } catch (error) {
          console.error(`Error loading member ${userId}:`, error);
          // Return a basic member object even if there's an error
          return {
            id: userId,
            userId: userId,
            userEmail: 'Unknown',
            username: `User-${userId.slice(0, 6)}`,
            role: userId === targetCommunity.creatorId ? 'admin' : 'member',
            joinedAt: null,
            isBanned: false,
            banReason: '',
            banExpiresAt: null,
            timeoutUntil: null,
          } as CommunityMember;
        }
      });

      const memberResults = await Promise.all(memberPromises);
      setMembers(memberResults);
    } catch (error) {
      console.error('Error loading community members:', error);
    }
  };

  const loadJoinRequests = async () => {
    try {
      // Query from the correct subcollection path: communities/{id}/joinRequests
      const joinRequestsRef = collection(db, 'communities', communityId, 'joinRequests');
      const q = query(
        joinRequestsRef, 
        orderBy('requestedAt', 'desc')
      );
      const joinRequestsSnap = await getDocs(q);
      
      const requests: JoinRequest[] = joinRequestsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as JoinRequest[];

      // Sort by creation date, pending first
      requests.sort((a, b) => {
        if (a.status === 'pending' && b.status !== 'pending') return -1;
        if (a.status !== 'pending' && b.status === 'pending') return 1;
        return (b.createdAt?.toDate?.() || new Date()).getTime() - (a.createdAt?.toDate?.() || new Date()).getTime();
      });

      console.log('📋 Loaded', requests.length, 'join requests for community:', communityId);
      setJoinRequests(requests);
    } catch (error) {
      console.error('Error loading join requests:', error);
    }
  };

  const deletePost = async (postId: string) => {
    showConfirmDialog(
      'Delete Post',
      'Are you sure you want to delete this post? This action cannot be undone.',
      async () => {
        setProcessing(postId);
    try {
      await deleteDoc(doc(db, 'posts', postId));
      await loadCommunityPosts();
      showToast('Post deleted successfully', 'success');
        } catch (error) {
          console.error('Error deleting post:', error);
          showToast('Failed to delete post', 'error');
        } finally {
          setProcessing(null);
        }
      }
    );
  };

  const addSubmesh = async () => {
    if (!newSubmesh.name.trim() || !community) return;

    try {
      const updatedSubmesses = [
        ...(community.submesses || []),
        {
          id: Date.now().toString(),
          name: newSubmesh.name.trim(),
          description: newSubmesh.description.trim(),
          color: newSubmesh.color
        }
      ];

      const communityRef = doc(db, 'communities', communityId);
      await updateDoc(communityRef, {
        submesses: updatedSubmesses
      });

      setCommunity({ ...community, submesses: updatedSubmesses });
      setNewSubmesh({ name: '', description: '', color: '#3B82F6' });
      setShowAddSubmesh(false);
      showToast('Submesh added successfully', 'success');
    } catch (error) {
      console.error('Error adding submesh:', error);
      showToast('Failed to add submesh', 'error');
    }
  };

  const removeSubmesh = async (submeshId: string, submeshName: string) => {
    // Prevent deletion of default submeshes
    if (submeshName.toLowerCase() === 'general' || submeshName.toLowerCase() === 'all') {
      showToast('Cannot delete the default submesh', 'error');
      return;
    }

    showConfirmDialog(
      'Remove Submesh',
      'Are you sure you want to remove this submesh? This action cannot be undone.',
      async () => {
    if (!community) return;

    try {
      const updatedSubmesses = community.submesses.filter(s => s.id !== submeshId);

      const communityRef = doc(db, 'communities', communityId);
      await updateDoc(communityRef, {
        submesses: updatedSubmesses
      });

      setCommunity({ ...community, submesses: updatedSubmesses });
      showToast('Submesh removed successfully', 'success');
    } catch (error) {
      console.error('Error removing submesh:', error);
      showToast('Failed to remove submesh', 'error');
        }
      }
    );
  };

  const timeoutMember = async () => {
    if (!selectedMember || !timeoutReason.trim()) return;

    try {
      const duration = parseInt(timeoutDuration);
      let timeoutMs = 0;
      
      switch (timeoutUnit) {
        case 'minutes':
          timeoutMs = duration * 60 * 1000;
          break;
        case 'hours':
          timeoutMs = duration * 60 * 60 * 1000;
          break;
        case 'days':
          timeoutMs = duration * 24 * 60 * 60 * 1000;
          break;
      }

      const timeoutUntil = new Date(Date.now() + timeoutMs);

      // Update user's community membership
      if (selectedMember.id) {
        const memberRef = doc(db, 'users', selectedMember.userId, 'communities', selectedMember.id);
        await updateDoc(memberRef, {
          timeoutUntil: timeoutUntil,
          timeoutReason: timeoutReason.trim()
        });
      }

      // Send notification to user
      const notificationsRef = collection(db, 'users', selectedMember.userId, 'notifications');
      await addDoc(notificationsRef, {
        type: 'system',
        title: 'Community Timeout',
        message: `You have been given a ${duration} ${timeoutUnit} timeout in "${community?.name}" for: ${timeoutReason}`,
        createdAt: serverTimestamp(),
        read: false,
        communityId: communityId,
        communityName: community?.name
      });

      await loadCommunityMembers();
      setShowTimeoutModal(false);
      setSelectedMember(null);
      setTimeoutReason('');
      showToast(`Member timed out for ${duration} ${timeoutUnit}`, 'success');
    } catch (error) {
      console.error('Error timing out member:', error);
      showToast('Failed to timeout member', 'error');
    }
  };

  const banMember = async (member: CommunityMember) => {
    setSelectedMember(member);
    setBanReason('');
    setShowBanModal(true);
  };

  const executeBan = async () => {
    if (!selectedMember || !banReason.trim()) return;

    try {
      // Update user's community membership
      if (selectedMember.id) {
        const memberRef = doc(db, 'users', selectedMember.userId, 'communities', selectedMember.id);
        await updateDoc(memberRef, {
          isBanned: true,
          banReason: banReason.trim(),
          banExpiresAt: null // Permanent ban
        });
      }

      // Send notification to user
      const notificationsRef = collection(db, 'users', selectedMember.userId, 'notifications');
      await addDoc(notificationsRef, {
        type: 'system',
        title: 'Community Ban',
        message: `You have been banned from "${community?.name}" for: ${banReason.trim()}`,
        createdAt: serverTimestamp(),
        read: false,
        communityId: communityId,
        communityName: community?.name
      });

      await loadCommunityMembers();
      setShowBanModal(false);
      setSelectedMember(null);
      setBanReason('');
      showToast('Member banned successfully', 'success');
    } catch (error) {
      console.error('Error banning member:', error);
      showToast('Failed to ban member', 'error');
    }
  };

  const unbanMember = async (member: CommunityMember) => {
    showConfirmDialog(
      'Unban Member',
      `Are you sure you want to unban ${member.username}?`,
      async () => {

    try {
      if (member.id) {
        const memberRef = doc(db, 'users', member.userId, 'communities', member.id);
        await updateDoc(memberRef, {
          isBanned: false,
          banReason: '',
          banExpiresAt: null
        });
      }

      await loadCommunityMembers();
      showToast('Member unbanned successfully', 'success');
    } catch (error) {
      console.error('Error unbanning member:', error);
      showToast('Failed to unban member', 'error');
        }
      },
      'info'
    );
  };

  const removeMember = async (member: CommunityMember) => {
    showConfirmDialog(
      'Remove Member',
      `Are you sure you want to remove ${member.username} from the community?`,
      async () => {

    try {
      // Remove from community members
      if (community) {
        const updatedMembers = { ...community.members };
        delete updatedMembers[member.userId];

        const communityRef = doc(db, 'communities', communityId);
        await updateDoc(communityRef, {
          members: updatedMembers,
          memberCount: increment(-1)
        });
      }

      // Remove community from user's communities
      if (member.id) {
        await deleteDoc(doc(db, 'users', member.userId, 'communities', member.id));
      }

      await loadCommunityData();
      showToast('Member removed successfully', 'success');
    } catch (error) {
      console.error('Error removing member:', error);
      showToast('Failed to remove member', 'error');
        }
      }
    );
  };

  const toggleMemberRole = async (member: CommunityMember) => {
    const newRole = member.role === 'admin' ? 'member' : 'admin';
    const action = newRole === 'admin' ? 'promote' : 'demote';
    
    showConfirmDialog(
      `${action === 'promote' ? 'Promote' : 'Demote'} Member`,
      `Are you sure you want to ${action} ${member.username} ${newRole === 'admin' ? 'to moderator' : 'to member'}?`,
      async () => {

    try {
      if (member.id) {
        const memberRef = doc(db, 'users', member.userId, 'communities', member.id);
        await updateDoc(memberRef, { role: newRole });
        
        showToast(`${member.username} ${action}d successfully`, 'success');
        await loadCommunityMembers();
      }
    } catch (error) {
      console.error(`Error ${action}ing member:`, error);
      showToast(`Failed to ${action} member`, 'error');
        }
      },
      'warning'
    );
  };

  const handleJoinRequestAction = async (requestId: string, action: 'approve' | 'reject') => {
    if (!user || !community) return;

    setProcessing(requestId);
    try {
      const request = joinRequests.find(r => r.id === requestId);
      if (!request) return;

      // Update join request status in the correct subcollection
      const requestRef = doc(db, 'communities', communityId, 'joinRequests', requestId);
      await updateDoc(requestRef, {
        status: action === 'approve' ? 'approved' : 'rejected',
        reviewedAt: serverTimestamp(),
        reviewedBy: user.uid
      });

      if (action === 'approve') {
        // Add user to community
        const userCommunitiesRef = collection(db, 'users', request.userId, 'communities');
        await addDoc(userCommunitiesRef, {
          communityId: communityId,
          communityName: community.name,
          role: 'member',
          joinedAt: serverTimestamp()
        });

        // Update community member count and add to members
        const communityRef = doc(db, 'communities', communityId);
        await updateDoc(communityRef, {
          memberCount: community.memberCount + 1,
          [`members.${request.userId}`]: {
            joinedAt: serverTimestamp(),
            role: 'member'
          }
        });

        showToast('Join request approved successfully!', 'success');
      } else {
        showToast('Join request rejected', 'success');
      }

      // Refresh join requests
      await loadJoinRequests();
      await loadCommunityMembers();
    } catch (error) {
      console.error(`Error ${action}ing request:`, error);
      showToast(`Failed to ${action} request`, 'error');
    } finally {
      setProcessing(null);
    }
  };

  const saveCommunityChanges = async () => {
    if (!community || !user) return;

    setProcessing('save-changes');
    try {
      // Get the updated values from the form
      const nameInput = document.getElementById('community-name') as HTMLInputElement;
      const descriptionInput = document.getElementById('community-description') as HTMLTextAreaElement;
      
      const updatedName = nameInput?.value?.trim();
      const updatedDescription = descriptionInput?.value?.trim();

      // Validate inputs
      if (!updatedName || !updatedDescription) {
        showToast('Please fill in all fields', 'error');
        return;
      }

      // Update community in Firestore
      const communityRef = doc(db, 'communities', communityId);
      await updateDoc(communityRef, {
        name: updatedName,
        description: updatedDescription
      });

      // Update local state
      setCommunity(prev => prev ? {
        ...prev,
        name: updatedName,
        description: updatedDescription
      } : null);

      showToast('Community details updated successfully!', 'success');
    } catch (error) {
      console.error('Error updating community:', error);
      showToast('Failed to update community details', 'error');
    } finally {
      setProcessing(null);
    }
  };

  // Fix member count inconsistencies
  const handleFixMemberCount = async () => {
    setFixingMemberCount(true);
    try {
      const result = await fixSingleCommunityMemberCount(communityId);
      
      if (result.oldCount !== result.newCount) {
        showToast(`Member count fixed: ${result.oldCount} → ${result.newCount}`, 'success');
        // Refresh community data
        await loadCommunityData();
      } else {
        showToast('Member count is already correct', 'success');
      }
    } catch (error) {
      console.error('Error fixing member count:', error);
      showToast('Failed to fix member count', 'error');
    } finally {
      setFixingMemberCount(false);
    }
  };

  // Delete entire community - show confirmation toast
  const handleDeleteCommunity = () => {
    setDeleteConfirmation({ isVisible: true, countdown: 10, timeoutId: null });
    
    // Start countdown
    const startCountdown = () => {
      const timeoutId = setInterval(() => {
        setDeleteConfirmation(prev => {
          if (prev.countdown <= 1) {
            clearInterval(timeoutId);
            return { isVisible: false, countdown: 10, timeoutId: null };
          }
          return { ...prev, countdown: prev.countdown - 1 };
        });
      }, 1000);
      
      setDeleteConfirmation(prev => ({ ...prev, timeoutId }));
    };
    
    startCountdown();
  };

  // Actually delete the community
  const executeDeleteCommunity = async () => {
    // Clear the confirmation toast
    if (deleteConfirmation.timeoutId) {
      clearInterval(deleteConfirmation.timeoutId);
    }
    setDeleteConfirmation({ isVisible: false, countdown: 10, timeoutId: null });
    
    setProcessing('delete-community');
    try {
      // Delete all posts in the community
      const postsQuery = query(collection(db, 'posts'), where('communityId', '==', communityId));
      const postsSnapshot = await getDocs(postsQuery);
      
      const deletePromises = [];
      
      // Delete all posts
      for (const postDoc of postsSnapshot.docs) {
        deletePromises.push(deleteDoc(doc(db, 'posts', postDoc.id)));
      }
      
      // Remove community from all users' communities subcollection
      const allUsersRef = collection(db, 'users');
      const allUsersSnapshot = await getDocs(allUsersRef);
      
      for (const userDoc of allUsersSnapshot.docs) {
        const userCommunitiesRef = collection(db, 'users', userDoc.id, 'communities');
        const userCommunitiesSnapshot = await getDocs(userCommunitiesRef);
        
        for (const userCommunityDoc of userCommunitiesSnapshot.docs) {
          if (userCommunityDoc.data().communityId === communityId) {
            deletePromises.push(deleteDoc(doc(db, 'users', userDoc.id, 'communities', userCommunityDoc.id)));
          }
        }
      }
      
      // Delete join requests
      const joinRequestsQuery = query(collection(db, 'joinRequests'), where('communityId', '==', communityId));
      const joinRequestsSnapshot = await getDocs(joinRequestsQuery);
      
      for (const requestDoc of joinRequestsSnapshot.docs) {
        deletePromises.push(deleteDoc(doc(db, 'joinRequests', requestDoc.id)));
      }
      
      // Execute all deletions
      await Promise.all(deletePromises);
      
      // Finally delete the community itself
      await deleteDoc(doc(db, 'communities', communityId));
      
      showToast('Community deleted successfully', 'success');
      
      // Redirect to communities page after a short delay
      setTimeout(() => {
        router.push('/community');
      }, 2000);
      
    } catch (error) {
      console.error('Error deleting community:', error);
      showToast('Failed to delete community. Please try again.', 'error');
    } finally {
      setProcessing(null);
    }
  };

  // Cancel delete confirmation
  const cancelDeleteCommunity = () => {
    if (deleteConfirmation.timeoutId) {
      clearInterval(deleteConfirmation.timeoutId);
    }
    setDeleteConfirmation({ isVisible: false, countdown: 10, timeoutId: null });
  };

  // Delete entire community - show confirmation toast

  // Filter posts and members based on search query
  const filteredPosts = posts.filter(post => 
    !searchQuery.trim() || 
    post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    post.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    post.userEmail.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredMembers = members.filter(member =>
    !searchQuery.trim() ||
    member.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    member.userEmail.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="pt-8 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (!community) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="pt-8 text-center">
          <p className="text-gray-500">Community not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 pt-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 space-y-4 sm:space-y-0">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.push(`/community/${communityId}`)}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
            >
              <ArrowLeftIcon className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Moderate {community.name}</h1>
              <p className="text-gray-500 text-sm sm:text-base">Manage posts, members, and submeshes</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <CogIcon className="h-5 w-5 text-gray-400" />
            <span className="text-sm text-gray-500 hidden sm:inline">Moderator Panel</span>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search posts and members..."
              className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
            />
            <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg mb-6 overflow-x-auto">
          <button
            onClick={() => setActiveTab('posts')}
            className={`flex-shrink-0 py-2 px-3 sm:px-4 rounded-md text-xs sm:text-sm font-medium transition-colors ${
              activeTab === 'posts'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <ChatBubbleLeftIcon className="h-4 w-4 inline mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Posts </span>({filteredPosts.length})
          </button>
          <button
            onClick={() => setActiveTab('members')}
            className={`flex-shrink-0 py-2 px-3 sm:px-4 rounded-md text-xs sm:text-sm font-medium transition-colors ${
              activeTab === 'members'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <UsersIcon className="h-4 w-4 inline mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Members </span>({filteredMembers.length})
          </button>
          <button
            onClick={() => setActiveTab('submeshes')}
            className={`flex-shrink-0 py-2 px-3 sm:px-4 rounded-md text-xs sm:text-sm font-medium transition-colors ${
              activeTab === 'submeshes'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <CogIcon className="h-4 w-4 inline mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Submeshes </span>({community.submesses?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('requests')}
            className={`flex-shrink-0 py-2 px-3 sm:px-4 rounded-md text-xs sm:text-sm font-medium transition-colors ${
              activeTab === 'requests'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <UserIcon className="h-4 w-4 inline mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Join Requests </span>({joinRequests.filter(r => r.status === 'pending').length})
          </button>
          <button
            onClick={() => setActiveTab('edit')}
            className={`flex-shrink-0 py-2 px-3 sm:px-4 rounded-md text-xs sm:text-sm font-medium transition-colors ${
              activeTab === 'edit'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <CogIcon className="h-4 w-4 inline mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Edit</span>
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex-shrink-0 py-2 px-3 sm:px-4 rounded-md text-xs sm:text-sm font-medium transition-colors ${
              activeTab === 'settings'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <CogIcon className="h-4 w-4 inline mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Settings</span>
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'posts' && (
          <div className="space-y-4">
            {filteredPosts.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                {searchQuery.trim() ? 'No posts match your search' : 'No posts in this community yet'}
              </div>
            ) : (
              filteredPosts.map((post) => (
                <div key={post.id} className="bg-white rounded-lg shadow-sm border p-4">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between space-y-2 sm:space-y-0">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="font-medium text-sm text-gray-900">{post.userEmail}</span>
                        {post.submessName && (
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                            {post.submessName}
                          </span>
                        )}
                        <span className="text-xs text-gray-400">
                          {post.createdAt?.toDate?.()?.toLocaleDateString() || 'Unknown date'}
                        </span>
                      </div>
                      <h3 className="font-semibold text-gray-900 mb-2">{post.title}</h3>
                      <p className="text-gray-700 text-sm line-clamp-3">{post.description}</p>
                    </div>
                    <button
                      onClick={() => deletePost(post.id)}
                      disabled={processing === post.id}
                      className="ml-0 sm:ml-4 p-2 text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50 self-start"
                      title="Delete post"
                    >
                      {processing === post.id ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                      ) : (
                        <TrashIcon className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'members' && (
          <div className="space-y-4">
            {filteredMembers.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                {searchQuery.trim() ? 'No members match your search' : 'No members found'}
              </div>
            ) : (
              filteredMembers.map((member) => (
                <div key={member.userId} className="bg-white rounded-lg shadow-sm border p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-blue-600 font-medium">
                          {member.username?.charAt(0).toUpperCase() || 'U'}
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-medium text-gray-900">{member.username}</span>
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            member.role === 'admin' 
                              ? 'bg-purple-100 text-purple-800' 
                              : 'bg-gray-100 text-gray-600'
                          }`}>
                            {member.role}
                          </span>
                          {member.isBanned && (
                            <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">
                              Banned
                            </span>
                          )}
                          {member.timeoutUntil && new Date(member.timeoutUntil.toDate?.() || member.timeoutUntil) > new Date() && (
                            <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">
                              Timed Out
                            </span>
                          )}
                        </div>
                        <span className="text-sm text-gray-500">{member.userEmail}</span>
                        {member.joinedAt && (
                          <p className="text-xs text-gray-400">
                            Joined {member.joinedAt.toDate?.()?.toLocaleDateString() || 'Unknown'}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Promote/Demote button (not for creator) */}
                      {member.userId !== community?.creatorId && (
                        <button
                          onClick={() => toggleMemberRole(member)}
                          className={`px-2 py-1 text-xs rounded-lg font-medium transition-all duration-200 whitespace-nowrap ${
                            member.role === 'admin' 
                              ? 'bg-orange-100 text-orange-700 hover:bg-orange-200' 
                              : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                          }`}
                          title={member.role === 'admin' ? 'Demote to member' : 'Promote to moderator'}
                        >
                          {member.role === 'admin' ? 'Demote' : 'Promote'}
                        </button>
                      )}
                      
                      {!member.isBanned && (
                        <>
                          <button
                            onClick={() => {
                              setSelectedMember(member);
                              setShowTimeoutModal(true);
                            }}
                            className="p-2 text-yellow-600 hover:bg-yellow-50 rounded-lg"
                            title="Timeout member"
                          >
                            <ClockIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => banMember(member)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                            title="Ban member"
                          >
                            <NoSymbolIcon className="h-4 w-4" />
                          </button>
                        </>
                      )}
                      {member.isBanned && (
                        <button
                          onClick={() => unbanMember(member)}
                          className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-lg hover:bg-green-200"
                        >
                          Unban
                        </button>
                      )}
                      {/* Only allow removing members if not creator */}
                      {member.userId !== community?.creatorId && (
                        <button
                          onClick={() => removeMember(member)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                          title="Remove from community"
                        >
                          <UserMinusIcon className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'submeshes' && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button
                onClick={() => setShowAddSubmesh(!showAddSubmesh)}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <PlusIcon className="h-4 w-4 mr-2" />
                Add Submesh
              </button>
            </div>

            {showAddSubmesh && (
              <div className="bg-white rounded-lg shadow-sm border p-4">
                <h3 className="font-medium text-gray-900 mb-4">Add New Submesh</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                    <input
                      type="text"
                      value={newSubmesh.name}
                      onChange={(e) => setNewSubmesh({ ...newSubmesh, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                      placeholder="Submesh name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <input
                      type="text"
                      value={newSubmesh.description}
                      onChange={(e) => setNewSubmesh({ ...newSubmesh, description: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                      placeholder="Description"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
                    <input
                      type="color"
                      value={newSubmesh.color}
                      onChange={(e) => setNewSubmesh({ ...newSubmesh, color: e.target.value })}
                      className="w-full h-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="flex justify-end space-x-2 mt-4">
                  <button
                    onClick={() => setShowAddSubmesh(false)}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={addSubmesh}
                    disabled={!newSubmesh.name.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    Add Submesh
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(community.submesses || []).map((submesh) => (
                <div key={submesh.id} className="bg-white rounded-lg shadow-sm border p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <div 
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: submesh.color }}
                      />
                      <div>
                        <h3 className="font-medium text-gray-900">{submesh.name}</h3>
                        <p className="text-sm text-gray-500">{submesh.description}</p>
                      </div>
                    </div>
                    {/* Only show delete button for non-default submeshes */}
                    {submesh.name.toLowerCase() !== 'general' && submesh.name.toLowerCase() !== 'all' ? (
                      <button
                        onClick={() => removeSubmesh(submesh.id, submesh.name)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                        title="Delete submesh"
                      >
                        <XMarkIcon className="h-4 w-4" />
                      </button>
                    ) : (
                      <div className="p-1 text-gray-400" title="Default submesh cannot be deleted">
                        <span className="text-xs font-medium">Default</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {(!community.submesses || community.submesses.length === 0) && !showAddSubmesh && (
              <div className="text-center py-8 text-gray-500">
                No submeshes created yet
              </div>
            )}
          </div>
        )}

        {activeTab === 'requests' && (
          <div className="space-y-4">
            {joinRequests.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No join requests found
              </div>
            ) : (
              joinRequests.map((request) => (
                <div key={request.id} className="bg-white rounded-lg shadow-sm border p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between space-y-4 sm:space-y-0">
                    <div className="flex items-start space-x-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <UserIcon className="h-5 w-5 text-blue-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-gray-900 text-sm sm:text-base">{request.userName}</h3>
                        <p className="text-sm text-gray-500 truncate">{request.userEmail}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {(() => {
                            const date = request.createdAt?.toDate?.() || request.requestedAt?.toDate?.();
                            return date ? 
                              `Applied ${new Date(date).toLocaleDateString()} at ${new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` :
                              'Just now';
                          })()}
                        </p>
                        <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full mt-2 ${
                          request.status === 'pending' 
                            ? 'bg-yellow-100 text-yellow-800' 
                            : request.status === 'approved'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => {
                          setSelectedJoinRequest(request);
                          setShowAnswersModal(true);
                        }}
                        className="flex items-center space-x-1 px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 transition-colors"
                        title="View answers"
                      >
                        <EyeIcon className="h-4 w-4" />
                        <span className="hidden sm:inline">See Answers</span>
                      </button>
                      
                      {request.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleJoinRequestAction(request.id, 'approve')}
                            disabled={processing === request.id}
                            className="flex items-center space-x-1 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                            title="Accept request"
                          >
                            <CheckIcon className="h-4 w-4" />
                            <span className="hidden sm:inline">{processing === request.id ? 'Processing...' : 'Accept'}</span>
                          </button>
                          <button
                            onClick={() => handleJoinRequestAction(request.id, 'reject')}
                            disabled={processing === request.id}
                            className="flex items-center space-x-1 px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                            title="Reject request"
                          >
                            <XMarkIcon className="h-4 w-4" />
                            <span className="hidden sm:inline">{processing === request.id ? 'Processing...' : 'Reject'}</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'edit' && (
          <div className="space-y-6">
            {/* Community Details Form */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Edit Community Details</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Community Name</label>
                  <input
                    type="text"
                    defaultValue={community?.name}
                    id="community-name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    defaultValue={community?.description}
                    id="community-description"
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                  />
                </div>
                <div className="flex justify-end">
                  <button 
                    onClick={saveCommunityChanges}
                    disabled={processing === 'save-changes'}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {processing === 'save-changes' ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </div>

            {/* Promote Members to Moderator */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Manage Moderators</h3>
              <div className="space-y-4">
                {members.filter(m => m.role === 'member').map((member) => (
                  <div key={member.userId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-blue-600 font-medium text-sm">
                          {member.username?.charAt(0).toUpperCase() || 'U'}
                        </span>
                      </div>
                      <span className="font-medium text-gray-900">{member.username}</span>
                    </div>
                    <button
                      onClick={async () => {
                        showConfirmDialog(
                          'Promote to Moderator',
                          `Make ${member.username} a moderator?`,
                          async () => {
                            try {
                              if (member.id) {
                                const memberRef = doc(db, 'users', member.userId, 'communities', member.id);
                                await updateDoc(memberRef, { role: 'admin' });
                                await loadCommunityMembers();
                                showToast(`${member.username} is now a moderator`, 'success');
                              }
                            } catch (error) {
                              showToast('Failed to promote member', 'error');
                            }
                          },
                          'info'
                        );
                      }}
                      className="px-3 py-1.5 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700"
                    >
                      Make Moderator
                    </button>
                  </div>
                ))}
                {members.filter(m => m.role === 'member').length === 0 && (
                  <p className="text-gray-500 text-center py-4">No members available to promote</p>
                )}
              </div>
            </div>

            {/* Current Moderators */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Current Moderators</h3>
              <div className="space-y-4">
                {members.filter(m => m.role === 'admin' || community?.creatorId === m.userId).map((member) => (
                  <div key={member.userId} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                        <span className="text-green-600 font-medium text-sm">
                          {member.username?.charAt(0).toUpperCase() || 'U'}
                        </span>
                      </div>
                      <div>
                        <span className="font-medium text-gray-900">{member.username}</span>
                        {community?.creatorId === member.userId && (
                          <span className="ml-2 px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">
                            Creator
                          </span>
                        )}
                      </div>
                    </div>
                    {community?.creatorId !== member.userId && (
                      <button
                        onClick={async () => {
                          showConfirmDialog(
                            'Remove Moderator',
                            `Remove ${member.username} as moderator?`,
                            async () => {
                              try {
                                if (member.id) {
                                  const memberRef = doc(db, 'users', member.userId, 'communities', member.id);
                                  await updateDoc(memberRef, { role: 'member' });
                                  await loadCommunityMembers();
                                  showToast(`${member.username} is no longer a moderator`, 'success');
                                }
                              } catch (error) {
                                showToast('Failed to demote moderator', 'error');
                              }
                            },
                            'warning'
                          );
                        }}
                        className="px-3 py-1.5 bg-red-100 text-red-700 text-sm rounded-lg hover:bg-red-200"
                      >
                        Remove Moderator
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-6">
            {/* Community Health */}
            <div className="bg-white rounded-lg shadow-sm border p-4 sm:p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Community Health</h3>
              <div className="space-y-4">
                {/* Member Count Fix */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-blue-50 rounded-lg space-y-3 sm:space-y-0">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">Member Count</h4>
                    <p className="text-sm text-gray-600 mt-1">
                      Current count: <span className="font-medium">{community.memberCount}</span> members
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Fix any inconsistencies between displayed member count and actual members
                    </p>
                  </div>
                  <button
                    onClick={handleFixMemberCount}
                    disabled={fixingMemberCount}
                    className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 text-sm font-medium"
                  >
                    {fixingMemberCount ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Fixing...</span>
                      </>
                    ) : (
                      <span>Fix Member Count</span>
                    )}
                  </button>
                </div>
                
                <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded-lg">
                  <p className="font-medium mb-1">What this does:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Counts actual members in the community</li>
                    <li>Updates the member count to match the real number</li>
                    <li>Fixes negative member counts caused by sync issues</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Danger Zone */}
            <div className="bg-white rounded-lg shadow-sm border border-red-200 p-4 sm:p-6">
              <h3 className="text-lg font-medium text-red-900 mb-4 flex items-center">
                <ShieldExclamationIcon className="h-5 w-5 mr-2" />
                Danger Zone
              </h3>
              <div className="space-y-4">
                {/* Delete Community */}
                <div className="relative flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-red-50 rounded-lg space-y-3 sm:space-y-0 border border-red-200">
                  <div className="flex-1">
                    <h4 className="font-medium text-red-900">Delete Community</h4>
                    <p className="text-sm text-red-700 mt-1">
                      Permanently delete this mesh and all its content
                    </p>
                    <p className="text-xs text-red-600 mt-1">
                      This action cannot be undone. All posts, members, and data will be lost forever.
                    </p>
                  </div>
                  <div className="relative">
                    <button
                      onClick={handleDeleteCommunity}
                      disabled={processing === 'delete-community'}
                      className="w-full sm:w-auto px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 text-sm font-medium"
                    >
                      {processing === 'delete-community' ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          <span>Deleting...</span>
                        </>
                      ) : (
                        <>
                          <TrashIcon className="h-4 w-4" />
                          <span>Delete Mesh</span>
                        </>
                      )}
                    </button>

                    {/* Delete Confirmation Toast - Positioned above button */}
                    {deleteConfirmation.isVisible && (
                      <div className="absolute bottom-full mb-2 right-0 sm:bottom-full sm:right-0 sm:mb-2 z-50 w-72 sm:w-80 max-w-xs sm:max-w-sm transform sm:-translate-x-16">
                        <div className="bg-red-600 text-white rounded-lg shadow-lg p-4 border-l-4 border-red-800 animate-in slide-in-from-top-2 duration-300">
                          <div className="flex items-start space-x-3">
                            <div className="flex-shrink-0">
                              <ShieldExclamationIcon className="h-6 w-6 text-red-200" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm font-bold text-white mb-1">
                                🚨 Delete "{community?.name}"?
                              </h4>
                              <p className="text-xs text-red-100 mb-3">
                                This will permanently delete all posts, members, and data. This action cannot be undone!
                              </p>
                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
                                <div className="flex space-x-2">
                                  <button
                                    onClick={executeDeleteCommunity}
                                    className="px-3 py-1.5 bg-red-800 hover:bg-red-900 text-white text-xs font-medium rounded transition-colors"
                                  >
                                    DELETE FOREVER
                                  </button>
                                  <button
                                    onClick={cancelDeleteCommunity}
                                    className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-medium rounded transition-colors"
                                  >
                                    Cancel
                                  </button>
                                </div>
                                <div className="text-xs text-red-200 font-mono self-end sm:self-auto">
                                  {deleteConfirmation.countdown}s
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="text-xs text-red-600 bg-red-50 p-3 rounded-lg border border-red-200">
                  <p className="font-medium mb-1">⚠️ Warning:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>All posts and comments will be permanently deleted</li>
                    <li>All member data and relationships will be removed</li>
                    <li>Community will be removed from all user profiles</li>
                    <li>This action is irreversible</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Timeout Modal */}
      {showTimeoutModal && selectedMember && (
        <div className="fixed inset-0 bg-white/20 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Timeout {selectedMember.username}
            </h3>
            
            <div className="space-y-4">
              <div className="flex space-x-2">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Duration</label>
                  <input
                    type="number"
                    min="1"
                    value={timeoutDuration}
                    onChange={(e) => setTimeoutDuration(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                  <select
                    value={timeoutUnit}
                    onChange={(e) => setTimeoutUnit(e.target.value as 'minutes' | 'hours' | 'days')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                  >
                    <option value="minutes">Minutes</option>
                    <option value="hours">Hours</option>
                    <option value="days">Days</option>
                  </select>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                <textarea
                  value={timeoutReason}
                  onChange={(e) => setTimeoutReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                  rows={3}
                  placeholder="Reason for timeout..."
                  required
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={() => {
                  setShowTimeoutModal(false);
                  setSelectedMember(null);
                  setTimeoutReason('');
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={timeoutMember}
                disabled={!timeoutReason.trim()}
                className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50"
              >
                Apply Timeout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ban Modal */}
      {showBanModal && selectedMember && (
        <div className="fixed inset-0 bg-white/20 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Ban {selectedMember.username}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ban Reason</label>
                <textarea
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 text-gray-900"
                  rows={3}
                  placeholder="Enter reason for banning this member..."
                  required
                />
              </div>
              
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-800">
                  <strong>Warning:</strong> This will permanently ban {selectedMember.username} from the community. 
                  They will not be able to access posts or participate until unbanned.
                </p>
              </div>
            </div>

            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={() => {
                  setShowBanModal(false);
                  setSelectedMember(null);
                  setBanReason('');
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={executeBan}
                disabled={!banReason.trim()}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                Ban Member
              </button>
            </div>
          </div>
        </div>
      )}

      {/* See Answers Modal - Mobile Optimized */}
      {showAnswersModal && selectedJoinRequest && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm">
          {/* Full screen on mobile, centered on desktop */}
          <div className="h-full overflow-y-auto">
            <div className="min-h-full flex items-start justify-center p-0 sm:p-4 sm:items-center">
              <div 
                className="bg-white w-full max-w-2xl min-h-screen sm:min-h-0 sm:max-h-[90vh] sm:rounded-2xl shadow-2xl flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b bg-white sm:rounded-t-2xl">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-gray-900">
                      Join Request from {selectedJoinRequest.userName}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {selectedJoinRequest.userEmail}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setShowAnswersModal(false);
                      setSelectedJoinRequest(null);
                    }}
                    className="ml-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>

                {/* Content - Scrollable */}
                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                  {/* Date */}
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">Applied:</span>{' '}
                      {(() => {
                        const date = selectedJoinRequest.createdAt?.toDate?.() || selectedJoinRequest.requestedAt?.toDate?.();
                        return date ? 
                          new Date(date).toLocaleDateString('en-US', { 
                            weekday: 'long', 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          }) : 'Unknown date';
                      })()}
                    </p>
                  </div>

                  {/* Answers */}
                  {(() => {
                    let answersToDisplay: { question: string; answer: string }[] = [];
                    
                    if (selectedJoinRequest.answers) {
                      if (Array.isArray(selectedJoinRequest.answers)) {
                        answersToDisplay = selectedJoinRequest.answers;
                      } else if (typeof selectedJoinRequest.answers === 'object') {
                        answersToDisplay = Object.entries(selectedJoinRequest.answers).map(([key, value]) => ({
                          question: key,
                          answer: String(value)
                        }));
                      }
                    }
                    
                    return answersToDisplay.length > 0 ? (
                      <div className="space-y-4">
                        <h4 className="font-semibold text-gray-900 text-lg">Application Answers</h4>
                        {answersToDisplay.map((answer, index) => (
                          <div key={index} className="bg-gray-50 rounded-lg p-4 border">
                            <h5 className="font-medium text-blue-700 text-sm mb-2">
                              {answer.question}
                            </h5>
                            <div className="bg-white rounded p-3 border">
                              <p className="text-gray-700 text-sm whitespace-pre-wrap">
                                {answer.answer || 'No answer provided'}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <p className="text-gray-500">No answers provided</p>
                      </div>
                    );
                  })()}
                </div>

                {/* Footer - Action Buttons */}
                <div className="border-t bg-white p-4 sm:rounded-b-2xl">
                  <div className="flex flex-col space-y-3 sm:flex-row sm:space-y-0 sm:space-x-3">
                    <button
                      onClick={() => {
                        setShowAnswersModal(false);
                        setSelectedJoinRequest(null);
                      }}
                      className="flex-1 sm:flex-none px-6 py-3 text-gray-700 hover:bg-gray-100 rounded-lg border font-medium"
                    >
                      Close
                    </button>
                    {selectedJoinRequest.status === 'pending' && (
                      <>
                        <button
                          onClick={() => {
                            handleJoinRequestAction(selectedJoinRequest.id, 'reject');
                            setShowAnswersModal(false);
                            setSelectedJoinRequest(null);
                          }}
                          className="flex-1 sm:flex-none px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => {
                            handleJoinRequestAction(selectedJoinRequest.id, 'approve');
                            setShowAnswersModal(false);
                            setSelectedJoinRequest(null);
                          }}
                          className="flex-1 sm:flex-none px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                        >
                          Accept
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={() => setToast({ ...toast, isVisible: false })}
      />

      {/* Delete Confirmation Toast */}
      {deleteConfirmation.isVisible && (
        <div className="fixed top-4 right-4 z-50 max-w-sm w-full">
          <div className="bg-red-600 text-white rounded-lg shadow-lg p-4 border-l-4 border-red-800">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <ShieldExclamationIcon className="h-6 w-6 text-red-200" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-bold text-white mb-1">
                  🚨 Delete "{community?.name}"?
                </h4>
                <p className="text-xs text-red-100 mb-3">
                  This will permanently delete all posts, members, and data. This action cannot be undone!
                </p>
                <div className="flex items-center justify-between">
                  <div className="flex space-x-2">
                    <button
                      onClick={executeDeleteCommunity}
                      className="px-3 py-1.5 bg-red-800 hover:bg-red-900 text-white text-xs font-medium rounded transition-colors"
                    >
                      DELETE FOREVER
                    </button>
                    <button
                      onClick={cancelDeleteCommunity}
                      className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-medium rounded transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                  <div className="text-xs text-red-200 font-mono">
                    {deleteConfirmation.countdown}s
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        message={confirmDialog.message}
        type={confirmDialog.type}
        confirmText={confirmDialog.confirmText}
        cancelText={confirmDialog.cancelText}
      />
    </div>
  );
}