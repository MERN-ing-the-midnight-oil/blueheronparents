import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, ActivityIndicator } from 'react-native';
import { sendEmailVerification, signOut } from 'firebase/auth';
import { auth } from '../../firebase.config';

interface VerifyEmailScreenProps {
    onCheckVerification: () => Promise<void>;
    email?: string | null;
}

export default function VerifyEmailScreen({ onCheckVerification, email }: VerifyEmailScreenProps) {
    const [sending, setSending] = useState(false);
    const [checking, setChecking] = useState(false);

    const handleResendEmail = async () => {
        const user = auth.currentUser;
        if (!user) {
            Alert.alert('Not signed in', 'Please sign in again to resend the verification email.');
            return;
        }

        setSending(true);
        try {
            await sendEmailVerification(user);
            Alert.alert('Email sent', 'Check your inbox for a new verification link.');
        } catch (error: any) {
            console.error('Resend verification failed:', error);
            Alert.alert('Unable to send email', error?.message || 'Please try again later.');
        } finally {
            setSending(false);
        }
    };

    const handleCheckStatus = async () => {
        setChecking(true);
        try {
            await onCheckVerification();
        } catch (error: any) {
            console.error('Verification check failed:', error);
            Alert.alert('Error', error?.message || 'Unable to check verification status.');
        } finally {
            setChecking(false);
        }
    };

    const handleSignOut = async () => {
        try {
            await signOut(auth);
        } catch (error: any) {
            Alert.alert('Error', error?.message || 'Failed to sign out. Please try again.');
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Verify Your Email</Text>
            <Text style={styles.subtitle}>
                We sent a verification link to:
            </Text>
            <Text style={styles.emailText}>{email || auth.currentUser?.email}</Text>

            <Text style={styles.instructions}>
                Please confirm your email address to continue. Once you have clicked the verification link, return to the app and tap “I Verified My Email”.
            </Text>

            <Pressable
                style={[styles.primaryButton, (sending || checking) && styles.disabledButton]}
                onPress={handleCheckStatus}
                disabled={sending || checking}
            >
                {checking ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>I Verified My Email</Text>}
            </Pressable>

            <Pressable
                style={[styles.secondaryButton, sending && styles.disabledButton]}
                onPress={handleResendEmail}
                disabled={sending}
            >
                {sending ? <ActivityIndicator color="#2c5f7c" /> : <Text style={styles.secondaryButtonText}>Resend Verification Email</Text>}
            </Pressable>

            <Pressable onPress={handleSignOut} style={styles.signOutButton}>
                <Text style={styles.signOutText}>Sign Out</Text>
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        padding: 24,
        backgroundColor: '#fff',
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#2c5f7c',
        textAlign: 'center',
        marginBottom: 16,
    },
    subtitle: {
        fontSize: 16,
        color: '#444',
        textAlign: 'center',
    },
    emailText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#2c5f7c',
        textAlign: 'center',
        marginVertical: 8,
    },
    instructions: {
        fontSize: 15,
        color: '#666',
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 22,
    },
    primaryButton: {
        backgroundColor: '#2c5f7c',
        paddingVertical: 14,
        borderRadius: 8,
        alignItems: 'center',
        marginBottom: 12,
    },
    primaryButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    secondaryButton: {
        paddingVertical: 14,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#2c5f7c',
        alignItems: 'center',
        marginBottom: 24,
    },
    secondaryButtonText: {
        color: '#2c5f7c',
        fontSize: 16,
        fontWeight: '600',
    },
    signOutButton: {
        alignItems: 'center',
        paddingVertical: 10,
    },
    signOutText: {
        color: '#d32f2f',
        fontSize: 15,
        fontWeight: '600',
    },
    disabledButton: {
        opacity: 0.7,
    },
});

