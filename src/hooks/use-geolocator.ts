
import { useState, useEffect } from 'react';

type GeolocationStatus = 'pending' | 'success' | 'denied' | 'error';

interface GeolocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

interface GeolocationResult {
  status: GeolocationStatus;
  location: GeolocationData | null;
  error: GeolocationPositionError | null;
}

const useGeolocator = (options?: PositionOptions): GeolocationResult => {
  const [status, setStatus] = useState<GeolocationStatus>('pending');
  const [location, setLocation] = useState<GeolocationData | null>(null);
  const [error, setError] = useState<GeolocationPositionError | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      setStatus('error');
      // A bit of a hack, but GeolocationPositionError doesn't have a constructor
      setError({
        code: 0,
        message: 'Geolocation is not supported by your browser.',
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
      });
      return;
    }

    const successHandler = (position: GeolocationPosition) => {
      setStatus('success');
      setLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: position.timestamp,
      });
      setError(null);
    };

    const errorHandler = (error: GeolocationPositionError) => {
      if (error.code === error.PERMISSION_DENIED) {
        setStatus('denied');
      } else {
        setStatus('error');
      }
      setError(error);
    };

    // Use getCurrentPosition for a one-time, faster location fix.
    // Added a timeout to avoid getting stuck.
    navigator.geolocation.getCurrentPosition(successHandler, errorHandler, {
      ...options,
      timeout: 10000, // 10 seconds
    });

  }, [options]);

  return { status, location, error };
};

export { useGeolocator };
