import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    TextInput,
    Alert,
    Modal,
    Image,
    SafeAreaView,
    ScrollView,
    Dimensions
} from 'react-native';
import CommunityGuidelinesScreen from './CommunityGuidelinesScreen';
import {
    collection,
    query,
    orderBy,
    where,
    onSnapshot,
    addDoc,
    serverTimestamp,
    doc,
    getDoc,
    getDocs,
    updateDoc
} from 'firebase/firestore';
import { db, auth } from '../../firebase.config';

const { width } = Dimensions.get('window');
const GRID_ITEM_SIZE = (width - 60) / 4; // 4 items per row with padding

interface User {
    id: string;
    displayName: string;
    email: string;
    profileImageUrl?: string;
    children?: { name: string; age: string; daysAttending: string[] }[];
}

interface Message {
    id: string;
    text: string;
    senderId: string;
    recipientId: string;
    conversationId: string;
    createdAt: any;
    read: boolean;
}

interface MessageWithUser extends Message {
    otherUser: User;
}

interface UserProfile extends User {
    phone?: string;
    showEmail: boolean;
    showPhone: boolean;
    profileComplete: boolean;
}

interface ReportData {
    reportedUserId: string;
    reportedByUserId: string;
    reason: string;
    description: string;
    timestamp: any;
    status: 'pending' | 'reviewed' | 'resolved';
}

export default function MessagesScreen() {
    const [users, setUsers] = useState<User[]>([]);
    const [allMessages, setAllMessages] = useState<MessageWithUser[]>([]);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [userMessages, setUserMessages] = useState<Message[]>([]);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [messageText, setMessageText] = useState('');
    const [loading, setLoading] = useState(true);
    const [showReportModal, setShowReportModal] = useState(false);
    const [reportReason, setReportReason] = useState('');
    const [reportDescription, setReportDescription] = useState('');
    const [blockedUsers, setBlockedUsers] = useState<string[]>([]);
    const [showGuidelines, setShowGuidelines] = useState(false);

    useEffect(() => {
        loadUsers();
        loadAllMessages();
    }, []);

    useEffect(() => {
        if (!selectedUser) return;
        loadUserMessages(selectedUser.id);
        loadUserProfile(selectedUser.id);
    }, [selectedUser, users]);

    const loadUsers = async () => {
        try {
            const q = query(collection(db, 'users'));
            const querySnapshot = await getDocs(q);
            const usersData = querySnapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() } as User))
                .filter(user => user.id !== auth.currentUser?.uid);
            setUsers(usersData);
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setLoading(false);
        }
    };

    const loadAllMessages = () => {
        if (!auth.currentUser) return;

        // Query messages where current user is sender
        const q1 = query(
            collection(db, 'messages'),
            where('senderId', '==', auth.currentUser.uid),
            orderBy('createdAt', 'desc')
        );

        // Query messages where current user is recipient
        const q2 = query(
            collection(db, 'messages'),
            where('recipientId', '==', auth.currentUser.uid),
            orderBy('createdAt', 'desc')
        );

        let messages1: Message[] = [];
        let messages2: Message[] = [];

        const processAllMessages = async () => {
            const allUserMessages = [...messages1, ...messages2]
                .sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));

            // Add user data to messages
            const messagesWithUsers = await Promise.all(
                allUserMessages.map(async (message) => {
                    const otherUserId = message.senderId === auth.currentUser?.uid
                        ? message.recipientId
                        : message.senderId;

                    let otherUser = users.find(u => u.id === otherUserId);

                    if (!otherUser) {
                        try {
                            const userDoc = await getDoc(doc(db, 'users', otherUserId));
                            otherUser = userDoc.exists() ? { id: userDoc.id, ...userDoc.data() } as User : undefined;
                        } catch (error) {
                            console.error('Error loading user:', error);
                            return null;
                        }
                    }

                    return otherUser ? { ...message, otherUser } as MessageWithUser : null;
                })
            );

            setAllMessages(messagesWithUsers.filter(Boolean) as MessageWithUser[]);
        };

        // Listen to both queries
        const unsubscribe1 = onSnapshot(q1, (snapshot) => {
            messages1 = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
            processAllMessages();
        }, (error) => {
            console.error('Error in loadAllMessages q1:', error);
        });

        const unsubscribe2 = onSnapshot(q2, (snapshot) => {
            messages2 = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
            processAllMessages();
        }, (error) => {
            console.error('Error in loadAllMessages q2:', error);
        });

        return () => {
            unsubscribe1();
            unsubscribe2();
        };
    };

    const loadUserMessages = (userId: string) => {
        if (!auth.currentUser) return;

        // Query messages where current user is sender to selected user (no orderBy to avoid index requirement)
        const q1 = query(
            collection(db, 'messages'),
            where('senderId', '==', auth.currentUser.uid),
            where('recipientId', '==', userId)
        );

        // Query messages where selected user is sender to current user (no orderBy to avoid index requirement)
        const q2 = query(
            collection(db, 'messages'),
            where('senderId', '==', userId),
            where('recipientId', '==', auth.currentUser.uid)
        );

        // Combine results from both queries
        const unsubscribes: (() => void)[] = [];
        let messages1: Message[] = [];
        let messages2: Message[] = [];

        const updateMessages = () => {
            const allMessages = [...messages1, ...messages2]
                .sort((a, b) => (a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0));
            setUserMessages(allMessages);
        };

        // Listen to first query
        const unsubscribe1 = onSnapshot(
            q1,
            (snapshot) => {
                messages1 = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
                updateMessages();
            },
            (error) => {
                console.error('Error in loadUserMessages q1:', error);
            }
        );

        // Listen to second query
        const unsubscribe2 = onSnapshot(
            q2,
            (snapshot) => {
                messages2 = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
                updateMessages();
            },
            (error) => {
                console.error('Error in loadUserMessages q2:', error);
            }
        );

        unsubscribes.push(unsubscribe1, unsubscribe2);

        return () => {
            unsubscribes.forEach(unsub => unsub());
        };
    };

    const loadUserProfile = async (userId: string) => {
        try {
            const userDoc = await getDoc(doc(db, 'users', userId));
            if (userDoc.exists()) {
                setUserProfile({ id: userDoc.id, ...userDoc.data() } as UserProfile);
            }
        } catch (error) {
            console.error('Error loading user profile:', error);
        }
    };

    const createOrGetConversation = async (otherUserId: string): Promise<string> => {
        try {
            console.log('Creating/getting conversation with user:', otherUserId);
            console.log('Current user:', auth.currentUser?.uid);

            const q = query(
                collection(db, 'conversations'),
                where('participants', 'array-contains', auth.currentUser!.uid)
            );

            const snapshot = await getDocs(q);
            console.log('Found conversations:', snapshot.docs.length);

            const existingConv = snapshot.docs.find(doc => {
                const data = doc.data();
                return data.participants.includes(otherUserId);
            });

            if (existingConv) {
                console.log('Found existing conversation:', existingConv.id);
                return existingConv.id;
            }
        } catch (error) {
            console.error('Error in createOrGetConversation:', error);
            throw error;
        }

        const conversationData = {
            participants: [auth.currentUser!.uid, otherUserId],
            lastMessage: '',
            lastMessageTime: serverTimestamp(),
            lastMessageSender: '',
        };

        const docRef = await addDoc(collection(db, 'conversations'), conversationData);
        return docRef.id;
    };

    const sendMessage = async () => {
        if (!messageText.trim() || !selectedUser) return;

        try {
            const conversationId = await createOrGetConversation(selectedUser.id);

            await addDoc(collection(db, 'messages'), {
                text: messageText,
                senderId: auth.currentUser!.uid,
                recipientId: selectedUser.id,
                conversationId,
                createdAt: serverTimestamp(),
                read: false
            });

            await updateDoc(doc(db, 'conversations', conversationId), {
                lastMessage: messageText,
                lastMessageTime: serverTimestamp(),
                lastMessageSender: auth.currentUser!.uid
            });

            setMessageText('');
        } catch (error: any) {
            Alert.alert('Error', error.message);
        }
    };

    const reportUser = async () => {
        if (!selectedUser || !reportReason.trim()) {
            Alert.alert('Error', 'Please select a reason for reporting');
            return;
        }

        try {
            await addDoc(collection(db, 'reports'), {
                reportedUserId: selectedUser.id,
                reportedByUserId: auth.currentUser!.uid,
                reason: reportReason,
                description: reportDescription,
                timestamp: serverTimestamp(),
                status: 'pending',
                type: 'user'
            });

            Alert.alert(
                'Report Submitted',
                'Thank you for helping keep our community safe. Your report has been submitted for review.',
                [{
                    text: 'OK', onPress: () => {
                        setShowReportModal(false);
                        setReportReason('');
                        setReportDescription('');
                    }
                }]
            );
        } catch (error: any) {
            Alert.alert('Error', error.message);
        }
    };

    const blockUser = async () => {
        if (!selectedUser) return;

        Alert.alert(
            'Block User',
            `Are you sure you want to block ${selectedUser.displayName}? You won't see their messages or posts.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Block',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const currentBlocked = blockedUsers;
                            const newBlocked = [...currentBlocked, selectedUser.id];

                            await updateDoc(doc(db, 'users', auth.currentUser!.uid), {
                                blockedUsers: newBlocked
                            });

                            setBlockedUsers(newBlocked);
                            setSelectedUser(null);
                            Alert.alert('User Blocked', `${selectedUser.displayName} has been blocked.`);
                        } catch (error: any) {
                            Alert.alert('Error', error.message);
                        }
                    }
                }
            ]
        );
    };

    const showUserActions = () => {
        if (!selectedUser) return;

        Alert.alert(
            'User Actions',
            `Actions for ${selectedUser.displayName}`,
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Report User', onPress: () => setShowReportModal(true) },
                { text: 'Block User', style: 'destructive', onPress: blockUser }
            ]
        );
    };

    const formatTime = (timestamp: any) => {
        if (!timestamp) return '';
        const date = timestamp.toDate();
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return 'now';
        if (diffMins < 60) return `${diffMins}m`;
        if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h`;
        return `${Math.floor(diffMins / 1440)}d`;
    };

    const formatMessageTime = (timestamp: any) => {
        if (!timestamp) return '';
        const date = timestamp.toDate();
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const renderUserThumbnail = ({ item }: { item: User }) => (
        <TouchableOpacity
            style={styles.userThumbnail}
            onPress={() => setSelectedUser(item)}
        >
            {item.profileImageUrl ? (
                <Image source={{ uri: item.profileImageUrl }} style={styles.thumbnailImage} />
            ) : (
                <View style={[styles.thumbnailImage, styles.thumbnailPlaceholder]}>
                    <Text style={styles.thumbnailText}>
                        {item.displayName.charAt(0).toUpperCase()}
                    </Text>
                </View>
            )}
            <Text style={styles.thumbnailName} numberOfLines={1}>
                {item.displayName.split(' ')[0]}
            </Text>
        </TouchableOpacity>
    );

    const renderMessage = ({ item }: { item: MessageWithUser }) => {
        const isMyMessage = item.senderId === auth.currentUser?.uid;
        return (
            <TouchableOpacity
                style={styles.messageCard}
                onPress={() => setSelectedUser(item.otherUser)}
            >
                <View style={styles.messageHeader}>
                    {item.otherUser.profileImageUrl ? (
                        <Image source={{ uri: item.otherUser.profileImageUrl }} style={styles.messageAvatar} />
                    ) : (
                        <View style={[styles.messageAvatar, styles.avatarPlaceholder]}>
                            <Text style={styles.avatarText}>
                                {item.otherUser.displayName.charAt(0).toUpperCase()}
                            </Text>
                        </View>
                    )}
                    <View style={styles.messageInfo}>
                        <Text style={styles.messageSender}>
                            {isMyMessage ? `You → ${item.otherUser.displayName}` : `${item.otherUser.displayName} → You`}
                        </Text>
                        <Text style={styles.messageTime}>{formatTime(item.createdAt)}</Text>
                    </View>
                </View>
                <Text style={styles.messageText} numberOfLines={2}>{item.text}</Text>
            </TouchableOpacity>
        );
    };

    const renderUserMessage = ({ item }: { item: Message }) => {
        const isMyMessage = item.senderId === auth.currentUser?.uid;
        return (
            <View style={[styles.chatMessage, isMyMessage ? styles.myChatMessage : styles.otherChatMessage]}>
                <Text style={[styles.chatMessageText, isMyMessage ? styles.myChatMessageText : styles.otherChatMessageText]}>
                    {item.text}
                </Text>
                <Text style={[styles.chatMessageTime, isMyMessage ? styles.myChatMessageTime : styles.otherChatMessageTime]}>
                    {formatMessageTime(item.createdAt)}
                </Text>
            </View>
        );
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <Text>Loading...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Header with Guidelines Button */}
            <View style={styles.headerBar}>
                <Text style={styles.headerTitle}>Community Directory</Text>
                <TouchableOpacity
                    style={styles.guidelinesButton}
                    onPress={() => setShowGuidelines(true)}
                >
                    <Text style={styles.guidelinesButtonText}>📋 Guidelines</Text>
                </TouchableOpacity>
            </View>

            <ScrollView>
                {/* User Grid */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Community Members</Text>
                    <FlatList
                        data={users}
                        renderItem={renderUserThumbnail}
                        keyExtractor={(item) => item.id}
                        numColumns={4}
                        scrollEnabled={false}
                        contentContainerStyle={styles.userGrid}
                    />
                </View>

                {/* Recent Messages */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Recent Messages</Text>
                    {allMessages.length > 0 ? (
                        <FlatList
                            data={allMessages}
                            renderItem={renderMessage}
                            keyExtractor={(item) => item.id}
                            scrollEnabled={false}
                        />
                    ) : (
                        <View style={styles.emptyMessages}>
                            <Text style={styles.emptyText}>No messages yet</Text>
                            <Text style={styles.emptySubtext}>Tap on a profile above to start a conversation!</Text>
                        </View>
                    )}
                </View>
            </ScrollView>

            {/* User Profile & Chat Modal */}
            <Modal visible={!!selectedUser} animationType="slide">
                <SafeAreaView style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <TouchableOpacity onPress={() => setSelectedUser(null)}>
                            <Text style={styles.backButton}>← Back</Text>
                        </TouchableOpacity>
                        <Text style={styles.modalTitle}>
                            {selectedUser?.displayName}
                        </Text>
                        <TouchableOpacity onPress={showUserActions}>
                            <Text style={styles.backButton}>⋯</Text>
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.modalContent}>
                        {/* User Profile Section */}
                        {userProfile && (
                            <View style={styles.profileSection}>
                                <View style={styles.profileHeader}>
                                    {userProfile.profileImageUrl ? (
                                        <Image source={{ uri: userProfile.profileImageUrl }} style={styles.profileImage} />
                                    ) : (
                                        <View style={[styles.profileImage, styles.profileImagePlaceholder]}>
                                            <Text style={styles.profileImageText}>
                                                {userProfile.displayName.charAt(0).toUpperCase()}
                                            </Text>
                                        </View>
                                    )}
                                    <Text style={styles.profileName}>{userProfile.displayName}</Text>
                                    {userProfile.showEmail && <Text style={styles.profileEmail}>{userProfile.email}</Text>}
                                    {userProfile.showPhone && userProfile.phone && <Text style={styles.profilePhone}>{userProfile.phone}</Text>}
                                </View>

                                {userProfile.children && userProfile.children.length > 0 && (
                                    <View style={styles.childrenSection}>
                                        <Text style={styles.childrenTitle}>Children:</Text>
                                        {userProfile.children.map((child, index) => (
                                            <Text key={index} style={styles.childInfo}>
                                                {child.name} ({child.age}) - {child.daysAttending.join(', ')}
                                            </Text>
                                        ))}
                                    </View>
                                )}
                            </View>
                        )}

                        {/* Messages Section */}
                        <View style={styles.messagesSection}>
                            <Text style={styles.messagesSectionTitle}>Messages</Text>
                            {userMessages.length > 0 ? (
                                <FlatList
                                    data={userMessages}
                                    renderItem={renderUserMessage}
                                    keyExtractor={(item) => item.id}
                                    style={styles.chatMessagesList}
                                    scrollEnabled={false}
                                />
                            ) : (
                                <Text style={styles.noMessagesText}>No messages yet. Start the conversation!</Text>
                            )}
                        </View>
                    </ScrollView>

                    {/* Message Input */}
                    <View style={styles.messageInputContainer}>
                        <TextInput
                            style={styles.messageInput}
                            value={messageText}
                            onChangeText={setMessageText}
                            placeholder="Type a message..."
                            multiline
                        />
                        <TouchableOpacity
                            style={styles.sendButton}
                            onPress={sendMessage}
                        >
                            <Text style={styles.sendButtonText}>Send</Text>
                        </TouchableOpacity>
                    </View>
                </SafeAreaView>
            </Modal>

            {/* Report User Modal */}
            <Modal visible={showReportModal} animationType="slide" transparent={true}>
                <View style={styles.reportModalOverlay}>
                    <View style={styles.reportModalContent}>
                        <Text style={styles.reportModalTitle}>Report User</Text>
                        <Text style={styles.reportModalSubtitle}>
                            Help keep our community safe by reporting inappropriate behavior.
                        </Text>

                        <Text style={styles.reportLabel}>Reason for reporting: *</Text>
                        <View style={styles.reasonButtons}>
                            {['Inappropriate content', 'Harassment', 'Spam', 'Safety concern', 'Other'].map((reason) => (
                                <TouchableOpacity
                                    key={reason}
                                    style={[
                                        styles.reasonButton,
                                        reportReason === reason && styles.reasonButtonSelected
                                    ]}
                                    onPress={() => setReportReason(reason)}
                                >
                                    <Text style={[
                                        styles.reasonButtonText,
                                        reportReason === reason && styles.reasonButtonTextSelected
                                    ]}>
                                        {reason}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text style={styles.reportLabel}>Additional details (optional):</Text>
                        <TextInput
                            style={styles.reportTextInput}
                            value={reportDescription}
                            onChangeText={setReportDescription}
                            placeholder="Please provide any additional context..."
                            multiline
                            numberOfLines={4}
                        />

                        <View style={styles.reportModalButtons}>
                            <TouchableOpacity
                                style={[styles.reportModalButton, styles.reportCancelButton]}
                                onPress={() => {
                                    setShowReportModal(false);
                                    setReportReason('');
                                    setReportDescription('');
                                }}
                            >
                                <Text style={styles.reportCancelButtonText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.reportModalButton, styles.reportSubmitButton]}
                                onPress={reportUser}
                            >
                                <Text style={styles.reportSubmitButtonText}>Submit Report</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Community Guidelines Modal */}
            <Modal
                visible={showGuidelines}
                animationType="slide"
                presentationStyle="pageSheet"
            >
                <CommunityGuidelinesScreen onClose={() => setShowGuidelines(false)} />
            </Modal>
        </View>
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
        marginBottom: 15,
        paddingVertical: 15,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 15,
        paddingHorizontal: 15,
    },
    userGrid: {
        paddingHorizontal: 15,
    },
    userThumbnail: {
        width: GRID_ITEM_SIZE,
        alignItems: 'center',
        marginBottom: 15,
        marginHorizontal: 5,
    },
    thumbnailImage: {
        width: GRID_ITEM_SIZE - 10,
        height: GRID_ITEM_SIZE - 10,
        borderRadius: (GRID_ITEM_SIZE - 10) / 2,
        marginBottom: 5,
    },
    thumbnailPlaceholder: {
        backgroundColor: '#2c5f7c',
        justifyContent: 'center',
        alignItems: 'center',
    },
    thumbnailText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    thumbnailName: {
        fontSize: 12,
        color: '#666',
        textAlign: 'center',
    },
    messageCard: {
        backgroundColor: '#f9f9f9',
        padding: 15,
        marginHorizontal: 15,
        marginBottom: 10,
        borderRadius: 8,
    },
    messageHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    messageAvatar: {
        width: 30,
        height: 30,
        borderRadius: 15,
        marginRight: 10,
    },
    avatarPlaceholder: {
        backgroundColor: '#2c5f7c',
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold',
    },
    messageInfo: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    messageSender: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
    },
    messageTime: {
        fontSize: 12,
        color: '#999',
    },
    messageText: {
        fontSize: 14,
        color: '#666',
    },
    emptyMessages: {
        padding: 40,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 16,
        color: '#999',
        marginBottom: 5,
    },
    emptySubtext: {
        fontSize: 14,
        color: '#bbb',
        textAlign: 'center',
    },
    modalContainer: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 15,
        backgroundColor: '#2c5f7c',
    },
    backButton: {
        color: '#fff',
        fontSize: 16,
        width: 60,
    },
    modalTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    modalContent: {
        flex: 1,
    },
    profileSection: {
        backgroundColor: '#fff',
        padding: 20,
        marginBottom: 15,
    },
    profileHeader: {
        alignItems: 'center',
        marginBottom: 15,
    },
    profileImage: {
        width: 80,
        height: 80,
        borderRadius: 40,
        marginBottom: 10,
    },
    profileImagePlaceholder: {
        backgroundColor: '#2c5f7c',
        justifyContent: 'center',
        alignItems: 'center',
    },
    profileImageText: {
        color: '#fff',
        fontSize: 24,
        fontWeight: 'bold',
    },
    profileName: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 5,
    },
    profileEmail: {
        fontSize: 14,
        color: '#666',
        marginBottom: 3,
    },
    profilePhone: {
        fontSize: 14,
        color: '#666',
    },
    childrenSection: {
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
        paddingTop: 15,
    },
    childrenTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginBottom: 8,
    },
    childInfo: {
        fontSize: 14,
        color: '#666',
        marginBottom: 5,
    },
    messagesSection: {
        backgroundColor: '#fff',
        padding: 20,
        flex: 1,
    },
    messagesSectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginBottom: 15,
    },
    chatMessagesList: {
        flex: 1,
    },
    chatMessage: {
        maxWidth: '75%',
        marginVertical: 2,
        padding: 10,
        borderRadius: 12,
    },
    myChatMessage: {
        alignSelf: 'flex-end',
        backgroundColor: '#2c5f7c',
    },
    otherChatMessage: {
        alignSelf: 'flex-start',
        backgroundColor: '#e0e0e0',
    },
    chatMessageText: {
        fontSize: 16,
        marginBottom: 4,
    },
    myChatMessageText: {
        color: '#fff',
    },
    otherChatMessageText: {
        color: '#333',
    },
    chatMessageTime: {
        fontSize: 11,
    },
    myChatMessageTime: {
        color: 'rgba(255,255,255,0.7)',
        textAlign: 'right',
    },
    otherChatMessageTime: {
        color: '#999',
    },
    noMessagesText: {
        fontSize: 14,
        color: '#999',
        textAlign: 'center',
        fontStyle: 'italic',
    },
    messageInputContainer: {
        flexDirection: 'row',
        padding: 15,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#e0e0e0',
        gap: 10,
    },
    messageInput: {
        flex: 1,
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 20,
        paddingHorizontal: 15,
        paddingVertical: 10,
        fontSize: 16,
        maxHeight: 100,
    },
    sendButton: {
        backgroundColor: '#2c5f7c',
        paddingHorizontal: 20,
        borderRadius: 20,
        justifyContent: 'center',
    },
    sendButtonText: {
        color: '#fff',
        fontWeight: '600',
    },
    reportModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        padding: 20,
    },
    reportModalContent: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 20,
        maxHeight: '80%',
    },
    reportModalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 8,
    },
    reportModalSubtitle: {
        fontSize: 14,
        color: '#666',
        marginBottom: 20,
        lineHeight: 20,
    },
    reportLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginBottom: 10,
    },
    reasonButtons: {
        marginBottom: 20,
    },
    reasonButton: {
        padding: 12,
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        marginBottom: 8,
        backgroundColor: '#fff',
    },
    reasonButtonSelected: {
        backgroundColor: '#2c5f7c',
        borderColor: '#2c5f7c',
    },
    reasonButtonText: {
        fontSize: 14,
        color: '#333',
        textAlign: 'center',
    },
    reasonButtonTextSelected: {
        color: '#fff',
        fontWeight: '600',
    },
    reportTextInput: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        padding: 12,
        fontSize: 14,
        textAlignVertical: 'top',
        marginBottom: 20,
        minHeight: 80,
    },
    reportModalButtons: {
        flexDirection: 'row',
        gap: 10,
    },
    reportModalButton: {
        flex: 1,
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    reportCancelButton: {
        backgroundColor: '#f0f0f0',
    },
    reportCancelButtonText: {
        color: '#666',
        fontWeight: '600',
    },
    reportSubmitButton: {
        backgroundColor: '#d32f2f',
    },
    reportSubmitButtonText: {
        color: '#fff',
        fontWeight: '600',
    },
    headerBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 15,
        backgroundColor: '#2c5f7c',
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff',
    },
    guidelinesButton: {
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 15,
    },
    guidelinesButtonText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
    },
});