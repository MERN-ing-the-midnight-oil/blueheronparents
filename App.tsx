import 'react-native-gesture-handler';
import React, { useState, useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase.config';
import AppNavigator from './src/navigation/AppNavigator';
import AuthScreen from './src/screens/AuthScreen';
import ProfileSetupScreen from './src/screens/ProfileSetupScreen';
import VerifyEmailScreen from './src/screens/VerifyEmailScreen';
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
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  const loadProfileStatus = async (currentUser: User) => {
    try {
      const docRef = doc(db, 'users', currentUser.uid);

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
      setProfileComplete(false);
    }
  };

  const refreshEmailVerificationStatus = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    await currentUser.reload();
    const verified = currentUser.emailVerified;
    setIsEmailVerified(verified);
    if (verified) {
      await registerForPushNotificationsAsync();
      await loadProfileStatus(currentUser);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true);
      setUser(currentUser);

      if (currentUser) {
        try {
          await currentUser.reload();
        } catch (error) {
          console.warn('Failed to reload user:', error);
        }

        const verified = currentUser.emailVerified;
        setIsEmailVerified(verified);

        if (verified) {
          await registerForPushNotificationsAsync();
          await loadProfileStatus(currentUser);
        } else {
          setProfileComplete(false);
        }
      } else {
        setIsEmailVerified(false);
        setProfileComplete(false);
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

  // Logged in but email not verified
  if (!isEmailVerified) {
    return (
      <ErrorBoundary>
        <NavigationContainer>
          <VerifyEmailScreen
            email={user.email}
            onCheckVerification={refreshEmailVerificationStatus}
          />
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