"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { UserGroupIcon, ShieldCheckIcon, StarIcon, MagnifyingGlassIcon, PlusIcon, CogIcon } from "@heroicons/react/24/outline";
import Navbar from "@/components/Navbar";

interface Community {
  id: string;
  name: string;
  description: string;
  memberCount: number;
  isPrivate: boolean;
  members: { [key: string]: boolean };
  moderators?: { [key: string]: boolean };
  createdAt?: any;
}

interface UserCommunity {
  communityId: string;
  communityName: string;
  role: 'member' | 'moderator' | 'admin';
  joinedAt: any;
}

export default function CommunityPage() {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<{ username?: string; reputation?: number } | null>(null);
  const [moderatedCommunities, setModeratedCommunities] = useState<Community[]>([]);
  const [joinedCommunities, setJoinedCommunities] = useState<Community[]>([]);
  const [recommendedCommunities, setRecommendedCommunities] = useState<Community[]>([]);
  const [allCommunities, setAllCommunities] = useState<Community[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredCommunities, setFilteredCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUser(user);
        await loadUserProfile(user.uid);
        await loadUserCommunities(user.uid);
        await loadRecommendedCommunities(user.uid);
      } else {
        router.push("/login");
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  const loadUserProfile = async (userId: string) => {
    try {
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        setUserProfile(userSnap.data());
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  };

  const loadUserCommunities = async (userId: string) => {
    try {
      // Get user's communities from their subcollection
      const userCommunitiesRef = collection(db, 'users', userId, 'communities');
      const userCommunitiesSnap = await getDocs(userCommunitiesRef);
      
      const userCommunityData: UserCommunity[] = userCommunitiesSnap.docs.map(doc => ({
        ...doc.data() as UserCommunity
      }));

      // Load full community details
      const moderated: Community[] = [];
      const joined: Community[] = [];

      for (const userCommunity of userCommunityData) {
        try {
          const communityRef = doc(db, 'communities', userCommunity.communityId);
          const communitySnap = await getDoc(communityRef);
          
          if (communitySnap.exists()) {
            const community: Community = {
              id: communitySnap.id,
              ...communitySnap.data() as Omit<Community, 'id'>
            };

            if (userCommunity.role === 'moderator' || userCommunity.role === 'admin') {
              moderated.push(community);
            } else {
              joined.push(community);
            }
          }
        } catch (error) {
          console.error(`Error loading community ${userCommunity.communityId}:`, error);
        }
      }

      setModeratedCommunities(moderated);
      setJoinedCommunities(joined);
    } catch (error) {
      console.error('Error loading user communities:', error);
    }
  };

  const loadRecommendedCommunities = async (userId: string) => {
    try {
      // Get all communities
      const communitiesRef = collection(db, 'communities');
      const communitiesSnap = await getDocs(communitiesRef);
      
      // Get user's current communities
      const userCommunitiesRef = collection(db, 'users', userId, 'communities');
      const userCommunitiesSnap = await getDocs(userCommunitiesRef);
      const userCommunityIds = userCommunitiesSnap.docs.map(doc => doc.data().communityId);

      // Store all communities for search
      const allCommunitiesData: Community[] = [];
      const recommended: Community[] = [];
      
      communitiesSnap.docs.forEach(doc => {
        const community: Community = {
          id: doc.id,
          ...doc.data() as Omit<Community, 'id'>
        };
        
        allCommunitiesData.push(community);
        
        if (!userCommunityIds.includes(doc.id)) {
          // Show ALL unjoined communities (both public and private)
          recommended.push(community);
        }
      });

      setAllCommunities(allCommunitiesData);
      
      // Sort by member count (most popular first) - show all unjoined communities
      recommended.sort((a, b) => b.memberCount - a.memberCount);
      setRecommendedCommunities(recommended);
    } catch (error) {
      console.error('Error loading recommended communities:', error);
    }
  };

  // Search functionality
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredCommunities([]);
      return;
    }

    const filtered = allCommunities.filter(community =>
      community.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      community.description.toLowerCase().includes(searchQuery.toLowerCase())
    );
    
    setFilteredCommunities(filtered);
  }, [searchQuery, allCommunities]);

  const handleCommunityClick = (communityId: string) => {
    router.push(`/community/${communityId}`);
  };

  const CommunityCard = ({ community, showRole }: { community: Community; showRole?: string }) => (
    <div className="bg-white rounded-lg border border-gray-200 p-3 lg:p-4 hover:shadow-md hover:border-gray-300 transition-all group">
      <div className="flex items-start space-x-3">
        <div className="w-10 h-10 lg:w-12 lg:h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 group-hover:bg-blue-200 transition-colors">
          <UserGroupIcon className="h-5 w-5 lg:h-6 lg:w-6 text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between mb-1">
            <div className="flex items-center space-x-2 min-w-0 flex-1">
              <h3 
                onClick={() => handleCommunityClick(community.id)}
                className="font-semibold text-gray-900 truncate text-sm lg:text-base group-hover:text-blue-600 transition-colors cursor-pointer"
              >
                {community.name}
              </h3>
              {community.isPrivate && (
                <ShieldCheckIcon className="h-3 w-3 lg:h-4 lg:w-4 text-gray-400 flex-shrink-0" />
              )}
            </div>
            {showRole && (
              <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full flex-shrink-0 ml-2">
                {showRole}
              </span>
            )}
          </div>
          <p 
            onClick={() => handleCommunityClick(community.id)}
            className="text-xs lg:text-sm text-gray-600 line-clamp-2 mb-2 leading-relaxed cursor-pointer"
          >
            {community.description}
          </p>
          <div className="flex items-center justify-between">
            <div 
              onClick={() => handleCommunityClick(community.id)}
              className="flex items-center text-xs text-gray-500 space-x-2 cursor-pointer"
            >
              <span>{community.memberCount.toLocaleString()} members</span>
              <span>•</span>
              <span>{community.isPrivate ? 'Private' : 'Public'}</span>
            </div>
            {showRole === 'Moderator' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(`/community/${community.id}/moderate`);
                }}
                className="flex items-center space-x-1 px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs hover:bg-purple-200 transition-colors"
              >
                <CogIcon className="h-3 w-3" />
                <span>Moderate</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar userProfile={userProfile} />
      
      <div className="max-w-7xl mx-auto px-6 py-6 pt-8">
        {/* My Communities Section - Mobile Only */}
        <div className="mb-8 lg:hidden">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">My Communities</h2>
            <button
              onClick={() => router.push('/create-community')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg font-medium flex items-center space-x-2 transition-colors text-sm"
            >
              <PlusIcon className="h-4 w-4" />
              <span>Create</span>
            </button>
          </div>
          <div className="flex space-x-4 overflow-x-auto pb-4 scrollbar-hide">
            {[...moderatedCommunities, ...joinedCommunities].slice(0, 8).map((community) => (
              <div
                key={community.id}
                onClick={() => handleCommunityClick(community.id)}
                className="flex-shrink-0 text-center cursor-pointer group"
              >
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-2 group-hover:bg-blue-200 transition-colors">
                  <span className="text-xl font-bold text-blue-600">
                    {community.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <p className="text-xs text-gray-700 max-w-[80px] truncate">
                  {community.name}
                </p>
              </div>
            ))}
            {[...moderatedCommunities, ...joinedCommunities].length === 0 && (
              <div className="flex-shrink-0 text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-2">
                  <UserGroupIcon className="h-8 w-8 text-gray-400" />
                </div>
                <p className="text-xs text-gray-500 max-w-[80px]">No communities</p>
              </div>
            )}
          </div>
        </div>

        {/* Search Section */}
        <div className="mb-8">
          <div className="flex items-center space-x-4">
            <div className="relative flex-1">
              <MagnifyingGlassIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search for communities, classes, or topics"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-500"
              />
            </div>
            {/* Create Button for Desktop */}
            <button
              onClick={() => router.push('/create-community')}
              className="hidden lg:flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-xl font-medium transition-colors flex-shrink-0"
            >
              <PlusIcon className="h-5 w-5" />
              <span>Create Mesh</span>
            </button>
          </div>
          
          {/* Search Results */}
          {searchQuery && (
            <div className="mt-4 bg-white rounded-lg border border-gray-200 max-h-96 overflow-y-auto">
              {filteredCommunities.length === 0 ? (
                <div className="p-6 text-center">
                  <MagnifyingGlassIcon className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500">No communities found for "{searchQuery}"</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {filteredCommunities.map((community) => (
                    <div
                      key={community.id}
                      onClick={() => handleCommunityClick(community.id)}
                      className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-sm font-bold text-blue-600">
                            {community.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <h3 className="font-medium text-gray-900 truncate">{community.name}</h3>
                            {community.isPrivate && (
                              <ShieldCheckIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                            )}
                          </div>
                          <p className="text-sm text-gray-600 line-clamp-1">{community.description}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {community.memberCount.toLocaleString()} members • {community.isPrivate ? 'Private' : 'Public'}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Communities Grid - Only show when not searching */}
        {!searchQuery && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {/* Communities You Moderate */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <ShieldCheckIcon className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg lg:text-xl font-semibold text-gray-900">You Moderate</h2>
              <span className="bg-gray-100 text-gray-600 text-sm px-2 py-1 rounded-full">
                {moderatedCommunities.length}
              </span>
            </div>
            
            <div className="space-y-3 max-h-96 lg:max-h-none overflow-y-auto lg:overflow-visible">
              {moderatedCommunities.length === 0 ? (
                <div className="bg-white rounded-lg border border-gray-200 p-4 lg:p-6 text-center">
                  <ShieldCheckIcon className="h-6 lg:h-8 w-6 lg:w-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">You don't moderate any communities yet</p>
                </div>
              ) : (
                moderatedCommunities.map((community) => (
                  <CommunityCard 
                    key={community.id} 
                    community={community} 
                    showRole="Moderator"
                  />
                ))
              )}
            </div>
          </div>

          {/* Communities You're Part Of */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <UserGroupIcon className="h-5 w-5 text-green-600" />
              <h2 className="text-lg lg:text-xl font-semibold text-gray-900">Your Communities</h2>
              <span className="bg-gray-100 text-gray-600 text-sm px-2 py-1 rounded-full">
                {joinedCommunities.length}
              </span>
            </div>
            
            <div className="space-y-3 max-h-96 lg:max-h-none overflow-y-auto lg:overflow-visible">
              {joinedCommunities.length === 0 ? (
                <div className="bg-white rounded-lg border border-gray-200 p-4 lg:p-6 text-center">
                  <UserGroupIcon className="h-6 lg:h-8 w-6 lg:w-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">You haven't joined any communities yet</p>
                  <button
                    onClick={() => document.getElementById('recommendations')?.scrollIntoView({ behavior: 'smooth' })}
                    className="text-blue-600 hover:text-blue-700 text-sm mt-2 block"
                  >
                    Browse recommendations →
                  </button>
                </div>
              ) : (
                joinedCommunities.map((community) => (
                  <CommunityCard 
                    key={community.id} 
                    community={community}
                  />
                ))
              )}
            </div>
          </div>

          {/* Recommended Communities */}
          <div className="space-y-4 md:col-span-2 lg:col-span-1" id="recommendations">
            <div className="flex items-center space-x-2">
              <StarIcon className="h-5 w-5 text-yellow-600" />
              <h2 className="text-lg lg:text-xl font-semibold text-gray-900">Recommendations</h2>
            </div>
            
            <div className="space-y-3 max-h-96 lg:max-h-none overflow-y-auto lg:overflow-visible">
              {recommendedCommunities.length === 0 ? (
                <div className="bg-white rounded-lg border border-gray-200 p-4 lg:p-6 text-center">
                  <StarIcon className="h-6 lg:h-8 w-6 lg:w-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">No recommendations available</p>
                </div>
              ) : (
                recommendedCommunities.map((community) => (
                  <CommunityCard 
                    key={community.id} 
                    community={community}
                  />
                ))
              )}
            </div>
          </div>
          </div>
        )}
      </div>


    </div>
  );
}