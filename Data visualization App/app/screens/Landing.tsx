import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ScrollView,
  StatusBar,
  Image,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { APP_CONFIG, SENSOR_DATA, TRENDING_DATA } from '../utils/constants';
import { logger } from '../utils/logger';
import { screenDimensions, getTrendIcon, getTrendColor } from '../utils/helpers';
import FloatingNavbar from '../components/FloatingNavbar';
import ParticleBackground from '../components/ParticleBackground';
import { DataAnalyzer, DailySummary } from '../utils/dataAnalyzer';

type Props = NativeStackScreenProps<RootStackParamList, 'Landing'>;

const { width: screenWidth } = Dimensions.get('window');

export default function Landing({ navigation }: Props) {
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(50));
  const [pulseAnim] = useState(new Animated.Value(1));
  const [dailySummary, setDailySummary] = useState<DailySummary | null>(null);
  const [partialRealTimeData, setPartialRealTimeData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPartialRealTimeData();
    
    // Entrance animations
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

    // Pulse animation for CME counter
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const loadPartialRealTimeData = async () => {
    try {
      setLoading(true);
      const jsonData = require('../../final_output_01.json');
      
      // Generate daily summary
      const summary = DataAnalyzer.generateDailySummary(jsonData);
      setDailySummary(summary);
      
      // Get latest data points for partial real-time display
      const validData = jsonData.filter((item: any) => 
        item.proton_bulk_speed !== -1e+31 && 
        item.proton_density !== -1e+31
      ).slice(-10); // Get last 10 valid readings
      
      setPartialRealTimeData(validData);
      setLoading(false);
      
      logger.info('Partial real-time data loaded', { 
        summaryDate: summary.date,
        dataPoints: validData.length 
      }, 'Landing');
    } catch (error) {
      logger.error('Failed to load partial real-time data', { error }, 'Landing');
      setLoading(false);
    }
  };

  const handleNavigation = (screen: keyof RootStackParamList) => {
    logger.info(`Navigating to ${screen}`, {}, 'Landing');
    navigation.navigate(screen);
  };

  const handleSearchPress = () => {
    logger.info('Search button pressed', {}, 'Landing');
    handleNavigation('Search');
  };

  const handleSimulationPress = () => {
    logger.info('Simulation button pressed', {}, 'Landing');
    handleNavigation('GraphSimulation');
  };

  const handleTabPress = (tab: string) => {
    logger.info('Tab pressed', { tab }, 'Landing');
    switch (tab) {
      case 'home':
        // Already on home
        break;
      case 'blog':
        handleNavigation('Blog');
        break;
      case 'chatbot':
        handleNavigation('Chatbot');
        break;
    }
  };

  const getPartialRealTimeSensorData = () => {
    if (!dailySummary) return SENSOR_DATA;

    return [
      {
        id: '1',
        name: 'Proton Speed',
        desc: 'Solar Wind Proton Velocity',
        reading: `${dailySummary.parameters.find(p => p.parameter === 'proton_bulk_speed')?.mean.toFixed(1) || '---'} km/s`,
        trendUp: dailySummary.parameters.find(p => p.parameter === 'proton_bulk_speed')?.trendDirection === 'increasing',
        icon: 'speedometer',
        color: '#8B5CF6'
      },
      {
        id: '2',
        name: 'Proton Density',
        desc: 'Particle Number Density',
        reading: `${dailySummary.parameters.find(p => p.parameter === 'proton_density')?.mean.toFixed(2) || '---'} cm⁻³`,
        trendUp: dailySummary.parameters.find(p => p.parameter === 'proton_density')?.trendDirection === 'increasing',
        icon: 'analytics',
        color: '#10B981'
      },
      {
        id: '3',
        name: 'Alpha Speed',
        desc: 'Alpha Particle Velocity',
        reading: `${dailySummary.parameters.find(p => p.parameter === 'alpha_bulk_speed')?.mean.toFixed(1) || '---'} km/s`,
        trendUp: dailySummary.parameters.find(p => p.parameter === 'alpha_bulk_speed')?.trendDirection === 'increasing',
        icon: 'pulse',
        color: '#F59E0B'
      },
      {
        id: '4',
        name: 'Temperature',
        desc: 'FPGA System Temperature',
        reading: `${dailySummary.temperatureStatus.current.toFixed(1)}°C`,
        trendUp: dailySummary.temperatureStatus.status !== 'critical',
        icon: 'thermometer',
        color: '#EF4444'
      }
    ];
  };

  const renderSensorCard = ({ item, index }: { item: any; index: number }) => (
    <Animated.View 
      style={[
        styles.card,
        {
          transform: [{ translateX: slideAnim }],
          opacity: fadeAnim,
          borderLeftWidth: 4,
          borderLeftColor: item.color || APP_CONFIG.colors.info,
        }
      ]}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.cardIconContainer, { backgroundColor: `${item.color || APP_CONFIG.colors.info}20` }]}>
          <Ionicons name={item.icon || "analytics"} size={20} color={item.color || APP_CONFIG.colors.info} />
        </View>
        <View style={styles.cardTrend}>
          <MaterialIcons
            name={getTrendIcon(item.trendUp)}
            size={16}
            color={getTrendColor(item.trendUp, APP_CONFIG.colors)}
          />
          <Text
            style={[styles.cardTrendText, { color: getTrendColor(item.trendUp, APP_CONFIG.colors) }]}
          >
            {item.trendUp ? '↗' : '↘'}
          </Text>
        </View>
      </View>
      <Text style={styles.cardSymbol}>{item.name}</Text>
      <Text style={styles.cardName}>{item.desc}</Text>
      <Text style={styles.cardPrice}>{item.reading}</Text>
      <View style={styles.liveIndicator}>
        <View style={styles.liveDot} />
        <Text style={styles.liveText}>LIVE</Text>
      </View>
    </Animated.View>
  );

  const getPartialRealTimeTrendingData = () => {
    if (!dailySummary) return TRENDING_DATA;

    return [
      {
        id: '1',
        name: 'Proton Flux Activity',
        change: dailySummary.solarWindConditions.protonFlux.toUpperCase(),
        trendUp: dailySummary.solarWindConditions.protonFlux !== 'low',
        value: dailySummary.parameters.find(p => p.parameter === 'proton_density')?.mean.toFixed(2)
      },
      {
        id: '2',
        name: 'Alpha Particle Activity',
        change: dailySummary.solarWindConditions.alphaParticleActivity.toUpperCase(),
        trendUp: dailySummary.solarWindConditions.alphaParticleActivity !== 'low',
        value: dailySummary.parameters.find(p => p.parameter === 'alpha_density')?.mean.toFixed(3)
      },
      {
        id: '3',
        name: 'System Temperature',
        change: dailySummary.temperatureStatus.status.toUpperCase(),
        trendUp: dailySummary.temperatureStatus.status === 'normal',
        value: `${dailySummary.temperatureStatus.current.toFixed(1)}°C`
      },
      {
        id: '4',
        name: 'Anomaly Detection',
        change: `${dailySummary.anomalies.total} DETECTED`,
        trendUp: dailySummary.anomalies.total === 0,
        value: `${dailySummary.anomalies.highSeverity} High`
      }
    ];
  };

  const renderTrendingItem = (item: any, index: number) => (
    <Animated.View 
      key={item.id} 
      style={[
        styles.trendingRow,
        {
          transform: [{ translateX: slideAnim }],
          opacity: fadeAnim,
        }
      ]}
    >
      <View style={styles.trendingLeft}>
        <View style={[
          styles.trendingIcon,
          { backgroundColor: `${getTrendColor(item.trendUp, APP_CONFIG.colors)}20` }
        ]}>
          <Ionicons 
            name={item.trendUp ? "trending-up" : "trending-down"} 
            size={16} 
            color={getTrendColor(item.trendUp, APP_CONFIG.colors)} 
          />
        </View>
        <View style={styles.trendingContent}>
          <Text style={styles.trendingName}>{item.name}</Text>
          {item.value && (
            <Text style={styles.trendingValue}>{item.value}</Text>
          )}
        </View>
      </View>
      <View style={styles.cardTrend}>
        <Text
          style={[styles.trendingChange, { color: getTrendColor(item.trendUp, APP_CONFIG.colors) }]}
        >
          {item.change}
        </Text>
      </View>
    </Animated.View>
  );

  return (
    <ParticleBackground>
      <SafeAreaView style={[styles.safeArea, { backgroundColor: 'transparent' }]}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <BlurView intensity={40} tint="dark" style={styles.blurTop} />
        
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {loading && (
            <Animated.View style={[styles.loadingOverlay, { opacity: fadeAnim }]}>
              <Ionicons name="analytics" size={32} color={APP_CONFIG.colors.info} />
              <Text style={styles.loadingText}>Loading partial real-time data...</Text>
            </Animated.View>
          )}
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
            <View style={styles.logoContainer}>
              <View style={styles.logoIcon}>
                <FontAwesome5 name="sun" size={24} color={APP_CONFIG.colors.warning} />
              </View>
              <Text style={styles.logo}>{APP_CONFIG.name}</Text>
            </View>
            <View style={styles.headerIcons}>
              <TouchableOpacity style={styles.iconBtn} onPress={handleSearchPress}>
                <Ionicons name="search" size={22} color={APP_CONFIG.colors.text.primary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconBtn}>
                <Ionicons name="notifications-outline" size={22} color={APP_CONFIG.colors.text.primary} />
              </TouchableOpacity>
            </View>
          </Animated.View>

          {/* Partial Real-time Solar Wind Data Card */}
          <Animated.View 
            style={[
              styles.cmeContainer,
              {
                transform: [{ scale: pulseAnim }],
                opacity: fadeAnim,
              }
            ]}
          >
            <View style={styles.cmeLeft}>
              <View style={styles.cmeHeader}>
                <Ionicons name="pulse" size={20} color={APP_CONFIG.colors.success} />
                <Text style={styles.cmeLabel}>Solar Wind Activity</Text>
              </View>
              <Text style={styles.cmeMainValue}>
                {dailySummary ? `${dailySummary.anomalies.total}` : '---'}
              </Text>
              <Text style={styles.cmeToday}>
                Anomalies: {dailySummary ? `${dailySummary.anomalies.highSeverity} High` : 'Loading...'}
              </Text>
            </View>
            <View style={styles.cmeRight}>
              <View style={styles.cmeProgress}>
                <View style={styles.progressBar}>
                  <View style={[
                    styles.progressFill, 
                    { 
                      width: dailySummary ? `${Math.min(dailySummary.dataQuality.completeness, 100)}%` : '0%',
                      backgroundColor: dailySummary && dailySummary.dataQuality.completeness > 90 ? 
                        APP_CONFIG.colors.success : APP_CONFIG.colors.warning
                    }
                  ]} />
                </View>
                <Text style={styles.cmePercentage}>
                  {dailySummary ? `${dailySummary.dataQuality.completeness.toFixed(0)}%` : '0%'}
                </Text>
              </View>
            </View>
          </Animated.View>

          {/* Partial Real-time Mission Status Card */}
          <Animated.View 
            style={[
              styles.missionCard,
              {
                transform: [{ translateY: slideAnim }],
                opacity: fadeAnim,
              }
            ]}
          >
            <View style={styles.missionHeader}>
              <View style={styles.missionIcon}>
                <Ionicons name="hardware-chip" size={20} color={APP_CONFIG.colors.info} />
              </View>
              <Text style={styles.missionTitle}>Aditya-L1 Status</Text>
              <View style={[
                styles.statusBadge,
                { 
                  backgroundColor: dailySummary && dailySummary.temperatureStatus.status === 'normal' ? 
                    APP_CONFIG.colors.success : APP_CONFIG.colors.warning 
                }
              ]}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>
                  {dailySummary ? dailySummary.temperatureStatus.status.toUpperCase() : 'LOADING'}
                </Text>
              </View>
            </View>
            <View style={styles.missionDetails}>
              <View style={styles.missionRow}>
                <Ionicons name="location" size={16} color={APP_CONFIG.colors.text.secondary} />
                <Text style={styles.missionLabel}>Position:</Text>
                <Text style={styles.missionValue}>
                  {dailySummary ? 
                    `${(dailySummary.spacecraftStatus.distanceFromEarth / 1000).toFixed(0)}k km` : 
                    'L1 Lagrange Point'
                  }
                </Text>
              </View>
              <View style={styles.missionRow}>
                <Ionicons name="thermometer" size={16} color={APP_CONFIG.colors.text.secondary} />
                <Text style={styles.missionLabel}>Temperature:</Text>
                <Text style={styles.missionValue}>
                  {dailySummary ? 
                    `${dailySummary.temperatureStatus.current.toFixed(1)}°C` : 
                    'Loading...'
                  }
                </Text>
              </View>
              <View style={styles.missionRow}>
                <Ionicons name="analytics" size={16} color={APP_CONFIG.colors.text.secondary} />
                <Text style={styles.missionLabel}>Data Quality:</Text>
                <Text style={styles.missionValue}>
                  {dailySummary ? 
                    `${dailySummary.dataQuality.reliability.toFixed(1)}%` : 
                    'Calculating...'
                  }
                </Text>
              </View>
            </View>
          </Animated.View>

          {/* Partial Real-time Solar Activity Alert */}
          <Animated.View 
            style={[
              styles.alertCard,
              {
                transform: [{ translateY: slideAnim }],
                opacity: fadeAnim,
              }
            ]}
          >
            <View style={styles.alertHeader}>
              <View style={styles.alertIcon}>
                <MaterialIcons 
                  name={dailySummary && dailySummary.anomalies.highSeverity > 0 ? "warning" : "info"} 
                  size={20} 
                  color={dailySummary && dailySummary.anomalies.highSeverity > 0 ? 
                    APP_CONFIG.colors.warning : APP_CONFIG.colors.info} 
                />
              </View>
              <Text style={styles.alertTitle}>
                {dailySummary && dailySummary.anomalies.highSeverity > 0 ? 
                  'Solar Wind Anomaly' : 'Solar Wind Status'
                }
              </Text>
              <View style={[
                styles.alertBadge,
                { 
                  backgroundColor: dailySummary && dailySummary.solarWindConditions.protonFlux === 'high' ? 
                    APP_CONFIG.colors.warning : APP_CONFIG.colors.info 
                }
              ]}>
                <Text style={styles.alertBadgeText}>
                  {dailySummary ? dailySummary.solarWindConditions.protonFlux.toUpperCase() : 'LOADING'}
                </Text>
              </View>
            </View>
            <Text style={styles.alertText}>
              {dailySummary ? (
                dailySummary.keyEvents.length > 0 ? 
                  dailySummary.keyEvents[0] : 
                  `Current solar wind conditions show ${dailySummary.solarWindConditions.protonFlux} proton flux with ${dailySummary.solarWindConditions.alphaParticleActivity} alpha particle activity.`
              ) : 'Loading current solar wind conditions...'}
            </Text>
            <View style={styles.alertFooter}>
              <View style={styles.alertTimeContainer}>
                <Ionicons name="time-outline" size={14} color={APP_CONFIG.colors.text.tertiary} />
                <Text style={styles.alertTime}>
                  Updated: {dailySummary ? 'Live data' : 'Loading...'}
                </Text>
              </View>
              <TouchableOpacity 
                style={styles.alertButton}
                onPress={() => handleNavigation('AIBlog')}
              >
                <Text style={styles.alertButtonText}>AI Analysis</Text>
                <Ionicons name="sparkles" size={14} color={APP_CONFIG.colors.secondary} />
              </TouchableOpacity>
            </View>
          </Animated.View>

          {/* Enhanced Action Buttons */}
          <Animated.View 
            style={[
              styles.actions,
              {
                transform: [{ translateY: slideAnim }],
                opacity: fadeAnim,
              }
            ]}
          >
            <TouchableOpacity style={styles.primaryBtn} onPress={handleSimulationPress}>
              <View style={styles.btnContent}>
                <Ionicons name="play" size={20} color={APP_CONFIG.colors.secondary} />
                <Text style={styles.primaryBtnText}>Start Simulation</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.outlineBtn} onPress={() => handleNavigation('GraphDashboard')}>
              <View style={styles.btnContent}>
                <Ionicons name="analytics" size={20} color={APP_CONFIG.colors.text.primary} />
                <Text style={styles.outlineBtnText}>View Graphs</Text>
              </View>
            </TouchableOpacity>
          </Animated.View>

          {/* Solar Observation Section */}
          <Animated.View 
            style={[
              styles.solarObservationCard,
              {
                transform: [{ translateY: slideAnim }],
                opacity: fadeAnim,
              }
            ]}
          >
            <TouchableOpacity 
              style={styles.solarObservationTouchable}
              onPress={() => handleNavigation('SolarObservation')}
            >
              <View style={styles.solarObservationHeader}>
                <View style={styles.solarObservationIcon}>
                  <Ionicons name="sunny" size={24} color={APP_CONFIG.colors.warning} />
                </View>
                <View style={styles.solarObservationContent}>
                  <Text style={styles.solarObservationTitle}>Solar Observations</Text>
                  <Text style={styles.solarObservationDesc}>24-hour SUIT instrument data & video</Text>
                </View>
                <View style={styles.solarObservationArrow}>
                  <Ionicons name="arrow-forward" size={20} color={APP_CONFIG.colors.text.primary} />
                </View>
              </View>
              <View style={styles.solarObservationFeatures}>
                <View style={styles.solarFeature}>
                  <Ionicons name="videocam" size={16} color={APP_CONFIG.colors.info} />
                  <Text style={styles.solarFeatureText}>Video Analysis</Text>
                </View>
                <View style={styles.solarFeature}>
                  <Ionicons name="analytics" size={16} color={APP_CONFIG.colors.success} />
                  <Text style={styles.solarFeatureText}>Data Insights</Text>
                </View>
                <View style={styles.solarFeature}>
                  <Ionicons name="sparkles" size={16} color={APP_CONFIG.colors.warning} />
                  <Text style={styles.solarFeatureText}>AI Summary</Text>
                </View>
              </View>
            </TouchableOpacity>
          </Animated.View>

          {/* Enhanced Sensor Cards */}
          <View style={styles.rowHeader}>
            <View style={styles.sectionHeader}>
              <Ionicons name="analytics" size={20} color={APP_CONFIG.colors.info} />
              <Text style={styles.subHeading}>Aditya-L1 Sensors</Text>
            </View>
            <TouchableOpacity style={styles.viewAllBtn}>
              <Text style={styles.viewAll}>View all</Text>
              <Ionicons name="chevron-forward" size={16} color={APP_CONFIG.colors.info} />
            </TouchableOpacity>
          </View>
          <FlatList
            horizontal
            data={getPartialRealTimeSensorData()}
            keyExtractor={(item) => item.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingRight: APP_CONFIG.spacing.lg }}
            renderItem={renderSensorCard}
          />

          {/* Enhanced Trending Solar Activity */}
          <View style={[styles.rowHeader, { marginTop: APP_CONFIG.spacing.xl }]}>
            <View style={styles.sectionHeader}>
              <Ionicons name="trending-up" size={20} color={APP_CONFIG.colors.success} />
              <Text style={styles.subHeading}>Trending Solar Activity</Text>
            </View>
            <TouchableOpacity style={styles.viewAllBtn}>
              <Text style={styles.viewAll}>View details</Text>
              <Ionicons name="chevron-forward" size={16} color={APP_CONFIG.colors.info} />
            </TouchableOpacity>
          </View>
          {getPartialRealTimeTrendingData().map(renderTrendingItem)}

          {/* Enhanced Footer */}
          <Animated.View 
            style={[
              styles.footerCard,
              {
                transform: [{ translateY: slideAnim }],
                opacity: fadeAnim,
              }
            ]}
          >
            <View style={styles.footerContent}>
              <Ionicons name="shield-checkmark" size={20} color={APP_CONFIG.colors.success} />
              <Text style={styles.footerText}>Powered by Aditya-L1 | Solar Particle Monitoring System</Text>
            </View>
          </Animated.View>
        </ScrollView>
        
        {/* Floating Navbar */}
        <FloatingNavbar activeTab="home" onTabPress={handleTabPress} />
      </SafeAreaView>
    </ParticleBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  blurTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 30,
    zIndex: 10,
    borderBottomWidth: 1,
    borderBottomColor: APP_CONFIG.colors.overlay.dark,
  },
  scrollContent: {
    paddingTop: APP_CONFIG.spacing.sm,
    paddingHorizontal: APP_CONFIG.spacing.lg,
    paddingBottom: 60,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: APP_CONFIG.spacing.xl,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoIcon: {
    backgroundColor: APP_CONFIG.colors.overlay.light,
    padding: APP_CONFIG.spacing.xs,
    borderRadius: APP_CONFIG.borderRadius.sm,
    marginRight: APP_CONFIG.spacing.sm,
  },
  logo: {
    fontSize: 28,
    fontWeight: 'bold',
    color: APP_CONFIG.colors.text.primary,
    fontFamily: 'System',
  },
  headerIcons: {
    flexDirection: 'row',
  },
  iconBtn: {
    marginLeft: APP_CONFIG.spacing.md,
    padding: APP_CONFIG.spacing.xs,
    borderRadius: APP_CONFIG.borderRadius.sm,
    backgroundColor: APP_CONFIG.colors.secondary,
    ...APP_CONFIG.shadows.light,
  },
  cmeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: APP_CONFIG.colors.secondary,
    padding: APP_CONFIG.spacing.md,
    borderRadius: APP_CONFIG.borderRadius.xl,
    marginBottom: APP_CONFIG.spacing.lg,
    ...APP_CONFIG.shadows.medium,
  },
  cmeLeft: { flex: 3 },
  cmeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: APP_CONFIG.spacing.xs,
  },
  cmeLabel: {
    fontSize: 14,
    color: APP_CONFIG.colors.text.secondary,
    marginLeft: APP_CONFIG.spacing.xs,
  },
  cmeMainValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: APP_CONFIG.colors.text.primary,
    marginBottom: APP_CONFIG.spacing.xs,
  },
  cmeToday: {
    fontSize: 14,
    color: APP_CONFIG.colors.text.tertiary,
  },
  cmeRight: {
    flex: 1,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  cmeProgress: {
    alignItems: 'center',
  },
  progressBar: {
    width: 60,
    height: 4,
    backgroundColor: APP_CONFIG.colors.overlay.dark,
    borderRadius: 2,
    marginBottom: APP_CONFIG.spacing.xs,
  },
  progressFill: {
    height: '100%',
    backgroundColor: APP_CONFIG.colors.success,
    borderRadius: 2,
  },
  cmePercentage: {
    fontSize: 18,
    fontWeight: '600',
    color: APP_CONFIG.colors.success,
  },
  actions: {
    flexDirection: 'row',
    marginBottom: APP_CONFIG.spacing.xl,
  },
  primaryBtn: {
    flex: 1,
    backgroundColor: APP_CONFIG.colors.text.primary,
    paddingVertical: 16,
    borderRadius: APP_CONFIG.borderRadius.xl,
    marginRight: APP_CONFIG.spacing.sm,
    ...APP_CONFIG.shadows.medium,
  },
  btnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: APP_CONFIG.colors.secondary,
    textAlign: 'center',
    fontWeight: 'bold',
    marginLeft: APP_CONFIG.spacing.xs,
  },
  outlineBtn: {
    flex: 1,
    borderWidth: 2,
    borderColor: APP_CONFIG.colors.text.primary,
    paddingVertical: 16,
    borderRadius: APP_CONFIG.borderRadius.xl,
    backgroundColor: APP_CONFIG.colors.secondary,
    ...APP_CONFIG.shadows.light,
  },
  outlineBtnText: {
    color: APP_CONFIG.colors.text.primary,
    textAlign: 'center',
    fontWeight: 'bold',
    marginLeft: APP_CONFIG.spacing.xs,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: APP_CONFIG.spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  subHeading: {
    fontSize: 18,
    color: APP_CONFIG.colors.text.primary,
    fontWeight: '600',
    marginLeft: APP_CONFIG.spacing.sm,
  },
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewAll: {
    color: APP_CONFIG.colors.info,
    fontSize: 14,
    marginRight: APP_CONFIG.spacing.xs,
  },
  card: {
    width: screenDimensions.width * 0.6,
    backgroundColor: APP_CONFIG.colors.secondary,
    padding: APP_CONFIG.spacing.md,
    borderRadius: APP_CONFIG.borderRadius.xl,
    marginRight: APP_CONFIG.spacing.md,
    ...APP_CONFIG.shadows.medium,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: APP_CONFIG.spacing.sm,
  },
  cardIconContainer: {
    backgroundColor: APP_CONFIG.colors.overlay.light,
    padding: APP_CONFIG.spacing.xs,
    borderRadius: APP_CONFIG.borderRadius.sm,
  },
  cardSymbol: {
    fontSize: 16,
    fontWeight: 'bold',
    color: APP_CONFIG.colors.text.primary,
  },
  cardName: {
    fontSize: 12,
    color: APP_CONFIG.colors.text.secondary,
    marginBottom: APP_CONFIG.spacing.sm,
  },
  cardPrice: {
    fontSize: 18,
    fontWeight: '600',
    color: APP_CONFIG.colors.text.primary,
  },
  cardTrend: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: APP_CONFIG.spacing.xs,
  },
  cardTrendText: {
    marginLeft: APP_CONFIG.spacing.xs,
    fontSize: 14,
  },
  graphImage: {
    width: '100%',
    height: 60,
    resizeMode: 'contain',
    marginTop: APP_CONFIG.spacing.sm,
  },
  trendingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: APP_CONFIG.spacing.sm,
    borderBottomColor: APP_CONFIG.colors.overlay.dark,
    borderBottomWidth: 1,
  },
  trendingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trendingIcon: {
    backgroundColor: APP_CONFIG.colors.overlay.light,
    padding: APP_CONFIG.spacing.xs,
    borderRadius: APP_CONFIG.borderRadius.sm,
    marginRight: APP_CONFIG.spacing.sm,
  },
  trendingName: {
    color: APP_CONFIG.colors.text.primary,
    fontSize: 16,
  },
  trendingChange: {
    fontSize: 16,
    marginLeft: APP_CONFIG.spacing.xs,
  },
  footerCard: {
    backgroundColor: APP_CONFIG.colors.secondary,
    padding: APP_CONFIG.spacing.md,
    marginTop: APP_CONFIG.spacing.lg,
    borderRadius: APP_CONFIG.borderRadius.xl,
    ...APP_CONFIG.shadows.light,
  },
  footerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerText: {
    color: APP_CONFIG.colors.text.secondary,
    fontSize: 13,
    textAlign: 'center',
    marginLeft: APP_CONFIG.spacing.sm,
  },
  missionCard: {
    backgroundColor: APP_CONFIG.colors.secondary,
    padding: APP_CONFIG.spacing.md,
    borderRadius: APP_CONFIG.borderRadius.xl,
    marginBottom: APP_CONFIG.spacing.lg,
    ...APP_CONFIG.shadows.medium,
  },
  missionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: APP_CONFIG.spacing.sm,
  },
  missionIcon: {
    backgroundColor: APP_CONFIG.colors.overlay.light,
    padding: APP_CONFIG.spacing.xs,
    borderRadius: APP_CONFIG.borderRadius.sm,
  },
  missionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: APP_CONFIG.colors.text.primary,
    marginLeft: APP_CONFIG.spacing.sm,
  },
  statusBadge: {
    backgroundColor: APP_CONFIG.colors.success,
    padding: APP_CONFIG.spacing.xs,
    borderRadius: APP_CONFIG.borderRadius.sm,
    marginLeft: APP_CONFIG.spacing.sm,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: APP_CONFIG.colors.secondary,
    marginRight: APP_CONFIG.spacing.xs,
  },
  statusText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: APP_CONFIG.colors.secondary,
  },
  missionDetails: {
    marginTop: APP_CONFIG.spacing.sm,
  },
  missionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: APP_CONFIG.spacing.xs,
  },
  missionLabel: {
    fontSize: 14,
    color: APP_CONFIG.colors.text.secondary,
    marginLeft: APP_CONFIG.spacing.xs,
    marginRight: APP_CONFIG.spacing.sm,
  },
  missionValue: {
    fontSize: 14,
    color: APP_CONFIG.colors.text.primary,
    flex: 1,
  },
  alertCard: {
    backgroundColor: APP_CONFIG.colors.secondary,
    padding: APP_CONFIG.spacing.md,
    borderRadius: APP_CONFIG.borderRadius.xl,
    marginBottom: APP_CONFIG.spacing.lg,
    ...APP_CONFIG.shadows.medium,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: APP_CONFIG.spacing.sm,
  },
  alertIcon: {
    backgroundColor: APP_CONFIG.colors.overlay.light,
    padding: APP_CONFIG.spacing.xs,
    borderRadius: APP_CONFIG.borderRadius.sm,
  },
  alertTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: APP_CONFIG.colors.text.primary,
    marginLeft: APP_CONFIG.spacing.sm,
    flex: 1,
  },
  alertBadge: {
    backgroundColor: APP_CONFIG.colors.warning,
    paddingHorizontal: APP_CONFIG.spacing.sm,
    paddingVertical: APP_CONFIG.spacing.xs,
    borderRadius: APP_CONFIG.borderRadius.sm,
  },
  alertBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: APP_CONFIG.colors.secondary,
  },
  alertText: {
    fontSize: 14,
    color: APP_CONFIG.colors.text.secondary,
    marginBottom: APP_CONFIG.spacing.sm,
  },
  alertFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  alertTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  alertTime: {
    fontSize: 14,
    color: APP_CONFIG.colors.text.tertiary,
    marginLeft: APP_CONFIG.spacing.xs,
  },
  alertButton: {
    backgroundColor: APP_CONFIG.colors.text.primary,
    padding: APP_CONFIG.spacing.xs,
    borderRadius: APP_CONFIG.borderRadius.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  alertButtonText: {
    color: APP_CONFIG.colors.secondary,
    fontWeight: 'bold',
    marginRight: APP_CONFIG.spacing.xs,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: APP_CONFIG.spacing.sm,
    backgroundColor: APP_CONFIG.colors.overlay.light,
    paddingHorizontal: APP_CONFIG.spacing.xs,
    paddingVertical: 2,
    borderRadius: APP_CONFIG.borderRadius.sm,
    alignSelf: 'flex-start',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: APP_CONFIG.colors.success,
    marginRight: 4,
  },
  liveText: {
    fontSize: 10,
    fontWeight: '700',
    color: APP_CONFIG.colors.success,
    letterSpacing: 0.5,
  },
  trendingContent: {
    flex: 1,
  },
  trendingValue: {
    fontSize: 12,
    color: APP_CONFIG.colors.text.tertiary,
    marginTop: 2,
  },
  solarObservationCard: {
    marginBottom: APP_CONFIG.spacing.xl,
  },
  solarObservationTouchable: {
    backgroundColor: APP_CONFIG.colors.secondary,
    borderRadius: APP_CONFIG.borderRadius.xl,
    padding: APP_CONFIG.spacing.lg,
    borderWidth: 2,
    borderColor: `${APP_CONFIG.colors.warning}30`,
    ...APP_CONFIG.shadows.medium,
  },
  solarObservationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: APP_CONFIG.spacing.md,
  },
  solarObservationIcon: {
    width: 48,
    height: 48,
    borderRadius: APP_CONFIG.borderRadius.xl,
    backgroundColor: `${APP_CONFIG.colors.warning}20`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: APP_CONFIG.spacing.md,
  },
  solarObservationContent: {
    flex: 1,
  },
  solarObservationTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: APP_CONFIG.colors.text.primary,
    marginBottom: 4,
  },
  solarObservationDesc: {
    fontSize: 14,
    color: APP_CONFIG.colors.text.secondary,
    lineHeight: 20,
  },
  solarObservationArrow: {
    padding: APP_CONFIG.spacing.xs,
  },
  solarObservationFeatures: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: APP_CONFIG.colors.overlay.light,
    borderRadius: APP_CONFIG.borderRadius.lg,
    padding: APP_CONFIG.spacing.md,
  },
  solarFeature: {
    alignItems: 'center',
  },
  solarFeatureText: {
    fontSize: 12,
    color: APP_CONFIG.colors.text.secondary,
    marginTop: 4,
    fontWeight: '600',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    borderRadius: APP_CONFIG.borderRadius.xl,
  },
  loadingText: {
    fontSize: 14,
    color: APP_CONFIG.colors.text.primary,
    marginTop: APP_CONFIG.spacing.sm,
    fontWeight: '600',
  },
});