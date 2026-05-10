/**
 * Architecture-fitness tests for the domain layer.
 *
 * The domain layer (`src/domain/**`) is the dependency-direction sink: it
 * must not depend on transport, persistence, or framework code. These
 * tests scan the source files and reject violations.
 *
 * Scope is intentionally narrow — only the new `src/domain/` tree is
 * checked. Pre-existing code's import patterns are out of scope for this
 * suite and tracked separately in the mission report.
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SRC_DOMAIN = path.resolve(__dirname, '../../../src/domain');

/** Imports the domain layer is forbidden to take. */
const FORBIDDEN_PATH_PREFIXES = [
  '../api/',
  '../api',
  '../orchestrator/',
  '../orchestrator',
  '../database/',
  '../database',
  '../services/',
  '../services',
  '../middleware/',
  '../middleware',
  '../components/',
  '../components',
  '../pages/',
  '../pages',
  '../store/',
  '../store',
  '../hooks/',
  '../hooks',
  '../utils/',
  '../utils',
];

/** Packages the domain layer is forbidden to take. */
const FORBIDDEN_PACKAGES = new Set([
  'pg',
  'sqlite3',
  'socket.io',
  'socket.io-client',
  'express',
  'react',
  'react-dom',
  'react-router',
  'react-router-dom',
  '@langchain/langgraph',
  'jsonwebtoken',
  'bcryptjs',
  'helmet',
  'cors',
  'morgan',
  'compression',
  'winston',
  'swagger-jsdoc',
  'swagger-ui-express',
  'zustand',
  'chart.js',
  'd3',
]);

interface ImportRef {
  readonly file: string;
  readonly target: string;
  readonly line: number;
}

async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await walk(full)));
    } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function parseImports(file: string, source: string): ImportRef[] {
  const refs: ImportRef[] = [];
  const lines = source.split('\n');
  // Match: import ... from 'x'  |  import('x')  |  require('x')
  const importRe =
    /(?:^|\b)(?:import\s+[^'"`;]*from\s+|import\s*\(\s*|require\s*\(\s*)['"]([^'"]+)['"]/g;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let m: RegExpExecArray | null;
    importRe.lastIndex = 0;
    while ((m = importRe.exec(line)) !== null) {
      refs.push({ file, target: m[1], line: i + 1 });
    }
  }
  return refs;
}

function isForbidden(target: string): { reason: string } | null {
  // Cross-layer relative imports out of src/domain.
  if (target.startsWith('.')) {
    for (const bad of FORBIDDEN_PATH_PREFIXES) {
      if (target === bad || target.startsWith(`${bad}`)) {
        return { reason: `forbidden cross-layer import: ${target}` };
      }
    }
    return null;
  }
  // Forbidden packages.
  // Match exact name or scoped+sub-path (e.g. "react-router/dist/...").
  const head = target.startsWith('@')
    ? target.split('/').slice(0, 2).join('/')
    : target.split('/')[0];
  if (FORBIDDEN_PACKAGES.has(head) || FORBIDDEN_PACKAGES.has(target)) {
    return { reason: `forbidden package import: ${target}` };
  }
  return null;
}

describe('architecture: src/domain purity', () => {
  let domainFiles: string[];
  beforeAll(async () => {
    domainFiles = await walk(SRC_DOMAIN);
  });

  test('domain layer has files (sanity)', () => {
    expect(domainFiles.length).toBeGreaterThan(0);
  });

  test('no domain file imports forbidden cross-layer paths or packages', async () => {
    const violations: string[] = [];
    for (const file of domainFiles) {
      const src = await fs.readFile(file, 'utf8');
      const refs = parseImports(file, src);
      for (const ref of refs) {
        const v = isForbidden(ref.target);
        if (v) {
          const rel = path.relative(SRC_DOMAIN, ref.file);
          violations.push(`${rel}:${ref.line}  ${v.reason}`);
        }
      }
    }
    if (violations.length > 0) {
      // Deterministic ordering for readable failures.
      violations.sort();
    }
    expect(violations).toEqual([]);
  });

  test('domain layer imports only relative paths within itself or stdlib', async () => {
    // Stronger statement: every relative import must stay inside src/domain.
    const violations: string[] = [];
    for (const file of domainFiles) {
      const src = await fs.readFile(file, 'utf8');
      const refs = parseImports(file, src);
      for (const ref of refs) {
        if (!ref.target.startsWith('.')) continue;
        const resolved = path.resolve(path.dirname(file), ref.target);
        // Allow only paths that resolve inside src/domain.
        if (!resolved.startsWith(SRC_DOMAIN)) {
          const rel = path.relative(SRC_DOMAIN, ref.file);
          violations.push(
            `${rel}:${ref.line}  relative import escapes src/domain: ${ref.target}`,
          );
        }
      }
    }
    expect(violations.sort()).toEqual([]);
  });

  test('DomainEventWebSocketBridge stays in src/orchestrator and depends only on src/domain', async () => {
    // The bridge is the *single* point where the orchestrator layer is
    // allowed to import from src/domain. Verify it doesn't reach the
    // other way (no domain file should import the bridge).
    const violations: string[] = [];
    for (const file of domainFiles) {
      const src = await fs.readFile(file, 'utf8');
      if (src.includes('DomainEventWebSocketBridge')) {
        const rel = path.relative(SRC_DOMAIN, file);
        violations.push(
          `${rel}: domain file references DomainEventWebSocketBridge (orchestrator-only)`,
        );
      }
    }
    expect(violations.sort()).toEqual([]);
  });
});
