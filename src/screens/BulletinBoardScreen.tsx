import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, FlatList, Alert, Modal, Image, SafeAreaView } from 'react-native';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, updateDoc, deleteDoc, arrayUnion, arrayRemove, getDocs, getDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth, storage } from '../../firebase.config';
import { sendNotificationToUsers } from '../utils/notifications';
import { isAdmin } from '../utils/admin';

interface Comment {
    id: string;
    text: string;
    authorDisplayName?: string;
    authorEmail?: string;
    authorProfileImageUrl?: string;
    userId: string;
    createdAt: any;
}

interface Post {
    id: string;
    text: string;
    authorDisplayName?: string;
    authorEmail?: string;
    authorProfileImageUrl?: string;
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
    const [userIsAdmin, setUserIsAdmin] = useState(false);
    const [nestNewsPinnedPostIds, setNestNewsPinnedPostIds] = useState<string[]>([]);
    const [nestNewsHiddenPostIds, setNestNewsHiddenPostIds] = useState<string[]>([]);

    useEffect(() => {
        // Check if user is admin
        const checkAdminStatus = async () => {
            const adminStatus = await isAdmin();
            setUserIsAdmin(adminStatus);
        };
        checkAdminStatus();

        const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            try {
            const postsData = snapshot.docs.map(docSnap => {
                const data = docSnap.data() as any;
                const fallbackEmail = data.authorEmail || 'unknown@blueheronparents.com';
                const fallbackDisplayName = data.authorDisplayName || fallbackEmail.split('@')[0] || 'Anonymous';
                return {
                    id: docSnap.id,
                    ...data,
                    authorEmail: fallbackEmail,
                    authorDisplayName: fallbackDisplayName,
                    likes: data.likes || [],
                } as Post;
            });
                setPosts(postsData);
            } catch (error) {
                console.error('Error processing posts snapshot:', error);
                // Don't crash - keep existing posts
            }
        }, (error) => {
            console.error('Posts listener error:', error);
            // Don't crash - app continues with empty posts
            setPosts([]);
        });

        return unsubscribe;
    }, []);

    useEffect(() => {
        let unsubscribeUser: (() => void) | undefined;
        const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
            unsubscribeUser?.();
            unsubscribeUser = undefined;
            if (!user) {
                setNestNewsPinnedPostIds([]);
                setNestNewsHiddenPostIds([]);
                return;
            }
            const userRef = doc(db, 'users', user.uid);
            unsubscribeUser = onSnapshot(userRef, (snap) => {
                if (!snap.exists()) {
                    setNestNewsPinnedPostIds([]);
                    setNestNewsHiddenPostIds([]);
                    return;
                }
                const data = snap.data() as any;
                setNestNewsPinnedPostIds(Array.isArray(data.nestNewsPinnedPostIds) ? data.nestNewsPinnedPostIds : []);
                setNestNewsHiddenPostIds(Array.isArray(data.nestNewsHiddenPostIds) ? data.nestNewsHiddenPostIds : []);
            });
        });
        return () => {
            unsubscribeUser?.();
            unsubscribeAuth();
        };
    }, []);

    const displayedPosts = useMemo(() => {
        const hidden = new Set(nestNewsHiddenPostIds);
        const visible = posts.filter((p) => !hidden.has(p.id));
        const pinnedOrder = nestNewsPinnedPostIds;
        const pinnedSet = new Set(pinnedOrder);
        const pinned: Post[] = [];
        for (const id of pinnedOrder) {
            const p = visible.find((x) => x.id === id);
            if (p) pinned.push(p);
        }
        const getTime = (t: any) => {
            if (!t) return 0;
            if (typeof t.toDate === 'function') return t.toDate().getTime();
            return 0;
        };
        const rest = visible
            .filter((p) => !pinnedSet.has(p.id))
            .sort((a, b) => getTime(b.createdAt) - getTime(a.createdAt));
        return [...pinned, ...rest];
    }, [posts, nestNewsHiddenPostIds, nestNewsPinnedPostIds]);

    useEffect(() => {
        if (!viewingComments) return;

        const q = query(
            collection(db, 'posts', viewingComments.id, 'comments'),
            orderBy('createdAt', 'asc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const commentsData = snapshot.docs.map(docSnap => {
                const data = docSnap.data() as any;
                const fallbackEmail = data.authorEmail || 'unknown@blueheronparents.com';
                const fallbackDisplayName = data.authorDisplayName || fallbackEmail.split('@')[0] || 'Anonymous';

                return {
                    id: docSnap.id,
                    ...data,
                    authorEmail: fallbackEmail,
                    authorDisplayName: fallbackDisplayName,
                } as Comment;
            });
            setComments(commentsData);
        });

        return unsubscribe;
    }, [viewingComments]);

    const compressImage = async (uri: string): Promise<string> => {
        try {
            // More aggressive compression for iPad Air 5th gen compatibility
            const manipulateResult = await ImageManipulator.manipulateAsync(
                uri,
                [
                    // Smaller max width for older iPad hardware
                    { resize: { width: 800 } }
                ],
                {
                    compress: 0.5, // More aggressive compression
                    format: ImageManipulator.SaveFormat.JPEG,
                }
            );

            console.log('Image compressed successfully');
            return manipulateResult.uri;
        } catch (error) {
            console.error('Image compression failed:', error);
            // Return original but log warning for debugging
            console.warn('Using original image - may cause memory issues on older devices');
            return uri;
        }
    };

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
            quality: 0.8, // Initial quality
        });

        if (!result.canceled) {
            // Compress the image
            try {
                const compressedImage = await compressImage(result.assets[0].uri);
                setSelectedImage(compressedImage);
            } catch (error) {
                console.error('Error compressing image:', error);
                // Fallback to original if compression fails
                setSelectedImage(result.assets[0].uri);
            }
        }
    };

    const uploadImage = async (uri: string, postId: string) => {
        try {
            const response = await fetch(uri);
            const blob = await response.blob();

            // Log the blob size for debugging
            console.log(`Uploading image: ${(blob.size / 1024 / 1024).toFixed(2)} MB`);

            const storageRef = ref(storage, `posts/${postId}/${Date.now()}.jpg`);
            await uploadBytes(storageRef, blob);

            const downloadURL = await getDownloadURL(storageRef);
            return downloadURL;
        } catch (error) {
            console.error('Error uploading image:', error);
            throw error;
        }
    };

    const getAuthorMetadata = async (userId: string | undefined | null) => {
        const fallbackEmail = auth.currentUser?.email || 'unknown@blueheronparents.com';
        const fallbackDisplayName = fallbackEmail.split('@')[0] || 'Anonymous';
        const fallbackMeta = {
            authorDisplayName: fallbackDisplayName,
            authorEmail: fallbackEmail,
            authorProfileImageUrl: undefined as string | undefined,
        };

        if (!userId) {
            return {
                authorDisplayName: fallbackMeta.authorDisplayName,
                authorEmail: fallbackMeta.authorEmail,
                authorProfileImageUrl: fallbackMeta.authorProfileImageUrl,
            };
        }

        try {
            const userDoc = await getDoc(doc(db, 'users', userId));
            if (userDoc.exists()) {
                const data = userDoc.data() as any;
                return {
                    authorDisplayName: data.displayName || fallbackMeta.authorDisplayName,
                    authorEmail: data.email || fallbackMeta.authorEmail,
                    authorProfileImageUrl: data.profileImageUrl,
                };
            }
        } catch (error) {
            console.warn('Failed to fetch author metadata:', error);
        }

        return fallbackMeta;
    };

    const handlePost = async () => {
        if (!postText.trim() && !selectedImage) {
            Alert.alert('Error', 'Please write something or add a photo!');
            return;
        }

        setLoading(true);
        try {
            const metadata = await getAuthorMetadata(auth.currentUser?.uid);

            const postData: any = {
                text: postText,
                authorDisplayName: metadata.authorDisplayName,
                authorEmail: metadata.authorEmail,
                authorProfileImageUrl: metadata.authorProfileImageUrl,
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

            // Send notifications to all other users
            const usersSnapshot = await getDocs(collection(db, 'users'));
            const userIds = usersSnapshot.docs
                .map(doc => doc.id)
                .filter(id => id !== auth.currentUser?.uid);

            const previewText = postText.length > 50 ? postText.substring(0, 50) + '...' : postText;
            await sendNotificationToUsers(
                userIds,
                'New Nest Note',
                `${metadata.authorDisplayName} posted: ${previewText || '📷 shared a photo'}`,
                'nestNotes'
            );

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
            'This removes the post for everyone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            // Delete associated comments
                            const commentsSnapshot = await getDocs(collection(db, 'posts', postId, 'comments'));
                            await Promise.all(commentsSnapshot.docs.map(commentDoc => deleteDoc(commentDoc.ref)));
                            
                            // Delete the post
                            await deleteDoc(doc(db, 'posts', postId));
                        } catch (error: any) {
                            Alert.alert('Error', error.message);
                        }
                    }
                }
            ]
        );
    };

    const handleTogglePin = async (postId: string) => {
        const uid = auth.currentUser?.uid;
        if (!uid) return;

        try {
            const userRef = doc(db, 'users', uid);
            const snap = await getDoc(userRef);
            const current = (snap.exists() ? (snap.data() as any).nestNewsPinnedPostIds : null) as string[] | undefined;
            const list = Array.isArray(current) ? [...current] : [];
            const isPinned = list.includes(postId);
            const next = isPinned
                ? list.filter((id) => id !== postId)
                : [postId, ...list.filter((id) => id !== postId)];
            await setDoc(userRef, { nestNewsPinnedPostIds: next }, { merge: true });
        } catch (error: any) {
            Alert.alert('Error', error.message);
        }
    };

    const handleHideFromFeed = async (postId: string) => {
        Alert.alert(
            'Hide from your feed?',
            'You can still find this post if someone shares a link; it only hides it here for you.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Hide',
                    style: 'destructive',
                    onPress: async () => {
                        const uid = auth.currentUser?.uid;
                        if (!uid) return;
                        try {
                            const userRef = doc(db, 'users', uid);
                            const snap = await getDoc(userRef);
                            const data = snap.exists() ? (snap.data() as any) : {};
                            const hidden = new Set(
                                Array.isArray(data.nestNewsHiddenPostIds) ? data.nestNewsHiddenPostIds : []
                            );
                            hidden.add(postId);
                            const pinned = Array.isArray(data.nestNewsPinnedPostIds)
                                ? (data.nestNewsPinnedPostIds as string[]).filter((id) => id !== postId)
                                : [];
                            await setDoc(
                                userRef,
                                { nestNewsHiddenPostIds: [...hidden], nestNewsPinnedPostIds: pinned },
                                { merge: true }
                            );
                        } catch (error: any) {
                            Alert.alert('Error', error.message);
                        }
                    },
                },
            ]
        );
    };

    const handleDeleteComment = async (commentId: string, postId: string) => {
        Alert.alert(
            'Delete Comment',
            'Are you sure you want to delete this comment?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await deleteDoc(doc(db, 'posts', postId, 'comments', commentId));
                            // Update comment count
                            if (viewingComments) {
                                await updateDoc(doc(db, 'posts', postId), {
                                    commentCount: Math.max((viewingComments.commentCount || 0) - 1, 0)
                                });
                            }
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
            const metadata = await getAuthorMetadata(auth.currentUser?.uid);
            await addDoc(collection(db, 'posts', viewingComments.id, 'comments'), {
                text: commentText,
                authorDisplayName: metadata.authorDisplayName,
                authorEmail: metadata.authorEmail,
                authorProfileImageUrl: metadata.authorProfileImageUrl,
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
                        <Pressable
                            style={styles.removeImageButton}
                            onPress={() => setSelectedImage(null)}
                        >
                            <Text style={styles.removeImageText}>✕</Text>
                        </Pressable>
                    </View>
                )}

                <View style={styles.postActionsRow}>
                    <Pressable
                        style={styles.photoButton}
                        onPress={pickImage}
                    >
                        <Text style={styles.photoButtonText}>📷 Photo</Text>
                    </Pressable>

                    <Pressable
                        style={[styles.postButton, loading && styles.postButtonDisabled]}
                        onPress={handlePost}
                        disabled={loading}
                    >
                        <Text style={styles.postButtonText}>{loading ? 'Posting...' : 'Post'}</Text>
                    </Pressable>
                </View>
            </View>

            <FlatList
                data={displayedPosts}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                    <View style={styles.postCard}>
                        <View style={styles.postHeader}>
                            <View style={styles.authorInfo}>
                                {item.authorProfileImageUrl ? (
                                    <Image source={{ uri: item.authorProfileImageUrl }} style={styles.authorAvatar} />
                                ) : (
                                    <View style={styles.authorAvatarPlaceholder}>
                                        <Text style={styles.avatarInitials}>
                                            {item.authorDisplayName?.charAt(0).toUpperCase()}
                                        </Text>
                                    </View>
                                )}
                                <View>
                                    <Text style={styles.authorName}>{item.authorDisplayName}</Text>
                                    <Text style={styles.authorEmail}>{item.authorEmail}</Text>
                                </View>
                            </View>
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
                            <Pressable
                                style={styles.actionButton}
                                onPress={() => handleLike(item)}
                            >
                                <Text style={styles.actionText}>
                                    {item.likes?.includes(auth.currentUser?.uid || '') ? '❤️' : '🤍'} {item.likes?.length || 0}
                                </Text>
                            </Pressable>

                            <Pressable
                                style={styles.actionButton}
                                onPress={() => setViewingComments(item)}
                            >
                                <Text style={styles.actionText}>
                                    💬 {item.commentCount || 0}
                                </Text>
                            </Pressable>

                            {auth.currentUser?.uid && (
                                <Pressable
                                    style={styles.actionButton}
                                    onPress={() => handleTogglePin(item.id)}
                                >
                                    <Text style={styles.actionText}>
                                        {nestNewsPinnedPostIds.includes(item.id) ? '📌 Unpin' : '📌 Pin'}
                                    </Text>
                                </Pressable>
                            )}

                            {isMyPost(item.userId) && (
                                <Pressable
                                    style={styles.actionButton}
                                    onPress={() => handleEdit(item)}
                                >
                                    <Text style={styles.actionText}>✏️ Edit</Text>
                                </Pressable>
                            )}

                            {(isMyPost(item.userId) || userIsAdmin) && (
                                <Pressable
                                    style={styles.actionButton}
                                    onPress={() => handleDelete(item.id)}
                                >
                                    <Text style={[styles.actionText, styles.deleteText]}>
                                        {userIsAdmin && !isMyPost(item.userId) ? '🛡️ Admin Delete' : '🗑️ Delete'}
                                    </Text>
                                </Pressable>
                            )}

                            {!isMyPost(item.userId) && !userIsAdmin && auth.currentUser?.uid && (
                                <Pressable
                                    style={styles.actionButton}
                                    onPress={() => handleHideFromFeed(item.id)}
                                >
                                    <Text style={[styles.actionText, styles.hideText]}>🙈 Hide</Text>
                                </Pressable>
                            )}
                        </View>
                    </View>
                )}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>
                            {posts.length > 0
                                ? "You've hidden every visible post. New posts will still appear here."
                                : 'No posts yet. Be the first to share!'}
                        </Text>
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
                            <Pressable
                                style={[styles.modalButton, styles.cancelButton]}
                                onPress={() => setEditingPost(null)}
                            >
                                <Text style={styles.cancelButtonText}>Cancel</Text>
                            </Pressable>
                            <Pressable
                                style={[styles.modalButton, styles.saveButton]}
                                onPress={handleUpdate}
                            >
                                <Text style={styles.saveButtonText}>Save</Text>
                            </Pressable>
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
                            <Pressable
                                onPress={() => setViewingComments(null)}
                                style={styles.closeButtonContainer}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <Text style={styles.closeButton}>✕</Text>
                            </Pressable>
                        </View>

                        <View style={styles.originalPost}>
                            <View style={styles.authorInfo}>
                                {viewingComments?.authorProfileImageUrl ? (
                                    <Image
                                        source={{ uri: viewingComments.authorProfileImageUrl }}
                                        style={styles.authorAvatar}
                                    />
                                ) : (
                                    <View style={styles.authorAvatarPlaceholder}>
                                        <Text style={styles.avatarInitials}>
                                            {viewingComments?.authorDisplayName?.charAt(0).toUpperCase()}
                                        </Text>
                                    </View>
                                )}
                                <View>
                                    <Text style={styles.authorName}>{viewingComments?.authorDisplayName}</Text>
                                    <Text style={styles.authorEmail}>{viewingComments?.authorEmail}</Text>
                                </View>
                            </View>
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
                            renderItem={({ item }) => {
                                const isMyComment = item.userId === auth.currentUser?.uid;
                                return (
                                    <View style={styles.commentCard}>
                                        <View style={styles.commentHeaderRow}>
                                            <View style={styles.commentAuthorRow}>
                                                {item.authorProfileImageUrl ? (
                                                    <Image
                                                        source={{ uri: item.authorProfileImageUrl }}
                                                        style={styles.commentAvatar}
                                                    />
                                                ) : (
                                                    <View style={styles.commentAvatarPlaceholder}>
                                                        <Text style={styles.commentAvatarInitial}>
                                                            {item.authorDisplayName?.charAt(0).toUpperCase()}
                                                        </Text>
                                                    </View>
                                                )}
                                                <View>
                                                    <Text style={styles.commentAuthorName}>{item.authorDisplayName}</Text>
                                                    <Text style={styles.commentAuthorEmail}>{item.authorEmail}</Text>
                                                </View>
                                            </View>
                                            {(isMyComment || userIsAdmin) && viewingComments && (
                                                <Pressable
                                                    style={styles.commentDeleteButton}
                                                    onPress={() => handleDeleteComment(item.id, viewingComments.id)}
                                                >
                                                    <Text style={styles.commentDeleteText}>
                                                        {userIsAdmin && !isMyComment ? '🛡️' : '🗑️'}
                                                    </Text>
                                                </Pressable>
                                            )}
                                        </View>
                                        <Text style={styles.commentText}>{item.text}</Text>
                                        <Text style={styles.commentTime}>{formatDate(item.createdAt)}</Text>
                                    </View>
                                );
                            }}
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
                            <Pressable
                                style={styles.commentButton}
                                onPress={handleComment}
                            >
                                <Text style={styles.commentButtonText}>Send</Text>
                            </Pressable>
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
    authorInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    authorAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        marginRight: 10,
    },
    authorAvatarPlaceholder: {
        width: 40,
        height: 40,
        borderRadius: 20,
        marginRight: 10,
        backgroundColor: '#2c5f7c',
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarInitials: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 18,
    },
    authorName: {
        fontWeight: '600',
        fontSize: 14,
        color: '#333',
    },
    authorEmail: {
        fontSize: 12,
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
        flexWrap: 'wrap',
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
    hideText: {
        color: '#666',
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
    commentHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 6,
    },
    commentAuthorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        flex: 1,
    },
    commentAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
    },
    commentAvatarPlaceholder: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#2c5f7c',
        justifyContent: 'center',
        alignItems: 'center',
    },
    commentAvatarInitial: {
        color: '#fff',
        fontWeight: '600',
    },
    commentAuthorName: {
        fontSize: 13,
        fontWeight: '600',
        color: '#2c5f7c',
    },
    commentAuthorEmail: {
        fontSize: 12,
        color: '#666',
    },
    commentDeleteButton: {
        padding: 5,
        marginLeft: 10,
    },
    commentDeleteText: {
        fontSize: 16,
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