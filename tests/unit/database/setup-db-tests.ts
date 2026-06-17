const util = require('util');

// Make TextEncoder/TextDecoder available globally for pg library
(global as any).TextEncoder = util.TextEncoder;
(global as any).TextDecoder = util.TextDecoder;

// Setup global mock for database connection
const mockQuery = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
});

module.exports = { mockQuery };