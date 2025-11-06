import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || 'AIzaSyBIae6Q2QpV0tw7wM2pN-ZeE5go7uNOQ3A',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || 'blue-heron-rookery.firebaseapp.com',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'blue-heron-rookery',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || 'blue-heron-rookery.firebasestorage.app',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '701219621793',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '1:701219621793:web:63af50448c8378e5e359e0',
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID || 'G-Q9KPJM0L2D'
};

// Validate Firebase configuration
const requiredEnvVars = [
  'EXPO_PUBLIC_FIREBASE_API_KEY',
  'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
  'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'EXPO_PUBLIC_FIREBASE_APP_ID'
];

const missingVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
if (missingVars.length > 0) {
  console.error(`Missing required environment variables: ${missingVars.join(', ')}`);
  console.error('Firebase configuration will not work properly. Please check your environment variables.');
  
  // In development, we can throw an error
  if (__DEV__) {
    throw new Error(`Firebase configuration error: ${missingVars.join(', ')} not set`);
  }
  
  // In production, we'll create a fallback configuration to prevent crashes
  console.warn('Using fallback Firebase configuration to prevent app crash');
}

// Initialize Firebase with error handling
let app;
let auth;
let db;
let storage;

try {
  app = initializeApp(firebaseConfig);
  
  // Initialize services with timeout handling
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
  
  console.log('Firebase initialized successfully');
} catch (error) {
  console.error('Firebase initialization error:', error);
  throw new Error('Failed to initialize Firebase services');
}

export { auth, db, storage };