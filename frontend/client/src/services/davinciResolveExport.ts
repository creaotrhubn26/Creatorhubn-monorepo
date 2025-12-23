/**
 * DaVinci Resolve Export Service
 * Konverterer Story Arc Studio timeline til DaVinci Resolve XML format
 * Integrerer med existing professional-tools export system
 */

import { BeatClip, Track, StoryArc } from './storyArcDataIntegration';

export interface ResolveExportOptions {
  projectName: string;
  frameRate: number;
  resolution: '1920x1080' | '3840x2160' | '2560x1440';
  colorSpace: 'Rec709' | 'Rec2020' | 'DCI-P3';
  includeAudio: boolean;
  includeColorGrading: boolean;
  exportFormat: 'XML' | 'AAF' | 'EDL';
}

export interface ExportResult {
  success: boolean;
  exportPath?: string;
  downloadUrl?: string;
  error?: string;
  exportId: string;
  metadata: {
    projectName: string;
    totalClips: number;
    totalDuration: number;
    exportFormat: string;
    createdAt: string;
  };
}

export class DaVinciResolveExportService {
  /**
   * Export timeline til DaVinci Resolve XML format
   */
  static async exportTimeline(
    clips: BeatClip[],
    tracks: Track[],
    storyArc: StoryArc,
    options: ResolveExportOptions,
  ): Promise<ExportResult> {
    try {
      // Generate export payload
      const exportPayload = this.generateExportPayload(clips, tracks, storyArc, options);

      // Call existing professional-tools export endpoint
      const response = await fetch('/api/professional-tools/export/davinci-resolve', {
        method: 'POST',
        headers: {
          'Content-Type' : 'application/json',
        },
        body: JSON.stringify(exportPayload),
      });

      if (!response.ok) {
        throw new Error(`Export failed: ${response.statusText}`);
      }

      const result = await response.json();

      return {
        success: true,
        exportPath: result.exportPath,
        downloadUrl: result.downloadUrl,
        exportId: result.exportId,
        metadata: {
          projectName: options.projectName,
          totalClips: clips.length,
          totalDuration: Math.max(...clips.map((c) => c.start + c.duration)),
          exportFormat: options.exportFormat,
          createdAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error('DaVinci Resolve export error: ', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown export error',
        exportId: `failed_${Date.now()}`,
        metadata: {
          projectName: options.projectName,
          totalClips: clips.length,
          totalDuration: 0,
          exportFormat: options.exportFormat,
          createdAt: new Date().toISOString(),
        },
      };
    }
  }

  /**
   * Generate XML structure for DaVinci Resolve import
   */
  static generateResolveXML(
    clips: BeatClip[],
    tracks: Track[],
    options: ResolveExportOptions,
  ): string {
    const totalDuration = Math.max(...clips.map((c) => c.start + c.duration));
    const framerate = options.frameRate;

    // Sort clips by start time for proper sequence
    const sortedClips = [...clips].sort((a, b) => a.start - b.start);

    const xmlDoc = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE xmeml>
<xmeml version="4">
  <project>
    <name>${options.projectName}</name>
    <children>
      <sequence id="story-arc-sequence">
        <name>Story Arc Timeline</name>
        <duration>${Math.ceil(totalDuration * framerate)}</duration>
        <rate>
          <timebase>${framerate}</timebase>
          <ntsc>FALSE</ntsc>
        </rate>
        <timecode>
          <rate>
            <timebase>${framerate}</timebase>
            <ntsc>FALSE</ntsc>
          </rate>
          <string>01:00:00:00</string>
          <frame>0</frame>
          <source>source</source>
          <displayformat>NDF</displayformat>
        </timecode>
        <media>
          <video>
            <format>
              <samplecharacteristics>
                <rate>
                  <timebase>${framerate}</timebase>
                  <ntsc>FALSE</ntsc>
                </rate>
                <width>${options.resolution.split('x')[0]}</width>
                <height>${options.resolution.split('x')[1]}</height>
                <anamorphic>FALSE</anamorphic>
                <pixelaspectratio>square</pixelaspectratio>
                <fielddominance>none</fielddominance>
                <colordepth>8</colordepth>
              </samplecharacteristics>
            </format>
            ${this.generateVideoTracks(tracks, sortedClips, framerate)}
          </video>
          ${options.includeAudio ? this.generateAudioTracks(sortedClips, framerate) : ''}
        </media>
      </sequence>
    </children>
  </project>
</xmeml>`;

    return xmlDoc;
  }

  /**
   * Generate video tracks XML
   */
  private static generateVideoTracks(
    tracks: Track[],
    clips: BeatClip[],
    framerate: number,
  ): string {
    return tracks
      .map((track, trackIndex) => {
        const trackClips = clips.filter((clip) => clip.trackId === track.id);

        return `
            <track>
              <name>${track.name}</name>
              <enabled>TRUE</enabled>
              <locked>FALSE</locked>
              ${trackClips.map((clip, clipIndex) => this.generateClipXML(clip, clipIndex, framerate)).join('')}
            </track>`;
      })
      .join('');
  }

  /**
   * Generate audio tracks XML
   */
  private static generateAudioTracks(clips: BeatClip[], framerate: number): string {
    return `
          <audio>
            <format>
              <samplecharacteristics>
                <depth>16</depth>
                <samplerate>48000</samplerate>
              </samplecharacteristics>
            </format>
            <track>
              <name>Audio Track 1</name>
              <enabled>TRUE</enabled>
              <locked>FALSE</locked>
              ${clips.map((clip, index) => this.generateAudioClipXML(clip, index, framerate)).join('')}
            </track>
          </audio>`;
  }

  /**
   * Generate individual clip XML
   */
  private static generateClipXML(clip: BeatClip, index: number, framerate: number): string {
    const startFrame = Math.floor(clip.start * framerate);
    const endFrame = Math.floor((clip.start + clip.duration) * framerate);
    const durationFrames = endFrame - startFrame;

    return `
              <clipitem id="clip-${clip.id}">
                <name>${clip.name}</name>
                <start>${startFrame}</start>
                <end>${endFrame}</end>
                <in>0</in>
                <out>${durationFrames}</out>
                <enabled>TRUE</enabled>
                <masterclipid>${clip.id}</masterclipid>
                <file id="file-${clip.id}">
                  <name>${clip.name}.mov</name>
                  <pathurl>file:///${clip.name}.mov</pathurl>
                  <rate>
                    <timebase>${framerate}</timebase>
                    <ntsc>FALSE</ntsc>
                  </rate>
                  <duration>${durationFrames}</duration>
                  <media>
                    <video>
                      <samplecharacteristics>
                        <rate>
                          <timebase>${framerate}</timebase>
                          <ntsc>FALSE</ntsc>
                        </rate>
                        <width>1920</width>
                        <height>1080</height>
                      </samplecharacteristics>
                    </video>
                  </media>
                </file>
                ${this.generateClipEffects(clip)}
                ${this.generateClipMetadata(clip)}
              </clipitem>`;
  }

  /**
   * Generate audio clip XML
   */
  private static generateAudioClipXML(clip: BeatClip, index: number, framerate: number): string {
    const startFrame = Math.floor(clip.start * framerate);
    const endFrame = Math.floor((clip.start + clip.duration) * framerate);

    return `
              <clipitem id="audio-clip-${clip.id}">
                <name>${clip.name}_audio</name>
                <start>${startFrame}</start>
                <end>${endFrame}</end>
                <enabled>TRUE</enabled>
                <file id="audio-file-${clip.id}">
                  <name>${clip.name}_audio.wav</name>
                  <pathurl>file:///${clip.name}_audio.wav</pathurl>
                </file>
              </clipitem>`;
  }

  /**
   * Generate clip effects XML
   */
  private static generateClipEffects(clip: BeatClip): string {
    if (!clip.effect || clip.effect === 'None') return ', ';

    const effectsMap = {
      'Fade In':'Cross Dissolve', 'Fade Out':'Cross Dissolve','Cross Dissolve':'Cross Dissolve','Color Correction' : 'Color Corrector',
      Stabilization: 'SteadyMove','Slow Motion':'Time Remap','Speed Ramp' : 'Time Remap',
    };

    const resolveEffect = effectsMap[clip.effect] || clip.effect;

    return `
                <filter>
                  <effect>
                    <name>${resolveEffect}</name>
                    <effectid>${resolveEffect.toLowerCase().replace(/\s/g, ', ')}</effectid>
                    <effecttype>filter</effecttype>
                    <mediatype>video</mediatype>
                    ${
                      clip.opacity !== undefined
                        ? `
                    <parameter>
                      <parameterid>opacity</parameterid>
                      <name>Opacity</name>
                      <value>${clip.opacity * 100}</value>
                    </parameter>`
                        : ', '
                    }
                    ${
                      clip.speed !== undefined && clip.speed !== 1
                        ? `
                    <parameter>
                      <parameterid>speed</parameterid>
                      <name>Speed</name>
                      <value>${clip.speed * 100}</value>
                    </parameter>`
                        : ', '
                    }
                  </effect>
                </filter>`;
  }

  /**
   * Generate clip metadata XML
   */
  private static generateClipMetadata(clip: BeatClip): string {
    return `
                <comments>
                  <mastercomment1>Synopsis: ${clip.synopsis}</mastercomment1>
                  <mastercomment2>Emotional Value: ${clip.ev.toFixed(2)}</mastercomment2>
                  <mastercomment3>Type: ${clip.type || 'Unknown'}</mastercomment3>
                  <mastercomment4>Tags: ${(clip.tags || []).join(', ')}</mastercomment4>
                </comments>`;
  }

  /**
   * Generate export payload for professional-tools endpoint
   */
  private static generateExportPayload(
    clips: BeatClip[],
    tracks: Track[],
    storyArc: StoryArc,
    options: ResolveExportOptions,
  ) {
    return {
      type: 'davinci_resolve',
      format: options.exportFormat,
      projectName: options.projectName,
      storyArc: {
        id: storyArc.id,
        title: storyArc.title,
        type: storyArc.type,
        totalDuration: storyArc.totalDuration,
      },
      timeline: {
        clips: clips.map((clip) => ({
          id: clip.id,
          name: clip.name,
          start: clip.start,
          duration: clip.duration,
          trackId: clip.trackId,
          synopsis: clip.synopsis,
          emotionalValue: clip.ev,
          type: clip.type,
          tags: clip.tags,
          effects: {
            speed: clip.speed,
            effect: clip.effect,
            opacity: clip.opacity,
          },
        })),
        tracks: tracks,
      },
      settings: {
        frameRate: options.frameRate,
        resolution: options.resolution,
        colorSpace: options.colorSpace,
        includeAudio: options.includeAudio,
        includeColorGrading: options.includeColorGrading,
      },
      xmlContent:
        options.exportFormat === 'XML' ? this.generateResolveXML(clips, tracks, options) : null,
    };
  }

  /**
   * Download exported file
   */
  static async downloadExport(exportId: string): Promise<boolean> {
    try {
      const response = await fetch(`/api/professional-tools/export/${exportId}/download`);

      if (!response.ok) {
        throw new Error('Download failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `story-arc-${exportId}.xml`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      return true;
    } catch (error) {
      console.error('Download error:', error);
      return false;
    }
  }

  /**
   * Get export status
   */
  static async getExportStatus(exportId: string): Promise<{
    status: 'pending' | 'processing' | 'completed' | 'failed';
    progress?: number;
    error?: string;
  }> {
    try {
      const response = await fetch(`/api/professional-tools/export/${exportId}/status`);

      if (!response.ok) {
        throw new Error('Failed to get export status');
      }

      return await response.json();
    } catch (error) {
      console.error('Status check error:', error);
      return { status: 'failed', error: 'Failed to check status' };
    }
  }

  /**
   * Get default export options
   */
  static getDefaultOptions(): ResolveExportOptions {
    return {
      projectName: `Story Arc ${new Date().toISOString().split('T')[0]}`,
      frameRate: 25, // Norwegian standard
      resolution: '1920x1080',
      colorSpace: 'Rec709',
      includeAudio: true,
      includeColorGrading: true,
      exportFormat:'XML',
    };
  }
}
