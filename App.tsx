import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase.config';
import AppNavigator from './src/navigation/AppNavigator';
import AuthScreen from './src/screens/AuthScreen';
import ProfileSetupScreen from './src/screens/ProfileSetupScreen';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileComplete, setProfileComplete] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        // Check if profile is complete
        try {
          const docRef = doc(db, 'users', currentUser.uid);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            const data = docSnap.data();
            setProfileComplete(data.profileComplete || false);
          } else {
            setProfileComplete(false);
          }
        } catch (error) {
          console.error('Error checking profile:', error);
          setProfileComplete(false);
        }
      }

      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const handleProfileComplete = () => {
    setProfileComplete(true);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2c5f7c" />
      </View>
    );
  }

  // Not logged in - show auth screen
  if (!user) {
    return (
      <NavigationContainer>
        <AuthScreen />
      </NavigationContainer>
    );
  }

  // Logged in but profile not complete - show profile setup
  if (!profileComplete) {
    return (
      <NavigationContainer>
        <ProfileSetupScreen onComplete={handleProfileComplete} />
      </NavigationContainer>
    );
  }

  // Logged in and profile complete - show main app
  return (
    <NavigationContainer>
      <AppNavigator />
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});