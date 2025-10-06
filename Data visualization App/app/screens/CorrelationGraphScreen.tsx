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

type Props = NativeStackScreenProps<RootStackParamList, 'CorrelationGraph'>;

const { width: screenWidth } = Dimensions.get('window');

interface CorrelationData {
  parameter1: string;
  parameter2: string;
  correlation: number;
  significance: 'high' | 'medium' | 'low';
}

const PARAMETERS = [
  'proton_bulk_speed',
  'alpha_bulk_speed', 
  'proton_density',
  'alpha_density',
  'fpga_temp_mon',
  'spacecraft_xpos',
  'spacecraft_ypos',
  'spacecraft_zpos',
  'score'
];

const PARAMETER_LABELS = {
  proton_bulk_speed: 'Proton Speed',
  alpha_bulk_speed: 'Alpha Speed',
  proton_density: 'Proton Density',
  alpha_density: 'Alpha Density',
  fpga_temp_mon: 'FPGA Temp',
  spacecraft_xpos: 'X Position',
  spacecraft_ypos: 'Y Position',
  spacecraft_zpos: 'Z Position',
  score: 'Anomaly Score'
};

export default function CorrelationGraphScreen({ navigation }: Props) {
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(50));
  const [correlationMatrix, setCorrelationMatrix] = useState<number[][]>([]);
  const [selectedCorrelations, setSelectedCorrelations] = useState<CorrelationData[]>([]);
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
      );

      // Calculate correlation matrix
      const matrix = calculateCorrelationMatrix(validData);
      setCorrelationMatrix(matrix);

      // Extract significant correlations
      const significantCorrelations = extractSignificantCorrelations(matrix);
      setSelectedCorrelations(significantCorrelations);
      
      setLoading(false);
      logger.info('Correlation data loaded', { 
        dataPoints: validData.length,
        correlations: significantCorrelations.length 
      }, 'CorrelationGraph');
    } catch (error) {
      logger.error('Failed to load correlation data', { error }, 'CorrelationGraph');
      setLoading(false);
    }
  };

  const calculateCorrelationMatrix = (data: any[]): number[][] => {
    const matrix: number[][] = [];
    
    for (let i = 0; i < PARAMETERS.length; i++) {
      matrix[i] = [];
      for (let j = 0; j < PARAMETERS.length; j++) {
        if (i === j) {
          matrix[i][j] = 1.0;
        } else {
          const correlation = calculatePearsonCorrelation(
            data.map(item => item[PARAMETERS[i]] || 0),
            data.map(item => item[PARAMETERS[j]] || 0)
          );
          matrix[i][j] = correlation;
        }
      }
    }
    
    return matrix;
  };

  const calculatePearsonCorrelation = (x: number[], y: number[]): number => {
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

  const extractSignificantCorrelations = (matrix: number[][]): CorrelationData[] => {
    const correlations: CorrelationData[] = [];
    
    for (let i = 0; i < PARAMETERS.length; i++) {
      for (let j = i + 1; j < PARAMETERS.length; j++) {
        const correlation = matrix[i][j];
        const absCorr = Math.abs(correlation);
        
        if (absCorr > 0.1) { // Only include correlations > 0.1
          correlations.push({
            parameter1: PARAMETERS[i],
            parameter2: PARAMETERS[j],
            correlation,
            significance: absCorr > 0.7 ? 'high' : absCorr > 0.4 ? 'medium' : 'low'
          });
        }
      }
    }
    
    return correlations.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));
  };

  const getCorrelationColor = (correlation: number): string => {
    const abs = Math.abs(correlation);
    if (abs > 0.7) return correlation > 0 ? '#10B981' : '#EF4444';
    if (abs > 0.4) return correlation > 0 ? '#F59E0B' : '#F97316';
    return '#6B7280';
  };

  const getSignificanceColor = (significance: string): string => {
    switch (significance) {
      case 'high': return APP_CONFIG.colors.success;
      case 'medium': return APP_CONFIG.colors.warning;
      case 'low': return APP_CONFIG.colors.info;
      default: return APP_CONFIG.colors.text.secondary;
    }
  };

  const renderCorrelationMatrix = () => {
    if (correlationMatrix.length === 0) return null;

    const cellSize = (screenWidth - APP_CONFIG.spacing.lg * 2 - 80) / PARAMETERS.length;

    return (
      <View style={styles.matrixContainer}>
        <Text style={styles.matrixTitle}>Correlation Matrix</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View>
            {/* Header row */}
            <View style={styles.matrixRow}>
              <View style={[styles.matrixCell, { width: 80 }]} />
              {PARAMETERS.map((param, index) => (
                <View key={index} style={[styles.matrixHeaderCell, { width: cellSize }]}>
                  <Text style={styles.matrixHeaderText} numberOfLines={1}>
                    {PARAMETER_LABELS[param as keyof typeof PARAMETER_LABELS]}
                  </Text>
                </View>
              ))}
            </View>
            
            {/* Data rows */}
            {PARAMETERS.map((rowParam, i) => (
              <View key={i} style={styles.matrixRow}>
                <View style={[styles.matrixLabelCell, { width: 80 }]}>
                  <Text style={styles.matrixLabelText} numberOfLines={2}>
                    {PARAMETER_LABELS[rowParam as keyof typeof PARAMETER_LABELS]}
                  </Text>
                </View>
                {PARAMETERS.map((colParam, j) => (
                  <View 
                    key={j} 
                    style={[
                      styles.matrixDataCell, 
                      { 
                        width: cellSize,
                        backgroundColor: i === j ? APP_CONFIG.colors.overlay.light : 
                          `${getCorrelationColor(correlationMatrix[i][j])}20`
                      }
                    ]}
                  >
                    <Text 
                      style={[
                        styles.matrixDataText,
                        { color: i === j ? APP_CONFIG.colors.text.primary : getCorrelationColor(correlationMatrix[i][j]) }
                      ]}
                    >
                      {correlationMatrix[i][j].toFixed(2)}
                    </Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    );
  };

  const renderCorrelationList = () => (
    <View style={styles.listContainer}>
      <View style={styles.listHeader}>
        <Text style={styles.listTitle}>Significant Correlations</Text>
        <View style={styles.correlationCount}>
          <Ionicons name="analytics" size={16} color={APP_CONFIG.colors.info} />
          <Text style={styles.countText}>{selectedCorrelations.length}</Text>
        </View>
      </View>
      {selectedCorrelations.slice(0, 10).map((item, index) => (
        <Animated.View 
          key={index} 
          style={[
            styles.correlationItem,
            {
              transform: [{ 
                translateX: new Animated.Value(-50).interpolate({
                  inputRange: [0, 1],
                  outputRange: [-50, 0]
                })
              }],
              opacity: fadeAnim,
            }
          ]}
        >
          <View style={styles.correlationHeader}>
            <View style={styles.correlationParams}>
              <View style={styles.parameterContainer}>
                <Text style={styles.parameterName}>
                  {PARAMETER_LABELS[item.parameter1 as keyof typeof PARAMETER_LABELS]}
                </Text>
              </View>
              <View style={[styles.correlationIcon, { backgroundColor: `${getCorrelationColor(item.correlation)}20` }]}>
                <Ionicons 
                  name={item.correlation > 0 ? "trending-up" : "trending-down"} 
                  size={18} 
                  color={getCorrelationColor(item.correlation)} 
                />
              </View>
              <View style={styles.parameterContainer}>
                <Text style={styles.parameterName}>
                  {PARAMETER_LABELS[item.parameter2 as keyof typeof PARAMETER_LABELS]}
                </Text>
              </View>
            </View>
            <View style={[styles.significanceBadge, { 
              backgroundColor: getSignificanceColor(item.significance),
              shadowColor: getSignificanceColor(item.significance),
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.3,
              shadowRadius: 4,
              elevation: 4,
            }]}>
              <Text style={styles.significanceText}>{item.significance.toUpperCase()}</Text>
            </View>
          </View>
          <View style={styles.correlationValue}>
            <View style={styles.correlationNumberContainer}>
              <Text style={[styles.correlationNumber, { color: getCorrelationColor(item.correlation) }]}>
                {item.correlation > 0 ? '+' : ''}{item.correlation.toFixed(3)}
              </Text>
              <Text style={styles.correlationStrength}>
                {Math.abs(item.correlation) > 0.7 ? 'Strong' : 
                 Math.abs(item.correlation) > 0.4 ? 'Moderate' : 'Weak'}
              </Text>
            </View>
            <View style={styles.correlationBarContainer}>
              <View style={styles.correlationBar}>
                <Animated.View 
                  style={[
                    styles.correlationBarFill,
                    {
                      width: `${Math.abs(item.correlation) * 100}%`,
                      backgroundColor: getCorrelationColor(item.correlation)
                    }
                  ]}
                />
              </View>
              <Text style={styles.correlationPercentage}>
                {(Math.abs(item.correlation) * 100).toFixed(0)}%
              </Text>
            </View>
          </View>
        </Animated.View>
      ))}
    </View>
  );

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
            <Text style={styles.headerTitle}>Correlation Analysis</Text>
            <Text style={styles.headerSubtitle}>Parameter Relationships</Text>
          </View>
        </Animated.View>

        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Legend */}
          <Animated.View 
            style={[
              styles.legendContainer,
              {
                transform: [{ translateY: slideAnim }],
                opacity: fadeAnim,
              }
            ]}
          >
            <Text style={styles.legendTitle}>Correlation Strength</Text>
            <View style={styles.legendItems}>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: '#10B981' }]} />
                <Text style={styles.legendText}>Strong Positive (&gt;0.7)</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: '#F59E0B' }]} />
                <Text style={styles.legendText}>Moderate Positive (0.4-0.7)</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: '#EF4444' }]} />
                <Text style={styles.legendText}>Strong Negative (&lt;-0.7)</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: '#F97316' }]} />
                <Text style={styles.legendText}>Moderate Negative (-0.4 to -0.7)</Text>
              </View>
            </View>
          </Animated.View>

          {!loading ? (
            <>
              {/* Correlation Matrix */}
              <Animated.View 
                style={[
                  styles.chartContainer,
                  {
                    transform: [{ translateY: slideAnim }],
                    opacity: fadeAnim,
                  }
                ]}
              >
                {renderCorrelationMatrix()}
              </Animated.View>

              {/* Correlation List */}
              <Animated.View 
                style={[
                  styles.chartContainer,
                  {
                    transform: [{ translateY: slideAnim }],
                    opacity: fadeAnim,
                  }
                ]}
              >
                {renderCorrelationList()}
              </Animated.View>
            </>
          ) : (
            <View style={styles.loadingContainer}>
              <Ionicons name="analytics" size={48} color={APP_CONFIG.colors.text.secondary} />
              <Text style={styles.loadingText}>Calculating correlations...</Text>
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
  legendContainer: {
    backgroundColor: APP_CONFIG.colors.secondary,
    borderRadius: APP_CONFIG.borderRadius.xl,
    padding: APP_CONFIG.spacing.md,
    marginBottom: APP_CONFIG.spacing.lg,
    ...APP_CONFIG.shadows.medium,
  },
  legendTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: APP_CONFIG.colors.text.primary,
    marginBottom: APP_CONFIG.spacing.sm,
  },
  legendItems: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: APP_CONFIG.spacing.md,
    marginBottom: APP_CONFIG.spacing.xs,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: APP_CONFIG.spacing.xs,
  },
  legendText: {
    fontSize: 12,
    color: APP_CONFIG.colors.text.secondary,
  },
  chartContainer: {
    backgroundColor: APP_CONFIG.colors.secondary,
    borderRadius: APP_CONFIG.borderRadius.xl,
    padding: APP_CONFIG.spacing.md,
    marginBottom: APP_CONFIG.spacing.lg,
    ...APP_CONFIG.shadows.medium,
  },
  matrixContainer: {
    alignItems: 'center',
  },
  matrixTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: APP_CONFIG.colors.text.primary,
    marginBottom: APP_CONFIG.spacing.md,
  },
  matrixRow: {
    flexDirection: 'row',
  },
  matrixCell: {
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: APP_CONFIG.colors.overlay.dark,
  },
  matrixHeaderCell: {
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: APP_CONFIG.colors.overlay.light,
    borderWidth: 0.5,
    borderColor: APP_CONFIG.colors.overlay.dark,
  },
  matrixHeaderText: {
    fontSize: 10,
    color: APP_CONFIG.colors.text.primary,
    fontWeight: '600',
    textAlign: 'center',
  },
  matrixLabelCell: {
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: APP_CONFIG.colors.overlay.light,
    borderWidth: 0.5,
    borderColor: APP_CONFIG.colors.overlay.dark,
  },
  matrixLabelText: {
    fontSize: 10,
    color: APP_CONFIG.colors.text.primary,
    fontWeight: '600',
    textAlign: 'center',
  },
  matrixDataCell: {
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: APP_CONFIG.colors.overlay.dark,
  },
  matrixDataText: {
    fontSize: 10,
    fontWeight: '600',
  },
  listContainer: {},
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: APP_CONFIG.spacing.md,
  },
  listTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: APP_CONFIG.colors.text.primary,
  },
  correlationCount: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: APP_CONFIG.colors.overlay.light,
    paddingHorizontal: APP_CONFIG.spacing.sm,
    paddingVertical: APP_CONFIG.spacing.xs,
    borderRadius: APP_CONFIG.borderRadius.lg,
  },
  countText: {
    fontSize: 14,
    fontWeight: '600',
    color: APP_CONFIG.colors.info,
    marginLeft: 4,
  },
  correlationItem: {
    backgroundColor: APP_CONFIG.colors.overlay.light,
    borderRadius: APP_CONFIG.borderRadius.xl,
    padding: APP_CONFIG.spacing.lg,
    marginBottom: APP_CONFIG.spacing.md,
    borderWidth: 1,
    borderColor: APP_CONFIG.colors.overlay.dark,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  correlationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: APP_CONFIG.spacing.sm,
  },
  correlationParams: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  parameterContainer: {
    flex: 1,
    backgroundColor: APP_CONFIG.colors.secondary,
    borderRadius: APP_CONFIG.borderRadius.lg,
    paddingHorizontal: APP_CONFIG.spacing.sm,
    paddingVertical: APP_CONFIG.spacing.xs,
    marginHorizontal: APP_CONFIG.spacing.xs,
  },
  parameterName: {
    fontSize: 12,
    color: APP_CONFIG.colors.text.primary,
    fontWeight: '600',
    textAlign: 'center',
  },
  correlationIcon: {
    width: 36,
    height: 36,
    borderRadius: APP_CONFIG.borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: APP_CONFIG.spacing.xs,
  },
  significanceBadge: {
    paddingHorizontal: APP_CONFIG.spacing.xs,
    paddingVertical: 2,
    borderRadius: APP_CONFIG.borderRadius.sm,
  },
  significanceText: {
    fontSize: 10,
    color: 'white',
    fontWeight: '600',
  },
  correlationValue: {
    marginTop: APP_CONFIG.spacing.sm,
  },
  correlationNumberContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: APP_CONFIG.spacing.xs,
  },
  correlationNumber: {
    fontSize: 20,
    fontWeight: '800',
  },
  correlationStrength: {
    fontSize: 12,
    color: APP_CONFIG.colors.text.secondary,
    fontWeight: '600',
  },
  correlationBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  correlationBar: {
    flex: 1,
    height: 6,
    backgroundColor: APP_CONFIG.colors.overlay.dark,
    borderRadius: 3,
    marginRight: APP_CONFIG.spacing.sm,
  },
  correlationBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  correlationPercentage: {
    fontSize: 12,
    color: APP_CONFIG.colors.text.secondary,
    fontWeight: '600',
    minWidth: 35,
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