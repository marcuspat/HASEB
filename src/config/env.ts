// Loads environment variables before any other module reads them.
// In ESM, imported modules are evaluated before the importer's body runs, so
// modules that read process.env at top level (e.g. src/api/auth.ts) would see
// an unpopulated env if dotenv only ran in server.ts's body. Importing this
// module first guarantees the .env file is loaded ahead of those reads.
import dotenv from 'dotenv';

dotenv.config();
