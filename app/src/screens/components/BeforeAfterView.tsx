import React, { useState, useRef } from 'react';
import { View, Text, Image, StyleSheet, PanResponder, Dimensions, ScrollView } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

const { width: screenWidth } = Dimensions.get('window');

interface BeforeAfterViewProps {
  beforeAfter: any;
  isDark: boolean;
}

export default function BeforeAfterView({ beforeAfter, isDark }: BeforeAfterViewProps) {
  const [sliderPos, setSliderPos] = useState(50); // percentage 0-100
  const containerWidth = screenWidth - 24; // margin padding adjusted

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (evt, gestureState) => {
        // Account for margin of post card
        const x = gestureState.moveX - 12;
        const percentage = Math.max(0, Math.min(100, (x / containerWidth) * 100));
        setSliderPos(percentage);
      },
    })
  ).current;

  const { type, beforeUrl, afterUrl, beforeLabel = 'Before', afterLabel = 'After', beforeText, afterText } = beforeAfter;

  if (type === 'image') {
    return (
      <View style={[styles.imageContainer, { borderColor: isDark ? '#2e2e4e' : '#e2e8f0' }]} {...panResponder.panHandlers}>
        {/* Before Image (Left/Full underneath) */}
        <Image source={{ uri: beforeUrl }} style={styles.fullImage} resizeMode="cover" />

        {/* After Image (Right/Clipped on top) */}
        <View style={[styles.clippedContainer, { width: `${100 - sliderPos}%`, left: `${sliderPos}%` }]}>
          <Image
            source={{ uri: afterUrl }}
            style={[styles.clippedImage, { width: containerWidth, left: -containerWidth * (sliderPos / 100) }]}
            resizeMode="cover"
          />
        </View>

        {/* Labels */}
        <View style={styles.beforeLabel}>
          <Text style={styles.labelText}>{beforeLabel}</Text>
        </View>
        <View style={styles.afterLabel}>
          <Text style={styles.labelText}>{afterLabel}</Text>
        </View>

        {/* Slider bar */}
        <View style={[styles.sliderLine, { left: `${sliderPos}%` }]}>
          <View style={styles.sliderKnob}>
            <MaterialCommunityIcons name="arrow-left-right" size={16} color="#0f172a" />
          </View>
        </View>
      </View>
    );
  }

  const textColor = isDark ? '#f1f5f9' : '#0f172a';
  const paneBg = isDark ? '#111122' : '#f8fafc';
  const border = isDark ? '#2e2e4e' : '#e2e8f0';

  if (type === 'code') {
    return (
      <View style={[styles.codeContainer, { backgroundColor: isDark ? '#0f0f1c' : '#f1f5f9', borderColor: border }]}>
        <View style={[styles.terminalHeader, { backgroundColor: isDark ? '#080812' : '#e2e8f0' }]}>
          <View style={styles.terminalDots}>
            <View style={[styles.dot, { backgroundColor: '#ff5f56' }]} />
            <View style={[styles.dot, { backgroundColor: '#ffbd2e' }]} />
            <View style={[styles.dot, { backgroundColor: '#27c93f' }]} />
          </View>
          <Text style={styles.terminalTitle}>Code Comparison</Text>
        </View>

        <View style={styles.paneRow}>
          {/* Before */}
          <View style={[styles.pane, { backgroundColor: paneBg, borderRightWidth: 1, borderRightColor: border }]}>
            <Text style={[styles.paneLabel, { color: '#ef4444' }]}>{beforeLabel}</Text>
            <ScrollView horizontal style={styles.codeScroll}>
              <Text style={[styles.codeText, { color: textColor }]}>{beforeText || '// Empty'}</Text>
            </ScrollView>
          </View>

          {/* After */}
          <View style={[styles.pane, { backgroundColor: paneBg }]}>
            <Text style={[styles.paneLabel, { color: '#10b981' }]}>{afterLabel}</Text>
            <ScrollView horizontal style={styles.codeScroll}>
              <Text style={[styles.codeText, { color: textColor }]}>{afterText || '// Empty'}</Text>
            </ScrollView>
          </View>
        </View>
      </View>
    );
  }

  if (type === 'text') {
    return (
      <View style={[styles.textContainer, { borderColor: border }]}>
        <View style={[styles.terminalHeader, { backgroundColor: isDark ? '#080812' : '#e2e8f0' }]}>
          <Text style={styles.terminalTitle}>Text Revision</Text>
        </View>
        <View style={styles.paneRow}>
          {/* Before */}
          <View style={[styles.pane, { backgroundColor: paneBg, borderRightWidth: 1, borderRightColor: border }]}>
            <Text style={[styles.paneLabel, { color: '#ef4444' }]}>{beforeLabel}</Text>
            <Text style={[styles.bodyText, { color: textColor }]}>{beforeText || 'No text content'}</Text>
          </View>

          {/* After */}
          <View style={[styles.pane, { backgroundColor: paneBg }]}>
            <Text style={[styles.paneLabel, { color: '#10b981' }]}>{afterLabel}</Text>
            <Text style={[styles.bodyText, { color: textColor }]}>{afterText || 'No text content'}</Text>
          </View>
        </View>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  imageContainer: {
    width: '100%',
    aspectRatio: 4 / 3,
    position: 'relative',
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  fullImage: {
    width: '100%',
    height: '100%',
  },
  clippedContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    overflow: 'hidden',
  },
  clippedImage: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    height: '100%',
  },
  beforeLabel: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  afterLabel: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  labelText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  sliderLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: '#ffffff',
    transform: [{ translateX: -1 }],
  },
  sliderKnob: {
    position: 'absolute',
    top: '50%',
    left: -18,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -18,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  // Code comparison
  codeContainer: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    width: '100%',
  },
  terminalHeader: {
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  terminalDots: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  terminalTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: 'bold',
    color: '#808bf5',
    textTransform: 'uppercase',
  },
  paneRow: {
    flexDirection: 'row',
    minHeight: 150,
  },
  pane: {
    flex: 1,
    padding: 10,
  },
  paneLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  codeScroll: {
    flex: 1,
  },
  codeText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontSize: 11,
  },
  // Text comparison
  textContainer: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    width: '100%',
  },
  bodyText: {
    fontSize: 12,
    lineHeight: 18,
  },
});
import { Platform } from 'react-native';
