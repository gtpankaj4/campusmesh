"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { auth, db, realtimeDb } from '@/lib/firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { collection, doc, getDoc, getDocs, updateDoc, deleteDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, set } from 'firebase/database';
import { CheckIcon, XMarkIcon, ArrowLeftIcon, UserIcon, ClockIcon, CogIcon } from '@heroicons/react/24/outline';
import Navbar from '@/components/Navbar';
import Toast from '@/components/Toast';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

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
  reviewedAt?: any;
  reviewedBy?: string;
}

interface Community {
  id: string;
  name: string;
  description: string;
  creatorId: string;
  creatorUsername: string;
  enrollmentQuestions: { question: string; required: boolean }[];
  isPrivate: boolean;
  memberCount: number;
}

export default function CommunityRequestsPage() {
  const [user] = useAuthState(auth);
  const [community, setCommunity] = useState<Community | null>(null);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [toast, setToast] = useState({ message: '', type: 'success' as 'success' | 'error', isVisible: false });
  const params = useParams();
  const router = useRouter();
  const communityId = params.communityId as string;

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type, isVisible: true });
  };

  const hideToast = () => {
    setToast({ ...toast, isVisible: false });
  };

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    loadCommunityAndRequests();
  }, [user, communityId, router]);

  const loadCommunityAndRequests = async () => {
    if (!user) {
      router.push('/login');
      return;
    }

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
      if (communityData.creatorId !== user.uid) {
        // Check if user has admin role
        const userCommunitiesRef = collection(db, 'users', user.uid, 'communities');
        const userCommunitiesSnap = await getDocs(userCommunitiesRef);
        const userCommunity = userCommunitiesSnap.docs.find(doc => doc.data().communityId === communityId);
        
        if (!userCommunity || userCommunity.data().role !== 'admin') {
          showToast('You do not have permission to view this page', 'error');
          router.push('/posts');
          return;
        }
      }

      // Load join requests
      const requestsRef = collection(db, 'joinRequests');
      const requestsSnap = await getDocs(requestsRef);
      const requests = requestsSnap.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as JoinRequest))
        .filter(request => request.communityId === communityId)
        .sort((a, b) => {
          if (a.status === 'pending' && b.status !== 'pending') return -1;
          if (a.status !== 'pending' && b.status === 'pending') return 1;
          return (b.createdAt?.toDate?.() || new Date()).getTime() - (a.createdAt?.toDate?.() || new Date()).getTime();
        });

      setJoinRequests(requests);
    } catch (error) {
      console.error('Error loading community and requests:', error);
      showToast('Failed to load requests', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestAction = async (requestId: string, action: 'approve' | 'reject') => {
    if (!user || !community) return;

    setProcessing(requestId);
    try {
      const request = joinRequests.find(r => r.id === requestId);
      if (!request) return;

      // Update join request status
      const requestRef = doc(db, 'joinRequests', requestId);
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

        // Send approval notification to user
        await createNotification(request.userId, {
          type: 'join_request',
          title: 'Join Request Approved!',
          message: `Your request to join "${community.name}" has been approved. Welcome to the community!`,
          timestamp: Date.now(),
          read: false,
          communityId: communityId,
          communityName: community.name,
          actionUrl: `/community/${communityId}`
        });

        showToast('Request approved successfully!', 'success');
      } else {
        // Send rejection notification to user
        await createNotification(request.userId, {
          type: 'join_request',
          title: 'Join Request Declined',
          message: `Your request to join "${community.name}" has been declined.`,
          timestamp: Date.now(),
          read: false,
          communityId: communityId,
          communityName: community.name
        });

        showToast('Request rejected', 'success');
      }

      // Refresh requests
      await loadCommunityAndRequests();
    } catch (error) {
      console.error(`Error ${action}ing request:`, error);
      showToast(`Failed to ${action} request`, 'error');
    } finally {
      setProcessing(null);
    }
  };

  const createNotification = async (userId: string, notification: any) => {
    try {
      const notificationRef = ref(realtimeDb, `notifications/${userId}/${Date.now()}`);
      await set(notificationRef, notification);
    } catch (error) {
      console.error('Error creating notification:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'approved':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'rejected':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <ClockIcon className="h-4 w-4" />;
      case 'approved':
        return <CheckIcon className="h-4 w-4" />;
      case 'rejected':
        return <XMarkIcon className="h-4 w-4" />;
      default:
        return <ClockIcon className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="pt-8 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
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

  const pendingRequests = joinRequests.filter(r => r.status === 'pending');
  const reviewedRequests = joinRequests.filter(r => r.status !== 'pending');

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <div className="max-w-6xl mx-auto px-6 py-8 pt-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.back()}
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeftIcon className="h-5 w-5" />
              <span>Back</span>
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Join Requests</h1>
              <p className="text-gray-600 mt-1">{community.name}</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => router.push(`/community/${communityId}/moderate`)}
              className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <CogIcon className="h-4 w-4" />
              <span>Moderate Community</span>
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center">
              <div className="bg-yellow-100 rounded-lg p-3">
                <ClockIcon className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-semibold text-gray-900">{pendingRequests.length}</h3>
                <p className="text-gray-600">Pending Requests</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center">
              <div className="bg-green-100 rounded-lg p-3">
                <CheckIcon className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-semibold text-gray-900">{reviewedRequests.filter(r => r.status === 'approved').length}</h3>
                <p className="text-gray-600">Approved</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center">
              <div className="bg-red-100 rounded-lg p-3">
                <XMarkIcon className="h-6 w-6 text-red-600" />
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-semibold text-gray-900">{reviewedRequests.filter(r => r.status === 'rejected').length}</h3>
                <p className="text-gray-600">Rejected</p>
              </div>
            </div>
          </div>
        </div>

        {/* Pending Requests */}
        {pendingRequests.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Pending Requests ({pendingRequests.length})</h2>
            <div className="space-y-4">
              {pendingRequests.map((request) => (
                <div key={request.id} className="bg-white rounded-xl shadow-sm border p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <UserIcon className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{request.userName}</h3>
                        <p className="text-sm text-gray-500">{request.userEmail}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          Applied {dayjs(request.createdAt?.toDate?.() || new Date()).fromNow()}
                        </p>
                      </div>
                    </div>
                    <span className={`px-3 py-1 text-xs font-medium rounded-full border ${getStatusColor(request.status)}`}>
                      <div className="flex items-center space-x-1">
                        {getStatusIcon(request.status)}
                        <span>{request.status.charAt(0).toUpperCase() + request.status.slice(1)}</span>
                      </div>
                    </span>
                  </div>

                  {/* Answers */}
                  {request.answers && request.answers.length > 0 && (
                    <div className="mb-6">
                      <h4 className="font-medium text-gray-900 mb-3">Application Answers:</h4>
                      <div className="space-y-3">
                        {request.answers.map((answer, index) => (
                          <div key={index} className="bg-gray-50 rounded-lg p-4">
                            <p className="font-medium text-gray-700 text-sm mb-1">{answer.question}</p>
                            <p className="text-gray-600 text-sm">{answer.answer}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => handleRequestAction(request.id, 'approve')}
                      disabled={processing === request.id}
                      className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <CheckIcon className="h-4 w-4" />
                      <span>{processing === request.id ? 'Processing...' : 'Approve'}</span>
                    </button>
                    <button
                      onClick={() => handleRequestAction(request.id, 'reject')}
                      disabled={processing === request.id}
                      className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <XMarkIcon className="h-4 w-4" />
                      <span>{processing === request.id ? 'Processing...' : 'Reject'}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reviewed Requests */}
        {reviewedRequests.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Reviewed Requests ({reviewedRequests.length})</h2>
            <div className="space-y-4">
              {reviewedRequests.map((request) => (
                <div key={request.id} className="bg-white rounded-xl shadow-sm border p-6 opacity-75">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                        <UserIcon className="h-5 w-5 text-gray-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{request.userName}</h3>
                        <p className="text-sm text-gray-500">{request.userEmail}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {request.status === 'approved' ? 'Approved' : 'Rejected'} {dayjs(request.reviewedAt?.toDate?.() || new Date()).fromNow()}
                        </p>
                      </div>
                    </div>
                    <span className={`px-3 py-1 text-xs font-medium rounded-full border ${getStatusColor(request.status)}`}>
                      <div className="flex items-center space-x-1">
                        {getStatusIcon(request.status)}
                        <span>{request.status.charAt(0).toUpperCase() + request.status.slice(1)}</span>
                      </div>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {joinRequests.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
            <UserIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Join Requests</h3>
            <p className="text-gray-500">There are no join requests for this community yet.</p>
          </div>
        )}
      </div>

      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={hideToast}
      />
    </div>
  );
}