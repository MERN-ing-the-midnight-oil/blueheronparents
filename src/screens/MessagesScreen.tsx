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
    SafeAreaView
} from 'react-native';
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
    or,
    updateDoc
} from 'firebase/firestore';
import { db, auth } from '../../firebase.config';
import { sendNotificationToUsers } from '../utils/notifications';

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

interface Conversation {
    id: string;
    participants: string[];
    lastMessage: string;
    lastMessageTime: any;
    lastMessageSender: string;
    unreadCount?: { [userId: string]: number };
}

interface ConversationWithUser extends Conversation {
    otherUser: User;
}

export default function MessagesScreen() {
    const [conversations, setConversations] = useState<ConversationWithUser[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [showNewMessage, setShowNewMessage] = useState(false);
    const [showConversation, setShowConversation] = useState<ConversationWithUser | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [messageText, setMessageText] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadUsers();
        loadConversations();
    }, []);

    useEffect(() => {
        if (!showConversation) return;

        const q = query(
            collection(db, 'messages'),
            where('conversationId', '==', showConversation.id),
            orderBy('createdAt', 'asc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            try {
                const messagesData = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                } as Message));
                setMessages(messagesData);

                // Mark messages as read
                markMessagesAsRead(showConversation.id);
            } catch (error) {
                console.error('Error loading messages:', error);
                setMessages([]);
            }
        }, (error) => {
            console.error('Messages listener error:', error);
            setMessages([]);
        });

        return unsubscribe;
    }, [showConversation]);

    const loadUsers = async () => {
        try {
            const q = query(collection(db, 'users'));
            const querySnapshot = await getDocs(q);
            const usersData = querySnapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() } as User))
                .filter(user => user.id !== auth.currentUser?.uid); // Exclude current user
            setUsers(usersData);
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setLoading(false);
        }
    };

    const loadConversations = () => {
        if (!auth.currentUser) return;

        const q = query(
            collection(db, 'conversations'),
            where('participants', 'array-contains', auth.currentUser.uid)
        );

        const unsubscribe = onSnapshot(q, async (snapshot) => {
            try {
                if (snapshot.empty) {
                    setConversations([]);
                    return;
                }

                const conversationsData = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                } as Conversation));

                // Get user data for each conversation
                const conversationsWithUsers = await Promise.all(
                    conversationsData.map(async (conv) => {
                        const otherUserId = conv.participants.find(id => id !== auth.currentUser?.uid);
                        if (!otherUserId) return null;

                        try {
                            const userDoc = await getDoc(doc(db, 'users', otherUserId));
                            const userData = userDoc.exists() ? { id: userDoc.id, ...userDoc.data() } as User : null;

                            if (!userData) return null;

                            return {
                                ...conv,
                                otherUser: userData
                            } as ConversationWithUser;
                        } catch (error) {
                            console.error('Error loading user data:', error);
                            return null;
                        }
                    })
                );

                setConversations(conversationsWithUsers.filter(Boolean) as ConversationWithUser[]);
            } catch (error) {
                console.error('Error processing conversations:', error);
                setConversations([]);
            }
        }, (error) => {
            console.error('Conversations listener error:', error);
            setConversations([]);
        });

        return unsubscribe;
    };

    const markMessagesAsRead = async (conversationId: string) => {
        try {
            const q = query(
                collection(db, 'messages'),
                where('conversationId', '==', conversationId),
                where('recipientId', '==', auth.currentUser?.uid),
                where('read', '==', false)
            );

            const snapshot = await getDocs(q);

            // Update each unread message
            const updates = snapshot.docs.map(messageDoc =>
                updateDoc(doc(db, 'messages', messageDoc.id), { read: true })
            );

            await Promise.all(updates);
        } catch (error) {
            console.error('Error marking messages as read:', error);
        }
    };

    const createOrGetConversation = async (otherUserId: string): Promise<string> => {
        // Check if conversation already exists
        const q = query(
            collection(db, 'conversations'),
            where('participants', 'array-contains', auth.currentUser!.uid)
        );

        const snapshot = await getDocs(q);
        const existingConv = snapshot.docs.find(doc => {
            const data = doc.data();
            return data.participants.includes(otherUserId);
        });

        if (existingConv) {
            return existingConv.id;
        }

        // Create new conversation
        const conversationData = {
            participants: [auth.currentUser!.uid, otherUserId],
            lastMessage: '',
            lastMessageTime: serverTimestamp(),
            lastMessageSender: '',
            unreadCount: {
                [auth.currentUser!.uid]: 0,
                [otherUserId]: 0
            }
        };

        const docRef = await addDoc(collection(db, 'conversations'), conversationData);
        return docRef.id;
    };

    const sendMessage = async () => {
        if (!messageText.trim() || !showConversation) return;

        try {
            const conversationId = await createOrGetConversation(showConversation.otherUser.id);

            // Add message
            await addDoc(collection(db, 'messages'), {
                text: messageText,
                senderId: auth.currentUser!.uid,
                recipientId: showConversation.otherUser.id,
                conversationId,
                createdAt: serverTimestamp(),
                read: false
            });

            // Update conversation
            await updateDoc(doc(db, 'conversations', conversationId), {
                lastMessage: messageText,
                lastMessageTime: serverTimestamp(),
                lastMessageSender: auth.currentUser!.uid
            });

            // Send notification to recipient
            const previewText = messageText.length > 50 ? messageText.substring(0, 50) + '...' : messageText;
            const senderDoc = await getDoc(doc(db, 'users', auth.currentUser!.uid));
            const senderName = senderDoc.exists() ? senderDoc.data().displayName : auth.currentUser?.email?.split('@')[0];

            await sendNotificationToUsers(
                [showConversation.otherUser.id],
                `Message from ${senderName}`,
                previewText,
                'messages'
            );

            setMessageText('');
        } catch (error: any) {
            Alert.alert('Error', error.message);
        }
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

    const renderConversation = ({ item }: { item: ConversationWithUser }) => (
        <TouchableOpacity
            style={styles.conversationCard}
            onPress={() => setShowConversation(item)}
        >
            {item.otherUser.profileImageUrl ? (
                <Image source={{ uri: item.otherUser.profileImageUrl }} style={styles.avatar} />
            ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                    <Text style={styles.avatarText}>
                        {item.otherUser.displayName.charAt(0).toUpperCase()}
                    </Text>
                </View>
            )}

            <View style={styles.conversationInfo}>
                <View style={styles.conversationListHeader}>
                    <Text style={styles.userName}>{item.otherUser.displayName}</Text>
                    <Text style={styles.timeText}>{formatTime(item.lastMessageTime)}</Text>
                </View>
                <Text style={styles.lastMessage} numberOfLines={1}>
                    {item.lastMessage || 'No messages yet'}
                </Text>
                {item.otherUser.children && item.otherUser.children.length > 0 && (
                    <Text style={styles.childrenInfo} numberOfLines={1}>
                        Parent of {item.otherUser.children.map(c => c.name).join(', ')}
                    </Text>
                )}
            </View>
        </TouchableOpacity>
    );

    const startConversation = async (otherUserId: string) => {
        try {
            const conversationId = await createOrGetConversation(otherUserId);

            // Find the conversation in our list or create a mock one to show
            let conversation = conversations.find(c => c.otherUser.id === otherUserId);

            if (!conversation) {
                // Create a temporary conversation object for display
                const otherUser = users.find(u => u.id === otherUserId);
                if (otherUser) {
                    conversation = {
                        id: conversationId,
                        participants: [auth.currentUser!.uid, otherUserId],
                        lastMessage: '',
                        lastMessageTime: null,
                        lastMessageSender: '',
                        otherUser: otherUser
                    };
                }
            }

            if (conversation) {
                setShowNewMessage(false);
                setShowConversation(conversation);
            }
        } catch (error: any) {
            Alert.alert('Error', error.message);
        }
    };

    const renderUser = ({ item }: { item: User }) => (
        <TouchableOpacity
            style={styles.userCard}
            onPress={() => startConversation(item.id)}
        >
            {item.profileImageUrl ? (
                <Image source={{ uri: item.profileImageUrl }} style={styles.avatar} />
            ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                    <Text style={styles.avatarText}>
                        {item.displayName.charAt(0).toUpperCase()}
                    </Text>
                </View>
            )}

            <View style={styles.userInfo}>
                <Text style={styles.userName}>{item.displayName}</Text>
                <Text style={styles.userEmail}>{item.email}</Text>
                {item.children && item.children.length > 0 && (
                    <Text style={styles.childrenInfo}>
                        Parent of {item.children.map(c => c.name).join(', ')}
                    </Text>
                )}
            </View>
        </TouchableOpacity>
    );

    const renderMessage = ({ item }: { item: Message }) => {
        const isMyMessage = item.senderId === auth.currentUser?.uid;
        return (
            <View style={[styles.messageContainer, isMyMessage ? styles.myMessage : styles.otherMessage]}>
                <Text style={[styles.messageText, isMyMessage ? styles.myMessageText : styles.otherMessageText]}>
                    {item.text}
                </Text>
                <Text style={[styles.messageTime, isMyMessage ? styles.myMessageTime : styles.otherMessageTime]}>
                    {formatMessageTime(item.createdAt)}
                </Text>
            </View>
        );
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <Text>Loading messages...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Messages</Text>
                <TouchableOpacity
                    style={styles.newMessageButton}
                    onPress={() => setShowNewMessage(true)}
                >
                    <Text style={styles.newMessageButtonText}>New</Text>
                </TouchableOpacity>
            </View>

            <FlatList
                data={conversations}
                keyExtractor={(item) => item.id}
                renderItem={renderConversation}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyTitle}>No conversations yet</Text>
                        <Text style={styles.emptyText}>Start a conversation with other parents!</Text>
                        <TouchableOpacity
                            style={styles.startButton}
                            onPress={() => setShowNewMessage(true)}
                        >
                            <Text style={styles.startButtonText}>Send First Message</Text>
                        </TouchableOpacity>
                    </View>
                }
            />

            {/* New Message Modal */}
            <Modal visible={showNewMessage} animationType="slide">
                <SafeAreaView style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <TouchableOpacity onPress={() => setShowNewMessage(false)}>
                            <Text style={styles.modalHeaderButton}>Cancel</Text>
                        </TouchableOpacity>
                        <Text style={styles.modalHeaderTitle}>New Message</Text>
                        <View style={styles.modalHeaderButton} />
                    </View>

                    <FlatList
                        data={users}
                        keyExtractor={(item) => item.id}
                        renderItem={renderUser}
                        style={styles.usersList}
                    />
                </SafeAreaView>
            </Modal>

            {/* Conversation Modal */}
            <Modal visible={!!showConversation} animationType="slide">
                <SafeAreaView style={styles.conversationModal}>
                    <View style={styles.conversationHeader}>
                        <TouchableOpacity onPress={() => setShowConversation(null)}>
                            <Text style={styles.backButton}>← Back</Text>
                        </TouchableOpacity>
                        <Text style={styles.conversationTitle}>
                            {showConversation?.otherUser.displayName}
                        </Text>
                        <View style={styles.backButton} />
                    </View>

                    <FlatList
                        data={messages}
                        keyExtractor={(item) => item.id}
                        renderItem={renderMessage}
                        style={styles.messagesList}
                    />

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
                            onPress={() => sendMessage()}
                        >
                            <Text style={styles.sendButtonText}>Send</Text>
                        </TouchableOpacity>
                    </View>
                </SafeAreaView>
            </Modal>
        </View>
    );
}

// ...existing styles remain the same...
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
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 15,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
    },
    newMessageButton: {
        backgroundColor: '#2c5f7c',
        paddingHorizontal: 15,
        paddingVertical: 8,
        borderRadius: 6,
    },
    newMessageButtonText: {
        color: '#fff',
        fontWeight: '600',
    },
    conversationCard: {
        flexDirection: 'row',
        padding: 15,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    avatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        marginRight: 12,
    },
    avatarPlaceholder: {
        backgroundColor: '#2c5f7c',
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    conversationInfo: {
        flex: 1,
    },
    conversationListHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    userName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
    },
    timeText: {
        fontSize: 12,
        color: '#999',
    },
    lastMessage: {
        fontSize: 14,
        color: '#666',
        marginBottom: 4,
    },
    childrenInfo: {
        fontSize: 12,
        color: '#999',
        fontStyle: 'italic',
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
        color: '#333',
        marginBottom: 8,
    },
    emptyText: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
        marginBottom: 20,
    },
    startButton: {
        backgroundColor: '#2c5f7c',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 8,
    },
    startButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
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
    modalHeaderButton: {
        color: '#fff',
        fontSize: 16,
        width: 60,
    },
    modalHeaderTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    usersList: {
        flex: 1,
    },
    userCard: {
        flexDirection: 'row',
        padding: 15,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    userInfo: {
        flex: 1,
    },
    userEmail: {
        fontSize: 14,
        color: '#666',
        marginBottom: 4,
    },
    conversationModal: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    conversationHeader: {
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
    conversationTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    messagesList: {
        flex: 1,
        padding: 10,
    },
    messageContainer: {
        maxWidth: '75%',
        marginVertical: 2,
        padding: 10,
        borderRadius: 12,
    },
    myMessage: {
        alignSelf: 'flex-end',
        backgroundColor: '#2c5f7c',
    },
    otherMessage: {
        alignSelf: 'flex-start',
        backgroundColor: '#fff',
    },
    messageText: {
        fontSize: 16,
        marginBottom: 4,
    },
    myMessageText: {
        color: '#fff',
    },
    otherMessageText: {
        color: '#333',
    },
    messageTime: {
        fontSize: 11,
    },
    myMessageTime: {
        color: 'rgba(255,255,255,0.7)',
        textAlign: 'right',
    },
    otherMessageTime: {
        color: '#999',
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
});