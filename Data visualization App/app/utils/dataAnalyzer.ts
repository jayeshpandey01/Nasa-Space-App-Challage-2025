export interface DataSummary {
  parameter: string;
  min: number;
  max: number;
  mean: number;
  median: number;
  stdDev: number;
  percentile95: number;
  percentile5: number;
  totalReadings: number;
  validReadings: number;
  anomalyCount: number;
  trendDirection: 'increasing' | 'decreasing' | 'stable';
  unit: string;
  thresholdExceeded: boolean;
  threshold?: number;
}

export interface DailySummary {
  date: string;
  parameters: DataSummary[];
  spacecraftStatus: {
    position: { x: number; y: number; z: number };
    velocity: { x: number; y: number; z: number };
    distanceFromEarth: number;
  };
  temperatureStatus: {
    current: number;
    average: number;
    max: number;
    status: 'normal' | 'warning' | 'critical';
  };
  anomalies: {
    total: number;
    highSeverity: number;
    mediumSeverity: number;
    lowSeverity: number;
  };
  solarWindConditions: {
    protonFlux: 'low' | 'moderate' | 'high';
    alphaParticleActivity: 'low' | 'moderate' | 'high';
    magneticFieldStrength: 'weak' | 'moderate' | 'strong';
  };
  keyEvents: string[];
  dataQuality: {
    completeness: number; // percentage
    reliability: number; // percentage
  };
}

const THRESHOLDS = {
  alpha_density: 0.5463787529366685,
  proton_density: 22.915556332558364,
  proton_bulk_speed: 689.3782959903459,
  proton_thermal: 134.28368989932244
};

const PARAMETER_INFO = {
  proton_bulk_speed: { unit: 'km/s', name: 'Proton Bulk Speed' },
  alpha_bulk_speed: { unit: 'km/s', name: 'Alpha Bulk Speed' },
  proton_density: { unit: 'cm⁻³', name: 'Proton Density' },
  alpha_density: { unit: 'cm⁻³', name: 'Alpha Density' },
  fpga_temp_mon: { unit: '°C', name: 'FPGA Temperature' },
  spacecraft_xpos: { unit: 'km', name: 'X Position' },
  spacecraft_ypos: { unit: 'km', name: 'Y Position' },
  spacecraft_zpos: { unit: 'km', name: 'Z Position' },
  score: { unit: '', name: 'Anomaly Score' }
};

export class DataAnalyzer {
  static analyzeParameter(data: any[], parameterName: string): DataSummary {
    const validData = data
      .map(item => item[parameterName])
      .filter(value => value !== null && value !== undefined && value !== -1e+31 && !isNaN(value));

    if (validData.length === 0) {
      return {
        parameter: parameterName,
        min: 0,
        max: 0,
        mean: 0,
        median: 0,
        stdDev: 0,
        percentile95: 0,
        percentile5: 0,
        totalReadings: data.length,
        validReadings: 0,
        anomalyCount: 0,
        trendDirection: 'stable',
        unit: PARAMETER_INFO[parameterName as keyof typeof PARAMETER_INFO]?.unit || '',
        thresholdExceeded: false
      };
    }

    const sorted = [...validData].sort((a, b) => a - b);
    const n = validData.length;
    
    const min = Math.min(...validData);
    const max = Math.max(...validData);
    const mean = validData.reduce((sum, val) => sum + val, 0) / n;
    const median = n % 2 === 0 ? 
      (sorted[n/2 - 1] + sorted[n/2]) / 2 : 
      sorted[Math.floor(n/2)];
    
    const variance = validData.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
    const stdDev = Math.sqrt(variance);
    
    const percentile95 = sorted[Math.floor(0.95 * n)];
    const percentile5 = sorted[Math.floor(0.05 * n)];
    
    // Calculate trend direction
    const firstHalf = validData.slice(0, Math.floor(n/2));
    const secondHalf = validData.slice(Math.floor(n/2));
    const firstHalfMean = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
    const secondHalfMean = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;
    
    let trendDirection: 'increasing' | 'decreasing' | 'stable' = 'stable';
    const trendThreshold = stdDev * 0.1; // 10% of standard deviation
    
    if (secondHalfMean - firstHalfMean > trendThreshold) {
      trendDirection = 'increasing';
    } else if (firstHalfMean - secondHalfMean > trendThreshold) {
      trendDirection = 'decreasing';
    }
    
    // Count anomalies (values beyond 2 standard deviations)
    const anomalyCount = validData.filter(val => 
      Math.abs(val - mean) > 2 * stdDev
    ).length;
    
    // Check threshold
    const threshold = THRESHOLDS[parameterName as keyof typeof THRESHOLDS];
    const thresholdExceeded = threshold ? percentile95 > threshold : false;
    
    return {
      parameter: parameterName,
      min,
      max,
      mean,
      median,
      stdDev,
      percentile95,
      percentile5,
      totalReadings: data.length,
      validReadings: n,
      anomalyCount,
      trendDirection,
      unit: PARAMETER_INFO[parameterName as keyof typeof PARAMETER_INFO]?.unit || '',
      thresholdExceeded,
      threshold
    };
  }

  static generateDailySummary(data: any[]): DailySummary {
    const parameters = [
      'proton_bulk_speed',
      'alpha_bulk_speed',
      'proton_density',
      'alpha_density',
      'fpga_temp_mon',
      'score'
    ];

    const parameterSummaries = parameters.map(param => 
      this.analyzeParameter(data, param)
    );

    // Spacecraft status
    const validPositionData = data.filter(item => 
      item.spacecraft_xpos && item.spacecraft_ypos && item.spacecraft_zpos
    );
    
    const lastPosition = validPositionData[validPositionData.length - 1] || {};
    const spacecraftStatus = {
      position: {
        x: lastPosition.spacecraft_xpos || 0,
        y: lastPosition.spacecraft_ypos || 0,
        z: lastPosition.spacecraft_zpos || 0
      },
      velocity: {
        x: lastPosition.spacecraft_xvel || 0,
        y: lastPosition.spacecraft_yvel || 0,
        z: lastPosition.spacecraft_zvel || 0
      },
      distanceFromEarth: Math.sqrt(
        Math.pow(lastPosition.spacecraft_xpos || 0, 2) +
        Math.pow(lastPosition.spacecraft_ypos || 0, 2) +
        Math.pow(lastPosition.spacecraft_zpos || 0, 2)
      ) / 1000 // Convert to km
    };

    // Temperature status
    const tempSummary = this.analyzeParameter(data, 'fpga_temp_mon');
    const temperatureStatus = {
      current: tempSummary.max,
      average: tempSummary.mean,
      max: tempSummary.max,
      status: tempSummary.max > 1900 ? 'critical' as const : 
              tempSummary.max > 1800 ? 'warning' as const : 'normal' as const
    };

    // Anomaly analysis
    const anomalyScores = data
      .map(item => item.score || 0)
      .filter(score => score > 0);
    
    const anomalies = {
      total: anomalyScores.length,
      highSeverity: anomalyScores.filter(score => score > 0.7).length,
      mediumSeverity: anomalyScores.filter(score => score > 0.3 && score <= 0.7).length,
      lowSeverity: anomalyScores.filter(score => score > 0 && score <= 0.3).length
    };

    // Solar wind conditions
    const protonDensityMean = parameterSummaries.find(p => p.parameter === 'proton_density')?.mean || 0;
    const alphaDensityMean = parameterSummaries.find(p => p.parameter === 'alpha_density')?.mean || 0;
    const protonSpeedMean = parameterSummaries.find(p => p.parameter === 'proton_bulk_speed')?.mean || 0;

    const solarWindConditions = {
      protonFlux: protonDensityMean > 15 ? 'high' as const : 
                  protonDensityMean > 8 ? 'moderate' as const : 'low' as const,
      alphaParticleActivity: alphaDensityMean > 0.3 ? 'high' as const :
                            alphaDensityMean > 0.1 ? 'moderate' as const : 'low' as const,
      magneticFieldStrength: protonSpeedMean > 500 ? 'strong' as const :
                            protonSpeedMean > 350 ? 'moderate' as const : 'weak' as const
    };

    // Key events
    const keyEvents: string[] = [];
    
    if (temperatureStatus.status === 'critical') {
      keyEvents.push('Critical temperature alert detected');
    }
    if (anomalies.highSeverity > 0) {
      keyEvents.push(`${anomalies.highSeverity} high-severity anomalies detected`);
    }
    if (parameterSummaries.some(p => p.thresholdExceeded)) {
      keyEvents.push('Threshold exceedance detected in solar wind parameters');
    }
    if (solarWindConditions.protonFlux === 'high') {
      keyEvents.push('High proton flux conditions observed');
    }

    // Data quality
    const totalPossibleReadings = data.length * parameters.length;
    const totalValidReadings = parameterSummaries.reduce((sum, p) => sum + p.validReadings, 0);
    const completeness = (totalValidReadings / totalPossibleReadings) * 100;
    const reliability = Math.max(0, 100 - (anomalies.total / data.length) * 100);

    return {
      date: new Date().toISOString().split('T')[0],
      parameters: parameterSummaries,
      spacecraftStatus,
      temperatureStatus,
      anomalies,
      solarWindConditions,
      keyEvents,
      dataQuality: {
        completeness: Math.round(completeness * 100) / 100,
        reliability: Math.round(reliability * 100) / 100
      }
    };
  }

  static formatSummaryForBlog(summary: DailySummary): string {
    const formatNumber = (num: number, decimals: number = 2): string => {
      return num.toFixed(decimals);
    };

    let blogContent = `# Aditya-L1 Daily Solar Wind Report - ${summary.date}\n\n`;
    
    blogContent += `## Mission Status Overview\n`;
    blogContent += `- **Spacecraft Distance from Earth**: ${formatNumber(summary.spacecraftStatus.distanceFromEarth)} km\n`;
    blogContent += `- **System Temperature**: ${formatNumber(summary.temperatureStatus.current)}°C (${summary.temperatureStatus.status})\n`;
    blogContent += `- **Data Quality**: ${summary.dataQuality.completeness}% complete, ${summary.dataQuality.reliability}% reliable\n\n`;

    blogContent += `## Solar Wind Conditions\n`;
    blogContent += `- **Proton Flux**: ${summary.solarWindConditions.protonFlux}\n`;
    blogContent += `- **Alpha Particle Activity**: ${summary.solarWindConditions.alphaParticleActivity}\n`;
    blogContent += `- **Magnetic Field Strength**: ${summary.solarWindConditions.magneticFieldStrength}\n\n`;

    blogContent += `## Key Parameters Summary\n`;
    summary.parameters.forEach(param => {
      const info = PARAMETER_INFO[param.parameter as keyof typeof PARAMETER_INFO];
      if (info) {
        blogContent += `### ${info.name}\n`;
        blogContent += `- **Range**: ${formatNumber(param.min)} - ${formatNumber(param.max)} ${param.unit}\n`;
        blogContent += `- **Average**: ${formatNumber(param.mean)} ${param.unit}\n`;
        blogContent += `- **Trend**: ${param.trendDirection}\n`;
        if (param.threshold) {
          blogContent += `- **Threshold Status**: ${param.thresholdExceeded ? 'EXCEEDED' : 'Normal'} (${formatNumber(param.threshold)} ${param.unit})\n`;
        }
        blogContent += `- **Data Quality**: ${param.validReadings}/${param.totalReadings} valid readings\n\n`;
      }
    });

    if (summary.anomalies.total > 0) {
      blogContent += `## Anomaly Detection\n`;
      blogContent += `- **Total Anomalies**: ${summary.anomalies.total}\n`;
      blogContent += `- **High Severity**: ${summary.anomalies.highSeverity}\n`;
      blogContent += `- **Medium Severity**: ${summary.anomalies.mediumSeverity}\n`;
      blogContent += `- **Low Severity**: ${summary.anomalies.lowSeverity}\n\n`;
    }

    if (summary.keyEvents.length > 0) {
      blogContent += `## Key Events\n`;
      summary.keyEvents.forEach(event => {
        blogContent += `- ${event}\n`;
      });
      blogContent += `\n`;
    }

    return blogContent;
  }
}