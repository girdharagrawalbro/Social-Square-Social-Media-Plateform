import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, useColorScheme, Dimensions, ScrollView } from 'react-native';

const { width } = Dimensions.get('window');
const gridCellSize = (width - 48 - 8) / 3; // 48 = horizontal padding, 8 = 2 gaps of 4px

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

export const ProfileSkeleton = () => {
  const isDark = useColorScheme() === 'dark';
  const cardBg = isDark ? '#121212' : '#ffffff';
  const border = isDark ? '#1f2937' : '#e5e7eb';
  const bg = isDark ? '#0a0a0a' : '#f3f4f6';

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: bg }}
      scrollEnabled={false}
      contentContainerStyle={{ paddingBottom: 32 }}
    >
      {/* Profile Card */}
      <View style={[sk.card, { backgroundColor: cardBg, borderColor: border }]}>
        {/* Avatar */}
        <View style={{ alignItems: 'center', marginBottom: 14 }}>
          <SkeletonItem style={sk.avatar} />
        </View>

        {/* Full name + username + bio */}
        <View style={{ alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <SkeletonItem style={sk.fullnameLine} />
          <SkeletonItem style={sk.usernameLine} />
          <SkeletonItem style={sk.bioLine} />
        </View>

        {/* Level / Streak / XP badges */}
        <View style={sk.badgesRow}>
          <SkeletonItem style={sk.badge} />
          <SkeletonItem style={sk.badge} />
          <SkeletonItem style={sk.badge} />
        </View>

        {/* Stats grid — 4 tiles */}
        <View style={sk.statsGrid}>
          <SkeletonItem style={sk.statTile} />
          <SkeletonItem style={sk.statTile} />
          <SkeletonItem style={sk.statTile} />
          <SkeletonItem style={sk.statTile} />
        </View>

        {/* Action buttons */}
        <View style={sk.actionsRow}>
          <SkeletonItem style={sk.actionBtn} />
          <SkeletonItem style={sk.actionBtn} />
          <SkeletonItem style={sk.actionBtnSmall} />
        </View>
      </View>

      {/* Consistency Graph Card */}
      <View style={[sk.card, sk.graphCard, { backgroundColor: cardBg, borderColor: border }]}>
        {/* Title bar */}
        <View style={sk.graphHeader}>
          <SkeletonItem style={sk.graphTitle} />
          <SkeletonItem style={sk.graphChevron} />
        </View>
        {/* Fake graph grid */}
        <View style={sk.graphGrid}>
          {Array.from({ length: 16 }).map((_, col) => (
            <View key={col} style={sk.graphCol}>
              {Array.from({ length: 7 }).map((_, row) => (
                <SkeletonItem key={row} style={sk.graphCell} />
              ))}
            </View>
          ))}
        </View>
      </View>

      {/* Post Grid */}
      <View style={[sk.card, sk.gridCard, { backgroundColor: cardBg, borderColor: border }]}>
        {/* Tabs bar */}
        <View style={sk.tabsRow}>
          {[1, 2, 3, 4].map(i => (
            <SkeletonItem key={i} style={sk.tab} />
          ))}
        </View>
        {/* 3-column grid */}
        <View style={sk.postGrid}>
          {Array.from({ length: 9 }).map((_, i) => (
            <SkeletonItem key={i} style={sk.gridCell} />
          ))}
        </View>
      </View>
    </ScrollView>
  );
};

const sk = StyleSheet.create({
  card: {
    marginHorizontal: 12,
    marginTop: 12,
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  fullnameLine: { width: 160, height: 18, borderRadius: 6 },
  usernameLine:  { width: 100, height: 13, borderRadius: 4 },
  bioLine:       { width: 230, height: 11, borderRadius: 4 },

  // Gamification badges row
  badgesRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 16,
  },
  badge: { width: 80, height: 56, borderRadius: 14 },

  // Stats 2×2 grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  statTile: {
    width: '47%',
    height: 64,
    borderRadius: 14,
  },

  // Action buttons
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: { flex: 1, height: 42, borderRadius: 12 },
  actionBtnSmall: { width: 42, height: 42, borderRadius: 12 },

  // Consistency graph card
  graphCard: { paddingVertical: 14 },
  graphHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  graphTitle:   { width: 140, height: 12, borderRadius: 4 },
  graphChevron: { width: 18, height: 18, borderRadius: 4 },
  graphGrid: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 3,
  },
  graphCol:  { flexDirection: 'column', gap: 3 },
  graphCell: { width: 10, height: 10, borderRadius: 2 },

  // Post grid card
  gridCard: { paddingBottom: 14 },
  tabsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
    paddingBottom: 10,
  },
  tab: { width: 72, height: 32, borderRadius: 8 },
  postGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  gridCell: {
    width: gridCellSize,
    height: gridCellSize,
    borderRadius: 8,
  },
});

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
