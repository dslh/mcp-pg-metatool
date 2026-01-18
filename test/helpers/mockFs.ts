/**
 * File system mock utilities for testing storage operations
 */

import { vi, type MockedFunction } from 'vitest';

export interface MockFs {
  existsSync: MockedFunction<(path: string) => boolean>;
  mkdirSync: MockedFunction<(path: string, options?: { recursive?: boolean }) => void>;
  writeFileSync: MockedFunction<(path: string, data: string, encoding?: string) => void>;
  readFileSync: MockedFunction<(path: string, encoding?: string) => string>;
  unlinkSync: MockedFunction<(path: string) => void>;
  readdirSync: MockedFunction<(path: string) => string[]>;
}

/**
 * Creates a mock file system with configurable behavior
 */
export function createMockFs(): MockFs {
  return {
    existsSync: vi.fn<(path: string) => boolean>().mockReturnValue(false),
    mkdirSync: vi.fn<(path: string, options?: { recursive?: boolean }) => void>(),
    writeFileSync: vi.fn<(path: string, data: string, encoding?: string) => void>(),
    readFileSync: vi.fn<(path: string, encoding?: string) => string>().mockReturnValue('{}'),
    unlinkSync: vi.fn<(path: string) => void>(),
    readdirSync: vi.fn<(path: string) => string[]>().mockReturnValue([]),
  };
}

/**
 * Sets up a virtual file system with pre-populated files
 */
export function setupVirtualFileSystem(
  mockFs: MockFs,
  files: Map<string, string>
): void {
  mockFs.existsSync.mockImplementation((path: string) => files.has(path));
  mockFs.readFileSync.mockImplementation((path: string) => {
    const content = files.get(path);
    if (content === undefined) {
      throw new Error(`ENOENT: no such file or directory, open '${path}'`);
    }
    return content;
  });
  mockFs.readdirSync.mockImplementation((dirPath: string) => {
    const entries: string[] = [];
    for (const filePath of files.keys()) {
      if (filePath.startsWith(dirPath + '/')) {
        const relativePath = filePath.slice(dirPath.length + 1);
        const firstSegment = relativePath.split('/')[0];
        if (firstSegment && !entries.includes(firstSegment)) {
          entries.push(firstSegment);
        }
      }
    }
    return entries;
  });
}

/**
 * Sets up mock fs to simulate write operations that update the virtual file system
 */
export function setupWritableFileSystem(
  mockFs: MockFs,
  files: Map<string, string>
): void {
  setupVirtualFileSystem(mockFs, files);

  mockFs.writeFileSync.mockImplementation((path: string, data: string) => {
    files.set(path, data);
  });

  mockFs.unlinkSync.mockImplementation((path: string) => {
    if (!files.has(path)) {
      throw new Error(`ENOENT: no such file or directory, unlink '${path}'`);
    }
    files.delete(path);
  });

  mockFs.mkdirSync.mockImplementation(() => {
    // No-op for virtual file system
  });
}
