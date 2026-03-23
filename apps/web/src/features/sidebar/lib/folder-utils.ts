import type { Folder, Video } from "@/types";
import type { SortOption } from "@/stores/ui-store";

export interface FolderNode {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  level: number;
  createdAt: string;
  children: FolderNode[];
}

/**
 * Gets a sort comparator function for folder nodes based on the sort option.
 */
function getFolderSortFn(
  sortOption: SortOption
): (a: FolderNode, b: FolderNode) => number {
  switch (sortOption) {
    case "name-asc":
      return (a, b) => a.name.localeCompare(b.name);
    case "name-desc":
      return (a, b) => b.name.localeCompare(a.name);
    case "created-asc":
      return (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    case "created-desc":
      return (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    default:
      return (a, b) => a.name.localeCompare(b.name);
  }
}

/**
 * Converts a flat list of folders into a nested tree structure.
 * Uses parentId to determine hierarchy.
 */
export function buildFolderTree(
  folders: Folder[],
  sortOption: SortOption = "name-asc"
): FolderNode[] {
  const map = new Map<string, FolderNode>();
  const roots: FolderNode[] = [];

  // Create nodes for all folders
  for (const folder of folders) {
    map.set(folder.id, {
      id: folder.id,
      name: folder.name,
      icon: folder.icon,
      color: folder.color,
      level: folder.level,
      createdAt: folder.createdAt,
      children: [],
    });
  }

  // Build tree by connecting parents to children
  for (const folder of folders) {
    const node = map.get(folder.id)!;
    if (folder.parentId && map.has(folder.parentId)) {
      map.get(folder.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  // Sort children at each level using the selected sort option
  const sortFn = getFolderSortFn(sortOption);
  const sortChildren = (nodes: FolderNode[]) => {
    nodes.sort(sortFn);
    for (const node of nodes) {
      sortChildren(node.children);
    }
  };

  sortChildren(roots);

  return roots;
}

/**
 * Builds breadcrumb items from a folder and all folders list.
 * Returns array from root to current folder.
 */
export function buildBreadcrumbPath(
  currentFolder: Folder | null,
  allFolders: Folder[],
  rootLabel = "All Videos"
): { id: string | null; label: string }[] {
  const items: { id: string | null; label: string }[] = [
    { id: null, label: rootLabel }
  ];

  if (!currentFolder) return items;

  // Build path by traversing parentId chain
  const folderMap = new Map(allFolders.map(f => [f.id, f]));
  const ancestors: Folder[] = [];

  let current: Folder | undefined = currentFolder;
  while (current) {
    ancestors.unshift(current);
    current = current.parentId ? folderMap.get(current.parentId) : undefined;
  }

  for (const folder of ancestors) {
    items.push({ id: folder.id, label: folder.name });
  }

  return items;
}

/**
 * Gets direct child folders of a given parent folder.
 * If parentId is null, returns root-level folders.
 */
export function getSubfolders(
  parentId: string | null,
  allFolders: Folder[]
): Folder[] {
  return allFolders
    .filter((folder) => folder.parentId === parentId)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Counts total items (subfolders + videos) in a folder.
 */
export function getFolderItemCount(
  folderId: string,
  allFolders: Folder[],
  allVideos: Video[]
): { subfolderCount: number; videoCount: number; total: number } {
  const subfolderCount = allFolders.filter((f) => f.parentId === folderId).length;
  const videoCount = allVideos.filter((v) => v.folderId === folderId).length;
  return { subfolderCount, videoCount, total: subfolderCount + videoCount };
}

/**
 * Sorts videos based on the sort option.
 */
export function sortVideos(videos: Video[], sortOption: SortOption): Video[] {
  return [...videos].sort((a, b) => {
    switch (sortOption) {
      case "name-asc":
        return (a.title || "").localeCompare(b.title || "");
      case "name-desc":
        return (b.title || "").localeCompare(a.title || "");
      case "created-asc":
        return (
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
      case "created-desc":
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      default:
        return (a.title || "").localeCompare(b.title || "");
    }
  });
}

/**
 * Filters folders and videos by search query.
 * Folders are kept if their name matches OR they have matching descendants.
 * Videos are kept if their title or channel matches.
 */
export function filterBySearch(
  folders: FolderNode[],
  videos: Video[],
  searchQuery: string
): { folders: FolderNode[]; videos: Video[] } {
  if (!searchQuery.trim()) {
    return { folders, videos };
  }

  const query = searchQuery.toLowerCase().trim();

  // Filter videos by title or channel
  const filteredVideos = videos.filter(
    (v) =>
      (v.title || "").toLowerCase().includes(query) ||
      (v.channel || "").toLowerCase().includes(query)
  );

  // Create a set of folder IDs that have matching videos
  const folderIdsWithMatchingVideos = new Set(
    filteredVideos.filter((v) => v.folderId).map((v) => v.folderId)
  );

  // Filter folder tree - keep folder if name matches OR has matching descendants
  const filterFolderTree = (nodes: FolderNode[]): FolderNode[] => {
    return nodes
      .map((node) => {
        const filteredChildren = filterFolderTree(node.children);
        const nameMatches = node.name.toLowerCase().includes(query);
        const hasMatchingChildren = filteredChildren.length > 0;
        const hasMatchingVideos = folderIdsWithMatchingVideos.has(node.id);

        if (nameMatches || hasMatchingChildren || hasMatchingVideos) {
          return { ...node, children: filteredChildren };
        }
        return null;
      })
      .filter((n): n is FolderNode => n !== null);
  };

  return {
    folders: filterFolderTree(folders),
    videos: filteredVideos,
  };
}

/**
 * Gets all descendant folder IDs of a given folder.
 * Useful for excluding folders when moving a folder (can't move into itself or descendants).
 */
export function getDescendantFolderIds(
  folderId: string,
  allFolders: Folder[]
): string[] {
  const descendants: string[] = [];
  const children = allFolders.filter((f) => f.parentId === folderId);

  for (const child of children) {
    descendants.push(child.id);
    descendants.push(...getDescendantFolderIds(child.id, allFolders));
  }

  return descendants;
}
