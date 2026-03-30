export type LightRole =
  | 'key'
  | 'fill'
  | 'rim'
  | 'back'
  | 'background'
  | 'effects'
  | 'ambient'
  | 'practical'
  | (string & {});

export interface LightSourceProperties {
  id: string;
  power?: number;
  wattage?: number;
  efficacy?: number;
  position: [number, number, number];
  beam?: number;
  beamAngle?: number;
  fieldAngle?: number;
  focus?: number;
  role?: LightRole;
  cri?: number;
  cct?: number;
  colorTemperature?: number;
  modifier?: string;
  modifierSize?: [number, number];
  name?: string;
}

export type { Scene, SceneNode } from './models/scene';
