import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { sendEmailVerification, signOut } from 'firebase/auth';
import { auth } from '../../firebase.config';

export default function EmailVerificationBanner() {
    const [sending, setSending] = useState(false);

    const handleResendVerification = async () => {
        if (!auth.currentUser) return;

        setSending(true);
        try {
            await sendEmailVerification(auth.currentUser);
            Alert.alert(
                'Verification Email Sent',
                'Please check your inbox and click the verification link. After verifying, you\'ll need to log out and log back in.',
                [
                    {
                        text: 'Log Out Now',
                        onPress: handleLogout
                    },
                    {
                        text: 'Later',
                        style: 'cancel'
                    }
                ]
            );
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setSending(false);
        }
    };

    const handleLogout = async () => {
        try {
            await signOut(auth);
        } catch (error: any) {
            Alert.alert('Error', error.message);
        }
    };

    return (
        <View style={styles.banner}>
            <Text style={styles.bannerText}>
                ⚠️ Please verify your email to create events
            </Text>
            <Pressable
                style={styles.resendButton}
                onPress={handleResendVerification}
            >
                <Text style={styles.resendButtonText}>
                    {sending ? 'Sending...' : 'Resend Verification Email'}
                </Text>
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    banner: {
        backgroundColor: '#fff3cd',
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#ffc107',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    bannerText: {
        flex: 1,
        color: '#856404',
        fontSize: 14,
        marginRight: 10,
    },
    resendButton: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 4,
        backgroundColor: '#ffc107',
    },
    resendButtonText: {
        color: '#856404',
        fontSize: 12,
        fontWeight: '600',
    },
});