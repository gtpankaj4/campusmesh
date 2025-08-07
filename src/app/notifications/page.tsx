"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth, realtimeDb } from '@/lib/firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { ref, onValue, off, set, remove } from 'firebase/database';
import { BellIcon, CheckIcon, XMarkIcon, UserGroupIcon, ChatBubbleLeftIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { ArrowLeftIcon } from '@heroicons/react/24/solid';
import Navbar from '@/components/Navbar';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

interface Notification {
  id: string;
  type: 'join_request' | 'message' | 'system' | 'community_update';
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  userId?: string;
  communityId?: string;
  communityName?: string;
  senderName?: string;
  actionUrl?: string;
}

export default function NotificationsPage() {
  const [user] = useAuthState(auth);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread' | 'join_requests' | 'messages'>('all');
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

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
      } else {
        setNotifications([]);
      }
      setLoading(false);
    });

    return () => off(notificationsRef, 'value', unsubscribe);
  }, [user, router]);

  const markAsRead = async (notificationId: string) => {
    if (!user) return;
    
    try {
      const notificationRef = ref(realtimeDb, `notifications/${user.uid}/${notificationId}/read`);
      await set(notificationRef, true);
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;

    try {
      const updates: { [key: string]: boolean } = {};
      notifications.forEach(notification => {
        if (!notification.read) {
          updates[`notifications/${user.uid}/${notification.id}/read`] = true;
        }
      });

      if (Object.keys(updates).length > 0) {
        await Promise.all(
          Object.entries(updates).map(([path, value]) => 
            set(ref(realtimeDb, path), value)
          )
        );
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
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
    
    if (notification.actionUrl) {
      router.push(notification.actionUrl);
    } else if (notification.type === 'join_request' && notification.communityId) {
      router.push(`/community/${notification.communityId}/requests`);
    } else if (notification.type === 'message') {
      router.push('/chat');
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'join_request':
        return <UserGroupIcon className="h-5 w-5 text-blue-600" />;
      case 'message':
        return <ChatBubbleLeftIcon className="h-5 w-5 text-green-600" />;
      case 'system':
        return <ExclamationTriangleIcon className="h-5 w-5 text-orange-600" />;
      case 'community_update':
        return <BellIcon className="h-5 w-5 text-purple-600" />;
      default:
        return <BellIcon className="h-5 w-5 text-gray-600" />;
    }
  };

  const getNotificationBgColor = (type: string, read: boolean) => {
    const opacity = read ? '50' : '100';
    switch (type) {
      case 'join_request':
        return `bg-blue-${opacity} border-blue-200`;
      case 'message':
        return `bg-green-${opacity} border-green-200`;
      case 'system':
        return `bg-orange-${opacity} border-orange-200`;
      case 'community_update':
        return `bg-purple-${opacity} border-purple-200`;
      default:
        return `bg-gray-${opacity} border-gray-200`;
    }
  };

  const filteredNotifications = notifications.filter(notification => {
    switch (filter) {
      case 'unread':
        return !notification.read;
      case 'join_requests':
        return notification.type === 'join_request';
      case 'messages':
        return notification.type === 'message';
      default:
        return true;
    }
  });

  const unreadCount = notifications.filter(n => !n.read).length;

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

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <div className="max-w-4xl mx-auto px-6 py-8 pt-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.back()}
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeftIcon className="h-5 w-5" />
              <span>Back</span>
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Notifications</h1>
              {unreadCount > 0 && (
                <p className="text-gray-600 mt-1">
                  {unreadCount} unread notification{unreadCount > 1 ? 's' : ''}
                </p>
              )}
            </div>
          </div>
          
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <CheckIcon className="h-4 w-4" />
              <span>Mark all read</span>
            </button>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="bg-white rounded-xl shadow-sm border mb-6">
          <div className="flex">
            {[
              { key: 'all', label: 'All', count: notifications.length },
              { key: 'unread', label: 'Unread', count: unreadCount },
              { key: 'join_requests', label: 'Join Requests', count: notifications.filter(n => n.type === 'join_request').length },
              { key: 'messages', label: 'Messages', count: notifications.filter(n => n.type === 'message').length }
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key as any)}
                className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  filter === tab.key
                    ? 'border-blue-500 text-blue-600 bg-blue-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span className={`ml-2 px-2 py-1 text-xs rounded-full ${
                    filter === tab.key ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Notifications List */}
        <div className="space-y-3">
          {filteredNotifications.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
              <BellIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No notifications</h3>
              <p className="text-gray-500">
                {filter === 'unread' ? "You're all caught up!" : "You don't have any notifications yet."}
              </p>
            </div>
          ) : (
            filteredNotifications.map((notification) => (
              <div
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                className={`bg-white rounded-xl shadow-sm border p-4 cursor-pointer hover:shadow-md transition-all duration-200 ${
                  !notification.read ? 'ring-2 ring-blue-100' : ''
                } hover:scale-[1.01]`}
              >
                <div className="flex items-start space-x-4">
                  <div className={`p-3 rounded-full ${getNotificationBgColor(notification.type, notification.read)}`}>
                    {getNotificationIcon(notification.type)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h3 className={`text-sm font-medium ${
                          notification.read ? 'text-gray-700' : 'text-gray-900'
                        }`}>
                          {notification.title}
                        </h3>
                        <p className={`text-sm mt-1 ${
                          notification.read ? 'text-gray-500' : 'text-gray-700'
                        }`}>
                          {notification.message}
                        </p>
                        {notification.communityName && (
                          <p className="text-xs text-blue-600 mt-1 font-medium">
                            {notification.communityName}
                          </p>
                        )}
                      </div>
                      
                      <div className="flex items-center space-x-2 ml-4">
                        <span className="text-xs text-gray-400 whitespace-nowrap">
                          {dayjs(notification.timestamp).fromNow()}
                        </span>
                        {!notification.read && (
                          <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNotification(notification.id);
                          }}
                          className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                        >
                          <XMarkIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}