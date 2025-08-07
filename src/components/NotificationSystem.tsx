'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, realtimeDb, db } from '@/lib/firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { ref, onValue, off, set, remove } from 'firebase/database';
import { doc, getDoc } from 'firebase/firestore';
import { BellIcon, XMarkIcon } from '@heroicons/react/24/outline';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

interface Notification {
  id: string;
  type: 'message' | 'post' | 'comment' | 'mention' | 'join_request';
  title: string;
  message: string;
  fromUserId?: string;
  fromUserName?: string;
  timestamp: number;
  read: boolean;
  data?: {
    chatId?: string;
    postId?: string;
    commentId?: string;
    communityId?: string;
    communityName?: string;
  };
}

export default function NotificationSystem() {
  const [user] = useAuthState(auth);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const router = useRouter();

  useEffect(() => {
    if (!user) return;

    const notificationsRef = ref(realtimeDb, `notifications/${user.uid}`);
    const unsubscribe = onValue(notificationsRef, (snapshot) => {
      const notificationsData = snapshot.val();
      if (notificationsData) {
        const notificationArray: Notification[] = Object.keys(notificationsData)
          .map(key => ({
            id: key,
            ...notificationsData[key]
          }))
          .sort((a, b) => b.timestamp - a.timestamp);
        
        setNotifications(notificationArray);
        setUnreadCount(notificationArray.filter(n => !n.read).length);
      } else {
        setNotifications([]);
        setUnreadCount(0);
      }
    });

    return () => off(notificationsRef, 'value', unsubscribe);
  }, [user]);

  const markAsRead = async (notificationId: string) => {
    if (!user) return;
    
    try {
      const notificationRef = ref(realtimeDb, `notifications/${user.uid}/${notificationId}/read`);
      await set(notificationRef, true);
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const deleteNotification = async (notificationId: string) => {
    if (!user) return;
    
    try {
      const notificationRef = ref(realtimeDb, `notifications/${user.uid}/${notificationId}`);
      await remove(notificationRef);
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    markAsRead(notification.id);
    
    // Navigate based on notification type
    if (notification.type === 'message' && notification.data?.chatId) {
      window.location.href = `/chat/${notification.data.chatId}`;
    } else if (notification.type === 'post' && notification.data?.communityId) {
      window.location.href = `/dashboard`;
    } else if (notification.type === 'join_request' && notification.data?.communityId) {
      // Redirect to moderation panel with requests tab
      window.location.href = `/community/${notification.data.communityId}/moderate?tab=requests`;
    }
    
    setShowNotifications(false);
  };

  const markAllAsRead = async () => {
    if (!user) return;
    
    const unreadNotifications = notifications.filter(n => !n.read);
    const promises = unreadNotifications.map(n => markAsRead(n.id));
    
    try {
      await Promise.all(promises);
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  if (!user) return null;

  return (
    <div className="relative">
      {/* Notification Bell */}
      <button
        onClick={() => router.push('/notifications')}
        className="relative p-2 text-gray-600 hover:text-gray-800 transition-colors rounded-lg hover:bg-gray-100"
        title="View all notifications"
      >
        <BellIcon className="w-6 h-6" />
        {unreadCount > 0 && (
          <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center animate-pulse ring-2 ring-red-200">
            <span className="text-white text-xs font-bold">{unreadCount > 9 ? '9+' : unreadCount}</span>
          </div>
        )}
      </button>

      {/* Notification Dropdown */}
      {showNotifications && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 max-w-[calc(100vw-2rem)] bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-96 overflow-hidden">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="font-semibold text-gray-800">Notifications</h3>
            <div className="flex space-x-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setShowNotifications(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                No notifications yet
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors ${
                    !notification.read ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <div className={`w-2 h-2 rounded-full ${
                          notification.type === 'message' ? 'bg-green-500' :
                          notification.type === 'post' ? 'bg-blue-500' :
                          notification.type === 'comment' ? 'bg-yellow-500' :
                          'bg-purple-500'
                        }`} />
                        <h4 className="font-medium text-sm text-gray-800">
                          {notification.title}
                        </h4>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        {notification.message}
                      </p>
                      <p className="text-xs text-gray-400 mt-2">
                        {dayjs(notification.timestamp).fromNow()}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNotification(notification.id);
                      }}
                      className="text-gray-400 hover:text-gray-600 ml-2"
                    >
                      <XMarkIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Additional notification function for join requests
export const createJoinRequestNotification = async (
  moderatorId: string,
  requesterId: string,
  requesterName: string,
  communityName: string
) => {
  await createNotification(moderatorId, {
    type: 'join_request',
    title: 'Community Join Request',
    message: `${requesterName} requested to join ${communityName}`,
    fromUserId: requesterId,
    fromUserName: requesterName,
    read: false,
    data: { communityName }
  });
};

// Utility functions to create notifications
export const createNotification = async (
  userId: string,
  notification: Omit<Notification, 'id' | 'timestamp'>
) => {
  try {
    const notificationsRef = ref(realtimeDb, `notifications/${userId}`);
    const newNotificationRef = ref(realtimeDb, `notifications/${userId}/${Date.now()}`);
    
    await set(newNotificationRef, {
      ...notification,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('Error creating notification:', error);
  }
};

export const createMessageNotification = async (
  receiverId: string,
  senderId: string,
  senderName: string,
  chatId: string
) => {
  if (receiverId === senderId) return; // Don't notify self
  
  try {
    // Always create notification for proper unread tracking, but check if user is viewing chat
    const isViewingChat = typeof window !== 'undefined' && window.location.pathname === `/chat/${chatId}`;
    
    await createNotification(receiverId, {
      type: 'message',
      title: '💬 New Message',
      message: `${senderName} sent you a message!`,
      fromUserId: senderId,
      fromUserName: senderName,
      read: isViewingChat, // Mark as read if user is viewing the chat
      data: { chatId }
    });
    
    console.log(`📬 Message notification created for user ${receiverId} (read: ${isViewingChat})`);
  } catch (error) {
    console.error('Error creating message notification:', error);
    throw error; // Re-throw to allow caller to handle
  }
};

export const createPostNotification = async (
  userIds: string[],
  postCreatorId: string,
  postCreatorName: string,
  communityName: string,
  postTitle: string
) => {
  const promises = userIds
    .filter(uid => uid !== postCreatorId) // Don't notify the creator
    .map(userId => 
      createNotification(userId, {
        type: 'post',
        title: 'New Post',
        message: `${postCreatorName} posted "${postTitle}" in ${communityName}`,
        fromUserId: postCreatorId,
        fromUserName: postCreatorName,
        read: false,
        data: { communityName }
      })
    );
  
  await Promise.all(promises);
};

export const createCommentNotification = async (
  postOwnerId: string,
  commenterId: string,
  commenterName: string,
  postTitle: string
) => {
  if (postOwnerId === commenterId) return; // Don't notify self
  
  await createNotification(postOwnerId, {
    type: 'comment',
    title: 'New Comment',
    message: `${commenterName} commented on your post "${postTitle}"`,
    fromUserId: commenterId,
    fromUserName: commenterName,
    read: false
  });
};