/**
 * CreatorHub Norge - Google Maps Service
 * Free tier integration for map visualization and geocoding
 */

// Type declarations for Google Maps
declare namespace google {
  namespace maps {
    class Map {
      constructor(element: HTMLElement, options: any);
      fitBounds(bounds: LatLngBounds): void;
    }
    class Marker {
      constructor(options: any);
      addListener(event: string, handler: () => void): void;
      setMap(map: Map | null): void;
    }
    class InfoWindow {
      constructor(options: any);
      open(map: Map | null, anchor?: Marker): void;
      close(): void;
    }
    class Geocoder {
      geocode(request: any): Promise<{ results: any[] }>;
    }
    class DirectionsService {
      route(request: any): Promise<any>;
    }
    class DirectionsRenderer {
      constructor(options: any);
      setMap(map: Map | null): void;
      setDirections(directions: any): void;
    }
    class LatLng {
      constructor(lat: number, lng: number);
      lat(): number;
      lng(): number;
    }
    class LatLngBounds {
      constructor(sw: LatLng, ne: LatLng);
    }
    enum Animation {
      DROP = 1
    }
    enum SymbolPath {
      CIRCLE = 0
    }
    enum TravelMode {
      DRIVING = 'DRIVING'
    }
    enum UnitSystem {
      METRIC = 0
    }
    interface MapTypeStyle {
      featureType?: string;
      elementType?: string;
      stylers?: any[];
    }
    interface Icon {
      path: SymbolPath | string;
      fillColor?: string;
      fillOpacity?: number;
      strokeColor?: string;
      strokeWeight?: number;
      scale?: number;
    }
  }
}

export interface MapLocation {
  lat: number;
  lng: number;
  address?: string;
  name?: string;
}

export interface MapMarker {
  id: string;
  position: MapLocation;
  title: string;
  description?: string;
  type: 'photography' | 'drone' | 'access' | 'restriction' | 'property';
  color?: string;
  icon?: string;
}

export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface MapConfig {
  center: MapLocation;
  zoom: number;
  mapTypeId: 'roadmap' | 'satellite' | 'hybrid' | 'terrain';
  markers: MapMarker[];
  bounds?: MapBounds;
}

export interface GeocodingResult {
  address: string;
  location: MapLocation;
  placeId?: string;
  types: string[];
  formattedAddress: string;
}

export interface DirectionsResult {
  routes: Array<{
    summary: string;
    legs: Array<{
      distance: { text: string; value: number };
      duration: { text: string; value: number };
      steps: Array<{
        instruction: string;
        distance: { text: string; value: number };
        duration: { text: string; value: number };
      }>;
    }>;
  }>;
  status: string;
}

class GoogleMapsService {
  private map: google.maps.Map | null = null;
  private markers: google.maps.Marker[] = [];
  private infoWindows: google.maps.InfoWindow[] = [];
  private geocoder: google.maps.Geocoder | null = null;
  private directionsService: google.maps.DirectionsService | null = null;
  private directionsRenderer: google.maps.DirectionsRenderer | null = null;

  /**
   * Initialize Google Maps with free tier configuration
   */
  async initializeMap(containerId: string, config: MapConfig): Promise<google.maps.Map> {
    if (this.map) {
      return this.map;
    }

    // Initialize map with free tier settings
    this.map = new google.maps.Map(document.getElementById(containerId)!, {
      center: config.center,
      zoom: config.zoom,
      mapTypeId: config.mapTypeId,
      // Free tier optimizations
      disableDefaultUI: false,
      zoomControl: true,
      mapTypeControl: true,
      scaleControl: true,
      streetViewControl: true,
      rotateControl: false,
      fullscreenControl: true,
      // Styling for better performance
      styles: this.getFreeTierMapStyles(),
      // Gesture handling
      gestureHandling: 'greedy',
      // Free tier limits
      maxZoom: 18, // Free tier limit
      minZoom: 1
    });

    // Initialize services
    this.geocoder = new google.maps.Geocoder();
    this.directionsService = new google.maps.DirectionsService();
    this.directionsRenderer = new google.maps.DirectionsRenderer({
      draggable: false, // Free tier limitation
      suppressMarkers: false
    });

    // Add markers
    this.addMarkers(config.markers);

    // Fit bounds if provided
    if (config.bounds) {
      this.fitBounds(config.bounds);
    }

    return this.map;
  }

  /**
   * Add markers to the map
   */
  addMarkers(markers: MapMarker[]): void {
    if (!this.map) return;

    // Clear existing markers
    this.clearMarkers();

    markers.forEach(markerData => {
      const marker = new google.maps.Marker({
        position: markerData.position,
        map: this.map,
        title: markerData.title,
        icon: this.getMarkerIcon(markerData.type, markerData.color),
        animation: google.maps.Animation.DROP
      });

      // Add click listener
      marker.addListener('click', () => {
        this.showInfoWindow(marker, markerData);
      });

      this.markers.push(marker);
    });
  }

  /**
   * Show info window for marker
   */
  private showInfoWindow(marker: google.maps.Marker, markerData: MapMarker): void {
    // Close existing info windows
    this.infoWindows.forEach(window => window.close());

    const infoWindow = new google.maps.InfoWindow({
      content: this.createInfoWindowContent(markerData)
    });

    infoWindow.open(this.map, marker);
    this.infoWindows.push(infoWindow);
  }

  /**
   * Create info window content
   */
  private createInfoWindowContent(markerData: MapMarker): string {
    const typeIcons = {
      photography: '📸',
      drone: '🚁',
      access: '🚗',
      restriction: '⚠️',
      property: '🏠'
    };

    return `
      <div style="padding: 10px; max-width: 250px;">
        <h3 style="margin: 0 0 8px 0; color: #1976d2;">
          ${typeIcons[markerData.type]} ${markerData.title}
        </h3>
        ${markerData.description ? `<p style="margin: 0; color: #666;">${markerData.description}</p>` : ', '}
        <p style="margin: 8px 0 0 0; font-size: 12px; color: #999;">
          ${markerData.position.lat.toFixed(6)}, ${markerData.position.lng.toFixed(6)}
        </p>
      </div>
    `;
}

  /**
   * Get marker icon based on type
   */
  private getMarkerIcon(type: MapMarker['type'], color?: string): string | google.maps.Icon {
    const defaultColor = color || this.getTypeColor(type);
    
    return {
      path: google.maps.SymbolPath.CIRCLE,
      fillColor: defaultColor,
      fillOpacity: 0.8,
      strokeColor: '#ffffff',
      strokeWeight: 2,
      scale: 8
    };
  }

  /**
   * Get color for marker type
   */
  private getTypeColor(type: MapMarker['type']): string {
    const colors = {
      photography: '#4caf50',
      drone: '#ff9800',
      access: '#2196f3',
      restriction: '#f44336',
      property: '#9c27b0'
    };
    return colors[type];
  }

  /**
   * Geocode address to coordinates
   */
  async geocodeAddress(address: string): Promise<GeocodingResult | null> {
    if (!this.geocoder) return null;

    try {
      const results = await this.geocoder.geocode({ address });
      
      if (results.results.length > 0) {
        const result = results.results[0];
        return {
          address: result.formatted_address,
          location: {
            lat: result.geometry.location.lat(),
            lng: result.geometry.location.lng()
          },
          placeId: result.place_id,
          types: result.types,
          formattedAddress: result.formatted_address
        };
      }
    } catch (error) {
      console.warn('Geocoding failed: ', error);
    }

    return null;
  }

  /**
   * Reverse geocode coordinates to address
   */
  async reverseGeocode(location: MapLocation): Promise<GeocodingResult | null> {
    if (!this.geocoder) return null;

    try {
      const results = await this.geocoder.geocode({ 
        location: new google.maps.LatLng(location.lat, location.lng) 
      });
      
      if (results.results.length > 0) {
        const result = results.results[0];
        return {
          address: result.formatted_address,
          location,
          placeId: result.place_id,
          types: result.types,
          formattedAddress: result.formatted_address
        };
      }
    } catch (error) {
      console.warn('Reverse geocoding failed:', error);
    }

    return null;
  }

  /**
   * Get directions between two points
   */
  async getDirections(origin: MapLocation, destination: MapLocation): Promise<DirectionsResult | null> {
    if (!this.directionsService) return null;

    try {
      const results = await this.directionsService.route({
        origin: new google.maps.LatLng(origin.lat, origin.lng),
        destination: new google.maps.LatLng(destination.lat, destination.lng),
        travelMode: google.maps.TravelMode.DRIVING,
        unitSystem: google.maps.UnitSystem.METRIC
      });

      return {
        routes: results.routes.map((route: any) => ({
          summary: route.summary,
          legs: route.legs.map((leg: any) => ({
            distance: leg.distance,
            duration: leg.duration,
            steps: leg.steps.map((step: any) => ({
              instruction: step.instructions,
              distance: step.distance,
              duration: step.duration
            }))
          }))
        })),
        status: results.status
      };
    } catch (error) {
      console.warn('Directions failed:', error);
      return null;
    }
  }

  /**
   * Display directions on map
   */
  displayDirections(directions: DirectionsResult): void {
    if (!this.map || !this.directionsRenderer) return;

    this.directionsRenderer.setMap(this.map);
    this.directionsRenderer.setDirections(directions as any);
}

  /**
   * Fit map to bounds
   */
  fitBounds(bounds: MapBounds): void {
    if (!this.map) return;

    const googleBounds = new google.maps.LatLngBounds(
      new google.maps.LatLng(bounds.south, bounds.west),
      new google.maps.LatLng(bounds.north, bounds.east)
    );

    this.map.fitBounds(googleBounds);
}

  /**
   * Clear all markers
   */
  clearMarkers(): void {
    this.markers.forEach(marker => marker.setMap(null));
    this.markers = [];
    this.infoWindows.forEach(window => window.close());
    this.infoWindows = [];
}

  /**
   * Get free tier optimized map styles
   */
  private getFreeTierMapStyles(): google.maps.MapTypeStyle[] {
    return [
      {
        featureType: 'poi',
        elementType: 'labels',
        stylers: [{ visibility: 'off' }]
    },
      {
        featureType: 'transit',
        elementType: 'labels',
        stylers: [{ visibility: 'off' }]
      }
    ];
  }

  /**
   * Create property analysis map configuration
   */
  createPropertyAnalysisMap(property: any, analysis: any): MapConfig {
    const markers: MapMarker[] = [];

    // Property marker
    markers.push({
      id: 'property',
      position: property.coordinates,
      title: 'Property',
      description: `${property.address}<br/>Area: ${property.area} m²`,
      type: 'property'
    });

    // Photography spots
    analysis.photographySpots?.forEach((spot: any, index: number) => {
      markers.push({
        id: `photo_${index}`,
        position: spot.coordinates,
        title: 'Photography Spot',
        description: spot.description,
        type: 'photography'
      });
    });

    // Drone restrictions
    if (!analysis.droneRestrictions.allowed) {
      markers.push({
        id: 'drone_restriction',
        position: property.coordinates,
        title: 'Drone Restricted',
        description: 'Drone flights not allowed in this area',
        type: 'restriction'
      });
    }

    // Access points
    if (analysis.accessAnalysis.parkingAvailable) {
      markers.push({
        id: 'parking',
        position: {
          lat: property.coordinates.lat + 0.001,
          lng: property.coordinates.lng + 0.001
        },
        title: 'Parking Available',
        description: 'Parking available nearby',
        type: 'access'
      });
    }

    return {
      center: property.coordinates,
      zoom: 16,
      mapTypeId: 'satellite',
      markers
    };
  }

  /**
   * Create wedding venue map configuration
   */
  createWeddingVenueMap(venue: any, analysis: any): MapConfig {
    const markers: MapMarker[] = [];

    // Venue marker
    markers.push({
      id: 'venue',
      position: venue.coordinates,
      title: 'Wedding Venue',
      description: `${venue.address}<br/>Area: ${venue.area} m²`,
      type: 'property'
    });

    // Photography spots
    analysis.photographySpots?.forEach((spot: any, index: number) => {
      markers.push({
        id: `photo_${index}`,
        position: spot.coordinates,
        title: 'Photo Location',
        description: spot.description,
        type: 'photography'
      });
    });

    // Access points
    if (analysis.accessAnalysis.parkingAvailable) {
      markers.push({
        id: 'parking',
        position: {
          lat: venue.coordinates.lat + 0.001,
          lng: venue.coordinates.lng + 0.001
        },
        title: 'Guest Parking',
        description: 'Parking available for guests',
        type: 'access'
      });
    }

    return {
      center: venue.coordinates,
      zoom: 15,
      mapTypeId:'hybrid',
      markers
    };
  }

  /**
   * Destroy map instance
   */
  destroy(): void {
    this.clearMarkers();
    if (this.directionsRenderer) {
      this.directionsRenderer.setMap(null);
    }
    this.map = null;
    this.geocoder = null;
    this.directionsService = null;
    this.directionsRenderer = null;
  }
}

// Export singleton instance
export const googleMapsService = new GoogleMapsService();

// Export React hook for easy integration
export function useGoogleMaps() {
  return {
    initializeMap: googleMapsService.initializeMap.bind(googleMapsService),
    addMarkers: googleMapsService.addMarkers.bind(googleMapsService),
    geocodeAddress: googleMapsService.geocodeAddress.bind(googleMapsService),
    reverseGeocode: googleMapsService.reverseGeocode.bind(googleMapsService),
    getDirections: googleMapsService.getDirections.bind(googleMapsService),
    displayDirections: googleMapsService.displayDirections.bind(googleMapsService),
    fitBounds: googleMapsService.fitBounds.bind(googleMapsService),
    clearMarkers: googleMapsService.clearMarkers.bind(googleMapsService),
    createPropertyAnalysisMap: googleMapsService.createPropertyAnalysisMap.bind(googleMapsService),
    createWeddingVenueMap: googleMapsService.createWeddingVenueMap.bind(googleMapsService),
    destroy: googleMapsService.destroy.bind(googleMapsService)
  };
}

export default googleMapsService;






