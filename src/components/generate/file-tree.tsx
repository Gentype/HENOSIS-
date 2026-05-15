"use client";

import { useMemo, useState } from "react";
import type { GenerateResultFile } from "@/lib/types";
import { ChevronRight, FileCode2, FileJson, FileText, FolderOpen, Folder } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileTreeProps {
  files: GenerateResultFile[];
  activePath: string | null;
  onSelect: (path: string) => void;
}

interface TreeNode {
  name: string;
  path: string;
  type: "file" | "folder";
  children?: TreeNode[];
  language?: string;
}

function buildTree(files: GenerateResultFile[]): TreeNode[] {
  const root: TreeNode[] = [];

  for (const file of files) {
    const parts = file.path.split("/").filter(Boolean);
    let level = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      const fullPath = parts.slice(0, i + 1).join("/");
      let node = level.find((n) => n.name === part);
      if (!node) {
        node = {
          name: part,
          path: fullPath,
          type: isLast ? "file" : "folder",
          language: isLast ? file.language : undefined,
          children: isLast ? undefined : [],
        };
        level.push(node);
      }
      if (!isLast) level = node.children ?? (node.children = []);
    }
  }
  // sort: folders first, then files alphabetically
  const sort = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.type === b.type) return a.name.localeCompare(b.name);
      return a.type === "folder" ? -1 : 1;
    });
    for (const n of nodes) if (n.children) sort(n.children);
  };
  sort(root);
  return root;
}

export function FileTree({ files, activePath, onSelect }: FileTreeProps) {
  const tree = useMemo(() => buildTree(files), [files]);

  return (
    <div className="h-full flex flex-col bg-surface/40 border-r border-border">
      <div className="h-9 px-3 flex items-center justify-between text-xs uppercase tracking-wider text-subtle border-b border-border">
        <span>Explorer</span>
        <span>{files.length} files</span>
      </div>
      <div className="flex-1 overflow-y-auto scroll-soft py-2">
        {tree.map((node) => (
          <TreeNodeView
            key={node.path}
            node={node}
            depth={0}
            activePath={activePath}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}

function TreeNodeView({
  node,
  depth,
  activePath,
  onSelect,
}: {
  node: TreeNode;
  depth: number;
  activePath: string | null;
  onSelect: (path: string) => void;
}) {
  const [open, setOpen] = useState(true);

  if (node.type === "folder") {
    return (
      <div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="w-full flex items-center gap-1.5 px-2 py-1 text-sm text-foreground/85 hover:bg-white/5 transition-colors"
          style={{ paddingLeft: `${8 + depth * 12}px` }}
        >
          <ChevronRight
            className={cn(
              "w-3.5 h-3.5 text-subtle transition-transform",
              open && "rotate-90",
            )}
          />
          {open ? (
            <FolderOpen className="w-3.5 h-3.5 text-accent" />
          ) : (
            <Folder className="w-3.5 h-3.5 text-muted" />
          )}
          <span>{node.name}</span>
        </button>
        {open && node.children && (
          <div>
            {node.children.map((child) => (
              <TreeNodeView
                key={child.path}
                node={child}
                depth={depth + 1}
                activePath={activePath}
                onSelect={onSelect}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  const isActive = activePath === node.path;
  const Icon = node.language === "json" ? FileJson : node.language === "html" || node.language === "css" || node.language === "javascript" ? FileCode2 : FileText;
  return (
    <button
      type="button"
      onClick={() => onSelect(node.path)}
      className={cn(
        "w-full flex items-center gap-1.5 px-2 py-1 text-sm text-left transition-colors",
        isActive
          ? "bg-accent/10 text-accent"
          : "text-foreground/80 hover:bg-white/5",
      )}
      style={{ paddingLeft: `${22 + depth * 12}px` }}
    >
      <Icon className={cn("w-3.5 h-3.5 shrink-0", isActive ? "text-accent" : "text-muted")} />
      <span className="truncate">{node.name}</span>
    </button>
  );
}
