import React, { useEffect, useRef } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
  Dimensions,
  Animated,
  Text,
  Image,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import useAuthStore from '../../store/zustand/useAuthStore';
import { useTabStore } from '../../store/zustand/useTabStore';

const { width } = Dimensions.get('window');

const navItems = [
  { key: 'feed', icon: 'home', routeName: 'SocialSquare' },
  { key: 'reels', icon: 'video', routeName: 'Reels' },
  // { key: 'pulse', icon: 'flash', routeName: 'Pulse' },
  // { key: 'knowledge', icon: 'book-open', routeName: 'Knowledge' },
  { key: 'messages', icon: 'email', routeName: 'Chat' },
  { key: 'explore', icon: 'magnify', routeName: 'Explore' },
  { key: 'profile', icon: 'account', routeName: 'Profile' },
];

export default function BottomNav({ currentTab, navigation }: { currentTab: string; navigation: any }) {
  const user = useAuthStore((s: any) => s.user);
  const { currentTab: storeTab, setTab } = useTabStore();
  const activeTab = storeTab || currentTab;

  const isDark = useColorScheme() === 'dark';
  const itemWidth = width / navItems.length;

  // Find the index of the active item
  const activeIndex = navItems.findIndex((item) => item.key === activeTab);

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
  }, [activeTab, activeIndex]);

  const cardBg = isDark ? 'rgba(10, 10, 10, 0.95)' : 'rgba(255, 255, 255, 0.95)';
  const border = isDark ? '#1f2937' : '#e5e7eb';
  const inactiveColor = isDark ? '#9ca3af' : '#6b7280';

  const handlePress = (key: string, routeName: string) => {
    setTab(key);
    navigation.navigate('SocialSquare');
  };

  return (
    <View style={[styles.container, { backgroundColor: cardBg, borderTopColor: border }]}>
      {/* Sliding Pill Indicator */}
      <Animated.View style={[{ left: slideAnim }]}>
        <LinearGradient
          colors={['#808bf5', '#6366f1', '#4f46e5']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        />
      </Animated.View>

      {/* Nav Buttons */}
      {navItems.map((item) => {
        const isActive = item.key === activeTab;
        return (
          <TouchableOpacity
            key={item.key}
            style={styles.navButton}
            onPress={() => handlePress(item.key, item.routeName)}
            activeOpacity={0.8}
          >
            {item.key === 'profile' ? (
              user?.profile_picture ? (
                <Image
                  source={{ uri: user.profile_picture }}
                  style={[
                    styles.profilePicIcon,
                    isActive && { borderColor: '#808bf5', borderWidth: 2 }
                  ]}
                />
              ) : (
                <View
                  style={[
                    styles.profilePicIconPlaceholder,
                    { backgroundColor: isActive ? '#6366f1' : inactiveColor },
                    isActive && { borderColor: '#ffffff', borderWidth: 2 }
                  ]}
                >
                  <Text style={styles.profilePicInitial}>
                    {user?.fullname?.[0]?.toUpperCase() || 'U'}
                  </Text>
                </View>
              )
            ) : (
              <MaterialCommunityIcons
                name={item.key === 'explore' ? 'magnify' : (isActive ? item.icon : `${item.icon}-outline`)}
                size={isActive ? 24 : 22}
                color={isActive ? '#1f2937' : inactiveColor}
                style={isActive ? styles.activeIcon : null}
              />
            )}
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
  profilePicIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#9ca3af',
  },
  profilePicIconPlaceholder: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profilePicInitial: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
  },
});
