import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BulletinBoardScreen from '../screens/BulletinBoardScreen';
import MessagesScreen from '../screens/MessagesScreen';
import CalendarScreen from '../screens/CalendarScreen';
import ProfileScreen from '../screens/ProfileScreen';
import ProfileSetupScreen from '../screens/ProfileSetupScreen';
import SettingsScreen from '../screens/SettingsScreen';

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
                    title: 'Nest News',
                    tabBarLabel: 'Nest News',
                    headerRight: () => (
                        <View style={{ flexDirection: 'row', marginRight: 15 }}>
                            <TouchableOpacity
                                onPress={() => navigation.navigate('Settings')}
                                style={{ marginRight: 15 }}
                            >
                                <Ionicons name="settings-outline" size={28} color="#fff" />
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => navigation.navigate('Profile')}
                            >
                                <Ionicons name="person-circle-outline" size={32} color="#fff" />
                            </TouchableOpacity>
                        </View>
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
                options={{
                    title: 'Cawlendar',
                    tabBarLabel: 'Cawlendar',
                }}
            />
            <Tab.Screen
                name="Profile"
                component={ProfileScreen}
                options={{
                    tabBarButton: () => null,
                }}
            />
            <Tab.Screen
                name="Settings"
                component={SettingsScreen}
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