/**
 * Polyfills for Node.js test environment
 * Add TextEncoder/TextDecoder for PostgreSQL pg library compatibility
 */

// TextEncoder/TextDecoder polyfill for Node.js
import { TextEncoder, TextDecoder } from 'util';

// Make TextEncoder/TextDecoder available globally
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Mock WebSocket if needed for any tests
if (!global.WebSocket) {
  global.WebSocket = class MockWebSocket {
    constructor(url) {
      this.url = url;
      this.readyState = 1; // OPEN
    }
    send() {}
    close() {}
    addEventListener() {}
    removeEventListener() {}
  };
}