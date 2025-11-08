import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Switch, ScrollView, Alert, Pressable, ActivityIndicator, Linking } from 'react-native';
import {
    doc,
    getDoc,
    setDoc,
    collection,
    getDocs,
    deleteDoc,
    query,
    where,
    collectionGroup,
    updateDoc,
    arrayRemove,
    arrayUnion
} from 'firebase/firestore';
import { deleteUser } from 'firebase/auth';
import { db, auth, storage } from '../../firebase.config';
import { deleteObject, ref } from 'firebase/storage';
import {
    DELETED_MESSAGE_PLACEHOLDER,
    DELETED_USER_PLACEHOLDER_ID
} from '../constants/placeholders';

interface NotificationSettings {
    nestNotes: boolean;
    messages: boolean;
    calendar: boolean;
}

export default function SettingsScreen() {
    const [settings, setSettings] = useState<NotificationSettings>({
        nestNotes: true,
        messages: true,
        calendar: true,
    });
    const [loading, setLoading] = useState(true);
    const [deletingAccount, setDeletingAccount] = useState(false);

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            const docRef = doc(db, 'users', auth.currentUser!.uid);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                if (data.notificationSettings) {
                    setSettings(data.notificationSettings);
                }
            }
        } catch (error: any) {
            console.error('Error loading settings:', error);
        } finally {
            setLoading(false);
        }
    };

    const updateSetting = async (key: keyof NotificationSettings, value: boolean) => {
        const newSettings = { ...settings, [key]: value };
        setSettings(newSettings);

        try {
            await setDoc(
                doc(db, 'users', auth.currentUser!.uid),
                { notificationSettings: newSettings },
                { merge: true }
            );
        } catch (error: any) {
            console.error('Error updating settings:', error);
            Alert.alert('Error', 'Failed to update settings');
            // Revert on error
            setSettings(settings);
        }
    };

    const handleSupportLink = async () => {
        try {
            await Linking.openURL('https://blueheronparents.com/support#account-deletion');
        } catch (error) {
            console.error('Error opening support link:', error);
            Alert.alert('Unable to open link', 'Please visit blueheronparents.com/support for help.');
        }
    };

    const removeUserGeneratedContent = async (userId: string) => {
        // Delete events created by the user
        const eventsSnapshot = await getDocs(query(collection(db, 'events'), where('createdBy', '==', userId)));
        await Promise.all(eventsSnapshot.docs.map((eventDoc) => deleteDoc(eventDoc.ref)));

        // Delete posts (and associated comments + images)
        const postsSnapshot = await getDocs(query(collection(db, 'posts'), where('userId', '==', userId)));
        for (const postDoc of postsSnapshot.docs) {
            const data = postDoc.data();

            if (typeof data.imageUrl === 'string' && data.imageUrl.length > 0) {
                try {
                    const imageRef = ref(storage, data.imageUrl);
                    await deleteObject(imageRef);
                } catch (error) {
                    console.warn('Failed to delete post image:', error);
                }
            }

            const commentsSnapshot = await getDocs(collection(db, 'posts', postDoc.id, 'comments'));
            await Promise.all(commentsSnapshot.docs.map((commentDoc) => deleteDoc(commentDoc.ref)));

            await deleteDoc(postDoc.ref);
        }

        // Remove user likes from other posts
        const likedPostsSnapshot = await getDocs(query(collection(db, 'posts'), where('likes', 'array-contains', userId)));
        await Promise.all(
            likedPostsSnapshot.docs.map((postDoc) =>
                updateDoc(postDoc.ref, { likes: arrayRemove(userId) })
            )
        );

        // Delete comments authored on other posts
        try {
            const commentsSnapshot = await getDocs(query(collectionGroup(db, 'comments'), where('userId', '==', userId)));
            await Promise.all(commentsSnapshot.docs.map((commentDoc) => deleteDoc(commentDoc.ref)));
        } catch (error) {
            console.warn('Failed to clean up comment collection group:', error);
        }

        // Redact private messages sent by the user
        try {
            const sentMessagesSnapshot = await getDocs(
                query(
                    collection(db, 'messages'),
                    where('senderId', '==', userId)
                )
            );
            await Promise.all(
                sentMessagesSnapshot.docs.map((messageDoc) =>
                    updateDoc(messageDoc.ref, {
                        senderId: DELETED_USER_PLACEHOLDER_ID,
                        text: DELETED_MESSAGE_PLACEHOLDER,
                    })
                )
            );

            const receivedMessagesSnapshot = await getDocs(
                query(
                    collection(db, 'messages'),
                    where('recipientId', '==', userId)
                )
            );
            await Promise.all(
                receivedMessagesSnapshot.docs.map((messageDoc) =>
                    updateDoc(messageDoc.ref, {
                        recipientId: DELETED_USER_PLACEHOLDER_ID,
                        read: true,
                    })
                )
            );
        } catch (error) {
            console.warn('Failed to redact user messages:', error);
        }

        // Redact conversations involving the user
        try {
            const conversationsSnapshot = await getDocs(
                query(collection(db, 'conversations'), where('participants', 'array-contains', userId))
            );
            await Promise.all(
                conversationsSnapshot.docs.map(async (conversationDoc) => {
                    const conversationData: any = conversationDoc.data() || {};
                    const participants: string[] = conversationData.participants || [];
                    const updatedParticipants = participants.map((participant) =>
                        participant === userId ? DELETED_USER_PLACEHOLDER_ID : participant
                    );

                    const updatePayload: Record<string, any> = {
                        participants: updatedParticipants,
                        deletedParticipants: arrayUnion(userId),
                    };

                    if (conversationData.lastMessageSender === userId) {
                        updatePayload.lastMessage = DELETED_MESSAGE_PLACEHOLDER;
                        updatePayload.lastMessageSender = DELETED_USER_PLACEHOLDER_ID;
                    }

                    if (conversationData.unreadCount) {
                        const unreadCount = { ...conversationData.unreadCount };
                        delete unreadCount[userId];
                        updatePayload.unreadCount = unreadCount;
                    }

                    await updateDoc(conversationDoc.ref, updatePayload);
                })
            );
        } catch (error) {
            console.warn('Failed to redact user conversations:', error);
        }
    };

    const confirmDeleteAccount = async () => {
        const user = auth.currentUser;
        if (!user) {
            Alert.alert('Not signed in', 'Please sign in again and try deleting your account.');
            return;
        }

        setDeletingAccount(true);

        try {
            const userId = user.uid;

            await removeUserGeneratedContent(userId);
            await deleteDoc(doc(db, 'users', userId));
            await deleteUser(user);

            Alert.alert('Account deleted', 'Your account and all associated data have been removed.');
        } catch (error: any) {
            console.error('Error deleting account:', error);
            if (error?.code === 'auth/requires-recent-login') {
                Alert.alert(
                    'Log in again',
                    'For security, please sign out, log back in, and then delete your account.'
                );
            } else {
                Alert.alert(
                    'Something went wrong',
                    error?.message || 'We could not delete your account. Please try again later.'
                );
            }
        } finally {
            setDeletingAccount(false);
        }
    };

    const handleDeleteAccount = () => {
        Alert.alert(
            'Delete Account',
            'Deleting your account will remove your profile, messages, posts, events, and notification preferences. This cannot be undone. Do you want to continue?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete Account',
                    style: 'destructive',
                    onPress: confirmDeleteAccount,
                },
            ]
        );
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <Text>Loading settings...</Text>
            </View>
        );
    }

    return (
        <ScrollView style={styles.container}>
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Push Notifications</Text>
                <Text style={styles.sectionDescription}>
                    Choose what notifications you'd like to receive
                </Text>

                <View style={styles.settingRow}>
                    <View style={styles.settingInfo}>
                        <Text style={styles.settingLabel}>Nest News</Text>
                        <Text style={styles.settingDescription}>
                            New posts on the bulletin board
                        </Text>
                    </View>
                    <Switch
                        value={settings.nestNotes}
                        onValueChange={(value) => updateSetting('nestNotes', value)}
                        trackColor={{ false: '#767577', true: '#2c5f7c' }}
                        thumbColor={settings.nestNotes ? '#fff' : '#f4f3f4'}
                    />
                </View>

                <View style={styles.settingRow}>
                    <View style={styles.settingInfo}>
                        <Text style={styles.settingLabel}>Messages</Text>
                        <Text style={styles.settingDescription}>
                            New messages in community chat
                        </Text>
                    </View>
                    <Switch
                        value={settings.messages}
                        onValueChange={(value) => updateSetting('messages', value)}
                        trackColor={{ false: '#767577', true: '#2c5f7c' }}
                        thumbColor={settings.messages ? '#fff' : '#f4f3f4'}
                    />
                </View>

                <View style={styles.settingRow}>
                    <View style={styles.settingInfo}>
                        <Text style={styles.settingLabel}>Cawlendar Events</Text>
                        <Text style={styles.settingDescription}>
                            New events added to the calendar
                        </Text>
                    </View>
                    <Switch
                        value={settings.calendar}
                        onValueChange={(value) => updateSetting('calendar', value)}
                        trackColor={{ false: '#767577', true: '#2c5f7c' }}
                        thumbColor={settings.calendar ? '#fff' : '#f4f3f4'}
                    />
                </View>
            </View>

            <View style={styles.infoSection}>
                <Text style={styles.infoText}>
                    💡 Tip: You can adjust these settings anytime to control which notifications you receive.
                </Text>
            </View>

            <View style={styles.dangerSection}>
                <Text style={styles.dangerTitle}>Delete Account</Text>
                <Text style={styles.dangerDescription}>
                    Permanently remove your account, profile, messages, posts, and notification preferences.
                </Text>
                <Pressable
                    style={[styles.deleteButton, deletingAccount && styles.deleteButtonDisabled]}
                    onPress={handleDeleteAccount}
                    disabled={deletingAccount}
                >
                    {deletingAccount ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.deleteButtonText}>Delete Account</Text>
                    )}
                </Pressable>

                <Pressable onPress={handleSupportLink}>
                    <Text style={styles.supportLink}>Need help? Visit support</Text>
                </Pressable>
            </View>
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
    section: {
        backgroundColor: '#fff',
        marginTop: 20,
        padding: 20,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: '#e0e0e0',
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 5,
    },
    sectionDescription: {
        fontSize: 14,
        color: '#666',
        marginBottom: 20,
    },
    settingRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    settingInfo: {
        flex: 1,
        marginRight: 15,
    },
    settingLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginBottom: 3,
    },
    settingDescription: {
        fontSize: 13,
        color: '#666',
    },
    infoSection: {
        backgroundColor: '#fff9e6',
        margin: 20,
        padding: 15,
        borderRadius: 8,
        borderLeftWidth: 4,
        borderLeftColor: '#ffc107',
    },
    infoText: {
        fontSize: 14,
        color: '#666',
        lineHeight: 20,
    },
    dangerSection: {
        backgroundColor: '#fff',
        marginHorizontal: 20,
        marginBottom: 40,
        padding: 20,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#f2dede',
    },
    dangerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#d32f2f',
        marginBottom: 8,
    },
    dangerDescription: {
        fontSize: 14,
        color: '#666',
        marginBottom: 20,
        lineHeight: 20,
    },
    deleteButton: {
        backgroundColor: '#d32f2f',
        paddingVertical: 14,
        borderRadius: 8,
        alignItems: 'center',
        marginBottom: 12,
    },
    deleteButtonDisabled: {
        opacity: 0.6,
    },
    deleteButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    supportLink: {
        fontSize: 14,
        color: '#2c5f7c',
        fontWeight: '600',
        textAlign: 'center',
    },
});