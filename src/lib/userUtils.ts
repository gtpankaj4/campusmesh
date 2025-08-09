import { doc, getDoc } from 'firebase/firestore';
import { ref, get } from 'firebase/database';
import { db, realtimeDb } from './firebase';
import { User } from 'firebase/auth';

export interface UserData {
  uid: string;
  username?: string;
  displayName?: string;
  email?: string;
  reputation?: number;
  photoURL?: string;
}

/**
 * Get user display name with consistent fallback logic
 */
export function getUserDisplayName(userData: UserData | null, user?: User | null, userId?: string): string {
  // Try userData first
  if (userData?.username) return userData.username;
  if (userData?.displayName) return userData.displayName;
  if (userData?.email) return userData.email.split('@')[0];
  
  // Try Firebase Auth user
  if (user?.displayName) return user.displayName;
  if (user?.email) return user.email.split('@')[0];
  
  // Final fallback using userId
  const id = userId || userData?.uid || user?.uid;
  if (id) return `User_${id.slice(-6)}`;
  
  return 'Unknown User';
}

/**
 * Fetch user data from Firestore with Realtime Database fallback
 */
export async function fetchUserData(userId: string): Promise<UserData | null> {
  try {
    // First try Firestore (primary source)
    const firestoreRef = doc(db, 'users', userId);
    const firestoreSnap = await getDoc(firestoreRef);
    
    if (firestoreSnap.exists()) {
      return { uid: userId, ...firestoreSnap.data() } as UserData;
    }
    
    // Fallback to Realtime Database
    const realtimeRef = ref(realtimeDb, `users/${userId}`);
    const realtimeSnap = await get(realtimeRef);
    
    if (realtimeSnap.exists()) {
      return { uid: userId, ...realtimeSnap.val() } as UserData;
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching user data:', error);
    return null;
  }
}

/**
 * Get user display name by fetching data if needed
 */
export async function getUserDisplayNameById(userId: string): Promise<string> {
  try {
    const userData = await fetchUserData(userId);
    return getUserDisplayName(userData, null, userId);
  } catch (error) {
    console.error('Error getting user display name:', error);
    return `User_${userId.slice(-6)}`;
  }
}