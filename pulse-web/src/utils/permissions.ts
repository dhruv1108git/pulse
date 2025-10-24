// Web permissions - stub for compatibility
// On web, permissions are requested automatically by the browser

export const requestLocationPermission = async (): Promise<boolean> => {
  // On web, permission is requested when accessing geolocation
  // We'll just return true and let the browser handle it
  return true;
};

export const requestBluetoothPermissions = async (): Promise<boolean> => {
  // Bluetooth not supported on web
  return false;
};

export const checkLocationPermission = async (): Promise<boolean> => {
  if (!navigator.permissions) {
    return true; // Assume granted if API not available
  }

  try {
    const result = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
    return result.state === 'granted';
  } catch (error) {
    console.warn('Permission check error:', error);
    return true; // Assume granted
  }
};

