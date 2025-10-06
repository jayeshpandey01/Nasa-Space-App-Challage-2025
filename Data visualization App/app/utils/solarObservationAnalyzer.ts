export interface SolarObservation {
  file_name: string;
  date_obs: string;
  instrument: string;
  wavelength: string;
  exposure_time: string;
  observer: string;
  jpg_path: string;
}

export interface SolarObservationSummary {
  date: string;
  totalObservations: number;
  observationPeriod: {
    start: string;
    end: string;
    durationMinutes: number;
  };
  instrumentData: {
    wavelength: string;
    averageExposureTime: number;
    observer: string;
    instrument: string;
  };
  temporalAnalysis: {
    observationInterval: number; // Average minutes between observations
    observationFrequency: number; // Observations per hour
    timeGaps: number[]; // Gaps between observations in minutes
  };
  qualityMetrics: {
    consistentWavelength: boolean;
    consistentExposure: boolean;
    dataCompleteness: number; // Percentage
    temporalConsistency: number; // Percentage
  };
  keyEvents: string[];
  solarActivity: {
    observationCount: number;
    wavelengthType: 'UV' | 'Visible' | 'IR' | 'Unknown';
    activityLevel: 'Low' | 'Moderate' | 'High';
  };
}

export class SolarObservationAnalyzer {
  static analyzeSolarObservations(data: SolarObservation[]): SolarObservationSummary {
    if (data.length === 0) {
      throw new Error('No solar observation data provided');
    }

    // Sort data by observation time
    const sortedData = [...data].sort((a, b) => 
      new Date(a.date_obs).getTime() - new Date(b.date_obs).getTime()
    );

    const startTime = new Date(sortedData[0].date_obs);
    const endTime = new Date(sortedData[sortedData.length - 1].date_obs);
    const durationMinutes = (endTime.getTime() - startTime.getTime()) / (1000 * 60);

    // Analyze temporal patterns
    const timeGaps = this.calculateTimeGaps(sortedData);
    const averageInterval = timeGaps.reduce((sum, gap) => sum + gap, 0) / timeGaps.length;
    const observationFrequency = 60 / averageInterval; // Observations per hour

    // Analyze instrument data
    const wavelengths = sortedData.map(obs => obs.wavelength);
    const exposureTimes = sortedData.map(obs => parseFloat(obs.exposure_time));
    const averageExposureTime = exposureTimes.reduce((sum, time) => sum + time, 0) / exposureTimes.length;

    // Quality metrics
    const consistentWavelength = new Set(wavelengths).size === 1;
    const consistentExposure = new Set(exposureTimes).size === 1;
    const dataCompleteness = this.calculateDataCompleteness(sortedData, durationMinutes);
    const temporalConsistency = this.calculateTemporalConsistency(timeGaps);

    // Generate key events
    const keyEvents = this.generateKeyEvents(sortedData, timeGaps, durationMinutes);

    // Determine solar activity level
    const activityLevel = this.determineSolarActivityLevel(sortedData, observationFrequency);
    const wavelengthType = this.determineWavelengthType(wavelengths[0]);

    return {
      date: startTime.toISOString().split('T')[0],
      totalObservations: sortedData.length,
      observationPeriod: {
        start: startTime.toISOString(),
        end: endTime.toISOString(),
        durationMinutes: Math.round(durationMinutes)
      },
      instrumentData: {
        wavelength: wavelengths[0],
        averageExposureTime: Math.round(averageExposureTime * 1000) / 1000,
        observer: sortedData[0].observer,
        instrument: sortedData[0].instrument
      },
      temporalAnalysis: {
        observationInterval: Math.round(averageInterval * 100) / 100,
        observationFrequency: Math.round(observationFrequency * 100) / 100,
        timeGaps: timeGaps.map(gap => Math.round(gap * 100) / 100)
      },
      qualityMetrics: {
        consistentWavelength,
        consistentExposure,
        dataCompleteness: Math.round(dataCompleteness * 100) / 100,
        temporalConsistency: Math.round(temporalConsistency * 100) / 100
      },
      keyEvents,
      solarActivity: {
        observationCount: sortedData.length,
        wavelengthType,
        activityLevel
      }
    };
  }

  private static calculateTimeGaps(sortedData: SolarObservation[]): number[] {
    const gaps: number[] = [];
    
    for (let i = 1; i < sortedData.length; i++) {
      const prevTime = new Date(sortedData[i - 1].date_obs).getTime();
      const currentTime = new Date(sortedData[i].date_obs).getTime();
      const gapMinutes = (currentTime - prevTime) / (1000 * 60);
      gaps.push(gapMinutes);
    }
    
    return gaps;
  }

  private static calculateDataCompleteness(data: SolarObservation[], durationMinutes: number): number {
    // Assume ideal observation frequency is every 1.5 minutes (based on the data pattern)
    const idealObservations = Math.floor(durationMinutes / 1.5);
    return Math.min(100, (data.length / idealObservations) * 100);
  }

  private static calculateTemporalConsistency(timeGaps: number[]): number {
    if (timeGaps.length === 0) return 100;
    
    const averageGap = timeGaps.reduce((sum, gap) => sum + gap, 0) / timeGaps.length;
    const variance = timeGaps.reduce((sum, gap) => sum + Math.pow(gap - averageGap, 2), 0) / timeGaps.length;
    const standardDeviation = Math.sqrt(variance);
    
    // Lower standard deviation means higher consistency
    const consistencyScore = Math.max(0, 100 - (standardDeviation / averageGap) * 100);
    return consistencyScore;
  }

  private static generateKeyEvents(
    data: SolarObservation[], 
    timeGaps: number[], 
    durationMinutes: number
  ): string[] {
    const events: string[] = [];
    
    // Check for observation gaps
    const largeGaps = timeGaps.filter(gap => gap > 5); // Gaps larger than 5 minutes
    if (largeGaps.length > 0) {
      events.push(`${largeGaps.length} observation gaps detected (>5 min)`);
    }
    
    // Check observation frequency
    const observationFrequency = (data.length / durationMinutes) * 60; // per hour
    if (observationFrequency > 30) {
      events.push('High-frequency solar monitoring active');
    } else if (observationFrequency < 10) {
      events.push('Low-frequency monitoring mode detected');
    }
    
    // Check for wavelength consistency
    const wavelengths = new Set(data.map(obs => obs.wavelength));
    if (wavelengths.size === 1) {
      events.push(`Consistent ${data[0].wavelength}Å wavelength monitoring`);
    } else {
      events.push(`Multi-wavelength observations: ${Array.from(wavelengths).join(', ')}Å`);
    }
    
    // Check exposure time patterns
    const exposureTimes = data.map(obs => parseFloat(obs.exposure_time));
    const uniqueExposures = new Set(exposureTimes);
    if (uniqueExposures.size === 1) {
      events.push(`Stable ${exposureTimes[0]}s exposure time maintained`);
    }
    
    return events;
  }

  private static determineSolarActivityLevel(
    data: SolarObservation[], 
    observationFrequency: number
  ): 'Low' | 'Moderate' | 'High' {
    // Base activity level on observation frequency and consistency
    if (observationFrequency > 25) {
      return 'High';
    } else if (observationFrequency > 15) {
      return 'Moderate';
    } else {
      return 'Low';
    }
  }

  private static determineWavelengthType(wavelength: string): 'UV' | 'Visible' | 'IR' | 'Unknown' {
    const wl = parseFloat(wavelength);
    
    if (wl < 400) {
      return 'UV';
    } else if (wl >= 400 && wl <= 700) {
      return 'Visible';
    } else if (wl > 700) {
      return 'IR';
    } else {
      return 'Unknown';
    }
  }

  static formatSummaryForDisplay(summary: SolarObservationSummary): string {
    const startTime = new Date(summary.observationPeriod.start);
    const endTime = new Date(summary.observationPeriod.end);
    
    return `
# Solar Observation Summary - ${summary.date}

## Observation Overview
- **Total Observations**: ${summary.totalObservations}
- **Observation Period**: ${startTime.toLocaleTimeString()} - ${endTime.toLocaleTimeString()}
- **Duration**: ${summary.observationPeriod.durationMinutes} minutes
- **Observer**: ${summary.instrumentData.observer}

## Instrument Configuration
- **Wavelength**: ${summary.instrumentData.wavelength}Å (${summary.solarActivity.wavelengthType})
- **Average Exposure**: ${summary.instrumentData.averageExposureTime}s
- **Instrument**: ${summary.instrumentData.instrument}

## Temporal Analysis
- **Observation Interval**: ${summary.temporalAnalysis.observationInterval} minutes
- **Observation Frequency**: ${summary.temporalAnalysis.observationFrequency} per hour
- **Solar Activity Level**: ${summary.solarActivity.activityLevel}

## Data Quality Metrics
- **Data Completeness**: ${summary.qualityMetrics.dataCompleteness}%
- **Temporal Consistency**: ${summary.qualityMetrics.temporalConsistency}%
- **Wavelength Consistency**: ${summary.qualityMetrics.consistentWavelength ? 'Yes' : 'No'}
- **Exposure Consistency**: ${summary.qualityMetrics.consistentExposure ? 'Yes' : 'No'}

## Key Events
${summary.keyEvents.map(event => `- ${event}`).join('\n')}

## Technical Details
- **Observation Count**: ${summary.solarActivity.observationCount}
- **Average Time Gap**: ${summary.temporalAnalysis.observationInterval} minutes
- **Wavelength Type**: ${summary.solarActivity.wavelengthType} spectrum
    `;
  }

  static generateTimeSeriesData(data: SolarObservation[]): Array<{
    timestamp: string;
    observationIndex: number;
    timeGap: number;
    exposureTime: number;
    wavelength: number;
  }> {
    const sortedData = [...data].sort((a, b) => 
      new Date(a.date_obs).getTime() - new Date(b.date_obs).getTime()
    );

    const timeGaps = this.calculateTimeGaps(sortedData);
    
    return sortedData.map((obs, index) => ({
      timestamp: obs.date_obs,
      observationIndex: index,
      timeGap: index > 0 ? timeGaps[index - 1] : 0,
      exposureTime: parseFloat(obs.exposure_time),
      wavelength: parseFloat(obs.wavelength)
    }));
  }
}