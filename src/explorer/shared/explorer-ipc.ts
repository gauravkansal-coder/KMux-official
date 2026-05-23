import type { ListDirectoryRequest } from './explorer-types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function assertNonEmptyString(value: unknown, fieldName: string): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Invalid ${fieldName}: expected a non-empty string.`);
  }
}

function assertOptionalString(value: unknown, fieldName: string): asserts value is string | undefined {
  if (value !== undefined && typeof value !== 'string') {
    throw new Error(`Invalid ${fieldName}: expected a string.`);
  }
}

export const EXPLORER_IPC_CHANNELS = {
  listDirectory: 'explorer:list-directory',
} as const;

export function assertListDirectoryRequest(
  payload: unknown,
): asserts payload is ListDirectoryRequest {
  if (!isRecord(payload)) {
    throw new Error('Invalid list-directory payload.');
  }
  assertNonEmptyString(payload.cwd, 'cwd');
  assertOptionalString(payload.relativePath, 'relativePath');
}
