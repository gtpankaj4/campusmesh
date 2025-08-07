'use client';

import { useRouter } from 'next/navigation';
import { auth, realtimeDb, db } from '@/lib/firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { generateChatId } from '@/lib/chatUtils';
import { ref, set, get } from 'firebase/database';
import { doc, getDoc, setDoc } from 'firebase/firestore';

interface ChatButtonProps {
  postCreatorId: string;
  className?: string;
  children?: React.ReactNode;
}

export default function ChatButton({ postCreatorId, className = '', children }: ChatButtonProps) {
  const router = useRouter();
  const [user, loading] = useAuthState(auth);

  const handleChatClick = async () => {
    if (!user) {
      router.push('/login');
      return;
    }

    const chatId = generateChatId(user.uid, postCreatorId);
    console.log('🚀 Creating chat:', { chatId, currentUser: user.uid, targetUser: postCreatorId });
    
    try {
      // Wait for auth to be fully ready
      if (!user.uid) {
        console.error('User not properly authenticated');
        return;
      }

      // Fetch user profiles from Firestore with fallback logic
      const currentUserRef = doc(db, 'users', user.uid);
      const otherUserRef = doc(db, 'users', postCreatorId);
      
      const [currentUserSnap, otherUserSnap] = await Promise.all([
        getDoc(currentUserRef),
        getDoc(otherUserRef)
      ]);

      // Enhanced name resolution with better fallbacks
      const currentUserName = currentUserSnap.exists() ? 
        (currentUserSnap.data()?.username || currentUserSnap.data()?.displayName || user.email?.split('@')[0] || user.email) : 
        (user.email?.split('@')[0] || user.email || 'Unknown User');
      
      let otherUserName = 'Unknown User';
      let otherUserEmail = 'unknown@email.com';
      
      if (otherUserSnap.exists()) {
        const otherData = otherUserSnap.data();
        otherUserName = otherData?.username || otherData?.displayName || otherData?.email?.split('@')[0] || otherData?.email || 'Unknown User';
        otherUserEmail = otherData?.email || 'unknown@email.com';
      } else {
        // If user doesn't exist in Firestore, try to create a basic profile
        console.warn(`User ${postCreatorId} not found in Firestore, creating basic profile`);
        try {
          const basicUserData = {
            uid: postCreatorId,
            email: `user_${postCreatorId}@campusmesh.com`,
            username: `User_${postCreatorId.slice(-6)}`,
            displayName: `User ${postCreatorId.slice(-6)}`,
            createdAt: Date.now()
          };
          await setDoc(doc(db, 'users', postCreatorId), basicUserData);
          otherUserName = basicUserData.username;
          otherUserEmail = basicUserData.email;
          console.log(`✅ Created basic Firestore profile for ${postCreatorId}`);
        } catch (error) {
          console.error('Failed to create basic Firestore profile:', error);
        }
      }

      console.log('👤 User names:', { currentUserName, otherUserName });

      // Create user profiles in Realtime Database with retry logic
      const createUserProfile = async (userId: string, userData: any, retries = 3) => {
        for (let i = 0; i < retries; i++) {
          try {
            const userRef = ref(realtimeDb, `users/${userId}`);
            await set(userRef, userData);
            console.log(`✅ Created user profile for ${userId}`);
            return;
          } catch (error) {
            console.warn(`⚠️ Retry ${i + 1} for user ${userId}:`, error);
            if (i === retries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
      };

      await Promise.all([
        createUserProfile(user.uid, {
          displayName: currentUserName,
          username: currentUserName, // Add both for compatibility
          email: user.email,
          photoURL: user.photoURL || null,
          uid: user.uid,
          createdAt: Date.now()
        }),
        createUserProfile(postCreatorId, {
          displayName: otherUserName,
          username: otherUserName, // Add both for compatibility
          email: otherUserEmail,
          photoURL: null,
          uid: postCreatorId,
          createdAt: Date.now()
        })
      ]);

      // Create initial chat metadata in userChats with retry logic
      const createChatMetadata = async (userId: string, chatData: any, retries = 3) => {
        for (let i = 0; i < retries; i++) {
          try {
            const chatRef = ref(realtimeDb, `userChats/${userId}/${chatId}`);
            await set(chatRef, chatData);
            console.log(`✅ Created chat metadata for user ${userId}`);
            return;
          } catch (error) {
            console.warn(`⚠️ Retry ${i + 1} for chat metadata ${userId}:`, error);
            if (i === retries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
      };

      const isSelfChat = user.uid === postCreatorId;
      console.log('🤔 Is self chat:', isSelfChat);

      if (isSelfChat) {
        // Self-chat: only create one entry
        await createChatMetadata(user.uid, {
          chatId,
          participantId: user.uid, // Self reference
          lastMessage: 'Chat with yourself',
          timestamp: Date.now(),
        });
      } else {
        // Regular chat: create entries for both users
        await Promise.all([
          createChatMetadata(user.uid, {
            chatId,
            participantId: postCreatorId,
            lastMessage: 'Chat started',
            timestamp: Date.now(),
          }),
          createChatMetadata(postCreatorId, {
            chatId,
            participantId: user.uid,
            lastMessage: 'Chat started',
            timestamp: Date.now(),
          })
        ]);
      }

      console.log('✅ Chat created successfully, navigating...');
      router.push(`/chat/${chatId}`);
    } catch (error: any) {
      console.error('❌ Error creating chat:', error);
      
      // Show user-friendly error message
      let errorMessage = 'Unable to start chat. Please try again.';
      if (error?.message?.includes('permission')) {
        errorMessage = 'Permission denied. Please refresh the page and try again.';
      } else if (error?.message?.includes('network')) {
        errorMessage = 'Network error. Please check your connection.';
      }
      
      console.error('Chat error:', errorMessage);
      
      // Still attempt navigation as fallback
      router.push(`/chat/${chatId}`);
    }
  };

  if (loading) {
    return (
      <button
        disabled
        className={`px-4 py-2 bg-gray-300 text-gray-500 rounded-lg cursor-not-allowed ${className}`}
      >
        Loading...
      </button>
    );
  }

  if (!user) {
    return (
      <button
        onClick={handleChatClick}
        className={`px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors ${className}`}
      >
        {children || 'Login to Chat'}
      </button>
    );
  }

  return (
    <button
      onClick={handleChatClick}
      className={`px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors ${className}`}
    >
      {user.uid === postCreatorId ? (children || 'Note to Self') : (children || 'Chat')}
    </button>
  );
} 