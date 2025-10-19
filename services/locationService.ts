import * as Location from 'expo-location';

export interface LocationCoords {
  latitude: number;
  longitude: number;
}

export async function requestLocationPermission(): Promise<boolean> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.error('Error requesting location permission:', error);
    return false;
  }
}

export async function getCurrentLocation(): Promise<LocationCoords | null> {
  try {
    const hasPermission = await requestLocationPermission();
    if (!hasPermission) {
      return null;
    }

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    };
  } catch (error) {
    console.error('Error getting current location:', error);
    return null;
  }
}

export async function reverseGeocode(latitude: number, longitude: number): Promise<string> {
  try {
    const addresses = await Location.reverseGeocodeAsync({
      latitude,
      longitude,
    });

    if (addresses.length > 0) {
      const address = addresses[0];
      const parts = [
        address.name,
        address.street,
        address.city,
        address.region,
        address.postalCode,
      ].filter(Boolean);

      return parts.join(', ') || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
    }

    return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
  } catch (error) {
    console.error('Error reverse geocoding:', error);
    return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
  }
}

export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  unit: 'miles' | 'kilometers' = 'miles'
): number {
  const R = unit === 'miles' ? 3959 : 6371; // Earth's radius in miles or km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return Math.round(distance * 100) / 100; // Round to 2 decimal places
}

function toRad(value: number): number {
  return (value * Math.PI) / 180;
}
