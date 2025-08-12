import { useEffect } from 'react';

// Keep track of how many components are requesting body scroll lock
let lockCount = 0;
let originalOverflow = '';

export function useBodyScrollLock(isLocked: boolean) {
  useEffect(() => {
    if (isLocked) {
      // If this is the first lock request, store the original overflow and lock
      if (lockCount === 0) {
        originalOverflow = document.body.style.overflow || '';
        document.body.style.overflow = 'hidden';
      }
      lockCount++;
    } else {
      // If this component was previously locking, decrease the count
      if (lockCount > 0) {
        lockCount--;
      }
      
      // If no more components are requesting lock, restore scrolling
      if (lockCount === 0) {
        document.body.style.overflow = originalOverflow;
      }
    }
    
    // Cleanup function when component unmounts
    return () => {
      if (isLocked && lockCount > 0) {
        lockCount--;
        if (lockCount === 0) {
          document.body.style.overflow = originalOverflow;
        }
      }
    };
  }, [isLocked]);
}