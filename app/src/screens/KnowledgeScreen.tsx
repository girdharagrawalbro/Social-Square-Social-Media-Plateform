import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  useColorScheme,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import BottomNav from './components/BottomNav';

// Mock Knowledge items
const categories = [
  { id: '1', title: 'Getting Started', count: '12 articles', icon: 'rocket-launch-outline' },
  { id: '2', title: 'Security & Privacy', count: '8 articles', icon: 'shield-lock-outline' },
  { id: '3', title: 'Community Guidelines', count: '6 articles', icon: 'book-open-outline' },
  { id: '4', title: 'API & Developers', count: '15 articles', icon: 'code-tags' },
];

export default function KnowledgeScreen({ navigation }: any) {
  const isDark = useColorScheme() === 'dark';

  const bg = isDark ? '#0a0a0a' : '#f3f4f6';
  const cardBg = isDark ? '#121212' : '#ffffff';
  const border = isDark ? '#1f2937' : '#e5e7eb';
  const textColor = isDark ? '#ffffff' : '#111827';
  const subText = isDark ? '#9ca3af' : '#6b7280';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
      <View style={[styles.header, { backgroundColor: cardBg, borderBottomColor: border }]}>
        <Text style={[styles.headerTitle, { color: textColor }]}>Knowledge Center</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={[styles.sectionTitle, { color: textColor }]}>Help Center Categories</Text>

        {categories.map((category) => (
          <TouchableOpacity
            key={category.id}
            style={[styles.categoryCard, { backgroundColor: cardBg, borderColor: border }]}
            activeOpacity={0.7}
          >
            <View style={styles.cardInfo}>
              <MaterialCommunityIcons name={category.icon} size={26} color="#808bf5" style={styles.icon} />
              <View>
                <Text style={[styles.categoryTitle, { color: textColor }]}>{category.title}</Text>
                <Text style={[styles.categoryCount, { color: subText }]}>{category.count}</Text>
              </View>
            </View>

            <MaterialCommunityIcons name="chevron-right" size={24} color={subText} />
          </TouchableOpacity>
        ))}
      </ScrollView>

      <BottomNav currentTab="knowledge" navigation={navigation} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 80,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 16,
    marginTop: 8,
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    elevation: 1,
  },
  cardInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: 16,
  },
  categoryTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  categoryCount: {
    fontSize: 12,
  },
});
