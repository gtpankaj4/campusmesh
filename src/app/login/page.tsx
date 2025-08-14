"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  AuthError 
} from "firebase/auth";
import { doc, setDoc, serverTimestamp, collection, query, where, getDocs } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import Toast from "@/components/Toast";

export default function LoginPage() {
  const [emailOrUsername, setEmailOrUsername] = useState("");
  const [password, setPassword] = useState("");
  const [signupData, setSignupData] = useState({
    firstName: "",
    lastName: "",
    username: "",
    email: "",
    password: "",
    university: ""
  });
  const [loading, setLoading] = useState(false);
  const [signupLoading, setSignupLoading] = useState(false);
  const [showSignup, setShowSignup] = useState(false);
  const [toast, setToast] = useState({ show: false, message: "", type: "error" as "success" | "error" });
  const [usernameError, setUsernameError] = useState("");
  const [checkingUsername, setCheckingUsername] = useState(false);
  const router = useRouter();

  const validateEmail = (email: string) => {
    return email.endsWith('.edu');
  };

  const showToast = (message: string, type: "success" | "error" = "error") => {
    setToast({ show: true, message, type });
  };

  const hideToast = () => {
    setToast(prev => ({ ...prev, show: false }));
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let loginEmail = emailOrUsername;
      
      // If input doesn't contain @, treat as username and find email
      if (!emailOrUsername.includes('@')) {
        const usersRef = collection(db, 'users');
        const usernameQuery = query(usersRef, where('username', '==', emailOrUsername));
        const snapshot = await getDocs(usernameQuery);
        
        if (snapshot.empty) {
          showToast("No account found with this username");
          setLoading(false);
          return;
        }
        
        loginEmail = snapshot.docs[0].data().email;
      }

      if (!validateEmail(loginEmail)) {
        showToast("Email must end with .edu");
        setLoading(false);
        return;
      }

      await signInWithEmailAndPassword(auth, loginEmail, password);
      showToast("Successfully signed in!", "success");
      router.push("/dashboard");
    } catch (error) {
      const authError = error as AuthError;
      switch (authError.code) {
        case "auth/user-not-found":
          showToast("No account found with this email or username");
          break;
        case "auth/wrong-password":
          showToast("Incorrect password");
          break;
        case "auth/invalid-email":
          showToast("Invalid email address");
          break;
        case "auth/invalid-credential":
          showToast("Invalid credentials. Please check your email/username and password");
          break;
        default:
          showToast("An error occurred. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const validateUsername = async (username: string) => {
    if (!username) return;
    
    setCheckingUsername(true);
    setUsernameError("");
    
    // Basic validation
    if (username.length < 3) {
      setUsernameError("Username must be at least 3 characters");
      setCheckingUsername(false);
      return;
    }
    
    if (username.length > 20) {
      setUsernameError("Username must be 20 characters or less");
      setCheckingUsername(false);
      return;
    }
    
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      setUsernameError("Username can only contain letters, numbers, underscores, and hyphens");
      setCheckingUsername(false);
      return;
    }
    
    // Check availability
    try {
      const usersRef = collection(db, 'users');
      const usernameQuery = query(usersRef, where('username', '==', username));
      const snapshot = await getDocs(usernameQuery);
      
      if (!snapshot.empty) {
        setUsernameError("This username is already taken");
      }
    } catch (error) {
      console.error("Error checking username:", error);
    }
    
    setCheckingUsername(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignupLoading(true);

    if (!validateEmail(signupData.email)) {
      showToast("Email must end with .edu");
      setSignupLoading(false);
      return;
    }

    if (usernameError || !signupData.username) {
      showToast("Please fix username errors");
      setSignupLoading(false);
      return;
    }

    try {
      // Create user account
      const userCredential = await createUserWithEmailAndPassword(auth, signupData.email, signupData.password);
      
      // Create user profile
      const userRef = doc(db, 'users', userCredential.user.uid);
      await setDoc(userRef, {
        email: signupData.email,
        username: signupData.username,
        firstName: signupData.firstName,
        lastName: signupData.lastName,
        displayName: `${signupData.firstName} ${signupData.lastName}`,
        university: signupData.university,
        bio: "",
        coverColor: "#3B82F6", // Default blue
        showPostsToPublic: true,
        showEmailToPublic: false,
        reputation: 0,
        postsCount: 0,
        commentsCount: 0,
        communitiesCount: 0,
        joinDate: serverTimestamp(),
        profileSetup: true
      });

      showToast("Account created successfully!", "success");
      router.push("/dashboard");
    } catch (error) {
      const authError = error as AuthError;
      switch (authError.code) {
        case "auth/email-already-in-use":
          showToast("An account with this email already exists");
          break;
        case "auth/weak-password":
          showToast("Password should be at least 6 characters");
          break;
        case "auth/invalid-email":
          showToast("Invalid email address");
          break;
        default:
          showToast("An error occurred. Please try again.");
      }
    } finally {
      setSignupLoading(false);
    }
  };

  if (showSignup) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="text-center mb-6">
              <h2 className="text-3xl font-bold text-gray-900 mb-2">
                Campesh
              </h2>
              <p className="text-gray-600">
                Create your account
              </p>
            </div>

            <form className="space-y-4" onSubmit={handleSignup}>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  required
                  value={signupData.firstName}
                  onChange={(e) => setSignupData(prev => ({ ...prev, firstName: e.target.value }))}
                  className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  placeholder="First name"
                />
                <input
                  type="text"
                  required
                  value={signupData.lastName}
                  onChange={(e) => setSignupData(prev => ({ ...prev, lastName: e.target.value }))}
                  className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  placeholder="Last name"
                />
              </div>

              <div className="relative">
                <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500">@</span>
                <input
                  type="text"
                  required
                  value={signupData.username}
                  onChange={(e) => {
                    setSignupData(prev => ({ ...prev, username: e.target.value }));
                    if (e.target.value.length >= 3) {
                      validateUsername(e.target.value);
                    }
                  }}
                  className={`w-full pl-8 pr-4 py-3 text-base border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 ${
                    usernameError ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="username"
                />
                {checkingUsername && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  </div>
                )}
              </div>
              {usernameError && <p className="text-sm text-red-500">✗ {usernameError}</p>}

              <input
                type="text"
                required
                value={signupData.university}
                onChange={(e) => setSignupData(prev => ({ ...prev, university: e.target.value }))}
                className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                placeholder="University name"
              />

              <input
                type="email"
                autoComplete="email"
                required
                value={signupData.email}
                onChange={(e) => setSignupData(prev => ({ ...prev, email: e.target.value }))}
                className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                placeholder="Email address"
              />

              <input
                type="password"
                autoComplete="new-password"
                required
                value={signupData.password}
                onChange={(e) => setSignupData(prev => ({ ...prev, password: e.target.value }))}
                className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                placeholder="Password"
              />

              <button
                type="submit"
                disabled={signupLoading}
                className="w-full py-3 px-4 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {signupLoading ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Creating account...
                  </div>
                ) : (
                  "Sign Up"
                )}
              </button>
            </form>

            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => {
                  setShowSignup(false);
                  setSignupData({
                    firstName: "",
                    lastName: "",
                    username: "",
                    email: "",
                    password: "",
                    university: ""
                  });
                  setUsernameError("");
                }}
                className="text-blue-600 hover:text-blue-500 transition-colors cursor-pointer"
              >
                Already have an account?
              </button>
            </div>
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

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold text-blue-600 mb-2">
              Campesh
            </h1>
            <p className="text-gray-600">
              Connect with your campus community
            </p>
          </div>

          <form className="space-y-4" onSubmit={handleLogin}>
            <input
              type="email"
              autoComplete="email"
              required
              value={emailOrUsername}
              onChange={(e) => setEmailOrUsername(e.target.value)}
              className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
              placeholder="Email or username"
            />

            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
              placeholder="Password"
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Logging in...
                </div>
              ) : (
                "Log In"
              )}
            </button>
          </form>



          <div className="mt-6 pt-6 border-t border-gray-300">
            <div className="text-center">
              <button
                type="button"
                onClick={() => setShowSignup(true)}
                className="py-3 px-6 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Create new account
              </button>
            </div>
          </div>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              <span className="font-medium text-blue-600">Connect.</span> <span className="font-medium text-green-600">Share.</span> <span className="font-medium text-purple-600">Thrive.</span><br/>
              Make your campus life full of meshes
            </p>
          </div>
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