import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Animated,
  Dimensions,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LineChart } from 'react-native-chart-kit';
import { APP_CONFIG } from '../utils/constants';
import { logger } from '../utils/logger';
import ParticleBackground from '../components/ParticleBackground';
import VideoPreviewCard from '../components/VideoPreviewCard';
import CacheManager from '../components/CacheManager';
import { SolarObservationAnalyzer, SolarObservationSummary, SolarObservation } from '../utils/solarObservationAnalyzer';
import { BlogGenerator } from '../services/blogGenerator';
import { BlogCacheManager } from '../services/blogCacheManager';

type Props = NativeStackScreenProps<RootStackParamList, 'SolarObservation'>;

const { width: screenWidth } = Dimensions.get('window');

export default function SolarObservationScreen({ navigation }: Props) {
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(50));
  const [solarSummary, setSolarSummary] = useState<SolarObservationSummary | null>(null);
  const [timeSeriesData, setTimeSeriesData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiSummary, setAiSummary] = useState<string>('');
  const [generatingAI, setGeneratingAI] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [blogCached, setBlogCached] = useState(false);
  const [cacheStatus, setCacheStatus] = useState<'checking' | 'valid' | 'invalid' | 'generating'>('checking');
  const [showCacheManager, setShowCacheManager] = useState(false);

  useEffect(() => {
    loadSolarData();
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const loadSolarData = async () => {
    try {
      setLoading(true);
      const solarData: SolarObservation[] = require('../../output/fits_metadata.json');
      
      // Analyze solar observation data
      const summary = SolarObservationAnalyzer.analyzeSolarObservations(solarData);
      setSolarSummary(summary);
      
      // Generate time series data for charts
      const timeSeries = SolarObservationAnalyzer.generateTimeSeriesData(solarData);
      setTimeSeriesData(timeSeries);
      
      // Check cache and generate AI summary
      await loadOrGenerateAISummary(summary);
      
      setLoading(false);
      logger.info('Solar observation data loaded', { 
        observations: summary.totalObservations,
        duration: summary.observationPeriod.durationMinutes 
      }, 'SolarObservation');
    } catch (error) {
      logger.error('Failed to load solar observation data', { error }, 'SolarObservation');
      setLoading(false);
      Alert.alert('Error', 'Failed to load solar observation data');
    }
  };  
  const loadOrGenerateAISummary = async (summary: SolarObservationSummary) => {
    try {
      setCacheStatus('checking');
      
      // Check if we have a valid cached blog
      const isCacheValid = await BlogCacheManager.isCacheValid(summary);
      
      if (isCacheValid) {
        // Load from cache
        const cachedBlog = await BlogCacheManager.getCachedBlog(summary);
        if (cachedBlog) {
          setAiSummary(cachedBlog);
          setBlogCached(true);
          setCacheStatus('valid');
          logger.info('Loaded blog from cache', { 
            contentLength: cachedBlog.length 
          }, 'SolarObservation');
          return;
        }
      }
      
      // Cache is invalid or doesn't exist, generate new blog
      setCacheStatus('generating');
      await generateAISummary(summary);
      
    } catch (error) {
      logger.error('Error in loadOrGenerateAISummary', { error }, 'SolarObservation');
      setCacheStatus('invalid');
      // Fallback to direct generation
      await generateAISummary(summary);
    }
  };

  const generateAISummary = async (summary: SolarObservationSummary) => {
    try {
      setGeneratingAI(true);
      setBlogCached(false);
      
      // Create context for AI summary
      const context = `
Generate a scientific summary of solar observations from Aditya-L1 SUIT instrument:

Observation Details:
- Date: ${summary.date}
- Total Observations: ${summary.totalObservations}
- Duration: ${summary.observationPeriod.durationMinutes} minutes
- Wavelength: ${summary.instrumentData.wavelength}Å (${summary.solarActivity.wavelengthType} spectrum)
- Observation Frequency: ${summary.temporalAnalysis.observationFrequency} per hour
- Solar Activity Level: ${summary.solarActivity.activityLevel}
- Data Quality: ${summary.qualityMetrics.dataCompleteness}% complete

Key Events: ${summary.keyEvents.join(', ')}

Write a professional scientific summary suitable for solar physics researchers.
      `;

      let generatedText = '';

      // Try Hugging Face API with timeout, fallback to local summary
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

        const response = await fetch('https://api-inference.huggingface.co/models/gpt2', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            inputs: context,
            parameters: {
              max_length: 300,
              temperature: 0.7,
              do_sample: true,
              top_p: 0.9
            }
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const result = await response.json();
          generatedText = result[0]?.generated_text || '';
        } else {
          // Fallback summary
          generatedText = SolarObservationAnalyzer.formatSummaryForDisplay(summary);
        }
      } catch (fetchError) {
        // Network error or timeout - use fallback
        logger.warn('AI API failed, using fallback summary', { error: fetchError }, 'SolarObservation');
        generatedText = SolarObservationAnalyzer.formatSummaryForDisplay(summary);
      }

      // Set the generated content
      setAiSummary(generatedText);
      
      // Cache the generated blog
      if (generatedText) {
        await BlogCacheManager.cacheBlog(summary, generatedText);
        setBlogCached(true);
        setCacheStatus('valid');
        logger.info('Blog generated and cached', { 
          contentLength: generatedText.length 
        }, 'SolarObservation');
      }

    } catch (error) {
      logger.error('Failed to generate AI summary', { error }, 'SolarObservation');
      // Use formatted summary as fallback
      const fallbackSummary = SolarObservationAnalyzer.formatSummaryForDisplay(summary);
      setAiSummary(fallbackSummary);
      setCacheStatus('invalid');
    } finally {
      setGeneratingAI(false);
    }
  };

  const handleRefreshBlog = async () => {
    if (!solarSummary) return;
    
    Alert.alert(
      'Refresh Blog',
      'This will generate a new AI summary. The current cached version will be replaced.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Refresh', 
          style: 'default',
          onPress: async () => {
            await BlogCacheManager.forceRefresh(solarSummary);
            await generateAISummary(solarSummary);
          }
        }
      ]
    );
  };

  const getObservationFrequencyChart = () => {
    if (timeSeriesData.length === 0) return { labels: [], datasets: [] };

    const labels = timeSeriesData.slice(0, 10).map((_, index) => `${index * 5}m`);
    const frequencies = timeSeriesData.slice(0, 10).map(item => 60 / (item.timeGap || 1.5));

    return {
      labels,
      datasets: [{
        data: frequencies,
        color: (opacity = 1) => `rgba(134, 65, 244, ${opacity})`,
        strokeWidth: 2,
      }]
    };
  };

  const getExposureTimeChart = () => {
    if (timeSeriesData.length === 0) return { labels: [], datasets: [] };

    const labels = timeSeriesData.slice(0, 10).map((_, index) => `${index + 1}`);
    const exposures = timeSeriesData.slice(0, 10).map(item => item.exposureTime);

    return {
      labels,
      datasets: [{
        data: exposures,
        color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`,
        strokeWidth: 2,
      }]
    };
  };

  const handleBackPress = () => {
    logger.info('Back button pressed', {}, 'SolarObservation');
    navigation.goBack();
  };

  return (
    <ParticleBackground>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <BlurView intensity={40} tint="dark" style={styles.blurTop} />
        
        {/* Header */}
        <Animated.View 
          style={[
            styles.header,
            {
              transform: [{ translateY: slideAnim }],
              opacity: fadeAnim,
            }
          ]}
        >
          <TouchableOpacity style={styles.backButton} onPress={handleBackPress}>
            <Ionicons name="arrow-back" size={24} color={APP_CONFIG.colors.text.primary} />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Solar Observations</Text>
            <Text style={styles.headerSubtitle}>SUIT Instrument • Aditya-L1</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => setShowCacheManager(true)}
            >
              <Ionicons name="server" size={20} color={APP_CONFIG.colors.text.primary} />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.actionButton, videoError && { backgroundColor: APP_CONFIG.colors.error }]}
              onPress={() => {
                if (videoError) {
                  setVideoError(false);
                  setRetryCount(prev => prev + 1);
                } else {
                  Alert.alert(
                    'Video Status',
                    videoError ? 'Video failed to load. Tap to retry.' : 'Video is ready to play.',
                    [{ text: 'OK' }]
                  );
                }
              }}
            >
              <Ionicons 
                name={videoError ? "refresh" : "videocam"} 
                size={20} 
                color={APP_CONFIG.colors.text.primary} 
              />
            </TouchableOpacity>
          </View>
        </Animated.View>

        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <View style={styles.loadingContainer}>
              <Ionicons name="sunny" size={48} color={APP_CONFIG.colors.warning} />
              <Text style={styles.loadingText}>Analyzing solar observations...</Text>
            </View>
          ) : (
            <>
              {/* Solar Summary Card */}
              {solarSummary && (
                <Animated.View 
                  style={[
                    styles.summaryCard,
                    {
                      transform: [{ translateY: slideAnim }],
                      opacity: fadeAnim,
                    }
                  ]}
                >
                  <View style={styles.summaryHeader}>
                    <View style={styles.summaryIcon}>
                      <Ionicons name="sunny" size={24} color={APP_CONFIG.colors.warning} />
                    </View>
                    <View style={styles.summaryContent}>
                      <Text style={styles.summaryTitle}>Solar Observation Summary</Text>
                      <Text style={styles.summaryDate}>{solarSummary.date}</Text>
                    </View>
                    <View style={[
                      styles.activityBadge,
                      { 
                        backgroundColor: solarSummary.solarActivity.activityLevel === 'High' ? 
                          APP_CONFIG.colors.warning : 
                          solarSummary.solarActivity.activityLevel === 'Moderate' ?
                          APP_CONFIG.colors.info : APP_CONFIG.colors.success
                      }
                    ]}>
                      <Text style={styles.activityText}>
                        {solarSummary.solarActivity.activityLevel.toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.summaryStats}>
                    <View style={styles.statItem}>
                      <Text style={styles.statValue}>{solarSummary.totalObservations}</Text>
                      <Text style={styles.statLabel}>Observations</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                      <Text style={styles.statValue}>{solarSummary.observationPeriod.durationMinutes}m</Text>
                      <Text style={styles.statLabel}>Duration</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                      <Text style={styles.statValue}>{solarSummary.instrumentData.wavelength}Å</Text>
                      <Text style={styles.statLabel}>Wavelength</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                      <Text style={styles.statValue}>{solarSummary.qualityMetrics.dataCompleteness}%</Text>
                      <Text style={styles.statLabel}>Quality</Text>
                    </View>
                  </View>
                </Animated.View>
              )}

              {/* Enhanced Video Section */}
              <Animated.View 
                style={[
                  {
                    transform: [{ translateY: slideAnim }],
                    opacity: fadeAnim,
                  }
                ]}
              >
                <VideoPreviewCard
                  title="24-Hour Solar Observation"
                  subtitle={solarSummary ? `${solarSummary.totalObservations} frames • ${solarSummary.observationPeriod.durationMinutes} minutes` : 'Loading...'}
                  duration="24:00:00"
                  frameCount={solarSummary?.totalObservations || 1440}
                  onPlayPress={() => {
                    logger.info('Video play requested', {}, 'SolarObservation');
                    setVideoError(false);
                  }}
                  onInfoPress={() => {
                    logger.info('Video info requested', {}, 'SolarObservation');
                  }}
                />
              </Animated.View> 
             {/* Observation Frequency Chart */}
              <Animated.View 
                style={[
                  styles.chartContainer,
                  {
                    transform: [{ translateY: slideAnim }],
                    opacity: fadeAnim,
                  }
                ]}
              >
                <Text style={styles.chartTitle}>Observation Frequency</Text>
                <LineChart
                  data={getObservationFrequencyChart()}
                  width={screenWidth - APP_CONFIG.spacing.lg * 2}
                  height={220}
                  chartConfig={{
                    backgroundColor: APP_CONFIG.colors.secondary,
                    backgroundGradientFrom: APP_CONFIG.colors.secondary,
                    backgroundGradientTo: APP_CONFIG.colors.secondary,
                    decimalPlaces: 1,
                    color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                    labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                    style: {
                      borderRadius: APP_CONFIG.borderRadius.lg,
                    },
                    propsForDots: {
                      r: "4",
                      strokeWidth: "2",
                    }
                  }}
                  bezier
                  style={styles.chart}
                />
              </Animated.View>

              {/* Exposure Time Chart */}
              <Animated.View 
                style={[
                  styles.chartContainer,
                  {
                    transform: [{ translateY: slideAnim }],
                    opacity: fadeAnim,
                  }
                ]}
              >
                <Text style={styles.chartTitle}>Exposure Time Consistency</Text>
                <LineChart
                  data={getExposureTimeChart()}
                  width={screenWidth - APP_CONFIG.spacing.lg * 2}
                  height={220}
                  chartConfig={{
                    backgroundColor: APP_CONFIG.colors.secondary,
                    backgroundGradientFrom: APP_CONFIG.colors.secondary,
                    backgroundGradientTo: APP_CONFIG.colors.secondary,
                    decimalPlaces: 2,
                    color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                    labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                    style: {
                      borderRadius: APP_CONFIG.borderRadius.lg,
                    },
                    propsForDots: {
                      r: "4",
                      strokeWidth: "2",
                    }
                  }}
                  bezier
                  style={styles.chart}
                />
              </Animated.View>

              {/* Enhanced AI Summary with Cache Status */}
              <Animated.View 
                style={[
                  styles.aiSummaryCard,
                  {
                    transform: [{ translateY: slideAnim }],
                    opacity: fadeAnim,
                  }
                ]}
              >
                <View style={styles.aiHeader}>
                  <View style={styles.aiIcon}>
                    <Ionicons name="sparkles" size={20} color={APP_CONFIG.colors.info} />
                  </View>
                  <View style={styles.aiTitleContainer}>
                    <Text style={styles.aiTitle}>AI Analysis Summary</Text>
                    <View style={styles.cacheStatusContainer}>
                      {blogCached && (
                        <View style={styles.cacheIndicator}>
                          <Ionicons name="checkmark-circle" size={12} color={APP_CONFIG.colors.success} />
                          <Text style={styles.cacheText}>Cached</Text>
                        </View>
                      )}
                      {cacheStatus === 'checking' && (
                        <View style={styles.cacheIndicator}>
                          <Ionicons name="time" size={12} color={APP_CONFIG.colors.warning} />
                          <Text style={styles.cacheText}>Checking...</Text>
                        </View>
                      )}
                      {cacheStatus === 'generating' && (
                        <View style={styles.cacheIndicator}>
                          <Ionicons name="hourglass" size={12} color={APP_CONFIG.colors.info} />
                          <Text style={styles.cacheText}>Generating...</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <View style={styles.aiActions}>
                    {generatingAI && (
                      <View style={styles.generatingIndicator}>
                        <Ionicons name="hourglass" size={16} color={APP_CONFIG.colors.warning} />
                      </View>
                    )}
                    {!generatingAI && aiSummary && (
                      <TouchableOpacity 
                        style={styles.refreshButton}
                        onPress={handleRefreshBlog}
                      >
                        <Ionicons name="refresh" size={16} color={APP_CONFIG.colors.text.secondary} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
                
                <ScrollView style={styles.aiContent} nestedScrollEnabled>
                  <Text style={styles.aiText}>
                    {generatingAI ? 'Generating AI analysis...' : 
                     cacheStatus === 'checking' ? 'Checking for cached content...' :
                     aiSummary || 'No summary available'}
                  </Text>
                </ScrollView>
                
                {/* Cache Information Footer */}
                {blogCached && !generatingAI && (
                  <View style={styles.cacheFooter}>
                    <Ionicons name="information-circle" size={14} color={APP_CONFIG.colors.text.tertiary} />
                    <Text style={styles.cacheFooterText}>
                      This analysis is cached and will be updated when new data is available.
                    </Text>
                  </View>
                )}
              </Animated.View>

              {/* Key Events */}
              {solarSummary && solarSummary.keyEvents.length > 0 && (
                <Animated.View 
                  style={[
                    styles.eventsCard,
                    {
                      transform: [{ translateY: slideAnim }],
                      opacity: fadeAnim,
                    }
                  ]}
                >
                  <Text style={styles.eventsTitle}>Key Observation Events</Text>
                  {solarSummary.keyEvents.map((event, index) => (
                    <View key={index} style={styles.eventItem}>
                      <View style={styles.eventBullet}>
                        <Text style={styles.eventNumber}>{index + 1}</Text>
                      </View>
                      <Text style={styles.eventText}>{event}</Text>
                    </View>
                  ))}
                </Animated.View>
              )}
            </>
          )}
        </ScrollView>

        {/* Cache Manager Modal */}
        <CacheManager
          visible={showCacheManager}
          onClose={() => setShowCacheManager(false)}
        />
      </SafeAreaView>
    </ParticleBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  blurTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 30,
    zIndex: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: APP_CONFIG.spacing.lg,
    paddingVertical: APP_CONFIG.spacing.md,
  },
  backButton: {
    padding: APP_CONFIG.spacing.sm,
    borderRadius: APP_CONFIG.borderRadius.md,
    backgroundColor: APP_CONFIG.colors.secondary,
    ...APP_CONFIG.shadows.light,
  },
  headerContent: {
    flex: 1,
    marginLeft: APP_CONFIG.spacing.md,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: APP_CONFIG.colors.text.primary,
  },
  headerSubtitle: {
    fontSize: 14,
    color: APP_CONFIG.colors.text.secondary,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    padding: APP_CONFIG.spacing.sm,
    borderRadius: APP_CONFIG.borderRadius.md,
    backgroundColor: APP_CONFIG.colors.secondary,
    marginLeft: APP_CONFIG.spacing.xs,
    ...APP_CONFIG.shadows.light,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: APP_CONFIG.spacing.lg,
    paddingBottom: APP_CONFIG.spacing.xl,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 300,
  },
  loadingText: {
    fontSize: 16,
    color: APP_CONFIG.colors.text.secondary,
    marginTop: APP_CONFIG.spacing.sm,
  },
  summaryCard: {
    backgroundColor: APP_CONFIG.colors.secondary,
    borderRadius: APP_CONFIG.borderRadius.xl,
    padding: APP_CONFIG.spacing.lg,
    marginBottom: APP_CONFIG.spacing.lg,
    borderWidth: 1,
    borderColor: APP_CONFIG.colors.overlay.dark,
    ...APP_CONFIG.shadows.medium,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: APP_CONFIG.spacing.md,
  },
  summaryIcon: {
    width: 48,
    height: 48,
    borderRadius: APP_CONFIG.borderRadius.xl,
    backgroundColor: `${APP_CONFIG.colors.warning}20`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: APP_CONFIG.spacing.md,
  },
  summaryContent: {
    flex: 1,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: APP_CONFIG.colors.text.primary,
  },
  summaryDate: {
    fontSize: 14,
    color: APP_CONFIG.colors.text.secondary,
    marginTop: 2,
  },
  activityBadge: {
    paddingHorizontal: APP_CONFIG.spacing.sm,
    paddingVertical: APP_CONFIG.spacing.xs,
    borderRadius: APP_CONFIG.borderRadius.md,
  },
  activityText: {
    fontSize: 12,
    fontWeight: '700',
    color: 'white',
  },
  summaryStats: {
    flexDirection: 'row',
    backgroundColor: APP_CONFIG.colors.overlay.light,
    borderRadius: APP_CONFIG.borderRadius.lg,
    padding: APP_CONFIG.spacing.md,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: APP_CONFIG.colors.text.primary,
  },
  statLabel: {
    fontSize: 11,
    color: APP_CONFIG.colors.text.secondary,
    marginTop: 4,
    fontWeight: '600',
    textAlign: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: APP_CONFIG.colors.overlay.dark,
    marginHorizontal: APP_CONFIG.spacing.md,
  },

  chartContainer: {
    backgroundColor: APP_CONFIG.colors.secondary,
    borderRadius: APP_CONFIG.borderRadius.xl,
    padding: APP_CONFIG.spacing.md,
    marginBottom: APP_CONFIG.spacing.lg,
    ...APP_CONFIG.shadows.medium,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: APP_CONFIG.colors.text.primary,
    marginBottom: APP_CONFIG.spacing.sm,
    textAlign: 'center',
  },
  chart: {
    borderRadius: APP_CONFIG.borderRadius.lg,
  },
  aiSummaryCard: {
    backgroundColor: APP_CONFIG.colors.secondary,
    borderRadius: APP_CONFIG.borderRadius.xl,
    padding: APP_CONFIG.spacing.lg,
    marginBottom: APP_CONFIG.spacing.lg,
    borderWidth: 1,
    borderColor: `${APP_CONFIG.colors.info}30`,
    ...APP_CONFIG.shadows.medium,
  },
  aiHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: APP_CONFIG.spacing.md,
  },
  aiIcon: {
    width: 40,
    height: 40,
    borderRadius: APP_CONFIG.borderRadius.lg,
    backgroundColor: `${APP_CONFIG.colors.info}20`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: APP_CONFIG.spacing.sm,
  },
  aiTitleContainer: {
    flex: 1,
  },
  aiTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: APP_CONFIG.colors.text.primary,
    marginBottom: 4,
  },
  cacheStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cacheIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: APP_CONFIG.colors.overlay.light,
    paddingHorizontal: APP_CONFIG.spacing.xs,
    paddingVertical: 2,
    borderRadius: APP_CONFIG.borderRadius.sm,
  },
  cacheText: {
    fontSize: 10,
    color: APP_CONFIG.colors.text.secondary,
    marginLeft: 4,
    fontWeight: '600',
  },
  aiActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  generatingIndicator: {
    padding: 4,
  },
  refreshButton: {
    padding: APP_CONFIG.spacing.xs,
    borderRadius: APP_CONFIG.borderRadius.sm,
    backgroundColor: APP_CONFIG.colors.overlay.light,
  },
  aiContent: {
    maxHeight: 300,
  },
  aiText: {
    fontSize: 14,
    color: APP_CONFIG.colors.text.secondary,
    lineHeight: 20,
  },
  cacheFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: APP_CONFIG.spacing.sm,
    paddingTop: APP_CONFIG.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: APP_CONFIG.colors.overlay.dark,
  },
  cacheFooterText: {
    fontSize: 11,
    color: APP_CONFIG.colors.text.tertiary,
    marginLeft: APP_CONFIG.spacing.xs,
    flex: 1,
    lineHeight: 16,
  },
  eventsCard: {
    backgroundColor: APP_CONFIG.colors.secondary,
    borderRadius: APP_CONFIG.borderRadius.xl,
    padding: APP_CONFIG.spacing.lg,
    ...APP_CONFIG.shadows.medium,
  },
  eventsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: APP_CONFIG.colors.text.primary,
    marginBottom: APP_CONFIG.spacing.md,
  },
  eventItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: APP_CONFIG.spacing.sm,
  },
  eventBullet: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: APP_CONFIG.colors.warning,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: APP_CONFIG.spacing.sm,
  },
  eventNumber: {
    fontSize: 12,
    fontWeight: '700',
    color: 'white',
  },
  eventText: {
    fontSize: 14,
    color: APP_CONFIG.colors.text.secondary,
    flex: 1,
    lineHeight: 20,
  },
});