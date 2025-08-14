"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { XMarkIcon, MagnifyingGlassIcon, UserGroupIcon, ShieldCheckIcon, CogIcon } from "@heroicons/react/24/outline";

interface Community {
  id: string;
  name: string;
  username: string;
  description: string;
  memberCount: number;
  isPrivate: boolean;
  members: { [key: string]: boolean };
  moderators?: { [key: string]: boolean };
  createdAt?: any;
}

interface MeshDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  meshes: Community[];
  showRole?: string;
  onModerate?: (communityId: string) => void;
}

export default function MeshDialog({ isOpen, onClose, title, meshes, showRole, onModerate }: MeshDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredMeshes, setFilteredMeshes] = useState<Community[]>(meshes);
  const router = useRouter();

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredMeshes(meshes);
      return;
    }

    const filtered = meshes.filter(
      (mesh) =>
        mesh.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        mesh.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        mesh.description.toLowerCase().includes(searchQuery.toLowerCase())
    );

    setFilteredMeshes(filtered);
  }, [searchQuery, meshes]);

  const handleMeshClick = (meshId: string) => {
    router.push(`/community/${meshId}`);
    onClose();
  };

  const handleModerateClick = (e: React.MouseEvent, meshId: string) => {
    e.stopPropagation();
    if (onModerate) {
      onModerate(meshId);
    } else {
      router.push(`/community/${meshId}/moderate`);
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white/95 backdrop-blur-md rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl border border-white/30">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200/50">
          <h2 className="text-xl font-bold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100/50 rounded-full transition-colors"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-4 border-b border-gray-200/50">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search meshes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50/80 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-500"
            />
          </div>
        </div>

        {/* Mesh List */}
        <div className="flex-1 overflow-y-auto p-4">
          {filteredMeshes.length === 0 ? (
            <div className="text-center py-8">
              <UserGroupIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">
                {searchQuery ? `No meshes found for "${searchQuery}"` : "No meshes available"}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredMeshes.map((mesh) => (
                <div
                  key={mesh.id}
                  onClick={() => handleMeshClick(mesh.id)}
                  className="bg-white/60 backdrop-blur-sm rounded-lg border border-gray-200/50 p-4 hover:shadow-md hover:border-gray-300/50 transition-all group cursor-pointer"
                >
                  <div className="flex items-start space-x-3">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 group-hover:bg-blue-200 transition-colors">
                      <UserGroupIcon className="h-6 w-6 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between mb-1">
                        <div className="flex flex-col min-w-0 flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <h3 className="font-semibold text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                              {mesh.name}
                            </h3>
                            {mesh.isPrivate && (
                              <ShieldCheckIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                            )}
                          </div>
                          <p className="text-sm text-gray-500 mb-1">@{mesh.username}</p>
                        </div>
                        {showRole && (
                          <div className="flex items-center space-x-2 ml-2">
                            <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full flex-shrink-0">
                              {showRole}
                            </span>
                            {showRole === "Moderator" && (
                              <button
                                onClick={(e) => handleModerateClick(e, mesh.id)}
                                className="flex items-center space-x-1 px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs hover:bg-purple-200 transition-colors"
                              >
                                <CogIcon className="h-3 w-3" />
                                <span>Moderate</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 line-clamp-2 mb-2 leading-relaxed">
                        {mesh.description}
                      </p>
                      <div className="flex items-center text-xs text-gray-500 space-x-2">
                        <span>{mesh.memberCount.toLocaleString()} members</span>
                        <span>•</span>
                        <span>{mesh.isPrivate ? "Private" : "Public"}</span>
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
  );
}