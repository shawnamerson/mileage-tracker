import { supabase } from './supabase';
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

    const { data, error } = await supabase
      .from('vehicles')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error getting vehicles:', error);
      return [];
    }

    return data || [];
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
    const user = await getCurrentUser();
    if (!user) {
      console.error('No user logged in');
      return null;
    }

    const { data, error } = await supabase
      .from('vehicles')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (error) {
      console.error('Error getting vehicle:', error);
      return null;
    }

    return data;
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
    const user = await getCurrentUser();
    if (!user) {
      console.error('No user logged in');
      return null;
    }

    // Try to get the vehicle marked as active
    const { data, error } = await supabase
      .from('vehicles')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (!error && data) {
      return data;
    }

    // If no active vehicle, return the first one
    const vehicles = await getAllVehicles();
    if (vehicles.length > 0) {
      // Set the first one as active
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
    if (!user) {
      throw new Error('No user logged in');
    }

    // First, set all vehicles to inactive
    await supabase
      .from('vehicles')
      .update({ is_active: false })
      .eq('user_id', user.id);

    // Then set the selected vehicle as active
    const { error } = await supabase
      .from('vehicles')
      .update({ is_active: true })
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error setting active vehicle:', error);
      throw error;
    }
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
    if (!user) {
      throw new Error('No user logged in');
    }

    // Check if this is the first vehicle
    const vehicles = await getAllVehicles();
    const isFirstVehicle = vehicles.length === 0;

    const { data, error } = await supabase
      .from('vehicles')
      .insert({
        user_id: user.id,
        name: vehicle.name,
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
        initial_mileage: vehicle.initial_mileage,
        current_mileage: vehicle.initial_mileage,
        bluetooth_device_id: vehicle.bluetooth_device_id,
        bluetooth_device_name: vehicle.bluetooth_device_name,
        is_active: isFirstVehicle, // First vehicle is automatically active
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating vehicle:', error);
      throw error;
    }

    return data;
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
    if (!user) {
      throw new Error('No user logged in');
    }

    const { data, error } = await supabase
      .from('vehicles')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating vehicle:', error);
      throw error;
    }

    return data;
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
    if (!user) {
      throw new Error('No user logged in');
    }

    // Check if this was the active vehicle
    const vehicle = await getVehicle(id);
    const wasActive = vehicle?.is_active;

    const { error } = await supabase
      .from('vehicles')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error deleting vehicle:', error);
      throw error;
    }

    // If we deleted the active vehicle, set a new active vehicle
    if (wasActive) {
      const remaining = await getAllVehicles();
      if (remaining.length > 0) {
        await setActiveVehicle(remaining[0].id);
      }
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

    const newMileage = vehicle.current_mileage + additionalMiles;
    return await updateVehicle(vehicleId, {
      current_mileage: newMileage,
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
    const user = await getCurrentUser();
    if (!user) {
      console.error('No user logged in');
      return null;
    }

    const { data, error } = await supabase
      .from('vehicles')
      .select('*')
      .eq('user_id', user.id)
      .eq('bluetooth_device_id', bluetoothDeviceId)
      .single();

    if (error) {
      console.error('Error getting vehicle by Bluetooth device:', error);
      return null;
    }

    return data;
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
