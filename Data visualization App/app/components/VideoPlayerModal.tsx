import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Dimensions,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { APP_CONFIG } from '../utils/constants';
import { logger } from '../utils/logger';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface VideoPlayerModalProps {
  visible: boolean;
  onClose: () => void;
  videoSource: any;
  title?: string;
}

export default function VideoPlayerModal({
  visible,
  onClose,
  videoSource,
  title = "Solar Observation Video",
}: VideoPlayerModalProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const video = useRef<Video>(null);

  const handlePlayPause = async () => {
    try {
      if (video.current) {
        if (isPlaying) {
          await video.current.pauseAsync();
        } else {
          await video.current.playAsync();
        }
      }
    } catch (err) {
      logger.error('Error controlling video', { error: err }, 'VideoPlayerModal');
      Alert.alert('Error', 'Failed to control video playback');
    }
  };

  const handleClose = async () => {
    try {
      if (video.current) {
        await video.current.stopAsync();
        await video.current.unloadAsync();
      }
    } catch (err) {
      logger.error('Error closing video', { error: err }, 'VideoPlayerModal');
    }
    setIsPlaying(false);
    setPosition(0);
    onClose();
  };

  const onPlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      setIsLoading(false);
      setDuration(status.durationMillis || 0);
      setPosition(status.positionMillis || 0);
      setIsPlaying(status.isPlaying);
      setError(null);
      
      if (status.didJustFinish) {
        setIsPlaying(false);
      }
    } else if (status.error) {
      setError(`Playback error: ${status.error}`);
      setIsLoading(false);
      logger.error('Video playback error', { error: status.error }, 'VideoPlayerModal');
    }
  };

  const formatTime = (milliseconds: number) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const progressPercentage = duration > 0 ? (position / duration) * 100 : 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <Ionicons name="close" size={28} color={APP_CONFIG.colors.text.primary} />
          </TouchableOpacity>
        </View>

        {/* Video Player */}
        <View style={styles.videoContainer}>
          {error ? (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={48} color={APP_CONFIG.colors.error} />
              <Text style={styles.errorTitle}>Video Error</Text>
              <Text style={styles.errorText}>{error}</Text>
              <Text style={styles.errorHint}>
                The video file may not be in a compatible format or location.
              </Text>
            </View>
          ) : (
            <>
              <Video
                ref={video}
                style={styles.video}
                source={videoSource}
                useNativeControls={false}
                resizeMode={ResizeMode.CONTAIN}
                isLooping={false}
                onPlaybackStatusUpdate={onPlaybackStatusUpdate}
                shouldPlay={false}
              />

              {isLoading && (
                <View style={styles.loadingOverlay}>
                  <Ionicons name="hourglass" size={32} color={APP_CONFIG.colors.info} />
                  <Text style={styles.loadingText}>Loading video...</Text>
                </View>
              )}

              {/* Play/Pause Button Overlay */}
              {!isLoading && (
                <TouchableOpacity 
                  style={styles.playOverlay}
                  onPress={handlePlayPause}
                  activeOpacity={0.9}
                >
                  <View style={styles.playButton}>
                    <Ionicons 
                      name={isPlaying ? "pause" : "play"} 
                      size={40} 
                      color="white" 
                    />
                  </View>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>

        {/* Controls */}
        {!error && (
          <View style={styles.controls}>
            <View style={styles.timeContainer}>
              <Text style={styles.timeText}>{formatTime(position)}</Text>
              <Text style={styles.timeText}>{formatTime(duration)}</Text>
            </View>
            
            <View style={styles.progressBar}>
              <View 
                style={[styles.progressFill, { width: `${progressPercentage}%` }]} 
              />
            </View>

            <View style={styles.buttonContainer}>
              <TouchableOpacity 
                style={styles.controlButton}
                onPress={handlePlayPause}
                disabled={isLoading}
              >
                <Ionicons 
                  name={isPlaying ? "pause" : "play"} 
                  size={32} 
                  color={APP_CONFIG.colors.text.primary} 
                />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Info */}
        <View style={styles.infoContainer}>
          <Text style={styles.infoText}>
            24-hour time-lapse of solar observations from the SUIT instrument aboard Aditya-L1. 
            Each frame captures the Sun's chromosphere at 280nm wavelength.
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: APP_CONFIG.colors.background.main,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: APP_CONFIG.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: APP_CONFIG.colors.overlay.dark,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: APP_CONFIG.colors.text.primary,
    flex: 1,
  },
  closeButton: {
    padding: APP_CONFIG.spacing.xs,
  },
  videoContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  video: {
    width: screenWidth,
    height: screenWidth * (9/16), // 16:9 aspect ratio
  },
  loadingOverlay: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: APP_CONFIG.colors.text.primary,
    marginTop: APP_CONFIG.spacing.sm,
  },
  playOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.8)',
  },
  controls: {
    padding: APP_CONFIG.spacing.lg,
    backgroundColor: APP_CONFIG.colors.secondary,
  },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: APP_CONFIG.spacing.sm,
  },
  timeText: {
    fontSize: 14,
    color: APP_CONFIG.colors.text.secondary,
    fontWeight: '600',
  },
  progressBar: {
    height: 4,
    backgroundColor: APP_CONFIG.colors.overlay.dark,
    borderRadius: 2,
    marginBottom: APP_CONFIG.spacing.md,
  },
  progressFill: {
    height: '100%',
    backgroundColor: APP_CONFIG.colors.info,
    borderRadius: 2,
  },
  buttonContainer: {
    alignItems: 'center',
  },
  controlButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: APP_CONFIG.colors.overlay.light,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoContainer: {
    padding: APP_CONFIG.spacing.lg,
    backgroundColor: APP_CONFIG.colors.secondary,
    borderTopWidth: 1,
    borderTopColor: APP_CONFIG.colors.overlay.dark,
  },
  infoText: {
    fontSize: 14,
    color: APP_CONFIG.colors.text.secondary,
    lineHeight: 20,
    textAlign: 'center',
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: APP_CONFIG.spacing.xl,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: APP_CONFIG.colors.error,
    marginTop: APP_CONFIG.spacing.md,
    marginBottom: APP_CONFIG.spacing.sm,
  },
  errorText: {
    fontSize: 16,
    color: APP_CONFIG.colors.text.primary,
    textAlign: 'center',
    marginBottom: APP_CONFIG.spacing.sm,
  },
  errorHint: {
    fontSize: 14,
    color: APP_CONFIG.colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});