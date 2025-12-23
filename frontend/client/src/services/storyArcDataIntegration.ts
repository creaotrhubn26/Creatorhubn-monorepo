/**
 * Story Arc Data Integration Service (FIXED & WORKING)
 * Connects Story Arc Generator data with Story Arc Studio UI
 */

import { storyArcStudioColors } from '../theme/storyArcStudioTheme';

// ============================================================================
// CORE INTERFACES
// ============================================================================

export interface EmotionalTone {
  joy: number;
  sadness: number;
  excitement: number;
  calm: number;
  tension: number;
  romance: number;
}

export interface StorySegment {
  id: string;
  title: string;
  startTime: number;
  endTime: number;
  sourceClips: SourceClip[];
  segmentType: 'opening' | 'build-up' | 'climax' | 'resolution' | 'closing';
  pacing: 'slow' | 'medium' | 'fast';
  emotionalArc: EmotionalTone;
  narration?: string;
  priority: number;
}

export interface SourceClip {
  videoId: string;
  filename: string;
  startTime: number;
  endTime: number;
  clipDuration: number;
  reason: string;
  qualityScore: number;
  processingEffects: string[];
}

export interface StoryArc {
  id: string;
  title: string;
  type: 'wedding' | 'corporate' | 'documentary' | 'commercial' | 'music_video' | 'event';
  totalDuration: number;
  segments: StorySegment[];
  musicSuggestions: MusicSuggestion[];
  transitionEffects: TransitionEffect[];
  colorGrading: ColorGradingProfile;
  confidence: number;
  createdAt: string;
}

export interface MusicSuggestion {
  title: string;
  artist: string;
  genre: string;
  tempo: number;
  key: string;
  duration: number;
  startTime: number;
  fadeIn: number;
  fadeOut: number;
  volume: number;
  mood: string;
  licenseType: 'royalty_free' | 'licensed' | 'original';
}

export interface TransitionEffect {
  type: 'cut' | 'fade' | 'dissolve' | 'wipe' | 'slide' | 'zoom';
  duration: number;
  position: number;
  intensity: number;
  direction?: 'left' | 'right' | 'up' | 'down';
}

export interface ColorGradingProfile {
  name: string;
  temperature: number;
  tint: number;
  exposure: number;
  contrast: number;
  highlights: number;
  shadows: number;
  saturation: number;
  vibrance: number;
  luts: string[];
}

// ============================================================================
// VIDEO EDITOR INTERFACES
// ============================================================================

export interface BeatClip {
  id: string;
  name: string;
  beatName: string; // Display name
  start: number; // Seconds
  duration: number; // Seconds
  ev: number; // Emotional value (-1.0 to +1.0)
  synopsis: string;
  trackId: string;
  color: string;
  type?: string;
  tags?: string[];
  speed?: number;
  effect?: string;
  opacity?: number;
  originalSegment?: StorySegment;
  sourceClip?: SourceClip;
  
  // Real video editing properties
  sourceFile?: string; // URL to video file
  metadata?: {
    inPoint?: number;
    outPoint?: number;
    volume?: number;
    effects?: string[];
    [key: string]: any;
  };
}

export interface Track {
  id: string;
  name: string;
  type: 'video' | 'audio';
  height: number;
}

// ============================================================================
// DATA CONVERSION
// ============================================================================

export class StoryArcDataIntegration {
  /**
   * Convert StoryArc to BeatClips for timeline
   */
  static convertStoryArcToBeats(
    storyArc: StoryArc,
    timelineUnits = 100
  ): {
    clips: BeatClip[];
    tracks: Track[];
  } {
    const clips: BeatClip[] = [];
    const tracks: Track[] = this.generateTracks(storyArc);

    // Convert each segment to BeatClips
    storyArc.segments.forEach((segment, segmentIndex) => {
      const mainClip = this.segmentToBeatClip(segment, storyArc, timelineUnits);
      mainClip.trackId = this.getTrackForSegment(segment.segmentType);
      clips.push(mainClip);
    });

    return { clips, tracks };
  }

  /**
   * Convert StorySegment to BeatClip
   */
  private static segmentToBeatClip(
    segment: StorySegment,
    storyArc: StoryArc,
    timelineUnits: number
  ): BeatClip {
    const timeRatio = timelineUnits / storyArc.totalDuration;
    const emotionalValue = this.calculateEmotionalValue(segment.emotionalArc);

    return {
      id: segment.id,
      name: segment.title,
      beatName: segment.title,
      start: segment.startTime * timeRatio,
      duration: (segment.endTime - segment.startTime) * timeRatio,
      ev: emotionalValue,
      synopsis: segment.narration || segment.title,
      trackId: this.getTrackForSegment(segment.segmentType),
      color: this.getColorForEmotion(emotionalValue),
      originalSegment: segment
    };
  }

  /**
   * Generate tracks for Story Arc Studio layout
   */
  private static generateTracks(storyArc: StoryArc): Track[] {
    const baseTrackHeight = 56;

    const tracks: Track[] = [
      { id: 'act_1', name: 'Act I', type: 'video', height: baseTrackHeight },
      { id: 'act_2', name: 'Act II', type: 'video', height: baseTrackHeight },
      { id: 'act_3', name: 'Act III', type: 'video', height: baseTrackHeight },
      { id: 'b_story', name: 'B-Story', type: 'video', height: 48 },
      { id: 'audio_1', name: 'Audio 1', type: 'audio', height: 40 }
    ];

    return tracks;
  }

  /**
   * Fetch Story Arc data from server
   */
  static async fetchStoryArcData(storyArcId?: string): Promise<StoryArc | null> {
    try {
      // Mock data for now - replace with API call
      return {
        id: storyArcId || 'demo_arc_1',
        title: 'Wedding Highlight Reel',
        type: 'wedding',
        totalDuration: 480, // 8 minutes
        segments: [
          {
            id: 'seg_1',
            title: 'Opening',
            startTime: 0,
            endTime: 60,
            sourceClips: [],
            segmentType: 'opening',
            pacing: 'slow',
            emotionalArc: { joy: 0.7, sadness: 0.1, excitement: 0.5, calm: 0.8, tension: 0.2, romance: 0.6 },
            priority: 1
          },
          {
            id: 'seg_2',
            title: 'Build Up',
            startTime: 60,
            endTime: 180,
            sourceClips: [],
            segmentType: 'build-up',
            pacing: 'medium',
            emotionalArc: { joy: 0.8, sadness: 0, excitement: 0.7, calm: 0.5, tension: 0.3, romance: 0.8 },
            priority: 2
          }
        ],
        musicSuggestions: [],
        transitionEffects: [],
        colorGrading: {
          name: 'Warm Wedding',
          temperature: 15,
          tint: 5,
          exposure: 0.2,
          contrast: 1.1,
          highlights: -10,
          shadows: 5,
          saturation: 1.15,
          vibrance: 1.1,
          luts: []
        },
        confidence: 0.85,
        createdAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error fetching story arc: ', error);
      return null;
    }
  }

  /**
   * Calculate emotional value from EmotionalTone
   */
  private static calculateEmotionalValue(tone: EmotionalTone): number {
    return (tone.joy + tone.excitement + tone.romance - tone.sadness - tone.tension) / 5;
  }

  /**
   * Get track ID for segment type
   */
  private static getTrackForSegment(segmentType: string): string {
    const mapping: Record<string, string> = {
      opening: 'act_1', 'build-up' : 'act_2',
      climax: 'act_2',
      resolution: 'act_3',
      closing: 'act_3'
    };
    return mapping[segmentType] ||'act_1';
  }

  /**
   * Get color for emotional value
   */
  private static getColorForEmotion(ev: number): string {
    if (ev > 0.5) return storyArcStudioColors.climax;
    if (ev > 0.2) return storyArcStudioColors.buildUp;
    if (ev < -0.2) return storyArcStudioColors.tension;
    return storyArcStudioColors.calm;
  }
}

export default StoryArcDataIntegration;


