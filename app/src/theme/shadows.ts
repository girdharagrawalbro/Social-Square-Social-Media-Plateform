import { Platform } from 'react-native';

const make = (elevation: number, opacity: number, radius: number, offsetY: number) =>
  Platform.select({
    android: { elevation },
    default: {
      shadowColor: '#000000',
      shadowOpacity: opacity,
      shadowRadius: radius,
      shadowOffset: { width: 0, height: offsetY },
    },
  });

export const shadows = {
  card: make(2, 0.06, 8, 2),
  elevated: make(6, 0.1, 16, 4),
  overlay: make(10, 0.16, 24, 6),
};
