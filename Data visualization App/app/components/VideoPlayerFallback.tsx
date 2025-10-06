import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { APP_CONFIG } from '../utils/constants';

interface VideoPlayerFallbackProps {
  title: string;
  subtitle: string;
  videoPath: string;
  onRetry?: () => void;
}

export default function VideoPlayerFallback({
  title,
  subtitle,
  videoPath,
  onRetry,
}: VideoPlayerFallbackProps) {
  const [showDetails, setShowDetails] = useState(false);

  const handleOpenVideoLocation = () => {
    Alert.alert(
      'Video Location',
      `The solar observation video is located at:\n\n${videoPath}\n\nThis video contains 24 hours of solar observations from the SUIT instrument.`,
      [
        { text: 'OK', style: 'default' },
        { 
          text: 'Open Folder', 
          style: 'default',
          onPress: () => {
            // Try to open the folder containing the video
            const folderPath = videoPath.substring(0, videoPath.lastIndexOf('/'));
            Linking.openURL(`file://${folderPath}`).catch(() => {
              Alert.alert('Error', 'Could not open folder location');
            });
          }
        }
      ]
    );
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
        <TouchableOpacity 
          style={styles.infoButton}
          onPress={() => setShowDetails(!showDetails)}
        >
          <Ionicons name="information-circle" size={20} color={APP_CONFIG.colors.text.secondary} />
        </TouchableOpacity>
      </View>

      {/* Video Preview Area */}
      <View style={styles.videoPreview}>
        <View style={styles.previewContent}>
          <Ionicons name="film" size={64} color={APP_CONFIG.colors.text.secondary} />
          <Text style={styles.previewTitle}>Solar Observation Video</Text>
          <Text style={styles.previewSubtitle}>sun_video.mp4</Text>
          
          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: APP_CONFIG.colors.info }]}
              onPress={handleOpenVideoLocation}
            >
              <Ionicons name="folder-open" size={20} color="white" />
              <Text style={styles.actionButtonText}>Open Location</Text>
            </TouchableOpacity>
            
            {onRetry && (
              <TouchableOpacity 
                style={[styles.actionButton, { backgroundColor: APP_CONFIG.colors.success }]}
                onPress={onRetry}
              >
                <Ionicons name="refresh" size={20} color="white" />
                <Text style={styles.actionButtonText}>Retry</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* Details Section */}
      {showDetails && (
        <View style={styles.detailsSection}>
          <Text style={styles.detailsTitle}>Video Information</Text>
          <View style={styles.detailItem}>
            <Ionicons name="document" size={16} color={APP_CONFIG.colors.text.secondary} />
            <Text style={styles.detailText}>Format: MP4 Video File</Text>
          </View>
          <View style={styles.detailItem}>
            <Ionicons name="time" size={16} color={APP_CONFIG.colors.text.secondary} />
            <Text style={styles.detailText}>Duration: 24 Hours Time-lapse</Text>
          </View>
          <View style={styles.detailItem}>
            <Ionicons name="camera" size={16} color={APP_CONFIG.colors.text.secondary} />
            <Text style={styles.detailText}>Source: SUIT Instrument, Aditya-L1</Text>
          </View>
          <View style={styles.detailItem}>
            <Ionicons name="eye" size={16} color={APP_CONFIG.colors.text.secondary} />
            <Text style={styles.detailText}>Wavelength: 280nm (Near UV)</Text>
          </View>
          <View style={styles.detailItem}>
            <Ionicons name="location" size={16} color={APP_CONFIG.colors.text.secondary} />
            <Text style={styles.detailText}>Path: {videoPath}</Text>
          </View>
        </View>
      )}

      {/* Description */}
      <View style={styles.description}>
        <Text style={styles.descriptionText}>
          This time-lapse video shows 24 hours of solar observations from the SUIT instrument 
          aboard Aditya-L1. Each frame captures the Sun's chromosphere at 280nm wavelength, 
          revealing solar dynamics and activity patterns over time.
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
  infoButton: {
    padding: APP_CONFIG.spacing.xs,
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
    marginBottom: APP_CONFIG.spacing.lg,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: APP_CONFIG.spacing.md,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: APP_CONFIG.spacing.md,
    paddingVertical: APP_CONFIG.spacing.sm,
    borderRadius: APP_CONFIG.borderRadius.lg,
  },
  actionButtonText: {
    fontSize: 14,
    color: 'white',
    fontWeight: '600',
    marginLeft: APP_CONFIG.spacing.xs,
  },
  detailsSection: {
    backgroundColor: APP_CONFIG.colors.overlay.light,
    borderRadius: APP_CONFIG.borderRadius.lg,
    padding: APP_CONFIG.spacing.md,
    marginBottom: APP_CONFIG.spacing.md,
  },
  detailsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: APP_CONFIG.colors.text.primary,
    marginBottom: APP_CONFIG.spacing.sm,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: APP_CONFIG.spacing.xs,
  },
  detailText: {
    fontSize: 12,
    color: APP_CONFIG.colors.text.secondary,
    marginLeft: APP_CONFIG.spacing.xs,
    flex: 1,
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
  },
});