import type { Folder } from "@/types";

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
