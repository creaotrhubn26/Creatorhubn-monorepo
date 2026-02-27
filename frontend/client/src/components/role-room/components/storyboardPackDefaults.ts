import type { StoryboardPackManifest } from './storyboardPackTypes';

const keep = '/storyboard-pack-icons';
const img = (name: string) => `${keep}/${name}`;

export const STORYBOARD_PACK_DEFAULTS: StoryboardPackManifest = {
  version: 1,
  updatedAt: new Date(0).toISOString(),
  publishedAt: new Date(0).toISOString(),
  packs: [
    {
      id: 'cinematic-drama',
      name: 'Noir Lighting Pack',
      description: 'High contrast mood with cinematic tungsten falloff.',
      coverImageUrl: img('roleroom_cinemag.png'),
      baseBrushSettings: { type: 'ink', color: '#f9fafb', size: 4, opacity: 0.9, hardness: 0.9 },
      slots: [
        { id: 'hero-close', name: 'Hero Close-up', description: 'Emotional close focus with shallow depth.', imageUrl: img('roleroom_storyboard.png'), patch: { brushSettings: { size: 3, flow: 0.85 }, cinematography: { shotType: 'close-up', cameraAngle: 'eye-level', lens: '50mm' } } },
        { id: 'over-shoulder', name: 'Over Shoulder', description: 'Dialogue perspective and foreground silhouette.', imageUrl: img('roleroom_director.png'), patch: { brushSettings: { size: 4, grain: 0.25 }, cinematography: { shotType: 'over-shoulder', lens: '35mm' } } },
        { id: 'wide-establish', name: 'Wide Establishing', description: 'High-contrast location establish frame.', imageUrl: img('roleroom_scenes.png'), patch: { brushSettings: { size: 5, opacity: 0.84 }, cinematography: { shotType: 'wide', lens: '24mm' } } },
        { id: 'silhouette', name: 'Silhouette Beat', description: 'Backlit silhouette transition panel.', imageUrl: img('roleroom_fotodirektør.png'), patch: { brushSettings: { type: 'brush', opacity: 0.78, wetness: 0.32 }, cinematography: { shotType: 'medium', cameraAngle: 'low-angle' } } },
      ],
    },
    {
      id: 'action-blocking',
      name: 'Action Crosshatch Pack',
      description: 'Fast action planning with dynamic camera movement.',
      coverImageUrl: img('roleroom_camera.png'),
      baseBrushSettings: { type: 'marker', color: '#f3f4f6', size: 6, opacity: 0.88, flow: 0.92 },
      slots: [
        { id: 'push-in', name: 'Push In', description: 'Aggressive forward camera move.', imageUrl: img('roleroom_drone.png'), patch: { brushSettings: { size: 6, tiltSensitivity: 0.75 }, cinematography: { movement: 'dolly in', lens: '35mm' } } },
        { id: 'tracking', name: 'Tracking', description: 'Lateral run-and-gun following move.', imageUrl: img('roleroom_timeline.png'), patch: { brushSettings: { size: 5, hardness: 0.42 }, cinematography: { movement: 'tracking', lens: '28mm' } } },
        { id: 'top-down', name: 'Top Down', description: 'Overhead choreography and blocking map.', imageUrl: img('roleroom_stativ.png'), patch: { brushSettings: { size: 4, opacity: 0.85 }, cinematography: { cameraAngle: 'top-down', shotType: 'wide' } } },
        { id: 'impact', name: 'Impact Frame', description: 'Whip-pan moment and contact beat.', imageUrl: img('roleroom_sound.png'), patch: { brushSettings: { type: 'ink', size: 7, hardness: 1 }, cinematography: { shotType: 'insert', movement: 'whip-pan' } } },
      ],
    },
    {
      id: 'commercial-clean',
      name: 'Commercial High-Key',
      description: 'Bright clean product framing and polished toning.',
      coverImageUrl: img('roleroom_projects_alt.png'),
      baseBrushSettings: { type: 'pen', color: '#f9fafb', size: 3, opacity: 1, hardness: 1 },
      slots: [
        { id: 'product-front', name: 'Product Front', description: 'Centered hero frame with negative space.', imageUrl: img('roleroom_prodes.png'), patch: { brushSettings: { size: 2, hardness: 1 }, cinematography: { shotType: 'hero', lens: '85mm' } } },
        { id: 'lifestyle', name: 'Lifestyle', description: 'Human + product interaction composition.', imageUrl: img('roleroom_dashboard.png'), patch: { brushSettings: { size: 3, flow: 0.95 }, cinematography: { shotType: 'medium', cameraAngle: 'eye-level' } } },
        { id: 'macro', name: 'Macro Detail', description: 'Texture and detail macro cutaway.', imageUrl: img('roleroom_linser.png'), patch: { brushSettings: { size: 1.5, pressureSensitivity: 0.5 }, cinematography: { shotType: 'macro', lens: '100mm' } } },
        { id: 'cta', name: 'CTA End Card', description: 'End slate and graphic callout panel.', imageUrl: img('roleroom_notes.png'), patch: { brushSettings: { type: 'highlighter', opacity: 0.5, size: 8 }, overlay: { showGrid: true } } },
      ],
    },
    {
      id: 'documentary-natural',
      name: 'Soft Drama Wash',
      description: 'Naturalistic handheld mood with soft grade rolloff.',
      coverImageUrl: img('roleroom_filmfotograf.png'),
      baseBrushSettings: { type: 'pencil', color: '#f9fafb', size: 4, opacity: 0.9, grain: 0.62 },
      slots: [
        { id: 'observer-wide', name: 'Observer Wide', description: 'Environment and subject context setup.', imageUrl: img('roleroom_location.png'), patch: { brushSettings: { size: 4, grain: 0.7 }, cinematography: { shotType: 'wide', lens: '24mm' } } },
        { id: 'interview', name: 'Interview', description: 'Stable interview frame for dialogue.', imageUrl: img('roleroom_casting_director.png'), patch: { brushSettings: { type: 'pen', size: 3 }, cinematography: { shotType: 'medium close', lens: '50mm' } } },
        { id: 'broll', name: 'B-Roll Motion', description: 'Ambient handheld inserts and details.', imageUrl: img('roleroom_editing.png'), patch: { brushSettings: { type: 'brush', size: 5, flow: 0.75 }, cinematography: { movement: 'handheld', shotType: 'insert' } } },
        { id: 'ambient', name: 'Ambient Cutaway', description: 'Natural light transition beat.', imageUrl: img('roleroom_timeline_alt.png'), patch: { brushSettings: { opacity: 0.75, wetness: 0.25 }, overlay: { notes: 'Natural light priority' } } },
      ],
    },
  ],
};
