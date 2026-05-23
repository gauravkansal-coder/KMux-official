export interface ListDirectoryRequest {
  cwd: string;
  relativePath?: string;
}

export interface ExplorerDirectoryEntry {
  name: string;
  path: string;
  kind: 'directory' | 'file';
}

export type ListDirectoryResponse =
  | {
      ok: true;
      cwd: string;
      relativePath: string;
      entries: ExplorerDirectoryEntry[];
    }
  | {
      ok: false;
      cwd?: string;
      relativePath?: string;
      message: string;
    };

export interface ExplorerApi {
  listDirectory: (request: ListDirectoryRequest) => Promise<ListDirectoryResponse>;
}
