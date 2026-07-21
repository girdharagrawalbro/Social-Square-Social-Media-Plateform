import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  TouchableOpacity,
  useColorScheme,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

const { width } = Dimensions.get('window');

type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastConfig {
  id?: string;
  type?: ToastType;
  title?: string;
  message: string;
  duration?: number;
  icon?: string;
}

type ToastListener = (toast: ToastConfig) => void;

let listeners: ToastListener[] = [];

export const toast = {
  show: (config: ToastConfig | string) => {
    const toastConfig: ToastConfig =
      typeof config === 'string' ? { message: config, type: 'info' } : config;
    listeners.forEach((l) => l(toastConfig));
  },
  success: (message: string, title = 'Success', duration = 3000) => {
    toast.show({ message, title, type: 'success', duration, icon: 'check-circle-outline' });
  },
  error: (message: string, title = 'Error', duration = 4000) => {
    toast.show({ message, title, type: 'error', duration, icon: 'alert-circle-outline' });
  },
  info: (message: string, title = 'Info', duration = 3000) => {
    toast.show({ message, title, type: 'info', duration, icon: 'information-outline' });
  },
  warning: (message: string, title = 'Warning', duration = 3500) => {
    toast.show({ message, title, type: 'warning', duration, icon: 'alert-outline' });
  },
};

export const CustomToastContainer: React.FC = () => {
  const isDark = useColorScheme() === 'dark';
  const [currentToast, setCurrentToast] = useState<ToastConfig | null>(null);
  const [slideAnim] = useState(new Animated.Value(-120));
  const [opacityAnim] = useState(new Animated.Value(0));

  const hideToast = useCallback(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -120,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setCurrentToast(null);
    });
  }, [slideAnim, opacityAnim]);

  useEffect(() => {
    const handleNewToast = (config: ToastConfig) => {
      setCurrentToast(config);
      slideAnim.setValue(-120);
      opacityAnim.setValue(0);

      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          friction: 7,
          tension: 70,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      const timer = setTimeout(() => {
        hideToast();
      }, config.duration || 3000);

      return () => clearTimeout(timer);
    };

    listeners.push(handleNewToast);
    return () => {
      listeners = listeners.filter((l) => l !== handleNewToast);
    };
  }, [hideToast, slideAnim, opacityAnim]);

  if (!currentToast) return null;

  const getTheme = () => {
    switch (currentToast.type) {
      case 'success':
        return {
          accent: '#10b981',
          bg: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5',
          border: isDark ? 'rgba(16, 185, 129, 0.3)' : '#a7f3d0',
          icon: currentToast.icon || 'check-circle-outline',
        };
      case 'error':
        return {
          accent: '#ef4444',
          bg: isDark ? 'rgba(239, 68, 68, 0.15)' : '#fef2f2',
          border: isDark ? 'rgba(239, 68, 68, 0.3)' : '#fecaca',
          icon: currentToast.icon || 'alert-circle-outline',
        };
      case 'warning':
        return {
          accent: '#f59e0b',
          bg: isDark ? 'rgba(245, 158, 11, 0.15)' : '#fffbeb',
          border: isDark ? 'rgba(245, 158, 11, 0.3)' : '#fde68a',
          icon: currentToast.icon || 'alert-outline',
        };
      default:
        return {
          accent: '#808bf5',
          bg: isDark ? 'rgba(128, 139, 245, 0.15)' : '#f0f2fe',
          border: isDark ? 'rgba(128, 139, 245, 0.3)' : '#c7d2fe',
          icon: currentToast.icon || 'information-outline',
        };
    }
  };

  const theme = getTheme();
  const textColor = isDark ? '#f8fafc' : '#0f172a';
  const containerBg = isDark ? '#111827' : '#ffffff';

  return (
    <Animated.View
      style={[
        styles.toastWrapper,
        {
          transform: [{ translateY: slideAnim }],
          opacity: opacityAnim,
        },
      ]}
      pointerEvents="box-none"
    >
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={hideToast}
        style={[
          styles.toastContainer,
          {
            backgroundColor: containerBg,
            borderColor: theme.border,
          },
        ]}
      >
        <View style={[styles.iconBadge, { backgroundColor: theme.bg }]}>
          <MaterialCommunityIcons name={theme.icon} size={22} color={theme.accent} />
        </View>

        <View style={styles.textContainer}>
          {currentToast.title ? (
            <Text style={[styles.title, { color: textColor }]}>{currentToast.title}</Text>
          ) : null}
          <Text style={[styles.message, { color: isDark ? '#94a3b8' : '#64748b' }]}>
            {currentToast.message}
          </Text>
        </View>

        <TouchableOpacity onPress={hideToast} style={styles.closeBtn}>
          <MaterialCommunityIcons name="close" size={18} color={isDark ? '#94a3b8' : '#94a3b8'} />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  toastWrapper: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    zIndex: 99999,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  toastContainer: {
    width: width - 32,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  iconBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
    paddingRight: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  message: {
    fontSize: 12.5,
    fontWeight: '500',
    lineHeight: 16,
  },
  closeBtn: {
    padding: 4,
  },
});

export default toast;
