import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { APP_CONFIG } from '../utils/constants';

export default function VideoTest() {
  const [status, setStatus] = useState<string>('Not loaded');
  const [error, setError] = useState<string | null>(null);
  const video = useRef<Video>(null);

  const testVideoLoad = () => {
    setStatus('Testing...');
    setError(null);
  };

  const onPlaybackStatusUpdate = (playbackStatus: AVPlaybackStatus) => {
    if (playbackStatus.isLoaded) {
      setStatus(`Loaded - Duration: ${Math.round((playbackStatus.durationMillis || 0) / 1000)}s`);
      setError(null);
    } else if (playbackStatus.error) {
      setStatus('Failed to load');
      setError(playbackStatus.error);
    }
  };

  const handlePlay = async () => {
    try {
      if (video.current) {
        await video.current.playAsync();
        setStatus('Playing...');
      }
    } catch (err) {
      setError(`Play error: ${err}`);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Video Test Component</Text>
      
      <View style={styles.statusContainer}>
        <Text style={styles.statusLabel}>Status:</Text>
        <Text style={[styles.statusText, error && { color: APP_CONFIG.colors.error }]}>
          {status}
        </Text>
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={styles.videoContainer}>
        <Video
          ref={video}
          style={styles.video}
          source={require('../../output/sun_video.mp4')}
          useNativeControls={false}
          resizeMode={ResizeMode.CONTAIN}
          isLooping={false}
          onPlaybackStatusUpdate={onPlaybackStatusUpdate}
          shouldPlay={false}
        />
      </View>

      <View style={styles.controls}>
        <TouchableOpacity style={styles.button} onPress={testVideoLoad}>
          <Ionicons name="refresh" size={20} color="white" />
          <Text style={styles.buttonText}>Test Load</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={handlePlay}>
          <Ionicons name="play" size={20} color="white" />
          <Text style={styles.buttonText}>Play</Text>
        </TouchableOpacity>
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
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: APP_CONFIG.colors.text.primary,
    marginBottom: APP_CONFIG.spacing.md,
    textAlign: 'center',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: APP_CONFIG.spacing.sm,
  },
  statusLabel: {
    fontSize: 14,
    color: APP_CONFIG.colors.text.secondary,
    marginRight: APP_CONFIG.spacing.sm,
  },
  statusText: {
    fontSize: 14,
    color: APP_CONFIG.colors.text.primary,
    fontWeight: '600',
  },
  errorContainer: {
    backgroundColor: `${APP_CONFIG.colors.error}20`,
    borderRadius: APP_CONFIG.borderRadius.lg,
    padding: APP_CONFIG.spacing.sm,
    marginBottom: APP_CONFIG.spacing.sm,
  },
  errorText: {
    fontSize: 12,
    color: APP_CONFIG.colors.error,
  },
  videoContainer: {
    height: 200,
    backgroundColor: '#000',
    borderRadius: APP_CONFIG.borderRadius.lg,
    marginBottom: APP_CONFIG.spacing.md,
    overflow: 'hidden',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: APP_CONFIG.colors.info,
    paddingHorizontal: APP_CONFIG.spacing.md,
    paddingVertical: APP_CONFIG.spacing.sm,
    borderRadius: APP_CONFIG.borderRadius.lg,
  },
  buttonText: {
    fontSize: 14,
    color: 'white',
    fontWeight: '600',
    marginLeft: APP_CONFIG.spacing.xs,
  },
});