import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Animated,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { APP_CONFIG } from '../utils/constants';
import { logger } from '../utils/logger';
import ParticleBackground from '../components/ParticleBackground';
import { DataAnalyzer, DailySummary } from '../utils/dataAnalyzer';
import { BlogGenerator, BlogPost } from '../services/blogGenerator';
import { BlogStorage } from '../utils/blogStorage';

type Props = NativeStackScreenProps<RootStackParamList, 'AIBlog'>;

export default function AIBlogScreen({ navigation }: Props) {
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(50));
  const [dailySummary, setDailySummary] = useState<DailySummary | null>(null);
  const [blogPost, setBlogPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [blogExists, setBlogExists] = useState(false);

  useEffect(() => {
    loadData();
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

  const loadData = async () => {
    try {
      setLoading(true);
      const jsonData = require('../../final_output_01.json');
      
      // Generate daily summary
      const summary = DataAnalyzer.generateDailySummary(jsonData);
      setDailySummary(summary);
      
      // Check if blog already exists for today
      const exists = await BlogStorage.blogExists(summary.date);
      setBlogExists(exists);
      
      if (exists) {
        // Load existing blog
        const existingBlog = await BlogStorage.loadBlog(summary.date);
        if (existingBlog) {
          setBlogPost(existingBlog);
          logger.info('Existing blog loaded', { blogId: existingBlog.id }, 'AIBlogScreen');
        }
      } else {
        // Automatically generate new blog
        await autoGenerateBlog(summary);
      }
      
      setLoading(false);
      logger.info('AI Blog data loaded', { summaryDate: summary.date, blogExists: exists }, 'AIBlogScreen');
    } catch (error) {
      logger.error('Failed to load AI blog data', { error }, 'AIBlogScreen');
      setLoading(false);
    }
  };

  const autoGenerateBlog = async (summary: DailySummary) => {
    try {
      setGenerating(true);
      logger.info('Auto-generating blog for today', { date: summary.date }, 'AIBlogScreen');
      
      const generatedBlog = await BlogGenerator.generateBlogFromSummary(summary);
      setBlogPost(generatedBlog);
      setBlogExists(true);
      
      // Save the generated blog
      await BlogStorage.saveBlog(generatedBlog);
      
      logger.info('Blog auto-generated and saved', { blogId: generatedBlog.id }, 'AIBlogScreen');
    } catch (error) {
      logger.error('Failed to auto-generate blog', { error }, 'AIBlogScreen');
      // Don't show error to user for auto-generation
    } finally {
      setGenerating(false);
    }
  };

  const regenerateBlog = async () => {
    if (!dailySummary) return;

    Alert.alert(
      'Regenerate Blog',
      'This will create a new AI analysis and replace the existing one. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Regenerate', 
          style: 'destructive',
          onPress: async () => {
            try {
              setGenerating(true);
              
              // Delete existing blog
              await BlogStorage.deleteBlog(dailySummary.date);
              
              // Generate new blog
              const generatedBlog = await BlogGenerator.generateBlogFromSummary(dailySummary);
              setBlogPost(generatedBlog);
              
              // Save new blog
              await BlogStorage.saveBlog(generatedBlog);
              
              logger.info('Blog regenerated successfully', { blogId: generatedBlog.id }, 'AIBlogScreen');
              
              Alert.alert(
                'Blog Regenerated!',
                'Your new AI analysis is ready.',
                [{ text: 'Great!' }]
              );
            } catch (error) {
              logger.error('Failed to regenerate blog', { error }, 'AIBlogScreen');
              Alert.alert(
                'Regeneration Failed',
                'Unable to regenerate blog. Please try again later.',
                [{ text: 'OK' }]
              );
            } finally {
              setGenerating(false);
            }
          }
        }
      ]
    );
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData(); // This will check for existing blog and auto-generate if needed
    setRefreshing(false);
  };

  const handleBackPress = () => {
    logger.info('Back button pressed', {}, 'AIBlogScreen');
    navigation.goBack();
  };

  const renderDataSummary = () => {
    if (!dailySummary) return null;

    return (
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
            <Ionicons name="analytics" size={24} color={APP_CONFIG.colors.info} />
          </View>
          <View style={styles.summaryContent}>
            <Text style={styles.summaryTitle}>Daily Data Analysis</Text>
            <Text style={styles.summaryDate}>{dailySummary.date}</Text>
          </View>
          <View style={[styles.statusBadge, { 
            backgroundColor: dailySummary.temperatureStatus.status === 'normal' ? 
              APP_CONFIG.colors.success : APP_CONFIG.colors.warning 
          }]}>
            <Text style={styles.statusText}>
              {dailySummary.temperatureStatus.status.toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={styles.summaryGrid}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{dailySummary.dataQuality.completeness.toFixed(1)}%</Text>
            <Text style={styles.summaryLabel}>Data Quality</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{dailySummary.anomalies.total}</Text>
            <Text style={styles.summaryLabel}>Anomalies</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{dailySummary.keyEvents.length}</Text>
            <Text style={styles.summaryLabel}>Key Events</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{(dailySummary.spacecraftStatus.distanceFromEarth / 1000).toFixed(0)}k</Text>
            <Text style={styles.summaryLabel}>Distance (km)</Text>
          </View>
        </View>

        <View style={styles.parametersPreview}>
          <Text style={styles.previewTitle}>Key Parameters</Text>
          {dailySummary.parameters.slice(0, 3).map((param, index) => (
            <View key={index} style={styles.parameterRow}>
              <Text style={styles.parameterName}>
                {param.parameter.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </Text>
              <Text style={styles.parameterValue}>
                {param.mean.toFixed(2)} {param.unit}
              </Text>
              <View style={[styles.trendIndicator, { 
                backgroundColor: param.trendDirection === 'increasing' ? APP_CONFIG.colors.success :
                                param.trendDirection === 'decreasing' ? APP_CONFIG.colors.warning :
                                APP_CONFIG.colors.info
              }]}>
                <Ionicons 
                  name={param.trendDirection === 'increasing' ? 'trending-up' :
                       param.trendDirection === 'decreasing' ? 'trending-down' : 'remove'} 
                  size={12} 
                  color="white" 
                />
              </View>
            </View>
          ))}
        </View>

        {generating && (
          <View style={styles.generatingIndicator}>
            <View style={styles.generateButtonContent}>
              <Ionicons name="hourglass" size={20} color={APP_CONFIG.colors.info} />
              <Text style={styles.generatingText}>Auto-generating AI Analysis...</Text>
            </View>
            <View style={styles.loadingIndicator}>
              <Text style={styles.loadingText}>Using Hugging Face AI Models</Text>
            </View>
          </View>
        )}
        
        {blogExists && !generating && (
          <View style={styles.existingBlogIndicator}>
            <View style={styles.existingBlogContent}>
              <Ionicons name="checkmark-circle" size={20} color={APP_CONFIG.colors.success} />
              <Text style={styles.existingBlogText}>AI Blog Generated & Saved</Text>
            </View>
            <Text style={styles.existingBlogSubtext}>
              Your daily analysis is ready below
            </Text>
          </View>
        )}
      </Animated.View>
    );
  };

  const renderBlogPost = () => {
    if (!blogPost) return null;

    return (
      <Animated.View 
        style={[
          styles.blogCard,
          {
            transform: [{ translateY: slideAnim }],
            opacity: fadeAnim,
          }
        ]}
      >
        <View style={styles.blogHeader}>
          <View style={styles.aiBadge}>
            <Ionicons name="sparkles" size={16} color="white" />
            <Text style={styles.aiBadgeText}>AI Generated</Text>
          </View>
          <Text style={styles.blogTitle}>{blogPost.title}</Text>
          <View style={styles.blogMeta}>
            <View style={styles.metaItem}>
              <Ionicons name="time" size={14} color={APP_CONFIG.colors.text.tertiary} />
              <Text style={styles.metaText}>{blogPost.readingTime} min read</Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="calendar" size={14} color={APP_CONFIG.colors.text.tertiary} />
              <Text style={styles.metaText}>{blogPost.date}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.blogSummary}>{blogPost.summary}</Text>

        <View style={styles.keyInsights}>
          <Text style={styles.insightsTitle}>🔍 AI-Generated Insights</Text>
          {blogPost.keyInsights.map((insight, index) => (
            <View key={index} style={styles.insightItem}>
              <View style={styles.insightBullet}>
                <Text style={styles.insightNumber}>{index + 1}</Text>
              </View>
              <Text style={styles.insightText}>{insight}</Text>
            </View>
          ))}
        </View>

        <ScrollView style={styles.blogContent} nestedScrollEnabled>
          <Text style={styles.blogText}>{blogPost.content}</Text>
        </ScrollView>

        <View style={styles.technicalSummary}>
          <Text style={styles.technicalTitle}>📊 Technical Summary</Text>
          <View style={styles.technicalGrid}>
            <View style={styles.technicalItem}>
              <Text style={styles.technicalLabel}>Parameters Analyzed</Text>
              <Text style={styles.technicalValue}>{blogPost.technicalData.parameters.length}</Text>
            </View>
            <View style={styles.technicalItem}>
              <Text style={styles.technicalLabel}>Data Completeness</Text>
              <Text style={styles.technicalValue}>{blogPost.technicalData.dataQuality.completeness}%</Text>
            </View>
            <View style={styles.technicalItem}>
              <Text style={styles.technicalLabel}>System Status</Text>
              <Text style={styles.technicalValue}>{blogPost.technicalData.temperatureStatus.status}</Text>
            </View>
            <View style={styles.technicalItem}>
              <Text style={styles.technicalLabel}>Solar Activity</Text>
              <Text style={styles.technicalValue}>{blogPost.technicalData.solarWindConditions.protonFlux}</Text>
            </View>
          </View>
        </View>

        <View style={styles.blogTags}>
          {blogPost.tags.map((tag, index) => (
            <View key={index} style={styles.tag}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity 
          style={styles.regenerateButton} 
          onPress={regenerateBlog}
          disabled={generating}
        >
          <Ionicons name="refresh" size={16} color={generating ? APP_CONFIG.colors.text.tertiary : APP_CONFIG.colors.info} />
          <Text style={[styles.regenerateText, generating && { color: APP_CONFIG.colors.text.tertiary }]}>
            {generating ? 'Generating...' : 'Regenerate Analysis'}
          </Text>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <ParticleBackground>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <BlurView intensity={40} tint="dark" style={styles.blurTop} />
        
        {/* Enhanced Header */}
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
            <View style={styles.headerTitleRow}>
              <Text style={styles.headerTitle}>AI Solar Blog</Text>
              <View style={styles.aiIndicator}>
                <Ionicons name="sparkles" size={16} color={APP_CONFIG.colors.warning} />
              </View>
            </View>
            <Text style={styles.headerSubtitle}>Powered by Hugging Face AI</Text>
          </View>
          <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
            <Ionicons name="refresh" size={24} color={APP_CONFIG.colors.text.primary} />
          </TouchableOpacity>
        </Animated.View>

        <ScrollView 
          style={styles.container} 
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <View style={styles.loadingContainer}>
              <Ionicons name="analytics" size={48} color={APP_CONFIG.colors.text.secondary} />
              <Text style={styles.loadingText}>
                {generating ? 'Auto-generating AI blog...' : 'Analyzing 24-hour solar wind data...'}
              </Text>
              {generating && (
                <Text style={styles.loadingSubtext}>
                  This may take a few moments
                </Text>
              )}
            </View>
          ) : (
            <>
              {renderDataSummary()}
              {renderBlogPost()}
            </>
          )}
        </ScrollView>
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
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: APP_CONFIG.colors.text.primary,
    marginRight: APP_CONFIG.spacing.xs,
  },
  aiIndicator: {
    backgroundColor: `${APP_CONFIG.colors.warning}20`,
    padding: 4,
    borderRadius: APP_CONFIG.borderRadius.sm,
  },
  headerSubtitle: {
    fontSize: 14,
    color: APP_CONFIG.colors.text.secondary,
    marginTop: 2,
  },
  refreshButton: {
    padding: APP_CONFIG.spacing.sm,
    borderRadius: APP_CONFIG.borderRadius.md,
    backgroundColor: APP_CONFIG.colors.secondary,
    ...APP_CONFIG.shadows.light,
  },
  container: {
    flex: 1,
  },
  content: {
    padding: APP_CONFIG.spacing.lg,
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
    textAlign: 'center',
  },
  loadingSubtext: {
    fontSize: 14,
    color: APP_CONFIG.colors.text.tertiary,
    marginTop: APP_CONFIG.spacing.xs,
    textAlign: 'center',
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
    backgroundColor: APP_CONFIG.colors.overlay.light,
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
  statusBadge: {
    paddingHorizontal: APP_CONFIG.spacing.sm,
    paddingVertical: APP_CONFIG.spacing.xs,
    borderRadius: APP_CONFIG.borderRadius.md,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    color: 'white',
  },
  summaryGrid: {
    flexDirection: 'row',
    backgroundColor: APP_CONFIG.colors.overlay.light,
    borderRadius: APP_CONFIG.borderRadius.lg,
    padding: APP_CONFIG.spacing.md,
    marginBottom: APP_CONFIG.spacing.md,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '800',
    color: APP_CONFIG.colors.text.primary,
  },
  summaryLabel: {
    fontSize: 11,
    color: APP_CONFIG.colors.text.secondary,
    marginTop: 4,
    fontWeight: '600',
    textAlign: 'center',
  },
  parametersPreview: {
    backgroundColor: APP_CONFIG.colors.overlay.light,
    borderRadius: APP_CONFIG.borderRadius.lg,
    padding: APP_CONFIG.spacing.md,
    marginBottom: APP_CONFIG.spacing.md,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: APP_CONFIG.colors.text.primary,
    marginBottom: APP_CONFIG.spacing.sm,
  },
  parameterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: APP_CONFIG.spacing.xs,
  },
  parameterName: {
    flex: 1,
    fontSize: 14,
    color: APP_CONFIG.colors.text.secondary,
    fontWeight: '600',
  },
  parameterValue: {
    fontSize: 14,
    color: APP_CONFIG.colors.text.primary,
    fontWeight: '700',
    marginRight: APP_CONFIG.spacing.sm,
  },
  trendIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  generateButton: {
    backgroundColor: APP_CONFIG.colors.info,
    borderRadius: APP_CONFIG.borderRadius.lg,
    padding: APP_CONFIG.spacing.md,
    ...APP_CONFIG.shadows.medium,
  },
  generateButtonDisabled: {
    opacity: 0.7,
  },
  generateButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  generateButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: 'white',
    marginLeft: APP_CONFIG.spacing.xs,
  },
  loadingIndicator: {
    marginTop: APP_CONFIG.spacing.xs,
    alignItems: 'center',
  },
  blogCard: {
    backgroundColor: APP_CONFIG.colors.secondary,
    borderRadius: APP_CONFIG.borderRadius.xl,
    padding: APP_CONFIG.spacing.lg,
    borderWidth: 1,
    borderColor: APP_CONFIG.colors.overlay.dark,
    ...APP_CONFIG.shadows.medium,
  },
  blogHeader: {
    marginBottom: APP_CONFIG.spacing.md,
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: APP_CONFIG.colors.info,
    paddingHorizontal: APP_CONFIG.spacing.sm,
    paddingVertical: 4,
    borderRadius: APP_CONFIG.borderRadius.md,
    alignSelf: 'flex-start',
    marginBottom: APP_CONFIG.spacing.sm,
  },
  aiBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: 'white',
    marginLeft: 4,
  },
  blogTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: APP_CONFIG.colors.text.primary,
    lineHeight: 28,
    marginBottom: APP_CONFIG.spacing.sm,
  },
  blogMeta: {
    flexDirection: 'row',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: APP_CONFIG.spacing.md,
  },
  metaText: {
    fontSize: 12,
    color: APP_CONFIG.colors.text.tertiary,
    marginLeft: 4,
  },
  blogSummary: {
    fontSize: 16,
    color: APP_CONFIG.colors.text.secondary,
    lineHeight: 22,
    marginBottom: APP_CONFIG.spacing.lg,
    fontStyle: 'italic',
    backgroundColor: APP_CONFIG.colors.overlay.light,
    padding: APP_CONFIG.spacing.md,
    borderRadius: APP_CONFIG.borderRadius.lg,
  },
  keyInsights: {
    backgroundColor: APP_CONFIG.colors.overlay.light,
    borderRadius: APP_CONFIG.borderRadius.lg,
    padding: APP_CONFIG.spacing.md,
    marginBottom: APP_CONFIG.spacing.lg,
  },
  insightsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: APP_CONFIG.colors.text.primary,
    marginBottom: APP_CONFIG.spacing.sm,
  },
  insightItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: APP_CONFIG.spacing.sm,
  },
  insightBullet: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: APP_CONFIG.colors.info,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: APP_CONFIG.spacing.sm,
  },
  insightNumber: {
    fontSize: 12,
    fontWeight: '700',
    color: 'white',
  },
  insightText: {
    fontSize: 14,
    color: APP_CONFIG.colors.text.secondary,
    flex: 1,
    lineHeight: 20,
  },
  blogContent: {
    maxHeight: 400,
    marginBottom: APP_CONFIG.spacing.lg,
  },
  blogText: {
    fontSize: 15,
    color: APP_CONFIG.colors.text.primary,
    lineHeight: 24,
  },
  technicalSummary: {
    backgroundColor: APP_CONFIG.colors.overlay.light,
    borderRadius: APP_CONFIG.borderRadius.lg,
    padding: APP_CONFIG.spacing.md,
    marginBottom: APP_CONFIG.spacing.lg,
  },
  technicalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: APP_CONFIG.colors.text.primary,
    marginBottom: APP_CONFIG.spacing.sm,
  },
  technicalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  technicalItem: {
    width: '50%',
    marginBottom: APP_CONFIG.spacing.sm,
  },
  technicalLabel: {
    fontSize: 12,
    color: APP_CONFIG.colors.text.secondary,
    fontWeight: '600',
  },
  technicalValue: {
    fontSize: 14,
    color: APP_CONFIG.colors.text.primary,
    fontWeight: '700',
    marginTop: 2,
  },
  blogTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: APP_CONFIG.spacing.md,
  },
  tag: {
    backgroundColor: APP_CONFIG.colors.overlay.light,
    paddingHorizontal: APP_CONFIG.spacing.sm,
    paddingVertical: 4,
    borderRadius: APP_CONFIG.borderRadius.sm,
    marginRight: APP_CONFIG.spacing.xs,
    marginBottom: APP_CONFIG.spacing.xs,
  },
  tagText: {
    fontSize: 12,
    color: APP_CONFIG.colors.text.secondary,
    fontWeight: '600',
  },
  regenerateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: APP_CONFIG.colors.overlay.light,
    paddingVertical: APP_CONFIG.spacing.sm,
    borderRadius: APP_CONFIG.borderRadius.lg,
  },
  regenerateText: {
    fontSize: 14,
    color: APP_CONFIG.colors.info,
    fontWeight: '600',
    marginLeft: APP_CONFIG.spacing.xs,
  },
  generatingIndicator: {
    backgroundColor: APP_CONFIG.colors.overlay.light,
    borderRadius: APP_CONFIG.borderRadius.lg,
    padding: APP_CONFIG.spacing.md,
    borderWidth: 1,
    borderColor: `${APP_CONFIG.colors.info}30`,
  },
  generatingText: {
    fontSize: 16,
    fontWeight: '600',
    color: APP_CONFIG.colors.info,
    marginLeft: APP_CONFIG.spacing.xs,
  },
  existingBlogIndicator: {
    backgroundColor: `${APP_CONFIG.colors.success}15`,
    borderRadius: APP_CONFIG.borderRadius.lg,
    padding: APP_CONFIG.spacing.md,
    borderWidth: 1,
    borderColor: `${APP_CONFIG.colors.success}30`,
  },
  existingBlogContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: APP_CONFIG.spacing.xs,
  },
  existingBlogText: {
    fontSize: 16,
    fontWeight: '600',
    color: APP_CONFIG.colors.success,
    marginLeft: APP_CONFIG.spacing.xs,
  },
  existingBlogSubtext: {
    fontSize: 14,
    color: APP_CONFIG.colors.text.secondary,
    textAlign: 'center',
  },
});