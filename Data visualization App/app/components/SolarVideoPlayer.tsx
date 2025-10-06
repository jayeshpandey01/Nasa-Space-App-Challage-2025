import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { BlurView } from 'expo-blur';
import { APP_CONFIG } from '../utils/constants';

const { width: screenWidth } = Dimensions.get('window');

interface SolarVideoPlayerProps {
  videoSource: any;
  title?: string;
  subtitle?: string;
  onPlaybackStatusUpdate?: (status: AVPlaybackStatus) => void;
}

export default function SolarVideoPlayer({
  videoSource,
  title = "Solar Observation Video",
  subtitle = "24-hour time-lapse",
  onPlaybackStatusUpdate: onPlaybackStatusUpdateProp,
}: SolarVideoPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [error, setError] = useState<string | null>(null);

  const video = useRef<Video>(null);
  const controlsTimeout = useRef<NodeJS.Timeout | null>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Auto-hide controls after 3 seconds
    if (showControls && isPlaying) {
      controlsTimeout.current = setTimeout(() => {
        hideControls();
      }, 3000);
    }

    return () => {
      if (controlsTimeout.current) {
        clearTimeout(controlsTimeout.current);
      }
    };
  }, [showControls, isPlaying]);

  const hideControls = () => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setShowControls(false);
    });
  };

  const showControlsTemporary = () => {
    setShowControls(true);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const handlePlayPause = async () => {
    try {
      if (video.current) {
        if (isPlaying) {
          await video.current.pauseAsync();
        } else {
          await video.current.playAsync();
        }
        setIsPlaying(!isPlaying);
      }
    } catch (error) {
      console.error('Error controlling video playback:', error);
      setError('Failed to control video playback');
    }
  };

  const handleSeek = async (seekPosition: number) => {
    try {
      if (video.current && duration > 0) {
        const positionMillis = (seekPosition / 100) * duration;
        await video.current.setPositionAsync(positionMillis);
      }
    } catch (error) {
      console.error('Error seeking video:', error);
    }
  };

  const handleMute = async () => {
    try {
      if (video.current) {
        await video.current.setIsMutedAsync(!isMuted);
        setIsMuted(!isMuted);
      }
    } catch (error) {
      console.error('Error muting video:', error);
    }
  };

  const handlePlaybackRateChange = async () => {
    try {
      if (video.current) {
        const rates = [0.5, 1.0, 1.5, 2.0];
        const currentIndex = rates.indexOf(playbackRate);
        const nextRate = rates[(currentIndex + 1) % rates.length];

        await video.current.setRateAsync(nextRate, true);
        setPlaybackRate(nextRate);
      }
    } catch (error) {
      console.error('Error changing playback rate:', error);
    }
  };

  const handlePlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      setIsLoading(false);
      setDuration(status.durationMillis || 0);
      setPosition(status.positionMillis || 0);
      setIsPlaying(status.isPlaying);

      if (status.didJustFinish) {
        setIsPlaying(false);
        showControlsTemporary();
      }
    } else if (status.error) {
      setError(`Video error: ${status.error}`);
      setIsLoading(false);
    }

    onPlaybackStatusUpdateProp?.(status);
  };

  const formatTime = (milliseconds: number) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const progressPercentage = duration > 0 ? (position / duration) * 100 : 0;

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={48} color={APP_CONFIG.colors.error} />
        <Text style={styles.errorTitle}>Video Error</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => {
            setError(null);
            setIsLoading(true);
          }}
        >
          <Ionicons name="refresh" size={20} color="white" />
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Video Header */}
      <View style={styles.videoHeader}>
        <View style={styles.videoInfo}>
          <Ionicons name="videocam" size={20} color={APP_CONFIG.colors.info} />
          <View style={styles.videoTitleContainer}>
            <Text style={styles.videoTitle}>{title}</Text>
            <Text style={styles.videoSubtitle}>{subtitle}</Text>
          </View>
        </View>
        <View style={styles.videoStats}>
          <View style={styles.statBadge}>
            <Ionicons name="time" size={14} color={APP_CONFIG.colors.text.secondary} />
            <Text style={styles.statText}>{formatTime(duration)}</Text>
          </View>
          <View style={styles.statBadge}>
            <Ionicons name="speedometer" size={14} color={APP_CONFIG.colors.text.secondary} />
            <Text style={styles.statText}>{playbackRate}x</Text>
          </View>
        </View>
      </View>

      {/* Video Player */}
      <TouchableOpacity
        style={styles.videoContainer}
        activeOpacity={1}
        onPress={showControlsTemporary}
      >
        <Video
          ref={video}
          style={styles.video}
          source={videoSource}
          useNativeControls={false}
          resizeMode={ResizeMode.CONTAIN}
          isLooping={false}
          onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
          shouldPlay={false}
        />

        {/* Loading Overlay */}
        {isLoading && (
          <View style={styles.loadingOverlay}>
            <Animated.View style={styles.loadingSpinner}>
              <Ionicons name="hourglass" size={32} color={APP_CONFIG.colors.info} />
            </Animated.View>
            <Text style={styles.loadingText}>Loading solar video...</Text>
          </View>
        )}

        {/* Controls Overlay */}
        {showControls && (
          <Animated.View
            style={[styles.controlsOverlay, { opacity: fadeAnim }]}
            pointerEvents={showControls ? 'auto' : 'none'}
          >
            <BlurView intensity={60} tint="dark" style={styles.controlsBlur}>
              {/* Top Controls */}
              <View style={styles.topControls}>
                <TouchableOpacity
                  style={styles.controlButton}
                  onPress={handleMute}
                >
                  <Ionicons
                    name={isMuted ? "volume-mute" : "volume-high"}
                    size={20}
                    color="white"
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.controlButton}
                  onPress={handlePlaybackRateChange}
                >
                  <Text style={styles.rateText}>{playbackRate}x</Text>
                </TouchableOpacity>
              </View>

              {/* Center Play Button */}
              <View style={styles.centerControls}>
                <TouchableOpacity
                  style={styles.playButton}
                  onPress={handlePlayPause}
                >
                  <Ionicons
                    name={isPlaying ? "pause" : "play"}
                    size={32}
                    color="white"
                  />
                </TouchableOpacity>
              </View>

              {/* Bottom Controls */}
              <View style={styles.bottomControls}>
                <Text style={styles.timeText}>{formatTime(position)}</Text>

                <View style={styles.progressContainer}>
                  <View style={styles.progressBar}>
                    <View
                      style={[
                        styles.progressFill,
                        { width: `${progressPercentage}%` }
                      ]}
                    />
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.progressThumb,
                      { left: `${Math.max(0, Math.min(95, progressPercentage))}%` }
                    ]}
                    onPress={(event) => {
                      const { locationX } = event.nativeEvent;
                      const containerWidth = screenWidth - APP_CONFIG.spacing.lg * 4;
                      const percentage = (locationX / containerWidth) * 100;
                      handleSeek(percentage);
                    }}
                  />
                </View>

                <Text style={styles.timeText}>{formatTime(duration)}</Text>
              </View>
            </BlurView>
          </Animated.View>
        )}
      </TouchableOpacity>

      {/* Video Description */}
      <View style={styles.videoDescription}>
        <Text style={styles.descriptionText}>
          This time-lapse video shows 24 hours of solar observations from the SUIT instrument
          aboard Aditya-L1. Each frame represents a snapshot of the Sun's chromosphere at
          280nm wavelength, revealing solar dynamics and activity patterns.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: APP_CONFIG.colors.secondary,
    borderRadius: APP_CONFIG.borderRadius.xl,
    padding: APP_CONFIG.spacing.lg,
    marginBottom: APP_CONFIG.spacing.lg,
    borderWidth: 1,
    borderColor: APP_CONFIG.colors.overlay.dark,
    ...APP_CONFIG.shadows.medium,
  },
  videoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: APP_CONFIG.spacing.md,
  },
  videoInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  videoTitleContainer: {
    marginLeft: APP_CONFIG.spacing.sm,
    flex: 1,
  },
  videoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: APP_CONFIG.colors.text.primary,
  },
  videoSubtitle: {
    fontSize: 12,
    color: APP_CONFIG.colors.text.secondary,
    marginTop: 2,
  },
  videoStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: APP_CONFIG.colors.overlay.light,
    paddingHorizontal: APP_CONFIG.spacing.xs,
    paddingVertical: 4,
    borderRadius: APP_CONFIG.borderRadius.sm,
    marginLeft: APP_CONFIG.spacing.xs,
  },
  statText: {
    fontSize: 11,
    color: APP_CONFIG.colors.text.secondary,
    marginLeft: 4,
    fontWeight: '600',
  },
  videoContainer: {
    position: 'relative',
    height: 250,
    backgroundColor: '#000',
    borderRadius: APP_CONFIG.borderRadius.lg,
    overflow: 'hidden',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingSpinner: {
    marginBottom: APP_CONFIG.spacing.sm,
  },
  loadingText: {
    fontSize: 14,
    color: APP_CONFIG.colors.text.primary,
    fontWeight: '600',
  },
  controlsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  controlsBlur: {
    flex: 1,
    justifyContent: 'space-between',
    padding: APP_CONFIG.spacing.md,
  },
  topControls: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  centerControls: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  bottomControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  controlButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: APP_CONFIG.spacing.sm,
  },
  playButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  rateText: {
    fontSize: 12,
    color: 'white',
    fontWeight: '700',
  },
  timeText: {
    fontSize: 12,
    color: 'white',
    fontWeight: '600',
    minWidth: 40,
  },
  progressContainer: {
    flex: 1,
    marginHorizontal: APP_CONFIG.spacing.sm,
    position: 'relative',
  },
  progressBar: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
  },
  progressFill: {
    height: '100%',
    backgroundColor: APP_CONFIG.colors.info,
    borderRadius: 2,
  },
  progressThumb: {
    position: 'absolute',
    top: -6,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: APP_CONFIG.colors.info,
    borderWidth: 2,
    borderColor: 'white',
  },
  videoDescription: {
    marginTop: APP_CONFIG.spacing.md,
    padding: APP_CONFIG.spacing.md,
    backgroundColor: APP_CONFIG.colors.overlay.light,
    borderRadius: APP_CONFIG.borderRadius.lg,
  },
  descriptionText: {
    fontSize: 13,
    color: APP_CONFIG.colors.text.secondary,
    lineHeight: 18,
  },
  errorContainer: {
    height: 250,
    backgroundColor: APP_CONFIG.colors.secondary,
    borderRadius: APP_CONFIG.borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: APP_CONFIG.spacing.lg,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: APP_CONFIG.colors.error,
    marginTop: APP_CONFIG.spacing.sm,
    marginBottom: APP_CONFIG.spacing.xs,
  },
  errorText: {
    fontSize: 14,
    color: APP_CONFIG.colors.text.secondary,
    textAlign: 'center',
    marginBottom: APP_CONFIG.spacing.md,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: APP_CONFIG.colors.info,
    paddingHorizontal: APP_CONFIG.spacing.md,
    paddingVertical: APP_CONFIG.spacing.sm,
    borderRadius: APP_CONFIG.borderRadius.lg,
  },
  retryText: {
    fontSize: 14,
    color: 'white',
    fontWeight: '600',
    marginLeft: APP_CONFIG.spacing.xs,
  },
});