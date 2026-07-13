import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  useColorScheme,
  Dimensions,
  Image,
} from 'react-native';
import useAuthStore from '../store/zustand/useAuthStore';

const { width, height } = Dimensions.get('window');

export default function SplashScreen({ navigation }: any) {
  const isDark = useColorScheme() === 'dark';
  const { initAuth } = useAuthStore();

  useEffect(() => {
    const checkAuth = async () => {
      await new Promise<void>(resolve => setTimeout(resolve, 2000));

      await initAuth();

      const updatedUser = useAuthStore.getState().user;

      navigation.replace(updatedUser ? 'SocialSquare' : 'Login');
    };

    checkAuth();
  }, []);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: isDark ? '#0A0A0A' : '#FFFFFF',
        },
      ]}>
      {/* Content */}
      <View style={styles.content}>
        <Image
          source={require('../../assets/logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />

        <Text
          style={[
            styles.title,
            {
              color: isDark ? '#FFFFFF' : '#111827',
            },
          ]}>
          Social Square
        </Text>

        <Text
          style={[
            styles.subtitle,
            {
              color: '#808BF5',
            },
          ]}>
          AI Powered Social Media
        </Text>

        {/* <ActivityIndicator
          size="small"
          color="#808BF5"
          style={styles.loader}
        /> */}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  content: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },

  logo: {
    width: 140,
    height: 140,
    marginBottom: 20,
  },

  title: {
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  subtitle: {
    marginTop: 8,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    textAlign: 'center',
  },

  loader: {
    marginTop: 45,
  },
});