import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Dimensions,
  Animated,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { APP_CONFIG } from '../utils/constants';
import { logger } from '../utils/logger';
import ParticleBackground from '../components/ParticleBackground';

type Props = NativeStackScreenProps<RootStackParamList, 'GraphDashboard'>;

const { width: screenWidth } = Dimensions.get('window');

interface GraphCard {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  screen: keyof RootStackParamList;
  category: 'temporal' | 'correlation' | 'spatial' | 'statistical';
}

const GRAPH_CARDS: GraphCard[] = [
  {
    id: '1',
    title: 'Time Series Analysis',
    description: 'Monitor solar wind parameters over 24-hour periods with partial real-time threshold alerts',
    icon: 'trending-up',
    color: '#8B5CF6',
    screen: 'TimeSeriesGraph',
    category: 'temporal'
  },
  {
    id: '2',
    title: 'Correlation Matrix',
    description: 'Discover hidden relationships between plasma parameters using advanced analytics',
    icon: 'grid',
    color: '#10B981',
    screen: 'CorrelationGraph',
    category: 'correlation'
  },
  {
    id: '3',
    title: '3D Trajectory',
    description: 'Interactive spacecraft position tracking with orbital dynamics visualization',
    icon: 'globe',
    color: '#F59E0B',
    screen: 'TrajectoryGraph',
    category: 'spatial'
  },
  {
    id: '4',
    title: 'Density Distribution',
    description: 'Statistical analysis with histogram distributions and percentile monitoring',
    icon: 'bar-chart',
    color: '#EF4444',
    screen: 'DensityGraph',
    category: 'statistical'
  },
  {
    id: '5',
    title: 'Scatter Analysis',
    description: 'Multi-dimensional parameter relationships with anomaly detection patterns',
    icon: 'analytics',
    color: '#06B6D4',
    screen: 'ScatterGraph',
    category: 'correlation'
  },
  {
    id: '6',
    title: 'Temperature Monitor',
    description: 'Advanced thermal monitoring with predictive health analytics',
    icon: 'thermometer',
    color: '#EC4899',
    screen: 'TemperatureGraph',
    category: 'temporal'
  }
];

const CATEGORIES = [
  { id: 'all', name: 'All Graphs', icon: 'apps' },
  { id: 'temporal', name: 'Time Series', icon: 'time' },
  { id: 'correlation', name: 'Correlations', icon: 'link' },
  { id: 'spatial', name: 'Spatial', icon: 'location' },
  { id: 'statistical', name: 'Statistics', icon: 'stats-chart' }
];

export default function GraphDashboardScreen({ navigation }: Props) {
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(50));
  const [selectedCategory, setSelectedCategory] = useState('all');

  useEffect(() => {
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

  const handleNavigation = (screen: keyof RootStackParamList) => {
    logger.info(`Navigating to ${screen}`, {}, 'GraphDashboard');
    navigation.navigate(screen);
  };

  const filteredGraphs = selectedCategory === 'all' 
    ? GRAPH_CARDS 
    : GRAPH_CARDS.filter(graph => graph.category === selectedCategory);

  const renderGraphCard = (item: GraphCard, index: number) => (
    <Animated.View
      key={item.id}
      style={[
        styles.graphCard,
        {
          transform: [{ translateY: slideAnim }],
          opacity: fadeAnim,
        }
      ]}
    >
      <TouchableOpacity
        style={[styles.cardTouchable, { borderColor: `${item.color}40` }]}
        onPress={() => handleNavigation(item.screen)}
        activeOpacity={0.85}
      >
        {/* Enhanced Gradient Background */}
        <View style={[styles.cardGradient, { 
          backgroundColor: `${item.color}12`,
          borderRadius: APP_CONFIG.borderRadius.xl,
        }]} />
        
        {/* Subtle Pattern Overlay */}
        <View style={styles.cardPattern} />
        
        <View style={styles.cardHeader}>
          <View style={[styles.cardIcon, { 
            backgroundColor: item.color,
            shadowColor: item.color,
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.4,
            shadowRadius: 12,
            elevation: 12,
          }]}>
            <Ionicons name={item.icon as any} size={32} color="white" />
          </View>
          <View style={styles.cardArrow}>
            <View style={[styles.arrowContainer, { 
              backgroundColor: `${item.color}20`,
              borderWidth: 1,
              borderColor: `${item.color}30`,
            }]}>
              <Ionicons name="arrow-forward" size={20} color={item.color} />
            </View>
          </View>
        </View>
        
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <Text style={styles.cardDescription}>{item.description}</Text>
          
          {/* Enhanced Progress Indicator */}
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <Animated.View 
                style={[
                  styles.progressFill, 
                  { 
                    backgroundColor: item.color,
                    width: '85%' // Simulated data completeness
                  }
                ]} 
              />
            </View>
            <Text style={styles.progressText}>85% Complete</Text>
          </View>
        </View>
        
        <View style={styles.cardFooter}>
          <View style={[styles.categoryBadge, { 
            backgroundColor: `${item.color}25`,
            borderWidth: 1,
            borderColor: `${item.color}40`,
          }]}>
            <View style={[styles.categoryDot, { backgroundColor: item.color }]} />
            <Text style={[styles.categoryText, { color: item.color }]}>
              {item.category.toUpperCase()}
            </Text>
          </View>
          <View style={styles.cardStats}>
            <View style={[styles.liveIndicatorSmall, { backgroundColor: APP_CONFIG.colors.success }]} />
            <Text style={styles.statsText}>Live</Text>
            <Ionicons name="chevron-forward" size={16} color={APP_CONFIG.colors.text.tertiary} />
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );

  const renderCategoryButton = (category: any) => (
    <TouchableOpacity
      key={category.id}
      style={[
        styles.categoryButton,
        selectedCategory === category.id && styles.categoryButtonActive
      ]}
      onPress={() => setSelectedCategory(category.id)}
    >
      <View style={[
        styles.categoryIconContainer,
        selectedCategory === category.id && styles.categoryIconActive
      ]}>
        <Ionicons 
          name={category.icon as any} 
          size={18} 
          color={selectedCategory === category.id ? 'white' : APP_CONFIG.colors.text.secondary} 
        />
      </View>
      <Text style={[
        styles.categoryButtonText,
        selectedCategory === category.id && styles.categoryButtonTextActive
      ]}>
        {category.name}
      </Text>
    </TouchableOpacity>
  );

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
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={APP_CONFIG.colors.text.primary} />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <View style={styles.titleContainer}>
              <Text style={styles.headerTitle}>Data Visualizations</Text>
              <View style={styles.liveBadge}>
                <View style={styles.liveIndicator} />
                <Text style={styles.liveText}>LIVE</Text>
              </View>
            </View>
            <Text style={styles.headerSubtitle}>Aditya-L1 Solar Wind Analysis • Partial Real-time Monitoring</Text>
          </View>
          <TouchableOpacity style={styles.infoButton}>
            <Ionicons name="settings-outline" size={24} color={APP_CONFIG.colors.text.primary} />
          </TouchableOpacity>
        </Animated.View>

        {/* Enhanced Stats Overview */}
        <Animated.View 
          style={[
            styles.statsContainer,
            {
              transform: [{ translateY: slideAnim }],
              opacity: fadeAnim,
            }
          ]}
        >
          <View style={styles.statItem}>
            <View style={styles.statIconContainer}>
              <Ionicons name="time" size={20} color={APP_CONFIG.colors.info} />
            </View>
            <Text style={styles.statValue}>24h</Text>
            <Text style={styles.statLabel}>Data Range</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <View style={styles.statIconContainer}>
              <Ionicons name="analytics" size={20} color={APP_CONFIG.colors.success} />
            </View>
            <Text style={styles.statValue}>6</Text>
            <Text style={styles.statLabel}>Graph Types</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <View style={styles.statIconContainer}>
              <Ionicons name="pulse" size={20} color={APP_CONFIG.colors.warning} />
            </View>
            <Text style={styles.statValue}>Live</Text>
            <Text style={styles.statLabel}>Data Status</Text>
          </View>
        </Animated.View>

        {/* Category Filter */}
        <Animated.View 
          style={[
            styles.categoryContainer,
            {
              transform: [{ translateY: slideAnim }],
              opacity: fadeAnim,
            }
          ]}
        >
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryScrollContent}
          >
            {CATEGORIES.map(renderCategoryButton)}
          </ScrollView>
        </Animated.View>

        {/* Graph Cards */}
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.graphGrid}>
            {filteredGraphs.map((item, index) => renderGraphCard(item, index))}
          </View>
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
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: APP_CONFIG.colors.text.primary,
    marginRight: APP_CONFIG.spacing.sm,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: APP_CONFIG.colors.success,
    paddingHorizontal: APP_CONFIG.spacing.xs,
    paddingVertical: 2,
    borderRadius: APP_CONFIG.borderRadius.sm,
  },
  liveIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'white',
    marginRight: 4,
  },
  liveText: {
    fontSize: 10,
    fontWeight: '700',
    color: 'white',
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: APP_CONFIG.colors.text.secondary,
    opacity: 0.8,
  },
  infoButton: {
    padding: APP_CONFIG.spacing.sm,
    borderRadius: APP_CONFIG.borderRadius.md,
    backgroundColor: APP_CONFIG.colors.secondary,
    ...APP_CONFIG.shadows.light,
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: APP_CONFIG.colors.secondary,
    marginHorizontal: APP_CONFIG.spacing.lg,
    marginBottom: APP_CONFIG.spacing.lg,
    borderRadius: APP_CONFIG.borderRadius.xl,
    padding: APP_CONFIG.spacing.lg,
    borderWidth: 1,
    borderColor: APP_CONFIG.colors.overlay.dark,
    ...APP_CONFIG.shadows.medium,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: APP_CONFIG.borderRadius.lg,
    backgroundColor: APP_CONFIG.colors.overlay.light,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: APP_CONFIG.spacing.xs,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: APP_CONFIG.colors.text.primary,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    color: APP_CONFIG.colors.text.secondary,
    fontWeight: '600',
    textAlign: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: APP_CONFIG.colors.overlay.dark,
    marginHorizontal: APP_CONFIG.spacing.md,
  },
  categoryContainer: {
    marginBottom: APP_CONFIG.spacing.lg,
  },
  categoryScrollContent: {
    paddingHorizontal: APP_CONFIG.spacing.lg,
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: APP_CONFIG.spacing.md,
    paddingVertical: APP_CONFIG.spacing.sm,
    marginRight: APP_CONFIG.spacing.sm,
    borderRadius: APP_CONFIG.borderRadius.xl,
    backgroundColor: APP_CONFIG.colors.secondary,
    borderWidth: 1,
    borderColor: APP_CONFIG.colors.overlay.dark,
  },
  categoryButtonActive: {
    backgroundColor: APP_CONFIG.colors.overlay.light,
    borderColor: APP_CONFIG.colors.info,
    shadowColor: APP_CONFIG.colors.info,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  categoryIconContainer: {
    width: 32,
    height: 32,
    borderRadius: APP_CONFIG.borderRadius.lg,
    backgroundColor: APP_CONFIG.colors.overlay.light,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: APP_CONFIG.spacing.xs,
  },
  categoryIconActive: {
    backgroundColor: APP_CONFIG.colors.info,
  },
  categoryButtonText: {
    fontSize: 14,
    color: APP_CONFIG.colors.text.secondary,
    fontWeight: '600',
  },
  categoryButtonTextActive: {
    color: APP_CONFIG.colors.text.primary,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: APP_CONFIG.spacing.lg,
    paddingBottom: APP_CONFIG.spacing.xl,
  },
  graphGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  graphCard: {
    width: (screenWidth - APP_CONFIG.spacing.lg * 2 - APP_CONFIG.spacing.md) / 2,
    marginBottom: APP_CONFIG.spacing.lg,
  },
  cardTouchable: {
    backgroundColor: APP_CONFIG.colors.secondary,
    borderRadius: APP_CONFIG.borderRadius.xl,
    padding: APP_CONFIG.spacing.lg,
    borderWidth: 2,
    position: 'relative',
    overflow: 'hidden',
    ...APP_CONFIG.shadows.medium,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  cardGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  cardPattern: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.03,
    backgroundColor: 'transparent',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: APP_CONFIG.spacing.md,
    zIndex: 1,
  },
  cardIcon: {
    width: 64,
    height: 64,
    borderRadius: APP_CONFIG.borderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  cardArrow: {
    marginTop: APP_CONFIG.spacing.xs,
  },
  arrowContainer: {
    width: 36,
    height: 36,
    borderRadius: APP_CONFIG.borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardContent: {
    zIndex: 1,
    marginBottom: APP_CONFIG.spacing.md,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: APP_CONFIG.colors.text.primary,
    marginBottom: APP_CONFIG.spacing.xs,
    lineHeight: 22,
  },
  cardDescription: {
    fontSize: 13,
    color: APP_CONFIG.colors.text.secondary,
    lineHeight: 18,
    opacity: 0.9,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 1,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: APP_CONFIG.spacing.sm,
    paddingVertical: APP_CONFIG.spacing.xs,
    borderRadius: APP_CONFIG.borderRadius.lg,
  },
  categoryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: APP_CONFIG.spacing.xs,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  cardStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statsText: {
    fontSize: 11,
    color: APP_CONFIG.colors.text.tertiary,
    marginLeft: 4,
    marginRight: 4,
    fontWeight: '600',
  },
  progressContainer: {
    marginTop: APP_CONFIG.spacing.sm,
  },
  progressBar: {
    height: 4,
    backgroundColor: APP_CONFIG.colors.overlay.dark,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 10,
    color: APP_CONFIG.colors.text.tertiary,
    fontWeight: '500',
  },
  liveIndicatorSmall: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 4,
  },
});