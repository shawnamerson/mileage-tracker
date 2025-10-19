import AsyncStorage from '@react-native-async-storage/async-storage';

const VEHICLES_KEY = 'vehicles';
const ACTIVE_VEHICLE_KEY = 'active_vehicle_id';

export interface Vehicle {
  id: string;
  name: string;
  make?: string;
  model?: string;
  year?: string;
  initialMileage: number;
  currentMileage: number;
  bluetoothDeviceId?: string;
  bluetoothDeviceName?: string;
  dateAdded: number;
  lastUpdated: number;
}

/**
 * Get all vehicles
 */
export async function getAllVehicles(): Promise<Vehicle[]> {
  try {
    const data = await AsyncStorage.getItem(VEHICLES_KEY);
    if (!data) {
      return [];
    }
    return JSON.parse(data);
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
    const activeId = await AsyncStorage.getItem(ACTIVE_VEHICLE_KEY);
    if (activeId) {
      return await getVehicle(activeId);
    }

    // If no active vehicle set, return the first one
    const vehicles = await getAllVehicles();
    return vehicles.length > 0 ? vehicles[0] : null;
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
    await AsyncStorage.setItem(ACTIVE_VEHICLE_KEY, id);
  } catch (error) {
    console.error('Error setting active vehicle:', error);
    throw error;
  }
}

/**
 * Create a new vehicle
 */
export async function createVehicle(
  vehicle: Omit<Vehicle, 'id' | 'dateAdded' | 'lastUpdated' | 'currentMileage'>
): Promise<Vehicle> {
  try {
    const vehicles = await getAllVehicles();

    const newVehicle: Vehicle = {
      ...vehicle,
      id: generateId(),
      currentMileage: vehicle.initialMileage,
      dateAdded: Date.now(),
      lastUpdated: Date.now(),
    };

    vehicles.push(newVehicle);
    await AsyncStorage.setItem(VEHICLES_KEY, JSON.stringify(vehicles));

    // If this is the first vehicle, make it active
    if (vehicles.length === 1) {
      await setActiveVehicle(newVehicle.id);
    }

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
  updates: Partial<Omit<Vehicle, 'id' | 'dateAdded'>>
): Promise<Vehicle | null> {
  try {
    const vehicles = await getAllVehicles();
    const index = vehicles.findIndex(v => v.id === id);

    if (index === -1) {
      return null;
    }

    vehicles[index] = {
      ...vehicles[index],
      ...updates,
      lastUpdated: Date.now(),
    };

    await AsyncStorage.setItem(VEHICLES_KEY, JSON.stringify(vehicles));
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
    const vehicles = await getAllVehicles();
    const filtered = vehicles.filter(v => v.id !== id);
    await AsyncStorage.setItem(VEHICLES_KEY, JSON.stringify(filtered));

    // If we deleted the active vehicle, set a new active vehicle
    const activeId = await AsyncStorage.getItem(ACTIVE_VEHICLE_KEY);
    if (activeId === id && filtered.length > 0) {
      await setActiveVehicle(filtered[0].id);
    } else if (filtered.length === 0) {
      await AsyncStorage.removeItem(ACTIVE_VEHICLE_KEY);
    }
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
    if (!vehicle) {
      return null;
    }

    const newMileage = vehicle.currentMileage + additionalMiles;
    return await updateVehicle(vehicleId, {
      currentMileage: newMileage,
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
    return vehicles.find(v => v.bluetoothDeviceId === bluetoothDeviceId) || null;
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
      bluetoothDeviceId,
      bluetoothDeviceName,
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
      return total + (vehicle.currentMileage - vehicle.initialMileage);
    }, 0);
  } catch (error) {
    console.error('Error getting total miles driven:', error);
    return 0;
  }
}

/**
 * Generate a unique ID for a vehicle
 */
function generateId(): string {
  return `vehicle_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}
