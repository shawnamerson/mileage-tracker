import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCurrentUser } from './authService';

export interface Vehicle {
  id: string;
  user_id: string;
  name: string;
  make?: string;
  model?: string;
  year?: string;
  initial_mileage: number;
  current_mileage: number;
  bluetooth_device_id?: string;
  bluetooth_device_name?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const VEHICLES_KEY = 'vehicles';

/**
 * Get all vehicles from local storage
 */
async function getLocalVehicles(): Promise<Vehicle[]> {
  try {
    const vehiclesJson = await AsyncStorage.getItem(VEHICLES_KEY);
    if (!vehiclesJson) return [];
    return JSON.parse(vehiclesJson);
  } catch (error) {
    console.error('[Vehicles] Error getting local vehicles:', error);
    return [];
  }
}

/**
 * Save vehicles to local storage
 */
async function saveLocalVehicles(vehicles: Vehicle[]): Promise<void> {
  try {
    await AsyncStorage.setItem(VEHICLES_KEY, JSON.stringify(vehicles));
  } catch (error) {
    console.error('[Vehicles] Error saving local vehicles:', error);
  }
}

/**
 * Get all vehicles for current user
 */
export async function getAllVehicles(): Promise<Vehicle[]> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      console.error('No user logged in');
      return [];
    }

    const vehicles = await getLocalVehicles();
    return vehicles.filter(v => v.user_id === user.id);
  } catch (error) {
    console.error('Error getting vehicles:', error);
    return [];
  }
}

/**
 * Get a specific vehicle by ID
 */
export async function getVehicle(id: string): Promise<Vehicle | null> {
  try {
    const vehicles = await getAllVehicles();
    return vehicles.find(v => v.id === id) || null;
  } catch (error) {
    console.error('Error getting vehicle:', error);
    return null;
  }
}

/**
 * Get the active/primary vehicle
 */
export async function getActiveVehicle(): Promise<Vehicle | null> {
  try {
    const vehicles = await getAllVehicles();
    const active = vehicles.find(v => v.is_active);

    if (active) return active;

    // If no active vehicle, return the first one
    if (vehicles.length > 0) {
      await setActiveVehicle(vehicles[0].id);
      return vehicles[0];
    }

    return null;
  } catch (error) {
    console.error('Error getting active vehicle:', error);
    return null;
  }
}

/**
 * Set the active/primary vehicle
 */
export async function setActiveVehicle(id: string): Promise<void> {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('No user logged in');

    const vehicles = await getLocalVehicles();

    // Set all user's vehicles to inactive
    const updated = vehicles.map(v =>
      v.user_id === user.id
        ? { ...v, is_active: v.id === id }
        : v
    );

    await saveLocalVehicles(updated);
  } catch (error) {
    console.error('Error setting active vehicle:', error);
    throw error;
  }
}

/**
 * Create a new vehicle
 */
export async function createVehicle(
  vehicle: Omit<Vehicle, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'current_mileage' | 'is_active'>
): Promise<Vehicle> {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('No user logged in');

    const vehicles = await getAllVehicles();
    const isFirstVehicle = vehicles.length === 0;

    const newVehicle: Vehicle = {
      id: `vehicle_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      user_id: user.id,
      name: vehicle.name,
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year,
      initial_mileage: vehicle.initial_mileage,
      current_mileage: vehicle.initial_mileage,
      bluetooth_device_id: vehicle.bluetooth_device_id,
      bluetooth_device_name: vehicle.bluetooth_device_name,
      is_active: isFirstVehicle,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const allVehicles = await getLocalVehicles();
    await saveLocalVehicles([...allVehicles, newVehicle]);

    console.log('[Vehicles] ✅ Vehicle created:', newVehicle.id);
    return newVehicle;
  } catch (error) {
    console.error('Error creating vehicle:', error);
    throw error;
  }
}

/**
 * Update an existing vehicle
 */
export async function updateVehicle(
  id: string,
  updates: Partial<Omit<Vehicle, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
): Promise<Vehicle | null> {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('No user logged in');

    const vehicles = await getLocalVehicles();
    const index = vehicles.findIndex(v => v.id === id && v.user_id === user.id);

    if (index === -1) {
      throw new Error('Vehicle not found');
    }

    vehicles[index] = {
      ...vehicles[index],
      ...updates,
      updated_at: new Date().toISOString(),
    };

    await saveLocalVehicles(vehicles);
    console.log('[Vehicles] ✅ Vehicle updated:', id);
    return vehicles[index];
  } catch (error) {
    console.error('Error updating vehicle:', error);
    throw error;
  }
}

/**
 * Delete a vehicle
 */
export async function deleteVehicle(id: string): Promise<void> {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('No user logged in');

    const vehicle = await getVehicle(id);
    const wasActive = vehicle?.is_active;

    const vehicles = await getLocalVehicles();
    const filtered = vehicles.filter(v => !(v.id === id && v.user_id === user.id));

    await saveLocalVehicles(filtered);

    // If we deleted the active vehicle, set a new active vehicle
    if (wasActive) {
      const remaining = await getAllVehicles();
      if (remaining.length > 0) {
        await setActiveVehicle(remaining[0].id);
      }
    }

    console.log('[Vehicles] ✅ Vehicle deleted:', id);
  } catch (error) {
    console.error('Error deleting vehicle:', error);
    throw error;
  }
}

/**
 * Update vehicle mileage after a trip
 */
export async function updateVehicleMileage(
  vehicleId: string,
  additionalMiles: number
): Promise<Vehicle | null> {
  try {
    const vehicle = await getVehicle(vehicleId);
    if (!vehicle) return null;

    return await updateVehicle(vehicleId, {
      current_mileage: vehicle.current_mileage + additionalMiles,
    });
  } catch (error) {
    console.error('Error updating vehicle mileage:', error);
    throw error;
  }
}

/**
 * Get vehicle by Bluetooth device ID
 */
export async function getVehicleByBluetoothDevice(
  bluetoothDeviceId: string
): Promise<Vehicle | null> {
  try {
    const vehicles = await getAllVehicles();
    return vehicles.find(v => v.bluetooth_device_id === bluetoothDeviceId) || null;
  } catch (error) {
    console.error('Error getting vehicle by Bluetooth device:', error);
    return null;
  }
}

/**
 * Link a Bluetooth device to a vehicle
 */
export async function linkBluetoothToVehicle(
  vehicleId: string,
  bluetoothDeviceId: string,
  bluetoothDeviceName: string
): Promise<Vehicle | null> {
  try {
    return await updateVehicle(vehicleId, {
      bluetooth_device_id: bluetoothDeviceId,
      bluetooth_device_name: bluetoothDeviceName,
    });
  } catch (error) {
    console.error('Error linking Bluetooth to vehicle:', error);
    throw error;
  }
}

/**
 * Get total miles driven across all vehicles
 */
export async function getTotalMilesDriven(): Promise<number> {
  try {
    const vehicles = await getAllVehicles();
    return vehicles.reduce((total, vehicle) => {
      return total + (vehicle.current_mileage - vehicle.initial_mileage);
    }, 0);
  } catch (error) {
    console.error('Error getting total miles driven:', error);
    return 0;
  }
}
