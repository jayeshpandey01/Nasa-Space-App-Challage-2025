import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LineChart, BarChart } from 'react-native-chart-kit';
import { APP_CONFIG } from '../utils/constants';

const { width: screenWidth } = Dimensions.get('window');

interface InteractiveChartProps {
  data: any;
  type: 'line' | 'bar' | 'scatter';
  title: string;
  subtitle?: string;
  color: string;
  height?: number;
  showControls?: boolean;
  onDataPointPress?: (data: any) => void;
  customConfig?: any;
}

export default function InteractiveChart({
  data,
  type,
  title,
  subtitle,
  color,
  height = 220,
  showControls = true,
  onDataPointPress,
  customConfig,
}: InteractiveChartProps) {
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState(0);
  const [selectedDataPoint, setSelectedDataPoint] = useState<any>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const panRef = useRef(new Animated.Value(0)).current;

  const chartConfig = {
    backgroundColor: APP_CONFIG.colors.secondary,
    backgroundGradientFrom: APP_CONFIG.colors.secondary,
    backgroundGradientTo: APP_CONFIG.colors.secondary,
    decimalPlaces: 2,
    color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity * 0.8})`,
    style: {
      borderRadius: APP_CONFIG.borderRadius.lg,
    },
    propsForDots: {
      r: "6",
      strokeWidth: "3",
      stroke: color,
      fill: color,
    },
    propsForBackgroundLines: {
      strokeDasharray: "5,5",
      stroke: APP_CONFIG.colors.overlay.dark,
      strokeWidth: 1,
    },
    fillShadowGradient: color,
    fillShadowGradientOpacity: 0.3,
    ...customConfig,
  };

  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev * 1.2, 3));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev / 1.2, 0.5));
  };

  const handleReset = () => {
    setZoomLevel(1);
    setPanOffset(0);
    Animated.spring(panRef, {
      toValue: 0,
      useNativeDriver: true,
    }).start();
  };

  // Gesture handling removed for compatibility
  // Can be re-added with react-native-gesture-handler if needed

  const renderChart = () => {
    const chartWidth = screenWidth * zoomLevel - APP_CONFIG.spacing.lg * 2;
    
    switch (type) {
      case 'line':
        return (
          <LineChart
            data={data}
            width={chartWidth}
            height={height}
            chartConfig={chartConfig}
            style={styles.chart}
            onDataPointClick={(data) => {
              setSelectedDataPoint(data);
              setShowTooltip(true);
              onDataPointPress?.(data);
            }}
            withShadow={true}
            withDots={true}
            withInnerLines={true}
            withOuterLines={true}
            withVerticalLines={true}
            withHorizontalLines={true}
          />
        );
      case 'bar':
        return (
          <BarChart
            data={data}
            width={chartWidth}
            height={height}
            yAxisLabel=""
            yAxisSuffix=""
            chartConfig={chartConfig}
            style={styles.chart}
            showValuesOnTopOfBars={true}
            withInnerLines={true}
          />
        );
      default:
        return (
          <LineChart
            data={data}
            width={chartWidth}
            height={height}
            chartConfig={chartConfig}
            style={styles.chart}
          />
        );
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>{title}</Text>
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>
        
        {showControls && (
          <View style={styles.controls}>
            <TouchableOpacity 
              style={[styles.controlButton, { borderColor: color }]}
              onPress={handleZoomOut}
            >
              <Ionicons name="remove" size={16} color={color} />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.controlButton, { borderColor: color }]}
              onPress={handleReset}
            >
              <Ionicons name="refresh" size={16} color={color} />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.controlButton, { borderColor: color }]}
              onPress={handleZoomIn}
            >
              <Ionicons name="add" size={16} color={color} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Chart Container */}
      <View style={styles.chartContainer}>
        <Animated.View
          style={[
            styles.chartWrapper,
            {
              transform: [
                { scale: 1 },
              ],
            },
          ]}
        >
          {renderChart()}
        </Animated.View>
      </View>

      {/* Zoom Indicator */}
      {zoomLevel !== 1 && (
        <View style={styles.zoomIndicator}>
          <Text style={styles.zoomText}>Zoom: {zoomLevel.toFixed(1)}x</Text>
          {zoomLevel > 1 && (
            <Text style={styles.panHint}>Pan to explore data</Text>
          )}
        </View>
      )}

      {/* Data Point Tooltip */}
      {showTooltip && selectedDataPoint && (
        <View style={[styles.tooltip, { borderColor: color }]}>
          <TouchableOpacity 
            style={styles.tooltipClose}
            onPress={() => setShowTooltip(false)}
          >
            <Ionicons name="close" size={16} color={APP_CONFIG.colors.text.secondary} />
          </TouchableOpacity>
          
          <Text style={styles.tooltipTitle}>Data Point</Text>
          <Text style={styles.tooltipValue}>
            Value: {selectedDataPoint.value}
          </Text>
          <Text style={styles.tooltipIndex}>
            Index: {selectedDataPoint.index}
          </Text>
        </View>
      )}

      {/* Chart Statistics */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Ionicons name="trending-up" size={16} color={APP_CONFIG.colors.success} />
          <Text style={styles.statLabel}>Max</Text>
          <Text style={styles.statValue}>
            {Math.max(...(data.datasets?.[0]?.data || [0])).toFixed(2)}
          </Text>
        </View>
        
        <View style={styles.statItem}>
          <Ionicons name="trending-down" size={16} color={APP_CONFIG.colors.error} />
          <Text style={styles.statLabel}>Min</Text>
          <Text style={styles.statValue}>
            {Math.min(...(data.datasets?.[0]?.data || [0])).toFixed(2)}
          </Text>
        </View>
        
        <View style={styles.statItem}>
          <Ionicons name="analytics" size={16} color={APP_CONFIG.colors.info} />
          <Text style={styles.statLabel}>Avg</Text>
          <Text style={styles.statValue}>
            {(
              (data.datasets?.[0]?.data || [0]).reduce((a: number, b: number) => a + b, 0) /
              (data.datasets?.[0]?.data?.length || 1)
            ).toFixed(2)}
          </Text>
        </View>
        
        <View style={styles.statItem}>
          <Ionicons name="pulse" size={16} color={color} />
          <Text style={styles.statLabel}>Points</Text>
          <Text style={styles.statValue}>
            {data.datasets?.[0]?.data?.length || 0}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: APP_CONFIG.colors.secondary,
    borderRadius: APP_CONFIG.borderRadius.xl,
    padding: APP_CONFIG.spacing.md,
    marginBottom: APP_CONFIG.spacing.lg,
    ...APP_CONFIG.shadows.medium,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: APP_CONFIG.spacing.md,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: APP_CONFIG.colors.text.primary,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 14,
    color: APP_CONFIG.colors.text.secondary,
    opacity: 0.8,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  controlButton: {
    width: 32,
    height: 32,
    borderRadius: APP_CONFIG.borderRadius.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: APP_CONFIG.spacing.xs,
    backgroundColor: APP_CONFIG.colors.overlay.light,
  },
  chartContainer: {
    overflow: 'hidden',
    borderRadius: APP_CONFIG.borderRadius.lg,
  },
  chartWrapper: {
    alignItems: 'center',
  },
  chart: {
    borderRadius: APP_CONFIG.borderRadius.lg,
  },
  zoomIndicator: {
    alignItems: 'center',
    marginTop: APP_CONFIG.spacing.sm,
    paddingVertical: APP_CONFIG.spacing.xs,
    backgroundColor: APP_CONFIG.colors.overlay.light,
    borderRadius: APP_CONFIG.borderRadius.lg,
  },
  zoomText: {
    fontSize: 12,
    color: APP_CONFIG.colors.text.primary,
    fontWeight: '600',
  },
  panHint: {
    fontSize: 10,
    color: APP_CONFIG.colors.text.secondary,
    marginTop: 2,
  },
  tooltip: {
    position: 'absolute',
    top: 60,
    right: APP_CONFIG.spacing.md,
    backgroundColor: APP_CONFIG.colors.overlay.light,
    borderRadius: APP_CONFIG.borderRadius.lg,
    padding: APP_CONFIG.spacing.sm,
    borderWidth: 2,
    minWidth: 120,
    zIndex: 10,
  },
  tooltipClose: {
    position: 'absolute',
    top: 4,
    right: 4,
    padding: 4,
  },
  tooltipTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: APP_CONFIG.colors.text.primary,
    marginBottom: 4,
  },
  tooltipValue: {
    fontSize: 11,
    color: APP_CONFIG.colors.text.secondary,
    marginBottom: 2,
  },
  tooltipIndex: {
    fontSize: 11,
    color: APP_CONFIG.colors.text.secondary,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: APP_CONFIG.spacing.md,
    paddingTop: APP_CONFIG.spacing.md,
    borderTopWidth: 1,
    borderTopColor: APP_CONFIG.colors.overlay.dark,
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 10,
    color: APP_CONFIG.colors.text.secondary,
    marginTop: 2,
    fontWeight: '600',
  },
  statValue: {
    fontSize: 12,
    color: APP_CONFIG.colors.text.primary,
    fontWeight: '700',
    marginTop: 2,
  },
});