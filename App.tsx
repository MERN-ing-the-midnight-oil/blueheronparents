import 'react-native-gesture-handler';
import React, { useState, useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase.config';
import AppNavigator from './src/navigation/AppNavigator';
import AuthScreen from './src/screens/AuthScreen';
import ProfileSetupScreen from './src/screens/ProfileSetupScreen';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import * as Notifications from 'expo-notifications';
import { registerForPushNotificationsAsync } from './src/utils/notifications';

// Error Boundary Component
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error?: Error }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10 }}>Something went wrong</Text>
          <Text style={{ textAlign: 'center', marginBottom: 20 }}>
            The app encountered an unexpected error. Please restart the app.
          </Text>
        </View>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileComplete, setProfileComplete] = useState(false);
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        // Register for push notifications when user logs in
        registerForPushNotificationsAsync();

        // Check if profile is complete with timeout
        try {
          const docRef = doc(db, 'users', currentUser.uid);

          // Add timeout wrapper for Firebase operations
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Firebase operation timeout')), 10000)
          );

          const docSnap = await Promise.race([getDoc(docRef), timeoutPromise]);

          if (docSnap.exists()) {
            const data = docSnap.data();
            setProfileComplete(data?.profileComplete || false);
          } else {
            setProfileComplete(false);
          }
        } catch (error) {
          console.error('Error checking profile:', error);
          // On timeout or error, default to false but don't crash
          setProfileComplete(false);
        }
      }

      setLoading(false);
    });

    // Notification listeners
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received:', notification);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification tapped:', response);
      // You can navigate to specific screens based on notification type here
    });

    return () => {
      unsubscribe();
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, []);

  const handleProfileComplete = () => {
    setProfileComplete(true);
  };

  if (loading) {
    return (
      <ErrorBoundary>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2c5f7c" />
        </View>
      </ErrorBoundary>
    );
  }

  // Not logged in - show auth screen
  if (!user) {
    return (
      <ErrorBoundary>
        <NavigationContainer>
          <AuthScreen />
        </NavigationContainer>
      </ErrorBoundary>
    );
  }

  // Logged in but profile not complete - show profile setup
  if (!profileComplete) {
    return (
      <ErrorBoundary>
        <NavigationContainer>
          <ProfileSetupScreen onComplete={handleProfileComplete} />
        </NavigationContainer>
      </ErrorBoundary>
    );
  }

  // Logged in and profile complete - show main app
  return (
    <ErrorBoundary>
      <NavigationContainer>
        <AppNavigator />
      </NavigationContainer>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});