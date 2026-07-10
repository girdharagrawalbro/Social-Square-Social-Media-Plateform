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
      await new Promise(resolve => setTimeout(resolve, 2000));

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
      {/* Background */}
      <View style={styles.backgroundGraphics}>
        <View style={styles.topBackground} />
        <View style={styles.floatingRight} />
        <View style={styles.floatingLeft} />
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Image
          source={require('../assets/logo.png')}
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
              color: isDark ? '#9CA3AF' : '#6B7280',
            },
          ]}>
          Your social universe, squared.
        </Text>

        <ActivityIndicator
          size="large"
          color="#808BF5"
          style={styles.loader}
        />
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

  backgroundGraphics: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },

  topBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: height * 0.52,
    backgroundColor: '#808BF5',
    borderBottomLeftRadius: 60,
    borderBottomRightRadius: 60,
  },

  floatingRight: {
    position: 'absolute',
    top: height * 0.22,
    right: -20,
    width: 140,
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 30,
    transform: [{ rotate: '-15deg' }],
  },

  floatingLeft: {
    position: 'absolute',
    bottom: height * 0.18,
    left: -20,
    width: 110,
    height: 28,
    backgroundColor: 'rgba(128,139,245,0.15)',
    borderRadius: 30,
    transform: [{ rotate: '-15deg' }],
  },

  content: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },

  logo: {
    width: 120,
    height: 120,
    marginBottom: 24,
  },

  title: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  subtitle: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },

  loader: {
    marginTop: 50,
  },
});