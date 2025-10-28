import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import BulletinBoardScreen from '../screens/BulletinBoardScreen';
import MessagesScreen from '../screens/MessagesScreen';
import CalendarScreen from '../screens/CalendarScreen';

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
                options={{
                    title: 'Nest Notes',
                    tabBarLabel: 'Nest Notes',
                }}
            />
            <Tab.Screen
                name="Messages"
                component={MessagesScreen}
            />
            <Tab.Screen
                name="Calendar"
                component={CalendarScreen}
            />
        </Tab.Navigator>
    );
}