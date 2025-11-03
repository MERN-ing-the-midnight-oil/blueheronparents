import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Switch, ScrollView, Alert } from 'react-native';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, auth } from '../../firebase.config';

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
});