"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc, collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import { ChatBubbleLeftIcon, ArrowLeftIcon } from "@heroicons/react/24/outline";
import RepBadge from "@/components/RepBadge";
import Comment from "@/components/Comment";
import Navbar from "@/components/Navbar";

interface Post {
  id: string;
  title: string;
  description: string;
  userId: string;
  userEmail: string;
  createdAt: any;
  communityId?: string;
  communityName?: string;
  submessId?: string;
  submessName?: string;
}

interface PostComment {
  id: string;
  text: string;
  userId: string;
  userEmail: string;
  username: string;
  timestamp: any;
  userRep: number;
}

export default function PostPage() {
  const params = useParams();
  const router = useRouter();
  const [user] = useAuthState(auth);
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [showCommentModal, setShowCommentModal] = useState(false);
  
  const postId = params.postId as string;

  useEffect(() => {
    if (!postId) return;

    const loadPost = async () => {
      try {
        const postRef = doc(db, 'posts', postId);
        const postSnap = await getDoc(postRef);
        
        if (postSnap.exists()) {
          setPost({ id: postSnap.id, ...postSnap.data() } as Post);
        } else {
          console.error('Post not found');
          router.push('/dashboard');
        }
      } catch (error) {
        console.error('Error loading post:', error);
        router.push('/dashboard');
      } finally {
        setLoading(false);
      }
    };

    loadPost();
  }, [postId, router]);

  useEffect(() => {
    if (!postId) return;

    // Load comments in real-time
    const commentsRef = collection(db, 'posts', postId, 'comments');
    const q = query(commentsRef, orderBy('timestamp', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const postComments: PostComment[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PostComment[];
      setComments(postComments);
    });

    return unsubscribe;
  }, [postId]);

  useEffect(() => {
    if (user) {
      const loadUserProfile = async () => {
        try {
          const userRef = doc(db, 'users', user.uid);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            setUserProfile(userSnap.data());
          }
        } catch (error) {
          console.error('Error loading user profile:', error);
        }
      };
      loadUserProfile();
    }
  }, [user]);

  const formatTimeAgo = (date: Date): string => {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar userProfile={userProfile} />
        <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar userProfile={userProfile} />
        <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Post not found</h1>
            <p className="text-gray-600 mb-4">The post you're looking for doesn't exist.</p>
            <button
              onClick={() => router.push('/dashboard')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar userProfile={userProfile} />
      
      <div className="max-w-7xl mx-auto px-6 py-8 pt-8">
        {/* Back Button */}
        <button
          onClick={() => router.back()}
          className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
        >
          <ArrowLeftIcon className="h-5 w-5" />
          <span>Back</span>
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Post Content */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-sm border p-8">
              {/* Post Header */}
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <span className="font-medium text-gray-900">
                    {post.userEmail?.split('@')[0] || 'Anonymous'}
                  </span>
                  <RepBadge score={0} size="sm" />
                  {post.communityName && (
                    <button
                      onClick={() => router.push(`/community/${post.communityId}`)}
                      className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full hover:bg-blue-200 transition-colors"
                    >
                      {post.communityName}
                    </button>
                  )}
                  {post.submessName && (
                    <span className="px-3 py-1 bg-green-100 text-green-800 text-sm rounded-full">
                      {post.submessName}
                    </span>
                  )}
                </div>
                <span className="text-sm text-gray-500">
                  {post.createdAt?.toDate ? 
                    formatTimeAgo(post.createdAt.toDate()) : 
                    'Just now'
                  }
                </span>
              </div>

              {/* Post Content */}
              <h1 className="text-3xl font-bold text-gray-900 mb-6">{post.title}</h1>
              <div className="prose prose-lg max-w-none">
                <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {post.description}
                </p>
              </div>

              {/* Post Actions */}
              <div className="flex items-center space-x-4 mt-8 pt-6 border-t">
                <button
                  onClick={() => setShowCommentModal(true)}
                  className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  <ChatBubbleLeftIcon className="h-5 w-5" />
                  <span>Comment ({comments.length})</span>
                </button>
                
                <button
                  onClick={() => {
                    if (user && post.userId) {
                      const chatId = [user.uid, post.userId].sort().join('_');
                      router.push(`/chat/${chatId}`);
                    }
                  }}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <ChatBubbleLeftIcon className="h-5 w-5" />
                  <span>Chat</span>
                </button>
              </div>
            </div>
          </div>

          {/* Comments Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm border">
              <div className="p-6 border-b">
                <h3 className="text-lg font-semibold text-gray-900">
                  Comments ({comments.length})
                </h3>
              </div>
              
              <div className="max-h-96 overflow-y-auto">
                {comments.length === 0 ? (
                  <div className="p-6 text-center">
                    <p className="text-gray-500">No comments yet.</p>
                    <p className="text-gray-400 text-sm mt-1">Be the first to comment!</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {comments.map((comment) => (
                      <div key={comment.id} className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <span className="font-medium text-sm text-gray-900">
                              {comment.username}
                            </span>
                            <RepBadge score={comment.userRep} size="sm" />
                          </div>
                          <span className="text-xs text-gray-400">
                            {comment.timestamp?.toDate ? 
                              formatTimeAgo(comment.timestamp.toDate()) :
                              'Just now'
                            }
                          </span>
                        </div>
                        <p className="text-sm text-gray-700">{comment.text}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {user && (
                <div className="p-4 border-t">
                  <button
                    onClick={() => setShowCommentModal(true)}
                    className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                  >
                    Add Comment
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Comment Modal */}
      {showCommentModal && post && (
        <Comment
          postId={post.id}
          postUserId={post.userId}
          onClose={() => setShowCommentModal(false)}
        />
      )}
    </div>
  );
}