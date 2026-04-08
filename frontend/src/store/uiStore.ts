import { create } from "zustand";

interface UIState {
  // Right panel (process builder)
  rightPanelOpen: boolean;
  toggleRightPanel: () => void;
  setRightPanelOpen: (open: boolean) => void;

  // Wafer selection (for process builder targets)
  selectedWaferIds: Set<string>;
  toggleWaferSelection: (id: string) => void;
  setSelectedWaferIds: (ids: Set<string>) => void;
  clearWaferSelection: () => void;

  // Active folder
  activeFolder: string | null;
  setActiveFolder: (id: string | null) => void;

  // Currently viewed wafer (from WaferDetail route)
  currentWaferId: string | null;
  setCurrentWaferId: (id: string | null) => void;

  // Bump to trigger LeftPanel refresh after mutations (delete, duplicate, etc.)
  waferListVersion: number;
  refreshWaferList: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  rightPanelOpen: false,
  toggleRightPanel: () => set((s) => ({ rightPanelOpen: !s.rightPanelOpen })),
  setRightPanelOpen: (open) => set({ rightPanelOpen: open }),

  selectedWaferIds: new Set(),
  toggleWaferSelection: (id) =>
    set((s) => {
      const next = new Set(s.selectedWaferIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { selectedWaferIds: next };
    }),
  setSelectedWaferIds: (ids) => set({ selectedWaferIds: ids }),
  clearWaferSelection: () => set({ selectedWaferIds: new Set() }),

  activeFolder: null,
  setActiveFolder: (id) => set({ activeFolder: id }),

  currentWaferId: null,
  setCurrentWaferId: (id) => set({ currentWaferId: id }),

  waferListVersion: 0,
  refreshWaferList: () => set((s) => ({ waferListVersion: s.waferListVersion + 1 })),
}));
