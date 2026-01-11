import type { Folder, Video } from "@/types";

export interface FolderNode {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  level: number;
  children: FolderNode[];
}

/**
 * Converts a flat list of folders into a nested tree structure.
 * Uses parentId to determine hierarchy.
 */
export function buildFolderTree(folders: Folder[]): FolderNode[] {
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

  // Sort children by name at each level
  const sortChildren = (nodes: FolderNode[]) => {
    nodes.sort((a, b) => a.name.localeCompare(b.name));
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
