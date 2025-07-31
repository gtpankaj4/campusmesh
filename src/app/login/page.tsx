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

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const validateEmail = (email: string) => {
    return email.endsWith('.edu');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (!validateEmail(email)) {
      setError("Email must end with .edu");
      setLoading(false);
      return;
    }

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        // Extract username from email (part before @)
        const username = email.split('@')[0];
        
        // Create user account
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        
        // Create user profile with username
        const userRef = doc(db, 'users', userCredential.user.uid);
        await setDoc(userRef, {
          email: email,
          username: username,
          reputation: 0,
          postsCount: 0,
          commentsCount: 0,
          communitiesCount: 0,
          joinDate: serverTimestamp()
        });
      }
      router.push("/dashboard");
    } catch (error) {
      const authError = error as AuthError;
      switch (authError.code) {
        case "auth/user-not-found":
          setError("No account found with this email");
          break;
        case "auth/wrong-password":
          setError("Incorrect password");
          break;
        case "auth/email-already-in-use":
          setError("An account with this email already exists");
          break;
        case "auth/weak-password":
          setError("Password should be at least 6 characters");
          break;
        case "auth/invalid-email":
          setError("Invalid email address");
          break;
        default:
          setError("An error occurred. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              CampusMesh
            </h2>
            <p className="text-gray-600 mb-8">
              {isLogin ? "Sign in to your account" : "Create your account"}
            </p>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-gray-900"
                placeholder="your.email@university.edu"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete={isLogin ? "current-password" : "new-password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-gray-900"
                placeholder="Enter your password"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  {isLogin ? "Signing in..." : "Creating account..."}
                </div>
              ) : (
                isLogin ? "Sign In" : "Sign Up"
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin);
                setError("");
                setEmail("");
                setPassword("");
              }}
              className="text-sm text-blue-600 hover:text-blue-500 transition-colors"
            >
              {isLogin 
                ? "Don't have an account? Sign up" 
                : "Already have an account? Sign in"
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 