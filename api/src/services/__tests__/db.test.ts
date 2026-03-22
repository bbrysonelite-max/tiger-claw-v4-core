import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockQuery = vi.hoisted(() => vi.fn());

vi.mock('pg', () => {
  return {
    Pool: vi.fn().mockImplementation(function() {
      return {
        query: mockQuery,
        on: vi.fn(),
      };
    }),
  };
});

// Important: import db after mocking pg
import { importContacts, addAIKey, getBYOKStatus } from '../db.js';

describe('db.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('importContacts', () => {
    it('returns 0 immediately if contacts array is empty', async () => {
      const count = await importContacts('tenant-1', []);
      expect(count).toBe(0);
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('inserts each contact and returns successful count', async () => {
      mockQuery.mockResolvedValue({});
      const contacts = [
        { name: 'John Doe', email: 'john@example.com', phone: '123456' },
        { name: 'Jane Smith' } // minimal contact
      ];
      
      const count = await importContacts('tenant-1', contacts);
      
      expect(count).toBe(2);
      expect(mockQuery).toHaveBeenCalledTimes(2);
      expect(mockQuery.mock.calls[0][1]).toEqual(['tenant-1', 'John Doe', 'john@example.com', '123456']);
      expect(mockQuery.mock.calls[1][1]).toEqual(['tenant-1', 'Jane Smith', null, null]);
    });

    it('continues importing even if one insertion fails, returning successful count', async () => {
      // First succeeds, second fails, third succeeds
      mockQuery
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(new Error('DB Error'))
        .mockResolvedValueOnce({});
        
      const contacts = [
        { name: 'C1' },
        { name: 'C2' },
        { name: 'C3' }
      ];
      
      const count = await importContacts('tenant-1', contacts);
      
      expect(count).toBe(2);
      expect(mockQuery).toHaveBeenCalledTimes(3);
    });
  });

  describe('addAIKey', () => {
    it('inserts AI key correctly', async () => {
      mockQuery.mockResolvedValue({});
      const data = {
        botId: 'bot-123',
        provider: 'google',
        model: 'gemini',
        encryptedKey: 'enc-123',
        keyPreview: 'AIza...',
        priority: 1
      };
      
      await addAIKey(data);
      
      expect(mockQuery).toHaveBeenCalledTimes(1);
      expect(mockQuery.mock.calls[0][0]).toContain('INSERT INTO bot_ai_keys');
      expect(mockQuery.mock.calls[0][1]).toEqual([
        'bot-123', 'google', 'gemini', 'enc-123', 'AIza...', 1
      ]);
    });
  });

  describe('getBYOKStatus', () => {
    it('returns configured: false when no record exists', async () => {
      mockQuery.mockResolvedValue({ rows: [] });
      
      const result = await getBYOKStatus('tenant-1');
      
      expect(result.configured).toBe(false);
      expect(result.provider).toBeNull();
      expect(mockQuery).toHaveBeenCalledTimes(1);
      expect(mockQuery.mock.calls[0][0]).toContain('SELECT c.provider, c.model');
    });

    it('returns configured: true and values when a record exists', async () => {
      mockQuery.mockResolvedValue({
        rows: [{
          provider: 'openai',
          model: 'gpt-4o',
          key_preview: 'sk-...',
          connection_type: 'byok',
          updated_at: new Date('2024-01-01T00:00:00.000Z')
        }]
      });
      
      const result = await getBYOKStatus('tenant-1');
      
      expect(result.configured).toBe(true);
      expect(result.provider).toBe('openai');
      expect(result.model).toBe('gpt-4o');
      expect(result.keyPreview).toBe('sk-...');
      expect(result.connectionType).toBe('byok');
      expect(result.updatedAt).toBe('2024-01-01T00:00:00.000Z');
    });
    
    it('rethrows error on DB query failure', async () => {
      mockQuery.mockRejectedValue(new Error('Connection failed'));
      
      await expect(getBYOKStatus('tenant-1')).rejects.toThrow('Connection failed');
    });
  });
});
