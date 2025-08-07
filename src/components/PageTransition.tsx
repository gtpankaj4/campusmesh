"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

interface PageTransitionProps {
  children: React.ReactNode;
}

export default function PageTransition({ children }: PageTransitionProps) {
  const pathname = usePathname();
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Initial load animation
    setIsLoading(false);
  }, []);

  useEffect(() => {
    // Professional social media style page transitions
    setIsTransitioning(true);
    
    const timer = setTimeout(() => {
      setIsTransitioning(false);
    }, 200);

    return () => clearTimeout(timer);
  }, [pathname]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="relative">
            <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
            <div className="absolute inset-0 w-12 h-12 border-4 border-purple-200 border-b-purple-600 rounded-full animate-spin animate-reverse" style={{ animationDelay: '0.15s' }}></div>
          </div>
          <div className="text-gray-600 font-medium animate-pulse">Loading CampusMesh...</div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        isTransitioning 
          ? 'opacity-95 scale-[0.985] blur-[0.5px]' 
          : 'opacity-100 scale-100 blur-0'
      }`}
    >
      <div
        className={`transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isTransitioning 
            ? 'translate-y-3 opacity-90' 
            : 'translate-y-0 opacity-100'
        }`}
      >
        {children}
      </div>
    </div>
  );
} 