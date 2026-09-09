import React, { useRef, useState, useEffect } from 'react';
import { View, StyleSheet, Modal, Animated, Dimensions } from 'react-native';
import { useTabStore } from '../store/zustand/useTabStore';
import { useLiveStore } from '../store/zustand/useLiveStore';
import { useTheme } from '../theme';
import { useSwipeGesture } from '../lib/useSwipeGesture';

// Main tab components
import SocialSquareScreen from './SocialSquareScreen';
import ReelsScreen from './ReelsScreen';
import ChatScreen from './ChatScreen';
import ExploreScreen from './ExploreScreen';
import ProfileScreen from './ProfileScreen';
import LiveStreamScreen from './LiveStreamScreen';
import BottomNav from './components/BottomNav';
import type { AppScreenProps } from '../navigation/types';

const SWIPE_THRESHOLD = 40;
const SWIPE_VELOCITY_THRESHOLD = 0.5;
const SLIDE_DURATION = 220;
const navItemsList = ['feed', 'reels', 'messages', 'explore', 'profile'];
const SCREEN_WIDTH = Dimensions.get('window').width;

export default function MainTabsScreen({ navigation }: AppScreenProps<'SocialSquare'>) {
  const { currentTab, setTab } = useTabStore();
  const { liveStreamId, isLiveHost, clearLiveStream } = useLiveStore();
  const { colors } = useTheme();

  const [mountedTabs, setMountedTabs] = useState<string[]>([currentTab]);

  useEffect(() => {
    if (!mountedTabs.includes(currentTab)) {
      setMountedTabs(prev => [...prev, currentTab]);
    }
  }, [currentTab, mountedTabs]);

  // Instagram-style swipe-between-tabs — the previous/next tab (whichever the finger
  // is dragging toward) is already mounted just off-screen, so it visually slides in
  // alongside the current one instead of the old instant display:none/flex cut.
  const isAnimatingRef = useRef(false);
  const currentTabRef = useRef(currentTab);
  useEffect(() => {
    currentTabRef.current = currentTab;
  }, [currentTab]);

  const slideToTab = (direction: -1 | 1, targetIndex: number) => {
    isAnimatingRef.current = true;
    Animated.timing(dragX, {
      toValue: direction * SCREEN_WIDTH,
      duration: SLIDE_DURATION,
      useNativeDriver: true,
    }).start(() => {
      setTab(navItemsList[targetIndex]);
      dragX.setValue(0);
      isAnimatingRef.current = false;
    });
  };

  const { panResponder, dragX, springBack } = useSwipeGesture({
    shouldActivate: (g) =>
      !isAnimatingRef.current && Math.abs(g.dx) > 25 && Math.abs(g.dx) > Math.abs(g.dy) * 2.5,
    commitThreshold: SWIPE_THRESHOLD,
    commitVelocity: SWIPE_VELOCITY_THRESHOLD,
    transformDx: (dx) => {
      const currentIndex = navItemsList.indexOf(currentTabRef.current);
      // Rubber-band at the ends — there's no tab to slide in past Feed or Profile.
      if (currentIndex === 0 && dx > 0) return dx * 0.35;
      if (currentIndex === navItemsList.length - 1 && dx < 0) return dx * 0.35;
      return dx;
    },
    onCommitNegative: () => {
      const currentIndex = navItemsList.indexOf(currentTabRef.current);
      if (currentIndex < navItemsList.length - 1) slideToTab(-1, currentIndex + 1);
      else springBack();
    },
    onCommitPositive: () => {
      const currentIndex = navItemsList.indexOf(currentTabRef.current);
      if (currentIndex > 0) {
        slideToTab(1, currentIndex - 1);
      } else {
        // Swiping right on Feed (nothing to slide in from) opens the composer instead.
        springBack();
        navigation.navigate('NewPost');
      }
    },
  });

  const currentIndex = navItemsList.indexOf(currentTab);

  const renderTabSlot = (tabName: string, node: React.ReactNode) => {
    if (!mountedTabs.includes(tabName)) return null;
    const tabIndex = navItemsList.indexOf(tabName);
    const offsetSlots = tabIndex - currentIndex;

    // Tabs more than one slot away from the active one aren't part of the live drag —
    // keep them mounted (fast re-entry) but fully out of the layout.
    if (Math.abs(offsetSlots) > 1) {
      return (
        <View key={tabName} style={[styles.screenContainer, { display: 'none' }]}>
          {node}
        </View>
      );
    }

    return (
      <Animated.View
        key={tabName}
        style={[
          styles.screenSlot,
          {
            left: offsetSlots * SCREEN_WIDTH,
            transform: [{ translateX: dragX }],
          },
        ]}
        pointerEvents={offsetSlots === 0 ? 'auto' : 'none'}
      >
        {node}
      </Animated.View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]} {...panResponder.panHandlers}>
      {renderTabSlot('feed', <SocialSquareScreen navigation={navigation} />)}
      {renderTabSlot('reels', <ReelsScreen navigation={navigation} />)}
      {renderTabSlot('messages', <ChatScreen />)}
      {renderTabSlot('explore', <ExploreScreen navigation={navigation} />)}
      {renderTabSlot('profile', <ProfileScreen navigation={navigation} />)}

      {currentTab !== 'reels' && <BottomNav currentTab={currentTab} navigation={navigation} />}

      {/* Full-screen Native Live Stream Overlay */}
      <Modal
        visible={!!liveStreamId}
        animationType="slide"
        transparent={false}
        onRequestClose={clearLiveStream}
      >
        {liveStreamId && (
          <LiveStreamScreen
            streamId={liveStreamId}
            isHost={isLiveHost}
            onClose={clearLiveStream}
          />
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  screenContainer: {
    flex: 1,
  },
  screenSlot: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: SCREEN_WIDTH,
  },
});
