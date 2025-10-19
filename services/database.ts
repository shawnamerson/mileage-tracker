import * as SQLite from 'expo-sqlite';

export interface Trip {
  id?: number;
  startLocation: string;
  endLocation: string;
  startLatitude?: number;
  startLongitude?: number;
  endLatitude?: number;
  endLongitude?: number;
  distance: number; // in miles or kilometers
  startTime: number; // timestamp
  endTime: number; // timestamp
  purpose: 'business' | 'personal' | 'medical' | 'charity' | 'other';
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface MileageRate {
  id?: number;
  year: number;
  rate: number; // dollars per mile
  createdAt: number;
  updatedAt: number;
}

let db: SQLite.SQLiteDatabase | null = null;

const CURRENT_SCHEMA_VERSION = 2;

// Define migrations - each migration should have a version number
const migrations = [
  {
    version: 1,
    up: async (database: SQLite.SQLiteDatabase) => {
      await database.execAsync(`
        CREATE TABLE IF NOT EXISTS trips (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          startLocation TEXT NOT NULL,
          endLocation TEXT NOT NULL,
          startLatitude REAL,
          startLongitude REAL,
          endLatitude REAL,
          endLongitude REAL,
          distance REAL NOT NULL,
          startTime INTEGER NOT NULL,
          endTime INTEGER NOT NULL,
          purpose TEXT NOT NULL,
          notes TEXT,
          createdAt INTEGER NOT NULL,
          updatedAt INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_trips_purpose ON trips(purpose);
        CREATE INDEX IF NOT EXISTS idx_trips_startTime ON trips(startTime);
      `);
    },
  },
  {
    version: 2,
    up: async (database: SQLite.SQLiteDatabase) => {
      const now = Date.now();
      await database.execAsync(`
        CREATE TABLE IF NOT EXISTS mileage_rates (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          year INTEGER NOT NULL UNIQUE,
          rate REAL NOT NULL,
          createdAt INTEGER NOT NULL,
          updatedAt INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_mileage_rates_year ON mileage_rates(year);

        -- Insert IRS Standard Mileage Rates for Business Use
        -- These are automatically maintained with official IRS rates
        INSERT OR IGNORE INTO mileage_rates (year, rate, createdAt, updatedAt) VALUES
        (2018, 0.545, ${now}, ${now}),
        (2019, 0.580, ${now}, ${now}),
        (2020, 0.575, ${now}, ${now}),
        (2021, 0.560, ${now}, ${now}),
        (2022, 0.625, ${now}, ${now}),
        (2023, 0.655, ${now}, ${now}),
        (2024, 0.670, ${now}, ${now}),
        (2025, 0.700, ${now}, ${now}),
        (2026, 0.700, ${now}, ${now});
      `);
    },
  },
];

async function getCurrentVersion(database: SQLite.SQLiteDatabase): Promise<number> {
  try {
    const result = await database.getFirstAsync<{ version: number }>(
      'SELECT version FROM schema_version ORDER BY version DESC LIMIT 1'
    );
    return result?.version ?? 0;
  } catch (error) {
    // Table doesn't exist yet
    return 0;
  }
}

async function setVersion(database: SQLite.SQLiteDatabase, version: number): Promise<void> {
  await database.runAsync(
    'INSERT INTO schema_version (version, migrated_at) VALUES (?, ?)',
    [version, Date.now()]
  );
}

async function runMigrations(database: SQLite.SQLiteDatabase): Promise<void> {
  // Create schema_version table if it doesn't exist
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS schema_version (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      version INTEGER NOT NULL,
      migrated_at INTEGER NOT NULL
    );
  `);

  const currentVersion = await getCurrentVersion(database);
  console.log(`Current database version: ${currentVersion}`);

  // Run all migrations newer than current version
  for (const migration of migrations) {
    if (migration.version > currentVersion) {
      console.log(`Running migration to version ${migration.version}...`);
      try {
        await migration.up(database);
        await setVersion(database, migration.version);
        console.log(`Migration to version ${migration.version} completed successfully`);
      } catch (error) {
        console.error(`Migration to version ${migration.version} failed:`, error);
        throw new Error(`Database migration failed at version ${migration.version}`);
      }
    }
  }

  if (currentVersion < CURRENT_SCHEMA_VERSION) {
    console.log(`Database migrated from version ${currentVersion} to ${CURRENT_SCHEMA_VERSION}`);
  }
}

export async function initDatabase(): Promise<void> {
  try {
    db = await SQLite.openDatabaseAsync('mileage_tracker.db');

    // Run migrations
    await runMigrations(db);

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
}

export function getDatabase(): SQLite.SQLiteDatabase {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}
