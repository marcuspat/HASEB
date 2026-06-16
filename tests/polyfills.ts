/**
 * Polyfills for Node.js test environment
 * Add TextEncoder/TextDecoder for PostgreSQL pg library compatibility
 */

// TextEncoder/TextDecoder polyfill for Node.js
import { TextEncoder, TextDecoder } from 'util';

// Make TextEncoder/TextDecoder available globally. Cast through `any` because
// the lib DOM constructor typings are stricter than these Node stubs need.
(global as any).TextEncoder = TextEncoder;
(global as any).TextDecoder = TextDecoder;

// Mock WebSocket if needed for any tests
if (!(global as any).WebSocket) {
  (global as any).WebSocket = class MockWebSocket {
    url: string;
    readyState: number;
    constructor(url: string) {
      this.url = url;
      this.readyState = 1; // OPEN
    }
    send() {}
    close() {}
    addEventListener() {}
    removeEventListener() {}
  };
}
