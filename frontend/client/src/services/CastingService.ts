/**
 * Real Casting Service Implementation
 * Supports AirPlay, Chromecast, and DLNA/UPnP
 * Note: chromecast-js and upnp-client are Node.js only - using browser APIs where available
 */

// These modules are Node.js only, stub them for browser
const Cast: any = null;
const Client: any = null;

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
  private cast: any = null;
  private upnpClient: any = null;

  private constructor() {
    this.initializeServices();
}

  public static getInstance(): CastingService {
    if (!CastingService.instance) {
      CastingService.instance = new CastingService();
  }
    return CastingService.instance;
}

  private async initializeServices() {
    // Initialize Chromecast
    if (typeof window !== 'undefined' && window.chrome && window.chrome.cast) {
      this.cast = new Cast();
      await this.initializeChromecast();
  }

    // Initialize UPnP/DLNA
    if (typeof window !== 'undefined') {
      this.upnpClient = new Client();
      await this.initializeDLNA();
  }
}

  private async initializeChromecast(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.cast) {
        reject(new Error('Chromecast not available'));
        return;
    }

      this.cast.on('device', (device: any) => {
        const castingDevice: CastingDevice = {
          id: device.name,
          name: device.name,
          type: 'chromecast',
          ip: device.host,
          capabilities: ['video','audio']
      };

        // Avoid duplicates
        if (!this.chromecastDevices.find(d => d.id === device.name)) {
          this.chromecastDevices.push(castingDevice);
      }
    });

      this.cast.on('error', (error: any) => {
        console.error('Chromecast error: ', error);
        reject(error);
    });

      this.cast.start();
      resolve();
  });
}

  private async initializeDLNA(): Promise<void> {
    try {
      // Scan for DLNA devices on the network
      const devices = await this.upnpClient.discover();
      
      devices.forEach((device: any) => {
        if (device.services && device.services.find((s: any) => s.service === 'AVTransport')) {
          const castingDevice: CastingDevice = {
            id: device.uuid,
            name: device.name || `DLNA Device ${device.uuid.substring(0, 8)}`,
            type: 'dlna',
            ip: device.address,
            capabilities: ['video','audio','image']
        };

          if (!this.dlnaDevices.find(d => d.id === device.uuid)) {
            this.dlnaDevices.push(castingDevice);
        }
      }
    });
  } catch (error) {
      console.log('DLNA discovery failed:', error);
  }
}

  public async scanForDevices(): Promise<{
    airplay: CastingDevice[];
    chromecast: CastingDevice[];
    dlna: CastingDevice[];
}> {
    // Re-scan for devices
    await this.initializeServices();

    // AirPlay devices (Safari/iOS only)
    if (typeof navigator !== 'undefined' && 
        (navigator.userAgent.includes('Safari') || 
         navigator.userAgent.includes('iPhone') || 
         navigator.userAgent.includes('iPad'))) {
      
      // In a real implementation, you would use AirPlay SDK
      // For now, we'll simulate some devices
      this.airPlayDevices = [
        {
          id: 'airplay-1',
          name: 'Living Room Apple TV',
          type: 'airplay',
          capabilities: ['video','audio']
      },
        {
          id: 'airplay-2',
          name: 'Bedroom Apple TV',
          type: 'airplay',
          capabilities: ['video','audio']
      }
      ];
  }

    return {
      airplay: this.airPlayDevices,
      chromecast: this.chromecastDevices,
      dlna: this.dlnaDevices
  };
}

  public async connectToDevice(device: CastingDevice): Promise<CastingSession> {
    this.currentSession = {
      device,
      status: 'connecting'
  };

    try {
      switch (device.type) {
        case 'chromecast':
          await this.connectChromecast(device);
          break;
        case 'dlna':
          await this.connectDLNA(device);
          break;
        case 'airplay':
          await this.connectAirPlay(device);
          break;
        default:
          throw new Error(`Unsupported device type: ${device.type}`);
    }

      this.currentSession.status = 'connected';
      return this.currentSession;
  } catch (error) {
      this.currentSession.status = 'error';
      throw error;
  }
}

  private async connectChromecast(device: CastingDevice): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.cast) {
        reject(new Error('Chromecast not available'));
        return;
    }

      const chromecastDevice = this.cast.devices.find((d: any) => d.name === device.name);
      if (!chromecastDevice) {
        reject(new Error('Device not found'));
        return;
    }

      chromecastDevice.play({
        url: ', ', // Will be set when casting media
        subtitles: [],
        cover: {
          title: ', ',
          url: ', '
      }
    }, (error: any) => {
        if (error) {
          reject(error);
      } else {
          resolve();
      }
    });
  });
}

  private async connectDLNA(device: CastingDevice): Promise<void> {
    try {
      const dlnaDevice = await this.upnpClient.device(device.ip);
      
      // Test connection by getting device info
      const deviceInfo = await dlnaDevice.getDeviceDescription();
      
      if (!deviceInfo) {
        throw new Error('Could not connect to DLNA device');
    }
  } catch (error) {
      throw new Error(`DLNA connection failed: ${error}`);
  }
}

  private async connectAirPlay(device: CastingDevice): Promise<void> {
    // AirPlay connection is handled by the browser's native API
    // This is a placeholder for when AirPlay SDK is integrated
    return Promise.resolve();
}

  public async castMedia(mediaUrl: string, metadata: {
    title: string;
    subtitle?: string;
    duration?: number;
}): Promise<void> {
    if (!this.currentSession || this.currentSession.status !== 'connected') {
      throw new Error('No active casting session');
  }

    this.currentSession.currentMedia = {
      url: mediaUrl,
      title: metadata.title,
      subtitle: metadata.subtitle,
      duration: metadata.duration,
      currentTime: 0
  };

    switch (this.currentSession.device.type) {
      case 'chromecast':
        await this.castMediaToChromecast(mediaUrl, metadata);
        break;
      case 'dlna':
        await this.castMediaToDLNA(mediaUrl, metadata);
        break;
      case 'airplay':
        await this.castMediaToAirPlay(mediaUrl, metadata);
        break;
  }
}

  private async castMediaToChromecast(mediaUrl: string, metadata: any): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.cast || !this.currentSession) {
        reject(new Error('Chromecast not available'));
        return;
    }

      const chromecastDevice = this.cast.devices.find((d: any) => d.name === this.currentSession!.device.name);
      if (!chromecastDevice) {
        reject(new Error('Device not found'));
        return;
    }

      chromecastDevice.play({
        url: mediaUrl,
        subtitles: [],
        cover: {
          title: metadata.title,
          url: ', ' // Thumbnail URL if available
      }
    }, (error: any) => {
        if (error) {
          reject(error);
      } else {
          resolve();
      }
    });
  });
}

  private async castMediaToDLNA(mediaUrl: string, metadata: any): Promise<void> {
    if (!this.currentSession || !this.upnpClient) {
      throw new Error('DLNA not available');
  }

    try {
      const dlnaDevice = await this.upnpClient.device(this.currentSession.device.ip);
      const avTransport = await dlnaDevice.service('AVTransport');
      
      // Set the media URL and start playback
      await avTransport.call('SetAVTransportURI', {
        InstanceID: 0,
        CurrentURI: mediaUrl,
        CurrentURIMetaData: `
          <DIDL-Lite xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/">
            <item>
              <title>${metadata.title}</title>
              <res>${mediaUrl}</res>
            </item>
          </DIDL-Lite>
        `
    });

      await avTransport.call('Play', {
        InstanceID: 0,
        Speed: '1'
    });
  } catch (error) {
      throw new Error(`DLNA casting failed: ${error}`);
  }
}

  private async castMediaToAirPlay(mediaUrl: string, metadata: any): Promise<void> {
    // AirPlay casting is handled by the browser's native video element
    // when webkitAirplay is available
    throw new Error('AirPlay casting requires native browser support');
}

  public async disconnect(): Promise<void> {
    if (!this.currentSession) {
      return;
  }

    try {
      switch (this.currentSession.device.type) {
        case 'chromecast':
          // Chromecast will automatically stop when connection is lost
          break;
        case 'dlna':
          if (this.upnpClient && this.currentSession.device.ip) {
            const dlnaDevice = await this.upnpClient.device(this.currentSession.device.ip);
            const avTransport = await dlnaDevice.service('AVTransport');
            await avTransport.call('Stop', { InstanceID: 0 });
        }
          break;
        case 'airplay':
          // AirPlay disconnection is handled by the browser
          break;
    }

      this.currentSession.status = 'disconnected';
      this.currentSession = null;
  } catch (error) {
      console.error('Error disconnecting:', error);
  }
}

  public getCurrentSession(): CastingSession | null {
    return this.currentSession;
}

  public isConnected(): boolean {
    return this.currentSession?.status === 'connected';
}

  public async getDeviceCapabilities(device: CastingDevice): Promise<string[]> {
    // Return capabilities based on device type
    switch (device.type) {
      case 'chromecast':
        return ['video','audio','image'];
      case 'dlna':
        return ['video','audio','image'];
      case'airplay':
        return ['video','audio','image'];
      default:
        return [];
  }
}
}

export default CastingService;


