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
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { BarChart, LineChart } from 'react-native-chart-kit';
import { APP_CONFIG } from '../utils/constants';
import { logger } from '../utils/logger';
import ParticleBackground from '../components/ParticleBackground';

type Props = NativeStackScreenProps<RootStackParamList, 'DensityGraph'>;

const { width: screenWidth } = Dimensions.get('window');

interface DensityStats {
  mean: number;
  median: number;
  std: number;
  min: number;
  max: number;
  percentile95: number;
  bins: number[];
  frequencies: number[];
}

const THRESHOLDS = {
  alpha_density: 0.5463787529366685,
  proton_density: 22.915556332558364,
};

export default function DensityGraphScreen({ navigation }: Props) {
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(50));
  const [selectedDensity, setSelectedDensity] = useState<'proton' | 'alpha'>('proton');
  const [protonStats, setProtonStats] = useState<DensityStats | null>(null);
  const [alphaStats, setAlphaStats] = useState<DensityStats | null>(null);
  const [loading, setLoading] = useState(true);

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
      const jsonData = require('../../final_output_01.json');
      
      // Filter valid data points
      const validData = jsonData.filter((item: any) => 
        item.proton_density !== -1e+31 && 
        item.alpha_density !== -1e+31 &&
        item.proton_density > 0 &&
        item.alpha_density > 0
      );

      const protonDensities = validData.map((item: any) => item.proton_density);
      const alphaDensities = validData.map((item: any) => item.alpha_density);

      setProtonStats(calculateStats(protonDensities));
      setAlphaStats(calculateStats(alphaDensities));
      
      setLoading(false);
      logger.info('Density data loaded', { 
        protonPoints: protonDensities.length,
        alphaPoints: alphaDensities.length 
      }, 'DensityGraph');
    } catch (error) {
      logger.error('Failed to load density data', { error }, 'DensityGraph');
      setLoading(false);
    }
  };

  const calculateStats = (data: number[]): DensityStats => {
    const sorted = [...data].sort((a, b) => a - b);
    const n = sorted.length;
    
    const mean = data.reduce((a, b) => a + b, 0) / n;
    const median = n % 2 === 0 ? 
      (sorted[n/2 - 1] + sorted[n/2]) / 2 : 
      sorted[Math.floor(n/2)];
    
    const variance = data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
    const std = Math.sqrt(variance);
    
    const min = Math.min(...data);
    const max = Math.max(...data);
    const percentile95 = sorted[Math.floor(0.95 * n)];
    
    // Create histogram bins
    const numBins = 20;
    const binWidth = (max - min) / numBins;
    const bins: number[] = [];
    const frequencies: number[] = [];
    
    for (let i = 0; i < numBins; i++) {
      const binStart = min + i * binWidth;
      const binEnd = min + (i + 1) * binWidth;
      bins.push(binStart);
      
      const count = data.filter(val => val >= binStart && val < binEnd).length;
      frequencies.push(count);
    }
    
    return { mean, median, std, min, max, percentile95, bins, frequencies };
  };

  const getHistogramData = () => {
    const stats = selectedDensity === 'proton' ? protonStats : alphaStats;
    if (!stats) return { labels: [], datasets: [] };

    const labels = stats.bins.slice(0, 10).map((bin, index) => 
      index % 2 === 0 ? bin.toFixed(1) : ''
    );

    return {
      labels,
      datasets: [{
        data: stats.frequencies.slice(0, 10),
        color: (opacity = 1) => selectedDensity === 'proton' ? 
          `rgba(134, 65, 244, ${opacity})` : 
          `rgba(16, 185, 129, ${opacity})`,
      }]
    };
  };

  const getDistributionData = () => {
    if (!protonStats || !alphaStats) return { labels: [], datasets: [] };

    const labels = Array.from({ length: 20 }, (_, i) => `${i * 5}%`);
    
    // Create cumulative distribution
    const protonCumulative = createCumulativeDistribution(protonStats);
    const alphaCumulative = createCumulativeDistribution(alphaStats);

    return {
      labels: labels.slice(0, 10),
      datasets: [
        {
          data: protonCumulative.slice(0, 10),
          color: (opacity = 1) => `rgba(134, 65, 244, ${opacity})`,
          strokeWidth: 2,
        },
        {
          data: alphaCumulative.slice(0, 10),
          color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`,
          strokeWidth: 2,
        }
      ],
      legend: ['Proton Density', 'Alpha Density']
    };
  };

  const createCumulativeDistribution = (stats: DensityStats): number[] => {
    const cumulative: number[] = [];
    let sum = 0;
    const total = stats.frequencies.reduce((a, b) => a + b, 0);
    
    for (let i = 0; i < Math.min(10, stats.frequencies.length); i++) {
      sum += stats.frequencies[i];
      cumulative.push((sum / total) * 100);
    }
    
    return cumulative;
  };

  const getCurrentStats = () => {
    return selectedDensity === 'proton' ? protonStats : alphaStats;
  };

  const getCurrentThreshold = () => {
    return selectedDensity === 'proton' ? 
      THRESHOLDS.proton_density : 
      THRESHOLDS.alpha_density;
  };

  const densityTypes = [
    { key: 'proton', name: 'Proton Density', color: '#8B5CF6', unit: 'cm⁻³' },
    { key: 'alpha', name: 'Alpha Density', color: '#10B981', unit: 'cm⁻³' }
  ];

  const currentStats = getCurrentStats();
  const currentThreshold = getCurrentThreshold();
  const histogramData = getHistogramData();
  const distributionData = getDistributionData();

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
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={APP_CONFIG.colors.text.primary} />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Density Distribution</Text>
            <Text style={styles.headerSubtitle}>Statistical Analysis</Text>
          </View>
        </Animated.View>

        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Density Type Selector */}
          <Animated.View 
            style={[
              styles.selectorContainer,
              {
                transform: [{ translateY: slideAnim }],
                opacity: fadeAnim,
              }
            ]}
          >
            {densityTypes.map((type) => (
              <TouchableOpacity
                key={type.key}
                style={[
                  styles.densityButton,
                  selectedDensity === type.key && styles.densityButtonActive,
                  { borderColor: type.color }
                ]}
                onPress={() => setSelectedDensity(type.key as any)}
              >
                <View style={[styles.densityIcon, { backgroundColor: type.color }]}>
                  <Ionicons 
                    name="analytics" 
                    size={18} 
                    color="white" 
                  />
                </View>
                <Text style={[
                  styles.densityButtonText,
                  selectedDensity === type.key && { color: type.color }
                ]}>
                  {type.name}
                </Text>
              </TouchableOpacity>
            ))}
          </Animated.View>

          {!loading && currentStats ? (
            <>
              {/* Statistics Overview */}
              <Animated.View 
                style={[
                  styles.statsContainer,
                  {
                    transform: [{ translateY: slideAnim }],
                    opacity: fadeAnim,
                  }
                ]}
              >
                <View style={styles.statsGrid}>
                  <View style={styles.statCard}>
                    <Ionicons name="analytics" size={20} color={APP_CONFIG.colors.info} />
                    <Text style={styles.statLabel}>Mean</Text>
                    <Text style={styles.statValue}>{currentStats.mean.toFixed(3)}</Text>
                    <Text style={styles.statUnit}>cm⁻³</Text>
                  </View>
                  
                  <View style={styles.statCard}>
                    <Ionicons name="remove" size={20} color={APP_CONFIG.colors.success} />
                    <Text style={styles.statLabel}>Median</Text>
                    <Text style={styles.statValue}>{currentStats.median.toFixed(3)}</Text>
                    <Text style={styles.statUnit}>cm⁻³</Text>
                  </View>
                  
                  <View style={styles.statCard}>
                    <Ionicons name="trending-up" size={20} color={APP_CONFIG.colors.warning} />
                    <Text style={styles.statLabel}>Std Dev</Text>
                    <Text style={styles.statValue}>{currentStats.std.toFixed(3)}</Text>
                    <Text style={styles.statUnit}>cm⁻³</Text>
                  </View>
                  
                  <View style={styles.statCard}>
                    <Ionicons name="warning" size={20} color={APP_CONFIG.colors.warning} />
                    <Text style={styles.statLabel}>95th %ile</Text>
                    <Text style={styles.statValue}>{currentStats.percentile95.toFixed(3)}</Text>
                    <Text style={styles.statUnit}>cm⁻³</Text>
                  </View>
                </View>
                
                {/* Threshold Info */}
                <View style={styles.thresholdContainer}>
                  <Ionicons name="flag" size={16} color={APP_CONFIG.colors.warning} />
                  <Text style={styles.thresholdText}>
                    Threshold: {currentThreshold.toFixed(3)} cm⁻³
                  </Text>
                  <Text style={styles.thresholdStatus}>
                    {currentStats.percentile95 > currentThreshold ? 'EXCEEDED' : 'NORMAL'}
                  </Text>
                </View>
              </Animated.View>

              {/* Histogram */}
              <Animated.View 
                style={[
                  styles.chartContainer,
                  {
                    transform: [{ translateY: slideAnim }],
                    opacity: fadeAnim,
                  }
                ]}
              >
                <Text style={styles.chartTitle}>
                  {selectedDensity === 'proton' ? 'Proton' : 'Alpha'} Density Distribution
                </Text>
                <BarChart
                  data={histogramData}
                  width={screenWidth - APP_CONFIG.spacing.lg * 2}
                  height={220}
                  yAxisLabel=""
                  yAxisSuffix=""
                  chartConfig={{
                    backgroundColor: APP_CONFIG.colors.secondary,
                    backgroundGradientFrom: APP_CONFIG.colors.secondary,
                    backgroundGradientTo: APP_CONFIG.colors.secondary,
                    decimalPlaces: 0,
                    color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                    labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                    style: {
                      borderRadius: APP_CONFIG.borderRadius.lg,
                    },
                    propsForBackgroundLines: {
                      strokeDasharray: "5,5",
                      stroke: APP_CONFIG.colors.overlay.dark,
                      strokeWidth: 1
                    }
                  }}
                  style={styles.chart}
                />
              </Animated.View>

              {/* Cumulative Distribution */}
              <Animated.View 
                style={[
                  styles.chartContainer,
                  {
                    transform: [{ translateY: slideAnim }],
                    opacity: fadeAnim,
                  }
                ]}
              >
                <Text style={styles.chartTitle}>Cumulative Distribution Comparison</Text>
                <LineChart
                  data={distributionData}
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
                      r: "3",
                      strokeWidth: "1",
                    },
                    propsForBackgroundLines: {
                      strokeDasharray: "5,5",
                      stroke: APP_CONFIG.colors.overlay.dark,
                      strokeWidth: 1
                    }
                  }}
                  bezier
                  style={styles.chart}
                />
              </Animated.View>

              {/* Range Analysis */}
              <Animated.View 
                style={[
                  styles.rangeContainer,
                  {
                    transform: [{ translateY: slideAnim }],
                    opacity: fadeAnim,
                  }
                ]}
              >
                <Text style={styles.rangeTitle}>Range Analysis</Text>
                <View style={styles.rangeBar}>
                  <View style={styles.rangeLabels}>
                    <Text style={styles.rangeLabel}>Min: {currentStats.min.toFixed(3)}</Text>
                    <Text style={styles.rangeLabel}>Max: {currentStats.max.toFixed(3)}</Text>
                  </View>
                  <View style={styles.rangeVisualization}>
                    <View style={styles.rangeTrack}>
                      <View 
                        style={[
                          styles.rangeThreshold,
                          {
                            left: `${((currentThreshold - currentStats.min) / (currentStats.max - currentStats.min)) * 100}%`
                          }
                        ]}
                      />
                      <View 
                        style={[
                          styles.rangeMean,
                          {
                            left: `${((currentStats.mean - currentStats.min) / (currentStats.max - currentStats.min)) * 100}%`
                          }
                        ]}
                      />
                    </View>
                  </View>
                  <View style={styles.rangeIndicators}>
                    <View style={styles.rangeIndicator}>
                      <View style={[styles.indicatorDot, { backgroundColor: APP_CONFIG.colors.warning }]} />
                      <Text style={styles.indicatorText}>Threshold</Text>
                    </View>
                    <View style={styles.rangeIndicator}>
                      <View style={[styles.indicatorDot, { backgroundColor: APP_CONFIG.colors.info }]} />
                      <Text style={styles.indicatorText}>Mean</Text>
                    </View>
                  </View>
                </View>
              </Animated.View>
            </>
          ) : (
            <View style={styles.loadingContainer}>
              <Ionicons name="bar-chart" size={48} color={APP_CONFIG.colors.text.secondary} />
              <Text style={styles.loadingText}>
                {loading ? 'Calculating distributions...' : 'No density data available'}
              </Text>
            </View>
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
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: APP_CONFIG.colors.text.primary,
  },
  headerSubtitle: {
    fontSize: 14,
    color: APP_CONFIG.colors.text.secondary,
    marginTop: 2,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: APP_CONFIG.spacing.lg,
    paddingBottom: APP_CONFIG.spacing.xl,
  },
  selectorContainer: {
    flexDirection: 'row',
    marginBottom: APP_CONFIG.spacing.lg,
  },
  densityButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: APP_CONFIG.colors.secondary,
    borderRadius: APP_CONFIG.borderRadius.xl,
    padding: APP_CONFIG.spacing.md,
    marginHorizontal: APP_CONFIG.spacing.xs,
    borderWidth: 2,
    ...APP_CONFIG.shadows.light,
  },
  densityButtonActive: {
    backgroundColor: APP_CONFIG.colors.overlay.light,
  },
  densityIcon: {
    width: 36,
    height: 36,
    borderRadius: APP_CONFIG.borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: APP_CONFIG.spacing.sm,
  },
  densityButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: APP_CONFIG.colors.text.secondary,
    flex: 1,
  },
  statsContainer: {
    backgroundColor: APP_CONFIG.colors.secondary,
    borderRadius: APP_CONFIG.borderRadius.xl,
    padding: APP_CONFIG.spacing.md,
    marginBottom: APP_CONFIG.spacing.lg,
    ...APP_CONFIG.shadows.medium,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: APP_CONFIG.spacing.md,
  },
  statCard: {
    width: (screenWidth - APP_CONFIG.spacing.lg * 2 - APP_CONFIG.spacing.md * 2 - APP_CONFIG.spacing.sm) / 2,
    backgroundColor: APP_CONFIG.colors.overlay.light,
    borderRadius: APP_CONFIG.borderRadius.lg,
    padding: APP_CONFIG.spacing.sm,
    marginBottom: APP_CONFIG.spacing.sm,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: APP_CONFIG.colors.text.secondary,
    marginTop: APP_CONFIG.spacing.xs,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: APP_CONFIG.colors.text.primary,
    marginTop: 2,
  },
  statUnit: {
    fontSize: 10,
    color: APP_CONFIG.colors.text.tertiary,
  },
  thresholdContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: APP_CONFIG.colors.overlay.light,
    padding: APP_CONFIG.spacing.sm,
    borderRadius: APP_CONFIG.borderRadius.md,
  },
  thresholdText: {
    fontSize: 14,
    color: APP_CONFIG.colors.text.secondary,
    marginLeft: APP_CONFIG.spacing.xs,
    flex: 1,
  },
  thresholdStatus: {
    fontSize: 12,
    fontWeight: 'bold',
    color: APP_CONFIG.colors.warning,
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
  rangeContainer: {
    backgroundColor: APP_CONFIG.colors.secondary,
    borderRadius: APP_CONFIG.borderRadius.xl,
    padding: APP_CONFIG.spacing.md,
    ...APP_CONFIG.shadows.medium,
  },
  rangeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: APP_CONFIG.colors.text.primary,
    marginBottom: APP_CONFIG.spacing.md,
    textAlign: 'center',
  },
  rangeBar: {},
  rangeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: APP_CONFIG.spacing.sm,
  },
  rangeLabel: {
    fontSize: 12,
    color: APP_CONFIG.colors.text.secondary,
  },
  rangeVisualization: {
    marginBottom: APP_CONFIG.spacing.sm,
  },
  rangeTrack: {
    height: 8,
    backgroundColor: APP_CONFIG.colors.overlay.dark,
    borderRadius: 4,
    position: 'relative',
  },
  rangeThreshold: {
    position: 'absolute',
    top: -2,
    width: 3,
    height: 12,
    backgroundColor: APP_CONFIG.colors.warning,
    borderRadius: 1.5,
  },
  rangeMean: {
    position: 'absolute',
    top: -2,
    width: 3,
    height: 12,
    backgroundColor: APP_CONFIG.colors.info,
    borderRadius: 1.5,
  },
  rangeIndicators: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  rangeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: APP_CONFIG.spacing.md,
  },
  indicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: APP_CONFIG.spacing.xs,
  },
  indicatorText: {
    fontSize: 12,
    color: APP_CONFIG.colors.text.secondary,
  },
  loadingContainer: {
    height: 300,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: APP_CONFIG.colors.text.secondary,
    marginTop: APP_CONFIG.spacing.sm,
  },
});