import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, Alert, Modal, Image, SafeAreaView } from 'react-native';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, updateDoc, deleteDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import * as ImagePicker from 'expo-image-picker';
import { db, auth, storage } from '../../firebase.config';

interface Comment {
    id: string;
    text: string;
    authorEmail: string;
    userId: string;
    createdAt: any;
}

interface Post {
    id: string;
    text: string;
    authorEmail: string;
    createdAt: any;
    userId: string;
    likes?: string[];
    commentCount?: number;
    imageUrl?: string;
}

export default function BulletinBoardScreen() {
    const [postText, setPostText] = useState('');
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(false);
    const [editingPost, setEditingPost] = useState<Post | null>(null);
    const [editText, setEditText] = useState('');
    const [viewingComments, setViewingComments] = useState<Post | null>(null);
    const [comments, setComments] = useState<Comment[]>([]);
    const [commentText, setCommentText] = useState('');
    const [selectedImage, setSelectedImage] = useState<string | null>(null);

    useEffect(() => {
        const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const postsData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                likes: doc.data().likes || [],
            } as Post));
            setPosts(postsData);
        });

        return unsubscribe;
    }, []);

    useEffect(() => {
        if (!viewingComments) return;

        const q = query(
            collection(db, 'posts', viewingComments.id, 'comments'),
            orderBy('createdAt', 'asc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const commentsData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Comment));
            setComments(commentsData);
        });

        return unsubscribe;
    }, [viewingComments]);

    const pickImage = async () => {
        const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (!permissionResult.granted) {
            Alert.alert('Permission Required', 'Please allow access to your photos');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.7,
        });

        if (!result.canceled) {
            setSelectedImage(result.assets[0].uri);
        }
    };

    const uploadImage = async (uri: string, postId: string) => {
        const response = await fetch(uri);
        const blob = await response.blob();

        const storageRef = ref(storage, `posts/${postId}/${Date.now()}.jpg`);
        await uploadBytes(storageRef, blob);

        const downloadURL = await getDownloadURL(storageRef);
        return downloadURL;
    };

    const handlePost = async () => {
        if (!postText.trim() && !selectedImage) {
            Alert.alert('Error', 'Please write something or add a photo!');
            return;
        }

        setLoading(true);
        try {
            const postData: any = {
                text: postText,
                authorEmail: auth.currentUser?.email,
                userId: auth.currentUser?.uid,
                createdAt: serverTimestamp(),
                likes: [],
                commentCount: 0,
            };

            const docRef = await addDoc(collection(db, 'posts'), postData);

            if (selectedImage) {
                const imageUrl = await uploadImage(selectedImage, docRef.id);
                await updateDoc(docRef, { imageUrl });
            }

            setPostText('');
            setSelectedImage(null);
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleLike = async (post: Post) => {
        const userId = auth.currentUser?.uid;
        if (!userId) return;

        const postRef = doc(db, 'posts', post.id);
        const isLiked = post.likes?.includes(userId);

        try {
            await updateDoc(postRef, {
                likes: isLiked ? arrayRemove(userId) : arrayUnion(userId)
            });
        } catch (error: any) {
            Alert.alert('Error', error.message);
        }
    };

    const handleEdit = (post: Post) => {
        setEditingPost(post);
        setEditText(post.text);
    };

    const handleUpdate = async () => {
        if (!editingPost || !editText.trim()) return;

        try {
            await updateDoc(doc(db, 'posts', editingPost.id), {
                text: editText,
                editedAt: serverTimestamp(),
            });
            setEditingPost(null);
            setEditText('');
        } catch (error: any) {
            Alert.alert('Error', error.message);
        }
    };

    const handleDelete = async (postId: string) => {
        Alert.alert(
            'Delete Post',
            'Are you sure you want to delete this post?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await deleteDoc(doc(db, 'posts', postId));
                        } catch (error: any) {
                            Alert.alert('Error', error.message);
                        }
                    }
                }
            ]
        );
    };

    const handleComment = async () => {
        if (!viewingComments || !commentText.trim()) return;

        try {
            await addDoc(collection(db, 'posts', viewingComments.id, 'comments'), {
                text: commentText,
                authorEmail: auth.currentUser?.email,
                userId: auth.currentUser?.uid,
                createdAt: serverTimestamp(),
            });

            await updateDoc(doc(db, 'posts', viewingComments.id), {
                commentCount: (viewingComments.commentCount || 0) + 1,
            });

            setCommentText('');
        } catch (error: any) {
            Alert.alert('Error', error.message);
        }
    };

    const formatDate = (timestamp: any) => {
        if (!timestamp) return 'Just now';
        const date = timestamp.toDate();
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
        return `${Math.floor(diffMins / 1440)}d ago`;
    };

    const isMyPost = (userId: string) => userId === auth.currentUser?.uid;

    return (
        <View style={styles.container}>
            <View style={styles.inputContainer}>
                <TextInput
                    style={styles.input}
                    placeholder="Share something with the community..."
                    value={postText}
                    onChangeText={setPostText}
                    multiline
                    maxLength={500}
                />

                {selectedImage && (
                    <View style={styles.imagePreviewContainer}>
                        <Image source={{ uri: selectedImage }} style={styles.imagePreview} />
                        <TouchableOpacity
                            style={styles.removeImageButton}
                            onPress={() => setSelectedImage(null)}
                        >
                            <Text style={styles.removeImageText}>✕</Text>
                        </TouchableOpacity>
                    </View>
                )}

                <View style={styles.postActionsRow}>
                    <TouchableOpacity
                        style={styles.photoButton}
                        onPress={pickImage}
                    >
                        <Text style={styles.photoButtonText}>📷 Photo</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.postButton, loading && styles.postButtonDisabled]}
                        onPress={handlePost}
                        disabled={loading}
                    >
                        <Text style={styles.postButtonText}>Post</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <FlatList
                data={posts}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                    <View style={styles.postCard}>
                        <View style={styles.postHeader}>
                            <Text style={styles.authorEmail}>{item.authorEmail}</Text>
                            <Text style={styles.timestamp}>{formatDate(item.createdAt)}</Text>
                        </View>

                        <Text style={styles.postText}>{item.text}</Text>

                        {item.imageUrl && (
                            <Image
                                source={{ uri: item.imageUrl }}
                                style={styles.postImage}
                                resizeMode="cover"
                            />
                        )}

                        <View style={styles.actionsRow}>
                            <TouchableOpacity
                                style={styles.actionButton}
                                onPress={() => handleLike(item)}
                            >
                                <Text style={styles.actionText}>
                                    {item.likes?.includes(auth.currentUser?.uid || '') ? '❤️' : '🤍'} {item.likes?.length || 0}
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.actionButton}
                                onPress={() => setViewingComments(item)}
                            >
                                <Text style={styles.actionText}>
                                    💬 {item.commentCount || 0}
                                </Text>
                            </TouchableOpacity>

                            {isMyPost(item.userId) && (
                                <>
                                    <TouchableOpacity
                                        style={styles.actionButton}
                                        onPress={() => handleEdit(item)}
                                    >
                                        <Text style={styles.actionText}>✏️ Edit</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={styles.actionButton}
                                        onPress={() => handleDelete(item.id)}
                                    >
                                        <Text style={[styles.actionText, styles.deleteText]}>🗑️ Delete</Text>
                                    </TouchableOpacity>
                                </>
                            )}
                        </View>
                    </View>
                )}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>No posts yet. Be the first to share!</Text>
                    </View>
                }
            />

            {/* Edit Modal */}
            <Modal visible={!!editingPost} animationType="slide" transparent={true}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Edit Post</Text>
                        <TextInput
                            style={styles.modalInput}
                            value={editText}
                            onChangeText={setEditText}
                            multiline
                            maxLength={500}
                        />
                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.cancelButton]}
                                onPress={() => setEditingPost(null)}
                            >
                                <Text style={styles.cancelButtonText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.saveButton]}
                                onPress={handleUpdate}
                            >
                                <Text style={styles.saveButtonText}>Save</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Comments Modal */}
            <Modal visible={!!viewingComments} animationType="slide">
                <SafeAreaView style={styles.modalSafeArea}>
                    <View style={styles.commentsContainer}>
                        <View style={styles.commentsHeader}>
                            <Text style={styles.commentsTitle}>Comments</Text>
                            <TouchableOpacity
                                onPress={() => setViewingComments(null)}
                                style={styles.closeButtonContainer}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <Text style={styles.closeButton}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.originalPost}>
                            <Text style={styles.originalAuthor}>{viewingComments?.authorEmail}</Text>
                            <Text style={styles.originalText}>{viewingComments?.text}</Text>
                            {viewingComments?.imageUrl && (
                                <Image
                                    source={{ uri: viewingComments.imageUrl }}
                                    style={styles.originalPostImage}
                                    resizeMode="cover"
                                />
                            )}
                        </View>

                        <FlatList
                            data={comments}
                            keyExtractor={(item) => item.id}
                            renderItem={({ item }) => (
                                <View style={styles.commentCard}>
                                    <Text style={styles.commentAuthor}>{item.authorEmail}</Text>
                                    <Text style={styles.commentText}>{item.text}</Text>
                                    <Text style={styles.commentTime}>{formatDate(item.createdAt)}</Text>
                                </View>
                            )}
                            ListEmptyComponent={
                                <View style={styles.emptyComments}>
                                    <Text style={styles.emptyCommentsText}>No comments yet. Be the first!</Text>
                                </View>
                            }
                        />

                        <View style={styles.commentInputContainer}>
                            <TextInput
                                style={styles.commentInput}
                                placeholder="Write a comment..."
                                value={commentText}
                                onChangeText={setCommentText}
                                multiline
                            />
                            <TouchableOpacity
                                style={styles.commentButton}
                                onPress={handleComment}
                            >
                                <Text style={styles.commentButtonText}>Send</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </SafeAreaView>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    inputContainer: {
        backgroundColor: '#fff',
        padding: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
    },
    input: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        minHeight: 80,
        textAlignVertical: 'top',
        marginBottom: 10,
    },
    imagePreviewContainer: {
        position: 'relative',
        marginBottom: 10,
    },
    imagePreview: {
        width: '100%',
        height: 200,
        borderRadius: 8,
    },
    removeImageButton: {
        position: 'absolute',
        top: 10,
        right: 10,
        backgroundColor: 'rgba(0,0,0,0.6)',
        width: 30,
        height: 30,
        borderRadius: 15,
        justifyContent: 'center',
        alignItems: 'center',
    },
    removeImageText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    postActionsRow: {
        flexDirection: 'row',
        gap: 10,
    },
    photoButton: {
        backgroundColor: '#f0f0f0',
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
        flex: 1,
    },
    photoButtonText: {
        color: '#666',
        fontSize: 16,
        fontWeight: '600',
    },
    postButton: {
        backgroundColor: '#2c5f7c',
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
        flex: 1,
    },
    postButtonDisabled: {
        opacity: 0.6,
    },
    postButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    postCard: {
        backgroundColor: '#fff',
        padding: 15,
        marginHorizontal: 15,
        marginTop: 15,
        borderRadius: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    postHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    authorEmail: {
        fontWeight: '600',
        fontSize: 14,
        color: '#2c5f7c',
    },
    timestamp: {
        fontSize: 12,
        color: '#999',
    },
    postText: {
        fontSize: 16,
        color: '#333',
        lineHeight: 22,
        marginBottom: 10,
    },
    postImage: {
        width: '100%',
        height: 250,
        borderRadius: 8,
        marginBottom: 10,
    },
    actionsRow: {
        flexDirection: 'row',
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
        paddingTop: 10,
        gap: 15,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    actionText: {
        fontSize: 14,
        color: '#666',
    },
    deleteText: {
        color: '#d32f2f',
    },
    emptyContainer: {
        padding: 40,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 16,
        color: '#999',
        textAlign: 'center',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 20,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 15,
    },
    modalInput: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        minHeight: 100,
        textAlignVertical: 'top',
        marginBottom: 15,
    },
    modalButtons: {
        flexDirection: 'row',
        gap: 10,
    },
    modalButton: {
        flex: 1,
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    cancelButton: {
        backgroundColor: '#f0f0f0',
    },
    cancelButtonText: {
        color: '#666',
        fontWeight: '600',
    },
    saveButton: {
        backgroundColor: '#2c5f7c',
    },
    saveButtonText: {
        color: '#fff',
        fontWeight: '600',
    },
    modalSafeArea: {
        flex: 1,
        backgroundColor: '#2c5f7c',
    },
    commentsContainer: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    commentsHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 15,
        backgroundColor: '#2c5f7c',
    },
    commentsTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#fff',
    },
    closeButtonContainer: {
        padding: 5,
        minWidth: 40,
        alignItems: 'center',
    },
    closeButton: {
        fontSize: 28,
        color: '#fff',
        fontWeight: 'bold',
    },
    originalPost: {
        backgroundColor: '#fff',
        padding: 15,
        borderBottomWidth: 2,
        borderBottomColor: '#e0e0e0',
    },
    originalAuthor: {
        fontWeight: '600',
        fontSize: 14,
        color: '#2c5f7c',
        marginBottom: 5,
    },
    originalText: {
        fontSize: 16,
        color: '#333',
        marginBottom: 10,
    },
    originalPostImage: {
        width: '100%',
        height: 200,
        borderRadius: 8,
    },
    commentCard: {
        backgroundColor: '#fff',
        padding: 12,
        marginHorizontal: 15,
        marginTop: 10,
        borderRadius: 8,
    },
    commentAuthor: {
        fontWeight: '600',
        fontSize: 13,
        color: '#2c5f7c',
        marginBottom: 4,
    },
    commentText: {
        fontSize: 15,
        color: '#333',
        marginBottom: 4,
    },
    commentTime: {
        fontSize: 11,
        color: '#999',
    },
    emptyComments: {
        padding: 40,
        alignItems: 'center',
    },
    emptyCommentsText: {
        fontSize: 14,
        color: '#999',
    },
    commentInputContainer: {
        flexDirection: 'row',
        padding: 15,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#e0e0e0',
        gap: 10,
    },
    commentInput: {
        flex: 1,
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        padding: 10,
        fontSize: 15,
        maxHeight: 100,
    },
    commentButton: {
        backgroundColor: '#2c5f7c',
        paddingHorizontal: 20,
        borderRadius: 8,
        justifyContent: 'center',
    },
    commentButtonText: {
        color: '#fff',
        fontWeight: '600',
    },
});