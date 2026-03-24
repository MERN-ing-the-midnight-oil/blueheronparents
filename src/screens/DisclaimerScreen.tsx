import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Pressable,
    ScrollView,
    ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { DISCLAIMER_TEXT } from '../constants/disclaimerText';

const DISCLAIMER_STORAGE_KEY = '@blueheron_disclaimer_accepted';

export async function hasAcceptedDisclaimer(): Promise<boolean> {
    const v = await AsyncStorage.getItem(DISCLAIMER_STORAGE_KEY);
    return v === 'true';
}

async function persistDisclaimerAccepted(): Promise<void> {
    await AsyncStorage.setItem(DISCLAIMER_STORAGE_KEY, 'true');
}

interface DisclaimerScreenProps {
    onAccepted: () => void;
}

export default function DisclaimerScreen({ onAccepted }: DisclaimerScreenProps) {
    const [working, setWorking] = useState(false);

    const handleUnderstand = async () => {
        setWorking(true);
        try {
            await persistDisclaimerAccepted();
            onAccepted();
        } finally {
            setWorking(false);
        }
    };

    return (
        <SafeAreaProvider>
            <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
            >
                <Text style={styles.title}>Disclaimer</Text>
                <Text style={styles.body}>{DISCLAIMER_TEXT}</Text>
            </ScrollView>
            <View style={styles.footer}>
                <Pressable
                    style={[styles.button, working && styles.buttonDisabled]}
                    onPress={handleUnderstand}
                    disabled={working}
                >
                    {working ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.buttonText}>I understand</Text>
                    )}
                </Pressable>
            </View>
            </SafeAreaView>
        </SafeAreaProvider>
    );
}

const styles = StyleSheet.create({
    safe: {
        flex: 1,
        backgroundColor: '#fff',
    },
    scroll: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingTop: 8,
        paddingBottom: 16,
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#2c5f7c',
        marginBottom: 16,
    },
    body: {
        fontSize: 16,
        lineHeight: 24,
        color: '#333',
    },
    footer: {
        paddingHorizontal: 20,
        paddingBottom: 12,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: '#ddd',
        paddingTop: 16,
    },
    button: {
        backgroundColor: '#2c5f7c',
        paddingVertical: 15,
        borderRadius: 8,
        alignItems: 'center',
    },
    buttonDisabled: {
        opacity: 0.7,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
