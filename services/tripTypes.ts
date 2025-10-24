// Shared types for trip-related services
// This file has no dependencies to avoid circular imports

export interface Trip {
  id?: string;
  user_id?: string;
  start_location: string;
  end_location: string;
  start_latitude: number;
  start_longitude: number;
  end_latitude: number;
  end_longitude: number;
  distance: number; // in miles
  start_time: number; // timestamp in milliseconds
  end_time: number; // timestamp in milliseconds
  purpose: 'business' | 'personal' | 'medical' | 'charity' | 'other';
  notes?: string;
  created_at?: string;
  updated_at?: string;
  is_deleted?: boolean;
  deleted_at?: string;
}
