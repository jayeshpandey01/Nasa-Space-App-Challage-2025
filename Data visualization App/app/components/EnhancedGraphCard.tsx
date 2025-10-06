import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { APP_CONFIG } from '../utils/constants';

const { width: screenWidth } = Dimensions.get('window');

interface EnhancedGraphCardProps {
  title: string;
  subtitle?: string;
  value: string | number;
  unit?: string;
  trend?: 'up' | 'down' | 'stable';
  trendValue?: string;
  color: string;
  icon: string;
  onPress?: () => void;
  children?: React.ReactNode;
  size?: 'small' | 'medium' | 'large';
  showProgress?: boolean;
  progressValue?: number;
}

export default function EnhancedGraphCard({
  title,
  subtitle,
  value,
  unit,
  trend,
  trendValue,
  color,
  icon,
  onPress,
  children,
  size = 'medium',
  showProgress = false,
  progressValue = 0,
}: EnhancedGraphCardProps) {
  const [pressed, setPressed] = useState(false);
  const [scaleAnim] = useState(new Animated.Value(1));

  const handlePressIn = () => {
    setPressed(true);
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    setPressed(false);
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  const getTrendIcon = () => {
    switch (trend) {
      case 'up': return 'trending-up';
      case 'down': return 'trending-down';
      case 'stable': return 'remove';
      default: return 'pulse';
    }
  };

  const getTrendColor = () => {
    switch (trend) {
      case 'up': return APP_CONFIG.colors.success;
      case 'down': return APP_CONFIG.colors.error;
      case 'stable': return APP_CONFIG.colors.warning;
      default: return APP_CONFIG.colors.text.secondary;
    }
  };

  const getCardWidth = () => {
    switch (size) {
      case 'small': return (screenWidth - APP_CONFIG.spacing.lg * 2 - APP_CONFIG.spacing.md * 2) / 3;
      case 'large': return screenWidth - APP_CONFIG.spacing.lg * 2;
      default: return (screenWidth - APP_CONFIG.spacing.lg * 2 - APP_CONFIG.spacing.md) / 2;
    }
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          width: getCardWidth(),
          transform: [{ scale: scaleAnim }],
        }
      ]}
    >
      <TouchableOpacity
        style={[
          styles.card,
          {
            borderColor: `${color}40`,
            shadowColor: color,
          }
        ]}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.9}
        disabled={!onPress}
      >
        {/* Background Gradient */}
        <View style={[styles.gradient, { backgroundColor: `${color}08` }]} />
        
        {/* Glassmorphism Effect */}
        <BlurView intensity={20} tint="dark" style={styles.blurOverlay} />
        
        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.iconContainer, { backgroundColor: color }]}>
            <Ionicons name={icon as any} size={size === 'large' ? 32 : 24} color="white" />
          </View>
          {trend && (
            <View style={[styles.trendContainer, { backgroundColor: `${getTrendColor()}20` }]}>
              <Ionicons name={getTrendIcon() as any} size={16} color={getTrendColor()} />
              {trendValue && (
                <Text style={[styles.trendText, { color: getTrendColor() }]}>
                  {trendValue}
                </Text>
              )}
            </View>
          )}
        </View>

        {/* Content */}
        <View style={styles.content}>
          <Text style={styles.title} numberOfLines={2}>{title}</Text>
          {subtitle && (
            <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
          )}
          
          <View style={styles.valueContainer}>
            <Text style={[styles.value, { color }]}>{value}</Text>
            {unit && <Text style={styles.unit}>{unit}</Text>}
          </View>

          {/* Progress Bar */}
          {showProgress && (
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <Animated.View 
                  style={[
                    styles.progressFill,
                    {
                      backgroundColor: color,
                      width: `${progressValue}%`,
                    }
                  ]}
                />
              </View>
              <Text style={styles.progressText}>{progressValue}%</Text>
            </View>
          )}

          {/* Custom Children */}
          {children}
        </View>

        {/* Interactive Indicator */}
        {onPress && (
          <View style={styles.interactiveIndicator}>
            <Ionicons name="chevron-forward" size={16} color={color} />
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: APP_CONFIG.spacing.md,
  },
  card: {
    backgroundColor: APP_CONFIG.colors.secondary,
    borderRadius: APP_CONFIG.borderRadius.xl,
    padding: APP_CONFIG.spacing.lg,
    borderWidth: 2,
    position: 'relative',
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  gradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: APP_CONFIG.borderRadius.xl,
  },
  blurOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: APP_CONFIG.borderRadius.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: APP_CONFIG.spacing.md,
    zIndex: 1,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: APP_CONFIG.borderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: APP_CONFIG.spacing.sm,
    paddingVertical: APP_CONFIG.spacing.xs,
    borderRadius: APP_CONFIG.borderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  trendText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  content: {
    zIndex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: APP_CONFIG.colors.text.primary,
    marginBottom: APP_CONFIG.spacing.xs,
    lineHeight: 20,
  },
  subtitle: {
    fontSize: 12,
    color: APP_CONFIG.colors.text.secondary,
    marginBottom: APP_CONFIG.spacing.sm,
    opacity: 0.8,
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: APP_CONFIG.spacing.sm,
  },
  value: {
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 28,
  },
  unit: {
    fontSize: 14,
    color: APP_CONFIG.colors.text.secondary,
    marginLeft: 4,
    fontWeight: '600',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: APP_CONFIG.spacing.sm,
  },
  progressBar: {
    flex: 1,
    height: 4,
    backgroundColor: APP_CONFIG.colors.overlay.dark,
    borderRadius: 2,
    marginRight: APP_CONFIG.spacing.sm,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 11,
    color: APP_CONFIG.colors.text.tertiary,
    fontWeight: '600',
    minWidth: 30,
  },
  interactiveIndicator: {
    position: 'absolute',
    top: APP_CONFIG.spacing.md,
    right: APP_CONFIG.spacing.md,
    width: 32,
    height: 32,
    borderRadius: APP_CONFIG.borderRadius.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
});