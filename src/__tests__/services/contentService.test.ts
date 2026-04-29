import { beforeEach, describe, expect, it, jest } from '@jest/globals';

// Mock convexClient before importing ContentService
jest.mock('../../utils/convexClient');

// Mock the generated Convex API
jest.mock('../../convex/_generated/api', () => ({
  api: {
    contents: {
      getAllContents: 'contents:getAllContents',
    },
  },
}));

import { ContentService } from '../../services/contentService';
import { getConvexClient } from '../../utils/convexClient';

const mockQuery = jest.fn();

(getConvexClient as jest.Mock).mockReturnValue({
  query: mockQuery,
});

beforeEach(() => {
  jest.clearAllMocks();
  (getConvexClient as jest.Mock).mockReturnValue({
    query: mockQuery,
  });
});

describe('ContentService', () => {
  describe('getAllContents', () => {
    it('returns list of contents from Convex', async () => {
      const fakeContents = [
        { _id: 'cnt1', _creationTime: 1000, title: 'Doc A' },
        { _id: 'cnt2', _creationTime: 2000, title: 'Doc B' },
      ];
      mockQuery.mockResolvedValueOnce(fakeContents as never);

      const service = new ContentService();
      const result = await service.getAllContents();

      expect(getConvexClient).toHaveBeenCalled();
      expect(mockQuery).toHaveBeenCalledTimes(1);
      expect(result).toEqual(fakeContents);
    });

    it('returns empty array when Convex returns null', async () => {
      mockQuery.mockResolvedValueOnce(null as never);

      const service = new ContentService();
      const result = await service.getAllContents();

      expect(result).toEqual([]);
    });

    it('returns empty array when Convex returns empty array', async () => {
      mockQuery.mockResolvedValueOnce([] as never);

      const service = new ContentService();
      const result = await service.getAllContents();

      expect(result).toEqual([]);
    });

    it('returns empty array when contents API is not available', async () => {
      // Re-mock the Convex API to simulate missing api.contents.getAllContents
      jest.resetModules();
      jest.doMock('../../convex/_generated/api', () => ({ api: {} }));

      // Fresh require without the contents API (jest.resetModules clears the cache)
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { ContentService: FreshContentService } = require('../../services/contentService') as typeof import('../../services/contentService');
      const service = new FreshContentService();
      const result = await service.getAllContents();

      expect(mockQuery).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });
  });
});
