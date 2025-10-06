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
import { LineChart } from 'react-native-chart-kit';
import { APP_CONFIG } from '../utils/constants';
import { logger } from '../utils/logger';
import ParticleBackground from '../components/ParticleBackground';

type Props = NativeStackScreenProps<RootStackParamList, 'ScatterGraph'>;

const { width: screenWidth } = Dimensions.get('window');

interface ScatterPoint {
  x: number;
  y: number;
  category: 'normal' | 'anomaly' | 'threshold';
}

export default function ScatterGraphScreen({ navigation }: Props) {
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(50));
  const [selectedComparison, setSelectedComparison] = useState('speed_density');
  const [scatterData, setScatterData] = useState<ScatterPoint[]>([]);
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
        item.proton_bulk_speed !== -1e+31 && 
        item.proton_density !== -1e+31 &&
        item.alpha_bulk_speed !== -1e+31 &&
        item.alpha_density !== -1e+31
      ).slice(0, 100); // Limit for performance

      processScatterData(validData);
      setLoading(false);
      logger.info('Scatter data loaded', { points: validData.length }, 'ScatterGraph');
    } catch (error) {
      logger.error('Failed to load scatter data', { error }, 'ScatterGraph');
      setLoading(false);
    }
  };

  const processScatterData = (data: any[]) => {
    const points: ScatterPoint[] = [];
    
    data.forEach((item: any) => {
      let x: number, y: number;
      
      switch (selectedComparison) {
        case 'speed_density':
          x = item.proton_bulk_speed;
          y = item.proton_density;
          break;
        case 'alpha_proton_speed':
          x = item.proton_bulk_speed;
          y = item.alpha_bulk_speed;
          break;
        case 'alpha_proton_density':
          x = item.proton_density;
          y = item.alpha_density;
          break;
        case 'temp_score':
          x = item.fpga_temp_mon || 0;
          y = item.score || 0;
          break;
        default:
          x = item.proton_bulk_speed;
          y = item.proton_density;
      }
      
      // Categorize points based on anomaly score
      let category: 'normal' | 'anomaly' | 'threshold' = 'normal';
      if (item.score > 0.5) category = 'anomaly';
      else if (item.score > 0.2) category = 'threshold';
      
      points.push({ x, y, category });
    });
    
    setScatterData(points);
  };

  useEffect(() => {
    if (scatterData.length > 0) {
      const jsonData = require('../../final_output_01.json');
      const validData = jsonData.filter((item: any) => 
        item.proton_bulk_speed !== -1e+31 && 
        item.proton_density !== -1e+31 &&
        item.alpha_bulk_speed !== -1e+31 &&
        item.alpha_density !== -1e+31
      ).slice(0, 100);
      
      processScatterData(validData);
    }
  }, [selectedComparison]);

  const getScatterChartData = () => {
    if (scatterData.length === 0) return { labels: [], datasets: [] };

    // Create simplified line chart representation of scatter data
    const sortedData = [...scatterData].sort((a, b) => a.x - b.x);
    const labels = sortedData.slice(0, 10).map((_, index) => `${index + 1}`);
    
    const normalPoints = sortedData.filter(p => p.category === 'normal').slice(0, 10);
    const anomalyPoints = sortedData.filter(p => p.category === 'anomaly').slice(0, 10);
    
    return {
      labels,
      datasets: [
        {
          data: normalPoints.length > 0 ? normalPoints.map(p => p.y) : [0],
          color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`,
          strokeWidth: 2,
        },
        ...(anomalyPoints.length > 0 ? [{
          data: anomalyPoints.map(p => p.y),
          color: (opacity = 1) => `rgba(239, 68, 68, ${opacity})`,
          strokeWidth: 2,
        }] : [])
      ],
      legend: ['Normal', 'Anomaly']
    };
  };

  const getComparisonInfo = () => {
    const info = {
      speed_density: {
        title: 'Speed vs Density',
        xLabel: 'Proton Bulk Speed (km/s)',
        yLabel: 'Proton Density (cm⁻³)',
        description: 'Relationship between solar wind speed and density'
      },
      alpha_proton_speed: {
        title: 'Alpha vs Proton Speed',
        xLabel: 'Proton Speed (km/s)',
        yLabel: 'Alpha Speed (km/s)',
        description: 'Comparison of particle velocities'
      },
      alpha_proton_density: {
        title: 'Alpha vs Proton Density',
        xLabel: 'Proton Density (cm⁻³)',
        yLabel: 'Alpha Density (cm⁻³)',
        description: 'Density relationship between particle types'
      },
      temp_score: {
        title: 'Temperature vs Anomaly Score',
        xLabel: 'FPGA Temperature (°C)',
        yLabel: 'Anomaly Score',
        description: 'Thermal effects on system anomalies'
      }
    };
    return info[selectedComparison as keyof typeof info] || info.speed_density;
  };

  const getScatterStats = () => {
    if (scatterData.length === 0) return null;

    const xValues = scatterData.map(p => p.x);
    const yValues = scatterData.map(p => p.y);
    
    const correlation = calculateCorrelation(xValues, yValues);
    const normalCount = scatterData.filter(p => p.category === 'normal').length;
    const anomalyCount = scatterData.filter(p => p.category === 'anomaly').length;
    const thresholdCount = scatterData.filter(p => p.category === 'threshold').length;

    return {
      correlation,
      normalCount,
      anomalyCount,
      thresholdCount,
      totalPoints: scatterData.length,
      xRange: { min: Math.min(...xValues), max: Math.max(...xValues) },
      yRange: { min: Math.min(...yValues), max: Math.max(...yValues) }
    };
  };

  const calculateCorrelation = (x: number[], y: number[]): number => {
    const n = x.length;
    if (n === 0) return 0;

    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
    const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

    return denominator === 0 ? 0 : numerator / denominator;
  };

  const comparisons = [
    { key: 'speed_density', name: 'Speed vs Density', icon: 'trending-up' },
    { key: 'alpha_proton_speed', name: 'Alpha vs Proton Speed', icon: 'swap-horizontal' },
    { key: 'alpha_proton_density', name: 'Alpha vs Proton Density', icon: 'analytics' },
    { key: 'temp_score', name: 'Temperature vs Score', icon: 'thermometer' }
  ];

  const comparisonInfo = getComparisonInfo();
  const chartData = getScatterChartData();
  const stats = getScatterStats();

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
            <Text style={styles.headerTitle}>Scatter Analysis</Text>
            <Text style={styles.headerSubtitle}>Parameter Relationships</Text>
          </View>
        </Animated.View>

        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Comparison Info */}
          <Animated.View 
            style={[
              styles.infoCard,
              {
                transform: [{ translateY: slideAnim }],
                opacity: fadeAnim,
              }
            ]}
          >
            <View style={styles.infoHeader}>
              <View style={styles.comparisonIcon}>
                <Ionicons name="analytics" size={20} color={APP_CONFIG.colors.info} />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.comparisonTitle}>{comparisonInfo.title}</Text>
                <Text style={styles.comparisonDescription}>{comparisonInfo.description}</Text>
              </View>
            </View>
          </Animated.View>

          {/* Comparison Selector */}
          <Animated.View 
            style={[
              styles.selectorContainer,
              {
                transform: [{ translateY: slideAnim }],
                opacity: fadeAnim,
              }
            ]}
          >
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.selectorScrollContent}
            >
              {comparisons.map((comparison) => (
                <TouchableOpacity
                  key={comparison.key}
                  style={[
                    styles.comparisonButton,
                    selectedComparison === comparison.key && styles.comparisonButtonActive
                  ]}
                  onPress={() => setSelectedComparison(comparison.key)}
                >
                  <Ionicons 
                    name={comparison.icon as any} 
                    size={18} 
                    color={selectedComparison === comparison.key ? APP_CONFIG.colors.secondary : APP_CONFIG.colors.text.secondary} 
                  />
                  <Text style={[
                    styles.comparisonButtonText,
                    selectedComparison === comparison.key && styles.comparisonButtonTextActive
                  ]}>
                    {comparison.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Animated.View>

          {!loading && scatterData.length > 0 ? (
            <>
              {/* Enhanced Statistics */}
              {stats && (
                <Animated.View 
                  style={[
                    styles.statsContainer,
                    {
                      transform: [{ translateY: slideAnim }],
                      opacity: fadeAnim,
                    }
                  ]}
                >
                  <Text style={styles.statsTitle}>Analysis Overview</Text>
                  <View style={styles.statsGrid}>
                    <View style={[styles.statCard, { backgroundColor: `${APP_CONFIG.colors.info}15` }]}>
                      <View style={[styles.statIconContainer, { backgroundColor: APP_CONFIG.colors.info }]}>
                        <Ionicons name="link" size={24} color="white" />
                      </View>
                      <Text style={styles.statLabel}>Correlation</Text>
                      <Text style={[
                        styles.statValue,
                        { color: Math.abs(stats.correlation) > 0.5 ? APP_CONFIG.colors.success : APP_CONFIG.colors.warning }
                      ]}>
                        {stats.correlation > 0 ? '+' : ''}{stats.correlation.toFixed(3)}
                      </Text>
                      <View style={styles.correlationBar}>
                        <View 
                          style={[
                            styles.correlationBarFill,
                            {
                              width: `${Math.abs(stats.correlation) * 100}%`,
                              backgroundColor: Math.abs(stats.correlation) > 0.5 ? APP_CONFIG.colors.success : APP_CONFIG.colors.warning
                            }
                          ]}
                        />
                      </View>
                    </View>
                    
                    <View style={[styles.statCard, { backgroundColor: `${APP_CONFIG.colors.success}15` }]}>
                      <View style={[styles.statIconContainer, { backgroundColor: APP_CONFIG.colors.success }]}>
                        <Ionicons name="checkmark-circle" size={24} color="white" />
                      </View>
                      <Text style={styles.statLabel}>Normal Points</Text>
                      <Text style={styles.statValue}>{stats.normalCount}</Text>
                      <Text style={styles.statPercentage}>
                        {((stats.normalCount / stats.totalPoints) * 100).toFixed(1)}%
                      </Text>
                    </View>
                    
                    <View style={[styles.statCard, { backgroundColor: `${APP_CONFIG.colors.warning}15` }]}>
                      <View style={[styles.statIconContainer, { backgroundColor: APP_CONFIG.colors.warning }]}>
                        <Ionicons name="warning" size={24} color="white" />
                      </View>
                      <Text style={styles.statLabel}>Threshold</Text>
                      <Text style={styles.statValue}>{stats.thresholdCount}</Text>
                      <Text style={styles.statPercentage}>
                        {((stats.thresholdCount / stats.totalPoints) * 100).toFixed(1)}%
                      </Text>
                    </View>
                    
                    <View style={[styles.statCard, { backgroundColor: `${APP_CONFIG.colors.error}15` }]}>
                      <View style={[styles.statIconContainer, { backgroundColor: APP_CONFIG.colors.error }]}>
                        <Ionicons name="alert-circle" size={24} color="white" />
                      </View>
                      <Text style={styles.statLabel}>Anomalies</Text>
                      <Text style={styles.statValue}>{stats.anomalyCount}</Text>
                      <Text style={styles.statPercentage}>
                        {((stats.anomalyCount / stats.totalPoints) * 100).toFixed(1)}%
                      </Text>
                    </View>
                  </View>
                </Animated.View>
              )}

              {/* Chart */}
              <Animated.View 
                style={[
                  styles.chartContainer,
                  {
                    transform: [{ translateY: slideAnim }],
                    opacity: fadeAnim,
                  }
                ]}
              >
                <Text style={styles.chartTitle}>{comparisonInfo.title}</Text>
                <LineChart
                  data={chartData}
                  width={screenWidth - APP_CONFIG.spacing.lg * 2}
                  height={280}
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
                    },
                    propsForBackgroundLines: {
                      strokeDasharray: "5,5",
                      stroke: APP_CONFIG.colors.overlay.dark,
                      strokeWidth: 1
                    }
                  }}
                  style={styles.chart}
                />
                <View style={styles.axisLabels}>
                  <Text style={styles.axisLabel}>X: {comparisonInfo.xLabel}</Text>
                  <Text style={styles.axisLabel}>Y: {comparisonInfo.yLabel}</Text>
                </View>
              </Animated.View>

              {/* Range Information */}
              {stats && (
                <Animated.View 
                  style={[
                    styles.rangeContainer,
                    {
                      transform: [{ translateY: slideAnim }],
                      opacity: fadeAnim,
                    }
                  ]}
                >
                  <Text style={styles.rangeTitle}>Data Ranges</Text>
                  <View style={styles.rangeGrid}>
                    <View style={styles.rangeCard}>
                      <Text style={styles.rangeLabel}>X-Axis Range</Text>
                      <Text style={styles.rangeValue}>
                        {stats.xRange.min.toFixed(2)} - {stats.xRange.max.toFixed(2)}
                      </Text>
                    </View>
                    <View style={styles.rangeCard}>
                      <Text style={styles.rangeLabel}>Y-Axis Range</Text>
                      <Text style={styles.rangeValue}>
                        {stats.yRange.min.toFixed(2)} - {stats.yRange.max.toFixed(2)}
                      </Text>
                    </View>
                  </View>
                </Animated.View>
              )}
            </>
          ) : (
            <View style={styles.loadingContainer}>
              <Ionicons name="analytics" size={48} color={APP_CONFIG.colors.text.secondary} />
              <Text style={styles.loadingText}>
                {loading ? 'Loading scatter data...' : 'No scatter data available'}
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
  infoCard: {
    backgroundColor: APP_CONFIG.colors.secondary,
    borderRadius: APP_CONFIG.borderRadius.xl,
    padding: APP_CONFIG.spacing.md,
    marginBottom: APP_CONFIG.spacing.lg,
    ...APP_CONFIG.shadows.medium,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  comparisonIcon: {
    backgroundColor: APP_CONFIG.colors.overlay.light,
    padding: APP_CONFIG.spacing.sm,
    borderRadius: APP_CONFIG.borderRadius.lg,
    marginRight: APP_CONFIG.spacing.sm,
  },
  infoContent: {
    flex: 1,
  },
  comparisonTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: APP_CONFIG.colors.text.primary,
  },
  comparisonDescription: {
    fontSize: 14,
    color: APP_CONFIG.colors.text.secondary,
    marginTop: 2,
  },
  selectorContainer: {
    marginBottom: APP_CONFIG.spacing.lg,
  },
  selectorScrollContent: {
    paddingRight: APP_CONFIG.spacing.lg,
  },
  comparisonButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: APP_CONFIG.spacing.md,
    paddingVertical: APP_CONFIG.spacing.sm,
    marginRight: APP_CONFIG.spacing.sm,
    borderRadius: APP_CONFIG.borderRadius.lg,
    backgroundColor: APP_CONFIG.colors.secondary,
    borderWidth: 1,
    borderColor: APP_CONFIG.colors.overlay.dark,
  },
  comparisonButtonActive: {
    backgroundColor: APP_CONFIG.colors.text.primary,
    borderColor: APP_CONFIG.colors.text.primary,
  },
  comparisonButtonText: {
    marginLeft: APP_CONFIG.spacing.xs,
    fontSize: 12,
    color: APP_CONFIG.colors.text.secondary,
  },
  comparisonButtonTextActive: {
    color: APP_CONFIG.colors.secondary,
    fontWeight: '600',
  },
  statsContainer: {
    backgroundColor: APP_CONFIG.colors.secondary,
    borderRadius: APP_CONFIG.borderRadius.xl,
    padding: APP_CONFIG.spacing.lg,
    marginBottom: APP_CONFIG.spacing.lg,
    ...APP_CONFIG.shadows.medium,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: APP_CONFIG.colors.text.primary,
    marginBottom: APP_CONFIG.spacing.md,
    textAlign: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    width: (screenWidth - APP_CONFIG.spacing.lg * 2 - APP_CONFIG.spacing.lg * 2 - APP_CONFIG.spacing.sm) / 2,
    borderRadius: APP_CONFIG.borderRadius.xl,
    padding: APP_CONFIG.spacing.md,
    marginBottom: APP_CONFIG.spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: APP_CONFIG.colors.overlay.dark,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: APP_CONFIG.borderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: APP_CONFIG.spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  statLabel: {
    fontSize: 12,
    color: APP_CONFIG.colors.text.secondary,
    marginBottom: APP_CONFIG.spacing.xs,
    textAlign: 'center',
    fontWeight: '600',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: APP_CONFIG.colors.text.primary,
    marginBottom: APP_CONFIG.spacing.xs,
  },
  statPercentage: {
    fontSize: 11,
    color: APP_CONFIG.colors.text.tertiary,
    fontWeight: '600',
  },
  correlationBar: {
    width: '100%',
    height: 4,
    backgroundColor: APP_CONFIG.colors.overlay.dark,
    borderRadius: 2,
    marginTop: APP_CONFIG.spacing.xs,
    overflow: 'hidden',
  },
  correlationBarFill: {
    height: '100%',
    borderRadius: 2,
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
  axisLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: APP_CONFIG.spacing.sm,
  },
  axisLabel: {
    fontSize: 12,
    color: APP_CONFIG.colors.text.secondary,
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
  rangeGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rangeCard: {
    flex: 1,
    backgroundColor: APP_CONFIG.colors.overlay.light,
    borderRadius: APP_CONFIG.borderRadius.lg,
    padding: APP_CONFIG.spacing.sm,
    marginHorizontal: APP_CONFIG.spacing.xs,
    alignItems: 'center',
  },
  rangeLabel: {
    fontSize: 12,
    color: APP_CONFIG.colors.text.secondary,
    marginBottom: APP_CONFIG.spacing.xs,
  },
  rangeValue: {
    fontSize: 14,
    fontWeight: '600',
    color: APP_CONFIG.colors.text.primary,
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