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

type Props = NativeStackScreenProps<RootStackParamList, 'TemperatureGraph'>;

const { width: screenWidth } = Dimensions.get('window');

interface TemperatureData {
  time: number;
  fpga_temp: number;
  temp_flag: boolean;
  score: number;
}

const TEMPERATURE_THRESHOLDS = {
  normal: { min: 1700, max: 1800 },
  warning: { min: 1800, max: 1900 },
  critical: { min: 1900, max: 2000 }
};

export default function TemperatureGraphScreen({ navigation }: Props) {
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(50));
  const [temperatureData, setTemperatureData] = useState<TemperatureData[]>([]);
  const [selectedTimeRange, setSelectedTimeRange] = useState<'1h' | '6h' | '24h'>('24h');
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
      
      // Process temperature data
      const tempData: TemperatureData[] = jsonData
        .map((item: any, index: number) => ({
          time: index,
          fpga_temp: item.fpga_temp_mon || 0,
          temp_flag: item.temp_flag || false,
          score: item.score || 0
        }))
        .filter((item: TemperatureData) => item.fpga_temp > 0);

      setTemperatureData(tempData);
      setLoading(false);
      logger.info('Temperature data loaded', { points: tempData.length }, 'TemperatureGraph');
    } catch (error) {
      logger.error('Failed to load temperature data', { error }, 'TemperatureGraph');
      setLoading(false);
    }
  };

  const getFilteredData = () => {
    if (temperatureData.length === 0) return [];
    
    const totalPoints = temperatureData.length;
    let sampleRate: number;
    
    switch (selectedTimeRange) {
      case '1h':
        sampleRate = Math.max(1, Math.floor(totalPoints / 60)); // ~60 points for 1 hour
        break;
      case '6h':
        sampleRate = Math.max(1, Math.floor(totalPoints / 120)); // ~120 points for 6 hours
        break;
      case '24h':
      default:
        sampleRate = Math.max(1, Math.floor(totalPoints / 100)); // ~100 points for 24 hours
        break;
    }
    
    return temperatureData.filter((_, index) => index % sampleRate === 0);
  };

  const getChartData = () => {
    const filteredData = getFilteredData();
    if (filteredData.length === 0) return { labels: [], datasets: [] };

    const labels = filteredData.map((_, index) => {
      const hours = Math.floor((index * getTimeMultiplier()) / 60);
      const minutes = (index * getTimeMultiplier()) % 60;
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }).slice(0, 8); // Show fewer labels for clarity

    const temperatures = filteredData.map(item => item.fpga_temp);
    const anomalyScores = filteredData.map(item => item.score * 2000); // Scale for visibility

    return {
      labels,
      datasets: [
        {
          data: temperatures,
          color: (opacity = 1) => `rgba(239, 68, 68, ${opacity})`,
          strokeWidth: 2,
        },
        {
          data: anomalyScores,
          color: (opacity = 1) => `rgba(134, 65, 244, ${opacity})`,
          strokeWidth: 1,
          withDots: false,
        }
      ],
      legend: ['FPGA Temperature (°C)', 'Anomaly Score (scaled)']
    };
  };

  const getTimeMultiplier = (): number => {
    switch (selectedTimeRange) {
      case '1h': return 1;
      case '6h': return 6;
      case '24h': return 24;
      default: return 24;
    }
  };

  const getTemperatureStats = () => {
    const filteredData = getFilteredData();
    if (filteredData.length === 0) return null;

    const temperatures = filteredData.map(item => item.fpga_temp);
    const flaggedCount = filteredData.filter(item => item.temp_flag).length;
    
    const min = Math.min(...temperatures);
    const max = Math.max(...temperatures);
    const avg = temperatures.reduce((a, b) => a + b, 0) / temperatures.length;
    const current = temperatures[temperatures.length - 1];
    
    // Categorize current temperature
    let status: 'normal' | 'warning' | 'critical';
    if (current >= TEMPERATURE_THRESHOLDS.critical.min) status = 'critical';
    else if (current >= TEMPERATURE_THRESHOLDS.warning.min) status = 'warning';
    else status = 'normal';

    // Count temperature ranges
    const normalCount = temperatures.filter(t => 
      t >= TEMPERATURE_THRESHOLDS.normal.min && t < TEMPERATURE_THRESHOLDS.warning.min
    ).length;
    const warningCount = temperatures.filter(t => 
      t >= TEMPERATURE_THRESHOLDS.warning.min && t < TEMPERATURE_THRESHOLDS.critical.min
    ).length;
    const criticalCount = temperatures.filter(t => 
      t >= TEMPERATURE_THRESHOLDS.critical.min
    ).length;

    return {
      min, max, avg, current, status, flaggedCount,
      normalCount, warningCount, criticalCount,
      totalReadings: temperatures.length
    };
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'normal': return APP_CONFIG.colors.success;
      case 'warning': return APP_CONFIG.colors.warning;
      case 'critical': return APP_CONFIG.colors.warning;
      default: return APP_CONFIG.colors.text.secondary;
    }
  };

  const timeRanges = [
    { key: '1h', name: '1 Hour', icon: 'time' },
    { key: '6h', name: '6 Hours', icon: 'hourglass' },
    { key: '24h', name: '24 Hours', icon: 'calendar' }
  ];

  const chartData = getChartData();
  const stats = getTemperatureStats();

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
            <Text style={styles.headerTitle}>Temperature Monitor</Text>
            <Text style={styles.headerSubtitle}>Thermal System Health</Text>
          </View>
        </Animated.View>

        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Current Status */}
          {stats && (
            <Animated.View 
              style={[
                styles.statusCard,
                {
                  transform: [{ translateY: slideAnim }],
                  opacity: fadeAnim,
                }
              ]}
            >
              <View style={styles.statusHeader}>
                <View style={[styles.statusIcon, { backgroundColor: getStatusColor(stats.status) }]}>
                  <Ionicons name="thermometer" size={24} color="white" />
                </View>
                <View style={styles.statusContent}>
                  <Text style={styles.statusTitle}>Current Temperature</Text>
                  <Text style={styles.statusValue}>{stats.current.toFixed(1)}°C</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(stats.status) }]}>
                  <Text style={styles.statusText}>{stats.status.toUpperCase()}</Text>
                </View>
              </View>
              
              {stats.flaggedCount > 0 && (
                <View style={styles.alertContainer}>
                  <Ionicons name="warning" size={16} color={APP_CONFIG.colors.warning} />
                  <Text style={styles.alertText}>
                    {stats.flaggedCount} temperature alerts in selected range
                  </Text>
                </View>
              )}
            </Animated.View>
          )}

          {/* Time Range Selector */}
          <Animated.View 
            style={[
              styles.selectorContainer,
              {
                transform: [{ translateY: slideAnim }],
                opacity: fadeAnim,
              }
            ]}
          >
            {timeRanges.map((range) => (
              <TouchableOpacity
                key={range.key}
                style={[
                  styles.rangeButton,
                  selectedTimeRange === range.key && styles.rangeButtonActive
                ]}
                onPress={() => setSelectedTimeRange(range.key as any)}
              >
                <Ionicons 
                  name={range.icon as any} 
                  size={18} 
                  color={selectedTimeRange === range.key ? APP_CONFIG.colors.secondary : APP_CONFIG.colors.text.secondary} 
                />
                <Text style={[
                  styles.rangeButtonText,
                  selectedTimeRange === range.key && styles.rangeButtonTextActive
                ]}>
                  {range.name}
                </Text>
              </TouchableOpacity>
            ))}
          </Animated.View>

          {!loading && temperatureData.length > 0 ? (
            <>
              {/* Temperature Chart */}
              <Animated.View 
                style={[
                  styles.chartContainer,
                  {
                    transform: [{ translateY: slideAnim }],
                    opacity: fadeAnim,
                  }
                ]}
              >
                <Text style={styles.chartTitle}>FPGA Temperature Trend</Text>
                <LineChart
                  data={chartData}
                  width={screenWidth - APP_CONFIG.spacing.lg * 2}
                  height={280}
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
                
                {/* Temperature Thresholds */}
                <View style={styles.thresholdContainer}>
                  <View style={styles.thresholdItem}>
                    <View style={[styles.thresholdDot, { backgroundColor: APP_CONFIG.colors.success }]} />
                    <Text style={styles.thresholdText}>Normal: {TEMPERATURE_THRESHOLDS.normal.min}-{TEMPERATURE_THRESHOLDS.normal.max}°C</Text>
                  </View>
                  <View style={styles.thresholdItem}>
                    <View style={[styles.thresholdDot, { backgroundColor: APP_CONFIG.colors.warning }]} />
                    <Text style={styles.thresholdText}>Warning: {TEMPERATURE_THRESHOLDS.warning.min}-{TEMPERATURE_THRESHOLDS.warning.max}°C</Text>
                  </View>
                  <View style={styles.thresholdItem}>
                    <View style={[styles.thresholdDot, { backgroundColor: APP_CONFIG.colors.warning }]} />
                    <Text style={styles.thresholdText}>Critical: &gt;{TEMPERATURE_THRESHOLDS.critical.min}°C</Text>
                  </View>
                </View>
              </Animated.View>

              {/* Statistics */}
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
                  <View style={styles.statsGrid}>
                    <View style={styles.statCard}>
                      <Ionicons name="thermometer-outline" size={20} color={APP_CONFIG.colors.info} />
                      <Text style={styles.statLabel}>Average</Text>
                      <Text style={styles.statValue}>{stats.avg.toFixed(1)}°C</Text>
                    </View>
                    
                    <View style={styles.statCard}>
                      <Ionicons name="arrow-down" size={20} color={APP_CONFIG.colors.success} />
                      <Text style={styles.statLabel}>Minimum</Text>
                      <Text style={styles.statValue}>{stats.min.toFixed(1)}°C</Text>
                    </View>
                    
                    <View style={styles.statCard}>
                      <Ionicons name="arrow-up" size={20} color={APP_CONFIG.colors.warning} />
                      <Text style={styles.statLabel}>Maximum</Text>
                      <Text style={styles.statValue}>{stats.max.toFixed(1)}°C</Text>
                    </View>
                    
                    <View style={styles.statCard}>
                      <Ionicons name="pulse" size={20} color={APP_CONFIG.colors.warning} />
                      <Text style={styles.statLabel}>Readings</Text>
                      <Text style={styles.statValue}>{stats.totalReadings}</Text>
                    </View>
                  </View>
                </Animated.View>
              )}

              {/* Temperature Distribution */}
              {stats && (
                <Animated.View 
                  style={[
                    styles.distributionContainer,
                    {
                      transform: [{ translateY: slideAnim }],
                      opacity: fadeAnim,
                    }
                  ]}
                >
                  <Text style={styles.distributionTitle}>Temperature Distribution</Text>
                  <View style={styles.distributionGrid}>
                    <View style={[styles.distributionCard, { borderLeftColor: APP_CONFIG.colors.success }]}>
                      <Text style={styles.distributionLabel}>Normal Range</Text>
                      <Text style={styles.distributionValue}>{stats.normalCount}</Text>
                      <Text style={styles.distributionPercent}>
                        {((stats.normalCount / stats.totalReadings) * 100).toFixed(1)}%
                      </Text>
                    </View>
                    
                    <View style={[styles.distributionCard, { borderLeftColor: APP_CONFIG.colors.warning }]}>
                      <Text style={styles.distributionLabel}>Warning Range</Text>
                      <Text style={styles.distributionValue}>{stats.warningCount}</Text>
                      <Text style={styles.distributionPercent}>
                        {((stats.warningCount / stats.totalReadings) * 100).toFixed(1)}%
                      </Text>
                    </View>
                    
                    <View style={[styles.distributionCard, { borderLeftColor: APP_CONFIG.colors.warning }]}>
                      <Text style={styles.distributionLabel}>Critical Range</Text>
                      <Text style={styles.distributionValue}>{stats.criticalCount}</Text>
                      <Text style={styles.distributionPercent}>
                        {((stats.criticalCount / stats.totalReadings) * 100).toFixed(1)}%
                      </Text>
                    </View>
                  </View>
                </Animated.View>
              )}
            </>
          ) : (
            <View style={styles.loadingContainer}>
              <Ionicons name="thermometer" size={48} color={APP_CONFIG.colors.text.secondary} />
              <Text style={styles.loadingText}>
                {loading ? 'Loading temperature data...' : 'No temperature data available'}
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
  statusCard: {
    backgroundColor: APP_CONFIG.colors.secondary,
    borderRadius: APP_CONFIG.borderRadius.xl,
    padding: APP_CONFIG.spacing.md,
    marginBottom: APP_CONFIG.spacing.lg,
    ...APP_CONFIG.shadows.medium,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: APP_CONFIG.spacing.sm,
  },
  statusIcon: {
    width: 48,
    height: 48,
    borderRadius: APP_CONFIG.borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: APP_CONFIG.spacing.sm,
  },
  statusContent: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 16,
    color: APP_CONFIG.colors.text.secondary,
  },
  statusValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: APP_CONFIG.colors.text.primary,
  },
  statusBadge: {
    paddingHorizontal: APP_CONFIG.spacing.sm,
    paddingVertical: APP_CONFIG.spacing.xs,
    borderRadius: APP_CONFIG.borderRadius.md,
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: 'white',
  },
  alertContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: APP_CONFIG.colors.overlay.light,
    padding: APP_CONFIG.spacing.sm,
    borderRadius: APP_CONFIG.borderRadius.md,
  },
  alertText: {
    fontSize: 12,
    color: APP_CONFIG.colors.text.secondary,
    marginLeft: APP_CONFIG.spacing.xs,
  },
  selectorContainer: {
    flexDirection: 'row',
    marginBottom: APP_CONFIG.spacing.lg,
  },
  rangeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: APP_CONFIG.spacing.sm,
    marginHorizontal: APP_CONFIG.spacing.xs,
    borderRadius: APP_CONFIG.borderRadius.lg,
    backgroundColor: APP_CONFIG.colors.secondary,
    borderWidth: 1,
    borderColor: APP_CONFIG.colors.overlay.dark,
  },
  rangeButtonActive: {
    backgroundColor: APP_CONFIG.colors.text.primary,
    borderColor: APP_CONFIG.colors.text.primary,
  },
  rangeButtonText: {
    marginLeft: APP_CONFIG.spacing.xs,
    fontSize: 14,
    color: APP_CONFIG.colors.text.secondary,
  },
  rangeButtonTextActive: {
    color: APP_CONFIG.colors.secondary,
    fontWeight: '600',
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
  thresholdContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    marginTop: APP_CONFIG.spacing.sm,
  },
  thresholdItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: APP_CONFIG.spacing.xs,
  },
  thresholdDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: APP_CONFIG.spacing.xs,
  },
  thresholdText: {
    fontSize: 10,
    color: APP_CONFIG.colors.text.secondary,
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
  distributionContainer: {
    backgroundColor: APP_CONFIG.colors.secondary,
    borderRadius: APP_CONFIG.borderRadius.xl,
    padding: APP_CONFIG.spacing.md,
    ...APP_CONFIG.shadows.medium,
  },
  distributionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: APP_CONFIG.colors.text.primary,
    marginBottom: APP_CONFIG.spacing.md,
    textAlign: 'center',
  },
  distributionGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  distributionCard: {
    flex: 1,
    backgroundColor: APP_CONFIG.colors.overlay.light,
    borderRadius: APP_CONFIG.borderRadius.lg,
    padding: APP_CONFIG.spacing.sm,
    marginHorizontal: APP_CONFIG.spacing.xs,
    borderLeftWidth: 4,
    alignItems: 'center',
  },
  distributionLabel: {
    fontSize: 10,
    color: APP_CONFIG.colors.text.secondary,
    textAlign: 'center',
    marginBottom: APP_CONFIG.spacing.xs,
  },
  distributionValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: APP_CONFIG.colors.text.primary,
  },
  distributionPercent: {
    fontSize: 12,
    color: APP_CONFIG.colors.text.tertiary,
    marginTop: 2,
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