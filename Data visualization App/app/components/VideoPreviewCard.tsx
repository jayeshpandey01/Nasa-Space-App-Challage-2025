import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { APP_CONFIG } from '../utils/constants';

interface VideoPreviewCardProps {
  title: string;
  subtitle: string;
  duration?: string;
  frameCount?: number;
  onPlayPress?: () => void;
  onInfoPress?: () => void;
}

export default function VideoPreviewCard({
  title,
  subtitle,
  duration = "24:00:00",
  frameCount = 1440,
  onPlayPress,
  onInfoPress,
}: VideoPreviewCardProps) {
  const [showDetails, setShowDetails] = useState(false);

  const handlePlayPress = () => {
    Alert.alert(
      'Solar Video Player',
      'This would open the solar observation video in your device\'s default video player.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Open', 
          onPress: () => {
            onPlayPress?.();
            // In a real implementation, this would open the video file
            Alert.alert('Info', 'Video file: sun_video.mp4\nLocation: ./output/\n\nThis is a 24-hour time-lapse of solar observations from the SUIT instrument.');
          }
        }
      ]
    );
  };

  const handleInfoPress = () => {
    setShowDetails(!showDetails);
    onInfoPress?.();
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
        <TouchableOpacity style={styles.infoButton} onPress={handleInfoPress}>
          <Ionicons 
            name={showDetails ? "chevron-up" : "chevron-down"} 
            size={20} 
            color={APP_CONFIG.colors.text.secondary} 
          />
        </TouchableOpacity>
      </View>

      {/* Video Preview */}
      <TouchableOpacity style={styles.videoPreview} onPress={handlePlayPress}>
        <View style={styles.previewOverlay}>
          {/* Simulated video thumbnail with solar imagery */}
          <View style={styles.thumbnailContainer}>
            <View style={styles.solarDisc}>
              <View style={styles.solarCore} />
              <View style={styles.solarFlare1} />
              <View style={styles.solarFlare2} />
            </View>
          </View>
          
          {/* Play Button Overlay */}
          <View style={styles.playOverlay}>
            <View style={styles.playButton}>
              <Ionicons name="play" size={32} color="white" />
            </View>
          </View>

          {/* Duration Badge */}
          <View style={styles.durationBadge}>
            <Ionicons name="time" size={14} color="white" />
            <Text style={styles.durationText}>{duration}</Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* Video Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Ionicons name="film" size={16} color={APP_CONFIG.colors.info} />
          <Text style={styles.statLabel}>Frames</Text>
          <Text style={styles.statValue}>{frameCount.toLocaleString()}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Ionicons name="time" size={16} color={APP_CONFIG.colors.success} />
          <Text style={styles.statLabel}>Duration</Text>
          <Text style={styles.statValue}>{duration}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Ionicons name="eye" size={16} color={APP_CONFIG.colors.warning} />
          <Text style={styles.statLabel}>Wavelength</Text>
          <Text style={styles.statValue}>280nm</Text>
        </View>
      </View>

      {/* Detailed Information */}
      {showDetails && (
        <View style={styles.detailsContainer}>
          <Text style={styles.detailsTitle}>Video Information</Text>
          <View style={styles.detailsList}>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>File Name:</Text>
              <Text style={styles.detailValue}>sun_video.mp4</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Format:</Text>
              <Text style={styles.detailValue}>MP4 Video</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Source:</Text>
              <Text style={styles.detailValue}>SUIT Instrument, Aditya-L1</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Observation:</Text>
              <Text style={styles.detailValue}>Solar Chromosphere</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Wavelength:</Text>
              <Text style={styles.detailValue}>280nm (Near UV)</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Time Range:</Text>
              <Text style={styles.detailValue}>24-hour continuous observation</Text>
            </View>
          </View>
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.actionContainer}>
        <TouchableOpacity style={styles.primaryButton} onPress={handlePlayPress}>
          <Ionicons name="play" size={20} color="white" />
          <Text style={styles.primaryButtonText}>Play Video</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.secondaryButton} onPress={handleInfoPress}>
          <Ionicons name="information-circle" size={20} color={APP_CONFIG.colors.info} />
          <Text style={styles.secondaryButtonText}>Details</Text>
        </TouchableOpacity>
      </View>

      {/* Description */}
      <View style={styles.description}>
        <Text style={styles.descriptionText}>
          This time-lapse video captures 24 hours of solar observations from the SUIT instrument 
          aboard Aditya-L1. Each frame reveals the dynamic nature of the Sun's chromosphere at 
          280nm wavelength, showing solar activity patterns, flares, and atmospheric dynamics.
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
    height: 200,
    borderRadius: APP_CONFIG.borderRadius.lg,
    overflow: 'hidden',
    marginBottom: APP_CONFIG.spacing.md,
  },
  previewOverlay: {
    flex: 1,
    position: 'relative',
  },
  thumbnailContainer: {
    flex: 1,
    backgroundColor: '#000814',
    alignItems: 'center',
    justifyContent: 'center',
  },
  solarDisc: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#FFD60A',
    position: 'relative',
    shadowColor: '#FFD60A',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 20,
  },
  solarCore: {
    position: 'absolute',
    top: 20,
    left: 20,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FF8500',
  },
  solarFlare1: {
    position: 'absolute',
    top: -10,
    right: 10,
    width: 30,
    height: 8,
    backgroundColor: '#FF6B35',
    borderRadius: 4,
    transform: [{ rotate: '45deg' }],
  },
  solarFlare2: {
    position: 'absolute',
    bottom: 5,
    left: -5,
    width: 25,
    height: 6,
    backgroundColor: '#FF6B35',
    borderRadius: 3,
    transform: [{ rotate: '-30deg' }],
  },
  playOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  playButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.8)',
  },
  durationBadge: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: APP_CONFIG.spacing.sm,
    paddingVertical: 4,
    borderRadius: APP_CONFIG.borderRadius.sm,
  },
  durationText: {
    fontSize: 12,
    color: 'white',
    fontWeight: '600',
    marginLeft: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: APP_CONFIG.colors.overlay.light,
    borderRadius: APP_CONFIG.borderRadius.lg,
    padding: APP_CONFIG.spacing.md,
    marginBottom: APP_CONFIG.spacing.md,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 11,
    color: APP_CONFIG.colors.text.secondary,
    marginTop: 4,
    fontWeight: '600',
  },
  statValue: {
    fontSize: 14,
    fontWeight: '700',
    color: APP_CONFIG.colors.text.primary,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: APP_CONFIG.colors.overlay.dark,
    marginHorizontal: APP_CONFIG.spacing.md,
  },
  detailsContainer: {
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
  detailsList: {},
  detailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: APP_CONFIG.spacing.xs,
  },
  detailLabel: {
    fontSize: 12,
    color: APP_CONFIG.colors.text.secondary,
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 12,
    color: APP_CONFIG.colors.text.primary,
    textAlign: 'right',
    flex: 1,
    marginLeft: APP_CONFIG.spacing.sm,
  },
  actionContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: APP_CONFIG.spacing.md,
  },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: APP_CONFIG.colors.info,
    paddingVertical: APP_CONFIG.spacing.md,
    borderRadius: APP_CONFIG.borderRadius.lg,
    marginRight: APP_CONFIG.spacing.sm,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
    marginLeft: APP_CONFIG.spacing.xs,
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: APP_CONFIG.colors.overlay.light,
    paddingVertical: APP_CONFIG.spacing.md,
    borderRadius: APP_CONFIG.borderRadius.lg,
    marginLeft: APP_CONFIG.spacing.sm,
    borderWidth: 1,
    borderColor: APP_CONFIG.colors.info,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: APP_CONFIG.colors.info,
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
  },
});