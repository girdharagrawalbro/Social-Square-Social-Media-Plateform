import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, useColorScheme, Dimensions } from 'react-native';
import useAuthStore from '../store/zustand/useAuthStore';

const { width, height } = Dimensions.get('window');

export default function SplashScreen({ navigation }: any) {
  const isDark = useColorScheme() === 'dark';
  const { initAuth, user } = useAuthStore();

  useEffect(() => {
    const checkAuth = async () => {
      // Small artificial delay for premium branding splash screen feel
      await new Promise<void>((resolve) => setTimeout(resolve, 2000));
      await initAuth();
      const updatedUser = useAuthStore.getState().user;
      if (updatedUser) {
        navigation.replace('SocialSquare');
      } else {
        navigation.replace('Login');
      }
    };
    checkAuth();
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#0a0a0a' : '#ffffff' }]}>
      {/* Dynamic Background Graphics */}
      <View style={styles.backgroundGraphics}>
        {/* Angled Purple Background */}
        <View style={styles.angledGradient} />

        {/* Floating Shapes */}
        <View style={styles.floatingShapeRight} />
        <View style={styles.floatingShapeLeft} />
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.logoText}>Social Square</Text>
        <Text style={[styles.tagline, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
          Your social universe, squared.
        </Text>
        <ActivityIndicator size="large" color="#808bf5" style={styles.loader} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backgroundGraphics: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
  },
  angledGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: height * 0.55,
    backgroundColor: '#808bf5',
    // Mock the clipPath polygon look
    borderBottomLeftRadius: width * 0.15,
    borderBottomRightRadius: width * 0.15,
  },
  floatingShapeRight: {
    position: 'absolute',
    top: height * 0.28,
    right: '5%',
    width: 120,
    height: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    transform: [{ rotate: '-12deg' }],
    borderRadius: 4,
  },
  floatingShapeLeft: {
    position: 'absolute',
    bottom: height * 0.25,
    left: '8%',
    width: 100,
    height: 25,
    backgroundColor: 'rgba(128, 139, 245, 0.2)',
    transform: [{ rotate: '-12deg' }],
    borderRadius: 4,
  },
  content: {
    alignItems: 'center',
    zIndex: 10,
  },
  logoText: {
    fontSize: 48,
    fontFamily: 'Pacifico-Regular', // Fallback to system sans if not loaded
    fontWeight: 'bold',
    color: '#ffffff',
    textShadowColor: 'rgba(0, 0, 0, 0.15)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 6,
    marginBottom: 8,
  },
  tagline: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 40,
  },
  loader: {
    marginTop: 20,
  },
});
