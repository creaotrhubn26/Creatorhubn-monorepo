/**
 * SPEED RAMP ENGINE
 * Time remapping, speed curves, freeze frames
 * Like Premiere Pro's Time Remapping & After Effects
 */

export type SpeedCurveType = 
  | 'linear'
  | 'ease_in'
  | 'ease_out'
  | 'ease_in_out'
  | 'bezier';

export interface SpeedKeyframe {
  time: number;        // Time in clip (seconds)
  speed: number;       // Speed multiplier (0.25 = 25%, 2.0 = 200%)
  curveType: SpeedCurveType;
  bezierHandles?: {
    in: { x: number; y: number };
    out: { x: number; y: number };
  };
}

export interface SpeedRamp {
  id: string;
  clipId: string;
  keyframes: SpeedKeyframe[];
  preservePitch: boolean; // Keep audio pitch when changing speed
}

export interface SpeedPreset {
  name: string;
  description: string;
  keyframes: Omit<SpeedKeyframe, 'time'>[];
  duration: number; // Total duration of preset
  category: 'action' | 'cinematic' | 'freeze' | 'reverse' | 'creative';
}

/**
 * Speed Ramp Engine
 */
export class SpeedRampEngine {
  /**
   * Calculate speed at a given time based on keyframes
   */
  static getSpeedAtTime(time: number, keyframes: SpeedKeyframe[]): number {
    if (keyframes.length === 0) return 1.0;
    if (keyframes.length === 1) return keyframes[0].speed;
    
    // Sort keyframes by time
    const sorted = [...keyframes].sort((a, b) => a.time - b.time);
    
    // Before first keyframe
    if (time <= sorted[0].time) {
      return sorted[0].speed;
    }
    
    // After last keyframe
    if (time >= sorted[sorted.length - 1].time) {
      return sorted[sorted.length - 1].speed;
    }
    
    // Find surrounding keyframes
    for (let i = 0; i < sorted.length - 1; i++) {
      const curr = sorted[i];
      const next = sorted[i + 1];
      
      if (time >= curr.time && time <= next.time) {
        const t = (time - curr.time) / (next.time - curr.time);
        return this.interpolateSpeed(curr, next, t);
      }
    }
    
    return 1.0;
  }
  
  /**
   * Interpolate speed between two keyframes
   */
  private static interpolateSpeed(
    from: SpeedKeyframe,
    to: SpeedKeyframe,
    t: number
  ): number {
    // Apply curve
    const curvedT = this.applyCurve(t, from.curveType);
    
    // Linear interpolation with curve
    return from.speed + (to.speed - from.speed) * curvedT;
  }
  
  /**
   * Apply easing curve to t
   */
  private static applyCurve(t: number, curve: SpeedCurveType): number {
    switch (curve) {
      case 'linear':
        return t;
      case 'ease_in':
        return t * t * t; // Cubic ease in
      case 'ease_out':
        return 1 - Math.pow(1 - t, 3); // Cubic ease out
      case 'ease_in_out':
        return t < 0.5
          ? 4 * t * t * t
          : 1 - Math.pow(-2 * t + 2, 3) / 2;
      case 'bezier':
        // Would use bezier handles here
        return t;
      default:
        return t;
    }
  }
  
  /**
   * Calculate remapped time (original time -> new time after speed changes)
   */
  static remapTime(originalTime: number, keyframes: SpeedKeyframe[]): number {
    if (keyframes.length === 0) return originalTime;
    
    const sorted = [...keyframes].sort((a, b) => a.time - b.time);
    let remappedTime = 0;
    let lastKeyframeTime = 0;
    
    for (let i = 0; i < sorted.length; i++) {
      const keyframe = sorted[i];
      
      if (originalTime <= keyframe.time) {
        // Calculate time between last keyframe and current position
        const deltaTime = originalTime - lastKeyframeTime;
        const avgSpeed = i === 0 
          ? keyframe.speed 
          : (sorted[i - 1].speed + keyframe.speed) / 2;
        
        remappedTime += deltaTime * avgSpeed;
        break;
      } else {
        // Add time for this segment
        const deltaTime = keyframe.time - lastKeyframeTime;
        const avgSpeed = i === 0 
          ? keyframe.speed 
          : (sorted[i - 1].speed + keyframe.speed) / 2;
        
        remappedTime += deltaTime * avgSpeed;
        lastKeyframeTime = keyframe.time;
      }
    }
    
    // If past last keyframe
    if (originalTime > sorted[sorted.length - 1].time) {
      const deltaTime = originalTime - sorted[sorted.length - 1].time;
      remappedTime += deltaTime * sorted[sorted.length - 1].speed;
    }
    
    return remappedTime;
  }
  
  /**
   * Get duration after speed ramping
   */
  static getRemappedDuration(originalDuration: number, keyframes: SpeedKeyframe[]): number {
    return this.remapTime(originalDuration, keyframes);
  }
  
  /**
   * Speed presets (like Premiere Pro presets)
   */
  static getSpeedPresets(): SpeedPreset[] {
    return [
      // ACTION
      {
        name: 'Action Ramp',
        description: 'Fast → Slow → Fast (dramatic action)',
        category: 'action',
        duration: 3.0,
        keyframes: [
          { speed: 2.0, curveType: 'ease_in_out' },      // 0s: 200% speed
          { speed: 0.25, curveType: 'ease_in_out' },     // 1.5s: 25% slow-mo
          { speed: 2.0, curveType: 'ease_in_out' }       // 3s: 200% speed
        ]
      },
      {
        name: 'Quick Slow-Mo',
        description: 'Normal → Slow → Normal',
        category: 'action',
        duration: 2.0,
        keyframes: [
          { speed: 1.0, curveType: 'ease_in' },
          { speed: 0.3, curveType: 'ease_out' },
          { speed: 1.0, curveType: 'linear' }
        ]
      },
      {
        name: 'Impact Freeze',
        description: 'Normal → Freeze → Resume',
        category: 'action',
        duration: 2.5,
        keyframes: [
          { speed: 1.0, curveType: 'ease_in' },
          { speed: 0.0, curveType: 'linear' },     // Freeze
          { speed: 0.0, curveType: 'linear' },     // Hold freeze
          { speed: 1.0, curveType: 'ease_out' }
        ]
      },
      
      // CINEMATIC
      {
        name: 'Smooth Slow-Mo',
        description: 'Gradual slow down (cinematic)',
        category: 'cinematic',
        duration: 3.0,
        keyframes: [
          { speed: 1.0, curveType: 'ease_in_out' },
          { speed: 0.4, curveType: 'linear' }
        ]
      },
      {
        name: 'Speed Up',
        description: 'Gradual speed increase',
        category: 'cinematic',
        duration: 2.0,
        keyframes: [
          { speed: 0.5, curveType: 'ease_out' },
          { speed: 2.0, curveType: 'linear' }
        ]
      },
      {
        name: 'Dreamy Slow-Mo',
        description: 'Subtle slow motion (40%)',
        category: 'cinematic',
        duration: 4.0,
        keyframes: [
          { speed: 1.0, curveType: 'ease_in' },
          { speed: 0.4, curveType: 'ease_in_out' },
          { speed: 0.4, curveType: 'ease_in_out' },
          { speed: 1.0, curveType: 'ease_out' }
        ]
      },
      
      // FREEZE
      {
        name: 'Freeze Frame',
        description: 'Complete freeze',
        category: 'freeze',
        duration: 1.0,
        keyframes: [
          { speed: 0.0, curveType: 'linear' }
        ]
      },
      {
        name: 'Freeze & Zoom',
        description: 'Freeze with zoom effect',
        category: 'freeze',
        duration: 2.0,
        keyframes: [
          { speed: 1.0, curveType: 'ease_in' },
          { speed: 0.0, curveType: 'linear' },
          { speed: 0.0, curveType: 'linear' }
        ]
      },
      {
        name: 'Flash Freeze',
        description: 'Quick freeze burst',
        category: 'freeze',
        duration: 1.0,
        keyframes: [
          { speed: 2.0, curveType: 'linear' },
          { speed: 0.0, curveType: 'linear' },
          { speed: 2.0, curveType: 'linear' }
        ]
      },
      
      // REVERSE
      {
        name: 'Reverse',
        description: 'Play backwards',
        category: 'reverse',
        duration: 2.0,
        keyframes: [
          { speed: -1.0, curveType: 'linear' }
        ]
      },
      {
        name: 'Reverse Slow-Mo',
        description: 'Slow reverse',
        category: 'reverse',
        duration: 3.0,
        keyframes: [
          { speed: -0.5, curveType: 'linear' }
        ]
      },
      {
        name: 'Rewind',
        description: 'Fast reverse',
        category: 'reverse',
        duration: 1.0,
        keyframes: [
          { speed: -3.0, curveType: 'linear' }
        ]
      },
      
      // CREATIVE
      {
        name: 'Stutter',
        description: 'Speed stutter effect',
        category: 'creative',
        duration: 2.0,
        keyframes: [
          { speed: 1.0, curveType: 'linear' },
          { speed: 0.2, curveType: 'linear' },
          { speed: 1.0, curveType: 'linear' },
          { speed: 0.2, curveType: 'linear' },
          { speed: 1.0, curveType: 'linear' }
        ]
      },
      {
        name: 'Ramp Loop',
        description: 'Cycling speed changes',
        category: 'creative',
        duration: 4.0,
        keyframes: [
          { speed: 0.5, curveType: 'ease_in_out' },
          { speed: 2.0, curveType: 'ease_in_out' },
          { speed: 0.5, curveType: 'ease_in_out' },
          { speed: 2.0, curveType: 'ease_in_out' },
          { speed: 1.0, curveType: 'linear' }
        ]
      },
      {
        name: 'Smooth Stop',
        description: 'Gradually slow to stop',
        category: 'creative',
        duration: 3.0,
        keyframes: [
          { speed: 1.0, curveType: 'ease_in' },
          { speed: 0.5, curveType: 'ease_in' },
          { speed: 0.1, curveType: 'ease_in' },
          { speed: 0.0, curveType: 'linear' }
        ]
      },
      {
        name: 'Turbo',
        description: 'Time-lapse speed',
        category: 'creative',
        duration: 1.0,
        keyframes: [
          { speed: 1.0, curveType: 'ease_in' },
          { speed: 10.0, curveType: 'linear' }
        ]
      }
    ];
  }
  
  /**
   * Apply speed preset to clip
   */
  static applyPreset(
    preset: SpeedPreset,
    clipStartTime: number,
    clipDuration: number
  ): SpeedKeyframe[] {
    const keyframes: SpeedKeyframe[] = [];
    const presetDuration = preset.duration;
    
    preset.keyframes.forEach((kf, index) => {
      const t = index / (preset.keyframes.length - 1 || 1);
      const time = clipStartTime + (t * Math.min(presetDuration, clipDuration));
      
      keyframes.push({
        time,
        speed: kf.speed,
        curveType: kf.curveType
      });
    });
    
    return keyframes;
  }
  
  /**
   * Create custom speed ramp
   */
  static createCustomRamp(
    startSpeed: number,
    endSpeed: number,
    duration: number,
    curve: SpeedCurveType = 'ease_in_out'
  ): SpeedKeyframe[] {
    return [
      { time: 0, speed: startSpeed, curveType: 'linear' },
      { time: duration, speed: endSpeed, curveType: curve }
    ];
  }
  
  /**
   * Speed categories for UI organization
   */
  static getSpeedCategories(): Array<{
    name: string;
    presets: SpeedPreset[];
  }> {
    const allPresets = this.getSpeedPresets();
    
    return [
      {
        name: 'Action',
        presets: allPresets.filter(p => p.category === 'action')
      },
      {
        name: 'Cinematic',
        presets: allPresets.filter(p => p.category === 'cinematic')
      },
      {
        name: 'Freeze Frame',
        presets: allPresets.filter(p => p.category === 'freeze')
      },
      {
        name: 'Reverse',
        presets: allPresets.filter(p => p.category === 'reverse')
      },
      {
        name: 'Creative',
        presets: allPresets.filter(p => p.category === 'creative')
      }
    ];
  }
  
  /**
   * Validate speed keyframes
   */
  static validateKeyframes(keyframes: SpeedKeyframe[]): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    
    if (keyframes.length === 0) {
      errors.push('At least one keyframe is required');
    }
    
    // Check for duplicate times
    const times = keyframes.map(kf => kf.time);
    const uniqueTimes = new Set(times);
    if (times.length !== uniqueTimes.size) {
      errors.push('Duplicate keyframe times detected');
    }
    
    // Check speed values
    keyframes.forEach((kf, index) => {
      if (kf.speed < -10 || kf.speed > 10) {
        errors.push(`Keyframe ${index}: Speed out of range (-10x to 10x)`);
      }
    });
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Get frame at remapped time
   */
  static getFrameAtRemappedTime(
    clipFrameRate: number,
    originalTime: number,
    keyframes: SpeedKeyframe[]
  ): number {
    const remappedTime = this.remapTime(originalTime, keyframes);
    return Math.floor(remappedTime * clipFrameRate);
  }
  
  /**
   * Common speed values
   */
  static getCommonSpeeds(): Array<{ label: string; value: number }> {
    return [
      { label: '10% (Ultra Slow)', value: 0.1 },
      { label: '25% (Slow Motion)', value: 0.25 },
      { label: '40% (Dreamy)', value: 0.4 },
      { label: '50% (Half Speed)', value: 0.5 },
      { label: '100% (Normal)', value: 1.0 },
      { label: '150%', value: 1.5 },
      { label: '200% (Double)', value: 2.0 },
      { label: '300% (Triple)', value: 3.0 },
      { label: '500% (Fast)', value: 5.0 },
      { label: '1000% (Time-lapse)', value: 10.0 },
      { label: 'Freeze (0%)', value: 0.0 },
      { label: 'Reverse (-100%)', value: -1.0 }
    ];
  }
}

export const speedRampEngine = new SpeedRampEngine();


