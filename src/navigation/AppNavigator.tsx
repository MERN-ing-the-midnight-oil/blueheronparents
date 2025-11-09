import React from 'react';
import { createBottomTabNavigator, BottomTabBar } from '@react-navigation/bottom-tabs';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BulletinBoardScreen from '../screens/BulletinBoardScreen';
import MessagesScreen from '../screens/MessagesScreen';
import CalendarScreen from '../screens/CalendarScreen';
import ProfileScreen from '../screens/ProfileScreen';
import ProfileSetupScreen from '../screens/ProfileSetupScreen';
import SettingsScreen from '../screens/SettingsScreen';

const PRIMARY_TABS = ['Board', 'Messages', 'Calendar'];
const Tab = createBottomTabNavigator();

const HeaderShortcuts = ({ navigation }: { navigation: any }) => (
    <View style={{ flexDirection: 'row', marginRight: 15 }}>
        <Pressable
            onPress={() => navigation.navigate('Settings')}
            style={{ marginRight: 15 }}
        >
            <Ionicons name="settings-outline" size={28} color="#fff" />
        </Pressable>
        <Pressable
            onPress={() => navigation.navigate('Profile')}
        >
            <Ionicons name="person-circle-outline" size={32} color="#fff" />
        </Pressable>
    </View>
);

const HeaderHomeButton = ({ navigation }: { navigation: any }) => (
    <Pressable
        onPress={() => navigation.navigate('Board')}
        style={{ marginLeft: 15 }}
    >
        <Ionicons name="home-outline" size={28} color="#fff" />
    </Pressable>
);

const PrimaryTabBar = (props: any) => {
    const filteredRoutes = props.state.routes
        .map((route: any, originalIndex: number) => ({ route, originalIndex }))
        .filter(({ route }: any) => PRIMARY_TABS.includes(route.name));

    const activeIndex = filteredRoutes.findIndex(
        ({ originalIndex }: any) => originalIndex === props.state.index
    );

    const state = {
        ...props.state,
        routes: filteredRoutes.map(({ route }: any) => route),
        index: activeIndex >= 0 ? activeIndex : 0,
    };

    return (
        <BottomTabBar
            {...props}
            state={state}
            style={[
                props.style,
                { justifyContent: 'space-between', paddingHorizontal: 32 },
            ]}
        />
    );
};

export default function AppNavigator() {
    return (
        <Tab.Navigator
            tabBar={PrimaryTabBar}
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
                    headerRight: () => <HeaderShortcuts navigation={navigation} />,
                })}
            />
            <Tab.Screen
                name="Messages"
                component={MessagesScreen}
                options={({ navigation }) => ({
                    headerRight: () => <HeaderShortcuts navigation={navigation} />,
                    headerLeft: () => <HeaderHomeButton navigation={navigation} />,
                })}
            />
            <Tab.Screen
                name="Calendar"
                component={CalendarScreen}
                options={({ navigation }) => ({
                    title: 'Cawlendar',
                    tabBarLabel: 'Cawlendar',
                    headerRight: () => <HeaderShortcuts navigation={navigation} />,
                    headerLeft: () => <HeaderHomeButton navigation={navigation} />,
                })}
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