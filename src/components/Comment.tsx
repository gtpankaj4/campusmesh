"use client";

import { useState, useEffect } from "react";
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  increment,
  getDoc,
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { PaperAirplaneIcon } from "@heroicons/react/24/outline";
import RepBadge from "./RepBadge";
import { getUserDisplayName, UserData } from "@/lib/userUtils";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";

interface Comment {
  id: string;
  text: string;
  userId: string;
  userEmail: string;
  username: string;
  timestamp: any;
  userRep: number;
}

interface CommentProps {
  postId: string;
  postUserId: string;
  onClose: () => void;
}

export default function Comment({ postId, postUserId, onClose }: CommentProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(false);
  const user = auth.currentUser;

  // Prevent body scroll when comment modal is open (only when this component is rendered as a modal)
  useBodyScrollLock(true);

  // Load comments
  useEffect(() => {
    if (!user) return;

    const commentsRef = collection(db, "posts", postId, "comments");
    const q = query(commentsRef, orderBy("timestamp", "desc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const postComments: Comment[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Comment[];
      setComments(postComments);
    });

    return unsubscribe;
  }, [user, postId]);

  const addComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newComment.trim()) return;

    setLoading(true);
    try {
      // Add comment
      const commentsRef = collection(db, "posts", postId, "comments");
      // Get user profile for username with better fallback
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);
      const userData: UserData | null = userSnap.exists() ? { uid: user.uid, ...userSnap.data() } as UserData : null;

      const username = getUserDisplayName(userData, user, user.uid);

      await addDoc(commentsRef, {
        text: newComment.trim(),
        userId: user.uid,
        userEmail: user.email,
        username: username,
        timestamp: serverTimestamp(),
        userRep: userData?.reputation || 0,
      });

      // Update user reputation (+5 for commenting)
      const userRefForRep = doc(db, "users", user.uid);
      await updateDoc(userRefForRep, {
        reputation: increment(5),
      });

      // Update post author reputation (+5 for receiving comment)
      const postAuthorRef = doc(db, "users", postUserId);
      await updateDoc(postAuthorRef, {
        reputation: increment(5),
      });

      // Create notification for post author (if not self-comment)
      if (postUserId !== user.uid) {
        try {
          const { createCommentNotification } = await import(
            "./NotificationSystem"
          );

          // Get post title for notification
          const postRef = doc(db, "posts", postId);
          const postSnap = await getDoc(postRef);
          const postTitle = postSnap.exists()
            ? postSnap.data()?.title || "your post"
            : "your post";

          await createCommentNotification(
            postUserId,
            user.uid,
            username,
            postTitle
          );
        } catch (error) {
          console.error("Error creating comment notification:", error);
        }
      }

      setNewComment("");
    } catch (error) {
      console.error("Error adding comment:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="fixed inset-0 bg-white/20 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl w-full max-w-md h-[600px] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-gray-900">Comments</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Comments */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {comments.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">
                No comments yet. Be the first to comment!
              </p>
            </div>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="border-b border-gray-100 pb-3">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <span className="font-medium text-sm text-gray-900">
                      {comment.username}
                    </span>
                    <RepBadge score={comment.userRep} size="sm" />
                  </div>
                  <span className="text-xs text-gray-400">
                    {comment.timestamp?.toDate
                      ? comment.timestamp.toDate().toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "Just now"}
                  </span>
                </div>
                <p className="text-sm text-gray-700">{comment.text}</p>
              </div>
            ))
          )}
        </div>

        {/* Comment Input */}
        <form onSubmit={addComment} className="p-4 border-t">
          <div className="flex space-x-2">
            <input
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a comment..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-500"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !newComment.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <PaperAirplaneIcon className="h-4 w-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
