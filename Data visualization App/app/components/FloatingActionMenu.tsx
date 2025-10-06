import React, { useState, useRef } from 'react';
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

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface FloatingAction {
  id: string;
  icon: string;
  label: string;
  color: string;
  onPress: () => void;
}

interface FloatingActionMenuProps {
  actions: FloatingAction[];
  mainIcon?: string;
  mainColor?: string;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
}

export default function FloatingActionMenu({
  actions,
  mainIcon = 'add',
  mainColor = APP_CONFIG.colors.info,
  position = 'bottom-right',
}: FloatingActionMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [animations] = useState(
    actions.map(() => new Animated.Value(0))
  );
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const toggleMenu = () => {
    const toValue = isOpen ? 0 : 1;
    setIsOpen(!isOpen);

    // Rotate main button
    Animated.spring(rotateAnim, {
      toValue,
      useNativeDriver: true,
    }).start();

    // Animate action buttons
    const animationPromises = animations.map((anim, index) =>
      Animated.spring(anim, {
        toValue,
        delay: index * 50,
        useNativeDriver: true,
      })
    );

    Animated.parallel(animationPromises).start();
  };

  const handleActionPress = (action: FloatingAction) => {
    // Scale animation for feedback
    Animated.sequence([
      Animated.spring(scaleAnim, {
        toValue: 0.9,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
      }),
    ]).start();

    action.onPress();
    toggleMenu();
  };

  const getPositionStyle = () => {
    const baseStyle = {
      position: 'absolute' as const,
      zIndex: 1000,
    };

    switch (position) {
      case 'bottom-right':
        return { ...baseStyle, bottom: 30, right: 20 };
      case 'bottom-left':
        return { ...baseStyle, bottom: 30, left: 20 };
      case 'top-right':
        return { ...baseStyle, top: 100, right: 20 };
      case 'top-left':
        return { ...baseStyle, top: 100, left: 20 };
      default:
        return { ...baseStyle, bottom: 30, right: 20 };
    }
  };

  const getActionPosition = (index: number) => {
    const isBottom = position.includes('bottom');
    const isRight = position.includes('right');
    
    const baseOffset = 70;
    const spacing = 60;
    
    if (isBottom) {
      return {
        bottom: baseOffset + (index * spacing),
        [isRight ? 'right' : 'left']: 0,
      };
    } else {
      return {
        top: baseOffset + (index * spacing),
        [isRight ? 'right' : 'left']: 0,
      };
    }
  };

  const rotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg'],
  });

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={toggleMenu}
        >
          <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
        </TouchableOpacity>
      )}

      {/* Action Buttons */}
      <View style={[styles.container, getPositionStyle()]}>
        {actions.map((action, index) => {
          const animatedStyle = {
            transform: [
              {
                translateY: animations[index].interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -(index + 1) * 60],
                }),
              },
              {
                scale: animations[index].interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: [0, 0.8, 1],
                }),
              },
            ],
            opacity: animations[index],
          };

          return (
            <Animated.View
              key={action.id}
              style={[
                styles.actionButton,
                animatedStyle,
                { backgroundColor: action.color },
              ]}
            >
              <TouchableOpacity
                style={styles.actionTouchable}
                onPress={() => handleActionPress(action)}
                activeOpacity={0.8}
              >
                <Ionicons name={action.icon as any} size={24} color="white" />
              </TouchableOpacity>
              
              {/* Action Label */}
              {isOpen && (
                <Animated.View
                  style={[
                    styles.labelContainer,
                    position.includes('right') ? styles.labelLeft : styles.labelRight,
                    { opacity: animations[index] },
                  ]}
                >
                  <BlurView intensity={80} tint="dark" style={styles.labelBlur}>
                    <Text style={styles.labelText}>{action.label}</Text>
                  </BlurView>
                </Animated.View>
              )}
            </Animated.View>
          );
        })}

        {/* Main Button */}
        <Animated.View
          style={[
            styles.mainButton,
            {
              backgroundColor: mainColor,
              transform: [
                { rotate: rotation },
                { scale: scaleAnim },
              ],
            },
          ]}
        >
          <TouchableOpacity
            style={styles.mainTouchable}
            onPress={toggleMenu}
            activeOpacity={0.8}
          >
            <Ionicons name={mainIcon as any} size={28} color="white" />
          </TouchableOpacity>
        </Animated.View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
  },
  container: {
    alignItems: 'center',
  },
  mainButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  mainTouchable: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 28,
  },
  actionButton: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  actionTouchable: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
  },
  labelContainer: {
    position: 'absolute',
    top: '50%',
    marginTop: -16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: APP_CONFIG.borderRadius.lg,
    overflow: 'hidden',
  },
  labelLeft: {
    right: 60,
  },
  labelRight: {
    left: 60,
  },
  labelBlur: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: APP_CONFIG.borderRadius.lg,
  },
  labelText: {
    fontSize: 12,
    fontWeight: '600',
    color: APP_CONFIG.colors.text.primary,
    textAlign: 'center',
  },
});