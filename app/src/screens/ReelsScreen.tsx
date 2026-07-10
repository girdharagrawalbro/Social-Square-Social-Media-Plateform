import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  useColorScheme,
  Dimensions,
  Image,
  TouchableOpacity,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import BottomNav from './components/BottomNav';

const { width, height } = Dimensions.get('window');

export default function ReelsScreen({ navigation }: any) {
  const isDark = useColorScheme() === 'dark';

  return (
    <SafeAreaView style={styles.container}>
      {/* Immersive Mock Reel Background */}
      <Image
        source={{ uri: 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=800' }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.overlay} />

      {/* Reel Details & Action Buttons */}
      <View style={styles.bottomOverlay}>
        <View style={styles.details}>
          <Text style={styles.username}>@nature_lover</Text>
          <Text style={styles.description}>Beautiful morning sunlight filtering through the trees. ☀️🌿</Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionButton}>
            <MaterialCommunityIcons name="heart" size={32} color="#ffffff" />
            <Text style={styles.actionText}>1.2K</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton}>
            <MaterialCommunityIcons name="comment-text" size={32} color="#ffffff" />
            <Text style={styles.actionText}>45</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton}>
            <MaterialCommunityIcons name="share-variant" size={32} color="#ffffff" />
            <Text style={styles.actionText}>Share</Text>
          </TouchableOpacity>
        </View>
      </View>

      <BottomNav currentTab="reels" navigation={navigation} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  bottomOverlay: {
    position: 'absolute',
    bottom: 80,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  details: {
    flex: 1,
    marginRight: 24,
  },
  username: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  description: {
    color: '#ffffff',
    fontSize: 14,
    lineHeight: 20,
  },
  actions: {
    alignItems: 'center',
  },
  actionButton: {
    alignItems: 'center',
    marginBottom: 16,
  },
  actionText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
});
