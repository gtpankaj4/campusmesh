'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, realtimeDb } from '@/lib/firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { ref, onValue, off, get } from 'firebase/database';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Navbar from '@/components/Navbar';
import ConnectionStatus from '@/components/ConnectionStatus';
import { useUnreadMessages } from '@/hooks/useUnreadMessages';
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

export default function ChatInboxPage() {
  const router = useRouter();
  const [user, loading] = useAuthState(auth);
  const [chats, setChats] = useState<ChatPreview[]>([]);
  const [loadingChats, setLoadingChats] = useState(true);
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
            
            // Fetch participant's user info
            let participantName;
            if (participantId === user.uid) {
              participantName = 'Myself';
            } else {
              try {
                const participantRef = ref(realtimeDb, `users/${participantId}`);
                const participantSnap = await get(participantRef);
                
                if (participantSnap.exists()) {
                  const rtData = participantSnap.val();
                  participantName = rtData.displayName || rtData.username || rtData.email;
                } else {
                  const firestoreRef = doc(db, 'users', participantId);
                  const firestoreSnap = await getDoc(firestoreRef);
                  if (firestoreSnap.exists()) {
                    const fsData = firestoreSnap.data();
                    participantName = fsData.username || fsData.displayName || fsData.email || 'Unknown User';
                  } else {
                    participantName = 'Unknown User';
                  }
                }
              } catch (error) {
                console.error('Error fetching participant name:', error);
                participantName = 'Unknown User';
              }
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
    <div className="min-h-screen bg-gray-50 font-['Poppins']">
      <Navbar />
      <ConnectionStatus />
      {/* Add top padding to prevent navbar overlap */}
      <div className="pt-12 lg:pt-16">
        <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200">
            <h1 className="text-2xl font-semibold text-gray-800">Messages</h1>
            <p className="text-gray-500 mt-1">Your conversations</p>
          </div>
          
          <div className="divide-y divide-gray-200">
            {loadingChats ? (
              <div className="p-6 text-center text-gray-500">
                Loading conversations...
              </div>
            ) : chats.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                <div className="text-4xl mb-4">💬</div>
                <p className="text-lg font-medium mb-2">No conversations yet</p>
                <p className="text-sm">Start chatting by clicking "Message Seller" on any post</p>
              </div>
            ) : (
              chats.map((chat) => (
                <div
                  key={chat.chatId}
                  onClick={() => router.push(`/chat/${chat.chatId}`)}
                  className={`p-4 hover:bg-gray-50 cursor-pointer transition-all duration-200 ${
                    chat.hasUnread ? 'bg-blue-50 border-l-4 border-l-blue-500 shadow-sm' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="relative">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold text-lg transition-all duration-200 ${
                          chat.hasUnread ? 'bg-blue-600 ring-2 ring-blue-200' : 'bg-blue-500'
                        }`}>
                          {chat.participantName.charAt(0).toUpperCase()}
                        </div>
                        {chat.hasUnread && (
                          <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center animate-pulse">
                            <div className="w-3 h-3 bg-white rounded-full"></div>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`truncate transition-all duration-200 ${
                          chat.hasUnread 
                            ? 'text-gray-900 font-bold text-base' 
                            : 'text-gray-800 font-medium text-sm'
                        }`}>
                          {chat.participantName}
                        </p>
                        <p className={`text-sm truncate max-w-xs transition-all duration-200 ${
                          chat.hasUnread 
                            ? 'text-gray-800 font-semibold' 
                            : 'text-gray-500 font-normal'
                        }`}>
                          {chat.lastMessage}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end space-y-1">
                      <div className={`text-xs ml-4 transition-all duration-200 ${
                        chat.hasUnread ? 'text-blue-600 font-semibold' : 'text-gray-400'
                      }`}>
                        {dayjs(chat.timestamp).fromNow()}
                      </div>
                      {chat.hasUnread && chat.unreadCount && chat.unreadCount > 0 && (
                        <div className="bg-red-500 text-white text-xs font-bold rounded-full min-w-[20px] h-[20px] flex items-center justify-center px-1 animate-pulse">
                          {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
                        </div>
                      )}
                    </div>
                  </div>
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