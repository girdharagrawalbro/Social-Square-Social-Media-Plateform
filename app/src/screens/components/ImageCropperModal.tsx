import React, { useState, useRef, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Dimensions,
  PanResponder,
  Animated,
  useColorScheme,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const CROP_SIZE = screenWidth - 40; // square crop box

interface ImageCropperModalProps {
  visible: boolean;
  mediaUri: string | null;
  mediaType: 'image' | 'video';
  onCropComplete: (croppedUri: string, cropData?: any) => void;
  onCancel: () => void;
}

export default function ImageCropperModal({
  visible,
  mediaUri,
  mediaType,
  onCropComplete,
  onCancel,
}: ImageCropperModalProps) {
  const isDark = useColorScheme() === 'dark';
  const [aspectRatio, setAspectRatio] = useState<'1:1' | '4:5' | '16:9'>('1:1');

  // Animation values for scale and translation
  const scale = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  const lastScale = useRef(1);
  const lastTranslateX = useRef(0);
  const lastTranslateY = useRef(0);

  const initialDistance = useRef(0);

  // Reset values when mediaUri changes
  useEffect(() => {
    scale.setValue(1);
    translateX.setValue(0);
    translateY.setValue(0);
    lastScale.current = 1;
    lastTranslateX.current = 0;
    lastTranslateY.current = 0;
  }, [mediaUri]);

  const getDistance = (touches: any[]) => {
    const [t1, t2] = touches;
    if (!t1 || !t2) return 0;
    const dx = t1.pageX - t2.pageX;
    const dy = t1.pageY - t2.pageY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const touches = evt.nativeEvent.touches;
        if (touches.length === 2) {
          initialDistance.current = getDistance(touches);
        }
      },
      onPanResponderMove: (evt, gestureState) => {
        const touches = evt.nativeEvent.touches;
        if (touches.length === 1) {
          // Pan
          const dx = gestureState.dx + lastTranslateX.current;
          const dy = gestureState.dy + lastTranslateY.current;
          translateX.setValue(dx);
          translateY.setValue(dy);
        } else if (touches.length === 2 && initialDistance.current > 0) {
          // Pinch Zoom
          const currentDistance = getDistance(touches);
          const newScale = (currentDistance / initialDistance.current) * lastScale.current;
          const clampedScale = Math.max(1, Math.min(4, newScale));
          scale.setValue(clampedScale);
        }
      },
      onPanResponderRelease: () => {
        lastScale.current = (scale as any)._value ?? 1;
        lastTranslateX.current = (translateX as any)._value ?? 0;
        lastTranslateY.current = (translateY as any)._value ?? 0;
        initialDistance.current = 0;
      },
    })
  ).current;

  const handleSave = () => {
    if (!mediaUri) return;
    // Pass crop metadata back to parent screen
    const cropData = {
      scale: lastScale.current,
      x: lastTranslateX.current,
      y: lastTranslateY.current,
      aspectRatio,
    };
    onCropComplete(mediaUri, cropData);
  };

  const getCropBoxHeight = () => {
    if (aspectRatio === '1:1') return CROP_SIZE;
    if (aspectRatio === '4:5') return CROP_SIZE * 1.25;
    return CROP_SIZE * (9 / 16);
  };

  if (!mediaUri) return null;

  return (
    <Modal visible={visible} transparent={true} animationType="slide">
      <View style={[styles.container, { backgroundColor: isDark ? '#09090f' : '#ffffff' }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onCancel} style={styles.headerBtn}>
            <MaterialCommunityIcons name="close" size={24} color={isDark ? '#fff' : '#000'} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: isDark ? '#fff' : '#000' }]}>
            Crop {mediaType === 'video' ? 'Video' : 'Image'}
          </Text>
          <TouchableOpacity onPress={handleSave} style={styles.headerBtn}>
            <MaterialCommunityIcons name="check" size={24} color="#808bf5" />
          </TouchableOpacity>
        </View>

        {/* Viewport/Canvas Area */}
        <View style={styles.viewport}>
          <View
            style={[
              styles.cropBox,
              {
                height: getCropBoxHeight(),
                borderColor: '#808bf5',
              },
            ]}
          >
            <View style={styles.gestureContainer} {...panResponder.panHandlers}>
              <Animated.Image
                source={{ uri: mediaUri }}
                style={[
                  styles.image,
                  {
                    transform: [{ scale }, { translateX }, { translateY }],
                  },
                ]}
                resizeMode="contain"
              />
            </View>

            {/* Grid Lines */}
            <View style={styles.gridOverlay} pointerEvents="none">
              <View style={styles.gridRow} />
              <View style={styles.gridRow} />
              <View style={styles.gridCol} />
              <View style={styles.gridCol} />
            </View>
          </View>
        </View>

        {/* Aspect Ratio Selector Toolbar */}
        <View style={styles.toolbar}>
          {(['1:1', '4:5', '16:9'] as const).map((ratio) => {
            const isSelected = aspectRatio === ratio;
            return (
              <TouchableOpacity
                key={ratio}
                onPress={() => setAspectRatio(ratio)}
                style={[
                  styles.ratioBtn,
                  isSelected && { backgroundColor: 'rgba(128, 139, 245, 0.15)', borderColor: '#808bf5' },
                ]}
              >
                <Text style={[styles.ratioText, { color: isSelected ? '#808bf5' : (isDark ? '#94a3b8' : '#64748b') }]}>
                  {ratio}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2e2e4e',
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  headerBtn: {
    padding: 8,
  },
  viewport: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
  },
  cropBox: {
    width: CROP_SIZE,
    borderWidth: 2,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#111',
  },
  gestureContainer: {
    width: '100%',
    height: '100%',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  gridOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-evenly',
    flexDirection: 'row',
  },
  gridRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    top: '33.3%',
  },
  gridCol: {
    width: 1,
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  toolbar: {
    height: 80,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#2e2e4e',
    paddingBottom: 16,
  },
  ratioBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  ratioText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
});
