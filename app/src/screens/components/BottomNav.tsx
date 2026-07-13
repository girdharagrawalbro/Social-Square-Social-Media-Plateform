import React, { useEffect, useRef } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
  Dimensions,
  Animated,
  Text,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';

const { width } = Dimensions.get('window');

const navItems = [
  { key: 'feed', icon: 'home', routeName: 'SocialSquare' },
  { key: 'explore', icon: 'compass', routeName: 'Explore' },
  { key: 'reels', icon: 'video', routeName: 'Reels' },
  { key: 'pulse', icon: 'flash', routeName: 'Pulse' },
  { key: 'knowledge', icon: 'book-open', routeName: 'Knowledge' },
  { key: 'messages', icon: 'email', routeName: 'Chat' },
  { key: 'profile', icon: 'account', routeName: 'Profile' },
];

export default function BottomNav({ currentTab, navigation }: { currentTab: string; navigation: any }) {
  const isDark = useColorScheme() === 'dark';
  const itemWidth = width / navItems.length;
  
  // Find the index of the active item
  const activeIndex = navItems.findIndex((item) => item.key === currentTab);
  
  // Animated value for sliding pill left offset
  const slideAnim = useRef(new Animated.Value(activeIndex * itemWidth + (itemWidth - 42) / 2)).current;

  useEffect(() => {
    if (activeIndex !== -1) {
      Animated.spring(slideAnim, {
        toValue: activeIndex * itemWidth + (itemWidth - 42) / 2,
        useNativeDriver: false,
        damping: 15,
        stiffness: 120,
      }).start();
    }
  }, [currentTab, activeIndex]);

  const cardBg = isDark ? 'rgba(10, 10, 10, 0.95)' : 'rgba(255, 255, 255, 0.95)';
  const border = isDark ? '#1f2937' : '#e5e7eb';
  const inactiveColor = isDark ? '#9ca3af' : '#6b7280';

  const handlePress = (routeName: string) => {
    navigation.navigate(routeName);
  };

  return (
    <View style={[styles.container, { backgroundColor: cardBg, borderTopColor: border }]}>
      {/* Sliding Pill Indicator */}
      <Animated.View style={[styles.slidePill, { left: slideAnim }]}>
        <LinearGradient
          colors={['#808bf5', '#6366f1', '#4f46e5']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        />
      </Animated.View>

      {/* Nav Buttons */}
      {navItems.map((item) => {
        const isActive = item.key === currentTab;
        return (
          <TouchableOpacity
            key={item.key}
            style={styles.navButton}
            onPress={() => handlePress(item.routeName)}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons
              name={isActive ? item.icon : `${item.icon}-outline`}
              size={isActive ? 24 : 22}
              color={isActive ? '#ffffff' : inactiveColor}
              style={isActive ? styles.activeIcon : null}
            />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    paddingBottom: 4,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  navButton: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  slidePill: {
    position: 'absolute',
    width: 42,
    height: 42,
    borderRadius: 21,
    top: 9,
    zIndex: 5,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.38,
    shadowRadius: 8,
  },
  gradient: {
    width: '100%',
    height: '100%',
  },
  activeIcon: {
    // Slight shadow to lift icon off the pill
    textShadowColor: 'rgba(0, 0, 0, 0.25)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
