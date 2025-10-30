import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal } from 'react-native';
import TermsOfServiceScreen from './TermsOfServiceScreen';

interface CommunityGuidelinesScreenProps {
    onClose: () => void;
}

export default function CommunityGuidelinesScreen({ onClose }: CommunityGuidelinesScreenProps) {
    const [showTerms, setShowTerms] = useState(false);

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={onClose}>
                    <Text style={styles.closeButton}>← Back</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Community Guidelines</Text>
                <View style={styles.closeButton} />
            </View>

            <ScrollView style={styles.content}>
                <Text style={styles.welcomeText}>
                    Welcome to the Blue Heron Rookery community! These guidelines help ensure our app remains a safe,
                    supportive space for all Blue Heron Montessori School families.
                </Text>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>✨ Our Community Values</Text>
                    <Text style={styles.bulletPoint}>• <Text style={styles.bold}>Respect:</Text> Treat all community members with kindness and courtesy</Text>
                    <Text style={styles.bulletPoint}>• <Text style={styles.bold}>Safety:</Text> Priority on child and family safety in all interactions</Text>
                    <Text style={styles.bulletPoint}>• <Text style={styles.bold}>Support:</Text> Help fellow parents navigate parenting and school life</Text>
                    <Text style={styles.bulletPoint}>• <Text style={styles.bold}>Inclusivity:</Text> Welcome all families regardless of background</Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>✅ Encouraged Content</Text>
                    <Text style={styles.bulletPoint}>• Sharing toys, clothes, and children's items</Text>
                    <Text style={styles.bulletPoint}>• Organizing playdates and family activities</Text>
                    <Text style={styles.bulletPoint}>• Coordinating carpools and ride-sharing</Text>
                    <Text style={styles.bulletPoint}>• Asking for parenting advice and support</Text>
                    <Text style={styles.bulletPoint}>• Sharing school-related information and events</Text>
                    <Text style={styles.bulletPoint}>• Introducing yourself and your family</Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>🚫 Prohibited Content</Text>
                    <Text style={styles.bulletPoint}>• Harassment, bullying, or discriminatory language</Text>
                    <Text style={styles.bulletPoint}>• Spam, excessive self-promotion, or commercial advertising</Text>
                    <Text style={styles.bulletPoint}>• Sharing personal information of others without consent</Text>
                    <Text style={styles.bulletPoint}>• Inappropriate photos or content not suitable for families</Text>
                    <Text style={styles.bulletPoint}>• Political campaigns or controversial topics unrelated to parenting</Text>
                    <Text style={styles.bulletPoint}>• False information or rumors about individuals or the school</Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>🔒 Privacy & Safety</Text>
                    <Text style={styles.bulletPoint}>• Only share what you're comfortable with the school community seeing</Text>
                    <Text style={styles.bulletPoint}>• Respect others' privacy settings and boundaries</Text>
                    <Text style={styles.bulletPoint}>• Never share photos of other people's children without permission</Text>
                    <Text style={styles.bulletPoint}>• Use the block and report features if you feel unsafe</Text>
                    <Text style={styles.bulletPoint}>• Meet new families in public places for initial meetups</Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>⚖️ Consequences</Text>
                    <Text style={styles.text}>
                        Violations of these guidelines may result in:
                    </Text>
                    <Text style={styles.bulletPoint}>• Warning and removal of problematic content</Text>
                    <Text style={styles.bulletPoint}>• Temporary suspension from posting</Text>
                    <Text style={styles.bulletPoint}>• Permanent removal from the community</Text>
                    <Text style={styles.text}>
                        We reserve the right to remove content or users that don't align with our community values.
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>📞 Getting Help</Text>
                    <Text style={styles.text}>
                        If you encounter problems or have questions:
                    </Text>
                    <Text style={styles.bulletPoint}>• Use the "Report" feature for inappropriate content or behavior</Text>
                    <Text style={styles.bulletPoint}>• Contact school administration for serious concerns</Text>
                    <Text style={styles.bulletPoint}>• Block users who make you feel uncomfortable</Text>
                </View>

                <View style={styles.footer}>
                    <Text style={styles.footerText}>
                        By using Blue Heron Rookery, you agree to follow these community guidelines.
                        Let's work together to create a positive, supportive environment for all families!
                    </Text>
                    <TouchableOpacity
                        style={styles.termsLink}
                        onPress={() => setShowTerms(true)}
                    >
                        <Text style={styles.termsLinkText}>View Terms of Service</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>

            {/* Terms of Service Modal */}
            <Modal
                visible={showTerms}
                animationType="slide"
                presentationStyle="pageSheet"
            >
                <TermsOfServiceScreen onClose={() => setShowTerms(false)} />
            </Modal>
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
    welcomeText: {
        fontSize: 16,
        color: '#333',
        lineHeight: 24,
        marginBottom: 25,
        backgroundColor: '#e8f4f8',
        padding: 15,
        borderRadius: 8,
    },
    section: {
        marginBottom: 25,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#2c5f7c',
        marginBottom: 12,
    },
    text: {
        fontSize: 15,
        color: '#333',
        lineHeight: 22,
        marginBottom: 8,
    },
    bulletPoint: {
        fontSize: 15,
        color: '#333',
        lineHeight: 22,
        marginBottom: 6,
        marginLeft: 5,
    },
    bold: {
        fontWeight: 'bold',
    },
    footer: {
        backgroundColor: '#2c5f7c',
        padding: 20,
        borderRadius: 8,
        marginBottom: 20,
    },
    footerText: {
        color: '#fff',
        fontSize: 15,
        lineHeight: 22,
        textAlign: 'center',
        marginBottom: 10,
    },
    termsLink: {
        alignSelf: 'center',
        paddingVertical: 8,
        paddingHorizontal: 16,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 15,
    },
    termsLinkText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
        textDecorationLine: 'underline',
    },
});