/**
 * Polyfills for Node.js test environment
 * Add TextEncoder/TextDecoder for PostgreSQL pg library compatibility
 */

// TextEncoder/TextDecoder polyfill for Node.js
import { TextEncoder, TextDecoder } from 'util';
import { ReadableStream, WritableStream, TransformStream } from 'node:stream/web';
import { setImmediate as nodeSetImmediate, clearImmediate as nodeClearImmediate } from 'node:timers';

// The jsdom environment does not expose setImmediate/clearImmediate, which
// Express, body-parser and the router rely on. Pull them from Node's timers.
if (typeof global.setImmediate === 'undefined') {
  global.setImmediate = nodeSetImmediate;
}
if (typeof global.clearImmediate === 'undefined') {
  global.clearImmediate = nodeClearImmediate;
}

// Make TextEncoder/TextDecoder available globally
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Web Streams polyfill: the jsdom test environment does not expose the
// ReadableStream/WritableStream/TransformStream globals that @langchain/core
// relies on. Pull them from Node's web-streams implementation.
if (typeof global.ReadableStream === 'undefined') {
  global.ReadableStream = ReadableStream;
}
if (typeof global.WritableStream === 'undefined') {
  global.WritableStream = WritableStream;
}
if (typeof global.TransformStream === 'undefined') {
  global.TransformStream = TransformStream;
}

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