import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, useColorScheme } from 'react-native';

interface SkeletonItemProps {
  style?: any;
}

const SkeletonItem = ({ style }: SkeletonItemProps) => {
  const isDark = useColorScheme() === 'dark';
  const pulseAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const color = isDark ? '#27273a' : '#e2e8f0';

  return (
    <Animated.View style={[style, { opacity: pulseAnim, backgroundColor: color }]} />
  );
};

export const PostSkeleton = () => {
  const isDark = useColorScheme() === 'dark';
  const cardBg = isDark ? '#121212' : '#ffffff';
  const border = isDark ? '#1f2937' : '#e5e7eb';

  return (
    <View style={[styles.postCard, { backgroundColor: cardBg, borderColor: border }]}>
      {/* Header */}
      <View style={styles.postHeader}>
        <SkeletonItem style={styles.avatar} />
        <View style={styles.userInfo}>
          <SkeletonItem style={styles.username} />
          <SkeletonItem style={styles.time} />
        </View>
      </View>

      {/* Content */}
      <SkeletonItem style={styles.captionLine} />
      <SkeletonItem style={[styles.captionLine, { width: '80%', marginTop: 6 }]} />

      {/* Media Block */}
      <SkeletonItem style={styles.mediaBlock} />

      {/* Footer */}
      <View style={styles.footer}>
        <SkeletonItem style={styles.footerAction} />
        <SkeletonItem style={styles.footerAction} />
        <SkeletonItem style={styles.footerAction} />
      </View>
    </View>
  );
};

export const NotificationSkeleton = () => {
  const isDark = useColorScheme() === 'dark';
  const cardBg = isDark ? '#121212' : '#ffffff';
  const border = isDark ? '#1f2937' : '#e5e7eb';

  return (
    <View style={[styles.notifCard, { backgroundColor: cardBg, borderBottomColor: border }]}>
      <SkeletonItem style={styles.notifAvatar} />
      <View style={styles.notifContent}>
        <SkeletonItem style={styles.notifLine} />
        <SkeletonItem style={[styles.notifLine, { width: '40%', marginTop: 6 }]} />
      </View>
    </View>
  );
};

export const ChatSkeleton = () => {
  const isDark = useColorScheme() === 'dark';
  const cardBg = isDark ? '#121212' : '#ffffff';
  const border = isDark ? '#1f2937' : '#e5e7eb';

  return (
    <View style={[styles.chatCard, { backgroundColor: cardBg, borderBottomColor: border }]}>
      <SkeletonItem style={styles.chatAvatar} />
      <View style={styles.chatContent}>
        <View style={styles.chatHeader}>
          <SkeletonItem style={styles.chatName} />
          <SkeletonItem style={styles.chatTime} />
        </View>
        <SkeletonItem style={styles.chatMessage} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  // Post Skeleton
  postCard: {
    marginVertical: 8,
    marginHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  userInfo: {
    marginLeft: 12,
    flex: 1,
  },
  username: {
    width: 120,
    height: 14,
    borderRadius: 4,
  },
  time: {
    width: 60,
    height: 10,
    borderRadius: 3,
    marginTop: 6,
  },
  captionLine: {
    height: 14,
    borderRadius: 4,
    width: '95%',
  },
  mediaBlock: {
    height: 200,
    borderRadius: 12,
    marginTop: 12,
    width: '100%',
  },
  footer: {
    flexDirection: 'row',
    marginTop: 14,
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: 'transparent', // just spacing
    paddingTop: 8,
  },
  footerAction: {
    width: 50,
    height: 18,
    borderRadius: 4,
  },

  // Notification Skeleton
  notifCard: {
    flexDirection: 'row',
    padding: 14,
    borderBottomWidth: 1,
    alignItems: 'center',
  },
  notifAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  notifContent: {
    marginLeft: 12,
    flex: 1,
  },
  notifLine: {
    height: 13,
    borderRadius: 4,
    width: '75%',
  },

  // Chat Skeleton
  chatCard: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    alignItems: 'center',
  },
  chatAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  chatContent: {
    marginLeft: 12,
    flex: 1,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  chatName: {
    height: 14,
    width: 100,
    borderRadius: 4,
  },
  chatTime: {
    height: 10,
    width: 40,
    borderRadius: 3,
  },
  chatMessage: {
    height: 12,
    width: '80%',
    borderRadius: 4,
  },
});
