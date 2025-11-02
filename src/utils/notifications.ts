import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { doc, setDoc } from 'firebase/firestore';
import { db, auth } from '../../firebase.config';

// Configure how notifications are handled when app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPushNotificationsAsync() {
  let token;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#2c5f7c',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      alert('Failed to get push token for push notification!');
      return;
    }
        token = (await Notifications.getExpoPushTokenAsync({
      projectId: '819868e1-e12c-44d2-b3b0-a909e4794728'
    })).data;
    
    // Save token to Firestore
    if (auth.currentUser) {
      await setDoc(
        doc(db, 'users', auth.currentUser.uid),
        { pushToken: token },
        { merge: true }
      );
    }
  } else {
    alert('Must use physical device for Push Notifications');
  }

  return token;
}

export async function sendPushNotification(
  expoPushToken: string,
  title: string,
  body: string,
  data?: any
) {
  const message = {
    to: expoPushToken,
    sound: 'default',
    title: title,
    body: body,
    data: data,
  };

  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(message),
  });
}

export async function sendNotificationToUsers(
  userIds: string[],
  title: string,
  body: string,
  type: 'nestNotes' | 'messages' | 'calendar'
) {
  const { collection, getDocs, query, where } = await import('firebase/firestore');
  
  try {
    // Get all user documents
    const usersQuery = query(
      collection(db, 'users'),
      where('__name__', 'in', userIds)
    );
    
    const usersSnapshot = await getDocs(usersQuery);
    
    const promises = usersSnapshot.docs.map(async (userDoc) => {
      const userData = userDoc.data();
      const settings = userData.notificationSettings || {
        nestNotes: true,
        messages: true,
        calendar: true,
      };
      
      // Check if user has notifications enabled for this type
      if (settings[type] && userData.pushToken) {
        await sendPushNotification(
          userData.pushToken,
          title,
          body,
          { type, userId: userDoc.id }
        );
      }
    });
    
    await Promise.all(promises);
  } catch (error) {
    console.error('Error sending notifications:', error);
  }
}