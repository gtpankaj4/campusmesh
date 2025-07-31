'use client';

import { useEffect, useState } from 'react';
import { realtimeDb } from '@/lib/firebase';
import { ref, onValue, off } from 'firebase/database';

export default function ConnectionStatus() {
  const [isConnected, setIsConnected] = useState(true);
  const [showStatus, setShowStatus] = useState(false);

  useEffect(() => {
    // Monitor Firebase connection status
    const connectedRef = ref(realtimeDb, '.info/connected');
    const unsubscribe = onValue(connectedRef, (snapshot) => {
      const connected = snapshot.val() === true;
      setIsConnected(connected);
      
      // Show status for a few seconds when connection changes
      if (!connected) {
        setShowStatus(true);
        // Keep showing until reconnected
      } else {
        // Hide after 3 seconds when reconnected
        setTimeout(() => setShowStatus(false), 3000);
      }
    });

    return () => off(connectedRef, 'value', unsubscribe);
  }, []);

  if (!showStatus) return null;

  return (
    <div className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-lg shadow-lg transition-all duration-300 ${
      isConnected 
        ? 'bg-green-500 text-white' 
        : 'bg-red-500 text-white animate-pulse'
    }`}>
      <div className="flex items-center space-x-2">
        <div className={`w-2 h-2 rounded-full ${
          isConnected ? 'bg-green-200' : 'bg-red-200'
        }`} />
        <span className="text-sm font-medium">
          {isConnected ? 'Connected' : 'Connection lost...'}
        </span>
      </div>
    </div>
  );
}