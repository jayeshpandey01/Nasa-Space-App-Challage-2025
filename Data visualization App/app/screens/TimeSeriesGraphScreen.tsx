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

type Props = NativeStackScreenProps<RootStackParamList, 'TimeSeriesGraph'>;

const { width: screenWidth } = Dimensions.get('window');

interface DataPoint {
  index: number;
  proton_bulk_speed: number;
  alpha_bulk_speed: number;
  proton_density: number;
  alpha_density: number;
  spacecraft_xpos: number;
  spacecraft_ypos: number;
  spacecraft_zpos: number;
  fpga_temp_mon: number;
  score: number;
}

const THRESHOLDS = {
  alpha_density: 0.5463787529366685,
  proton_density: 22.915556332558364,
  proton_bulk_speed: 689.3782959903459,
  proton_thermal: 134.28368989932244
};

export default function TimeSeriesGraphScreen({ navigation }: Props) {
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(50));
  const [selectedParameter, setSelectedParameter] = useState('proton_bulk_speed');
  const [data, setData] = useState<DataPoint[]>([]);
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
      // Filter out invalid data points and take every 10th point for better visualization
      const validData = jsonData
        .filter((item: any, index: number) => 
          index % 10 === 0 && // Sample every 10th point
          item.proton_bulk_speed !== -1e+31 && 
          item.proton_density !== -1e+31 &&
          item.alpha_bulk_speed !== -1e+31 &&
          item.alpha_density !== -1e+31
        )
        .slice(0, 50); // Limit to 50 points for better performance
      
      setData(validData);
      setLoading(false);
      logger.info('Time series data loaded', { count: validData.length }, 'TimeSeriesGraph');
    } catch (error) {
      logger.error('Failed to load data', { error }, 'TimeSeriesGraph');
      setLoading(false);
    }
  };

  const getChartData = () => {
    if (data.length === 0) return { labels: [], datasets: [] };

    const labels = data.map((_, index) => `${index * 10}m`); // Every 10 minutes
    const values = data.map(item => {
      const value = item[selectedParameter as keyof DataPoint] as number;
      return value || 0;
    });

    // Get threshold for current parameter
    const threshold = THRESHOLDS[selectedParameter as keyof typeof THRESHOLDS];

    return {
      labels,
      datasets: [
        {
          data: values,
          color: (opacity = 1) => `rgba(134, 65, 244, ${opacity})`,
          strokeWidth: 2,
        },
        // Add threshold line if available
        ...(threshold ? [{
          data: new Array(values.length).fill(threshold),
          color: (opacity = 1) => `rgba(255, 99, 132, ${opacity})`,
          strokeWidth: 1,
          withDots: false,
        }] : [])
      ],
    };
  };

  const getParameterInfo = () => {
    const info = {
      proton_bulk_speed: {
        title: 'Proton Bulk Speed',
        unit: 'km/s',
        description: 'Solar wind proton velocity',
        color: '#8B5CF6',
        threshold: THRESHOLDS.proton_bulk_speed
      },
      alpha_bulk_speed: {
        title: 'Alpha Bulk Speed',
        unit: 'km/s',
        description: 'Solar wind alpha particle velocity',
        color: '#06B6D4',
        threshold: null
      },
      proton_density: {
        title: 'Proton Density',
        unit: 'cm⁻³',
        description: 'Solar wind proton number density',
        color: '#10B981',
        threshold: THRESHOLDS.proton_density
      },
      alpha_density: {
        title: 'Alpha Density',
        unit: 'cm⁻³',
        description: 'Solar wind alpha particle density',
        color: '#F59E0B',
        threshold: THRESHOLDS.alpha_density
      },
      fpga_temp_mon: {
        title: 'FPGA Temperature',
        unit: '°C',
        description: 'Instrument FPGA temperature',
        color: '#EF4444',
        threshold: null
      },
      score: {
        title: 'Anomaly Score',
        unit: '',
        description: 'Solar wind anomaly detection score',
        color: '#8B5CF6',
        threshold: null
      }
    };
    return info[selectedParameter as keyof typeof info] || info.proton_bulk_speed;
  };

  const parameters = [
    { key: 'proton_bulk_speed', name: 'Proton Speed' },
    { key: 'alpha_bulk_speed', name: 'Alpha Speed' },
    { key: 'proton_density', name: 'Proton Density' },
    { key: 'alpha_density', name: 'Alpha Density' },
    { key: 'fpga_temp_mon', name: 'Temperature' },
    { key: 'score', name: 'Anomaly Score' }
  ];

  const parameterInfo = getParameterInfo();
  const chartData = getChartData();

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
            <Text style={styles.headerTitle}>Time Series Analysis</Text>
            <Text style={styles.headerSubtitle}>24-Hour Solar Wind Data</Text>
          </View>
        </Animated.View>

        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Enhanced Parameter Info Card */}
          <Animated.View 
            style={[
              styles.infoCard,
              {
                transform: [{ translateY: slideAnim }],
                opacity: fadeAnim,
              }
            ]}
          >
            <View style={[styles.cardGradient, { backgroundColor: `${parameterInfo.color}08` }]} />
            <View style={styles.infoHeader}>
              <View style={[styles.parameterIcon, { backgroundColor: parameterInfo.color }]}>
                <Ionicons name="trending-up" size={24} color="white" />
              </View>
              <View style={styles.infoContent}>
                <View style={styles.titleRow}>
                  <Text style={styles.parameterTitle}>{parameterInfo.title}</Text>
                  <View style={[styles.unitBadge, { backgroundColor: `${parameterInfo.color}20` }]}>
                    <Text style={[styles.unitText, { color: parameterInfo.color }]}>
                      {parameterInfo.unit}
                    </Text>
                  </View>
                </View>
                <Text style={styles.parameterDescription}>{parameterInfo.description}</Text>
              </View>
            </View>
            {parameterInfo.threshold && (
              <View style={styles.thresholdInfo}>
                <View style={styles.thresholdIconContainer}>
                  <Ionicons name="flag" size={16} color={APP_CONFIG.colors.warning} />
                </View>
                <View style={styles.thresholdContent}>
                  <Text style={styles.thresholdLabel}>95th Percentile Threshold</Text>
                  <Text style={styles.thresholdValue}>
                    {parameterInfo.threshold.toFixed(2)} {parameterInfo.unit}
                  </Text>
                </View>
              </View>
            )}
          </Animated.View>

          {/* Parameter Selector */}
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
              {parameters.map((param) => (
                <TouchableOpacity
                  key={param.key}
                  style={[
                    styles.parameterButton,
                    selectedParameter === param.key && styles.parameterButtonActive
                  ]}
                  onPress={() => setSelectedParameter(param.key)}
                >
                  <Text style={[
                    styles.parameterButtonText,
                    selectedParameter === param.key && styles.parameterButtonTextActive
                  ]}>
                    {param.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Animated.View>

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
            {!loading && data.length > 0 ? (
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
                    r: "3",
                    strokeWidth: "1",
                    stroke: parameterInfo.color
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
            ) : (
              <View style={styles.loadingContainer}>
                <Ionicons name="analytics" size={48} color={APP_CONFIG.colors.text.secondary} />
                <Text style={styles.loadingText}>
                  {loading ? 'Loading data...' : 'No data available'}
                </Text>
              </View>
            )}
          </Animated.View>

          {/* Statistics */}
          {data.length > 0 && (
            <Animated.View 
              style={[
                styles.statsContainer,
                {
                  transform: [{ translateY: slideAnim }],
                  opacity: fadeAnim,
                }
              ]}
            >
              <View style={styles.statCard}>
                <View style={[styles.statIconContainer, { backgroundColor: `${APP_CONFIG.colors.info}20` }]}>
                  <Ionicons name="pulse" size={18} color={APP_CONFIG.colors.info} />
                </View>
                <Text style={styles.statLabel}>Current</Text>
                <Text style={styles.statValue}>
                  {data[data.length - 1]?.[selectedParameter as keyof DataPoint]?.toFixed(2) || 'N/A'}
                </Text>
                <Text style={styles.statUnit}>{parameterInfo.unit}</Text>
              </View>
              <View style={styles.statCard}>
                <View style={[styles.statIconContainer, { backgroundColor: `${APP_CONFIG.colors.success}20` }]}>
                  <Ionicons name="analytics" size={18} color={APP_CONFIG.colors.success} />
                </View>
                <Text style={styles.statLabel}>Average</Text>
                <Text style={styles.statValue}>
                  {(data.reduce((sum, item) => sum + (item[selectedParameter as keyof DataPoint] as number || 0), 0) / data.length).toFixed(2)}
                </Text>
                <Text style={styles.statUnit}>{parameterInfo.unit}</Text>
              </View>
              <View style={styles.statCard}>
                <View style={[styles.statIconContainer, { backgroundColor: `${APP_CONFIG.colors.warning}20` }]}>
                  <Ionicons name="trending-up" size={18} color={APP_CONFIG.colors.warning} />
                </View>
                <Text style={styles.statLabel}>Peak</Text>
                <Text style={styles.statValue}>
                  {Math.max(...data.map(item => item[selectedParameter as keyof DataPoint] as number || 0)).toFixed(2)}
                </Text>
                <Text style={styles.statUnit}>{parameterInfo.unit}</Text>
              </View>
            </Animated.View>
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
    padding: APP_CONFIG.spacing.lg,
    marginBottom: APP_CONFIG.spacing.lg,
    borderWidth: 1,
    borderColor: APP_CONFIG.colors.overlay.dark,
    position: 'relative',
    overflow: 'hidden',
    ...APP_CONFIG.shadows.medium,
  },
  cardGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: APP_CONFIG.borderRadius.xl,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: APP_CONFIG.spacing.md,
    zIndex: 1,
  },
  parameterIcon: {
    width: 48,
    height: 48,
    borderRadius: APP_CONFIG.borderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: APP_CONFIG.spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  infoContent: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: APP_CONFIG.spacing.xs,
  },
  parameterTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: APP_CONFIG.colors.text.primary,
    flex: 1,
  },
  unitBadge: {
    paddingHorizontal: APP_CONFIG.spacing.sm,
    paddingVertical: 4,
    borderRadius: APP_CONFIG.borderRadius.md,
  },
  unitText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  parameterDescription: {
    fontSize: 14,
    color: APP_CONFIG.colors.text.secondary,
    lineHeight: 20,
    opacity: 0.9,
  },
  thresholdInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: APP_CONFIG.colors.overlay.light,
    padding: APP_CONFIG.spacing.md,
    borderRadius: APP_CONFIG.borderRadius.lg,
    borderWidth: 1,
    borderColor: `${APP_CONFIG.colors.warning}30`,
    zIndex: 1,
  },
  thresholdIconContainer: {
    width: 32,
    height: 32,
    borderRadius: APP_CONFIG.borderRadius.lg,
    backgroundColor: `${APP_CONFIG.colors.warning}20`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: APP_CONFIG.spacing.sm,
  },
  thresholdContent: {
    flex: 1,
  },
  thresholdLabel: {
    fontSize: 12,
    color: APP_CONFIG.colors.text.secondary,
    fontWeight: '600',
    marginBottom: 2,
  },
  thresholdValue: {
    fontSize: 14,
    color: APP_CONFIG.colors.text.primary,
    fontWeight: '700',
  },
  selectorContainer: {
    marginBottom: APP_CONFIG.spacing.lg,
  },
  selectorScrollContent: {
    paddingRight: APP_CONFIG.spacing.lg,
  },
  parameterButton: {
    paddingHorizontal: APP_CONFIG.spacing.md,
    paddingVertical: APP_CONFIG.spacing.sm,
    marginRight: APP_CONFIG.spacing.sm,
    borderRadius: APP_CONFIG.borderRadius.lg,
    backgroundColor: APP_CONFIG.colors.secondary,
    borderWidth: 1,
    borderColor: APP_CONFIG.colors.overlay.dark,
  },
  parameterButtonActive: {
    backgroundColor: APP_CONFIG.colors.text.primary,
    borderColor: APP_CONFIG.colors.text.primary,
  },
  parameterButtonText: {
    fontSize: 14,
    color: APP_CONFIG.colors.text.secondary,
  },
  parameterButtonTextActive: {
    color: APP_CONFIG.colors.secondary,
    fontWeight: '600',
  },
  chartContainer: {
    backgroundColor: APP_CONFIG.colors.secondary,
    borderRadius: APP_CONFIG.borderRadius.xl,
    padding: APP_CONFIG.spacing.sm,
    marginBottom: APP_CONFIG.spacing.lg,
    ...APP_CONFIG.shadows.medium,
  },
  chart: {
    borderRadius: APP_CONFIG.borderRadius.lg,
  },
  loadingContainer: {
    height: 280,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: APP_CONFIG.colors.text.secondary,
    marginTop: APP_CONFIG.spacing.sm,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statCard: {
    flex: 1,
    backgroundColor: APP_CONFIG.colors.secondary,
    borderRadius: APP_CONFIG.borderRadius.xl,
    padding: APP_CONFIG.spacing.md,
    marginHorizontal: APP_CONFIG.spacing.xs,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: APP_CONFIG.colors.overlay.dark,
    ...APP_CONFIG.shadows.light,
  },
  statIconContainer: {
    width: 36,
    height: 36,
    borderRadius: APP_CONFIG.borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: APP_CONFIG.spacing.xs,
  },
  statLabel: {
    fontSize: 12,
    color: APP_CONFIG.colors.text.secondary,
    marginBottom: APP_CONFIG.spacing.xs,
    fontWeight: '600',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: APP_CONFIG.colors.text.primary,
    marginBottom: 2,
  },
  statUnit: {
    fontSize: 11,
    color: APP_CONFIG.colors.text.tertiary,
    fontWeight: '600',
    opacity: 0.8,
  },
});