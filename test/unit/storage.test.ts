/**
 * Tests for file-based storage operations
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createSavedToolConfig } from '../helpers/fixtures.js';

describe('storage', () => {
  // Create mock functions
  const mockExistsSync = vi.fn();
  const mockMkdirSync = vi.fn();
  const mockWriteFileSync = vi.fn();
  const mockReadFileSync = vi.fn();
  const mockUnlinkSync = vi.fn();
  const mockReaddirSync = vi.fn();

  // Dynamic imports to allow proper mocking
  let ensureDataDirectory: () => void;
  let saveToolToFile: (toolName: string, config: ReturnType<typeof createSavedToolConfig>) => void;
  let loadToolFromFile: (toolName: string) => ReturnType<typeof createSavedToolConfig> | null;
  let loadAllTools: () => Map<string, ReturnType<typeof createSavedToolConfig>>;
  let deleteToolFile: (toolName: string) => void;

  beforeEach(async () => {
    // Reset mocks
    vi.resetAllMocks();
    vi.resetModules();

    // Setup mock module with default export
    const mockFs = {
      existsSync: mockExistsSync,
      mkdirSync: mockMkdirSync,
      writeFileSync: mockWriteFileSync,
      readFileSync: mockReadFileSync,
      unlinkSync: mockUnlinkSync,
      readdirSync: mockReaddirSync,
    };
    vi.doMock('node:fs', () => ({
      ...mockFs,
      default: mockFs,
    }));

    // Re-import storage module to get mocked version
    const storage = await import('../../src/storage.js');
    ensureDataDirectory = storage.ensureDataDirectory;
    saveToolToFile = storage.saveToolToFile;
    loadToolFromFile = storage.loadToolFromFile;
    loadAllTools = storage.loadAllTools;
    deleteToolFile = storage.deleteToolFile;
  });

  afterEach(() => {
    vi.doUnmock('node:fs');
  });

  describe('ensureDataDirectory', () => {
    it('creates data directory if it does not exist', () => {
      mockExistsSync.mockReturnValue(false);

      ensureDataDirectory();

      expect(mockMkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('data'),
        { recursive: true }
      );
    });

    it('creates tools subdirectory if it does not exist', () => {
      mockExistsSync
        .mockReturnValueOnce(true)  // data dir exists
        .mockReturnValueOnce(false); // tools dir doesn't exist

      ensureDataDirectory();

      expect(mockMkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('tools'),
        { recursive: true }
      );
    });

    it('does not create directories if they exist', () => {
      mockExistsSync.mockReturnValue(true);

      ensureDataDirectory();

      expect(mockMkdirSync).not.toHaveBeenCalled();
    });
  });

  describe('saveToolToFile', () => {
    beforeEach(() => {
      // Mock ensureDataDirectory to succeed
      mockExistsSync.mockReturnValue(true);
    });

    it('saves tool config as JSON file', () => {
      const config = createSavedToolConfig();

      saveToolToFile('my_tool', config);

      expect(mockWriteFileSync).toHaveBeenCalledWith(
        expect.stringMatching(/my_tool\.json$/),
        expect.any(String),
        'utf8'
      );
    });

    it('writes valid JSON', () => {
      const config = createSavedToolConfig({ name: 'test_tool' });

      saveToolToFile('test_tool', config);

      const writtenData = mockWriteFileSync.mock.calls[0]?.[1] as string;
      const parsed = JSON.parse(writtenData);
      expect(parsed.name).toBe('test_tool');
    });

    it('formats JSON with 2-space indentation', () => {
      const config = createSavedToolConfig();

      saveToolToFile('test', config);

      const writtenData = mockWriteFileSync.mock.calls[0]?.[1] as string;
      expect(writtenData).toContain('  '); // 2-space indent
    });

    it('throws error if write fails', () => {
      mockWriteFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const config = createSavedToolConfig();

      expect(() => saveToolToFile('test', config)).toThrow('Failed to save tool');
      expect(() => saveToolToFile('test', config)).toThrow('Permission denied');
    });
  });

  describe('loadToolFromFile', () => {
    it('returns null if file does not exist', () => {
      mockExistsSync.mockReturnValue(false);

      const result = loadToolFromFile('nonexistent');

      expect(result).toBeNull();
    });

    it('loads and parses valid tool config', () => {
      const config = createSavedToolConfig({ name: 'loaded_tool' });
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(config));

      const result = loadToolFromFile('loaded_tool');

      expect(result).toEqual(config);
    });

    it('throws error for invalid JSON', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('not valid json');

      expect(() => loadToolFromFile('invalid')).toThrow('Failed to load tool');
    });

    it('throws error for invalid config structure', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({ invalid: true }));

      expect(() => loadToolFromFile('invalid')).toThrow('Invalid tool configuration');
    });

    it('validates required fields', () => {
      const incompleteConfig = {
        name: 'test',
        description: 'test',
        // Missing required fields
      };
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(incompleteConfig));

      expect(() => loadToolFromFile('incomplete')).toThrow('Invalid tool configuration');
    });

    it('validates parameter_order is array of strings', () => {
      const config = createSavedToolConfig();
      (config.parameter_order as unknown[]) = [123]; // Invalid type
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(config));

      expect(() => loadToolFromFile('invalid')).toThrow('Invalid tool configuration');
    });

    it('throws error if read fails', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockImplementation(() => {
        throw new Error('Read error');
      });

      expect(() => loadToolFromFile('error')).toThrow('Failed to load tool');
    });
  });

  describe('loadAllTools', () => {
    it('returns empty map if tools directory does not exist', () => {
      mockExistsSync.mockReturnValue(false);

      const result = loadAllTools();

      expect(result.size).toBe(0);
    });

    it('returns empty map if directory is empty', () => {
      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockReturnValue([]);

      const result = loadAllTools();

      expect(result.size).toBe(0);
    });

    it('loads all JSON files from tools directory', () => {
      const tool1 = createSavedToolConfig({ name: 'tool1' });
      const tool2 = createSavedToolConfig({ name: 'tool2' });

      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockReturnValue(['tool1.json', 'tool2.json']);
      mockReadFileSync
        .mockReturnValueOnce(JSON.stringify(tool1))
        .mockReturnValueOnce(JSON.stringify(tool2));

      const result = loadAllTools();

      expect(result.size).toBe(2);
      expect(result.get('tool1')).toEqual(tool1);
      expect(result.get('tool2')).toEqual(tool2);
    });

    it('ignores non-JSON files', () => {
      const tool = createSavedToolConfig({ name: 'tool' });

      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockReturnValue(['tool.json', 'readme.txt', '.gitkeep']);
      mockReadFileSync.mockReturnValue(JSON.stringify(tool));

      const result = loadAllTools();

      expect(result.size).toBe(1);
      expect(mockReadFileSync).toHaveBeenCalledTimes(1);
    });

    it('throws error if tool fails to load', () => {
      const validTool = createSavedToolConfig({ name: 'valid' });

      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockReturnValue(['valid.json', 'invalid.json']);
      mockReadFileSync
        .mockReturnValueOnce(JSON.stringify(validTool))
        .mockReturnValueOnce('invalid json');

      expect(() => loadAllTools()).toThrow();
    });

    it('throws error if directory read fails', () => {
      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockImplementation(() => {
        throw new Error('Directory error');
      });

      expect(() => loadAllTools()).toThrow('Failed to load tools from directory');
    });
  });

  describe('deleteToolFile', () => {
    it('does nothing if file does not exist', () => {
      mockExistsSync.mockReturnValue(false);

      deleteToolFile('nonexistent');

      expect(mockUnlinkSync).not.toHaveBeenCalled();
    });

    it('deletes existing file', () => {
      mockExistsSync.mockReturnValue(true);

      deleteToolFile('my_tool');

      expect(mockUnlinkSync).toHaveBeenCalledWith(
        expect.stringMatching(/my_tool\.json$/)
      );
    });

    it('throws error if delete fails', () => {
      mockExistsSync.mockReturnValue(true);
      mockUnlinkSync.mockImplementation(() => {
        throw new Error('Delete error');
      });

      expect(() => deleteToolFile('test')).toThrow('Failed to delete tool file');
    });
  });
});
