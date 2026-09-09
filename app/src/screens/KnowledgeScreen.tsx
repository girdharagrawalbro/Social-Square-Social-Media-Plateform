import { brand } from '../theme/colors';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { api } from '../lib/api';
import { EmptyState, ErrorState } from './components/EmptyState';
import type { AppScreenProps } from '../navigation/types';
import { useTheme } from '../theme';

export default function KnowledgeScreen({ navigation }: AppScreenProps<'Knowledge'>) {
  const { colors, isDark } = useTheme();
  const [wikis, setWikis] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const fetchWikis = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const res = await api.get('/api/knowledge/wiki');
      if (res.data?.success) {
        setWikis(res.data.wikis || []);
      }
      setLoadError(false);
    } catch (err) {
      console.warn('Failed to fetch wikis:', err);
      setLoadError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchWikis();
  }, []);

  const bg = colors.background;
  const cardBg = colors.surface;
  const border = colors.border;
  const textColor = colors.text.primary;
  const subText = colors.text.secondary;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
      <View style={[styles.header, { backgroundColor: bg, borderBottomColor: border }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <MaterialCommunityIcons name="chevron-left" size={28} color={textColor} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: textColor }]}>Knowledge Center</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => fetchWikis(true)} colors={[brand.primary]} />
        }
      >
        <Text style={[styles.sectionTitle, { color: textColor }]}>Wiki & Help Articles</Text>

        {loading && wikis.length === 0 ? (
          <ActivityIndicator color={brand.primary} style={{ marginTop: 40 }} />
        ) : loadError && wikis.length === 0 ? (
          <ErrorState
            title="Couldn't load articles"
            subtitle="Check your connection and try again."
            onAction={() => fetchWikis()}
          />
        ) : wikis.length === 0 ? (
          <EmptyState icon="book-open-outline" title="No articles available." />
        ) : (
          wikis.map((wiki) => (
            <TouchableOpacity
              key={wiki.slug}
              style={[styles.categoryCard, { backgroundColor: cardBg, borderColor: border }]}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('WikiDetail', { slug: wiki.slug })}
            >
              <View style={styles.cardInfo}>
                <View style={styles.iconContainer}>
                  <MaterialCommunityIcons name="book-open-page-variant" size={24} color={brand.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.categoryTitle, { color: textColor }]}>{wiki.topic}</Text>
                  <Text style={[styles.categoryCount, { color: subText }]} numberOfLines={1}>
                    {wiki.description || 'No description provided.'}
                  </Text>
                  <Text style={[styles.metaText, { color: subText }]}>
                    👁️ {wiki.viewCount || 0} views • ✍️ {wiki.contributorCount || 0} contributors
                  </Text>
                </View>
              </View>

              <MaterialCommunityIcons name="chevron-right" size={24} color={subText} />
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    paddingHorizontal: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 16,
    marginTop: 8,
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    elevation: 1,
  },
  cardInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(128, 139, 245, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  categoryTitle: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  categoryCount: {
    fontSize: 11,
    marginTop: 4,
  },
  metaText: {
    fontSize: 10,
    marginTop: 4,
  },
  emptyView: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 13,
    marginTop: 12,
  },
});
