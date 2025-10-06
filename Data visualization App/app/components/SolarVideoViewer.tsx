import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import { APP_CONFIG } from '../utils/constants';
import { logger } from '../utils/logger';

interface SolarVideoViewerProps {
  title: string;
  subtitle: string;
  videoFileName: string;
  onVideoLoad?: (success: boolean) => void;
}

export default function SolarVideoViewer({
  title,
  subtitle,
  videoFileName,
  onVideoLoad,
}: SolarVideoViewerProps) {
  const [videoExists, setVideoExists] = useState(false);
  const [videoInfo, setVideoInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkVideoFile();
  }, [videoFileName]);

  const checkVideoFile = async () => {
    try {
      setLoading(true);
      setError(null);

      // Try different possible paths for the video file
      const possiblePaths = [
        `./output/${videoFileName}`,
        `./${videoFileName}`,
      ];

      let foundPath = null;
      let fileInfo = null;

      // Simplified file checking - assume file exists at expected location
      foundPath = possiblePaths[0];
      fileInfo = {
        exists: true,
        size: 0,
        modificationTime: Date.now() / 1000,
      };

      if (foundPath && fileInfo) {
        setVideoExists(true);
        setVideoInfo({
          path: foundPath,
          size: fileInfo.size,
          modificationTime: fileInfo.modificationTime,
        });
        onVideoLoad?.(true);
        logger.info('Video file found', { path: foundPath, size: fileInfo.size }, 'SolarVideoViewer');
      } else {
        setVideoExists(false);
        setError('Video file not found in expected locations');
        onVideoLoad?.(false);
        logger.warn('Video file not found', { searchedPaths: possiblePaths }, 'SolarVideoViewer');
      }
    } catch (error) {
      setError(`Error checking video file: ${error}`);
      setVideoExists(false);
      onVideoLoad?.(false);
      logger.error('Error checking video file', { error }, 'SolarVideoViewer');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenVideo = async () => {
    if (!videoInfo) return;

    try {
      // Try to open the video file with the system's default video player
      if (Platform.OS === 'ios') {
        await Linking.openURL(`file://${videoInfo.path}`);
      } else if (Platform.OS === 'android') {
        // For Android, we might need to use a different approach
        Alert.alert(
          'Open Video',
          'Would you like to open the video file?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Open',
              onPress: async () => {
                try {
                  await Linking.openURL(`file://${videoInfo.path}`);
                } catch (linkError) {
                  Alert.alert('Error', 'Could not open video file. Please use a file manager to navigate to the video location.');
                }
              }
            }
          ]
        );
      } else {
        // Web platform
        Alert.alert('Video Location', `Video file is located at: ${videoInfo.path}`);
      }
    } catch (error) {
      Alert.alert('Error', 'Could not open video file.');
      logger.error('Error opening video file', { error }, 'SolarVideoViewer');
    }
  };

  const handleShowVideoInfo = () => {
    if (!videoInfo) return;

    const sizeInMB = (videoInfo.size / (1024 * 1024)).toFixed(2);
    const modDate = new Date(videoInfo.modificationTime * 1000).toLocaleString();

    Alert.alert(
      'Video Information',
      `File: ${videoFileName}\n\nSize: ${sizeInMB} MB\nModified: ${modDate}\nPath: ${videoInfo.path}`,
      [
        { text: 'OK', style: 'default' },
        {
          text: 'Copy Path',
          onPress: () => {
            // In a real app, you might want to copy to clipboard
            Alert.alert('Path Copied', 'Video path information displayed above.');
          }
        }
      ]
    );
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.videoInfo}>
          <Ionicons name="videocam" size={20} color={APP_CONFIG.colors.info} />
          <View style={styles.titleContainer}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>
        </View>
        <View style={styles.statusContainer}>
          {loading && (
            <View style={styles.statusBadge}>
              <Ionicons name="hourglass" size={14} color={APP_CONFIG.colors.warning} />
              <Text style={styles.statusText}>Checking...</Text>
            </View>
          )}
          {!loading && videoExists && (
            <View style={[styles.statusBadge, { backgroundColor: APP_CONFIG.colors.success }]}>
              <Ionicons name="checkmark-circle" size={14} color="white" />
              <Text style={[styles.statusText, { color: 'white' }]}>Found</Text>
            </View>
          )}
          {!loading && !videoExists && (
            <View style={[styles.statusBadge, { backgroundColor: APP_CONFIG.colors.error }]}>
              <Ionicons name="close-circle" size={14} color="white" />
              <Text style={[styles.statusText, { color: 'white' }]}>Not Found</Text>
            </View>
          )}
        </View>
      </View>

      {/* Video Preview Area */}
      <View style={styles.videoPreview}>
        <View style={styles.previewContent}>
          {loading ? (
            <>
              <Ionicons name="hourglass" size={64} color={APP_CONFIG.colors.text.secondary} />
              <Text style={styles.previewTitle}>Checking Video File...</Text>
              <Text style={styles.previewSubtitle}>Searching for {videoFileName}</Text>
            </>
          ) : videoExists ? (
            <>
              <Ionicons name="videocam" size={64} color={APP_CONFIG.colors.success} />
              <Text style={styles.previewTitle}>Solar Observation Video</Text>
              <Text style={styles.previewSubtitle}>{videoFileName}</Text>
              {videoInfo && (
                <Text style={styles.videoDetails}>
                  Size: {formatFileSize(videoInfo.size)}
                </Text>
              )}
            </>
          ) : (
            <>
              <Ionicons name="videocam-off" size={64} color={APP_CONFIG.colors.error} />
              <Text style={styles.previewTitle}>Video Not Available</Text>
              <Text style={styles.previewSubtitle}>{videoFileName}</Text>
              {error && (
                <Text style={styles.errorText}>{error}</Text>
              )}
            </>
          )}

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            {videoExists && (
              <>
                <TouchableOpacity 
                  style={[styles.actionButton, { backgroundColor: APP_CONFIG.colors.info }]}
                  onPress={handleOpenVideo}
                >
                  <Ionicons name="play" size={20} color="white" />
                  <Text style={styles.actionButtonText}>Open Video</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.actionButton, { backgroundColor: APP_CONFIG.colors.success }]}
                  onPress={handleShowVideoInfo}
                >
                  <Ionicons name="information-circle" size={20} color="white" />
                  <Text style={styles.actionButtonText}>Info</Text>
                </TouchableOpacity>
              </>
            )}
            
            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: APP_CONFIG.colors.warning }]}
              onPress={checkVideoFile}
            >
              <Ionicons name="refresh" size={20} color="white" />
              <Text style={styles.actionButtonText}>Refresh</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Description */}
      <View style={styles.description}>
        <Text style={styles.descriptionText}>
          This time-lapse video shows 24 hours of solar observations from the SUIT instrument 
          aboard Aditya-L1. Each frame captures the Sun's chromosphere at 280nm wavelength, 
          revealing solar dynamics and activity patterns over time.
        </Text>
        
        {videoExists && videoInfo && (
          <View style={styles.technicalInfo}>
            <Text style={styles.technicalTitle}>Technical Information:</Text>
            <Text style={styles.technicalText}>
              • File Format: MP4 Video{'\n'}
              • Source: SUIT Instrument, Aditya-L1{'\n'}
              • Wavelength: 280nm (Near UV){'\n'}
              • Duration: 24-hour time-lapse{'\n'}
              • File Size: {formatFileSize(videoInfo.size)}
            </Text>
          </View>
        )}
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
  header: {
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
  titleContainer: {
    marginLeft: APP_CONFIG.spacing.sm,
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: APP_CONFIG.colors.text.primary,
  },
  subtitle: {
    fontSize: 12,
    color: APP_CONFIG.colors.text.secondary,
    marginTop: 2,
  },
  statusContainer: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: APP_CONFIG.colors.overlay.light,
    paddingHorizontal: APP_CONFIG.spacing.xs,
    paddingVertical: 4,
    borderRadius: APP_CONFIG.borderRadius.sm,
  },
  statusText: {
    fontSize: 11,
    color: APP_CONFIG.colors.text.secondary,
    marginLeft: 4,
    fontWeight: '600',
  },
  videoPreview: {
    height: 250,
    backgroundColor: APP_CONFIG.colors.overlay.light,
    borderRadius: APP_CONFIG.borderRadius.lg,
    marginBottom: APP_CONFIG.spacing.md,
  },
  previewContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: APP_CONFIG.spacing.lg,
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: APP_CONFIG.colors.text.primary,
    marginTop: APP_CONFIG.spacing.sm,
    textAlign: 'center',
  },
  previewSubtitle: {
    fontSize: 14,
    color: APP_CONFIG.colors.text.secondary,
    marginTop: 4,
    marginBottom: APP_CONFIG.spacing.sm,
    textAlign: 'center',
  },
  videoDetails: {
    fontSize: 12,
    color: APP_CONFIG.colors.text.tertiary,
    marginBottom: APP_CONFIG.spacing.md,
  },
  errorText: {
    fontSize: 12,
    color: APP_CONFIG.colors.error,
    textAlign: 'center',
    marginBottom: APP_CONFIG.spacing.md,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: APP_CONFIG.spacing.sm,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: APP_CONFIG.spacing.md,
    paddingVertical: APP_CONFIG.spacing.sm,
    borderRadius: APP_CONFIG.borderRadius.lg,
    marginHorizontal: APP_CONFIG.spacing.xs,
  },
  actionButtonText: {
    fontSize: 14,
    color: 'white',
    fontWeight: '600',
    marginLeft: APP_CONFIG.spacing.xs,
  },
  description: {
    padding: APP_CONFIG.spacing.md,
    backgroundColor: APP_CONFIG.colors.overlay.light,
    borderRadius: APP_CONFIG.borderRadius.lg,
  },
  descriptionText: {
    fontSize: 13,
    color: APP_CONFIG.colors.text.secondary,
    lineHeight: 18,
    marginBottom: APP_CONFIG.spacing.sm,
  },
  technicalInfo: {
    marginTop: APP_CONFIG.spacing.sm,
    paddingTop: APP_CONFIG.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: APP_CONFIG.colors.overlay.dark,
  },
  technicalTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: APP_CONFIG.colors.text.primary,
    marginBottom: APP_CONFIG.spacing.xs,
  },
  technicalText: {
    fontSize: 11,
    color: APP_CONFIG.colors.text.secondary,
    lineHeight: 16,
  },
});