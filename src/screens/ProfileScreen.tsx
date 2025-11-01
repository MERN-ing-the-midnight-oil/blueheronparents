import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, Alert } from 'react-native';
import { doc, getDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { db, auth } from '../../firebase.config';
import { useNavigation, useFocusEffect } from '@react-navigation/native';

interface Child {
    name: string;
    age: string;
    daysAttending: string[];
}

interface UserProfile {
    displayName: string;
    email: string;
    phone?: string;
    profileImageUrl?: string;
    children: Child[];
    showEmail: boolean;
    showPhone: boolean;
    profileComplete: boolean;
}

export default function ProfileScreen() {
    const navigation = useNavigation();
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);

    // Reload profile when screen comes into focus
    useFocusEffect(
        React.useCallback(() => {
            loadProfile();
        }, [])
    );

    const loadProfile = async () => {
        try {
            const docRef = doc(db, 'users', auth.currentUser!.uid);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                setProfile(docSnap.data() as UserProfile);
            }
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleEditProfile = () => {
        (navigation as any).navigate('EditProfile');
    };

    const handleSignOut = () => {
        Alert.alert(
            'Sign Out',
            'Are you sure you want to sign out?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Sign Out',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await signOut(auth);
                        } catch (error: any) {
                            Alert.alert('Error', error.message);
                        }
                    }
                }
            ]
        );
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <Text>Loading profile...</Text>
            </View>
        );
    }

    if (!profile || !profile.profileComplete) {
        return (
            <View style={styles.emptyContainer}>
                <Text style={styles.emptyTitle}>Profile Not Complete</Text>
                <Text style={styles.emptyText}>Please complete your profile to connect with other parents</Text>
            </View>
        );
    }

    return (
        <ScrollView style={styles.container}>
            <View style={styles.header}>
                {profile.profileImageUrl ? (
                    <Image source={{ uri: profile.profileImageUrl }} style={styles.profileImage} />
                ) : (
                    <View style={styles.profileImagePlaceholder}>
                        <Text style={styles.profileImagePlaceholderText}>
                            {profile.displayName.charAt(0).toUpperCase()}
                        </Text>
                    </View>
                )}
                <Text style={styles.displayName}>{profile.displayName}</Text>
                <Text style={styles.email}>{profile.email}</Text>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Contact Information</Text>

                <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Email:</Text>
                    <Text style={styles.infoValue}>
                        {profile.showEmail ? profile.email : 'Hidden'}
                    </Text>
                </View>

                {profile.phone && (
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Phone:</Text>
                        <Text style={styles.infoValue}>
                            {profile.showPhone ? profile.phone : 'Hidden'}
                        </Text>
                    </View>
                )}
            </View>

            {profile.children && profile.children.length > 0 && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Children</Text>

                    {profile.children.map((child, index) => (
                        <View key={index} style={styles.childCard}>
                            <Text style={styles.childName}>{child.name}</Text>
                            {child.age && <Text style={styles.childAge}>Age: {child.age}</Text>}
                            {child.daysAttending && child.daysAttending.length > 0 && (
                                <Text style={styles.childDays}>
                                    Attends: {child.daysAttending.join(', ')}
                                </Text>
                            )}
                        </View>
                    ))}
                </View>
            )}

            <TouchableOpacity style={styles.editButton} onPress={handleEditProfile}>
                <Text style={styles.editButtonText}>Edit Profile</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
                <Text style={styles.signOutButtonText}>Sign Out</Text>
            </TouchableOpacity>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 10,
        color: '#333',
    },
    emptyText: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
    },
    header: {
        backgroundColor: '#fff',
        alignItems: 'center',
        paddingVertical: 30,
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
    },
    profileImage: {
        width: 100,
        height: 100,
        borderRadius: 50,
        marginBottom: 15,
    },
    profileImagePlaceholder: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#2c5f7c',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 15,
    },
    profileImagePlaceholderText: {
        fontSize: 40,
        color: '#fff',
        fontWeight: 'bold',
    },
    displayName: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 5,
    },
    email: {
        fontSize: 14,
        color: '#666',
    },
    section: {
        backgroundColor: '#fff',
        marginTop: 15,
        padding: 20,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 15,
    },
    infoRow: {
        flexDirection: 'row',
        paddingVertical: 8,
    },
    infoLabel: {
        fontSize: 15,
        color: '#666',
        width: 80,
    },
    infoValue: {
        fontSize: 15,
        color: '#333',
        flex: 1,
    },
    childCard: {
        backgroundColor: '#f5f5f5',
        padding: 15,
        borderRadius: 8,
        marginBottom: 10,
    },
    childName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#2c5f7c',
        marginBottom: 5,
    },
    childAge: {
        fontSize: 14,
        color: '#666',
        marginBottom: 3,
    },
    childDays: {
        fontSize: 14,
        color: '#666',
    },
    editButton: {
        backgroundColor: '#2c5f7c',
        margin: 20,
        padding: 15,
        borderRadius: 8,
        alignItems: 'center',
    },
    editButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    signOutButton: {
        backgroundColor: '#fff',
        marginHorizontal: 20,
        marginBottom: 40,
        padding: 15,
        borderRadius: 8,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#d32f2f',
    },
    signOutButtonText: {
        color: '#d32f2f',
        fontSize: 16,
        fontWeight: 'bold',
    },
});