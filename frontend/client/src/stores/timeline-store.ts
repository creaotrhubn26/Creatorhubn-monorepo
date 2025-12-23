/**
 * TIMELINE STATE STORE (Zustand)
 * Centralized state management for timeline, clips, and playback
 */

import { create } from 'zustand';
import { BeatClip, Track } from'../services/storyArcDataIntegration';

interface TimelineState {
  // Timeline data
  clips: BeatClip[];
  tracks: Track[];
  duration: number;
  
  // Playback state
  currentTime: number;
  isPlaying: boolean;
  playbackRate: number;
  isLooping: boolean;
  
  // Selection
  selectedClips: Set<string>;
  
  // UI state
  zoom: number;
  scrollPosition: number;
  
  // Actions
  setClips: (clips: BeatClip[]) => void;
  setTracks: (tracks: Track[]) => void;
  updateClip: (clipId: string, updates: Partial<BeatClip>) => void;
  deleteClip: (clipId: string) => void;
  addClip: (clip: BeatClip) => void;
  
  setCurrentTime: (time: number) => void;
  setIsPlaying: (playing: boolean) => void;
  setPlaybackRate: (rate: number) => void;
  setIsLooping: (looping: boolean) => void;
  
  selectClip: (clipId: string, multiSelect?: boolean) => void;
  clearSelection: () => void;
  
  setZoom: (zoom: number) => void;
  setScrollPosition: (pos: number) => void;
  
  // Complex operations
  rippleDelete: (clipId: string) => void;
  splitClip: (clipId: string, time: number) => void;
}

export const useTimelineStore = create<TimelineState>((set, get) => ({
  // Initial state
  clips: [],
  tracks: [],
  duration: 0,
  currentTime: 0,
  isPlaying: false,
  playbackRate: 1,
  isLooping: false,
  selectedClips: new Set(),
  zoom: 1,
  scrollPosition: 0,
  
  // Setters
  setClips: (clips) => set({ 
    clips,
    duration: Math.max(...clips.map(c => c.start + c.duration), 0)
  }),
  
  setTracks: (tracks) => set({ tracks }),
  
  updateClip: (clipId, updates) => set((state) => ({
    clips: state.clips.map(c => c.id === clipId ? { ...c, ...updates } : c)
  })),
  
  deleteClip: (clipId) => set((state) => ({
    clips: state.clips.filter(c => c.id !== clipId),
    selectedClips: new Set(Array.from(state.selectedClips).filter(id => id !== clipId))
  })),
  
  addClip: (clip) => set((state) => ({
    clips: [...state.clips, clip]
  })),
  
  setCurrentTime: (time) => set({ currentTime: time }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setPlaybackRate: (rate) => set({ playbackRate: rate }),
  setIsLooping: (looping) => set({ isLooping: looping }),
  
  selectClip: (clipId, multiSelect = false) => set((state) => {
    const newSelected = new Set(multiSelect ? state.selectedClips : []);
    if (newSelected.has(clipId)) {
      newSelected.delete(clipId);
    } else {
      newSelected.add(clipId);
    }
    return { selectedClips: newSelected };
  }),
  
  clearSelection: () => set({ selectedClips: new Set() }),
  
  setZoom: (zoom) => set({ zoom }),
  setScrollPosition: (pos) => set({ scrollPosition: pos }),
  
  // Complex operations
  rippleDelete: (clipId) => set((state) => {
    const clip = state.clips.find(c => c.id === clipId);
    if (!clip) return state;
    
    const trackId = clip.trackId;
    const clipEnd = clip.start + clip.duration;
    
    // Remove clip and shift everything after it
    const newClips = state.clips
      .filter(c => c.id !== clipId)
      .map(c => {
        if (c.trackId === trackId && c.start >= clipEnd) {
          return { ...c, start: c.start - clip.duration };
        }
        return c;
      });
    
    return { clips: newClips };
  }),
  
  splitClip: (clipId, time) => set((state) => {
    const clip = state.clips.find(c => c.id === clipId);
    if (!clip || time <= clip.start || time >= clip.start + clip.duration) {
      return state;
    }
    
    const localTime = time - clip.start;
    
    const clip1: BeatClip = {
      ...clip,
      id: `${clip.id}_1`,
      duration: localTime
    };
    
    const clip2: BeatClip = {
      ...clip,
      id: `${clip.id}_2`,
      start: time,
      duration: clip.duration - localTime
    };
    
    const newClips = state.clips.map(c => c.id === clipId ? clip1 : c);
    newClips.push(clip2);
    
    return { clips: newClips };
  })
}));


