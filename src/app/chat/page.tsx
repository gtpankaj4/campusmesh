'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { auth, realtimeDb } from '@/lib/firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { ref, onValue, off, get, push, set } from 'firebase/database';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getUserDisplayNameById } from '@/lib/userUtils';
import Navbar from '@/components/Navbar';
import ConnectionStatus from '@/components/ConnectionStatus';
import { useUnreadMessages } from '@/hooks/useUnreadMessages';
import { 
  UserIcon, 
  UserGroupIcon, 
  ChevronDownIcon, 
  MagnifyingGlassIcon,
  PaperAirplaneIcon,
  XMarkIcon,
  InformationCircleIcon,
  TrashIcon,
  NoSymbolIcon,
  EyeIcon
} from '@heroicons/react/24/outline';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

interface ChatPreview {
  chatId: string;
  participantId: string;
  participantName: string;
  lastMessage: string;
  timestamp: number;
  hasUnread?: boolean;
  unreadCount?: number;
}

interface UserCommunity {
  communityId: string;
  communityName: string;
  role: string;
  joinedAt: any;
}

interface SelectedChat {
  type: 'direct' | 'group';
  id: string;
  name: string;
  participantId?: string;
  communityId?: string;
}

interface UserActivity {
  lastSeen: number;
  isOnline: boolean;
}

interface Message {
  id?: string;
  senderId: string;
  message: string;
  timestamp: number;
  seenBy?: { [userId: string]: number };
}

export default function ChatInboxPage() {
  const router = useRouter();
  const [user, loading] = useAuthState(auth);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [chats, setChats] = useState<ChatPreview[]>([]);
  const [filteredChats, setFilteredChats] = useState<ChatPreview[]>([]);
  const [userCommunities, setUserCommunities] = useState<UserCommunity[]>([]);
  const [selectedChat, setSelectedChat] = useState<SelectedChat | null>(null);
  const [loadingChats, setLoadingChats] = useState(true);
  const [showMeshes, setShowMeshes] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [showRightPanel, setShowRightPanel] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [toast, setToast] = useState({ message: '', type: 'success' as 'success' | 'error', isVisible: false });
  const [userActivity, setUserActivity] = useState<UserActivity | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { chatUnreadCounts, totalUnread } = useUnreadMessages();
  
  // Force re-render when unread counts change to ensure real-time updates
  useEffect(() => {
    console.log('📊 Unread counts updated:', chatUnreadCounts, 'Total:', totalUnread);
    
    // Update existing chats with new unread counts
    setChats(prevChats => 
      prevChats.map(chat => ({
        ...chat,
        unreadCount: chatUnreadCounts[chat.chatId] || 0,
        hasUnread: (chatUnreadCounts[chat.chatId] || 0) > 0
      }))
    );
  }, [chatUnreadCounts, totalUnread]);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  // Handle responsive design
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
      if (window.innerWidth < 1024) {
        setShowSidebar(!selectedChat);
      } else {
        setShowSidebar(true);
      }
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [selectedChat]);

  // Filter chats based on search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredChats(chats);
    } else {
      const filtered = chats.filter(chat =>
        chat.participantName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        chat.lastMessage.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredChats(filtered);
    }
  }, [chats, searchQuery]);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load user profile
  useEffect(() => {
    if (!user) return;
    
    const loadUserProfile = async () => {
      try {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          setUserProfile(userSnap.data());
        }
      } catch (error) {
        console.error('Error loading user profile:', error);
      }
    };
    
    loadUserProfile();
  }, [user]);

  // Load user communities
  useEffect(() => {
    if (!user) return;
    
    const loadUserCommunities = async () => {
      try {
        const userCommunitiesRef = collection(db, 'users', user.uid, 'communities');
        const userCommunitiesSnap = await getDocs(userCommunitiesRef);
        const communities: UserCommunity[] = userCommunitiesSnap.docs.map(doc => ({
          ...doc.data()
        })) as UserCommunity[];
        setUserCommunities(communities);
      } catch (error) {
        console.error('Error loading user communities:', error);
      }
    };
    
    loadUserCommunities();
  }, [user]);

  // Track user activity for selected chat participant
  useEffect(() => {
    if (!selectedChat || selectedChat.type !== 'direct' || !selectedChat.participantId) {
      setUserActivity(null);
      return;
    }

    const activityRef = ref(realtimeDb, `users/${selectedChat.participantId}/activity`);
    const unsubscribe = onValue(activityRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setUserActivity({
          lastSeen: data.lastSeen || Date.now(),
          isOnline: data.isOnline || false
        });
      } else {
        setUserActivity({
          lastSeen: Date.now(),
          isOnline: false
        });
      }
    });

    return () => off(activityRef, 'value', unsubscribe);
  }, [selectedChat]);

  // Update current user's activity status
  useEffect(() => {
    if (!user) return;

    const updateActivity = () => {
      const activityRef = ref(realtimeDb, `users/${user.uid}/activity`);
      set(activityRef, {
        lastSeen: Date.now(),
        isOnline: true
      });
    };

    // Update activity immediately
    updateActivity();

    // Update activity every 30 seconds
    const interval = setInterval(updateActivity, 30000);

    // Set offline when user leaves
    const handleBeforeUnload = () => {
      const activityRef = ref(realtimeDb, `users/${user.uid}/activity`);
      set(activityRef, {
        lastSeen: Date.now(),
        isOnline: false
      });
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      // Set offline when component unmounts
      const activityRef = ref(realtimeDb, `users/${user.uid}/activity`);
      set(activityRef, {
        lastSeen: Date.now(),
        isOnline: false
      });
    };
  }, [user]);

  // Load messages for selected chat
  useEffect(() => {
    if (!selectedChat || selectedChat.type !== 'direct') {
      setMessages([]);
      return;
    }

    const messagesRef = ref(realtimeDb, `chats/${selectedChat.id}/messages`);
    const unsubscribe = onValue(messagesRef, (snapshot) => {
      const messagesData = snapshot.val();
      if (messagesData) {
        const messageArray: Message[] = Object.keys(messagesData).map(key => ({
          ...messagesData[key],
          id: key
        }));
        messageArray.sort((a, b) => a.timestamp - b.timestamp);
        setMessages(messageArray);

        // Mark messages as seen
        if (user) {
          const unseenMessages = messageArray.filter(msg => 
            msg.senderId !== user.uid && 
            (!msg.seenBy || !msg.seenBy[user.uid])
          );
          
          unseenMessages.forEach(async (msg) => {
            try {
              const msgRef = ref(realtimeDb, `chats/${selectedChat.id}/messages/${msg.id}/seenBy/${user.uid}`);
              await set(msgRef, Date.now());
            } catch (error) {
              console.error('Error marking message as seen:', error);
            }
          });
        }
      } else {
        setMessages([]);
      }
    });

    return () => off(messagesRef, 'value', unsubscribe);
  }, [selectedChat, user]);

  // Send message function
  const sendMessage = async () => {
    if (!user || !newMessage.trim() || !selectedChat || selectedChat.type !== 'direct' || isSending) {
      return;
    }

    setIsSending(true);
    try {
      const messageData: Message = {
        senderId: user.uid,
        message: newMessage.trim(),
        timestamp: Date.now(),
      };

      const messagesRef = ref(realtimeDb, `chats/${selectedChat.id}/messages`);
      const newMessageRef = push(messagesRef);
      await set(newMessageRef, messageData);

      // Update chat metadata
      const chatIds = selectedChat.id.split('_');
      const participantId = chatIds.find(id => id !== user.uid) || user.uid;
      
      const chatMetadata = {
        chatId: selectedChat.id,
        lastMessage: newMessage.trim(),
        timestamp: Date.now(),
      };

      // Update both users' chat lists
      const senderChatRef = ref(realtimeDb, `userChats/${user.uid}/${selectedChat.id}`);
      await set(senderChatRef, {
        ...chatMetadata,
        participantId: participantId,
      });

      if (participantId !== user.uid) {
        const receiverChatRef = ref(realtimeDb, `userChats/${participantId}/${selectedChat.id}`);
        await set(receiverChatRef, {
          ...chatMetadata,
          participantId: user.uid,
        });

        // Create notification for the receiver
        try {
          const { createMessageNotification } = await import('@/components/NotificationSystem');
          const senderName = userProfile?.username || userProfile?.displayName || user.email?.split('@')[0] || 'Someone';
          await createMessageNotification(participantId, user.uid, senderName, selectedChat.id);
          console.log(`📬 Message notification sent to ${participantId}`);
        } catch (error) {
          console.error('Error creating message notification:', error);
        }
      }

      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const getActivityStatus = () => {
    if (!userActivity) return 'Last seen recently';
    
    if (userActivity.isOnline) {
      return 'Active now';
    }
    
    const timeDiff = Date.now() - userActivity.lastSeen;
    const minutes = Math.floor(timeDiff / (1000 * 60));
    const hours = Math.floor(timeDiff / (1000 * 60 * 60));
    const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
    
    if (minutes < 1) return 'Active now';
    if (minutes < 60) return `Active ${minutes}m ago`;
    if (hours < 24) return `Active ${hours}h ago`;
    if (days < 7) return `Active ${days}d ago`;
    return 'Last seen recently';
  };



  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type, isVisible: true });
    setTimeout(() => setToast(prev => ({ ...prev, isVisible: false })), 3000);
  };

  const deleteConversation = async () => {
    if (!selectedChat || !user) return;

    try {
      // Delete from user's chat list
      const userChatRef = ref(realtimeDb, `userChats/${user.uid}/${selectedChat.id}`);
      await set(userChatRef, null);

      // Delete all messages in the chat
      const messagesRef = ref(realtimeDb, `chats/${selectedChat.id}/messages`);
      await set(messagesRef, null);

      // If it's not a self-chat, also remove from other user's list
      if (selectedChat.participantId && selectedChat.participantId !== user.uid) {
        const otherUserChatRef = ref(realtimeDb, `userChats/${selectedChat.participantId}/${selectedChat.id}`);
        await set(otherUserChatRef, null);
      }

      setSelectedChat(null);
      setShowDeleteConfirm(false);
      showToast('Conversation deleted successfully', 'success');
    } catch (error) {
      console.error('Error deleting conversation:', error);
      showToast('Failed to delete conversation', 'error');
    }
  };

  const blockUser = async () => {
    if (!selectedChat || !user || !selectedChat.participantId) return;

    try {
      // Add to blocked users list (you'll need to implement this in your user schema)
      const blockedUsersRef = ref(realtimeDb, `users/${user.uid}/blockedUsers/${selectedChat.participantId}`);
      await set(blockedUsersRef, {
        blockedAt: Date.now(),
        userName: selectedChat.name
      });

      // Delete the conversation
      await deleteConversation();
      
      setShowBlockConfirm(false);
      showToast(`${selectedChat.name} has been blocked`, 'success');
    } catch (error) {
      console.error('Error blocking user:', error);
      showToast('Failed to block user', 'error');
    }
  };

  useEffect(() => {
    if (!user) return;

    const userChatsRef = ref(realtimeDb, `userChats/${user.uid}`);
    const messageListeners: (() => void)[] = [];
    
    const unsubscribe = onValue(userChatsRef, async (snapshot) => {
      try {
        const userChatsData = snapshot.val();
        const chatPreviews: ChatPreview[] = [];

        // Clean up previous message listeners
        messageListeners.forEach(cleanup => cleanup());
        messageListeners.length = 0;

        if (userChatsData) {
          const chatIds = Object.keys(userChatsData);
          
          for (const chatId of chatIds) {
            const chatData = userChatsData[chatId];
            const participantId = chatData.participantId;
            
            // Fetch participant's user info with improved fallback
            let participantName;
            if (participantId === user.uid) {
              participantName = 'Myself';
            } else {
              participantName = await getUserDisplayNameById(participantId);
            }

            // Get the latest actual message from the chat
            const messagesRef = ref(realtimeDb, `chats/${chatId}/messages`);
            
            // Create preview object
            const preview: ChatPreview = {
              chatId,
              participantId,
              participantName,
              lastMessage: chatData.lastMessage || 'No messages yet',
              timestamp: chatData.timestamp || Date.now(),
            };
            
            chatPreviews.push(preview);

            // Listen to real-time message updates for this chat with immediate updates
            const messageUnsubscribe = onValue(messagesRef, (messageSnapshot) => {
              const messagesData = messageSnapshot.val();
              if (messagesData) {
                // Get all messages and process them
                const messageKeys = Object.keys(messagesData);
                const allMessages = messageKeys.map(key => messagesData[key]);
                
                // Get the latest message (messages are ordered by timestamp)
                const latestMessageKey = messageKeys[messageKeys.length - 1];
                const latestMessage = messagesData[latestMessageKey];
                
                if (latestMessage) {
                  // Format the message preview
                  let displayMessage = latestMessage.message;
                  
                  // For self-chat, add "You: " prefix if you sent it
                  if (participantId === user.uid) {
                    displayMessage = latestMessage.senderId === user.uid 
                      ? `You: ${latestMessage.message}` 
                      : latestMessage.message;
                  } else {
                    // For regular chat, add "You: " if you sent it
                    if (latestMessage.senderId === user.uid) {
                      displayMessage = `You: ${latestMessage.message}`;
                    }
                    // If other person sent it, just show the message
                  }
                  
                  console.log(`📬 New message in chat ${chatId}:`, displayMessage);
                  
                  // Update the preview in the state IMMEDIATELY
                  setChats(prevChats => {
                    const updatedChats = prevChats.map(chat => {
                      if (chat.chatId === chatId) {
                        // Get real-time unread count from the global hook
                        const unreadCount = chatUnreadCounts[chatId] || 0;
                        const hasUnread = unreadCount > 0;
                        
                        console.log(`🔢 Chat ${chatId} unread count: ${unreadCount}, hasUnread: ${hasUnread}`);
                        
                        return {
                          ...chat,
                          lastMessage: displayMessage,
                          timestamp: latestMessage.timestamp,
                          hasUnread: hasUnread,
                          unreadCount: unreadCount
                        };
                      }
                      return chat;
                    });
                    
                    // Re-sort by timestamp (most recent first)
                    return updatedChats.sort((a, b) => b.timestamp - a.timestamp);
                  });
                }
              }
            }, (error) => {
              console.error(`Error listening to messages for chat ${chatId}:`, error);
            });
            
            messageListeners.push(() => off(messagesRef, 'value', messageUnsubscribe));
          }
        }

        // Sort by timestamp (most recent first)
        chatPreviews.sort((a, b) => b.timestamp - a.timestamp);
        setChats(chatPreviews);
        setLoadingChats(false);
      } catch (error) {
        console.error('Error loading chats:', error);
        setChats([]);
        setLoadingChats(false);
      }
    }, (error) => {
      console.error('Firebase error:', error);
      setChats([]);
      setLoadingChats(false);
    });

    return () => {
      off(userChatsRef, 'value', unsubscribe);
      messageListeners.forEach(cleanup => cleanup());
    };
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 font-['Poppins']">
        <Navbar />
        <div className="flex items-center justify-center h-96">
          <div className="text-gray-500">Loading...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      <Navbar userProfile={userProfile} />
      <ConnectionStatus />
      
      {/* Toast Notification */}
      {toast.isVisible && (
        <div className={`fixed top-20 right-4 z-50 px-4 py-2 rounded-lg text-white ${
          toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'
        }`}>
          {toast.message}
        </div>
      )}
      
      {/* Main Chat Layout - Fixed height, no page scroll */}
      <div className="flex-1 pt-8 pb-0.5 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full">
          <div className="h-full flex bg-white rounded-lg shadow-sm border overflow-hidden">
        {/* Left Sidebar */}
        <div className={`${isMobile ? (showSidebar ? 'w-full' : 'hidden') : 'w-80'} bg-white border-r border-gray-200 flex flex-col overflow-hidden`}>
          {/* Sidebar Header */}
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h1 className="text-xl font-semibold text-gray-900">Messages</h1>
            {isMobile && selectedChat && (
              <button
                onClick={() => setShowSidebar(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            )}
          </div>
          
          {/* Search Bar */}
          <div className="p-3 border-b border-gray-100">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 text-sm text-gray-900 placeholder-gray-500"
              />
            </div>
          </div>
          
          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto">
            {/* Direct Messages Section */}
            <div className="p-3">
              <div className="flex items-center space-x-2 mb-3">
                <UserIcon className="h-5 w-5 text-gray-500" />
                <h2 className="text-sm font-medium text-gray-700">Direct Messages</h2>
              </div>
              
              {loadingChats ? (
                <div className="text-center text-gray-500 py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                </div>
              ) : filteredChats.length === 0 ? (
                <div className="text-center text-gray-500 py-4">
                  <p className="text-sm">{searchQuery ? 'No matching conversations' : 'No conversations yet'}</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredChats.map((chat) => (
                    <div
                      key={chat.chatId}
                      onClick={() => {
                        setSelectedChat({
                          type: 'direct',
                          id: chat.chatId,
                          name: chat.participantName,
                          participantId: chat.participantId
                        });
                        if (isMobile) setShowSidebar(false);
                      }}
                      className={`flex items-center space-x-3 p-2 rounded-lg cursor-pointer transition-colors ${
                        selectedChat?.id === chat.chatId 
                          ? 'bg-blue-50 border border-blue-200' 
                          : 'hover:bg-gray-50'
                      } ${chat.hasUnread ? 'bg-blue-25' : ''}`}
                    >
                      <div className="relative">
                        <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-medium text-sm">
                          {(chat.participantName || 'U').charAt(0).toUpperCase()}
                        </div>
                        {chat.hasUnread && (
                          <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                            <span className="text-xs text-white font-bold">
                              {chat.unreadCount && chat.unreadCount > 9 ? '9+' : chat.unreadCount}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm truncate ${
                          chat.hasUnread ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'
                        }`}>
                          {chat.participantName || 'Unknown User'}
                        </p>
                        <p className={`text-xs truncate ${
                          chat.hasUnread ? 'text-gray-700' : 'text-gray-500'
                        }`}>
                          {chat.lastMessage}
                        </p>
                      </div>
                      <div className="text-xs text-gray-400">
                        {dayjs(chat.timestamp).format('HH:mm')}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {/* Meshes Section */}
            <div className="p-3 border-t border-gray-100">
              <button
                onClick={() => setShowMeshes(!showMeshes)}
                className="flex items-center justify-between w-full mb-3"
              >
                <div className="flex items-center space-x-2">
                  <UserGroupIcon className="h-5 w-5 text-gray-500" />
                  <h2 className="text-sm font-medium text-gray-700">Meshes</h2>
                  <span className="text-xs text-gray-500">({userCommunities.length})</span>
                </div>
                <ChevronDownIcon className={`h-4 w-4 text-gray-500 transition-transform ${
                  showMeshes ? 'rotate-180' : ''
                }`} />
              </button>
              
              {showMeshes && (
                <div className="space-y-1">
                  {userCommunities.map((community) => (
                    <div
                      key={community.communityId}
                      onClick={() => {
                        setSelectedChat({
                          type: 'group',
                          id: community.communityId,
                          name: community.communityName,
                          communityId: community.communityId
                        });
                        if (isMobile) setShowSidebar(false);
                      }}
                      className={`flex items-center space-x-3 p-2 rounded-lg cursor-pointer transition-colors ${
                        selectedChat?.id === community.communityId 
                          ? 'bg-green-50 border border-green-200' 
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center text-white font-medium text-sm">
                        {community.communityName.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-700 truncate">
                          {community.communityName}
                        </p>
                        <p className="text-xs text-gray-500 capitalize">
                          {community.role}
                        </p>
                      </div>
                    </div>
                  ))}
                  {userCommunities.length === 0 && (
                    <div className="text-center text-gray-500 py-4">
                      <p className="text-sm">No meshes joined yet</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Center Chat Area */}
        <div className={`${isMobile ? (showSidebar ? 'hidden' : 'w-full') : 'flex-1'} flex flex-col overflow-hidden`}>
          {selectedChat ? (
            <>
              {/* Chat Header */}
              <div className="bg-white border-b border-gray-200 p-4 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {isMobile && (
                    <button
                      onClick={() => setShowSidebar(true)}
                      className="p-2 hover:bg-gray-100 rounded-lg mr-2"
                    >
                      <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                  )}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-medium ${
                    selectedChat.type === 'direct' ? 'bg-blue-500' : 'bg-green-500'
                  }`}>
                    {(selectedChat.name || 'U').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="font-semibold text-gray-900">{selectedChat.name || 'Unknown User'}</h2>
                    <p className="text-sm text-gray-500">
                      {selectedChat.type === 'direct' ? getActivityStatus() : 'Mesh Chat'}
                    </p>
                  </div>
                </div>
                
                {/* Info Button for Mobile */}
                {isMobile && selectedChat && (
                  <button
                    onClick={() => setShowRightPanel(true)}
                    className="p-2 hover:bg-gray-100 rounded-lg"
                  >
                    <InformationCircleIcon className="h-5 w-5 text-gray-600" />
                  </button>
                )}
              </div>
              


              {/* Chat Messages Area - Scrollable */}
              <div className="flex-1 overflow-y-auto bg-gray-50 p-4 relative">
                {selectedChat.type === 'direct' ? (
                  messages.length === 0 ? (
                    <div className="text-center text-gray-500 mt-20">
                      <div className="text-6xl mb-4">💬</div>
                      <p className="text-lg font-medium mb-2">Start the conversation</p>
                      <p className="text-sm">Send a message to {selectedChat.name}</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {messages.map((message, index) => {
                        const isOwnMessage = message.senderId === user?.uid;
                        const showDate = index === 0 || 
                          dayjs(message.timestamp).format('YYYY-MM-DD') !== 
                          dayjs(messages[index - 1]?.timestamp).format('YYYY-MM-DD');

                        return (
                          <div key={message.id || index}>
                            {showDate && (
                              <div className="text-center text-xs text-gray-500 my-4">
                                {dayjs(message.timestamp).format('MMMM D, YYYY')}
                              </div>
                            )}
                            <div className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
                              <div
                                className={`max-w-[85%] sm:max-w-xs lg:max-w-md px-4 py-2 rounded-2xl ${
                                  isOwnMessage
                                    ? 'bg-blue-500 text-white rounded-br-md'
                                    : 'bg-white text-gray-800 rounded-bl-md border border-gray-200'
                                }`}
                              >
                                <div className="text-sm">{message.message}</div>
                                <div
                                  className={`text-xs mt-1 flex items-center justify-between ${
                                    isOwnMessage ? 'text-blue-100' : 'text-gray-500'
                                  }`}
                                >
                                  <span>{dayjs(message.timestamp).format('h:mm A')}</span>
                                  {isOwnMessage && (
                                    <span className="ml-2">
                                      {message.seenBy && Object.keys(message.seenBy).some(uid => uid !== user?.uid) ? (
                                        <svg className="w-4 h-4 text-blue-200" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                      ) : (
                                        <svg className="w-4 h-4 text-blue-300" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                      )}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      <div ref={messagesEndRef} />
                    </div>
                  )
                ) : (
                  <div className="text-center text-gray-500 mt-20">
                    <div className="text-6xl mb-4">👥</div>
                    <p className="text-lg font-medium mb-2">Mesh Chat</p>
                    <p className="text-sm">Group chat feature coming soon!</p>
                  </div>
                )}
              </div>
              
              {/* Message Input - Fixed at bottom with minimal padding */}
              <div className="bg-white border-t border-gray-200" style={{ paddingBottom: '12px', paddingTop: '12px', paddingLeft: '16px', paddingRight: '16px' }}>
                <div className="flex items-center space-x-3">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder={`Message ${selectedChat.name || 'User'}...`}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:border-blue-500 text-gray-900 placeholder-gray-500"
                    disabled={selectedChat.type === 'group' || isSending}
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!newMessage.trim() || selectedChat.type === 'group' || isSending}
                    className="p-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    <PaperAirplaneIcon className="h-5 w-5" />
                  </button>
                </div>
                {selectedChat.type === 'group' && (
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    Group chat feature coming soon!
                  </p>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-gray-50">
              <div className="text-center text-gray-500">
                <div className="text-6xl mb-4">💬</div>
                <h2 className="text-xl font-semibold mb-2">Select a conversation</h2>
                <p className="text-sm">Choose a direct message or mesh chat to start messaging</p>
              </div>
            </div>
          )}
        </div>
        
        {/* Right User Details Panel */}
        {(!isMobile || showRightPanel) && (
          <div className={`${isMobile ? 'fixed inset-0 z-50 bg-white' : 'w-80'} ${!isMobile ? 'border-l border-gray-200' : ''} flex flex-col overflow-hidden`}>
            {selectedChat ? (
              <>
                {/* Header with back button for mobile */}
                {isMobile && (
                  <div className="p-4 border-b border-gray-200 flex items-center">
                    <button
                      onClick={() => setShowRightPanel(false)}
                      className="p-2 hover:bg-gray-100 rounded-lg mr-3"
                    >
                      <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <h2 className="text-lg font-semibold text-gray-900">Chat Details</h2>
                  </div>
                )}
                
                {/* User/Group Info Header */}
                <div className="p-6 border-b border-gray-200 text-center">
                  <div className={`w-20 h-20 rounded-full flex items-center justify-center text-white font-bold text-2xl mx-auto mb-4 ${
                    selectedChat.type === 'direct' ? 'bg-blue-500' : 'bg-green-500'
                  }`}>
                    {(selectedChat.name || 'U').charAt(0).toUpperCase()}
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">
                    {selectedChat.name || 'Unknown User'}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {selectedChat.type === 'direct' ? 'Direct Message' : 'Mesh Chat'}
                  </p>
                </div>
                
                {/* Scrollable Details */}
                <div className="flex-1 p-6 overflow-y-auto">
                  {selectedChat.type === 'direct' ? (
                    <div className="space-y-6">

                      
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-2">About</h4>
                        <p className="text-sm text-gray-600">
                          Direct message conversation with {selectedChat.name}
                        </p>
                      </div>
                      
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-3">Actions</h4>
                        <div className="space-y-3">
                          <button
                            onClick={() => router.push(`/profile/${selectedChat.participantId}`)}
                            className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                          >
                            <EyeIcon className="h-4 w-4 mr-2" />
                            View Profile
                          </button>
                          
                          {/* Delete Conversation */}
                          {!showDeleteConfirm ? (
                            <button
                              onClick={() => setShowDeleteConfirm(true)}
                              className="w-full flex items-center justify-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
                            >
                              <TrashIcon className="h-4 w-4 mr-2" />
                              Delete Conversation
                            </button>
                          ) : (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                              <p className="text-sm text-red-800 mb-3">
                                Delete this conversation? All messages will be permanently removed.
                              </p>
                              <div className="flex space-x-2">
                                <button
                                  onClick={() => setShowDeleteConfirm(false)}
                                  className="flex-1 px-3 py-1 text-xs border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={() => {
                                    if (confirm('Are you absolutely sure? This cannot be undone.')) {
                                      deleteConversation();
                                    }
                                  }}
                                  className="flex-1 px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          )}
                          
                          {/* Block User */}
                          {!showBlockConfirm ? (
                            <button
                              onClick={() => setShowBlockConfirm(true)}
                              className="w-full flex items-center justify-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium"
                            >
                              <NoSymbolIcon className="h-4 w-4 mr-2" />
                              Block User
                            </button>
                          ) : (
                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                              <p className="text-sm text-gray-800 mb-3">
                                Block {selectedChat.name || 'this user'}? They won't be able to message you and this conversation will be deleted.
                              </p>
                              <div className="flex space-x-2">
                                <button
                                  onClick={() => setShowBlockConfirm(false)}
                                  className="flex-1 px-3 py-1 text-xs border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={() => {
                                    if (confirm(`Are you sure you want to block ${selectedChat.name || 'this user'}?`)) {
                                      blockUser();
                                    }
                                  }}
                                  className="flex-1 px-3 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700"
                                >
                                  Block
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-2">About Mesh</h4>
                        <p className="text-sm text-gray-600">
                          Group chat for {selectedChat.name} members
                        </p>
                      </div>
                      
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Actions</h4>
                        <div className="space-y-2">
                          <button
                            onClick={() => router.push(`/community/${selectedChat.communityId}`)}
                            className="w-full text-left px-3 py-2 text-sm text-green-600 hover:bg-green-50 rounded-lg"
                          >
                            View Mesh
                          </button>
                          <button className="w-full text-left px-3 py-2 text-sm text-gray-400 cursor-not-allowed rounded-lg">
                            Group Chat (Coming Soon)
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center text-gray-500">
                  <UserIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p className="text-sm">Select a chat to view details</p>
                </div>
              </div>
            )}
          </div>
        )}
          </div>
        </div>
      </div>


    </div>
  );
} 