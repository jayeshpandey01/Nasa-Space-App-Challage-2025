import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlogCacheManager } from '../services/blogCacheManager';
import { APP_CONFIG } from '../utils/constants';
import { logger } from '../utils/logger';

interface CacheManagerProps {
  visible: boolean;
  onClose: () => void;
}

export default function CacheManager({ visible, onClose }: CacheManagerProps) {
  const [cacheStats, setCacheStats] = useState({
    totalCaches: 0,
    totalSize: 0,
    oldestCache: null as number | null,
    newestCache: null as number | null,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      loadCacheStats();
    }
  }, [visible]);

  const loadCacheStats = async () => {
    try {
      setLoading(true);
      const stats = await BlogCacheManager.getCacheStats();
      setCacheStats(stats);
    } catch (error) {
      logger.error('Error loading cache stats', { error }, 'CacheManager');
    } finally {
      setLoading(false);
    }
  };

  const handleClearAllCaches = () => {
    Alert.alert(
      'Clear All Caches',
      'This will remove all cached blog content. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              await BlogCacheManager.clearAllCaches();
              await loadCacheStats();
              Alert.alert('Success', 'All caches have been cleared.');
            } catch (error) {
              Alert.alert('Error', 'Failed to clear caches.');
            }
          }
        }
      ]
    );
  };

  const handleCleanupExpired = async () => {
    try {
      setLoading(true);
      const cleanedCount = await BlogCacheManager.cleanupExpiredCaches();
      await loadCacheStats();
      
      Alert.alert(
        'Cleanup Complete',
        `Removed ${cleanedCount} expired cache${cleanedCount !== 1 ? 's' : ''}.`
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to cleanup expired caches.');
    } finally {
      setLoading(false);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (timestamp: number | null): string => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleString();
  };

  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Cache Manager</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={24} color={APP_CONFIG.colors.text.primary} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          {/* Cache Statistics */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Cache Statistics</Text>
            
            <View style={styles.statGrid}>
              <View style={styles.statCard}>
                <Ionicons name="folder" size={24} color={APP_CONFIG.colors.info} />
                <Text style={styles.statValue}>{cacheStats.totalCaches}</Text>
                <Text style={styles.statLabel}>Total Caches</Text>
              </View>
              
              <View style={styles.statCard}>
                <Ionicons name="archive" size={24} color={APP_CONFIG.colors.success} />
                <Text style={styles.statValue}>{formatBytes(cacheStats.totalSize)}</Text>
                <Text style={styles.statLabel}>Total Size</Text>
              </View>
            </View>

            <View style={styles.dateInfo}>
              <View style={styles.dateItem}>
                <Text style={styles.dateLabel}>Oldest Cache:</Text>
                <Text style={styles.dateValue}>{formatDate(cacheStats.oldestCache)}</Text>
              </View>
              <View style={styles.dateItem}>
                <Text style={styles.dateLabel}>Newest Cache:</Text>
                <Text style={styles.dateValue}>{formatDate(cacheStats.newestCache)}</Text>
              </View>
            </View>
          </View>

          {/* Cache Actions */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Cache Actions</Text>
            
            <TouchableOpacity 
              style={[styles.actionButton, styles.refreshButton]}
              onPress={loadCacheStats}
              disabled={loading}
            >
              <Ionicons name="refresh" size={20} color="white" />
              <Text style={styles.actionButtonText}>Refresh Stats</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.actionButton, styles.cleanupButton]}
              onPress={handleCleanupExpired}
              disabled={loading}
            >
              <Ionicons name="trash" size={20} color="white" />
              <Text style={styles.actionButtonText}>Cleanup Expired</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.actionButton, styles.clearButton]}
              onPress={handleClearAllCaches}
              disabled={loading}
            >
              <Ionicons name="nuclear" size={20} color="white" />
              <Text style={styles.actionButtonText}>Clear All Caches</Text>
            </TouchableOpacity>
          </View>

          {/* Cache Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Cache Information</Text>
            <View style={styles.infoContainer}>
              <Text style={styles.infoText}>
                • Caches expire after 24 hours{'\n'}
                • New data automatically invalidates cache{'\n'}
                • Cache keys are based on observation data{'\n'}
                • Cached content includes AI-generated summaries
              </Text>
            </View>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  container: {
    backgroundColor: APP_CONFIG.colors.secondary,
    borderRadius: APP_CONFIG.borderRadius.xl,
    width: '90%',
    maxHeight: '80%',
    ...APP_CONFIG.shadows.medium,
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
  },
  closeButton: {
    padding: APP_CONFIG.spacing.xs,
  },
  content: {
    flex: 1,
    padding: APP_CONFIG.spacing.lg,
  },
  section: {
    marginBottom: APP_CONFIG.spacing.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: APP_CONFIG.colors.text.primary,
    marginBottom: APP_CONFIG.spacing.md,
  },
  statGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: APP_CONFIG.spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: APP_CONFIG.colors.overlay.light,
    borderRadius: APP_CONFIG.borderRadius.lg,
    padding: APP_CONFIG.spacing.md,
    alignItems: 'center',
    marginHorizontal: APP_CONFIG.spacing.xs,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: APP_CONFIG.colors.text.primary,
    marginTop: APP_CONFIG.spacing.xs,
  },
  statLabel: {
    fontSize: 12,
    color: APP_CONFIG.colors.text.secondary,
    marginTop: 4,
    textAlign: 'center',
  },
  dateInfo: {
    backgroundColor: APP_CONFIG.colors.overlay.light,
    borderRadius: APP_CONFIG.borderRadius.lg,
    padding: APP_CONFIG.spacing.md,
  },
  dateItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: APP_CONFIG.spacing.xs,
  },
  dateLabel: {
    fontSize: 14,
    color: APP_CONFIG.colors.text.secondary,
    fontWeight: '600',
  },
  dateValue: {
    fontSize: 14,
    color: APP_CONFIG.colors.text.primary,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: APP_CONFIG.spacing.md,
    paddingHorizontal: APP_CONFIG.spacing.lg,
    borderRadius: APP_CONFIG.borderRadius.lg,
    marginBottom: APP_CONFIG.spacing.sm,
  },
  refreshButton: {
    backgroundColor: APP_CONFIG.colors.info,
  },
  cleanupButton: {
    backgroundColor: APP_CONFIG.colors.warning,
  },
  clearButton: {
    backgroundColor: APP_CONFIG.colors.error,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
    marginLeft: APP_CONFIG.spacing.sm,
  },
  infoContainer: {
    backgroundColor: APP_CONFIG.colors.overlay.light,
    borderRadius: APP_CONFIG.borderRadius.lg,
    padding: APP_CONFIG.spacing.md,
  },
  infoText: {
    fontSize: 14,
    color: APP_CONFIG.colors.text.secondary,
    lineHeight: 20,
  },
});