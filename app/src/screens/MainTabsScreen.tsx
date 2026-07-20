import React, { useRef } from 'react';
import { View, StyleSheet, PanResponder, Modal } from 'react-native';
import { useTabStore } from '../store/zustand/useTabStore';
import { useLiveStore } from '../store/zustand/useLiveStore';

// Main tab components
import SocialSquareScreen from './SocialSquareScreen';
import ReelsScreen from './ReelsScreen';
import ChatScreen from './ChatScreen';
import ExploreScreen from './ExploreScreen';
import ProfileScreen from './ProfileScreen';
import LiveStreamScreen from './LiveStreamScreen';

const SWIPE_THRESHOLD = 40;
const navItemsList = ['feed', 'reels', 'messages', 'explore', 'profile'];

export default function MainTabsScreen({ navigation }: any) {
  const { currentTab, setTab } = useTabStore();
  const { liveStreamId, isLiveHost, clearLiveStream } = useLiveStore();

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        const { dx, dy } = gestureState;
        // Detect horizontal gestures (width of horizontal motion > 2.5x vertical motion and distance > 25px)
        return Math.abs(dx) > Math.abs(dy) * 2.5 && Math.abs(dx) > 25;
      },
      onPanResponderRelease: (evt, gestureState) => {
        const { dx } = gestureState;
        const currentIndex = navItemsList.indexOf(currentTab);

        if (dx < -SWIPE_THRESHOLD) {
          // Swiped left (finger moved right to left) -> go right
          if (currentIndex < navItemsList.length - 1) {
            setTab(navItemsList[currentIndex + 1]);
          }
        } else if (dx > SWIPE_THRESHOLD) {
          // Swiped right (finger moved left to right) -> go left
          if (currentIndex > 0) {
            setTab(navItemsList[currentIndex - 1]);
          } else if (currentIndex === 0) {
            // Swiping right on Feed tab -> open new post
            navigation.navigate('NewPost');
          }
        }
      },
    })
  ).current;

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      <View style={[styles.screenContainer, { display: currentTab === 'feed' ? 'flex' : 'none' }]}>
        <SocialSquareScreen navigation={navigation} />
      </View>
      <View style={[styles.screenContainer, { display: currentTab === 'reels' ? 'flex' : 'none' }]}>
        <ReelsScreen navigation={navigation} />
      </View>
      <View style={[styles.screenContainer, { display: currentTab === 'messages' ? 'flex' : 'none' }]}>
        <ChatScreen />
      </View>
      <View style={[styles.screenContainer, { display: currentTab === 'explore' ? 'flex' : 'none' }]}>
        <ExploreScreen navigation={navigation} />
      </View>
      <View style={[styles.screenContainer, { display: currentTab === 'profile' ? 'flex' : 'none' }]}>
        <ProfileScreen navigation={navigation} />
      </View>

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
    backgroundColor: '#000000',
  },
  screenContainer: {
    flex: 1,
  },
});
