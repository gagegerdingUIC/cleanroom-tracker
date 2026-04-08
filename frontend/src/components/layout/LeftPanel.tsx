import { useEffect, useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { FolderPlus, Plus, ChevronRight, ChevronDown, Folder, Trash2 } from "lucide-react";
import { api } from "../../api/client";
import { useUIStore } from "../../store/uiStore";
import type { Wafer, WaferFolder } from "../../types";

interface FolderTreeNode {
  folder: WaferFolder;
  children: FolderTreeNode[];
  wafers: Wafer[];
}

function buildTree(folders: WaferFolder[], wafers: Wafer[]): { tree: FolderTreeNode[]; unfiled: Wafer[] } {
  const folderMap = new Map<string, FolderTreeNode>();
  for (const f of folders) {
    folderMap.set(f.id, { folder: f, children: [], wafers: [] });
  }

  const roots: FolderTreeNode[] = [];
  for (const f of folders) {
    const node = folderMap.get(f.id)!;
    if (f.parent_id && folderMap.has(f.parent_id)) {
      folderMap.get(f.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const unfiled: Wafer[] = [];
  for (const w of wafers) {
    if (w.folder_id && folderMap.has(w.folder_id)) {
      folderMap.get(w.folder_id)!.wafers.push(w);
    } else {
      unfiled.push(w);
    }
  }

  return { tree: roots, unfiled };
}

/** Check if targetId is a descendant of ancestorId in the tree */
function isDescendant(folders: WaferFolder[], ancestorId: string, targetId: string): boolean {
  let current = folders.find((f) => f.id === targetId);
  while (current) {
    if (current.parent_id === ancestorId) return true;
    current = folders.find((f) => f.id === current!.parent_id);
  }
  return false;
}

const STATUS_DOT: Record<string, string> = {
  active: "bg-green-500",
  diced: "bg-blue-500",
  archived: "bg-gray-400",
  destroyed: "bg-red-500",
};

export default function LeftPanel() {
  const [folders, setFolders] = useState<WaferFolder[]>([]);
  const [wafers, setWafers] = useState<Wafer[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const selectedIds = useUIStore((s) => s.selectedWaferIds);
  const toggleSelection = useUIStore((s) => s.toggleWaferSelection);
  const setSelectedIds = useUIStore((s) => s.setSelectedWaferIds);
  const waferListVersion = useUIStore((s) => s.waferListVersion);
  const refreshWaferList = useUIStore((s) => s.refreshWaferList);

  const load = () => {
    api.listFolders().then(setFolders);
    api.listWafers().then(setWafers);
  };

  useEffect(() => { load(); }, [waferListVersion]);

  const { tree, unfiled } = buildTree(folders, wafers);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    await api.createFolder({ name: newFolderName.trim() });
    setNewFolderName("");
    setCreatingFolder(false);
    load();
  };

  // --- Folder rename ---
  const startRename = (folderId: string, currentName: string) => {
    setRenamingFolderId(folderId);
    setRenameValue(currentName);
    setTimeout(() => renameInputRef.current?.select(), 0);
  };

  const commitRename = async () => {
    if (!renamingFolderId) return;
    const trimmed = renameValue.trim();
    if (trimmed) {
      await api.updateFolder(renamingFolderId, { name: trimmed });
      load();
    }
    setRenamingFolderId(null);
    setRenameValue("");
  };

  // --- Drag & drop (wafers + folders) ---
  const handleDrop = async (e: React.DragEvent, folderId: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFolderId(null);

    // Check if it's a folder being dragged
    const draggedFolderId = e.dataTransfer.getData("text/folder-id");
    if (draggedFolderId) {
      // Don't drop folder onto itself or its descendant
      if (draggedFolderId === folderId) return;
      if (folderId && isDescendant(folders, draggedFolderId, folderId)) return;
      await api.updateFolder(draggedFolderId, { parent_id: folderId });
      load();
      return;
    }

    // Wafer drop
    const waferId = e.dataTransfer.getData("text/wafer-id");
    if (!waferId) return;
    const idsToMove = selectedIds.has(waferId)
      ? Array.from(selectedIds)
      : [waferId];
    await Promise.all(idsToMove.map((id) => api.moveWaferToFolder(id, folderId)));
    load();
  };

  // --- Bulk delete ---
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    if (!window.confirm(`Delete ${count} wafer${count !== 1 ? "s" : ""}? This cannot be undone.`)) return;
    await Promise.all(Array.from(selectedIds).map((id) => api.deleteWafer(id)));
    setSelectedIds(new Set());
    refreshWaferList();
    navigate("/");
  };

  const isActiveWafer = (id: string) => location.pathname === `/wafers/${id}`;

  const renderWafer = (w: Wafer) => (
    <div
      key={w.id}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/wafer-id", w.id);
        const count = selectedIds.has(w.id) ? selectedIds.size : 1;
        if (count > 1) e.dataTransfer.setDragImage(e.currentTarget, 0, 0);
      }}
      onClick={() => navigate(`/wafers/${w.id}`)}
      className={`flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer rounded mx-1 ${
        isActiveWafer(w.id)
          ? "bg-blue-50 text-blue-700"
          : "text-gray-700 hover:bg-gray-100"
      }`}
    >
      <input
        type="checkbox"
        checked={selectedIds.has(w.id)}
        onChange={(e) => {
          e.stopPropagation();
          toggleSelection(w.id);
        }}
        onClick={(e) => e.stopPropagation()}
        className="shrink-0"
      />
      <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[w.status] || "bg-gray-400"}`} />
      <span className="truncate font-mono text-xs">{w.wafer_id}</span>
      <span className="text-gray-400 text-xs truncate">{w.material}</span>
    </div>
  );

  const getAllWaferIds = (node: FolderTreeNode): string[] => {
    const ids = node.wafers.map((w) => w.id);
    for (const child of node.children) {
      ids.push(...getAllWaferIds(child));
    }
    return ids;
  };

  const toggleFolderSelection = (node: FolderTreeNode) => {
    const folderWaferIds = getAllWaferIds(node);
    const allSelected = folderWaferIds.length > 0 && folderWaferIds.every((id) => selectedIds.has(id));
    const next = new Set(selectedIds);
    for (const wid of folderWaferIds) {
      if (allSelected) next.delete(wid);
      else next.add(wid);
    }
    setSelectedIds(next);
  };

  const renderFolder = (node: FolderTreeNode, depth: number = 0) => {
    const isOpen = expanded.has(node.folder.id);
    const hasContents = node.children.length > 0 || node.wafers.length > 0;
    const folderWaferIds = getAllWaferIds(node);
    const allSelected = folderWaferIds.length > 0 && folderWaferIds.every((id) => selectedIds.has(id));
    const someSelected = !allSelected && folderWaferIds.some((id) => selectedIds.has(id));
    const isRenaming = renamingFolderId === node.folder.id;
    const isDragOver = dragOverFolderId === node.folder.id;

    return (
      <div key={node.folder.id}>
        <div
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData("text/folder-id", node.folder.id);
          }}
          className={`flex items-center gap-1 px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer rounded mx-1 ${
            isDragOver ? "bg-blue-50 ring-1 ring-blue-300" : ""
          }`}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          onClick={() => toggleExpand(node.folder.id)}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOverFolderId(node.folder.id);
          }}
          onDragLeave={() => setDragOverFolderId(null)}
          onDrop={(e) => handleDrop(e, node.folder.id)}
        >
          <input
            type="checkbox"
            checked={allSelected}
            ref={(el) => { if (el) el.indeterminate = someSelected; }}
            onChange={(e) => {
              e.stopPropagation();
              toggleFolderSelection(node);
            }}
            onClick={(e) => e.stopPropagation()}
            className="shrink-0"
          />
          {hasContents ? (
            isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />
          ) : (
            <span className="w-3.5" />
          )}
          <Folder size={14} className="text-gray-400 shrink-0" />
          {isRenaming ? (
            <input
              ref={renameInputRef}
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") commitRename();
                if (e.key === "Escape") {
                  setRenamingFolderId(null);
                  setRenameValue("");
                }
              }}
              onBlur={commitRename}
              onClick={(e) => e.stopPropagation()}
              className="flex-1 min-w-0 border rounded px-1 py-0 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          ) : (
            <span
              className="truncate flex-1"
              onDoubleClick={(e) => {
                e.stopPropagation();
                startRename(node.folder.id, node.folder.name);
              }}
            >
              {node.folder.name}
            </span>
          )}
          <span className="text-gray-400 text-xs ml-auto shrink-0">
            {node.wafers.length}
          </span>
        </div>
        {isOpen && (
          <div>
            {node.children.map((c) => renderFolder(c, depth + 1))}
            {node.wafers.map(renderWafer)}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-64 border-r border-gray-200 bg-white flex flex-col shrink-0 overflow-hidden">
      <div className="p-2 border-b border-gray-100 flex items-center gap-1">
        <button
          onClick={() => navigate("/wafers/new")}
          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50"
        >
          <Plus size={14} />
          Wafer
        </button>
        <button
          onClick={() => setCreatingFolder(true)}
          className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-800 px-2 py-1 rounded hover:bg-gray-100"
        >
          <FolderPlus size={14} />
          Folder
        </button>
        {selectedIds.size > 0 && (
          <button
            onClick={handleBulkDelete}
            className="flex items-center gap-1 text-xs text-red-600 hover:text-red-800 px-2 py-1 rounded hover:bg-red-50 ml-auto"
            title={`Delete ${selectedIds.size} selected wafer${selectedIds.size !== 1 ? "s" : ""}`}
          >
            <Trash2 size={14} />
            {selectedIds.size}
          </button>
        )}
      </div>

      {creatingFolder && (
        <div className="p-2 border-b border-gray-100">
          <input
            autoFocus
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreateFolder();
              if (e.key === "Escape") setCreatingFolder(false);
            }}
            placeholder="Folder name..."
            className="w-full border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      )}

      <div
        className="flex-1 overflow-y-auto py-1"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => handleDrop(e, null)}
      >
        {tree.map((node) => renderFolder(node))}

        {unfiled.length > 0 && (
          <div>
            <div className="px-3 py-1.5 text-xs text-gray-400 uppercase tracking-wider mt-2">
              Unfiled
            </div>
            {unfiled.map(renderWafer)}
          </div>
        )}
      </div>
    </div>
  );
}
