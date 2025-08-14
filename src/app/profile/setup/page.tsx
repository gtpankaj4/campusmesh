"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { ArrowLeftIcon, UserIcon } from "@heroicons/react/24/outline";
import Navbar from "@/components/Navbar";
import { validateUsername, checkUsernameAvailability, generateSuggestedUsername } from "@/lib/usernameUtils";

export default function ProfileSetupPage() {
  const [user, setUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    displayName: '',
    username: '',
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{[key: string]: string}>({});
  const [checking, setChecking] = useState<{[key: string]: boolean}>({});
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUser(user);
        await loadUserProfile(user.uid);
      } else {
        router.push("/login");
      }
    });

    return () => unsubscribe();
  }, [router]);

  const loadUserProfile = async (userId: string) => {
    try {
      const userRef = doc(db, "users", userId);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        const userData = userSnap.data();
        setFormData({
          displayName: userData.displayName || userData.username || user?.email?.split('@')[0] || '',
          username: userData.username || '',
        });
        
        // Don't redirect if user already has username - allow editing
      } else {
        // Auto-generate initial values
        const emailPrefix = user?.email?.split('@')[0] || '';
        setFormData({
          displayName: emailPrefix,
          username: emailPrefix.toLowerCase().replace(/[^a-zA-Z0-9]/g, '').slice(0, 20),
        });
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
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

      if (value.trim()) {
        const isAvailable = await checkUsernameAvailability(value.trim(), user?.uid);
        if (!isAvailable) {
          setErrors(prev => ({ ...prev, [field]: 'This username is already taken' }));
          // Generate suggestions
          const suggestions = generateSuggestedUsername(value);
          setSuggestions(suggestions);
          setShowSuggestions(true);
        } else {
          setShowSuggestions(false);
        }
      }
    }

    setChecking(prev => ({ ...prev, [field]: false }));
  };

  // Real-time username validation as user types
  const handleUsernameChange = async (value: string) => {
    setFormData(prev => ({ ...prev, username: value }));
    setShowSuggestions(false);
    
    if (value.length === 0) {
      setErrors(prev => ({ ...prev, username: '' }));
      return;
    }

    // Debounce the validation
    setTimeout(async () => {
      if (formData.username === value) { // Only validate if value hasn't changed
        await validateField('username', value);
      }
    }, 500);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setShowSuggestions(false);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setFormData(prev => ({ ...prev, username: suggestion }));
    setShowSuggestions(false);
    validateField('username', suggestion);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !formData.username.trim() || !formData.displayName.trim()) return;

    // Final validation
    const usernameValidation = validateUsername(formData.username);
    
    if (!usernameValidation.isValid) {
      setErrors({
        username: usernameValidation.error || ''
      });
      return;
    }

    setLoading(true);
    try {
      // Check availability one more time
      const usernameAvailable = await checkUsernameAvailability(formData.username.trim(), user.uid);

      if (!usernameAvailable) {
        setErrors(prev => ({ ...prev, username: 'This username is already taken' }));
        setLoading(false);
        return;
      }

      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        username: formData.username.trim(),
        displayName: formData.displayName.trim(),
        profileSetup: true,
        updatedAt: new Date(),
      });

      router.push('/profile/edit');
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Error updating profile. Please try again.');
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
              <UserIcon className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Complete Your Profile</h1>
              <p className="text-gray-600">Set up your display name and username</p>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Display Name *
              </label>
              <input
                type="text"
                value={formData.displayName}
                onChange={(e) => handleInputChange('displayName', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                placeholder="Your display name"
                required
                maxLength={50}
              />
              <p className="text-xs text-gray-500 mt-1">{formData.displayName.length}/50 characters</p>
              <p className="text-xs text-gray-500 mt-1">
                This is how your name will appear to others
              </p>
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
                  onChange={(e) => handleUsernameChange(e.target.value)}
                  onBlur={(e) => validateField('username', e.target.value)}
                  className={`w-full pl-8 pr-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 ${
                    errors.username ? 'border-red-300' : checking.username ? 'border-yellow-300' : formData.username && !errors.username && !checking.username ? 'border-green-300' : 'border-gray-300'
                  }`}
                  placeholder="yourusername"
                  required
                  maxLength={20}
                />
              </div>
              <div className="flex justify-between items-center mt-1">
                <p className="text-xs text-gray-500">{formData.username.length}/20 characters</p>
                {checking.username && <span className="text-xs text-yellow-600">Checking availability...</span>}
                {!checking.username && formData.username && !errors.username && (
                  <span className="text-xs text-green-600">✓ Available</span>
                )}
              </div>
              {errors.username && <p className="text-xs text-red-500 mt-1">✗ {errors.username}</p>}
              <p className="text-xs text-gray-500 mt-1">
                This will be your unique identifier (e.g., @{formData.username || 'yourusername'})
              </p>

              {/* Username Suggestions */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm font-medium text-blue-900 mb-2">Suggested usernames:</p>
                  <div className="flex flex-wrap gap-2">
                    {suggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => handleSuggestionClick(suggestion)}
                        className="px-3 py-1 bg-white text-blue-700 rounded-full text-sm hover:bg-blue-100 transition-colors border border-blue-200"
                      >
                        @{suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex space-x-4 pt-4">
              <button
                type="button"
                onClick={() => router.push('/dashboard')}
                className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
              >
                Skip for now
              </button>
              <button
                type="submit"
                disabled={loading || !formData.username.trim() || !formData.displayName.trim() || Object.values(errors).some(error => error) || Object.values(checking).some(check => check)}
                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {loading ? 'Saving...' : 'Complete Setup'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}