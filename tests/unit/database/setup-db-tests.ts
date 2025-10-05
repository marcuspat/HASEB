const { TextEncoder, TextDecoder } = require('util');

// Make TextEncoder/TextDecoder available globally for pg library
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Setup global mock for database connection
const mockQuery = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
});

module.exports = { mockQuery };