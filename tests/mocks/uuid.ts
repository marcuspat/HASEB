/**
 * Test mock for the `uuid` package.
 *
 * `uuid` v13 ships as ESM and previously the jest config mapped it to a
 * non-existent `jest-uuid-mock` module, which broke every suite that imported
 * it (directly or transitively). This lightweight CommonJS-friendly shim
 * returns real UUIDs via Node's crypto module.
 */
import { randomUUID } from 'crypto';

export const v4 = (): string => randomUUID();
export const v1 = (): string => randomUUID();
export const v3 = (): string => randomUUID();
export const v5 = (): string => randomUUID();
export const NIL = '00000000-0000-0000-0000-000000000000';
export const validate = (): boolean => true;
export const version = (): number => 4;

export default { v4, v1, v3, v5, NIL, validate, version };
