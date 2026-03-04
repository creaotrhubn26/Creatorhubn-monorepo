/**
 * Browser-safe casting service used by Academy video components.
 * Supports feature detection for AirPlay, Chromecast API presence, and DLNA-like availability.
 */

export interface CastingDevice {
  id: string;
  name: string;
  type: 'airplay' | 'chromecast' | 'dlna';
  ip?: string;
  port?: number;
  icon?: string;
  capabilities?: string[];
}

export interface CastingSession {
  device: CastingDevice;
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  currentMedia?: {
    url: string;
    title: string;
    subtitle?: string;
    duration?: number;
    currentTime?: number;
  };
}

class CastingService {
  private static instance: CastingService;

  private airPlayDevices: CastingDevice[] = [];
  private chromecastDevices: CastingDevice[] = [];
  private dlnaDevices: CastingDevice[] = [];
  private currentSession: CastingSession | null = null;

  private constructor() {
    void this.initializeServices();
  }

  public static getInstance(): CastingService {
    if (!CastingService.instance) {
      CastingService.instance = new CastingService();
    }
    return CastingService.instance;
  }

  private isChromecastApiAvailable(): boolean {
    if (typeof window === 'undefined') return false;
    const chrome = (window as any).chrome;
    return Boolean(chrome?.cast);
  }

  private isAirPlayAvailable(): boolean {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent || '';
    const safariLike = /Safari/.test(ua) && !/Chrome|Chromium|Android/.test(ua);
    const iosLike = /iPhone|iPad|iPod/.test(ua);
    return safariLike || iosLike;
  }

  private isDlnaAvailable(): boolean {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
    return Boolean((navigator as any).presentation);
  }

  private upsertDevice(collection: CastingDevice[], device: CastingDevice): void {
    const exists = collection.some((entry) => entry.id === device.id);
    if (!exists) {
      collection.push(device);
    }
  }

  private async initializeServices(): Promise<void> {
    if (this.isChromecastApiAvailable()) {
      this.upsertDevice(this.chromecastDevices, {
        id: 'chromecast-browser-api',
        name: 'Chromecast',
        type: 'chromecast',
        capabilities: ['video', 'audio'],
      });
    } else {
      this.chromecastDevices = [];
    }

    if (this.isAirPlayAvailable()) {
      this.upsertDevice(this.airPlayDevices, {
        id: 'airplay-browser-api',
        name: 'AirPlay',
        type: 'airplay',
        capabilities: ['video', 'audio'],
      });
    } else {
      this.airPlayDevices = [];
    }

    if (this.isDlnaAvailable()) {
      this.upsertDevice(this.dlnaDevices, {
        id: 'dlna-browser-api',
        name: 'DLNA / Presentation Device',
        type: 'dlna',
        capabilities: ['video', 'audio', 'image'],
      });
    } else {
      this.dlnaDevices = [];
    }
  }

  public async scanForDevices(): Promise<{
    airplay: CastingDevice[];
    chromecast: CastingDevice[];
    dlna: CastingDevice[];
  }> {
    await this.initializeServices();

    return {
      airplay: [...this.airPlayDevices],
      chromecast: [...this.chromecastDevices],
      dlna: [...this.dlnaDevices],
    };
  }

  public async connectToDevice(device: CastingDevice): Promise<CastingSession> {
    this.currentSession = {
      device,
      status: 'connecting',
    };

    try {
      if (device.type === 'chromecast' && !this.isChromecastApiAvailable()) {
        throw new Error('Chromecast API is not available in this browser session.');
      }

      if (device.type === 'airplay' && !this.isAirPlayAvailable()) {
        throw new Error('AirPlay is not available in this browser session.');
      }

      if (device.type === 'dlna' && !this.isDlnaAvailable()) {
        throw new Error('DLNA/Presentation API is not available in this browser session.');
      }

      this.currentSession.status = 'connected';
      return this.currentSession;
    } catch (error) {
      this.currentSession.status = 'error';
      throw error;
    }
  }

  public async castMedia(
    mediaUrl: string,
    metadata: {
      title: string;
      subtitle?: string;
      duration?: number;
    },
  ): Promise<void> {
    if (!this.currentSession || this.currentSession.status !== 'connected') {
      throw new Error('No active casting session.');
    }

    this.currentSession.currentMedia = {
      url: mediaUrl,
      title: metadata.title,
      subtitle: metadata.subtitle,
      duration: metadata.duration,
      currentTime: 0,
    };
  }

  public async disconnect(): Promise<void> {
    if (!this.currentSession) {
      return;
    }

    this.currentSession.status = 'disconnected';
    this.currentSession = null;
  }

  public getCurrentSession(): CastingSession | null {
    return this.currentSession;
  }

  public isConnected(): boolean {
    return this.currentSession?.status === 'connected';
  }

  public async getDeviceCapabilities(device: CastingDevice): Promise<string[]> {
    if (Array.isArray(device.capabilities)) {
      return device.capabilities;
    }

    switch (device.type) {
      case 'chromecast':
      case 'airplay':
      case 'dlna':
        return ['video', 'audio', 'image'];
      default:
        return [];
    }
  }
}

export default CastingService;
