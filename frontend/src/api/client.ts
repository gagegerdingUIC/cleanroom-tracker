import type {
  Wafer,
  WaferFolder,
  Carrier,
  MaterialPreset,
  Machine,
  MachineParameterDefinition,
  ProcessStep,
  ProcessRun,
  Recipe,
  Consumable,
  Measurement,
} from "../types";

const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  listWafers: () => request<Wafer[]>("/api/v1/wafers"),

  getWafer: (id: string) => request<Wafer>(`/api/v1/wafers/${id}`),

  createWafer: (data: Record<string, unknown>) =>
    request<Wafer>("/api/v1/wafers", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateWafer: (id: string, data: Record<string, unknown>) =>
    request<Wafer>(`/api/v1/wafers/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  listSteps: (waferId: string) =>
    request<ProcessStep[]>(`/api/v1/wafers/${waferId}/steps`),

  createStep: (data: Record<string, unknown>) =>
    request<ProcessStep>("/api/v1/steps", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listMachines: () => request<Machine[]>("/api/v1/machines"),

  getParamDefs: (machineId: string) =>
    request<MachineParameterDefinition[]>(
      `/api/v1/machines/${machineId}/parameter-definitions`
    ),

  deleteWafer: (id: string) =>
    request<void>(`/api/v1/wafers/${id}`, { method: "DELETE" }),

  getStep: (id: string) => request<ProcessStep>(`/api/v1/steps/${id}`),

  updateStep: (id: string, data: Record<string, unknown>) =>
    request<ProcessStep>(`/api/v1/steps/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deleteStep: (id: string) =>
    request<void>(`/api/v1/steps/${id}`, { method: "DELETE" }),

  createBatchSteps: (data: Record<string, unknown>) =>
    request<ProcessRun>("/api/v1/runs/batch", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  createMachine: (data: Record<string, unknown>) =>
    request<Machine>("/api/v1/machines", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listRecipes: () => request<Recipe[]>("/api/v1/recipes"),

  getRecipe: (id: string) => request<Recipe>(`/api/v1/recipes/${id}`),

  createRecipe: (data: Record<string, unknown>) =>
    request<Recipe>("/api/v1/recipes", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateRecipe: (id: string, data: Record<string, unknown>) =>
    request<Recipe>(`/api/v1/recipes/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deleteRecipe: (id: string) =>
    request<void>(`/api/v1/recipes/${id}`, { method: "DELETE" }),

  listConsumables: (type?: string) =>
    request<Consumable[]>(
      `/api/v1/consumables${type ? `?consumable_type=${type}` : ""}`
    ),

  createConsumable: (data: Record<string, unknown>) =>
    request<Consumable>("/api/v1/consumables", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateConsumable: (id: string, data: Record<string, unknown>) =>
    request<Consumable>(`/api/v1/consumables/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deleteConsumable: (id: string) =>
    request<void>(`/api/v1/consumables/${id}`, { method: "DELETE" }),

  // Folders
  listFolders: () => request<WaferFolder[]>("/api/v1/folders"),

  createFolder: (data: { name: string; parent_id?: string; sort_order?: number }) =>
    request<WaferFolder>("/api/v1/folders", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateFolder: (id: string, data: Record<string, unknown>) =>
    request<WaferFolder>(`/api/v1/folders/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deleteFolder: (id: string) =>
    request<void>(`/api/v1/folders/${id}`, { method: "DELETE" }),

  moveWaferToFolder: (waferId: string, folderId: string | null) =>
    request<Wafer>(`/api/v1/folders/wafers/${waferId}/folder`, {
      method: "PATCH",
      body: JSON.stringify({ folder_id: folderId }),
    }),

  // Material Presets
  listPresets: (type?: string) =>
    request<MaterialPreset[]>(
      `/api/v1/presets${type ? `?preset_type=${type}` : ""}`
    ),

  createPreset: (data: Record<string, unknown>) =>
    request<MaterialPreset>("/api/v1/presets", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updatePreset: (id: string, data: Record<string, unknown>) =>
    request<MaterialPreset>(`/api/v1/presets/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deletePreset: (id: string) =>
    request<void>(`/api/v1/presets/${id}`, { method: "DELETE" }),

  // Measurements
  listMeasurements: (stepId: string) =>
    request<Measurement[]>(`/api/v1/steps/${stepId}/measurements`),

  createMeasurement: (data: Record<string, unknown>) =>
    request<Measurement>("/api/v1/measurements", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateMeasurement: (id: string, data: Record<string, unknown>) =>
    request<Measurement>(`/api/v1/measurements/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deleteMeasurement: (id: string) =>
    request<void>(`/api/v1/measurements/${id}`, { method: "DELETE" }),

  // Carriers
  listCarriers: () => request<Carrier[]>("/api/v1/carriers"),

  createCarrier: (data: Record<string, unknown>) =>
    request<Carrier>("/api/v1/carriers", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateCarrier: (id: string, data: Record<string, unknown>) =>
    request<Carrier>(`/api/v1/carriers/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deleteCarrier: (id: string) =>
    request<void>(`/api/v1/carriers/${id}`, { method: "DELETE" }),
};
