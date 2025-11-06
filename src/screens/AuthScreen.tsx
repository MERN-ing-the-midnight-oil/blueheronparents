import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Alert } from 'react-native';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../firebase.config';

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
        <View style={styles.container}>
            <Text style={styles.title}>Blue Heron Rookery</Text>
            <Text style={styles.subtitle}>Parent Community App</Text>

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

            <Pressable style={styles.button} onPress={handleAuth}>
                <Text style={styles.buttonText}>
                    {isSignUp ? 'Sign Up' : 'Sign In'}
                </Text>
            </Pressable>

            <Pressable onPress={() => setIsSignUp(!isSignUp)}>
                <Text style={styles.switchText}>
                    {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
                </Text>
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        padding: 20,
        backgroundColor: '#fff',
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 8,
        color: '#2c5f7c',
    },
    subtitle: {
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 40,
        color: '#666',
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