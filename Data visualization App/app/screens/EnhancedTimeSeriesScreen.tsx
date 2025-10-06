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
import { APP_CONFIG } from '../utils/constants';
import { logger } from '../utils/logger';
import ParticleBackground from '../components/ParticleBackground';
import EnhancedGraphCard from '../components/EnhancedGraphCard';
import InteractiveChart from '../components/InteractiveChart';
import FloatingActionMenu from '../components/FloatingActionMenu';

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

const PARAMETERS = [
  {
    key: 'proton_bulk_speed',
    name: 'Proton Speed',
    unit: 'km/s',
    color: '#8B5CF6',
    icon: 'flash',
    threshold: 689.38,
    description: 'Solar wind proton velocity'
  },
  {
    key: 'alpha_bulk_speed',
    name: 'Alpha Speed',
    unit: 'km/s',
    color: '#10B981',
    icon: 'rocket',
    threshold: 650,
    description: 'Alpha particle velocity'
  },
  {
    key: 'proton_density',
    name: 'Proton Density',
    unit: 'cm⁻³',
    color: '#F59E0B',
    icon: 'water',
    threshold: 22.92,
    description: 'Proton number density'
  },
  {
    key: 'alpha_density',
    name: 'Alpha Density',
    unit: 'cm⁻³',
    color: '#EF4444',
    icon: 'layers',
    threshold: 0.55,
    description: 'Alpha particle density'
  },
  {
    key: 'fpga_temp_mon',
    name: 'FPGA Temperature',
    unit: '°C',
    color: '#EC4899',
    icon: 'thermometer',
    threshold: 45,
    description: 'System temperature monitoring'
  },
  {
    key: 'score',
    name: 'Anomaly Score',
    unit: '',
    color: '#06B6D4',
    icon: 'warning',
    threshold: 0.5,
    description: 'Anomaly detection score'
  }
];

export default function EnhancedTimeSeriesScreen({ navigation }: Props) {
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(50));
  const [selectedParameter, setSelectedParameter] = useState('proton_bulk_speed');
  const [data, setData] = useState<DataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('24h');
  const [showAlerts, setShowAlerts] = useState(true);

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
      
      // Filter and process data
      const validData = jsonData
        .filter((item: any) => 
          item.proton_bulk_speed !== -1e+31 && 
          item.proton_density !== -1e+31
        )
        .slice(0, 50); // Limit for performance

      setData(validData);
      setLoading(false);
      logger.info('Time series data loaded', { points: validData.length }, 'TimeSeriesGraph');
    } catch (error) {
      logger.error('Failed to load time series data', { error }, 'TimeSeriesGraph');
      setLoading(false);
    }
  };

  const getCurrentParameter = () => {
    return PARAMETERS.find(p => p.key === selectedParameter) || PARAMETERS[0];
  };

  const getChartData = () => {
    if (data.length === 0) return { labels: [], datasets: [] };

    const parameter = getCurrentParameter();
    const values = data.map(item => item[selectedParameter as keyof DataPoint] as number);
    const labels = data.map((_, index) => `${index + 1}`);

    return {
      labels: labels.slice(0, 10), // Show fewer labels for clarity
      datasets: [
        {
          data: values,
          color: (opacity = 1) => `${parameter.color}${Math.round(opacity * 255).toString(16)}`,
          strokeWidth: 3,
        }
      ],
    };
  };

  const getParameterStats = () => {
    if (data.length === 0) return null;

    const parameter = getCurrentParameter();
    const values = data.map(item => item[selectedParameter as keyof DataPoint] as number);
    
    const current = values[values.length - 1];
    const previous = values[values.length - 2];
    const max = Math.max(...values);
    const min = Math.min(...values);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const trend: 'up' | 'down' | 'stable' = current > previous ? 'up' : current < previous ? 'down' : 'stable';
    const trendValue = Math.abs(((current - previous) / previous) * 100).toFixed(1);
    const alertCount = values.filter(v => v > parameter.threshold).length;

    return {
      current,
      max,
      min,
      avg,
      trend,
      trendValue: `${trendValue}%`,
      alertCount,
      threshold: parameter.threshold,
      isAlert: current > parameter.threshold,
    };
  };

  const floatingActions = [
    {
      id: 'export',
      icon: 'download',
      label: 'Export Data',
      color: APP_CONFIG.colors.info,
      onPress: () => console.log('Export data'),
    },
    {
      id: 'share',
      icon: 'share',
      label: 'Share Chart',
      color: APP_CONFIG.colors.success,
      onPress: () => console.log('Share chart'),
    },
    {
      id: 'settings',
      icon: 'settings',
      label: 'Settings',
      color: APP_CONFIG.colors.warning,
      onPress: () => console.log('Open settings'),
    },
    {
      id: 'refresh',
      icon: 'refresh',
      label: 'Refresh',
      color: APP_CONFIG.colors.error,
      onPress: () => loadData(),
    },
  ];

  const parameter = getCurrentParameter();
  const stats = getParameterStats();
  const chartData = getChartData();

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
              <Text style={styles.headerTitle}>Time Series Analysis</Text>
              <View style={[styles.liveBadge, { backgroundColor: parameter.color }]}>
                <View style={styles.liveIndicator} />
                <Text style={styles.liveText}>LIVE</Text>
              </View>
            </View>
            <Text style={styles.headerSubtitle}>
              {parameter.name} • {parameter.description}
            </Text>
          </View>

          <TouchableOpacity style={styles.alertButton}>
            <View style={[styles.alertIndicator, { 
              backgroundColor: stats?.alertCount ? APP_CONFIG.colors.error : APP_CONFIG.colors.success 
            }]}>
              <Ionicons 
                name={stats?.alertCount ? "warning" : "checkmark"} 
                size={16} 
                color="white" 
              />
            </View>
            {stats?.alertCount ? (
              <Text style={styles.alertCount}>{stats.alertCount}</Text>
            ) : null}
          </TouchableOpacity>
        </Animated.View>

        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Parameter Overview Cards */}
          <Animated.View 
            style={[
              styles.overviewContainer,
              {
                transform: [{ translateY: slideAnim }],
                opacity: fadeAnim,
              }
            ]}
          >
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.overviewScrollContent}
            >
              {stats && (
                <>
                  <EnhancedGraphCard
                    title="Current Value"
                    value={stats.current.toFixed(2)}
                    unit={parameter.unit}
                    color={parameter.color}
                    icon={parameter.icon}
                    trend={stats.trend}
                    trendValue={stats.trendValue}
                    size="medium"
                  />
                  
                  <EnhancedGraphCard
                    title="24h Maximum"
                    value={stats.max.toFixed(2)}
                    unit={parameter.unit}
                    color={APP_CONFIG.colors.success}
                    icon="trending-up"
                    size="medium"
                  />
                  
                  <EnhancedGraphCard
                    title="24h Minimum"
                    value={stats.min.toFixed(2)}
                    unit={parameter.unit}
                    color={APP_CONFIG.colors.info}
                    icon="trending-down"
                    size="medium"
                  />
                  
                  <EnhancedGraphCard
                    title="Average"
                    value={stats.avg.toFixed(2)}
                    unit={parameter.unit}
                    color={APP_CONFIG.colors.warning}
                    icon="analytics"
                    size="medium"
                  />
                </>
              )}
            </ScrollView>
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
            <Text style={styles.selectorTitle}>Select Parameter</Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.selectorScrollContent}
            >
              {PARAMETERS.map((param) => (
                <TouchableOpacity
                  key={param.key}
                  style={[
                    styles.parameterButton,
                    selectedParameter === param.key && styles.parameterButtonActive,
                    { borderColor: param.color }
                  ]}
                  onPress={() => setSelectedParameter(param.key)}
                >
                  <View style={[
                    styles.parameterIcon,
                    { backgroundColor: selectedParameter === param.key ? param.color : 'transparent' }
                  ]}>
                    <Ionicons 
                      name={param.icon as any} 
                      size={20} 
                      color={selectedParameter === param.key ? 'white' : param.color} 
                    />
                  </View>
                  <Text style={[
                    styles.parameterName,
                    selectedParameter === param.key && { color: param.color, fontWeight: '700' }
                  ]}>
                    {param.name}
                  </Text>
                  <Text style={styles.parameterUnit}>{param.unit}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Animated.View>

          {/* Interactive Chart */}
          {!loading && data.length > 0 ? (
            <Animated.View 
              style={[
                {
                  transform: [{ translateY: slideAnim }],
                  opacity: fadeAnim,
                }
              ]}
            >
              <InteractiveChart
                data={chartData}
                type="line"
                title={`${parameter.name} Over Time`}
                subtitle={`Threshold: ${parameter.threshold} ${parameter.unit}`}
                color={parameter.color}
                height={280}
                showControls={true}
                onDataPointPress={(data) => {
                  console.log('Data point pressed:', data);
                }}
              />
            </Animated.View>
          ) : (
            <View style={styles.loadingContainer}>
              <Ionicons name="time" size={48} color={APP_CONFIG.colors.text.secondary} />
              <Text style={styles.loadingText}>
                {loading ? 'Loading time series data...' : 'No data available'}
              </Text>
            </View>
          )}

          {/* Threshold Alert */}
          {stats?.isAlert && showAlerts && (
            <Animated.View 
              style={[
                styles.alertContainer,
                {
                  transform: [{ translateY: slideAnim }],
                  opacity: fadeAnim,
                }
              ]}
            >
              <View style={styles.alertHeader}>
                <View style={[styles.alertIcon, { backgroundColor: APP_CONFIG.colors.error }]}>
                  <Ionicons name="warning" size={24} color="white" />
                </View>
                <View style={styles.alertContent}>
                  <Text style={styles.alertTitle}>Threshold Exceeded</Text>
                  <Text style={styles.alertMessage}>
                    {parameter.name} is above threshold ({parameter.threshold} {parameter.unit})
                  </Text>
                </View>
                <TouchableOpacity 
                  style={styles.alertClose}
                  onPress={() => setShowAlerts(false)}
                >
                  <Ionicons name="close" size={20} color={APP_CONFIG.colors.text.secondary} />
                </TouchableOpacity>
              </View>
            </Animated.View>
          )}
        </ScrollView>

        {/* Floating Action Menu */}
        <FloatingActionMenu
          actions={floatingActions}
          mainIcon="menu"
          mainColor={parameter.color}
          position="bottom-right"
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
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: APP_CONFIG.colors.text.primary,
    marginRight: APP_CONFIG.spacing.sm,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
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
  alertButton: {
    position: 'relative',
    padding: APP_CONFIG.spacing.sm,
    borderRadius: APP_CONFIG.borderRadius.md,
    backgroundColor: APP_CONFIG.colors.secondary,
    ...APP_CONFIG.shadows.light,
  },
  alertIndicator: {
    width: 32,
    height: 32,
    borderRadius: APP_CONFIG.borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertCount: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: APP_CONFIG.colors.error,
    color: 'white',
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: APP_CONFIG.spacing.lg,
    paddingBottom: 100, // Space for floating action button
  },
  overviewContainer: {
    marginBottom: APP_CONFIG.spacing.lg,
  },
  overviewScrollContent: {
    paddingRight: APP_CONFIG.spacing.lg,
  },
  selectorContainer: {
    marginBottom: APP_CONFIG.spacing.lg,
  },
  selectorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: APP_CONFIG.colors.text.primary,
    marginBottom: APP_CONFIG.spacing.md,
  },
  selectorScrollContent: {
    paddingRight: APP_CONFIG.spacing.lg,
  },
  parameterButton: {
    alignItems: 'center',
    paddingHorizontal: APP_CONFIG.spacing.md,
    paddingVertical: APP_CONFIG.spacing.sm,
    marginRight: APP_CONFIG.spacing.sm,
    borderRadius: APP_CONFIG.borderRadius.xl,
    backgroundColor: APP_CONFIG.colors.secondary,
    borderWidth: 2,
    minWidth: 100,
  },
  parameterButtonActive: {
    backgroundColor: APP_CONFIG.colors.overlay.light,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  parameterIcon: {
    width: 40,
    height: 40,
    borderRadius: APP_CONFIG.borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: APP_CONFIG.spacing.xs,
  },
  parameterName: {
    fontSize: 12,
    color: APP_CONFIG.colors.text.primary,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 2,
  },
  parameterUnit: {
    fontSize: 10,
    color: APP_CONFIG.colors.text.secondary,
    textAlign: 'center',
  },
  loadingContainer: {
    height: 300,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: APP_CONFIG.colors.secondary,
    borderRadius: APP_CONFIG.borderRadius.xl,
    marginBottom: APP_CONFIG.spacing.lg,
  },
  loadingText: {
    fontSize: 16,
    color: APP_CONFIG.colors.text.secondary,
    marginTop: APP_CONFIG.spacing.sm,
  },
  alertContainer: {
    backgroundColor: `${APP_CONFIG.colors.error}15`,
    borderRadius: APP_CONFIG.borderRadius.xl,
    padding: APP_CONFIG.spacing.lg,
    borderWidth: 2,
    borderColor: `${APP_CONFIG.colors.error}40`,
    marginBottom: APP_CONFIG.spacing.lg,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  alertIcon: {
    width: 48,
    height: 48,
    borderRadius: APP_CONFIG.borderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: APP_CONFIG.spacing.md,
  },
  alertContent: {
    flex: 1,
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: APP_CONFIG.colors.error,
    marginBottom: 2,
  },
  alertMessage: {
    fontSize: 14,
    color: APP_CONFIG.colors.text.secondary,
    lineHeight: 18,
  },
  alertClose: {
    padding: APP_CONFIG.spacing.xs,
  },
});