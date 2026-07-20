import React, { useRef } from 'react';
import { View, StyleSheet, PanResponder, Animated, Dimensions } from 'react-native';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface ZoomableImageProps {
  uri: string;
}

export default function ZoomableImage({ uri }: ZoomableImageProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  const lastScale = useRef(1);
  const lastTranslateX = useRef(0);
  const lastTranslateY = useRef(0);

  const initialDistance = useRef(0);

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
          // Drag/Pan gesture
          const dx = gestureState.dx + lastTranslateX.current;
          const dy = gestureState.dy + lastTranslateY.current;
          translateX.setValue(dx);
          translateY.setValue(dy);
        } else if (touches.length === 2 && initialDistance.current > 0) {
          // Pinch zoom gesture
          const currentDistance = getDistance(touches);
          const newScale = (currentDistance / initialDistance.current) * lastScale.current;
          // Clamp scale between 1 and 5
          const clampedScale = Math.max(1, Math.min(5, newScale));
          scale.setValue(clampedScale);
        }
      },
      onPanResponderRelease: () => {
        // Save current values
        lastScale.current = (scale as any)._value ?? 1;
        lastTranslateX.current = (translateX as any)._value ?? 0;
        lastTranslateY.current = (translateY as any)._value ?? 0;
        initialDistance.current = 0;

        // Reset if scaled down too much
        if (lastScale.current <= 1.1) {
          Animated.parallel([
            Animated.spring(scale, { toValue: 1, useNativeDriver: true }),
            Animated.spring(translateX, { toValue: 0, useNativeDriver: true }),
            Animated.spring(translateY, { toValue: 0, useNativeDriver: true }),
          ]).start();
          lastScale.current = 1;
          lastTranslateX.current = 0;
          lastTranslateY.current = 0;
        }
      },
    })
  ).current;

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      <Animated.Image
        source={{ uri }}
        style={[
          styles.image,
          {
            transform: [{ scale }, { translateX }, { translateY }],
          },
        ]}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: screenWidth,
    height: screenHeight - 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
