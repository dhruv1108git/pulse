// Web implementation of geolocation using browser Geolocation API

export interface GeolocationPosition {
  coords: {
    latitude: number;
    longitude: number;
    altitude: number | null;
    accuracy: number;
    altitudeAccuracy: number | null;
    heading: number | null;
    speed: number | null;
  };
  timestamp: number;
}

export interface GeolocationError {
  code: number;
  message: string;
}

export interface GeolocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
}

const Geolocation = {
  getCurrentPosition(
    success: (position: GeolocationPosition) => void,
    error?: (error: GeolocationError) => void,
    options?: GeolocationOptions
  ): void {
    if (!navigator.geolocation) {
      error?.({
        code: 2,
        message: 'Geolocation is not supported by this browser',
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        success({
          coords: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            altitude: position.coords.altitude,
            accuracy: position.coords.accuracy,
            altitudeAccuracy: position.coords.altitudeAccuracy,
            heading: position.coords.heading,
            speed: position.coords.speed,
          },
          timestamp: position.timestamp,
        });
      },
      (err) => {
        error?.({
          code: err.code,
          message: err.message,
        });
      },
      options
    );
  },

  watchPosition(
    success: (position: GeolocationPosition) => void,
    error?: (error: GeolocationError) => void,
    options?: GeolocationOptions
  ): number {
    if (!navigator.geolocation) {
      error?.({
        code: 2,
        message: 'Geolocation is not supported by this browser',
      });
      return -1;
    }

    return navigator.geolocation.watchPosition(
      (position) => {
        success({
          coords: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            altitude: position.coords.altitude,
            accuracy: position.coords.accuracy,
            altitudeAccuracy: position.coords.altitudeAccuracy,
            heading: position.coords.heading,
            speed: position.coords.speed,
          },
          timestamp: position.timestamp,
        });
      },
      (err) => {
        error?.({
          code: err.code,
          message: err.message,
        });
      },
      options
    );
  },

  clearWatch(watchId: number): void {
    if (navigator.geolocation) {
      navigator.geolocation.clearWatch(watchId);
    }
  },
};

export default Geolocation;

