import { DailySummary, DataAnalyzer } from '../utils/dataAnalyzer';

export interface BlogPost {
  id: string;
  title: string;
  content: string;
  summary: string;
  date: string;
  tags: string[];
  readingTime: number;
  keyInsights: string[];
  technicalData: DailySummary;
}

export class BlogGenerator {
  private static readonly HF_API_URL = 'https://api-inference.huggingface.co/models/microsoft/DialoGPT-medium';
  private static readonly FALLBACK_MODEL = 'https://api-inference.huggingface.co/models/facebook/blenderbot-400M-distill';
  
  // Note: In production, this should be stored securely
  private static readonly HF_API_KEY = 'hf_your_api_key_here'; // Replace with actual key

  static async generateBlogFromSummary(summary: DailySummary): Promise<BlogPost> {
    try {
      // Format the data summary for the AI model
      const dataContext = this.formatDataForAI(summary);
      
      // Generate blog content using Hugging Face
      const generatedContent = await this.callHuggingFaceAPI(dataContext);
      
      // Process and enhance the generated content
      const processedContent = this.processGeneratedContent(generatedContent, summary);
      
      // Create the final blog post
      const blogPost: BlogPost = {
        id: `aditya-l1-${summary.date}-${Date.now()}`,
        title: this.generateTitle(summary),
        content: processedContent,
        summary: this.generateSummary(summary),
        date: summary.date,
        tags: this.generateTags(summary),
        readingTime: this.calculateReadingTime(processedContent),
        keyInsights: this.extractKeyInsights(summary),
        technicalData: summary
      };

      return blogPost;
    } catch (error) {
      console.error('Error generating blog:', error);
      // Fallback to template-based generation
      return this.generateFallbackBlog(summary);
    }
  }

  private static formatDataForAI(summary: DailySummary): string {
    const context = `
Generate a scientific blog post about Aditya-L1 solar wind observations for ${summary.date}.

Key Data Points:
- Spacecraft distance: ${(summary.spacecraftStatus.distanceFromEarth).toFixed(0)} km from Earth
- System temperature: ${summary.temperatureStatus.current.toFixed(1)}°C (${summary.temperatureStatus.status})
- Solar wind conditions: ${summary.solarWindConditions.protonFlux} proton flux, ${summary.solarWindConditions.alphaParticleActivity} alpha activity
- Anomalies detected: ${summary.anomalies.total} total (${summary.anomalies.highSeverity} high severity)
- Data quality: ${summary.dataQuality.completeness}% complete

Parameter Highlights:
${summary.parameters.map(p => {
  const info = this.getParameterInfo(p.parameter);
  return `- ${info.name}: ${p.mean.toFixed(2)} ${p.unit} (range: ${p.min.toFixed(2)}-${p.max.toFixed(2)}, trend: ${p.trendDirection})`;
}).join('\n')}

Key Events: ${summary.keyEvents.join(', ') || 'Normal operations'}

Write a professional, informative blog post suitable for space science enthusiasts and researchers.
    `;

    return context;
  }

  private static async callHuggingFaceAPI(prompt: string): Promise<string> {
    try {
      // Using a free model that doesn't require API key for basic functionality
      const response = await fetch('https://api-inference.huggingface.co/models/gpt2', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // 'Authorization': `Bearer ${this.HF_API_KEY}`, // Uncomment when you have API key
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: {
            max_length: 500,
            temperature: 0.7,
            do_sample: true,
            top_p: 0.9,
            repetition_penalty: 1.1
          }
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result[0]?.generated_text || '';
    } catch (error) {
      console.error('Hugging Face API error:', error);
      throw error;
    }
  }

  private static processGeneratedContent(generatedText: string, summary: DailySummary): string {
    // Clean and enhance the generated content
    let content = generatedText.trim();
    
    // Add structured sections if missing
    if (!content.includes('## ')) {
      content = this.addStructuredSections(content, summary);
    }
    
    // Ensure technical accuracy
    content = this.enhanceWithTechnicalData(content, summary);
    
    return content;
  }

  private static addStructuredSections(content: string, summary: DailySummary): string {
    const sections = [
      `# Aditya-L1 Solar Wind Analysis - ${summary.date}`,
      '',
      content,
      '',
      '## Mission Status',
      `The Aditya-L1 spacecraft continues its observations from ${(summary.spacecraftStatus.distanceFromEarth).toFixed(0)} km from Earth. System temperature is currently ${summary.temperatureStatus.current.toFixed(1)}°C, indicating ${summary.temperatureStatus.status} operational conditions.`,
      '',
      '## Solar Wind Observations',
      this.generateSolarWindSection(summary),
      '',
      '## Data Quality and Anomalies',
      `Today's data collection achieved ${summary.dataQuality.completeness}% completeness with ${summary.dataQuality.reliability}% reliability. ${summary.anomalies.total > 0 ? `A total of ${summary.anomalies.total} anomalies were detected, including ${summary.anomalies.highSeverity} high-severity events.` : 'No significant anomalies were detected.'}`,
      '',
      '## Technical Summary',
      this.generateTechnicalSection(summary)
    ];

    return sections.join('\n');
  }

  private static enhanceWithTechnicalData(content: string, summary: DailySummary): string {
    // Add technical data points to make the content more accurate
    let enhanced = content;
    
    // Add specific measurements
    summary.parameters.forEach(param => {
      const info = this.getParameterInfo(param.parameter);
      const measurement = `${param.mean.toFixed(2)} ${param.unit}`;
      
      // Replace generic mentions with specific data
      enhanced = enhanced.replace(
        new RegExp(`${info.name.toLowerCase()}`, 'gi'),
        `${info.name} (${measurement})`
      );
    });

    return enhanced;
  }

  private static generateSolarWindSection(summary: DailySummary): string {
    const protonData = summary.parameters.find(p => p.parameter === 'proton_bulk_speed');
    const alphaData = summary.parameters.find(p => p.parameter === 'alpha_bulk_speed');
    const protonDensity = summary.parameters.find(p => p.parameter === 'proton_density');
    const alphaDensity = summary.parameters.find(p => p.parameter === 'alpha_density');

    return `Current solar wind conditions show ${summary.solarWindConditions.protonFlux} proton flux with average speeds of ${protonData?.mean.toFixed(1) || 'N/A'} km/s. Alpha particle activity is ${summary.solarWindConditions.alphaParticleActivity} with densities averaging ${alphaDensity?.mean.toFixed(3) || 'N/A'} cm⁻³. The magnetic field strength is characterized as ${summary.solarWindConditions.magneticFieldStrength} based on particle velocity measurements.`;
  }

  private static generateTechnicalSection(summary: DailySummary): string {
    const sections = summary.parameters.map(param => {
      const info = this.getParameterInfo(param.parameter);
      const thresholdStatus = param.threshold ? 
        (param.thresholdExceeded ? ' (THRESHOLD EXCEEDED)' : ' (within normal limits)') : '';
      
      return `**${info.name}**: ${param.mean.toFixed(2)} ± ${param.stdDev.toFixed(2)} ${param.unit} (range: ${param.min.toFixed(2)}-${param.max.toFixed(2)})${thresholdStatus}`;
    });

    return sections.join('\n\n');
  }

  private static generateTitle(summary: DailySummary): string {
    const date = new Date(summary.date).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    if (summary.anomalies.highSeverity > 0) {
      return `Aditya-L1 Detects Significant Solar Wind Anomalies - ${date}`;
    } else if (summary.solarWindConditions.protonFlux === 'high') {
      return `High Solar Wind Activity Observed by Aditya-L1 - ${date}`;
    } else if (summary.temperatureStatus.status === 'critical') {
      return `Aditya-L1 Temperature Alert and Solar Wind Analysis - ${date}`;
    } else {
      return `Aditya-L1 Daily Solar Wind Report - ${date}`;
    }
  }

  private static generateSummary(summary: DailySummary): string {
    const keyPoints = [
      `Solar wind conditions: ${summary.solarWindConditions.protonFlux} proton flux`,
      `System status: ${summary.temperatureStatus.status}`,
      `Data quality: ${summary.dataQuality.completeness}% complete`
    ];

    if (summary.anomalies.total > 0) {
      keyPoints.push(`${summary.anomalies.total} anomalies detected`);
    }

    return `Today's Aditya-L1 observations reveal ${keyPoints.join(', ')}. The spacecraft continues monitoring solar wind parameters from its L1 Lagrange point position.`;
  }

  private static generateTags(summary: DailySummary): string[] {
    const tags = ['Aditya-L1', 'Solar Wind', 'Space Weather', 'ISRO'];

    if (summary.solarWindConditions.protonFlux === 'high') {
      tags.push('High Solar Activity');
    }
    if (summary.anomalies.total > 0) {
      tags.push('Anomaly Detection');
    }
    if (summary.temperatureStatus.status !== 'normal') {
      tags.push('System Alert');
    }
    
    tags.push('L1 Lagrange Point', 'Plasma Physics', 'Space Science');

    return tags;
  }

  private static calculateReadingTime(content: string): number {
    const wordsPerMinute = 200;
    const wordCount = content.split(/\s+/).length;
    return Math.ceil(wordCount / wordsPerMinute);
  }

  private static extractKeyInsights(summary: DailySummary): string[] {
    const insights: string[] = [];

    // Temperature insights
    if (summary.temperatureStatus.status === 'critical') {
      insights.push('Critical temperature conditions detected - system monitoring enhanced');
    } else if (summary.temperatureStatus.status === 'warning') {
      insights.push('Elevated system temperatures observed - within operational limits');
    }

    // Solar wind insights
    if (summary.solarWindConditions.protonFlux === 'high') {
      insights.push('High proton flux indicates active solar wind conditions');
    }

    // Anomaly insights
    if (summary.anomalies.highSeverity > 0) {
      insights.push(`${summary.anomalies.highSeverity} high-severity anomalies require further investigation`);
    }

    // Threshold insights
    const exceededParams = summary.parameters.filter(p => p.thresholdExceeded);
    if (exceededParams.length > 0) {
      insights.push(`Threshold exceedances detected in ${exceededParams.length} parameters`);
    }

    // Data quality insights
    if (summary.dataQuality.completeness < 90) {
      insights.push('Data collection completeness below optimal levels');
    }

    // Default insight if none found
    if (insights.length === 0) {
      insights.push('Normal solar wind conditions with stable spacecraft operations');
    }

    return insights;
  }

  private static generateFallbackBlog(summary: DailySummary): BlogPost {
    const content = DataAnalyzer.formatSummaryForBlog(summary);
    
    return {
      id: `aditya-l1-${summary.date}-fallback`,
      title: this.generateTitle(summary),
      content: content,
      summary: this.generateSummary(summary),
      date: summary.date,
      tags: this.generateTags(summary),
      readingTime: this.calculateReadingTime(content),
      keyInsights: this.extractKeyInsights(summary),
      technicalData: summary
    };
  }

  private static getParameterInfo(parameter: string): { name: string; unit: string } {
    const info = {
      proton_bulk_speed: { name: 'Proton Bulk Speed', unit: 'km/s' },
      alpha_bulk_speed: { name: 'Alpha Bulk Speed', unit: 'km/s' },
      proton_density: { name: 'Proton Density', unit: 'cm⁻³' },
      alpha_density: { name: 'Alpha Density', unit: 'cm⁻³' },
      fpga_temp_mon: { name: 'FPGA Temperature', unit: '°C' },
      score: { name: 'Anomaly Score', unit: '' }
    };

    return info[parameter as keyof typeof info] || { name: parameter, unit: '' };
  }
}