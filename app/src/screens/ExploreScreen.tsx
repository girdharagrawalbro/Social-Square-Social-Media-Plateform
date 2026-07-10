import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  useColorScheme,
  TextInput,
  FlatList,
  Image,
  Dimensions,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import BottomNav from './components/BottomNav';

const { width } = Dimensions.get('window');
const gridWidth = (width - 6) / 3;

// Mock explore items matching web explore feed
const exploreItems = [
  { id: '1', url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=300' },
  { id: '2', url: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=300' },
  { id: '3', url: 'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=300' },
  { id: '4', url: 'https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=300' },
  { id: '5', url: 'https://images.unsplash.com/photo-1472214222555-d404758b1c42?w=300' },
  { id: '6', url: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=300' },
  { id: '7', url: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=300' },
  { id: '8', url: 'https://images.unsplash.com/photo-1527631746610-bca00a040d60?w=300' },
  { id: '9', url: 'https://images.unsplash.com/photo-1500627869374-13cd993b1115?w=300' },
];

export default function ExploreScreen({ navigation }: any) {
  const isDark = useColorScheme() === 'dark';
  const [search, setSearch] = useState('');

  const bg = isDark ? '#0a0a0a' : '#f3f4f6';
  const headerBg = isDark ? '#121212' : '#ffffff';
  const inputBg = isDark ? 'rgba(255, 255, 255, 0.05)' : '#f3f4f6';
  const textColor = isDark ? '#ffffff' : '#1f2937';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
      {/* Search Header */}
      <View style={[styles.header, { backgroundColor: headerBg }]}>
        <View style={[styles.searchBar, { backgroundColor: inputBg }]}>
          <MaterialCommunityIcons name="magnify" size={20} color={isDark ? '#6b7280' : '#9ca3af'} />
          <TextInput
            placeholder="Search communities, posts, users..."
            placeholderTextColor={isDark ? '#6b7280' : '#9ca3af'}
            style={[styles.input, { color: textColor }]}
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>

      {/* Grid Content */}
      <FlatList
        data={exploreItems}
        keyExtractor={(item) => item.id}
        numColumns={3}
        renderItem={({ item }) => (
          <Image source={{ uri: item.url }} style={styles.gridImage} />
        )}
        contentContainerStyle={styles.listContent}
      />

      <BottomNav currentTab="explore" navigation={navigation} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    height: 60,
    justifyContent: 'center',
    paddingHorizontal: 12,
    elevation: 2,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    borderRadius: 20,
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    height: '100%',
    marginLeft: 8,
    fontSize: 14,
    padding: 0,
  },
  listContent: {
    padding: 1,
    paddingBottom: 70,
  },
  gridImage: {
    width: gridWidth,
    height: gridWidth,
    margin: 1,
    borderRadius: 4,
  },
});
