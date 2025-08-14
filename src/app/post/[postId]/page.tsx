"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import {
  doc,
  getDoc,
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  increment,
} from "firebase/firestore";
import {
  ArrowLeftIcon,
  HeartIcon,
  FaceSmileIcon,
  FaceFrownIcon,
  ChatBubbleLeftIcon,
  PaperAirplaneIcon,
  EllipsisHorizontalIcon,
} from "@heroicons/react/24/outline";
import { HeartIcon as HeartSolid } from "@heroicons/react/24/solid";
import Navbar from "@/components/Navbar";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import PostInteractions from "@/components/PostInteractions";

interface Post {
  id: string;
  title: string;
  description: string;
  userId: string;
  userEmail: string;
  username?: string;
  communityId?: string;
  communityName?: string;
  communityUsername?: string;
  submessName?: string;
  createdAt: any;
  likesCount?: number;
  commentsCount?: number;
}

interface Comment {
  id: string;
  text: string;
  userId: string;
  userEmail: string;
  username: string;
  postId: string;
  parentId?: string;
  createdAt: any;
  likesCount: number;
  reactions: { [key: string]: string[] };
  replies?: Comment[];
}

interface Reaction {
  type: "like" | "love" | "laugh" | "sad" | "angry";
  emoji: string;
  color: string;
}

const reactions: Reaction[] = [
  { type: "like", emoji: "👍", color: "text-blue-500" },
  { type: "love", emoji: "❤️", color: "text-red-500" },
  { type: "laugh", emoji: "😂", color: "text-yellow-500" },
  { type: "sad", emoji: "😢", color: "text-blue-400" },
  { type: "angry", emoji: "😠", color: "text-red-600" },
];

export default function PostPage() {
  const [user] = useAuthState(auth);
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [showReactions, setShowReactions] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);

  const params = useParams();
  const router = useRouter();
  const postId = params.postId as string;

  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }
    loadPost();
    loadUserProfile();
    const unsubscribe = loadComments();
    
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [user, postId]);

  const loadPost = async () => {
    try {
      const postRef = doc(db, "posts", postId);
      const postSnap = await getDoc(postRef);

      if (postSnap.exists()) {
        setPost({ id: postSnap.id, ...postSnap.data() } as Post);
      } else {
        router.push("/dashboard");
      }
    } catch (error) {
      console.error("Error loading post:", error);
      router.push("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  const loadUserProfile = async () => {
    if (!user) return;
    try {
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        setUserProfile(userSnap.data());
      }
    } catch (error) {
      console.error("Error loading user profile:", error);
    }
  };

  const loadComments = () => {
    const commentsRef = collection(db, "posts", postId, "comments");
    
    // Try without orderBy first to see if that's the issue
    const unsubscribe = onSnapshot(commentsRef, (snapshot) => {
      const commentsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Comment[];

      console.log('📝 Raw comments data:', commentsData);

      // Sort manually by createdAt
      commentsData.sort((a, b) => {
        const aTime = a.createdAt?.toDate?.()?.getTime() || 0;
        const bTime = b.createdAt?.toDate?.()?.getTime() || 0;
        return aTime - bTime;
      });

      // Organize comments into threads
      const organizedComments = organizeComments(commentsData);
      console.log('📝 Organized comments:', organizedComments);
      setComments(organizedComments);
    }, (error) => {
      console.error('❌ Error loading comments:', error);
    });

    return unsubscribe;
  };

  const organizeComments = (commentsData: Comment[]): Comment[] => {
    console.log('🔧 Organizing comments:', commentsData.length, 'comments');
    
    const commentMap = new Map<string, Comment>();
    const rootComments: Comment[] = [];

    // First pass: create map of all comments
    commentsData.forEach((comment) => {
      console.log('📝 Processing comment:', comment.id, comment.text, 'parentId:', comment.parentId);
      commentMap.set(comment.id, { ...comment, replies: [] });
    });

    // Second pass: organize into threads
    commentsData.forEach((comment) => {
      if (comment.parentId) {
        const parent = commentMap.get(comment.parentId);
        if (parent) {
          parent.replies!.push(commentMap.get(comment.id)!);
          console.log('📝 Added reply to parent:', comment.parentId);
        } else {
          console.log('❌ Parent not found for comment:', comment.id, 'parentId:', comment.parentId);
        }
      } else {
        rootComments.push(commentMap.get(comment.id)!);
        console.log('📝 Added root comment:', comment.id);
      }
    });

    console.log('📝 Final root comments:', rootComments.length);
    return rootComments;
  };

  const addComment = async () => {
    if (!user || !newComment.trim()) return;

    try {
      const commentsRef = collection(db, "posts", postId, "comments");
      await addDoc(commentsRef, {
        text: newComment.trim(),
        userId: user.uid,
        userEmail: user.email,
        username: userProfile?.username || user.email?.split("@")[0] || "User",
        postId: postId,
        createdAt: serverTimestamp(),
        likesCount: 0,
        reactions: {},
      });

      // Update post comment count
      const postRef = doc(db, "posts", postId);
      await updateDoc(postRef, {
        commentsCount: increment(1),
      });

      setNewComment("");
    } catch (error) {
      console.error("Error adding comment:", error);
    }
  };

  const addReply = async (parentId: string) => {
    if (!user || !replyText.trim()) return;

    try {
      const commentsRef = collection(db, "posts", postId, "comments");
      await addDoc(commentsRef, {
        text: replyText.trim(),
        userId: user.uid,
        userEmail: user.email,
        username: userProfile?.username || user.email?.split("@")[0] || "User",
        postId: postId,
        parentId: parentId,
        createdAt: serverTimestamp(),
        likesCount: 0,
        reactions: {},
      });

      setReplyText("");
      setReplyingTo(null);
    } catch (error) {
      console.error("Error adding reply:", error);
    }
  };

  const addReaction = async (commentId: string, reactionType: string) => {
    if (!user) return;

    try {
      const commentRef = doc(db, "posts", postId, "comments", commentId);
      const commentSnap = await getDoc(commentRef);

      if (commentSnap.exists()) {
        const commentData = commentSnap.data();
        const reactions = commentData.reactions || {};

        // Check if user already has this reaction
        const userHasReaction = reactions[reactionType]?.includes(user.uid);

        if (userHasReaction) {
          // Remove the reaction (toggle off)
          reactions[reactionType] = reactions[reactionType].filter(
            (uid: string) => uid !== user.uid
          );
        } else {
          // Remove user from all other reaction types first
          Object.keys(reactions).forEach((type) => {
            reactions[type] = reactions[type].filter(
              (uid: string) => uid !== user.uid
            );
          });

          // Add user to the new reaction type
          if (!reactions[reactionType]) {
            reactions[reactionType] = [];
          }
          reactions[reactionType].push(user.uid);
        }

        await updateDoc(commentRef, { reactions });
      }
    } catch (error) {
      console.error("Error adding reaction:", error);
    }
  };

  const formatTimeAgo = (date: Date): string => {
    const now = Date.now();
    const diffInSeconds = Math.floor((now - date.getTime()) / 1000);

    if (diffInSeconds < 60) return "Just now";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d`;
    return `${Math.floor(diffInSeconds / 604800)}w`;
  };

  const handleCommunityNavigation = (communityId: string | undefined, communityName: string | undefined) => {
    if (!communityId || !communityName) return;
    
    // Store the current post URL as the return path
    const currentPath = window.location.pathname;
    
    // Navigate to the community with return path as query parameter
    router.push(`/community/${communityId}?returnTo=${encodeURIComponent(currentPath)}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="pt-8 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="pt-8 text-center">
          <p className="text-gray-500">Post not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="max-w-4xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-6 pt-4 sm:pt-8">
        {/* Header */}
        <div className="flex items-center mb-4 sm:mb-6">
          <button
            onClick={() => router.back()}
            className="p-2 sm:p-3 text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100 mr-2 sm:mr-4"
          >
            <ArrowLeftIcon className="h-5 w-5 sm:h-6 sm:w-6" />
          </button>
          <div>
            <h1 className="text-base sm:text-lg font-semibold text-gray-900">Post</h1>
            {post.communityName && (
              <p className="text-xs sm:text-sm text-gray-500">{post.communityName}</p>
            )}
          </div>
        </div>

        {/* Post Content - Mobile Responsive */}
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg border border-gray-200 mb-6 sm:mb-8">
          <div className="p-4 sm:p-6 lg:p-8">
            {/* Post Header - Responsive sizing */}
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <div className="flex items-center text-xs sm:text-sm text-gray-500 space-x-1 flex-1 min-w-0 lg:min-w-max lg:max-w-none">
                <button className="font-medium text-gray-700 hover:text-blue-600 cursor-pointer text-sm sm:text-base truncate sm:truncate lg:whitespace-normal lg:overflow-visible">
                  @{post.username || post.userEmail.split("@")[0]}
                </button>
                {post.communityName && (
                  <>
                    <span className="shrink-0 text-sm sm:text-base">›</span>
                    <span
                      onClick={() => handleCommunityNavigation(post.communityId, post.communityName)}
                      className="px-2 sm:px-3 py-1 bg-stone-100 text-stone-700 rounded-md text-xs hover:bg-stone-200 cursor-pointer transition-colors"
                      title={post.communityName}
                    >
                      <span className="sm:hidden">
                        {post.communityName.length > 10
                          ? post.communityName.substring(0, 8) + "..."
                          : post.communityName}
                      </span>
                      <span className="hidden sm:inline lg:hidden">
                        {post.communityName.length > 15
                          ? post.communityName.substring(0, 12) + "..."
                          : post.communityName}
                      </span>
                      <span className="hidden lg:inline">
                        {post.communityName}
                      </span>
                    </span>
                  </>
                )}
                {post.submessName && (
                  <>
                    <span className="shrink-0 text-sm">›</span>
                    <span className="px-2 py-1 bg-amber-50 text-amber-700 rounded-md text-xs font-medium">
                      <span className="sm:hidden">
                        {post.submessName.length > 8
                          ? post.submessName.substring(0, 6) + "..."
                          : post.submessName}
                      </span>
                      <span className="hidden sm:inline lg:hidden">
                        {post.submessName.length > 12
                          ? post.submessName.substring(0, 10) + "..."
                          : post.submessName}
                      </span>
                      <span className="hidden lg:inline">
                        {post.submessName}
                      </span>
                    </span>
                  </>
                )}
              </div>
              <span className="text-xs text-gray-400 shrink-0 ml-2">
                {formatTimeAgo(post.createdAt?.toDate?.() || new Date())}
              </span>
            </div>

            {/* Post Title - Reddit-like sizing */}
            <h1 className="font-bold text-gray-900 text-base sm:text-lg lg:text-xl leading-tight mb-4 sm:mb-6 cursor-pointer hover:text-blue-600 transition-colors">
              {post.title}
            </h1>

            {/* Post Content - Reddit-like sizing */}
            <div className="mb-6 sm:mb-8">
              <div className="text-gray-600 text-sm sm:text-base leading-relaxed">
                <p className="whitespace-pre-wrap">{post.description}</p>
              </div>
            </div>

            {/* Post Interactions - Responsive */}
            <div className="border-t border-gray-100">
              <PostInteractions
                postId={post.id}
                postUserId={post.userId}
                onCommentClick={() => {}}
                className="mt-0 pt-4 sm:pt-6 border-t-0"
              />
            </div>
          </div>
        </div>

        {/* Comment Input - Reddit-like */}
        <div className="bg-white rounded-xl shadow-sm border mb-4">
          <div className="p-3 sm:p-4">
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 sm:w-9 sm:h-9 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-blue-600 font-semibold text-sm">
                  {user?.email?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1">
                <div className="relative">
                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder={`Comment as ${
                      user?.email?.split("@")[0] || "User"
                    }`}
                    className="w-full px-3 py-2 bg-gray-50 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white resize-none text-gray-900 text-sm"
                    rows={2}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        addComment();
                      }
                    }}
                  />
                  {newComment.trim() && (
                    <button
                      onClick={addComment}
                      className="absolute bottom-2 right-2 p-1.5 sm:p-2 text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                    >
                      <PaperAirplaneIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Comments Section */}
        <div className="space-y-3 sm:space-y-4">
          {comments.map((comment) => (
            <CommentThread
              key={comment.id}
              comment={comment}
              onReply={(commentId) => setReplyingTo(commentId)}
              onReaction={(commentId, reaction) =>
                addReaction(commentId, reaction)
              }
              replyingTo={replyingTo}
              replyText={replyText}
              setReplyText={setReplyText}
              onSubmitReply={addReply}
              onCancelReply={() => {
                setReplyingTo(null);
                setReplyText("");
              }}
              currentUser={user}
              formatTimeAgo={formatTimeAgo}
              reactions={reactions}
            />
          ))}

          {comments.length === 0 && (
            <div className="bg-white rounded-xl shadow-sm border p-6 sm:p-8 text-center">
              <ChatBubbleLeftIcon className="h-10 w-10 sm:h-12 sm:w-12 text-gray-300 mx-auto mb-3 sm:mb-4" />
              <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">
                No comments yet
              </h3>
              <p className="text-gray-500 text-sm sm:text-base">
                Be the first to share your thoughts!
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Comment Thread Component
interface CommentThreadProps {
  comment: Comment;
  onReply: (commentId: string) => void;
  onReaction: (commentId: string, reaction: string) => void;
  replyingTo: string | null;
  replyText: string;
  setReplyText: (text: string) => void;
  onSubmitReply: (parentId: string) => void;
  onCancelReply: () => void;
  currentUser: any;
  formatTimeAgo: (date: Date) => string;
  reactions: Reaction[];
}

function CommentThread({
  comment,
  onReply,
  onReaction,
  replyingTo,
  replyText,
  setReplyText,
  onSubmitReply,
  onCancelReply,
  currentUser,
  formatTimeAgo,
  reactions,
}: CommentThreadProps) {
  const hasUserReacted = (reactionType: string) => {
    return (
      comment.reactions?.[reactionType]?.includes(currentUser?.uid) || false
    );
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border mb-3">
      <div className="p-3 sm:p-4">
        {/* Main Comment */}
        <div className="flex items-start space-x-3">
          <div className="w-8 h-8 sm:w-9 sm:h-9 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-gray-600 font-semibold text-sm">
              {comment.username.charAt(0).toUpperCase()}
            </span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="bg-gray-50 rounded-lg px-3 py-2 sm:py-3 relative">
              <div className="flex items-center space-x-2 mb-1">
                <h4 className="font-semibold text-gray-900 text-sm">
                  {comment.username}
                </h4>
              </div>
              <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">
                {comment.text}
              </p>
            </div>

            {/* Comment Actions - Reddit-like */}
            <div className="flex items-center space-x-3 sm:space-x-4 mt-2 ml-3">
              <span className="text-xs text-gray-500">
                {formatTimeAgo(comment.createdAt?.toDate?.() || new Date())}
              </span>
              
              {/* Happy Face - Reddit-like */}
              <button
                onClick={() => onReaction(comment.id, 'like')}
                className={`flex items-center space-x-1 px-2 py-1 rounded-lg transition-all duration-200 ${
                  hasUserReacted('like') 
                    ? 'bg-green-50 hover:bg-green-100' 
                    : 'hover:bg-green-50'
                }`}
              >
                <FaceSmileIcon className={`h-3 w-3 ${
                  hasUserReacted('like') ? 'text-green-600' : 'text-gray-400'
                }`} />
                <span className="text-xs font-medium text-gray-600">
                  {(comment.reactions?.like?.length || 0)}
                </span>
              </button>

              {/* Frown Face - Reddit-like */}
              <button
                onClick={() => onReaction(comment.id, 'sad')}
                className={`flex items-center space-x-1 px-2 py-1 rounded-lg transition-all duration-200 ${
                  hasUserReacted('sad') 
                    ? 'bg-red-50 hover:bg-red-100' 
                    : 'hover:bg-red-50'
                }`}
              >
                <FaceFrownIcon className={`h-3 w-3 ${
                  hasUserReacted('sad') ? 'text-red-600' : 'text-gray-400'
                }`} />
                <span className="text-xs font-medium text-gray-600">
                  {(comment.reactions?.sad?.length || 0)}
                </span>
              </button>

              {/* Only show Reply for root comments (no parentId) */}
              {!comment.parentId && (
                <button
                  onClick={() => onReply(comment.id)}
                  className="text-xs font-semibold text-gray-500 hover:text-blue-600 transition-colors"
                >
                  Reply
                </button>
              )}
            </div>

            {/* Reply Input - More responsive */}
            {replyingTo === comment.id && (
              <div className="mt-3 sm:mt-4 ml-3 sm:ml-4 lg:ml-5">
                <div className="flex items-start space-x-2 sm:space-x-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-blue-600 font-semibold text-xs sm:text-sm">
                      {currentUser?.email?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1">
                    <div className="relative">
                      <textarea
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Write a reply..."
                        className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-gray-50 border-0 rounded-xl sm:rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white resize-none text-gray-900 text-sm sm:text-base"
                        rows={2}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            onSubmitReply(comment.id);
                          }
                          if (e.key === "Escape") {
                            onCancelReply();
                          }
                        }}
                        autoFocus
                      />
                      <div className="flex justify-end space-x-2 sm:space-x-3 mt-2 sm:mt-3">
                        <button
                          onClick={onCancelReply}
                          className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm text-gray-500 hover:text-gray-700 font-medium"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => onSubmitReply(comment.id)}
                          disabled={!replyText.trim()}
                          className="px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-600 text-white text-xs sm:text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                        >
                          Reply
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Replies - More responsive */}
            {comment.replies && comment.replies.length > 0 && (
              <div className="mt-3 sm:mt-4 ml-3 sm:ml-4 lg:ml-5 pl-3 sm:pl-4 border-l-2 border-gray-100 space-y-3 sm:space-y-4">
                {comment.replies.map((reply) => (
                  <div key={reply.id} className="bg-gray-50 rounded-xl sm:rounded-2xl p-3 sm:p-4">
                    <div className="flex items-start space-x-2 sm:space-x-3">
                      <div className="w-7 h-7 sm:w-8 sm:h-8 lg:w-10 lg:h-10 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-gray-600 font-semibold text-xs sm:text-sm">
                          {reply.username.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <h5 className="font-semibold text-gray-900 text-xs sm:text-sm">
                            {reply.username}
                          </h5>
                          <span className="text-xs text-gray-500">
                            {formatTimeAgo(
                              reply.createdAt?.toDate?.() || new Date()
                            )}
                          </span>
                        </div>
                        <p className="text-gray-700 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap">
                          {reply.text}
                        </p>
                        <div className="flex items-center space-x-3 sm:space-x-4 mt-1 sm:mt-2">
                          {/* Happy Face for Reply - More responsive */}
                          <button
                            onClick={() => onReaction(reply.id, 'like')}
                            className={`flex items-center space-x-1 px-1.5 sm:px-2 py-1 rounded-lg transition-all duration-200 ${
                              (reply.reactions?.like?.includes(currentUser?.uid)) 
                                ? 'bg-green-50 hover:bg-green-100' 
                                : 'hover:bg-green-50'
                            }`}
                          >
                            <FaceSmileIcon className={`h-3 w-3 ${
                              (reply.reactions?.like?.includes(currentUser?.uid)) ? 'text-green-600' : 'text-gray-400'
                            }`} />
                            <span className="text-xs font-medium text-gray-600">
                              {(reply.reactions?.like?.length || 0)}
                            </span>
                          </button>

                          {/* Frown Face for Reply - More responsive */}
                          <button
                            onClick={() => onReaction(reply.id, 'sad')}
                            className={`flex items-center space-x-1 px-1.5 sm:px-2 py-1 rounded-lg transition-all duration-200 ${
                              (reply.reactions?.sad?.includes(currentUser?.uid)) 
                                ? 'bg-red-50 hover:bg-red-100' 
                                : 'hover:bg-red-50'
                            }`}
                          >
                            <FaceFrownIcon className={`h-3 w-3 ${
                              (reply.reactions?.sad?.includes(currentUser?.uid)) ? 'text-red-600' : 'text-gray-400'
                            }`} />
                            <span className="text-xs font-medium text-gray-600">
                              {(reply.reactions?.sad?.length || 0)}
                            </span>
                          </button>
                          
                          {/* No Reply button for replies - only one level deep */}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
