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

type Props = NativeStackScreenProps<RootStackParamList, 'TrajectoryGraph'>;

const { width: screenWidth } = Dimensions.get('window');

interface TrajectoryPoint {
  x: number;
  y: number;
  z: number;
  time: number;
  velocity: number;
}

export default function TrajectoryGraphScreen({ navigation }: Props) {
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(50));
  const [trajectoryData, setTrajectoryData] = useState<TrajectoryPoint[]>([]);
  const [selectedView, setSelectedView] = useState<'xy' | 'xz' | 'yz' | '3d'>('xy');
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
      
      // Process trajectory data - sample every 20th point for better visualization
      const trajectoryPoints: TrajectoryPoint[] = jsonData
        .filter((_: any, index: number) => index % 20 === 0)
        .slice(0, 100) // Limit to 100 points
        .map((item: any, index: number) => ({
          x: item.spacecraft_xpos || 0,
          y: item.spacecraft_ypos || 0,
          z: item.spacecraft_zpos || 0,
          time: index,
          velocity: Math.sqrt(
            Math.pow(item.spacecraft_xvel || 0, 2) +
            Math.pow(item.spacecraft_yvel || 0, 2) +
            Math.pow(item.spacecraft_zvel || 0, 2)
          )
        }));

      setTrajectoryData(trajectoryPoints);
      setLoading(false);
      logger.info('Trajectory data loaded', { points: trajectoryPoints.length }, 'TrajectoryGraph');
    } catch (error) {
      logger.error('Failed to load trajectory data', { error }, 'TrajectoryGraph');
      setLoading(false);
    }
  };

  const getChartData = () => {
    if (trajectoryData.length === 0) return { labels: [], datasets: [] };

    const labels = trajectoryData.map((_, index) => `${index * 20}m`);
    
    let xData: number[], yData: number[];
    let xLabel: string, yLabel: string;

    switch (selectedView) {
      case 'xy':
        xData = trajectoryData.map(p => p.x / 1000); // Convert to thousands
        yData = trajectoryData.map(p => p.y / 1000);
        xLabel = 'X Position (×1000 km)';
        yLabel = 'Y Position (×1000 km)';
        break;
      case 'xz':
        xData = trajectoryData.map(p => p.x / 1000);
        yData = trajectoryData.map(p => p.z / 1000);
        xLabel = 'X Position (×1000 km)';
        yLabel = 'Z Position (×1000 km)';
        break;
      case 'yz':
        xData = trajectoryData.map(p => p.y / 1000);
        yData = trajectoryData.map(p => p.z / 1000);
        xLabel = 'Y Position (×1000 km)';
        yLabel = 'Z Position (×1000 km)';
        break;
      default:
        xData = trajectoryData.map(p => p.velocity);
        yData = trajectoryData.map(p => p.velocity);
        xLabel = 'Velocity (km/s)';
        yLabel = 'Velocity (km/s)';
    }

    return {
      labels: labels.slice(0, 10), // Show fewer labels for clarity
      datasets: [
        {
          data: xData,
          color: (opacity = 1) => `rgba(134, 65, 244, ${opacity})`,
          strokeWidth: 2,
        },
        {
          data: yData,
          color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`,
          strokeWidth: 2,
        }
      ],
      legend: [xLabel, yLabel]
    };
  };

  const getTrajectoryStats = () => {
    if (trajectoryData.length === 0) return null;

    const distances = trajectoryData.map(p => Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z));
    const velocities = trajectoryData.map(p => p.velocity);

    return {
      totalDistance: Math.max(...distances) - Math.min(...distances),
      avgVelocity: velocities.reduce((a, b) => a + b, 0) / velocities.length,
      maxVelocity: Math.max(...velocities),
      minDistance: Math.min(...distances),
      maxDistance: Math.max(...distances),
      currentPosition: trajectoryData[trajectoryData.length - 1]
    };
  };

  const views = [
    { key: 'xy', name: 'X-Y Plane', icon: 'resize' },
    { key: 'xz', name: 'X-Z Plane', icon: 'swap-horizontal' },
    { key: 'yz', name: 'Y-Z Plane', icon: 'swap-vertical' },
    { key: '3d', name: 'Velocity', icon: 'speedometer' }
  ];

  const chartData = getChartData();
  const stats = getTrajectoryStats();

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
            <Text style={styles.headerTitle}>3D Trajectory</Text>
            <Text style={styles.headerSubtitle}>Spacecraft Position & Movement</Text>
          </View>
        </Animated.View>

        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Mission Info */}
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
              <View style={styles.missionIcon}>
                <Ionicons name="rocket" size={20} color={APP_CONFIG.colors.info} />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.missionTitle}>Aditya-L1 Trajectory</Text>
                <Text style={styles.missionDescription}>L1 Lagrange Point Orbit</Text>
              </View>
              <View style={styles.statusBadge}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>ACTIVE</Text>
              </View>
            </View>
          </Animated.View>

          {/* View Selector */}
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
              {views.map((view) => (
                <TouchableOpacity
                  key={view.key}
                  style={[
                    styles.viewButton,
                    selectedView === view.key && styles.viewButtonActive
                  ]}
                  onPress={() => setSelectedView(view.key as any)}
                >
                  <Ionicons 
                    name={view.icon as any} 
                    size={18} 
                    color={selectedView === view.key ? APP_CONFIG.colors.secondary : APP_CONFIG.colors.text.secondary} 
                  />
                  <Text style={[
                    styles.viewButtonText,
                    selectedView === view.key && styles.viewButtonTextActive
                  ]}>
                    {view.name}
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
            {!loading && trajectoryData.length > 0 ? (
              <>
                <Text style={styles.chartTitle}>
                  {selectedView === '3d' ? 'Velocity Profile' : `${selectedView.toUpperCase()} Trajectory View`}
                </Text>
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
                      r: "2",
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
              </>
            ) : (
              <View style={styles.loadingContainer}>
                <Ionicons name="globe" size={48} color={APP_CONFIG.colors.text.secondary} />
                <Text style={styles.loadingText}>
                  {loading ? 'Loading trajectory...' : 'No trajectory data available'}
                </Text>
              </View>
            )}
          </Animated.View>

          {/* Statistics */}
          {stats && (
            <Animated.View 
              style={[
                styles.statsGrid,
                {
                  transform: [{ translateY: slideAnim }],
                  opacity: fadeAnim,
                }
              ]}
            >
              <View style={styles.statCard}>
                <Ionicons name="location" size={20} color={APP_CONFIG.colors.info} />
                <Text style={styles.statLabel}>Distance from Earth</Text>
                <Text style={styles.statValue}>
                  {(stats.currentPosition.x / 1000).toFixed(0)} km
                </Text>
              </View>
              
              <View style={styles.statCard}>
                <Ionicons name="speedometer" size={20} color={APP_CONFIG.colors.success} />
                <Text style={styles.statLabel}>Average Velocity</Text>
                <Text style={styles.statValue}>
                  {stats.avgVelocity.toFixed(3)} km/s
                </Text>
              </View>
              
              <View style={styles.statCard}>
                <Ionicons name="trending-up" size={20} color={APP_CONFIG.colors.warning} />
                <Text style={styles.statLabel}>Max Velocity</Text>
                <Text style={styles.statValue}>
                  {stats.maxVelocity.toFixed(3)} km/s
                </Text>
              </View>
              
              <View style={styles.statCard}>
                <Ionicons name="resize" size={20} color={APP_CONFIG.colors.warning} />
                <Text style={styles.statLabel}>Orbital Range</Text>
                <Text style={styles.statValue}>
                  {(stats.totalDistance / 1000).toFixed(0)} km
                </Text>
              </View>
            </Animated.View>
          )}

          {/* Position Details */}
          {stats && (
            <Animated.View 
              style={[
                styles.positionCard,
                {
                  transform: [{ translateY: slideAnim }],
                  opacity: fadeAnim,
                }
              ]}
            >
              <Text style={styles.positionTitle}>Current Position</Text>
              <View style={styles.positionGrid}>
                <View style={styles.positionItem}>
                  <Text style={styles.positionLabel}>X Coordinate</Text>
                  <Text style={styles.positionValue}>
                    {(stats.currentPosition.x / 1000).toFixed(2)} km
                  </Text>
                </View>
                <View style={styles.positionItem}>
                  <Text style={styles.positionLabel}>Y Coordinate</Text>
                  <Text style={styles.positionValue}>
                    {(stats.currentPosition.y / 1000).toFixed(2)} km
                  </Text>
                </View>
                <View style={styles.positionItem}>
                  <Text style={styles.positionLabel}>Z Coordinate</Text>
                  <Text style={styles.positionValue}>
                    {(stats.currentPosition.z / 1000).toFixed(2)} km
                  </Text>
                </View>
                <View style={styles.positionItem}>
                  <Text style={styles.positionLabel}>Current Velocity</Text>
                  <Text style={styles.positionValue}>
                    {stats.currentPosition.velocity.toFixed(4)} km/s
                  </Text>
                </View>
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
    padding: APP_CONFIG.spacing.md,
    marginBottom: APP_CONFIG.spacing.lg,
    ...APP_CONFIG.shadows.medium,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  missionIcon: {
    backgroundColor: APP_CONFIG.colors.overlay.light,
    padding: APP_CONFIG.spacing.sm,
    borderRadius: APP_CONFIG.borderRadius.lg,
    marginRight: APP_CONFIG.spacing.sm,
  },
  infoContent: {
    flex: 1,
  },
  missionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: APP_CONFIG.colors.text.primary,
  },
  missionDescription: {
    fontSize: 14,
    color: APP_CONFIG.colors.text.secondary,
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: APP_CONFIG.colors.success,
    paddingHorizontal: APP_CONFIG.spacing.sm,
    paddingVertical: APP_CONFIG.spacing.xs,
    borderRadius: APP_CONFIG.borderRadius.md,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'white',
    marginRight: APP_CONFIG.spacing.xs,
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: 'white',
  },
  selectorContainer: {
    marginBottom: APP_CONFIG.spacing.lg,
  },
  selectorScrollContent: {
    paddingRight: APP_CONFIG.spacing.lg,
  },
  viewButton: {
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
  viewButtonActive: {
    backgroundColor: APP_CONFIG.colors.text.primary,
    borderColor: APP_CONFIG.colors.text.primary,
  },
  viewButtonText: {
    marginLeft: APP_CONFIG.spacing.xs,
    fontSize: 14,
    color: APP_CONFIG.colors.text.secondary,
  },
  viewButtonTextActive: {
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
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: APP_CONFIG.spacing.lg,
  },
  statCard: {
    width: (screenWidth - APP_CONFIG.spacing.lg * 2 - APP_CONFIG.spacing.sm) / 2,
    backgroundColor: APP_CONFIG.colors.secondary,
    borderRadius: APP_CONFIG.borderRadius.xl,
    padding: APP_CONFIG.spacing.md,
    marginBottom: APP_CONFIG.spacing.sm,
    alignItems: 'center',
    ...APP_CONFIG.shadows.light,
  },
  statLabel: {
    fontSize: 12,
    color: APP_CONFIG.colors.text.secondary,
    marginTop: APP_CONFIG.spacing.xs,
    textAlign: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: APP_CONFIG.colors.text.primary,
    marginTop: APP_CONFIG.spacing.xs,
  },
  positionCard: {
    backgroundColor: APP_CONFIG.colors.secondary,
    borderRadius: APP_CONFIG.borderRadius.xl,
    padding: APP_CONFIG.spacing.md,
    ...APP_CONFIG.shadows.medium,
  },
  positionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: APP_CONFIG.colors.text.primary,
    marginBottom: APP_CONFIG.spacing.md,
    textAlign: 'center',
  },
  positionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  positionItem: {
    width: (screenWidth - APP_CONFIG.spacing.lg * 2 - APP_CONFIG.spacing.md * 2 - APP_CONFIG.spacing.sm) / 2,
    backgroundColor: APP_CONFIG.colors.overlay.light,
    borderRadius: APP_CONFIG.borderRadius.lg,
    padding: APP_CONFIG.spacing.sm,
    marginBottom: APP_CONFIG.spacing.sm,
    alignItems: 'center',
  },
  positionLabel: {
    fontSize: 12,
    color: APP_CONFIG.colors.text.secondary,
    marginBottom: APP_CONFIG.spacing.xs,
  },
  positionValue: {
    fontSize: 14,
    fontWeight: '600',
    color: APP_CONFIG.colors.text.primary,
  },
});