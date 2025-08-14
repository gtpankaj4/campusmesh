"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { ArrowLeftIcon, UserGroupIcon } from "@heroicons/react/24/outline";
import Navbar from "@/components/Navbar";
import { validateUsername, validateMeshName, checkUsernameAvailability, checkMeshNameAvailability } from "@/lib/usernameUtils";

export default function CreateCommunityPage() {
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    description: '',
    isPrivate: false
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{[key: string]: string}>({});
  const [checking, setChecking] = useState<{[key: string]: boolean}>({});
  const router = useRouter();

  const validateField = async (field: string, value: string) => {
    setChecking(prev => ({ ...prev, [field]: true }));
    setErrors(prev => ({ ...prev, [field]: '' }));

    if (field === 'name') {
      const nameValidation = validateMeshName(value);
      if (!nameValidation.isValid) {
        setErrors(prev => ({ ...prev, [field]: nameValidation.error! }));
        setChecking(prev => ({ ...prev, [field]: false }));
        return;
      }

      if (value.trim()) {
        const isAvailable = await checkMeshNameAvailability(value.trim());
        if (!isAvailable) {
          setErrors(prev => ({ ...prev, [field]: 'This mesh name is already taken' }));
        }
      }
    }

    if (field === 'username') {
      const usernameValidation = validateUsername(value);
      if (!usernameValidation.isValid) {
        setErrors(prev => ({ ...prev, [field]: usernameValidation.error! }));
        setChecking(prev => ({ ...prev, [field]: false }));
        return;
      }

      if (value.trim()) {
        const isAvailable = await checkUsernameAvailability(value.trim());
        if (!isAvailable) {
          setErrors(prev => ({ ...prev, [field]: 'This username is already taken' }));
        }
      }
    }

    setChecking(prev => ({ ...prev, [field]: false }));
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Auto-generate username from name if username is empty
    if (field === 'name' && !formData.username) {
      const autoUsername = value.toLowerCase().replace(/[^a-zA-Z0-9]/g, '').slice(0, 20);
      setFormData(prev => ({ ...prev, username: autoUsername }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !formData.name.trim() || !formData.username.trim() || !formData.description.trim()) return;

    // Final validation
    const nameValidation = validateMeshName(formData.name);
    const usernameValidation = validateUsername(formData.username);
    
    if (!nameValidation.isValid || !usernameValidation.isValid) {
      setErrors({
        name: nameValidation.error || '',
        username: usernameValidation.error || ''
      });
      return;
    }

    setLoading(true);
    try {
      // Check availability one more time
      const [nameAvailable, usernameAvailable] = await Promise.all([
        checkMeshNameAvailability(formData.name.trim()),
        checkUsernameAvailability(formData.username.trim())
      ]);

      if (!nameAvailable) {
        setErrors(prev => ({ ...prev, name: 'This mesh name is already taken' }));
        setLoading(false);
        return;
      }

      if (!usernameAvailable) {
        setErrors(prev => ({ ...prev, username: 'This username is already taken' }));
        setLoading(false);
        return;
      }

      const communityRef = await addDoc(collection(db, 'communities'), {
        name: formData.name.trim(),
        username: formData.username.trim(),
        description: formData.description.trim(),
        isPrivate: formData.isPrivate,
        memberCount: 1,
        members: {
          [auth.currentUser.uid]: {
            joinedAt: serverTimestamp(),
            role: 'admin'
          }
        },
        moderators: {
          [auth.currentUser.uid]: true
        },
        createdAt: serverTimestamp(),
        creatorId: auth.currentUser.uid,
        submesses: [
          {
            id: 'general',
            name: 'General',
            description: 'General discussion'
          }
        ],
        // Add default enrollment questions for private communities
        enrollmentQuestions: formData.isPrivate ? [
          {
            id: 'default-1',
            question: 'Why do you want to join this community?',
            type: 'text',
            required: true
          },
          {
            id: 'default-2', 
            question: 'How did you hear about this community?',
            type: 'text',
            required: false
          }
        ] : []
      });

      // Add community to user's communities
      const userCommunitiesRef = collection(db, 'users', auth.currentUser.uid, 'communities');
      await addDoc(userCommunitiesRef, {
        communityId: communityRef.id,
        communityName: formData.name.trim(),
        role: 'admin',
        joinedAt: serverTimestamp()
      });

      router.push(`/community/${communityRef.id}`);
    } catch (error) {
      console.error('Error creating community:', error);
      alert('Error creating community. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <div className="max-w-2xl mx-auto px-4 py-6 pt-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeftIcon className="h-5 w-5 mr-2" />
            Back
          </button>
          
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <UserGroupIcon className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Create New Mesh</h1>
              <p className="text-gray-600">Build your community space</p>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Mesh Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                onBlur={(e) => validateField('name', e.target.value)}
                className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 ${
                  errors.name ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="Enter mesh name (display name)"
                required
                maxLength={50}
              />
              <div className="flex justify-between items-center mt-1">
                <p className="text-xs text-gray-500">{formData.name.length}/50 characters</p>
                {checking.name && <span className="text-xs text-blue-500">Checking...</span>}
              </div>
              {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Username *
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500">@</span>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => handleInputChange('username', e.target.value)}
                  onBlur={(e) => validateField('username', e.target.value)}
                  className={`w-full pl-8 pr-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 ${
                    errors.username ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="meshusername"
                  required
                  maxLength={20}
                />
              </div>
              <div className="flex justify-between items-center mt-1">
                <p className="text-xs text-gray-500">{formData.username.length}/20 characters</p>
                {checking.username && <span className="text-xs text-blue-500">Checking...</span>}
              </div>
              {errors.username && <p className="text-xs text-red-500 mt-1">{errors.username}</p>}
              <p className="text-xs text-gray-500 mt-1">
                This will be your mesh's unique identifier (e.g., @{formData.username || 'meshusername'})
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description *
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                placeholder="Describe your community"
                rows={4}
                required
                maxLength={200}
              />
              <p className="text-xs text-gray-500 mt-1">{formData.description.length}/200 characters</p>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="isPrivate"
                checked={formData.isPrivate}
                onChange={(e) => setFormData({ ...formData, isPrivate: e.target.checked })}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="isPrivate" className="ml-3 block text-sm text-gray-700">
                Make this a private mesh
                <p className="text-xs text-gray-500 mt-1">
                  Private meshes require approval to join
                </p>
              </label>
            </div>

            <div className="flex space-x-4 pt-4">
              <button
                type="button"
                onClick={() => router.back()}
                className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !formData.name.trim() || !formData.username.trim() || !formData.description.trim() || Object.values(errors).some(error => error) || Object.values(checking).some(check => check)}
                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {loading ? 'Creating...' : 'Create Mesh'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}