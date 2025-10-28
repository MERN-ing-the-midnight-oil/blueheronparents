// firebase.config.ts
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBIae6Q2QpV0tw7wM2pN-ZeE5go7uNOQ3A",
  authDomain: "blue-heron-rookery.firebaseapp.com",
  projectId: "blue-heron-rookery",
  storageBucket: "blue-heron-rookery.firebasestorage.app",
  messagingSenderId: "701219621793",
  appId: "1:701219621793:web:63af50448c8378e5e359e0",
  measurementId: "G-Q9KPJM0L2D"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);