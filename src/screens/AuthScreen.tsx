import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Image, ScrollView, Dimensions } from 'react-native';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../firebase.config';

const { width } = Dimensions.get('window');

export default function AuthScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSignUp, setIsSignUp] = useState(false);

    const handleAuth = async () => {
        try {
            if (isSignUp) {
                await createUserWithEmailAndPassword(auth, email, password);
                Alert.alert('Success', 'Account created!');
            } else {
                await signInWithEmailAndPassword(auth, email, password);
            }
        } catch (error: any) {
            Alert.alert('Error', error.message);
        }
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
            <Image
                source={require('../../assets/auth-header.png')}
                style={styles.headerImage}
                resizeMode="cover"
            />

            <View style={styles.content}>
                <Text style={styles.title}>Blue Heron Rookery</Text>
                <Text style={styles.subtitle}>
                    Welcome to Blue Heron Rookery, an app to build community among Blue Heron Montessori School families in Bellingham, WA. I'm envisioning it as a place for us to make friends, hand-down toys and clothes, possibly arrange ride-sharing, and make playdates outside of school. Feel free to post about yourself without worrying that you are spamming anyone's email or phone. Let's get to know each-other! ~Rhys Smoker (Skye's dad)
                </Text>

                <TextInput
                    style={styles.input}
                    placeholder="Email"
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                />

                <TextInput
                    style={styles.input}
                    placeholder="Password"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                />

                <TouchableOpacity style={styles.button} onPress={handleAuth}>
                    <Text style={styles.buttonText}>
                        {isSignUp ? 'Sign Up' : 'Sign In'}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => setIsSignUp(!isSignUp)}>
                    <Text style={styles.switchText}>
                        {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
                    </Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    contentContainer: {
        flexGrow: 1,
    },
    headerImage: {
        width: width,
        height: width,
        alignSelf: 'center',
    },
    content: {
        padding: 20,
        flex: 1,
        justifyContent: 'center',
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 15,
        color: '#2c5f7c',
    },
    subtitle: {
        fontSize: 15,
        textAlign: 'center',
        marginBottom: 30,
        color: '#666',
        lineHeight: 22,
        paddingHorizontal: 10,
    },
    input: {
        borderWidth: 1,
        borderColor: '#ddd',
        padding: 15,
        marginBottom: 15,
        borderRadius: 8,
        fontSize: 16,
    },
    button: {
        backgroundColor: '#2c5f7c',
        padding: 15,
        borderRadius: 8,
        alignItems: 'center',
        marginBottom: 15,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    switchText: {
        textAlign: 'center',
        color: '#2c5f7c',
        marginTop: 10,
    },
});