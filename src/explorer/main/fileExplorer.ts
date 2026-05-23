import fs from 'node:fs/promises';
import path from 'node:path';
import type {
  ExplorerDirectoryEntry,
  ListDirectoryRequest,
  ListDirectoryResponse,
} from '../shared/explorer-types';

export interface FileExplorerRuntime {
  readdir: typeof fs.readdir;
}

const defaultRuntime: FileExplorerRuntime = {
  readdir: fs.readdir,
};

const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
};

const toTreePath = (relativePath: string, isDirectory: boolean): string => {
  const normalized = relativePath.split(path.sep).join('/');
  return isDirectory && !normalized.endsWith('/') ? `${normalized}/` : normalized;
};

const normalizeTreeRelativePath = (relativePath: string | undefined): string => {
  if (!relativePath) {
    return '';
  }

  const withoutTrailingSlash = relativePath.replace(/\/+$/u, '');
  if (path.isAbsolute(withoutTrailingSlash)) {
    throw new Error('relativePath must not be absolute.');
  }

  const normalized = path.normalize(withoutTrailingSlash.split('/').join(path.sep));
  if (normalized === '.') {
    return '';
  }
  if (normalized === '..' || normalized.startsWith(`..${path.sep}`)) {
    throw new Error('relativePath must stay inside cwd.');
  }
  return normalized;
};

const sortEntries = (
  left: ExplorerDirectoryEntry,
  right: ExplorerDirectoryEntry,
): number => {
  if (left.kind !== right.kind) {
    return left.kind === 'directory' ? -1 : 1;
  }
  return left.name.localeCompare(right.name, undefined, {
    numeric: true,
    sensitivity: 'base',
  });
};

export async function listDirectory(
  request: ListDirectoryRequest,
  runtime: FileExplorerRuntime = defaultRuntime,
): Promise<ListDirectoryResponse> {
  const cwd = request.cwd.trim();
  const relativePath = normalizeTreeRelativePath(request.relativePath);

  if (!path.isAbsolute(cwd)) {
    return {
      ok: false,
      cwd,
      relativePath,
      message: 'File explorer requires an absolute local cwd.',
    };
  }

  const directoryPath = path.join(cwd, relativePath);

  try {
    const dirents = await runtime.readdir(directoryPath, { withFileTypes: true });
    const entries = dirents
      .map((dirent): ExplorerDirectoryEntry => {
        const isDirectory = dirent.isDirectory();
        const entryRelativePath = relativePath
          ? path.join(relativePath, dirent.name)
          : dirent.name;

        return {
          name: dirent.name,
          path: toTreePath(entryRelativePath, isDirectory),
          kind: isDirectory ? 'directory' : 'file',
        };
      })
      .sort(sortEntries);

    return {
      ok: true,
      cwd,
      relativePath: toTreePath(relativePath, false),
      entries,
    };
  } catch (error) {
    return {
      ok: false,
      cwd,
      relativePath: toTreePath(relativePath, false),
      message: toErrorMessage(error),
    };
  }
}
