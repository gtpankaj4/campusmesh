"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  AuthError 
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import Toast from "@/components/Toast";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [signupLoading, setSignupLoading] = useState(false);
  const [showSignup, setShowSignup] = useState(false);
  const [toast, setToast] = useState({ show: false, message: "", type: "error" as "success" | "error" });
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

    if (!validateEmail(email)) {
      showToast("Email must end with .edu");
      setLoading(false);
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, email, password);
      showToast("Successfully signed in!", "success");
      router.push("/dashboard");
    } catch (error) {
      const authError = error as AuthError;
      switch (authError.code) {
        case "auth/user-not-found":
          showToast("No account found with this email");
          break;
        case "auth/wrong-password":
          showToast("Incorrect password");
          break;
        case "auth/invalid-email":
          showToast("Invalid email address");
          break;
        case "auth/invalid-credential":
          showToast("Invalid credentials. Please check your email and password");
          break;
        default:
          showToast("An error occurred. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignupLoading(true);

    if (!validateEmail(signupEmail)) {
      showToast("Email must end with .edu");
      setSignupLoading(false);
      return;
    }

    try {
      // Extract username from email (part before @)
      const username = signupEmail.split('@')[0];
      
      // Create user account
      const userCredential = await createUserWithEmailAndPassword(auth, signupEmail, signupPassword);
      
      // Create user profile with username
      const userRef = doc(db, 'users', userCredential.user.uid);
      await setDoc(userRef, {
        email: signupEmail,
        username: username,
        reputation: 0,
        postsCount: 0,
        commentsCount: 0,
        communitiesCount: 0,
        joinDate: serverTimestamp()
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
              <input
                type="email"
                autoComplete="email"
                required
                value={signupEmail}
                onChange={(e) => setSignupEmail(e.target.value)}
                className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                placeholder="Email address"
              />

              <input
                type="password"
                autoComplete="new-password"
                required
                value={signupPassword}
                onChange={(e) => setSignupPassword(e.target.value)}
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
                  setSignupEmail("");
                  setSignupPassword("");
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
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
              placeholder="Email address"
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