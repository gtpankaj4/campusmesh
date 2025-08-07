'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { auth, realtimeDb, db } from '@/lib/firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { ref, onValue, off, push, set, get } from 'firebase/database';
import { doc, getDoc } from 'firebase/firestore';
import Navbar from '@/components/Navbar';
import ConnectionStatus from '@/components/ConnectionStatus';
import { debugChatSystem, debugMessageDelivery } from '@/lib/debugUtils';
import dayjs from 'dayjs';

interface Message {
  id?: string; // Firebase key
  senderId: string;
  message: string;
  timestamp: number;
  seenBy?: { [userId: string]: number }; // Track who has seen the message and when
}

interface ChatParticipant {
  id: string;
  name: string;
}

export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const [user, loading] = useAuthState(auth);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [participant, setParticipant] = useState<ChatParticipant | null>(null);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastSentMessageRef = useRef<string>('');
  const lastSentTimeRef = useRef<number>(0);
  const chatId = params.chatId as string;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!user || !chatId) return;

    // Validate chat access
    if (!chatId.includes(user.uid)) {
      router.push('/chat');
      return;
    }

    // Get participant info - handle self-chat
    const chatIds = chatId.split('_');
    const participantId = chatIds.find(id => id !== user.uid) || user.uid; // Fallback to self if same user
    
    if (participantId === user.uid) {
      // Self-chat
      setParticipant({
        id: user.uid,
        name: 'Myself'
      });
    } else if (participantId) {
      // Enhanced participant name resolution
      const resolveParticipantName = async () => {
        try {
          // Try Realtime Database first
          const participantRef = ref(realtimeDb, `users/${participantId}`);
          const rtSnap = await get(participantRef);
          
          if (rtSnap.exists()) {
            const rtData = rtSnap.val();
            const name = rtData.displayName || rtData.username || rtData.email || 'Unknown User';
            setParticipant({ id: participantId, name });
          } else {
            // Fallback to Firestore
            const firestoreRef = doc(db, 'users', participantId);
            const fsSnap = await getDoc(firestoreRef);
            if (fsSnap.exists()) {
              const fsData = fsSnap.data();
              const name = fsData.username || fsData.displayName || fsData.email || 'Unknown User';
              setParticipant({ id: participantId, name });
            } else {
              setParticipant({ id: participantId, name: 'Unknown User' });
            }
          }
        } catch (error) {
          console.error('Error resolving participant name:', error);
          setParticipant({ id: participantId, name: 'Unknown User' });
        }
      };
      
      resolveParticipantName();
    }

    // Listen for messages with priority listener for immediate updates
    const messagesRef = ref(realtimeDb, `chats/${chatId}/messages`);
    const unsubscribe = onValue(messagesRef, async (snapshot) => {
      const messagesData = snapshot.val();
      if (messagesData) {
        const messageArray: Message[] = Object.keys(messagesData).map(key => ({
          ...messagesData[key],
          id: key  // Add the Firebase key as message ID
        }));
        messageArray.sort((a, b) => a.timestamp - b.timestamp);
        setMessages(messageArray);
        
        // Mark messages as seen when user opens the chat - IMMEDIATE for real-time updates
        const unseenMessages = messageArray.filter(msg => 
          msg.senderId !== user.uid && 
          (!msg.seenBy || !msg.seenBy[user.uid])
        );
        
        if (unseenMessages.length > 0) {
          console.log(`👀 Marking ${unseenMessages.length} messages as seen in chat ${chatId}`);
          
          // Mark messages as seen IMMEDIATELY without delay for real-time updates
          const markMessagesAsSeen = async () => {
            try {
              // Process in smaller batches for faster execution
              const batchSize = 3;
              const promises: Promise<any>[] = [];
              
              for (let i = 0; i < unseenMessages.length; i += batchSize) {
                const batch = unseenMessages.slice(i, i + batchSize);
                
                const batchPromises = batch.map(async (msg) => {
                  try {
                    const msgRef = ref(realtimeDb, `chats/${chatId}/messages/${msg.id}/seenBy/${user.uid}`);
                    await set(msgRef, Date.now());
                    console.log(`✅ Marked message ${msg.id} as seen`);
                  } catch (error) {
                    console.error(`❌ Failed to mark message ${msg.id} as seen:`, error);
                    throw error;
                  }
                });
                
                promises.push(...batchPromises);
                
                // Very small delay between batches to avoid overwhelming Firebase
                if (i + batchSize < unseenMessages.length) {
                  await new Promise(resolve => setTimeout(resolve, 50));
                }
              }
              
              // Wait for all promises to complete
              const results = await Promise.allSettled(promises);
              const successful = results.filter(r => r.status === 'fulfilled').length;
              const failed = results.filter(r => r.status === 'rejected').length;
              
              console.log(`📊 Seen marking results: ${successful} successful, ${failed} failed`);
            } catch (error) {
              console.error('Error in batch marking messages as seen:', error);
            }
          };
          
          // Execute immediately - no timeout delay for real-time updates
          // But use a micro-delay to ensure the UI updates first
          requestAnimationFrame(() => {
            markMessagesAsSeen();
          });
        }
      } else {
        setMessages([]);
      }
      setLoadingMessages(false);
    }, (error) => {
      console.error('Error loading messages:', error);
      setLoadingMessages(false);
    });

    return () => {
      off(messagesRef, 'value', unsubscribe);
    };
  }, [user, chatId, router]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);



  const sendMessage = async () => {
    const messageText = newMessage.trim();
    const now = Date.now();
    
    // AGGRESSIVE DUPLICATE PREVENTION
    if (!user || !messageText || !chatId || isSending) {
      console.log('🚫 Send blocked: basic checks failed');
      return;
    }
    
    // Check if this is a duplicate message sent too quickly
    if (lastSentMessageRef.current === messageText && (now - lastSentTimeRef.current) < 2000) {
      console.log('🚫 Send blocked: duplicate message within 2 seconds');
      return;
    }
    
    // Mark this attempt
    lastSentMessageRef.current = messageText;
    lastSentTimeRef.current = now;
    setIsSending(true);
    
    console.log('📤 Sending message:', messageText);
    
    try {
      const messageData: Message = {
        senderId: user.uid,
        message: messageText,
        timestamp: now,
      };

      // 1. Save message to Firebase (single attempt, no retries to avoid duplicates)
      const messagesRef = ref(realtimeDb, `chats/${chatId}/messages`);
      const newMessageRef = push(messagesRef);
      await set(newMessageRef, messageData);
      console.log('✅ Message saved to database');

      // 2. Update chat metadata for both users
      const chatIds = chatId.split('_');
      const participantId = chatIds.find(id => id !== user.uid) || user.uid;
      
      const chatMetadata = {
        chatId,
        lastMessage: messageText,
        timestamp: now,
      };

      // Update sender's chat list
      const senderChatRef = ref(realtimeDb, `userChats/${user.uid}/${chatId}`);
      await set(senderChatRef, {
        ...chatMetadata,
        participantId: participantId,
      });

      // Update receiver's chat list (if not self-chat)
      if (participantId !== user.uid) {
        const receiverChatRef = ref(realtimeDb, `userChats/${participantId}/${chatId}`);
        await set(receiverChatRef, {
          ...chatMetadata,
          participantId: user.uid,
        });
        
        // Create notification
        try {
          const { createMessageNotification } = await import('@/components/NotificationSystem');
          const senderName = user.displayName || user.email?.split('@')[0] || 'Someone';
          await createMessageNotification(participantId, user.uid, senderName, chatId);
          console.log('🔔 Notification sent');
        } catch (notifError) {
          console.warn('Could not send notification:', notifError);
        }
      }

      // Clear input only after everything succeeds
      setNewMessage('');
      console.log('🎉 Message sent successfully!');
      
    } catch (error: any) {
      console.error('❌ Failed to send message:', error);
      // Reset duplicate prevention on error so user can retry
      lastSentMessageRef.current = '';
      lastSentTimeRef.current = 0;
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(); // sendMessage has its own protection
    }
  };

  if (loadingMessages) {
    return (
      <div className="min-h-screen bg-gray-50 font-['Poppins']">
        <Navbar />
        <div className="flex items-center justify-center h-96">
          <div className="text-gray-500">Loading chat...</div>
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
      <div className="pt-8">
        <div className="max-w-7xl mx-auto px-6 h-[calc(100vh-160px)] lg:h-[calc(100vh-180px)] flex flex-col">
          {/* Chat Header */}
          <div className="bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => router.push('/chat')}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold">
                {participant?.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-800">{participant?.name}</h1>
                <p className="text-sm text-gray-500">Active now</p>
              </div>
            </div>
          </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto bg-gray-50 p-4">
          <div className="space-y-4">
            {messages.length === 0 ? (
              <div className="text-center text-gray-500 mt-8">
                <p>No messages yet. Start the conversation!</p>
              </div>
            ) : (
              messages.map((message, index) => {
                const isOwnMessage = message.senderId === user.uid;
                const showDate = index === 0 || 
                  dayjs(message.timestamp).format('YYYY-MM-DD') !== 
                  dayjs(messages[index - 1]?.timestamp).format('YYYY-MM-DD');

                return (
                  <div key={index}>
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
                              {message.seenBy && Object.keys(message.seenBy).some(uid => uid !== user.uid) ? (
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
              })
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Message Input */}
        <div className="bg-white border-t border-gray-200 p-4">
          <div className="flex items-center space-x-3">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type a message..."
              disabled={!user || isSending}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:border-blue-500 disabled:bg-gray-100 text-gray-800 placeholder-gray-500"
            />
            <button
              onClick={sendMessage}
              disabled={!newMessage.trim() || !user || isSending}
              className="px-6 py-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 focus:outline-none disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {isSending ? 'Sending...' : 'Send'}
            </button>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
} 