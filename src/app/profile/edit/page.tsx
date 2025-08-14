"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { ArrowLeftIcon, UserIcon } from "@heroicons/react/24/outline";
import Navbar from "@/components/Navbar";
import Toast from "@/components/Toast";
import { validateUsername, checkUsernameAvailability } from "@/lib/usernameUtils";

const COVER_COLORS = [
  "#3B82F6", // Blue
  "#EF4444", // Red
  "#10B981", // Green
  "#F59E0B", // Yellow
  "#8B5CF6", // Purple
  "#EC4899", // Pink
  "#06B6D4", // Cyan
  "#84CC16", // Lime
  "#F97316", // Orange
  "#6366F1", // Indigo
];

interface UserProfile {
  username?: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  email: string;
  university?: string;
  bio?: string;
  coverColor?: string;
  showPostsToPublic?: boolean;
  showEmailToPublic?: boolean;
  reputation: number;
  postsCount: number;
  commentsCount: number;
  communitiesCount: number;
  joinDate: any;
}

export default function EditProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    username: '',
    university: '',
    bio: '',
    coverColor: '#3B82F6',
    showPostsToPublic: true,
    showEmailToPublic: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{[key: string]: string}>({});
  const [checking, setChecking] = useState<{[key: string]: boolean}>({});
  const [toast, setToast] = useState({ show: false, message: "", type: "error" as "success" | "error" });
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUser(user);
        await loadUserProfile(user.uid);
      } else {
        router.push("/login");
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  const loadUserProfile = async (userId: string) => {
    try {
      const userRef = doc(db, "users", userId);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        const userData = userSnap.data() as UserProfile;
        setProfile(userData);
        setFormData({
          firstName: userData.firstName || '',
          lastName: userData.lastName || '',
          username: userData.username || '',
          university: userData.university || '',
          bio: userData.bio || '',
          coverColor: userData.coverColor || '#3B82F6',
          showPostsToPublic: userData.showPostsToPublic ?? true,
          showEmailToPublic: userData.showEmailToPublic ?? false,
        });
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  };

  const showToast = (message: string, type: "success" | "error" = "error") => {
    setToast({ show: true, message, type });
  };

  const hideToast = () => {
    setToast(prev => ({ ...prev, show: false }));
  };

  const validateField = async (field: string, value: string) => {
    setChecking(prev => ({ ...prev, [field]: true }));
    setErrors(prev => ({ ...prev, [field]: '' }));

    if (field === 'username') {
      const usernameValidation = validateUsername(value);
      if (!usernameValidation.isValid) {
        setErrors(prev => ({ ...prev, [field]: usernameValidation.error! }));
        setChecking(prev => ({ ...prev, [field]: false }));
        return;
      }

      if (value.trim() && value !== profile?.username) {
        const isAvailable = await checkUsernameAvailability(value.trim(), user?.uid);
        if (!isAvailable) {
          setErrors(prev => ({ ...prev, [field]: 'This username is already taken' }));
        }
      }
    }

    setChecking(prev => ({ ...prev, [field]: false }));
  };

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (field === 'username' && typeof value === 'string') {
      if (value.length >= 3) {
        validateField('username', value);
      } else {
        setErrors(prev => ({ ...prev, username: '' }));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !formData.username.trim() || !formData.firstName.trim() || !formData.lastName.trim()) return;

    // Final validation
    const usernameValidation = validateUsername(formData.username);
    
    if (!usernameValidation.isValid) {
      setErrors({
        username: usernameValidation.error || ''
      });
      return;
    }

    setSaving(true);
    try {
      // Check availability one more time if username changed
      if (formData.username !== profile?.username) {
        const usernameAvailable = await checkUsernameAvailability(formData.username.trim(), user.uid);
        if (!usernameAvailable) {
          setErrors(prev => ({ ...prev, username: 'This username is already taken' }));
          setSaving(false);
          return;
        }
      }

      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        username: formData.username.trim(),
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        displayName: `${formData.firstName.trim()} ${formData.lastName.trim()}`,
        university: formData.university.trim(),
        bio: formData.bio.trim(),
        coverColor: formData.coverColor,
        showPostsToPublic: formData.showPostsToPublic,
        showEmailToPublic: formData.showEmailToPublic,
        profileSetup: true,
        updatedAt: new Date(),
      });

      showToast("Profile updated successfully!", "success");
      setTimeout(() => {
        router.push('/profile');
      }, 1000);
    } catch (error) {
      console.error('Error updating profile:', error);
      showToast('Error updating profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar userProfile={profile} />
      
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
              <UserIcon className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Edit Profile</h1>
              <p className="text-gray-600">Update your profile information</p>
            </div>
          </div>
        </div>

        {/* Cover Color Preview */}
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Profile Preview</h3>
          <div 
            className="h-32 rounded-lg mb-4 relative"
            style={{ backgroundColor: formData.coverColor }}
          >
            <div className="absolute bottom-4 left-4 flex items-center space-x-3">
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-lg">
                <span className="text-2xl font-bold text-gray-700">
                  {formData.firstName?.charAt(0)?.toUpperCase() || user?.email?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="text-white">
                <h2 className="text-xl font-bold">
                  {formData.firstName && formData.lastName 
                    ? `${formData.firstName} ${formData.lastName}` 
                    : 'Your Name'}
                </h2>
                <p className="text-sm opacity-90">@{formData.username || 'username'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Name Fields */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  First Name *
                </label>
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => handleInputChange('firstName', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  placeholder="First name"
                  required
                  maxLength={50}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Last Name *
                </label>
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => handleInputChange('lastName', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  placeholder="Last name"
                  required
                  maxLength={50}
                />
              </div>
            </div>

            {/* Username */}
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
                  className={`w-full pl-8 pr-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 ${
                    errors.username ? 'border-red-300' : checking.username ? 'border-yellow-300' : formData.username && !errors.username && !checking.username ? 'border-green-300' : 'border-gray-300'
                  }`}
                  placeholder="yourusername"
                  required
                  maxLength={20}
                />
                {checking.username && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  </div>
                )}
              </div>
              <div className="flex justify-between items-center mt-1">
                <p className="text-xs text-gray-500">{formData.username.length}/20 characters</p>
                {checking.username && <span className="text-xs text-yellow-600">Checking availability...</span>}
                {!checking.username && formData.username && !errors.username && (
                  <span className="text-xs text-green-600">✓ Available</span>
                )}
              </div>
              {errors.username && <p className="text-xs text-red-500 mt-1">✗ {errors.username}</p>}
            </div>

            {/* University */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                University *
              </label>
              <input
                type="text"
                value={formData.university}
                onChange={(e) => handleInputChange('university', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                placeholder="Your university name"
                required
                maxLength={100}
              />
              <p className="text-xs text-gray-500 mt-1">{formData.university.length}/100 characters</p>
            </div>

            {/* Bio */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Bio
              </label>
              <textarea
                value={formData.bio}
                onChange={(e) => handleInputChange('bio', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 resize-none"
                placeholder="Tell us about yourself..."
                rows={4}
                maxLength={500}
              />
              <p className="text-xs text-gray-500 mt-1">{formData.bio.length}/500 characters</p>
            </div>

            {/* Cover Color */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cover Color
              </label>
              <div className="grid grid-cols-5 gap-3">
                {COVER_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => handleInputChange('coverColor', color)}
                    className={`w-full h-12 rounded-lg border-2 transition-all ${
                      formData.coverColor === color 
                        ? 'border-gray-900 scale-105' 
                        : 'border-gray-200 hover:border-gray-400'
                    }`}
                    style={{ backgroundColor: color }}
                  >
                    {formData.coverColor === color && (
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="w-4 h-4 bg-white rounded-full"></div>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Privacy Settings */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Privacy Settings</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <h4 className="font-medium text-gray-900">Show posts to visitors</h4>
                    <p className="text-sm text-gray-600">
                      Allow people not in your meshes to see your public posts
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.showPostsToPublic}
                      onChange={(e) => handleInputChange('showPostsToPublic', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
                
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <h4 className="font-medium text-gray-900">Show email to visitors</h4>
                    <p className="text-sm text-gray-600">
                      Allow other users to see your email address on your profile
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.showEmailToPublic}
                      onChange={(e) => handleInputChange('showEmailToPublic', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex space-x-4 pt-4">
              <button
                type="button"
                onClick={() => router.push('/profile')}
                className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !formData.username.trim() || !formData.firstName.trim() || !formData.lastName.trim() || !formData.university.trim() || Object.values(errors).some(error => error) || Object.values(checking).some(check => check)}
                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>

      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.show}
        onClose={hideToast}
      />
    </div>
  );
}