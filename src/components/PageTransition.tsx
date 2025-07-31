"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

interface PageTransitionProps {
  children: React.ReactNode;
}

export default function PageTransition({ children }: PageTransitionProps) {
  const pathname = usePathname();
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    setIsTransitioning(true);
    
    // Shorter delay for smoother feel
    const timer = setTimeout(() => {
      setIsTransitioning(false);
    }, 100);

    return () => clearTimeout(timer);
  }, [pathname]);

  return (
    <div
      className={`transition-all duration-500 ease-out ${
        isTransitioning 
          ? 'opacity-90 translate-y-1 scale-[0.995]' 
          : 'opacity-100 translate-y-0 scale-100'
      }`}
    >
      {children}
    </div>
  );
} 