/**
 * Director Mode Service
 * 
 * Manages the Director Mode state and camera animations for
 * zooming into/out of monitor views.
 */

import { logger } from './logger';

const log = logger.module('DirectorModeService, ');

let THREE: any = null;
try {
  THREE = require('three');
} catch {}

// ============================================================================
// Types
// ============================================================================

export interface DirectorModeState {
  isActive: boolean;
  monitorId: string | null;
  monitorName: string;
  originalCameraPosition: [number, number, number] | null;
  originalCameraTarget: [number, number, number] | null;
  monitorPosition: [number, number, number] | null;
  isAnimating: boolean;
}

export interface MonitorInfo {
  id: string;
  name: string;
  position: [number, number, number];
  rotation: [number, number, number];
}

type StateListener = (state: DirectorModeState) => void;

// ============================================================================
// Director Mode Service
// ============================================================================

class DirectorModeService {
  private state: DirectorModeState = {
    isActive: false,
    monitorId: null,
    monitorName: ', ',
    originalCameraPosition: null,
    originalCameraTarget: null,
    monitorPosition: null,
    isAnimating: false,
  };
  
  private camera: any = null;
  private controls: any = null;
  private monitors: Map<string, MonitorInfo> = new Map();
  private animationId: number | null = null;
  private listeners: Set<StateListener> = new Set();
  
  // Animation settings
  private readonly ZOOM_DURATION = 800; // ms
  private readonly CAMERA_OFFSET = [0, 0.1, 0.6]; // Offset from monitor when in director mode
  
  /**
   * Set the camera and controls reference
   */
  setCamera(camera: any, controls?: any) {
    this.camera = camera;
    this.controls = controls;
  }
  
  /**
   * Register a monitor for click detection
   */
  registerMonitor(info: MonitorInfo) {
    this.monitors.set(info.id, info);
    log.debug('Registered monitor: ', info.id);
  }
  
  /**
   * Unregister a monitor
   */
  unregisterMonitor(id: string) {
    this.monitors.delete(id);
  }
  
  /**
   * Get registered monitors
   */
  getMonitors(): MonitorInfo[] {
    return Array.from(this.monitors.values());
  }
  
  /**
   * Enter Director Mode for a specific monitor
   */
  enterDirectorMode(monitorId: string): boolean {
    const monitor = this.monitors.get(monitorId);
    if (!monitor || !this.camera || this.state.isAnimating) {
      log.warn('Cannot enter director mode: ', { monitorId, hasMonitor: !!monitor, hasCamera: !!this.camera });
      return false;
    }
    
    // Store original camera state
    this.state.originalCameraPosition = [
      this.camera.position.x,
      this.camera.position.y,
      this.camera.position.z,
    ];
    
    // Store original target (from controls or calculate from camera direction)
    if (this.controls?.target) {
      this.state.originalCameraTarget = [
        this.controls.target.x,
        this.controls.target.y,
        this.controls.target.z,
      ];
    } else {
      // Calculate target from camera direction
      const dir = new THREE.Vector3(0, 0, -1);
      dir.applyQuaternion(this.camera.quaternion);
      dir.multiplyScalar(2);
      dir.add(this.camera.position);
      this.state.originalCameraTarget = [dir.x, dir.y, dir.z];
    }
    
    this.state.monitorPosition = monitor.position;
    this.state.monitorId = monitorId;
    this.state.monitorName = monitor.name;
    
    // Animate camera to monitor
    this.animateToMonitor(monitor);
    
    return true;
  }
  
  /**
   * Exit Director Mode and return to original view
   */
  exitDirectorMode(): boolean {
    if (!this.state.isActive || this.state.isAnimating || !this.state.originalCameraPosition) {
      return false;
    }
    
    this.animateToOriginal();
    return true;
  }
  
  /**
   * Toggle Director Mode
   */
  toggleDirectorMode(monitorId?: string): boolean {
    if (this.state.isActive) {
      return this.exitDirectorMode();
    } else if (monitorId) {
      return this.enterDirectorMode(monitorId);
    }
    return false;
  }
  
  /**
   * Animate camera to monitor view
   */
  private animateToMonitor(monitor: MonitorInfo) {
    if (!this.camera || !THREE) return;
    
    this.state.isAnimating = true;
    this.notifyListeners();
    
    const startPos = this.camera.position.clone();
    const startTarget = this.controls?.target?.clone() || new THREE.Vector3(0, 1.6, 0);
    
    // Calculate target position (in front of monitor)
    const targetPos = new THREE.Vector3(
      monitor.position[0] + this.CAMERA_OFFSET[0],
      monitor.position[1] + this.CAMERA_OFFSET[1],
      monitor.position[2] + this.CAMERA_OFFSET[2]
    );
    
    // Target look-at is the monitor center
    const targetLookAt = new THREE.Vector3(
      monitor.position[0],
      monitor.position[1],
      monitor.position[2]
    );
    
    const startTime = performance.now();
    
    const animate = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / this.ZOOM_DURATION, 1);
      
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      
      // Interpolate position
      this.camera.position.lerpVectors(startPos, targetPos, eased);
      
      // Interpolate target
      if (this.controls) {
        this.controls.target.lerpVectors(startTarget, targetLookAt, eased);
        this.controls.update();
      } else {
        // Look at interpolated target
        const currentTarget = new THREE.Vector3().lerpVectors(startTarget, targetLookAt, eased);
        this.camera.lookAt(currentTarget);
      }
      
      if (progress < 1) {
        this.animationId = requestAnimationFrame(animate);
      } else {
        // Animation complete
        this.state.isActive = true;
        this.state.isAnimating = false;
        this.notifyListeners();
        
        // Disable controls in director mode
        if (this.controls) {
          this.controls.enabled = false;
        }
        
        // Dispatch event
        window.dispatchEvent(new CustomEvent('vs-director-mode-entered', {
          detail: { monitorId: monitor.id, monitorName: monitor.name },
        }));
        
        log.info('Entered director mode:', monitor.id);
      }
    };
    
    this.animationId = requestAnimationFrame(animate);
  }
  
  /**
   * Animate camera back to original position
   */
  private animateToOriginal() {
    if (!this.camera || !THREE || !this.state.originalCameraPosition) return;
    
    this.state.isAnimating = true;
    this.notifyListeners();
    
    // Re-enable controls for animation
    if (this.controls) {
      this.controls.enabled = true;
    }
    
    const startPos = this.camera.position.clone();
    const startTarget = this.controls?.target?.clone() || new THREE.Vector3(0, 1.6, 0);
    
    const targetPos = new THREE.Vector3(
      this.state.originalCameraPosition[0],
      this.state.originalCameraPosition[1],
      this.state.originalCameraPosition[2]
    );
    
    const targetLookAt = this.state.originalCameraTarget
      ? new THREE.Vector3(
          this.state.originalCameraTarget[0],
          this.state.originalCameraTarget[1],
          this.state.originalCameraTarget[2]
        )
      : new THREE.Vector3(0, 1.6, 0);
    
    const startTime = performance.now();
    const monitorId = this.state.monitorId;
    
    const animate = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / this.ZOOM_DURATION, 1);
      
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      
      // Interpolate position
      this.camera.position.lerpVectors(startPos, targetPos, eased);
      
      // Interpolate target
      if (this.controls) {
        this.controls.target.lerpVectors(startTarget, targetLookAt, eased);
        this.controls.update();
      } else {
        const currentTarget = new THREE.Vector3().lerpVectors(startTarget, targetLookAt, eased);
        this.camera.lookAt(currentTarget);
      }
      
      if (progress < 1) {
        this.animationId = requestAnimationFrame(animate);
      } else {
        // Animation complete
        this.state.isActive = false;
        this.state.isAnimating = false;
        this.state.monitorId = null;
        this.state.monitorName =', ';
        this.notifyListeners();
        
        // Dispatch event
        window.dispatchEvent(new CustomEvent('vs-director-mode-exited', {
          detail: { monitorId },
        }));
        
        log.info('Exited director mode');
      }
    };
    
    this.animationId = requestAnimationFrame(animate);
  }
  
  /**
   * Get current state
   */
  getState(): DirectorModeState {
    return { ...this.state };
  }
  
  /**
   * Subscribe to state changes
   */
  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  
  /**
   * Notify all listeners
   */
  private notifyListeners() {
    const state = this.getState();
    this.listeners.forEach(listener => listener(state));
  }
  
  /**
   * Handle click on a 3D object (check if it's a monitor)
   */
  handleObjectClick(object: any): boolean {
    // Check if clicked object is a monitor
    let current = object;
    while (current) {
      if (current.name?.startsWith('director-monitor-')) {
        const monitorId = current.name.replace('director-monitor-','');
        return this.enterDirectorMode(monitorId);
      }
      current = current.parent;
    }
    return false;
  }
  
  /**
   * Cleanup
   */
  dispose() {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
    }
    this.monitors.clear();
    this.listeners.clear();
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const directorModeService = new DirectorModeService();

export default directorModeService;

