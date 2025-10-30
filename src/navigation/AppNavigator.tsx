import React from 'react';
import { Image, View, Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import BulletinBoardScreen from '../screens/BulletinBoardScreen';
import MessagesScreen from '../screens/MessagesScreen';
import CalendarScreen from '../screens/CalendarScreen';
import ProfileScreen from '../screens/ProfileScreen';

const Tab = createBottomTabNavigator();

// Custom header component with icon
const HeaderWithIcon = ({ title }: { title: string }) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Image
            source={require('../../assets/header-icon.png')}
            style={{ width: 28, height: 28 }}
        />
        <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }}>
            {title}
        </Text>
    </View>
);

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
                options={{
                    headerTitle: () => <HeaderWithIcon title="Nest News" />,
                    tabBarLabel: 'Nest News',
                }}
            />
            <Tab.Screen
                name="Messages"
                component={MessagesScreen}
                options={{
                    headerTitle: () => <HeaderWithIcon title="Messages" />,
                }}
            />
            <Tab.Screen
                name="Calendar"
                component={CalendarScreen}
                options={{
                    headerTitle: () => <HeaderWithIcon title="Calendar" />,
                }}
            />
            <Tab.Screen
                name="Profile"
                component={ProfileScreen}
                options={{
                    headerTitle: () => <HeaderWithIcon title="Profile" />,
                }}
            />
        </Tab.Navigator>
    );
}