import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../utils/logger';

export interface CachedBlog {
  content: string;
  generatedAt: number;
  dataHash: string;
  fileModifiedAt: number;
  summary: any;
  version: string;
}

export interface CacheMetadata {
  lastGenerated: number;
  dataVersion: string;
  fileSize: number;
  checksum: string;
}

export class BlogCacheManager {
  private static readonly CACHE_KEY_PREFIX = 'solar_blog_cache_';
  private static readonly METADATA_KEY_PREFIX = 'solar_blog_metadata_';
  private static readonly CACHE_VERSION = '1.0.0';
  private static readonly CACHE_EXPIRY_HOURS = 24; // Cache expires after 24 hours

  /**
   * Generate a unique cache key based on data characteristics
   */
  private static generateCacheKey(summary: any): string {
    const keyData = {
      date: summary.date,
      totalObservations: summary.totalObservations,
      duration: summary.observationPeriod?.durationMinutes,
      wavelength: summary.instrumentData?.wavelength,
      activityLevel: summary.solarActivity?.activityLevel,
    };
    
    const keyString = JSON.stringify(keyData);
    const hash = this.simpleHash(keyString);
    return `${this.CACHE_KEY_PREFIX}${hash}`;
  }

  /**
   * Generate a simple hash for cache key
   */
  private static simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Generate data hash to detect changes
   */
  private static generateDataHash(summary: any): string {
    const relevantData = {
      totalObservations: summary.totalObservations,
      keyEvents: summary.keyEvents,
      solarActivity: summary.solarActivity,
      qualityMetrics: summary.qualityMetrics,
      temporalAnalysis: summary.temporalAnalysis,
    };
    
    return this.simpleHash(JSON.stringify(relevantData));
  }

  /**
   * Check if cached blog exists and is valid
   */
  static async isCacheValid(summary: any): Promise<boolean> {
    try {
      const cacheKey = this.generateCacheKey(summary);
      const cachedData = await AsyncStorage.getItem(cacheKey);
      
      if (!cachedData) {
        logger.info('No cached blog found', { cacheKey }, 'BlogCacheManager');
        return false;
      }

      const cached: CachedBlog = JSON.parse(cachedData);
      const currentDataHash = this.generateDataHash(summary);
      const now = Date.now();
      const cacheAge = now - cached.generatedAt;
      const maxAge = this.CACHE_EXPIRY_HOURS * 60 * 60 * 1000;

      // Check if cache is expired
      if (cacheAge > maxAge) {
        logger.info('Cache expired', { 
          cacheAge: Math.round(cacheAge / (60 * 60 * 1000)), 
          maxAgeHours: this.CACHE_EXPIRY_HOURS 
        }, 'BlogCacheManager');
        return false;
      }

      // Check if data has changed
      if (cached.dataHash !== currentDataHash) {
        logger.info('Data changed, cache invalid', { 
          cachedHash: cached.dataHash, 
          currentHash: currentDataHash 
        }, 'BlogCacheManager');
        return false;
      }

      // Check version compatibility
      if (cached.version !== this.CACHE_VERSION) {
        logger.info('Cache version mismatch', { 
          cachedVersion: cached.version, 
          currentVersion: this.CACHE_VERSION 
        }, 'BlogCacheManager');
        return false;
      }

      logger.info('Cache is valid', { 
        cacheAge: Math.round(cacheAge / (60 * 1000)), 
        dataHash: currentDataHash 
      }, 'BlogCacheManager');
      return true;

    } catch (error) {
      logger.error('Error checking cache validity', { error }, 'BlogCacheManager');
      return false;
    }
  }

  /**
   * Get cached blog content
   */
  static async getCachedBlog(summary: any): Promise<string | null> {
    try {
      const cacheKey = this.generateCacheKey(summary);
      const cachedData = await AsyncStorage.getItem(cacheKey);
      
      if (!cachedData) {
        return null;
      }

      const cached: CachedBlog = JSON.parse(cachedData);
      
      logger.info('Retrieved cached blog', { 
        contentLength: cached.content.length,
        generatedAt: new Date(cached.generatedAt).toISOString()
      }, 'BlogCacheManager');
      
      return cached.content;

    } catch (error) {
      logger.error('Error retrieving cached blog', { error }, 'BlogCacheManager');
      return null;
    }
  }

  /**
   * Cache blog content
   */
  static async cacheBlog(summary: any, content: string): Promise<void> {
    try {
      const cacheKey = this.generateCacheKey(summary);
      const dataHash = this.generateDataHash(summary);
      
      const cachedBlog: CachedBlog = {
        content,
        generatedAt: Date.now(),
        dataHash,
        fileModifiedAt: Date.now(), // In a real app, this would be the actual file modification time
        summary: {
          date: summary.date,
          totalObservations: summary.totalObservations,
          activityLevel: summary.solarActivity?.activityLevel,
        },
        version: this.CACHE_VERSION,
      };

      await AsyncStorage.setItem(cacheKey, JSON.stringify(cachedBlog));
      
      // Store metadata for cache management
      const metadata: CacheMetadata = {
        lastGenerated: cachedBlog.generatedAt,
        dataVersion: dataHash,
        fileSize: content.length,
        checksum: this.simpleHash(content),
      };
      
      const metadataKey = `${this.METADATA_KEY_PREFIX}${this.simpleHash(cacheKey)}`;
      await AsyncStorage.setItem(metadataKey, JSON.stringify(metadata));

      logger.info('Blog cached successfully', { 
        cacheKey,
        contentLength: content.length,
        dataHash 
      }, 'BlogCacheManager');

    } catch (error) {
      logger.error('Error caching blog', { error }, 'BlogCacheManager');
    }
  }

  /**
   * Clear specific cache entry
   */
  static async clearCache(summary: any): Promise<void> {
    try {
      const cacheKey = this.generateCacheKey(summary);
      const metadataKey = `${this.METADATA_KEY_PREFIX}${this.simpleHash(cacheKey)}`;
      
      await AsyncStorage.removeItem(cacheKey);
      await AsyncStorage.removeItem(metadataKey);
      
      logger.info('Cache cleared', { cacheKey }, 'BlogCacheManager');

    } catch (error) {
      logger.error('Error clearing cache', { error }, 'BlogCacheManager');
    }
  }

  /**
   * Clear all blog caches
   */
  static async clearAllCaches(): Promise<void> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const blogCacheKeys = allKeys.filter(key => 
        key.startsWith(this.CACHE_KEY_PREFIX) || 
        key.startsWith(this.METADATA_KEY_PREFIX)
      );
      
      if (blogCacheKeys.length > 0) {
        await AsyncStorage.multiRemove(blogCacheKeys);
        logger.info('All blog caches cleared', { count: blogCacheKeys.length }, 'BlogCacheManager');
      }

    } catch (error) {
      logger.error('Error clearing all caches', { error }, 'BlogCacheManager');
    }
  }

  /**
   * Get cache statistics
   */
  static async getCacheStats(): Promise<{
    totalCaches: number;
    totalSize: number;
    oldestCache: number | null;
    newestCache: number | null;
  }> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const blogCacheKeys = allKeys.filter(key => key.startsWith(this.CACHE_KEY_PREFIX));
      
      let totalSize = 0;
      let oldestCache: number | null = null;
      let newestCache: number | null = null;

      for (const key of blogCacheKeys) {
        const cachedData = await AsyncStorage.getItem(key);
        if (cachedData) {
          const cached: CachedBlog = JSON.parse(cachedData);
          totalSize += cachedData.length;
          
          if (!oldestCache || cached.generatedAt < oldestCache) {
            oldestCache = cached.generatedAt;
          }
          
          if (!newestCache || cached.generatedAt > newestCache) {
            newestCache = cached.generatedAt;
          }
        }
      }

      return {
        totalCaches: blogCacheKeys.length,
        totalSize,
        oldestCache,
        newestCache,
      };

    } catch (error) {
      logger.error('Error getting cache stats', { error }, 'BlogCacheManager');
      return {
        totalCaches: 0,
        totalSize: 0,
        oldestCache: null,
        newestCache: null,
      };
    }
  }

  /**
   * Clean up expired caches
   */
  static async cleanupExpiredCaches(): Promise<number> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const blogCacheKeys = allKeys.filter(key => key.startsWith(this.CACHE_KEY_PREFIX));
      const now = Date.now();
      const maxAge = this.CACHE_EXPIRY_HOURS * 60 * 60 * 1000;
      let cleanedCount = 0;

      for (const key of blogCacheKeys) {
        const cachedData = await AsyncStorage.getItem(key);
        if (cachedData) {
          const cached: CachedBlog = JSON.parse(cachedData);
          const cacheAge = now - cached.generatedAt;
          
          if (cacheAge > maxAge) {
            await AsyncStorage.removeItem(key);
            // Also remove associated metadata
            const metadataKey = `${this.METADATA_KEY_PREFIX}${this.simpleHash(key)}`;
            await AsyncStorage.removeItem(metadataKey);
            cleanedCount++;
          }
        }
      }

      if (cleanedCount > 0) {
        logger.info('Expired caches cleaned up', { count: cleanedCount }, 'BlogCacheManager');
      }

      return cleanedCount;

    } catch (error) {
      logger.error('Error cleaning up expired caches', { error }, 'BlogCacheManager');
      return 0;
    }
  }

  /**
   * Force refresh cache (clear and regenerate)
   */
  static async forceRefresh(summary: any): Promise<void> {
    await this.clearCache(summary);
    logger.info('Cache force refresh initiated', {}, 'BlogCacheManager');
  }
}