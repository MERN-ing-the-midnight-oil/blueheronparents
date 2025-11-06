// Device compatibility utility for iPad Air 5th generation
import * as Device from 'expo-device';
import { Platform } from 'react-native';

export const isOlderIPad = (): boolean => {
  if (Platform.OS !== 'ios') return false;
  
  // Check if it's an iPad Air 5th generation or older
  const deviceModel = Device.modelName || '';
  const isIPadAir5thGen = deviceModel.includes('iPad Air') && deviceModel.includes('5th');
  const isOlderIPad = deviceModel.includes('iPad') && !deviceModel.includes('Pro');
  
  return isIPadAir5thGen || isOlderIPad;
};

export const getOptimalImageSettings = () => {
  if (isOlderIPad()) {
    return {
      maxWidth: 600,
      compress: 0.4,
      quality: 0.6
    };
  }
  
  return {
    maxWidth: 1200,
    compress: 0.7,
    quality: 0.8
  };
};

export const shouldUseLessMemory = (): boolean => {
  return isOlderIPad();
};