import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyBp38_UGTzvpsIqa046jJYvd99Jptgh6lM",
  authDomain: "campusmess-8d0b5.firebaseapp.com",
  projectId: "campusmess-8d0b5",
  storageBucket: "campusmess-8d0b5.firebasestorage.app",
  messagingSenderId: "578793090865",
  appId: "1:578793090865:web:7f792ace1eb7f34375ca10",
  measurementId: "G-44VRXR1SRZ",
  databaseURL: "https://campusmess-8d0b5-default-rtdb.firebaseio.com"
};

const app = initializeApp(firebaseConfig);

// Only initialize analytics on the client side
let analytics;
if (typeof window !== 'undefined') {
  analytics = getAnalytics(app);
}

const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const realtimeDb = getDatabase(app);

export { app, analytics, auth, db, storage, realtimeDb }; 