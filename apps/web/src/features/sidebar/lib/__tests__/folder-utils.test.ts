import { describe, it, expect } from 'vitest';
import {
  buildFolderTree,
  buildBreadcrumbPath,
  getSubfolders,
  getFolderItemCount,
  sortVideos,
  filterBySearch,
  getDescendantFolderIds,
  type FolderNode,
} from '../folder-utils';
import type { Folder, Video } from '@/types';

// ─────────────────────────────────────────────────────
// Test Fixtures
// ─────────────────────────────────────────────────────

const createFolder = (
  id: string,
  name: string,
  parentId: string | null = null,
  level = 0,
  createdAt = '2024-01-01T00:00:00Z'
): Folder => ({
  id,
  name,
  type: 'summarized',
  parentId,
  path: parentId ? `/${parentId}/${id}` : `/${id}`,
  level,
  color: null,
  icon: null,
  createdAt,
  updatedAt: createdAt,
});

const createVideo = (
  id: string,
  title: string,
  folderId: string | null = null,
  createdAt = '2024-01-01T00:00:00Z'
): Video => ({
  id,
  videoSummaryId: `vs_${id}`,
  youtubeId: `yt_${id}`,
  title,
  channel: 'Test Channel',
  duration: 600,
  thumbnailUrl: null,
  status: 'completed',
  folderId,
  createdAt,
});

// ─────────────────────────────────────────────────────
// buildFolderTree Tests
// ─────────────────────────────────────────────────────

describe('folder-utils', () => {
  describe('buildFolderTree', () => {
    it('should return empty array for empty input', () => {
      const result = buildFolderTree([]);
      expect(result).toEqual([]);
    });

    it('should convert flat folders to single-level tree', () => {
      const folders: Folder[] = [
        createFolder('1', 'Alpha'),
        createFolder('2', 'Beta'),
        createFolder('3', 'Gamma'),
      ];

      const result = buildFolderTree(folders);

      expect(result).toHaveLength(3);
      expect(result.map((n) => n.name)).toEqual(['Alpha', 'Beta', 'Gamma']);
      expect(result.every((n) => n.children.length === 0)).toBe(true);
    });

    it('should build nested tree structure', () => {
      const folders: Folder[] = [
        createFolder('root', 'Root'),
        createFolder('child1', 'Child 1', 'root', 1),
        createFolder('child2', 'Child 2', 'root', 1),
        createFolder('grandchild', 'Grandchild', 'child1', 2),
      ];

      const result = buildFolderTree(folders);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Root');
      expect(result[0].children).toHaveLength(2);
      expect(result[0].children.map((c) => c.name)).toEqual(['Child 1', 'Child 2']);
      expect(result[0].children[0].children).toHaveLength(1);
      expect(result[0].children[0].children[0].name).toBe('Grandchild');
    });

    it('should sort children alphabetically by default (name-asc)', () => {
      const folders: Folder[] = [
        createFolder('root', 'Root'),
        createFolder('c', 'Zebra', 'root', 1),
        createFolder('a', 'Alpha', 'root', 1),
        createFolder('b', 'Middle', 'root', 1),
      ];

      const result = buildFolderTree(folders, 'name-asc');

      expect(result[0].children.map((c) => c.name)).toEqual(['Alpha', 'Middle', 'Zebra']);
    });

    it('should sort by name descending when specified', () => {
      const folders: Folder[] = [
        createFolder('root', 'Root'),
        createFolder('a', 'Alpha', 'root', 1),
        createFolder('b', 'Beta', 'root', 1),
      ];

      const result = buildFolderTree(folders, 'name-desc');

      expect(result[0].children.map((c) => c.name)).toEqual(['Beta', 'Alpha']);
    });

    it('should sort by created date ascending', () => {
      const folders: Folder[] = [
        createFolder('root', 'Root'),
        createFolder('b', 'Later', 'root', 1, '2024-01-03T00:00:00Z'),
        createFolder('a', 'Earlier', 'root', 1, '2024-01-01T00:00:00Z'),
        createFolder('c', 'Middle', 'root', 1, '2024-01-02T00:00:00Z'),
      ];

      const result = buildFolderTree(folders, 'created-asc');

      expect(result[0].children.map((c) => c.name)).toEqual(['Earlier', 'Middle', 'Later']);
    });

    it('should sort by created date descending', () => {
      const folders: Folder[] = [
        createFolder('root', 'Root'),
        createFolder('a', 'Earlier', 'root', 1, '2024-01-01T00:00:00Z'),
        createFolder('b', 'Later', 'root', 1, '2024-01-02T00:00:00Z'),
      ];

      const result = buildFolderTree(folders, 'created-desc');

      expect(result[0].children.map((c) => c.name)).toEqual(['Later', 'Earlier']);
    });

    it('should handle orphaned children (parent not in list)', () => {
      const folders: Folder[] = [
        createFolder('orphan', 'Orphan', 'nonexistent', 1),
        createFolder('root', 'Root'),
      ];

      const result = buildFolderTree(folders);

      // Orphan should be treated as root-level
      expect(result).toHaveLength(2);
      expect(result.map((n) => n.name).sort()).toEqual(['Orphan', 'Root']);
    });

    it('should preserve folder properties in nodes', () => {
      const folders: Folder[] = [
        {
          ...createFolder('1', 'Test'),
          color: '#ff0000',
          icon: 'folder',
        },
      ];

      const result = buildFolderTree(folders);

      expect(result[0]).toMatchObject({
        id: '1',
        name: 'Test',
        color: '#ff0000',
        icon: 'folder',
        level: 0,
      });
    });
  });

  // ─────────────────────────────────────────────────────
  // buildBreadcrumbPath Tests
  // ─────────────────────────────────────────────────────

  describe('buildBreadcrumbPath', () => {
    it('should return root only when currentFolder is null', () => {
      const result = buildBreadcrumbPath(null, []);

      expect(result).toEqual([{ id: null, label: 'All Videos' }]);
    });

    it('should use custom root label', () => {
      const result = buildBreadcrumbPath(null, [], 'Home');

      expect(result).toEqual([{ id: null, label: 'Home' }]);
    });

    it('should build path for top-level folder', () => {
      const folder = createFolder('1', 'My Folder');
      const result = buildBreadcrumbPath(folder, [folder]);

      expect(result).toEqual([
        { id: null, label: 'All Videos' },
        { id: '1', label: 'My Folder' },
      ]);
    });

    it('should build full path for nested folder', () => {
      const grandparent = createFolder('gp', 'Grandparent');
      const parent = createFolder('p', 'Parent', 'gp', 1);
      const child = createFolder('c', 'Child', 'p', 2);
      const allFolders = [grandparent, parent, child];

      const result = buildBreadcrumbPath(child, allFolders);

      expect(result).toEqual([
        { id: null, label: 'All Videos' },
        { id: 'gp', label: 'Grandparent' },
        { id: 'p', label: 'Parent' },
        { id: 'c', label: 'Child' },
      ]);
    });

    it('should handle broken chain gracefully', () => {
      // Missing middle ancestor
      const grandparent = createFolder('gp', 'Grandparent');
      const child = createFolder('c', 'Child', 'missing', 2);
      const allFolders = [grandparent, child];

      const result = buildBreadcrumbPath(child, allFolders);

      // Should just show the child since parent is missing
      expect(result).toEqual([
        { id: null, label: 'All Videos' },
        { id: 'c', label: 'Child' },
      ]);
    });
  });

  // ─────────────────────────────────────────────────────
  // getSubfolders Tests
  // ─────────────────────────────────────────────────────

  describe('getSubfolders', () => {
    it('should return root folders when parentId is null', () => {
      const folders: Folder[] = [
        createFolder('1', 'Root1'),
        createFolder('2', 'Root2'),
        createFolder('3', 'Child', '1', 1),
      ];

      const result = getSubfolders(null, folders);

      expect(result).toHaveLength(2);
      expect(result.map((f) => f.name)).toEqual(['Root1', 'Root2']);
    });

    it('should return direct children of specified parent', () => {
      const folders: Folder[] = [
        createFolder('parent', 'Parent'),
        createFolder('child1', 'Zebra', 'parent', 1),
        createFolder('child2', 'Alpha', 'parent', 1),
        createFolder('grandchild', 'Grandchild', 'child1', 2),
        createFolder('other', 'Other'),
      ];

      const result = getSubfolders('parent', folders);

      expect(result).toHaveLength(2);
      // Should be sorted alphabetically
      expect(result.map((f) => f.name)).toEqual(['Alpha', 'Zebra']);
    });

    it('should return empty array when no children exist', () => {
      const folders: Folder[] = [createFolder('1', 'Lonely')];

      const result = getSubfolders('1', folders);

      expect(result).toEqual([]);
    });
  });

  // ─────────────────────────────────────────────────────
  // getFolderItemCount Tests
  // ─────────────────────────────────────────────────────

  describe('getFolderItemCount', () => {
    it('should count subfolders and videos correctly', () => {
      const folders: Folder[] = [
        createFolder('parent', 'Parent'),
        createFolder('sub1', 'Sub 1', 'parent', 1),
        createFolder('sub2', 'Sub 2', 'parent', 1),
      ];
      const videos: Video[] = [
        createVideo('v1', 'Video 1', 'parent'),
        createVideo('v2', 'Video 2', 'parent'),
        createVideo('v3', 'Video 3', 'parent'),
      ];

      const result = getFolderItemCount('parent', folders, videos);

      expect(result).toEqual({
        subfolderCount: 2,
        videoCount: 3,
        total: 5,
      });
    });

    it('should return zeros for empty folder', () => {
      const folders: Folder[] = [createFolder('empty', 'Empty')];
      const videos: Video[] = [];

      const result = getFolderItemCount('empty', folders, videos);

      expect(result).toEqual({
        subfolderCount: 0,
        videoCount: 0,
        total: 0,
      });
    });

    it('should only count direct children, not grandchildren', () => {
      const folders: Folder[] = [
        createFolder('parent', 'Parent'),
        createFolder('child', 'Child', 'parent', 1),
        createFolder('grandchild', 'Grandchild', 'child', 2),
      ];
      const videos: Video[] = [
        createVideo('v1', 'Video 1', 'parent'),
        createVideo('v2', 'Video in child', 'child'),
      ];

      const result = getFolderItemCount('parent', folders, videos);

      expect(result).toEqual({
        subfolderCount: 1, // Only direct child
        videoCount: 1, // Only direct video
        total: 2,
      });
    });
  });

  // ─────────────────────────────────────────────────────
  // sortVideos Tests
  // ─────────────────────────────────────────────────────

  describe('sortVideos', () => {
    it('should sort by name ascending', () => {
      const videos: Video[] = [
        createVideo('3', 'Zebra'),
        createVideo('1', 'Alpha'),
        createVideo('2', 'Beta'),
      ];

      const result = sortVideos(videos, 'name-asc');

      expect(result.map((v) => v.title)).toEqual(['Alpha', 'Beta', 'Zebra']);
    });

    it('should sort by name descending', () => {
      const videos: Video[] = [
        createVideo('1', 'Alpha'),
        createVideo('2', 'Beta'),
      ];

      const result = sortVideos(videos, 'name-desc');

      expect(result.map((v) => v.title)).toEqual(['Beta', 'Alpha']);
    });

    it('should sort by created date ascending', () => {
      const videos: Video[] = [
        createVideo('2', 'Later', null, '2024-01-02T00:00:00Z'),
        createVideo('1', 'Earlier', null, '2024-01-01T00:00:00Z'),
      ];

      const result = sortVideos(videos, 'created-asc');

      expect(result.map((v) => v.title)).toEqual(['Earlier', 'Later']);
    });

    it('should sort by created date descending', () => {
      const videos: Video[] = [
        createVideo('1', 'Earlier', null, '2024-01-01T00:00:00Z'),
        createVideo('2', 'Later', null, '2024-01-02T00:00:00Z'),
      ];

      const result = sortVideos(videos, 'created-desc');

      expect(result.map((v) => v.title)).toEqual(['Later', 'Earlier']);
    });

    it('should not mutate original array', () => {
      const videos: Video[] = [
        createVideo('2', 'Beta'),
        createVideo('1', 'Alpha'),
      ];
      const original = [...videos];

      sortVideos(videos, 'name-asc');

      expect(videos).toEqual(original);
    });

    it('should handle videos with empty titles', () => {
      const videos: Video[] = [
        { ...createVideo('1', 'Alpha'), title: '' },
        createVideo('2', 'Beta'),
      ];

      const result = sortVideos(videos, 'name-asc');

      expect(result.map((v) => v.title)).toEqual(['', 'Beta']);
    });
  });

  // ─────────────────────────────────────────────────────
  // filterBySearch Tests
  // ─────────────────────────────────────────────────────

  describe('filterBySearch', () => {
    const createFolderNode = (
      id: string,
      name: string,
      children: FolderNode[] = []
    ): FolderNode => ({
      id,
      name,
      icon: null,
      color: null,
      level: 0,
      createdAt: '2024-01-01T00:00:00Z',
      children,
    });

    it('should return all items when search is empty', () => {
      const folders: FolderNode[] = [createFolderNode('1', 'Folder')];
      const videos: Video[] = [createVideo('1', 'Video')];

      const result = filterBySearch(folders, videos, '');

      expect(result).toEqual({ folders, videos });
    });

    it('should return all items when search is whitespace', () => {
      const folders: FolderNode[] = [createFolderNode('1', 'Folder')];
      const videos: Video[] = [createVideo('1', 'Video')];

      const result = filterBySearch(folders, videos, '   ');

      expect(result).toEqual({ folders, videos });
    });

    it('should filter videos by title match', () => {
      const folders: FolderNode[] = [];
      const videos: Video[] = [
        createVideo('1', 'React Tutorial'),
        createVideo('2', 'Vue Tutorial'),
        createVideo('3', 'Angular Guide'),
      ];

      const result = filterBySearch(folders, videos, 'tutorial');

      expect(result.videos).toHaveLength(2);
      expect(result.videos.map((v) => v.title)).toEqual([
        'React Tutorial',
        'Vue Tutorial',
      ]);
    });

    it('should filter videos by channel match', () => {
      const videos: Video[] = [
        { ...createVideo('1', 'Video'), channel: 'TechChannel' },
        { ...createVideo('2', 'Other'), channel: 'Gaming' },
      ];

      const result = filterBySearch([], videos, 'tech');

      expect(result.videos).toHaveLength(1);
      expect(result.videos[0].channel).toBe('TechChannel');
    });

    it('should filter folders by name match', () => {
      const folders: FolderNode[] = [
        createFolderNode('1', 'JavaScript'),
        createFolderNode('2', 'Python'),
      ];

      const result = filterBySearch(folders, [], 'java');

      expect(result.folders).toHaveLength(1);
      expect(result.folders[0].name).toBe('JavaScript');
    });

    it('should keep folder if it has matching children', () => {
      const folders: FolderNode[] = [
        createFolderNode('1', 'Parent', [
          createFolderNode('2', 'JavaScript Child'),
        ]),
      ];

      const result = filterBySearch(folders, [], 'javascript');

      expect(result.folders).toHaveLength(1);
      expect(result.folders[0].name).toBe('Parent');
      expect(result.folders[0].children).toHaveLength(1);
    });

    it('should keep folder if it contains matching videos', () => {
      const folders: FolderNode[] = [createFolderNode('folder1', 'My Folder')];
      const videos: Video[] = [
        createVideo('v1', 'JavaScript Tutorial', 'folder1'),
      ];

      const result = filterBySearch(folders, videos, 'javascript');

      expect(result.folders).toHaveLength(1);
      expect(result.folders[0].name).toBe('My Folder');
      expect(result.videos).toHaveLength(1);
    });

    it('should be case insensitive', () => {
      const folders: FolderNode[] = [createFolderNode('1', 'UPPERCASE')];
      const videos: Video[] = [createVideo('1', 'lowercase')];

      const result = filterBySearch(folders, videos, 'LOWER');

      expect(result.videos).toHaveLength(1);

      const result2 = filterBySearch(folders, videos, 'upper');

      expect(result2.folders).toHaveLength(1);
    });
  });

  // ─────────────────────────────────────────────────────
  // getDescendantFolderIds Tests
  // ─────────────────────────────────────────────────────

  describe('getDescendantFolderIds', () => {
    it('should return empty array for folder with no children', () => {
      const folders: Folder[] = [createFolder('1', 'Lonely')];

      const result = getDescendantFolderIds('1', folders);

      expect(result).toEqual([]);
    });

    it('should return direct children', () => {
      const folders: Folder[] = [
        createFolder('parent', 'Parent'),
        createFolder('child1', 'Child 1', 'parent', 1),
        createFolder('child2', 'Child 2', 'parent', 1),
      ];

      const result = getDescendantFolderIds('parent', folders);

      expect(result.sort()).toEqual(['child1', 'child2']);
    });

    it('should return all descendants recursively', () => {
      const folders: Folder[] = [
        createFolder('root', 'Root'),
        createFolder('child', 'Child', 'root', 1),
        createFolder('grandchild1', 'Grandchild 1', 'child', 2),
        createFolder('grandchild2', 'Grandchild 2', 'child', 2),
        createFolder('great', 'Great Grandchild', 'grandchild1', 3),
      ];

      const result = getDescendantFolderIds('root', folders);

      expect(result.sort()).toEqual([
        'child',
        'grandchild1',
        'grandchild2',
        'great',
      ]);
    });

    it('should not include siblings or ancestors', () => {
      const folders: Folder[] = [
        createFolder('root', 'Root'),
        createFolder('target', 'Target', 'root', 1),
        createFolder('sibling', 'Sibling', 'root', 1),
        createFolder('child', 'Child', 'target', 2),
      ];

      const result = getDescendantFolderIds('target', folders);

      expect(result).toEqual(['child']);
      expect(result).not.toContain('root');
      expect(result).not.toContain('sibling');
    });

    it('should handle non-existent folder id', () => {
      const folders: Folder[] = [createFolder('1', 'Existing')];

      const result = getDescendantFolderIds('nonexistent', folders);

      expect(result).toEqual([]);
    });
  });
});
