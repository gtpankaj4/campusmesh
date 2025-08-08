"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { UserIcon, ChevronDownIcon } from "@heroicons/react/24/outline";
import Image from "next/image";
import NotificationSystem from './NotificationSystem';
import { useUnreadMessages } from '@/hooks/useUnreadMessages';

interface NavbarProps {
  userProfile?: { username?: string; reputation?: number } | null;
}

export default function Navbar({ userProfile }: NavbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { totalUnread } = useUnreadMessages();
  const [showMobileProfile, setShowMobileProfile] = useState(false);
  const profileDropdownRef = useRef<HTMLDivElement>(null);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target as Node)) {
        setShowMobileProfile(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.push("/login");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const isActive = (path: string) => pathname === path;

  return (
    <>
      {/* Mobile Navbar */}
      <nav className="sticky top-2 left-20 right-20 z-50 lg:hidden">
        <div className="bg-white/90 backdrop-blur-md rounded-2xl shadow-lg border border-white/20">
                      <div className="flex justify-between items-center h-20 px-4">
            <div className="flex items-center justify-start -ml-2">
              <button 
                onClick={() => router.push('/dashboard')}
                className="hover:scale-105 transition-transform duration-200"
              >
                <Image
                  src="/image.svg"
                  alt="Campesh Logo"
                  width={320}
                  height={64}
                  className="h-14 sm:h-16 md:h-18 w-auto"
                  priority
                />
              </button>
            </div>
            <div className="flex items-center space-x-4">
              {/* Home Button */}
              <button
                onClick={() => router.push('/dashboard')}
                className={`transition-all duration-250 ease-out cursor-pointer hover:scale-[1.02] ${isActive('/dashboard') ? 'text-blue-600' : 'text-gray-700 hover:text-blue-600'}`}
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
                </svg>
              </button>
              
              {/* Chat Button */}
              <button
                onClick={() => router.push('/chat')}
                className={`relative transition-all duration-250 ease-out cursor-pointer hover:scale-[1.02] ${isActive('/chat') ? 'text-blue-600' : 'text-gray-700 hover:text-blue-600'}`}
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                {totalUnread > 0 && (
                  <div className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center animate-pulse ring-2 ring-red-200">
                    <span className="text-white text-xs font-bold">{totalUnread > 9 ? '9+' : totalUnread}</span>
                  </div>
                )}
              </button>
              
              {/* Communities Button */}
              <button
                onClick={() => router.push('/posts')}
                className={`transition-all duration-250 ease-out cursor-pointer hover:scale-[1.02] ${isActive('/posts') ? 'text-blue-600' : 'text-gray-700 hover:text-blue-600'}`}
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </button>
              
              {/* Notifications */}
              <NotificationSystem />
              
              {/* Profile Dropdown */}
              <div className="relative" ref={profileDropdownRef}>
                <button
                  onClick={() => setShowMobileProfile(!showMobileProfile)}
                  className={`flex items-center space-x-1 transition-all duration-250 ease-out cursor-pointer hover:scale-[1.02] ${isActive('/profile') ? 'text-blue-600' : 'text-gray-700 hover:text-blue-600'}`}
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <ChevronDownIcon className="h-3 w-3" />
                </button>
                
                {/* Dropdown Menu */}
                {showMobileProfile && (
                  <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                    <button
                      onClick={() => {
                        router.push('/profile');
                        setShowMobileProfile(false);
                      }}
                      className="w-full px-4 py-3 text-left text-gray-700 hover:bg-gray-50 flex items-center space-x-2 rounded-t-lg"
                    >
                      <UserIcon className="h-4 w-4" />
                      <span>Profile</span>
                    </button>
                    <button
                      onClick={() => {
                        handleSignOut();
                        setShowMobileProfile(false);
                      }}
                      className="w-full px-4 py-3 text-left text-red-600 hover:bg-red-50 flex items-center space-x-2 rounded-b-lg"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      <span>Logout</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Desktop Navbar */}
      <nav className="sticky top-2 z-50 hidden lg:block">
        <div className="max-w-7xl mx-auto px-6">
          <div className="bg-white/90 backdrop-blur-md rounded-2xl shadow-lg border border-white/20">
            <div className="flex justify-between items-center h-24 px-8">
              <div className="flex items-center justify-start">
                <button 
                  onClick={() => router.push('/dashboard')}
                  className="hover:scale-105 transition-transform duration-200"
                >
                  <Image
                    src="/image.svg"
                    alt="Campesh Logo"
                    width={280}
                    height={56}
                    className="h-12 w-auto"
                    priority
                  />
                </button>
              </div>
              <div className="flex items-center space-x-6">
                <button
                  onClick={() => router.push('/dashboard')}
                  className={`px-3 py-2 rounded-lg text-base font-semibold transition-all duration-250 ease-out flex items-center cursor-pointer hover:scale-[1.02] ${
                    isActive('/dashboard') ? 'text-blue-600' : 'text-gray-700 hover:text-blue-600'
                  }`}
                >
                  <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
                  </svg>
                  Home
                </button>
                <button
                  onClick={() => router.push('/chat')}
                  className={`px-3 py-2 rounded-lg text-base font-semibold transition-all duration-250 ease-out flex items-center cursor-pointer hover:scale-[1.02] relative ${
                    isActive('/chat') ? 'text-blue-600' : 'text-gray-700 hover:text-blue-600'
                  }`}
                >
                  <div className="relative mr-2">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    {totalUnread > 0 && (
                      <div className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center animate-pulse ring-2 ring-red-200">
                        <span className="text-white text-xs font-bold">{totalUnread > 9 ? '9+' : totalUnread}</span>
                      </div>
                    )}
                  </div>
                  Chat{totalUnread > 0 ? ` (${totalUnread})` : ''}
                </button>
                <button
                  onClick={() => router.push('/posts')}
                  className={`px-3 py-2 rounded-lg text-base font-semibold transition-all duration-250 ease-out flex items-center cursor-pointer hover:scale-[1.02] ${
                    isActive('/posts') ? 'text-blue-600' : 'text-gray-700 hover:text-blue-600'
                  }`}
                >
                  <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  Communities
                </button>
                <button
                  onClick={() => router.push('/profile')}
                  className={`px-3 py-2 rounded-lg text-base font-semibold transition-all duration-250 ease-out flex items-center cursor-pointer hover:scale-[1.02] ${
                    isActive('/profile') ? 'text-blue-600' : 'text-gray-700 hover:text-blue-600'
                  }`}
                >
                  <UserIcon className="h-5 w-5 mr-2" />
                  Profile
                </button>
                <NotificationSystem />
                <button
                  onClick={handleSignOut}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-base font-semibold transition-all duration-250 ease-out mr-2 cursor-pointer hover:scale-[1.02]"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>
    </>
  );
} 