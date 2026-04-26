import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { db } from './client';
import migrations from './migrations/migrations';

export const useDbMigrations = () => useMigrations(db, migrations);
