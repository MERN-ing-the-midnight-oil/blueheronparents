import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';

interface TermsOfServiceScreenProps {
    onClose: () => void;
}

export default function TermsOfServiceScreen({ onClose }: TermsOfServiceScreenProps) {
    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={onClose}>
                    <Text style={styles.closeButton}>← Back</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Terms of Service</Text>
                <View style={styles.closeButton} />
            </View>

            <ScrollView style={styles.content}>
                <Text style={styles.section}>
                    <Text style={styles.bold}>Effective Date:</Text> {new Date().toLocaleDateString()}
                </Text>

                <View style={styles.sectionContainer}>
                    <Text style={styles.sectionTitle}>1. Acceptance of Terms</Text>
                    <Text style={styles.text}>
                        By using Blue Heron Rookery ("the App"), you agree to be bound by these Terms of Service.
                        This app is exclusively for enrolled families of Blue Heron Montessori School in Bellingham, WA.
                    </Text>
                </View>

                <View style={styles.sectionContainer}>
                    <Text style={styles.sectionTitle}>2. Eligibility</Text>
                    <Text style={styles.text}>
                        This app is available only to current families of Blue Heron Montessori School.
                        Users must provide accurate information during registration. We may verify your
                        enrollment status with the school.
                    </Text>
                </View>

                <View style={styles.sectionContainer}>
                    <Text style={styles.sectionTitle}>3. User Content</Text>
                    <Text style={styles.text}>
                        You are responsible for all content you share, including messages, photos, and posts.
                        You grant us the right to moderate or remove content that violates our Community Guidelines.
                        Do not share copyrighted material without permission.
                    </Text>
                </View>

                <View style={styles.sectionContainer}>
                    <Text style={styles.sectionTitle}>4. Privacy</Text>
                    <Text style={styles.text}>
                        We collect and use your information as described in our Privacy Policy. We do not
                        sell personal information to third parties. Your data is stored securely using
                        Firebase services.
                    </Text>
                </View>

                <View style={styles.sectionContainer}>
                    <Text style={styles.sectionTitle}>5. Prohibited Uses</Text>
                    <Text style={styles.text}>
                        You may not use this app for:
                    </Text>
                    <Text style={styles.bulletPoint}>• Commercial advertising or solicitation</Text>
                    <Text style={styles.bulletPoint}>• Harassment, bullying, or threatening behavior</Text>
                    <Text style={styles.bulletPoint}>• Sharing false information or impersonating others</Text>
                    <Text style={styles.bulletPoint}>• Attempting to hack, disrupt, or compromise app security</Text>
                    <Text style={styles.bulletPoint}>• Violating any local, state, or federal laws</Text>
                </View>

                <View style={styles.sectionContainer}>
                    <Text style={styles.sectionTitle}>6. Account Termination</Text>
                    <Text style={styles.text}>
                        We reserve the right to suspend or terminate accounts that violate these terms
                        or our Community Guidelines. If your child leaves Blue Heron Montessori School,
                        your access may be revoked.
                    </Text>
                </View>

                <View style={styles.sectionContainer}>
                    <Text style={styles.sectionTitle}>7. Disclaimer</Text>
                    <Text style={styles.text}>
                        This app is provided "as is" without warranties. We are not responsible for
                        arrangements made between users (carpools, playdates, etc.). Always exercise
                        caution when meeting people from the app.
                    </Text>
                </View>

                <View style={styles.sectionContainer}>
                    <Text style={styles.sectionTitle}>8. Changes to Terms</Text>
                    <Text style={styles.text}>
                        We may update these terms at any time. Continued use of the app after changes
                        constitutes acceptance of the new terms. We will notify users of significant changes.
                    </Text>
                </View>

                <View style={styles.sectionContainer}>
                    <Text style={styles.sectionTitle}>9. Contact Information</Text>
                    <Text style={styles.text}>
                        Questions about these terms? Contact Blue Heron Montessori School directly
                        or reach out through the app's report feature.
                    </Text>
                </View>

                <View style={styles.footer}>
                    <Text style={styles.footerText}>
                        Blue Heron Rookery • Connecting Blue Heron Montessori School Families
                    </Text>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 15,
        backgroundColor: '#2c5f7c',
    },
    closeButton: {
        color: '#fff',
        fontSize: 16,
        width: 60,
    },
    headerTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    content: {
        flex: 1,
        padding: 20,
    },
    section: {
        fontSize: 14,
        color: '#666',
        marginBottom: 20,
    },
    sectionContainer: {
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#2c5f7c',
        marginBottom: 8,
    },
    text: {
        fontSize: 14,
        color: '#333',
        lineHeight: 20,
        marginBottom: 5,
    },
    bulletPoint: {
        fontSize: 14,
        color: '#333',
        lineHeight: 20,
        marginBottom: 3,
        marginLeft: 10,
    },
    bold: {
        fontWeight: 'bold',
    },
    footer: {
        backgroundColor: '#2c5f7c',
        padding: 15,
        borderRadius: 8,
        marginBottom: 20,
        alignItems: 'center',
    },
    footerText: {
        color: '#fff',
        fontSize: 12,
        textAlign: 'center',
    },
});