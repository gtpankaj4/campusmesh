import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";

export interface UsernameValidationResult {
  isValid: boolean;
  error?: string;
}

export const validateUsername = (username: string): UsernameValidationResult => {
  // Check length
  if (username.length === 0) {
    return { isValid: false, error: "Username is required" };
  }
  
  if (username.length > 20) {
    return { isValid: false, error: "Username must be 20 characters or less" };
  }

  // Check format - only alphanumeric, underscore, and hyphen
  const usernameRegex = /^[a-zA-Z0-9_-]+$/;
  if (!usernameRegex.test(username)) {
    return { isValid: false, error: "Username can only contain letters, numbers, underscores, and hyphens" };
  }

  // Check if starts with letter or number
  if (!/^[a-zA-Z0-9]/.test(username)) {
    return { isValid: false, error: "Username must start with a letter or number" };
  }

  return { isValid: true };
};

export const validateMeshName = (name: string): UsernameValidationResult => {
  // Check length
  if (name.length === 0) {
    return { isValid: false, error: "Mesh name is required" };
  }
  
  if (name.length > 50) {
    return { isValid: false, error: "Mesh name must be 50 characters or less" };
  }

  return { isValid: true };
};

export const checkUsernameAvailability = async (username: string, excludeUserId?: string): Promise<boolean> => {
  try {
    // Check in users collection
    const usersRef = collection(db, "users");
    const userQuery = query(usersRef, where("username", "==", username));
    const userSnapshot = await getDocs(userQuery);
    
    // If found and it's not the current user, username is taken
    if (!userSnapshot.empty) {
      if (excludeUserId) {
        const isCurrentUser = userSnapshot.docs.some(doc => doc.id === excludeUserId);
        if (!isCurrentUser) {
          return false; // Username taken by someone else
        }
      } else {
        return false; // Username taken
      }
    }

    // Check in communities collection
    const communitiesRef = collection(db, "communities");
    const communityQuery = query(communitiesRef, where("username", "==", username));
    const communitySnapshot = await getDocs(communityQuery);
    
    if (!communitySnapshot.empty) {
      return false; // Username taken by a community
    }

    return true; // Username available
  } catch (error) {
    console.error("Error checking username availability:", error);
    return false;
  }
};

export const checkMeshNameAvailability = async (name: string, excludeCommunityId?: string): Promise<boolean> => {
  try {
    const communitiesRef = collection(db, "communities");
    const nameQuery = query(communitiesRef, where("name", "==", name));
    const snapshot = await getDocs(nameQuery);
    
    if (!snapshot.empty) {
      if (excludeCommunityId) {
        const isCurrentCommunity = snapshot.docs.some(doc => doc.id === excludeCommunityId);
        if (!isCurrentCommunity) {
          return false; // Name taken by another community
        }
      } else {
        return false; // Name taken
      }
    }

    return true; // Name available
  } catch (error) {
    console.error("Error checking mesh name availability:", error);
    return false;
  }
};

export const generateSuggestedUsername = (baseName: string): string[] => {
  const suggestions: string[] = [];
  const cleanBase = baseName.toLowerCase().replace(/[^a-zA-Z0-9]/g, '');
  
  // Add numbers
  for (let i = 1; i <= 5; i++) {
    suggestions.push(`${cleanBase}${i}`);
  }
  
  // Add random suffixes
  const suffixes = ['_user', '_dev', '_pro', '_new', '_2024'];
  suffixes.forEach(suffix => {
    if ((cleanBase + suffix).length <= 20) {
      suggestions.push(cleanBase + suffix);
    }
  });
  
  return suggestions.slice(0, 5);
};

export const getUserDisplayInfo = async (userId: string) => {
  try {
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      const userData = userSnap.data();
      return {
        username: userData.username || userData.email?.split('@')[0] || 'User',
        displayName: userData.displayName || userData.username || userData.email?.split('@')[0] || 'User',
        email: userData.email
      };
    }
    
    return null;
  } catch (error) {
    console.error("Error getting user display info:", error);
    return null;
  }
};

export const getCommunityDisplayInfo = async (communityId: string) => {
  try {
    const communityRef = doc(db, "communities", communityId);
    const communitySnap = await getDoc(communityRef);
    
    if (communitySnap.exists()) {
      const communityData = communitySnap.data();
      return {
        username: communityData.username || communityData.name?.toLowerCase().replace(/[^a-zA-Z0-9]/g, '') || 'mesh',
        displayName: communityData.name,
        description: communityData.description
      };
    }
    
    return null;
  } catch (error) {
    console.error("Error getting community display info:", error);
    return null;
  }
};