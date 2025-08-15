import { doc, updateDoc, collection, getDocs, getDoc } from 'firebase/firestore';
import { db } from './firebase';

/**
 * Fixes member count inconsistencies by syncing with actual member objects
 * This function should be called to fix any negative or incorrect member counts
 */
export async function fixMemberCounts() {
  try {
    const communitiesRef = collection(db, 'communities');
    const communitiesSnapshot = await getDocs(communitiesRef);
    
    const fixes: Array<{ id: string; oldCount: number; newCount: number }> = [];
    
    for (const communityDoc of communitiesSnapshot.docs) {
      const data = communityDoc.data();
      const members = data.members || {};
      const actualMemberCount = Object.keys(members).length;
      const storedMemberCount = data.memberCount || 0;
      
      // Fix if counts don't match or if count is negative
      if (actualMemberCount !== storedMemberCount || storedMemberCount < 0) {
        await updateDoc(doc(db, 'communities', communityDoc.id), {
          memberCount: actualMemberCount
        });
        
        fixes.push({
          id: communityDoc.id,
          oldCount: storedMemberCount,
          newCount: actualMemberCount
        });
      }
    }
    
    return fixes;
  } catch (error) {
    console.error('Error fixing member counts:', error);
    throw error;
  }
}

/**
 * Validates and fixes a single community's member count
 */
export async function fixSingleCommunityMemberCount(communityId: string) {
  try {
    const communityRef = doc(db, 'communities', communityId);
    const communityDoc = await getDoc(communityRef);
    
    if (!communityDoc.exists()) {
      throw new Error('Community not found');
    }
    
    const data = communityDoc.data();
    const members = data.members || {};
    const actualMemberCount = Object.keys(members).length;
    
    await updateDoc(communityRef, {
      memberCount: actualMemberCount
    });
    
    return {
      oldCount: data.memberCount || 0,
      newCount: actualMemberCount
    };
  } catch (error) {
    console.error('Error fixing single community member count:', error);
    throw error;
  }
}