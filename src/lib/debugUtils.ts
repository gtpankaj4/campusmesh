// Debug utilities for tracking message delivery and chat system issues

import { ref, get, set } from 'firebase/database';
import { doc, getDoc } from 'firebase/firestore';
import { realtimeDb, db } from '@/lib/firebase';

export async function debugChatSystem(userId: string, chatId?: string) {
  console.log('🔍 === CHAT SYSTEM DEBUG REPORT ===');
  console.log(`User: ${userId}`);
  
  try {
    // Check user profile in Firestore
    const firestoreUserRef = doc(db, 'users', userId);
    const firestoreUserSnap = await getDoc(firestoreUserRef);
    console.log(`📁 Firestore profile exists: ${firestoreUserSnap.exists()}`);
    if (firestoreUserSnap.exists()) {
      console.log(`📁 Firestore data:`, firestoreUserSnap.data());
    }
    
    // Check user profile in Realtime Database
    const realtimeUserRef = ref(realtimeDb, `users/${userId}`);
    const realtimeUserSnap = await get(realtimeUserRef);
    console.log(`⚡ Realtime DB profile exists: ${realtimeUserSnap.exists()}`);
    if (realtimeUserSnap.exists()) {
      console.log(`⚡ Realtime DB data:`, realtimeUserSnap.val());
    }
    
    // Check user's chat list
    const userChatsRef = ref(realtimeDb, `userChats/${userId}`);
    const userChatsSnap = await get(userChatsRef);
    console.log(`💬 User has chats: ${userChatsSnap.exists()}`);
    if (userChatsSnap.exists()) {
      const chats = userChatsSnap.val();
      const chatIds = Object.keys(chats);
      console.log(`💬 User's ${chatIds.length} chats:`, chatIds);
      
      // Check each chat
      for (const cId of chatIds) {
        console.log(`📋 Chat ${cId}:`, chats[cId]);
        
        // Check if chat has messages
        const messagesRef = ref(realtimeDb, `chats/${cId}/messages`);
        const messagesSnap = await get(messagesRef);
        const messageCount = messagesSnap.exists() ? Object.keys(messagesSnap.val()).length : 0;
        console.log(`📩 Chat ${cId} has ${messageCount} messages`);
      }
    } else {
      console.log(`❌ User ${userId} has NO chats in their list`);
    }
    
    // If specific chat ID provided, check it
    if (chatId) {
      console.log(`🎯 Checking specific chat: ${chatId}`);
      
      const chatMessagesRef = ref(realtimeDb, `chats/${chatId}/messages`);
      const chatMessagesSnap = await get(chatMessagesRef);
      
      if (chatMessagesSnap.exists()) {
        const messages = chatMessagesSnap.val();
        const messageKeys = Object.keys(messages);
        console.log(`📩 Chat ${chatId} has ${messageKeys.length} total messages`);
        
        // Show last few messages
        const recentMessages = messageKeys.slice(-3).map(key => ({
          id: key,
          ...messages[key]
        }));
        console.log(`📩 Recent messages:`, recentMessages);
        
        // Check unread messages for this user
        const unreadMessages = Object.values(messages).filter((msg: any) => 
          msg.senderId !== userId && 
          (!msg.seenBy || !msg.seenBy[userId])
        );
        console.log(`👁️ User ${userId} has ${unreadMessages.length} unread messages in chat ${chatId}`);
      } else {
        console.log(`❌ Chat ${chatId} has NO messages`);
      }
      
      // Check if both participants have this chat
      const chatParticipants = chatId.split('_');
      for (const participantId of chatParticipants) {
        const participantChatRef = ref(realtimeDb, `userChats/${participantId}/${chatId}`);
        const participantChatSnap = await get(participantChatRef);
        console.log(`🤝 Participant ${participantId} has chat ${chatId}: ${participantChatSnap.exists()}`);
        if (participantChatSnap.exists()) {
          console.log(`🤝 ${participantId}'s chat data:`, participantChatSnap.val());
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Debug error:', error);
  }
  
  console.log('🔍 === END DEBUG REPORT ===');
}

export async function debugMessageDelivery(senderId: string, receiverId: string, chatId: string) {
  console.log('📤 === MESSAGE DELIVERY DEBUG ===');
  console.log(`From: ${senderId} → To: ${receiverId} | Chat: ${chatId}`);
  
  try {
    // Check if chat exists
    const chatRef = ref(realtimeDb, `chats/${chatId}/messages`);
    const chatSnap = await get(chatRef);
    console.log(`💬 Chat exists: ${chatSnap.exists()}`);
    
    // Check sender's chat metadata
    const senderChatRef = ref(realtimeDb, `userChats/${senderId}/${chatId}`);
    const senderChatSnap = await get(senderChatRef);
    console.log(`📤 Sender has chat metadata: ${senderChatSnap.exists()}`);
    
    // Check receiver's chat metadata
    const receiverChatRef = ref(realtimeDb, `userChats/${receiverId}/${chatId}`);
    const receiverChatSnap = await get(receiverChatRef);
    console.log(`📥 Receiver has chat metadata: ${receiverChatSnap.exists()}`);
    
    if (!receiverChatSnap.exists()) {
      console.error(`❌ PROBLEM FOUND: Receiver ${receiverId} is missing chat ${chatId} in their list!`);
      console.log(`🔧 Attempting to fix by creating receiver's chat metadata...`);
      
      // Get sender's chat data to replicate
      if (senderChatSnap.exists()) {
        const senderData = senderChatSnap.val();
        const receiverData = {
          chatId,
          participantId: senderId,
          lastMessage: senderData.lastMessage || 'Chat started',
          timestamp: senderData.timestamp || Date.now()
        };
        
        await set(receiverChatRef, receiverData);
        console.log(`✅ Created missing chat metadata for receiver ${receiverId}`);
      }
    }
    
    // Check both users' profiles
    await debugChatSystem(senderId);
    await debugChatSystem(receiverId);
    
  } catch (error) {
    console.error('❌ Message delivery debug error:', error);
  }
  
  console.log('📤 === END MESSAGE DELIVERY DEBUG ===');
}