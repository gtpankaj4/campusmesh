'use client';

import { useState, useEffect, useRef } from 'react';
import { auth, realtimeDb } from '@/lib/firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { ref, onValue, off } from 'firebase/database';

export function useUnreadMessages() {
  const [user] = useAuthState(auth);
  const [totalUnread, setTotalUnread] = useState(0);
  const [chatUnreadCounts, setChatUnreadCounts] = useState<{[chatId: string]: number}>({});
  const [isLoading, setIsLoading] = useState(false);
  const messageListenersRef = useRef<Map<string, () => void>>(new Map());

  // Immediate update function for real-time responsiveness
  const updateChatUnreadCount = (chatId: string, count: number) => {
    setChatUnreadCounts(prev => {
      // Only update if the count actually changed
      if (prev[chatId] === count) {
        return prev;
      }
      
      const newCounts = { ...prev, [chatId]: count };
      
      // Calculate and set total immediately
      const newTotal = Object.values(newCounts).reduce((sum, cnt) => sum + cnt, 0);
      setTotalUnread(newTotal);
      
      console.log(`📊 Unread count for ${chatId}: ${count}, Total: ${newTotal}`);
      return newCounts;
    });
  };

  useEffect(() => {
    if (!user?.uid) {
      setTotalUnread(0);
      setChatUnreadCounts({});
      setIsLoading(false);
      return;
    }

    console.log('🔄 Setting up unread message tracking for user:', user.uid);
    setIsLoading(true);
    
    const userChatsRef = ref(realtimeDb, `userChats/${user.uid}`);
    
    const unsubscribe = onValue(userChatsRef, (snapshot) => {
      try {
        const userChatsData = snapshot.val();
        console.log(`🔍 User chats data for ${user.uid}:`, userChatsData);

        // Clean up previous listeners
        messageListenersRef.current.forEach(cleanup => cleanup());
        messageListenersRef.current.clear();

        if (userChatsData) {
          const chatIds = Object.keys(userChatsData);
          console.log(`📝 Found ${chatIds.length} chats for user ${user.uid}:`, chatIds);
          
          // Initialize all chats with current counts
          const initialCounts: {[chatId: string]: number} = {};
          chatIds.forEach(chatId => {
            initialCounts[chatId] = 0;
          });
          
          setChatUnreadCounts(initialCounts);
          setTotalUnread(0);
          
          // Set up listeners for each chat with high priority
          chatIds.forEach(chatId => {
            const messagesRef = ref(realtimeDb, `chats/${chatId}/messages`);
            
            const messageUnsubscribe = onValue(messagesRef, (messageSnapshot) => {
              try {
                const messagesData = messageSnapshot.val();
                let unreadCount = 0;
                
                if (messagesData) {
                  // Count unread messages in this chat
                  const messages = Object.values(messagesData) as any[];
                  unreadCount = messages.filter(msg => 
                    msg.senderId !== user.uid && 
                    (!msg.seenBy || !msg.seenBy[user.uid])
                  ).length;
                }

                // Update immediately for real-time response
                console.log(`📊 Chat ${chatId} has ${unreadCount} unread messages`);
                updateChatUnreadCount(chatId, unreadCount);
              } catch (error) {
                console.error(`Error processing messages for chat ${chatId}:`, error);
                updateChatUnreadCount(chatId, 0);
              }
            }, (error) => {
              console.error(`Error listening to messages for chat ${chatId}:`, error);
              updateChatUnreadCount(chatId, 0);
            });
            
            messageListenersRef.current.set(chatId, () => off(messagesRef, 'value', messageUnsubscribe));
          });
        } else {
          // No chats
          console.log('📭 No chats found for user');
          setChatUnreadCounts({});
          setTotalUnread(0);
        }
        
        setIsLoading(false);
      } catch (error) {
        console.error('Error tracking unread messages:', error);
        setTotalUnread(0);
        setChatUnreadCounts({});
        setIsLoading(false);
      }
    }, (error) => {
      console.error('Error listening to user chats:', error);
      setTotalUnread(0);
      setChatUnreadCounts({});
      setIsLoading(false);
    });

    return () => {
      console.log('🧹 Cleaning up unread message listeners');
      off(userChatsRef, 'value', unsubscribe);
      messageListenersRef.current.forEach(cleanup => cleanup());
      messageListenersRef.current.clear();
    };
  }, [user?.uid]);

  return { totalUnread, chatUnreadCounts, isLoading };
}