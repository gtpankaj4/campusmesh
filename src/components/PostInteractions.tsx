"use client";

import { useState, useEffect } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '@/lib/firebase';
import { collection, doc, onSnapshot, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { 
  ChatBubbleLeftIcon, 
  PaperAirplaneIcon,
  FaceSmileIcon,
  FaceFrownIcon
} from '@heroicons/react/24/outline';
import { 
  FaceSmileIcon as FaceSmileIconSolid,
  FaceFrownIcon as FaceFrownIconSolid
} from '@heroicons/react/24/solid';
import { useRouter } from 'next/navigation';

interface PostInteractionsProps {
  postId: string;
  postUserId: string;
  onCommentClick?: (e?: any) => void;
  className?: string;
}





export default function PostInteractions({ 
  postId, 
  postUserId, 
  onCommentClick,
  className = ""
}: PostInteractionsProps) {
  const [user] = useAuthState(auth);
  const [upvoteCount, setUpvoteCount] = useState(0);
  const [downvoteCount, setDownvoteCount] = useState(0);
  const [commentCount, setCommentCount] = useState(0);
  const [hasUpvoted, setHasUpvoted] = useState(false);
  const [hasDownvoted, setHasDownvoted] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Load upvote count and user's upvote status
  useEffect(() => {
    if (!postId) return;

    const upvotesRef = collection(db, 'posts', postId, 'upvotes');
    const unsubscribe = onSnapshot(upvotesRef, (snapshot) => {
      setUpvoteCount(snapshot.size);
      
      if (user) {
        const userUpvote = snapshot.docs.find(doc => doc.id === user.uid);
        setHasUpvoted(!!userUpvote);
      }
    });

    return unsubscribe;
  }, [postId, user]);

  // Load downvote count and user's downvote status
  useEffect(() => {
    if (!postId) return;

    const downvotesRef = collection(db, 'posts', postId, 'downvotes');
    const unsubscribe = onSnapshot(downvotesRef, (snapshot) => {
      setDownvoteCount(snapshot.size);
      
      if (user) {
        const userDownvote = snapshot.docs.find(doc => doc.id === user.uid);
        setHasDownvoted(!!userDownvote);
      }
    });

    return unsubscribe;
  }, [postId, user]);

  // Load comment count
  useEffect(() => {
    if (!postId) return;

    const commentsRef = collection(db, 'posts', postId, 'comments');
    const unsubscribe = onSnapshot(commentsRef, (snapshot) => {
      setCommentCount(snapshot.size);
    });

    return unsubscribe;
  }, [postId]);

  const handleUpvote = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!user || loading) return;

    setLoading(true);
    try {
      const upvoteRef = doc(db, 'posts', postId, 'upvotes', user.uid);
      const downvoteRef = doc(db, 'posts', postId, 'downvotes', user.uid);
      
      if (hasUpvoted) {
        // Remove upvote
        await deleteDoc(upvoteRef);
      } else {
        // Add upvote and remove downvote if exists
        await setDoc(upvoteRef, {
          userId: user.uid,
          timestamp: serverTimestamp()
        });
        
        if (hasDownvoted) {
          await deleteDoc(downvoteRef);
        }
      }
    } catch (error) {
      console.error('Error toggling upvote:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownvote = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!user || loading) return;

    setLoading(true);
    try {
      const upvoteRef = doc(db, 'posts', postId, 'upvotes', user.uid);
      const downvoteRef = doc(db, 'posts', postId, 'downvotes', user.uid);
      
      if (hasDownvoted) {
        // Remove downvote
        await deleteDoc(downvoteRef);
      } else {
        // Add downvote and remove upvote if exists
        await setDoc(downvoteRef, {
          userId: user.uid,
          timestamp: serverTimestamp()
        });
        
        if (hasUpvoted) {
          await deleteDoc(upvoteRef);
        }
      }
    } catch (error) {
      console.error('Error toggling downvote:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChat = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!user || !postUserId) return;
    
    const chatId = [user.uid, postUserId].sort().join('_');
    router.push(`/chat/${chatId}`);
  };

  return (
    <div className={`flex space-x-1 mt-4 pt-3 border-t border-gray-100 ${className}`}>
      <div className="flex items-center justify-between w-full px-2">
        {/* Upvote Button */}
        <div className="relative flex items-center">
          <button
            onClick={handleUpvote}
            disabled={loading || !user}
            className={`flex items-center space-x-1 px-2 py-2 rounded-lg transition-all duration-200 ${
              hasUpvoted 
                ? 'bg-green-50 hover:bg-green-100' 
                : 'hover:bg-green-50'
            } ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            {hasUpvoted ? (
              <FaceSmileIconSolid className="h-4 w-4 text-green-600" />
            ) : (
              <FaceSmileIcon className="h-4 w-4 text-gray-400" />
            )}
            <span className="text-sm font-medium text-gray-600">
              {upvoteCount}
            </span>
          </button>
        </div>

        {/* Downvote Button */}
        <div className="relative flex items-center">
          <button
            onClick={handleDownvote}
            disabled={loading || !user}
            className={`flex items-center space-x-1 px-2 py-2 rounded-lg transition-all duration-200 ${
              hasDownvoted 
                ? 'bg-red-50 hover:bg-red-100' 
                : 'hover:bg-red-50'
            } ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            {hasDownvoted ? (
              <FaceFrownIconSolid className="h-4 w-4 text-red-600" />
            ) : (
              <FaceFrownIcon className="h-4 w-4 text-gray-400" />
            )}
            <span className="text-sm font-medium text-gray-600">
              {downvoteCount}
            </span>
          </button>
        </div>

        {/* Comment Button */}
        <div className="relative flex items-center flex-1 justify-center">
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onCommentClick?.(e);
            }}
            className="flex items-center space-x-1 px-3 py-2 rounded-lg text-gray-600 hover:text-blue-600 hover:bg-blue-50 transition-all duration-200"
          >
            <ChatBubbleLeftIcon className="h-4 w-4" />
            <span className="text-sm font-medium">{commentCount}</span>
          </button>
        </div>

        {/* Chat Button */}
        <div className="relative flex items-center justify-end">
          <button
            onClick={handleChat}
            disabled={!user || !postUserId}
            className="flex items-center px-3 py-2 rounded-lg text-gray-600 hover:text-blue-600 hover:bg-blue-50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <PaperAirplaneIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}