import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BulletinBoardScreen from '../screens/BulletinBoardScreen';
import MessagesScreen from '../screens/MessagesScreen';
import CalendarScreen from '../screens/CalendarScreen';
import ProfileScreen from '../screens/ProfileScreen';
import ProfileSetupScreen from '../screens/ProfileSetupScreen';

const Tab = createBottomTabNavigator();

export default function AppNavigator() {
    return (
        <Tab.Navigator
            screenOptions={{
                tabBarActiveTintColor: '#2c5f7c',
                tabBarInactiveTintColor: '#999',
                headerStyle: {
                    backgroundColor: '#2c5f7c',
                },
                headerTintColor: '#fff',
                headerTitleStyle: {
                    fontWeight: 'bold',
                },
            }}
        >
            <Tab.Screen
                name="Board"
                component={BulletinBoardScreen}
                options={({ navigation }) => ({
                    title: 'Nest Notes',
                    tabBarLabel: 'Nest Notes',
                    headerRight: () => (
                        <TouchableOpacity
                            onPress={() => navigation.navigate('Profile')}
                            style={{ marginRight: 15 }}
                        >
                            <Ionicons name="person-circle-outline" size={32} color="#fff" />
                        </TouchableOpacity>
                    ),
                })}
            />
            <Tab.Screen
                name="Messages"
                component={MessagesScreen}
            />
            <Tab.Screen
                name="Calendar"
                component={CalendarScreen}
            />
            <Tab.Screen
                name="Profile"
                component={ProfileScreen}
                options={{
                    tabBarButton: () => null,
                }}
            />
            <Tab.Screen
                name="EditProfile"
                options={{
                    title: 'Edit Profile',
                    tabBarButton: () => null,
                }}
            >
                {(props) => (
                    <ProfileSetupScreen
                        {...props}
                        editMode={true}
                        onComplete={() => props.navigation.goBack()}
                    />
                )}
            </Tab.Screen>
        </Tab.Navigator>
    );
}