import { testDatabase } from './test-setup';
import { logger } from '../utils/logger';

/**
 * Test database seeding script
 */
async function seedTestDatabase(): Promise<void> {
  try {
    logger.info('Starting test database seeding...');

    // Initialize database connection
    await testDatabase.initialize();

    // Check if database is healthy
    const isHealthy = await testDatabase.healthCheck();
    if (!isHealthy) {
      throw new Error('Test database is not healthy');
    }

    // Create schema
    await testDatabase.createSchema();

    // Seed test data
    await testDatabase.seedTestData();

    logger.info('Test database seeding completed successfully');
  } catch (error) {
    logger.error('Failed to seed test database:', error);
    process.exit(1);
  } finally {
    await testDatabase.close();
  }
}

/**
 * Reset test database (clean and reseed)
 */
async function resetTestDatabase(): Promise<void> {
  try {
    logger.info('Resetting test database...');

    await testDatabase.initialize();
    await testDatabase.cleanup();
    await testDatabase.seedTestData();

    logger.info('Test database reset completed successfully');
  } catch (error) {
    logger.error('Failed to reset test database:', error);
    process.exit(1);
  } finally {
    await testDatabase.close();
  }
}

/**
 * Clean test database
 */
async function cleanTestDatabase(): Promise<void> {
  try {
    logger.info('Cleaning test database...');

    await testDatabase.initialize();
    await testDatabase.cleanup();

    logger.info('Test database cleaning completed successfully');
  } catch (error) {
    logger.error('Failed to clean test database:', error);
    process.exit(1);
  } finally {
    await testDatabase.close();
  }
}

// Command line interface
const command = process.argv[2];

switch (command) {
  case 'seed':
    seedTestDatabase();
    break;
  case 'reset':
    resetTestDatabase();
    break;
  case 'clean':
    cleanTestDatabase();
    break;
  default:
    console.log('Usage: npm run seed:test [seed|reset|clean]');
    console.log('  seed   - Create schema and seed test data');
    console.log('  reset  - Clean and reseed test data');
    console.log('  clean  - Remove all test data');
    process.exit(1);
}