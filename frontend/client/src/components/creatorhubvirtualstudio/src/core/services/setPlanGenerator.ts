/**
 * Set Plan Generator
 * 
 * Generates production-ready set plans with equipment list, positions, and settings
 * Similar to Set A Light 3D's set plan export
 */

import { logger } from './logger';

const log = logger.module('SetPlanGenerator');

export interface EquipmentItem {
  id: string;
  name: string;
  type: string;
  manufacturer?: string;
  model?: string;
  position: [number, number, number];
  rotation: [number, number, number];
  settings: {
    power?: number;
    color?: string;
    temperature?: number;
    beamAngle?: number;
    modifier?: string;
    modifierSize?: number;
  };
}

export interface CameraInfo {
  position: [number, number, number];
  target: [number, number, number];
  settings: {
    focalLength: number;
    aperture: number;
    iso: number;
    shutter: number;
  };
}

export interface SetPlan {
  title: string;
  date: string;
  location?: string;
  notes?: string;
  equipment: EquipmentItem[];
  cameras: CameraInfo[];
  subjectPosition: [number, number, number];
  roomDimensions?: {
    width: number;
    height: number;
    depth: number;
  };
}

export class SetPlanGenerator {
  /**
   * Generate set plan from scene data
   */
  generateSetPlan(data: {
    equipment: EquipmentItem[];
    cameras: CameraInfo[];
    subjectPosition: [number, number, number];
    roomDimensions?: { width: number; height: number; depth: number };
    title?: string;
    notes?: string;
  }): SetPlan {
    return {
      title: data.title || 'Studio Set Plan',
      date: new Date().toISOString().split('T')[0],
      equipment: data.equipment,
      cameras: data.cameras,
      subjectPosition: data.subjectPosition,
      roomDimensions: data.roomDimensions,
      notes: data.notes,
    };
  }
  
  /**
   * Export set plan as JSON
   */
  exportJSON(setPlan: SetPlan): string {
    return JSON.stringify(setPlan, null, 2);
  }
  
  /**
   * Export set plan as formatted text
   */
  exportText(setPlan: SetPlan): string {
    const lines: string[] = [];
    
    lines.push('='.repeat(60));
    lines.push(setPlan.title.toUpperCase());
    lines.push('='.repeat(60));
    lines.push('');
    lines.push(`Date: ${setPlan.date}`);
    if (setPlan.location) {
      lines.push(`Location: ${setPlan.location}`);
    }
    lines.push('');
    
    if (setPlan.roomDimensions) {
      lines.push('ROOM DIMENSIONS:');
      lines.push(`  Width: ${setPlan.roomDimensions.width}m`);
      lines.push(`  Height: ${setPlan.roomDimensions.height}m`);
      lines.push(`  Depth: ${setPlan.roomDimensions.depth}m`);
      lines.push('');
    }
    
    lines.push('SUBJECT POSITION:');
    lines.push(`  X: ${setPlan.subjectPosition[0].toFixed(2)}m`);
    lines.push(`  Y: ${setPlan.subjectPosition[1].toFixed(2)}m`);
    lines.push(`  Z: ${setPlan.subjectPosition[2].toFixed(2)}m`);
    lines.push('');
    
    lines.push('EQUIPMENT:');
    lines.push('-'.repeat(60));
    setPlan.equipment.forEach((item, index) => {
      lines.push(`${index + 1}. ${item.name} (${item.type})`);
      if (item.manufacturer) {
        lines.push(`   Manufacturer: ${item.manufacturer}`);
      }
      if (item.model) {
        lines.push(`   Model: ${item.model}`);
      }
      lines.push(`   Position: X=${item.position[0].toFixed(2)}m, Y=${item.position[1].toFixed(2)}m, Z=${item.position[2].toFixed(2)}m`);
      lines.push(`   Rotation: X=${item.rotation[0].toFixed(1)}°, Y=${item.rotation[1].toFixed(1)}°, Z=${item.rotation[2].toFixed(1)}°`);
      
      if (item.settings.power !== undefined) {
        lines.push(`   Power: ${(item.settings.power * 100).toFixed(0)}%`);
      }
      if (item.settings.temperature) {
        lines.push(`   Color Temperature: ${item.settings.temperature}K`);
      }
      if (item.settings.beamAngle) {
        lines.push(`   Beam Angle: ${item.settings.beamAngle}°`);
      }
      if (item.settings.modifier) {
        lines.push(`   Modifier: ${item.settings.modifier}`);
        if (item.settings.modifierSize) {
          lines.push(`   Modifier Size: ${item.settings.modifierSize}m`);
        }
      }
      lines.push('');
    });
    
    lines.push('CAMERAS:');
    lines.push('-'.repeat(60));
    setPlan.cameras.forEach((camera, index) => {
      lines.push(`Camera ${index + 1}:`);
      lines.push(`  Position: X=${camera.position[0].toFixed(2)}m, Y=${camera.position[1].toFixed(2)}m, Z=${camera.position[2].toFixed(2)}m`);
      lines.push(`  Target: X=${camera.target[0].toFixed(2)}m, Y=${camera.target[1].toFixed(2)}m, Z=${camera.target[2].toFixed(2)}m`);
      lines.push(`  Focal Length: ${camera.settings.focalLength}mm`);
      lines.push(`  Aperture: f/${camera.settings.aperture}`);
      lines.push(`  ISO: ${camera.settings.iso}`);
      lines.push(`  Shutter: 1/${Math.round(1 / camera.settings.shutter)}s`);
      lines.push('');
    });
    
    if (setPlan.notes) {
      lines.push('NOTES:');
      lines.push('-'.repeat(60));
      lines.push(setPlan.notes);
      lines.push('');
    }
    
    return lines.join('\n');
  }
  
  /**
   * Export set plan as HTML
   */
  exportHTML(setPlan: SetPlan): string {
    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>${setPlan.title}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    h1 { color: #333; }
    table { border-collapse: collapse; width: 100%; margin: 20px 0; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #f2f2f2; }
  </style>
</head>
<body>
  <h1>${setPlan.title}</h1>
  <p><strong>Date:</strong> ${setPlan.date}</p>
  
  <h2>Equipment</h2>
  <table>
    <tr>
      <th>Name</th>
      <th>Type</th>
      <th>Position</th>
      <th>Settings</th>
    </tr>
    ${setPlan.equipment.map((item) => `
      <tr>
        <td>${item.name}</td>
        <td>${item.type}</td>
        <td>(${item.position[0].toFixed(2)}, ${item.position[1].toFixed(2)}, ${item.position[2].toFixed(2)})</td>
        <td>Power: ${item.settings.power ? (item.settings.power * 100).toFixed(0) + '%' : 'N/A'}</td>
      </tr>
    `).join('')}
  </table>
  
  <h2>Cameras</h2>
  <table>
    <tr>
      <th>Position</th>
      <th>Target</th>
      <th>Focal Length</th>
      <th>Aperture</th>
      <th>ISO</th>
      <th>Shutter</th>
    </tr>
    ${setPlan.cameras.map((camera) => `
      <tr>
        <td>(${camera.position[0].toFixed(2)}, ${camera.position[1].toFixed(2)}, ${camera.position[2].toFixed(2)})</td>
        <td>(${camera.target[0].toFixed(2)}, ${camera.target[1].toFixed(2)}, ${camera.target[2].toFixed(2)})</td>
        <td>${camera.settings.focalLength}mm</td>
        <td>f/${camera.settings.aperture}</td>
        <td>${camera.settings.iso}</td>
        <td>1/${Math.round(1 / camera.settings.shutter)}s</td>
      </tr>
    `).join('')}
  </table>
</body>
</html>
    `.trim();
    
    return html;
  }
}

// Export singleton instance
export const setPlanGenerator = new SetPlanGenerator();


