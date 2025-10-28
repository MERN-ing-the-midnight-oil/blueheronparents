import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, Image, Switch } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { doc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, auth, storage } from '../../firebase.config';

interface Child {
    name: string;
    age: string;
    daysAttending: string[];
}

interface ProfileSetupScreenProps {
    onComplete: () => void;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

export default function ProfileSetupScreen({ onComplete }: ProfileSetupScreenProps) {
    const [displayName, setDisplayName] = useState('');
    const [phone, setPhone] = useState('');
    const [profileImage, setProfileImage] = useState<string | null>(null);
    const [children, setChildren] = useState<Child[]>([{ name: '', age: '', daysAttending: [] }]);
    const [showEmail, setShowEmail] = useState(true);
    const [showPhone, setShowPhone] = useState(false);
    const [loading, setLoading] = useState(false);

    const pickImage = async () => {
        const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (!permissionResult.granted) {
            Alert.alert('Permission Required', 'Please allow access to your photos');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.5,
        });

        if (!result.canceled) {
            setProfileImage(result.assets[0].uri);
        }
    };

    const uploadProfileImage = async (uri: string) => {
        const response = await fetch(uri);
        const blob = await response.blob();

        const storageRef = ref(storage, `profilePictures/${auth.currentUser?.uid}/profile.jpg`);
        await uploadBytes(storageRef, blob);

        const downloadURL = await getDownloadURL(storageRef);
        return downloadURL;
    };

    const addChild = () => {
        setChildren([...children, { name: '', age: '', daysAttending: [] }]);
    };

    const removeChild = (index: number) => {
        if (children.length > 1) {
            setChildren(children.filter((_, i) => i !== index));
        }
    };

    const updateChild = (index: number, field: keyof Child, value: any) => {
        const updated = [...children];
        updated[index] = { ...updated[index], [field]: value };
        setChildren(updated);
    };

    const toggleDay = (childIndex: number, day: string) => {
        const updated = [...children];
        const days = updated[childIndex].daysAttending;
        if (days.includes(day)) {
            updated[childIndex].daysAttending = days.filter(d => d !== day);
        } else {
            updated[childIndex].daysAttending = [...days, day];
        }
        setChildren(updated);
    };

    const handleSave = async () => {
        if (!displayName.trim()) {
            Alert.alert('Required', 'Please enter your name');
            return;
        }

        setLoading(true);
        try {
            let profileImageUrl = null;
            if (profileImage) {
                profileImageUrl = await uploadProfileImage(profileImage);
            }

            const profileData = {
                displayName,
                email: auth.currentUser?.email,
                phone: phone || null,
                profileImageUrl,
                children: children.filter(c => c.name.trim()),
                showEmail,
                showPhone,
                createdAt: new Date(),
                profileComplete: true,
            };

            await setDoc(doc(db, 'users', auth.currentUser!.uid), profileData);

            Alert.alert('Success', 'Profile created!');
            onComplete();
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScrollView style={styles.container}>
            <View style={styles.content}>
                <Text style={styles.title}>Complete Your Profile</Text>
                <Text style={styles.subtitle}>Help other parents get to know you!</Text>

                <TouchableOpacity style={styles.imagePickerContainer} onPress={pickImage}>
                    {profileImage ? (
                        <Image source={{ uri: profileImage }} style={styles.profileImage} />
                    ) : (
                        <View style={styles.imagePlaceholder}>
                            <Text style={styles.imagePlaceholderText}>📷</Text>
                            <Text style={styles.imagePlaceholderSubtext}>Add Photo</Text>
                        </View>
                    )}
                </TouchableOpacity>

                <Text style={styles.label}>Your Name *</Text>
                <TextInput
                    style={styles.input}
                    value={displayName}
                    onChangeText={setDisplayName}
                    placeholder="Jane Doe"
                />

                <Text style={styles.label}>Phone Number</Text>
                <TextInput
                    style={styles.input}
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="(425) 555-0123"
                    keyboardType="phone-pad"
                />

                <View style={styles.privacySection}>
                    <Text style={styles.sectionTitle}>Privacy Settings</Text>

                    <View style={styles.switchRow}>
                        <Text style={styles.switchLabel}>Show email to other parents</Text>
                        <Switch value={showEmail} onValueChange={setShowEmail} />
                    </View>

                    <View style={styles.switchRow}>
                        <Text style={styles.switchLabel}>Show phone to other parents</Text>
                        <Switch value={showPhone} onValueChange={setShowPhone} />
                    </View>
                </View>

                <View style={styles.childrenSection}>
                    <Text style={styles.sectionTitle}>Your Children</Text>

                    {children.map((child, index) => (
                        <View key={index} style={styles.childCard}>
                            <View style={styles.childHeader}>
                                <Text style={styles.childNumber}>Child {index + 1}</Text>
                                {children.length > 1 && (
                                    <TouchableOpacity onPress={() => removeChild(index)}>
                                        <Text style={styles.removeButton}>Remove</Text>
                                    </TouchableOpacity>
                                )}
                            </View>

                            <TextInput
                                style={styles.input}
                                value={child.name}
                                onChangeText={(text) => updateChild(index, 'name', text)}
                                placeholder="Child's name"
                            />

                            <TextInput
                                style={styles.input}
                                value={child.age}
                                onChangeText={(text) => updateChild(index, 'age', text)}
                                placeholder="Age"
                                keyboardType="number-pad"
                            />

                            <Text style={styles.daysLabel}>Days attending:</Text>
                            <View style={styles.daysContainer}>
                                {DAYS.map(day => (
                                    <TouchableOpacity
                                        key={day}
                                        style={[
                                            styles.dayButton,
                                            child.daysAttending.includes(day) && styles.dayButtonSelected
                                        ]}
                                        onPress={() => toggleDay(index, day)}
                                    >
                                        <Text style={[
                                            styles.dayButtonText,
                                            child.daysAttending.includes(day) && styles.dayButtonTextSelected
                                        ]}>
                                            {day.substring(0, 3)}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    ))}

                    <TouchableOpacity style={styles.addChildButton} onPress={addChild}>
                        <Text style={styles.addChildButtonText}>+ Add Another Child</Text>
                    </TouchableOpacity>
                </View>

                <TouchableOpacity
                    style={[styles.saveButton, loading && styles.saveButtonDisabled]}
                    onPress={handleSave}
                    disabled={loading}
                >
                    <Text style={styles.saveButtonText}>
                        {loading ? 'Saving...' : 'Complete Profile'}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={onComplete} style={styles.skipButton}>
                    <Text style={styles.skipButtonText}>Skip for now</Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    content: {
        padding: 20,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#2c5f7c',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: '#666',
        marginBottom: 30,
    },
    imagePickerContainer: {
        alignSelf: 'center',
        marginBottom: 30,
    },
    profileImage: {
        width: 120,
        height: 120,
        borderRadius: 60,
    },
    imagePlaceholder: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: '#e0e0e0',
        justifyContent: 'center',
        alignItems: 'center',
    },
    imagePlaceholderText: {
        fontSize: 40,
    },
    imagePlaceholderSubtext: {
        fontSize: 14,
        color: '#666',
        marginTop: 5,
    },
    label: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginBottom: 8,
    },
    input: {
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        marginBottom: 15,
    },
    privacySection: {
        backgroundColor: '#fff',
        borderRadius: 8,
        padding: 15,
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 15,
    },
    switchRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 10,
    },
    switchLabel: {
        fontSize: 15,
        color: '#333',
        flex: 1,
    },
    childrenSection: {
        marginBottom: 20,
    },
    childCard: {
        backgroundColor: '#fff',
        borderRadius: 8,
        padding: 15,
        marginBottom: 15,
    },
    childHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
    },
    childNumber: {
        fontSize: 16,
        fontWeight: '600',
        color: '#2c5f7c',
    },
    removeButton: {
        color: '#d32f2f',
        fontSize: 14,
    },
    daysLabel: {
        fontSize: 14,
        color: '#666',
        marginBottom: 8,
    },
    daysContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    dayButton: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#ddd',
        backgroundColor: '#fff',
    },
    dayButtonSelected: {
        backgroundColor: '#2c5f7c',
        borderColor: '#2c5f7c',
    },
    dayButtonText: {
        fontSize: 14,
        color: '#666',
    },
    dayButtonTextSelected: {
        color: '#fff',
        fontWeight: '600',
    },
    addChildButton: {
        padding: 15,
        borderRadius: 8,
        borderWidth: 2,
        borderColor: '#2c5f7c',
        borderStyle: 'dashed',
        alignItems: 'center',
    },
    addChildButtonText: {
        color: '#2c5f7c',
        fontSize: 16,
        fontWeight: '600',
    },
    saveButton: {
        backgroundColor: '#2c5f7c',
        padding: 16,
        borderRadius: 8,
        alignItems: 'center',
        marginBottom: 15,
    },
    saveButtonDisabled: {
        opacity: 0.6,
    },
    saveButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    skipButton: {
        padding: 10,
        alignItems: 'center',
    },
    skipButtonText: {
        color: '#666',
        fontSize: 14,
    },
});