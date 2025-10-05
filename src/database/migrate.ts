#!/usr/bin/env tsx

import { MigrationManager } from './migrations';
import { logger } from '../utils/logger';

async function main() {
  const command = process.argv[2];

  try {
    switch (command) {
      case 'up':
      case 'migrate':
        await MigrationManager.migrate();
        break;
      case 'down':
      case 'rollback':
        const targetVersion = process.argv[3];
        await MigrationManager.rollback(targetVersion);
        break;
      case 'status':
        await MigrationManager.status();
        break;
      default:
        console.log('Usage:');
        console.log('  npm run migrate up       # Apply pending migrations');
        console.log('  npm run migrate down [v] # Rollback to version (or last if not specified)');
        console.log('  npm run migrate status   # Show migration status');
        process.exit(1);
    }
  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}