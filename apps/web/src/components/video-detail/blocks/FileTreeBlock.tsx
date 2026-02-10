import { memo, useState, useCallback } from 'react';
import { ChevronRight, Folder, FolderOpen, FolderTree, File, FileCode, FileText, FileImage, FileJson } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BlockWrapper } from './BlockWrapper';
import type { FileTreeBlock as FileTreeBlockType, FileTreeNode } from '@vie/types';

interface FileTreeBlockProps {
  block: FileTreeBlockType;
}

interface TreeNodeProps {
  node: FileTreeNode;
  level: number;
  expandedFolders: Set<string>;
  toggleFolder: (path: string) => void;
  parentPath: string;
}

const getFileIcon = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts':
    case 'tsx':
    case 'js':
    case 'jsx':
    case 'py':
    case 'go':
    case 'rs':
      return FileCode;
    case 'json':
      return FileJson;
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'svg':
      return FileImage;
    case 'md':
    case 'txt':
    case 'doc':
      return FileText;
    default:
      return File;
  }
};

const TreeNode = memo(function TreeNode({ node, level, expandedFolders, toggleFolder, parentPath }: TreeNodeProps) {
  const path = `${parentPath}/${node.name}`;
  const isFolder = node.type === 'folder';
  const isExpanded = expandedFolders.has(path);
  const FileIcon = isFolder ? (isExpanded ? FolderOpen : Folder) : getFileIcon(node.name);

  return (
    <div role={isFolder ? 'treeitem' : 'none'} aria-expanded={isFolder ? isExpanded : undefined}>
      <div
        className={cn(
          'flex items-center gap-1.5 py-0.5 px-1 -mx-1 rounded text-sm cursor-default',
          'hover:bg-muted/50 transition-colors',
          isFolder && 'cursor-pointer'
        )}
        style={{ paddingLeft: `${level * 16}px` }}
        onClick={() => isFolder && toggleFolder(path)}
        role={isFolder ? 'button' : undefined}
        tabIndex={isFolder ? 0 : undefined}
        onKeyDown={(e) => {
          if (isFolder && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            toggleFolder(path);
          }
        }}
      >
        {isFolder && (
          <ChevronRight
            className={cn(
              'h-3 w-3 shrink-0 transition-transform text-muted-foreground/50',
              isExpanded && 'rotate-90'
            )}
            aria-hidden="true"
          />
        )}
        {!isFolder && <span className="w-3" />}
        <FileIcon
          className={cn(
            'h-4 w-4 shrink-0',
            isFolder ? 'text-warning dark:drop-shadow-[0_0_4px_currentColor]' : 'text-muted-foreground/70'
          )}
          aria-hidden="true"
        />
        <span className={cn('truncate', isFolder && 'font-medium')}>{node.name}</span>
      </div>

      {/* Children */}
      {isFolder && isExpanded && node.children && (
        <div role="group">
          {node.children.map((child, index) => (
            <TreeNode
              key={`${child.name}-${index}`}
              node={child}
              level={level + 1}
              expandedFolders={expandedFolders}
              toggleFolder={toggleFolder}
              parentPath={path}
            />
          ))}
        </div>
      )}
    </div>
  );
});

/**
 * Renders a file/folder tree structure.
 */
export const FileTreeBlock = memo(function FileTreeBlock({ block }: FileTreeBlockProps) {
  const tree = block.tree ?? [];

  // Initialize expanded folders
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => {
    const expanded = new Set<string>();
    // Auto-expand first level folders
    const addExpanded = (nodes: FileTreeNode[], parentPath: string) => {
      nodes.forEach(node => {
        if (node.type === 'folder') {
          const path = `${parentPath}/${node.name}`;
          if (node.expanded !== false) {
            expanded.add(path);
          }
        }
      });
    };
    addExpanded(tree, '');
    return expanded;
  });

  const toggleFolder = useCallback((path: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  if (tree.length === 0) return null;

  return (
    <BlockWrapper
      blockId={block.blockId}
      label="File tree"
      variant="card"
      headerIcon={<FolderTree className="h-4 w-4" />}
      headerLabel="File Structure"
    >
      <div className="rounded-lg border border-border/50 p-3 bg-muted/20 font-mono text-sm" role="tree">
        {tree.map((node, index) => (
          <TreeNode
            key={`${node.name}-${index}`}
            node={node}
            level={0}
            expandedFolders={expandedFolders}
            toggleFolder={toggleFolder}
            parentPath=""
          />
        ))}
      </div>
    </BlockWrapper>
  );
});
