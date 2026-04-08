import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Pencil, Check, X, Copy, Trash2, GripVertical, MoreHorizontal } from "lucide-react";
import { api } from "../api/client";
import { useUIStore } from "../store/uiStore";
import type { Wafer, ProcessStep, Carrier } from "../types";
import StepParamForm from "../components/process-builder/StepParamForm";
import {
  apiStepToBuilderStep,
  stepToApiPayload,
  inferBlockType,
  type BuilderStepData,
} from "../components/process-builder/StepTemplates";
import MeasurementPanel from "../components/wafer-map/MeasurementPanel";
import { formatCST } from "../utils/datetime";

const CATEGORY_COLORS: Record<string, string> = {
  deposition: "bg-purple-100 text-purple-800",
  etching: "bg-orange-100 text-orange-800",
  lithography: "bg-yellow-100 text-yellow-800",
  characterization: "bg-cyan-100 text-cyan-800",
  packaging: "bg-pink-100 text-pink-800",
  miscellaneous: "bg-gray-100 text-gray-800",
};

const STATUS_COLORS: Record<string, string> = {
  completed: "text-green-600",
  in_progress: "text-blue-600",
  planned: "text-gray-400",
  failed: "text-red-600",
  skipped: "text-gray-400 line-through",
};

const MATERIALS = ["Si", "GaAs", "InP", "SiC", "Sapphire", "Glass", "GaN", "Ge"];
const SHAPES = ["circular", "square", "rectangular", "custom"];
const DOPING_TYPES = ["p", "n", "undoped", "semi-insulating"];
const ORIENTATIONS = ["(100)", "(111)", "(110)"];
const STATUSES = ["active", "recycled", "diced", "archived", "destroyed"];

const inputClass =
  "border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500";

export default function WaferDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [wafer, setWafer] = useState<Wafer | null>(null);
  const [steps, setSteps] = useState<ProcessStep[]>([]);
  const [expandedStep, setExpandedStep] = useState<string | null>(null);
  const [editing, setEditing] = useState(true);
  const dragStepRef = useRef<string | null>(null);
  const dragOverStepRef = useRef<string | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string | number | null>>({});
  const [saving, setSaving] = useState(false);
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [editBuilderStep, setEditBuilderStep] = useState<BuilderStepData | null>(null);
  const [editStepParams, setEditStepParams] = useState<Record<string, string>>({});
  const [editStepNotes, setEditStepNotes] = useState("");
  const [savingStep, setSavingStep] = useState(false);
  const [stepSaveStatus, setStepSaveStatus] = useState<"" | "saving" | "saved">("");
  const stepAutoSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setRightPanelOpen = useUIStore((s) => s.setRightPanelOpen);
  const toggleWaferSelection = useUIStore((s) => s.toggleWaferSelection);
  const selectedIds = useUIStore((s) => s.selectedWaferIds);
  const refreshWaferList = useUIStore((s) => s.refreshWaferList);
  const waferListVersion = useUIStore((s) => s.waferListVersion);
  const setCurrentWaferId = useUIStore((s) => s.setCurrentWaferId);
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [allWafers, setAllWafers] = useState<Wafer[]>([]);
  const [showDuplicateMenu, setShowDuplicateMenu] = useState(false);
  const duplicateMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.listCarriers().then(setCarriers);
    api.listWafers().then(setAllWafers);
  }, []);

  useEffect(() => {
    if (!id) return;
    setCurrentWaferId(id);
    api.getWafer(id).then((w) => {
      setWafer(w);
      // Auto-populate edit form so we're always in edit mode
      setEditForm({
        wafer_id: w.wafer_id,
        material: w.material,
        diameter_mm: w.diameter_mm,
        shape: w.shape,
        doping_type: w.doping_type,
        doping_level: w.doping_level,
        resistivity_ohm_cm: w.resistivity_ohm_cm,
        crystal_orientation: w.crystal_orientation,
        vendor: w.vendor,
        lot_number: w.lot_number,
        status: w.status,
        notes: w.notes,
      });
      setEditing(true);
    });
    api.listSteps(id).then(setSteps);
  }, [id, waferListVersion]);

  const startEditing = () => {
    if (!wafer) return;
    setEditForm({
      wafer_id: wafer.wafer_id,
      material: wafer.material,
      diameter_mm: wafer.diameter_mm,
      shape: wafer.shape,
      doping_type: wafer.doping_type,
      doping_level: wafer.doping_level,
      resistivity_ohm_cm: wafer.resistivity_ohm_cm,
      crystal_orientation: wafer.crystal_orientation,
      vendor: wafer.vendor,
      lot_number: wafer.lot_number,
      status: wafer.status,
      notes: wafer.notes,
    });
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setEditForm({});
  };

  const saveEdits = async () => {
    if (!id || !wafer) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(editForm)) {
        if (value !== (wafer as unknown as Record<string, unknown>)[key]) {
          payload[key] = value === "" ? null : value;
        }
      }
      if (Object.keys(payload).length > 0) {
        const updated = await api.updateWafer(id, payload);
        setWafer(updated);
        refreshWaferList();
      }
      setEditing(false);
    } catch (err) {
      alert(String(err));
    } finally {
      setSaving(false);
    }
  };

  const setField = (key: string, value: string | number | null) =>
    setEditForm((prev) => ({ ...prev, [key]: value }));

  const nextWaferId = (waferId: string) => {
    const match = waferId.match(/^(.*?)(\d+)$/);
    if (match) {
      const num = parseInt(match[2], 10) + 1;
      return match[1] + String(num).padStart(match[2].length, "0");
    }
    return waferId + "-001";
  };

  const handleDuplicate = async (includeSteps: boolean) => {
    if (!wafer) return;
    setShowDuplicateMenu(false);
    try {
      const created = await api.createWafer({
        wafer_id: nextWaferId(wafer.wafer_id),
        material: wafer.material,
        diameter_mm: wafer.diameter_mm,
        shape: wafer.shape,
        doping_type: wafer.doping_type,
        doping_level: wafer.doping_level,
        resistivity_ohm_cm: wafer.resistivity_ohm_cm,
        crystal_orientation: wafer.crystal_orientation,
        vendor: wafer.vendor,
        lot_number: wafer.lot_number,
        status: "active",
        notes: wafer.notes,
      });

      if (includeSteps && steps.length > 0) {
        for (const step of steps) {
          const payload = stepToApiPayload(
            apiStepToBuilderStep(step) ?? {
              id: "dup",
              type: "generic" as const,
              name: step.name,
              category: step.category,
              machine_id: step.machine_id,
              fields: {},
              timestamp: step.timestamp_start,
            },
            created.id,
            step.step_number
          );
          await api.createStep(payload);
        }
      }

      refreshWaferList();
      navigate(`/wafers/${created.id}`);
    } catch (err) {
      alert(String(err));
    }
  };

  // Close duplicate menu on outside click
  useEffect(() => {
    if (!showDuplicateMenu) return;
    const handler = (e: MouseEvent) => {
      if (duplicateMenuRef.current && !duplicateMenuRef.current.contains(e.target as Node)) {
        setShowDuplicateMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showDuplicateMenu]);

  const handleDeleteWafer = async () => {
    if (!id) return;
    if (!window.confirm(`Delete wafer ${wafer?.wafer_id} and all its steps?`)) return;
    await api.deleteWafer(id);
    refreshWaferList();
    navigate("/wafers");
  };

  const handleDeleteStep = async (stepId: string, stepName: string) => {
    if (!window.confirm(`Delete step "${stepName}"?`)) return;
    await api.deleteStep(stepId);
    setSteps((prev) => prev.filter((s) => s.id !== stepId));
    if (expandedStep === stepId) setExpandedStep(null);
  };

  const handleOpenBuilder = () => {
    if (!id) return;
    if (!selectedIds.has(id)) toggleWaferSelection(id);
    setRightPanelOpen(true);
  };

  const startEditingStep = (step: ProcessStep) => {
    const builderStep = apiStepToBuilderStep(step);
    if (builderStep) {
      setEditBuilderStep(builderStep);
      setEditStepParams({});
    } else {
      // Fallback for unrecognized step types
      const params: Record<string, string> = {};
      for (const pv of step.parameter_values) {
        params[pv.param_name] = pv.value_raw;
      }
      setEditStepParams(params);
      setEditBuilderStep(null);
    }
    setEditStepNotes(step.notes ?? "");
    setEditingStepId(step.id);
    setExpandedStep(step.id);
    setStepSaveStatus("");
  };

  const handleEditFieldChange = (field: string, value: string) => {
    setEditBuilderStep((prev) =>
      prev ? { ...prev, fields: { ...prev.fields, [field]: value } } : null
    );
  };

  const saveStepEdits = async (step: ProcessStep, silent = false) => {
    if (!silent) setSavingStep(true);
    else setStepSaveStatus("saving");
    try {
      let parameterValues;
      let name: string | undefined;

      if (editBuilderStep) {
        const payload = stepToApiPayload(editBuilderStep, step.wafer_id, step.step_number);
        parameterValues = payload.parameter_values;
        name = payload.name as string;
      } else {
        parameterValues = Object.entries(editStepParams).map(([pname, val]) => {
          const orig = step.parameter_values.find((pv) => pv.param_name === pname);
          return {
            param_name: pname,
            value_raw: val,
            value_numeric: isNaN(Number(val)) ? null : Number(val),
            unit: orig?.unit ?? null,
          };
        });
      }

      const updatePayload: Record<string, unknown> = {
        notes: editStepNotes || null,
        parameter_values: parameterValues,
      };
      if (name) updatePayload.name = name;

      const updated = await api.updateStep(step.id, updatePayload);
      setSteps((prev) => prev.map((s) => (s.id === step.id ? updated : s)));
      if (!silent) setEditingStepId(null);
      setStepSaveStatus("saved");
      setTimeout(() => setStepSaveStatus(""), 1500);
    } catch (err) {
      if (!silent) alert(String(err));
      setStepSaveStatus("");
    } finally {
      if (!silent) setSavingStep(false);
    }
  };

  // Debounced auto-save for step edits
  useEffect(() => {
    if (!editingStepId) return;
    if (!editBuilderStep && Object.keys(editStepParams).length === 0) return;

    if (stepAutoSaveRef.current) clearTimeout(stepAutoSaveRef.current);
    stepAutoSaveRef.current = setTimeout(() => {
      const step = steps.find((s) => s.id === editingStepId);
      if (step) saveStepEdits(step, true);
    }, 800);

    return () => {
      if (stepAutoSaveRef.current) clearTimeout(stepAutoSaveRef.current);
    };
  }, [editBuilderStep?.fields, editStepNotes, editStepParams]);

  const handleStepReorder = async () => {
    if (!dragStepRef.current || !dragOverStepRef.current) return;
    if (dragStepRef.current === dragOverStepRef.current) return;

    const items = [...steps];
    const dragIdx = items.findIndex((s) => s.id === dragStepRef.current);
    const overIdx = items.findIndex((s) => s.id === dragOverStepRef.current);
    if (dragIdx < 0 || overIdx < 0) return;
    const [removed] = items.splice(dragIdx, 1);
    items.splice(overIdx, 0, removed);

    // Renumber locally so UI updates immediately
    const renumbered = items.map((s, i) => ({ ...s, step_number: i + 1 }));
    setSteps(renumbered);
    dragStepRef.current = null;
    dragOverStepRef.current = null;

    // Persist new step_number values
    await Promise.all(
      renumbered.map((s) => api.updateStep(s.id, { step_number: s.step_number }))
    );
  };

  if (!wafer) return <p className="text-gray-500">Loading...</p>;

  const renderField = (
    label: string,
    key: string,
    displayValue: string | number | null,
    type: "text" | "number" | "select" = "text",
    options?: string[]
  ) => {
    if (!editing) {
      if (displayValue == null || displayValue === "") return null;
      return (
        <div>
          <span className="text-gray-500 text-xs">{label}</span>
          <p className="font-medium text-sm">{displayValue}</p>
        </div>
      );
    }

    const val = editForm[key] ?? "";

    if (type === "select" && options) {
      return (
        <div>
          <label className="text-gray-500 text-xs">{label}</label>
          <select
            className={inputClass + " w-full"}
            value={String(val)}
            onChange={(e) => setField(key, e.target.value)}
          >
            {options.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>
      );
    }

    return (
      <div>
        <label className="text-gray-500 text-xs">{label}</label>
        <input
          className={inputClass + " w-full"}
          type={type}
          step={type === "number" ? "any" : undefined}
          value={val === null ? "" : String(val)}
          onChange={(e) =>
            setField(
              key,
              type === "number"
                ? e.target.value
                  ? parseFloat(e.target.value)
                  : null
                : e.target.value
            )
          }
        />
      </div>
    );
  };

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          {editing ? (
            <input
              className="text-2xl font-bold font-mono border-b-2 border-blue-500 focus:outline-none bg-transparent"
              value={String(editForm.wafer_id ?? "")}
              onChange={(e) => setField("wafer_id", e.target.value)}
            />
          ) : (
            <h1 className="text-2xl font-bold font-mono">{wafer.wafer_id}</h1>
          )}
        </div>
        <div className="flex gap-2">
          {editing ? (
            <>
              <button
                onClick={saveEdits}
                disabled={saving}
                className="flex items-center gap-1 bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                <Check size={14} />
                {saving ? "Saving..." : "Save"}
              </button>
              <button
                onClick={cancelEditing}
                className="flex items-center gap-1 border border-gray-300 text-gray-600 px-3 py-1.5 rounded text-sm hover:bg-gray-50"
              >
                <X size={14} />
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                onClick={startEditing}
                className="flex items-center gap-1 bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700"
              >
                <Pencil size={14} />
                Edit
              </button>
              <button
                onClick={handleOpenBuilder}
                className="border border-gray-300 text-gray-600 px-3 py-1.5 rounded text-sm hover:bg-gray-50"
              >
                + Process
              </button>
              <div className="relative" ref={duplicateMenuRef}>
                <button
                  onClick={() => setShowDuplicateMenu(!showDuplicateMenu)}
                  className="flex items-center gap-1 border border-gray-300 text-gray-600 px-3 py-1.5 rounded text-sm hover:bg-gray-50"
                >
                  <Copy size={14} />
                </button>
                {showDuplicateMenu && (
                  <div className="absolute right-0 top-full mt-1 bg-white border rounded-lg shadow-lg py-1 z-50 w-52">
                    <button
                      onClick={() => handleDuplicate(false)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                    >
                      Properties only
                    </button>
                    <button
                      onClick={() => handleDuplicate(true)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                    >
                      Properties + Steps ({steps.length})
                    </button>
                  </div>
                )}
              </div>
              <button
                onClick={handleDeleteWafer}
                className="flex items-center gap-1 border border-red-400 text-red-500 px-3 py-1.5 rounded text-sm hover:bg-red-50"
              >
                <Trash2 size={14} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Wafer info */}
      <div className="bg-white border rounded-lg p-4 mb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {renderField("Material", "material", wafer.material, "select", MATERIALS)}
          {renderField("Diameter (mm)", "diameter_mm", wafer.diameter_mm, "number")}
          {renderField("Shape", "shape", wafer.shape, "select", SHAPES)}
          {renderField("Doping", "doping_type", wafer.doping_type, "select", DOPING_TYPES)}
          {renderField("Orientation", "crystal_orientation", wafer.crystal_orientation, "select", ORIENTATIONS)}
          {renderField("Resistivity (ohm-cm)", "resistivity_ohm_cm", wafer.resistivity_ohm_cm, "number")}
          {renderField("Doping Level (cm-3)", "doping_level", wafer.doping_level, "number")}
          {renderField("Vendor", "vendor", wafer.vendor)}
          {renderField("Lot", "lot_number", wafer.lot_number)}
          {renderField("Status", "status", wafer.status, "select", STATUSES)}
        </div>

        {/* Recycled checkbox + previous wafer selector */}
        <div className="mt-3 border-t pt-3">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={wafer.is_recycled}
              onChange={async (e) => {
                const recycled = e.target.checked;
                const updated = await api.updateWafer(wafer.id, {
                  is_recycled: recycled,
                  recycled_from_id: recycled ? wafer.recycled_from_id : null,
                });
                setWafer(updated);
              }}
              className="rounded border-gray-300"
            />
            <span className="text-gray-600 font-medium">Recycled wafer</span>
          </label>
          {wafer.is_recycled && (
            <div className="mt-2 ml-6">
              <label className="text-gray-500 text-xs">Previous wafer (optional)</label>
              <select
                className={inputClass + " w-full"}
                value={wafer.recycled_from_id ?? ""}
                onChange={async (e) => {
                  const fromId = e.target.value || null;
                  const updated = await api.updateWafer(wafer.id, {
                    recycled_from_id: fromId,
                  });
                  setWafer(updated);
                }}
              >
                <option value="">None</option>
                {allWafers
                  .filter((w) => w.id !== wafer.id)
                  .map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.wafer_id} — {w.material} {w.diameter_mm}mm
                    </option>
                  ))}
              </select>
            </div>
          )}
        </div>

        {/* Carrier assignment */}
        <div className="mt-3 border-t pt-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-gray-500 text-xs">Carrier</label>
              <select
                className={inputClass + " w-full"}
                value={wafer.carrier_id ?? ""}
                onChange={async (e) => {
                  const carrierId = e.target.value || null;
                  const updated = await api.updateWafer(wafer.id, {
                    carrier_id: carrierId,
                    slot_number: carrierId ? wafer.slot_number : null,
                  });
                  setWafer(updated);
                  api.listWafers().then(setAllWafers);
                }}
              >
                <option value="">None</option>
                {carriers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.wafer_diameter_mm}mm)
                  </option>
                ))}
              </select>
            </div>
            {wafer.carrier_id && (() => {
              const carrier = carriers.find((c) => c.id === wafer.carrier_id);
              if (!carrier) return null;
              const occupiedSlots = new Set(
                allWafers
                  .filter((w) => w.carrier_id === carrier.id && w.id !== wafer.id && w.slot_number != null)
                  .map((w) => w.slot_number!)
              );
              return (
                <div>
                  <label className="text-gray-500 text-xs">Slot</label>
                  <select
                    className={inputClass + " w-full"}
                    value={wafer.slot_number ?? ""}
                    onChange={async (e) => {
                      const slot = e.target.value ? parseInt(e.target.value) : null;
                      const updated = await api.updateWafer(wafer.id, {
                        slot_number: slot,
                      });
                      setWafer(updated);
                      api.listWafers().then(setAllWafers);
                    }}
                  >
                    <option value="">Select slot...</option>
                    {Array.from({ length: carrier.slot_count }, (_, i) => i + 1).map(
                      (s) => (
                        <option
                          key={s}
                          value={s}
                          disabled={occupiedSlots.has(s)}
                        >
                          Slot {s}{occupiedSlots.has(s) ? " (occupied)" : ""}
                        </option>
                      )
                    )}
                  </select>
                </div>
              );
            })()}
          </div>
        </div>

        <div className="mt-3 border-t pt-3">
          {editing ? (
            <>
              <label className="text-gray-500 text-xs">Notes</label>
              <textarea
                className={inputClass + " w-full mt-0.5"}
                rows={2}
                value={String(editForm.notes ?? "")}
                onChange={(e) => setField("notes", e.target.value || null)}
                placeholder="Add notes..."
              />
            </>
          ) : (
            <p className={`text-sm ${wafer.notes ? "text-gray-600" : "text-gray-400 italic"}`}>
              {wafer.notes || "No notes"}
            </p>
          )}
        </div>
      </div>

      {/* Process steps */}
      <h2 className="text-lg font-semibold mb-3">
        Process Steps ({steps.length})
      </h2>

      {steps.length === 0 ? (
        <p className="text-gray-500 text-sm">
          No steps recorded yet.{" "}
          <button
            onClick={handleOpenBuilder}
            className="text-blue-600 underline"
          >
            Open the process builder
          </button>{" "}
          to add steps.
        </p>
      ) : (
        <div className="space-y-2">
          {steps.map((step) => (
            <div
              key={step.id}
              draggable
              onDragStart={() => { dragStepRef.current = step.id; }}
              onDragOver={(e) => { e.preventDefault(); dragOverStepRef.current = step.id; }}
              onDrop={handleStepReorder}
              className="bg-white border rounded-lg overflow-hidden"
            >
              <div className="flex items-center p-3 hover:bg-gray-50">
                <button
                  className="flex items-center gap-3 flex-1 text-left"
                  onClick={() =>
                    setExpandedStep(expandedStep === step.id ? null : step.id)
                  }
                >
                  <span className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500">
                    <GripVertical size={14} />
                  </span>
                  {step.step_number != null && (
                    <span className="text-gray-400 font-mono text-sm w-8">
                      #{step.step_number}
                    </span>
                  )}
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[step.category] ?? "bg-gray-100"}`}
                  >
                    {step.category}
                  </span>
                  <span className="font-medium text-sm flex-1">{step.name}</span>
                  <span
                    className={`text-xs font-medium ${STATUS_COLORS[step.status] ?? ""}`}
                  >
                    {step.status}
                  </span>
                  <span className="text-xs text-gray-400">
                    {formatCST(step.timestamp_start)}
                  </span>
                  <span className="text-gray-400 text-xs">
                    {expandedStep === step.id ? "\u25b2" : "\u25bc"}
                  </span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (editingStepId === step.id) {
                      setEditingStepId(null);
                      setEditBuilderStep(null);
                    } else {
                      startEditingStep(step);
                    }
                  }}
                  className="ml-2 p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600"
                  title="Edit parameters"
                >
                  <MoreHorizontal size={16} />
                </button>
              </div>

              {expandedStep === step.id && (
                <div className="border-t px-4 py-3 bg-gray-50">
                  {inferBlockType(step) === "step_height" ? (
                    <>
                      {editingStepId === step.id && editBuilderStep && (
                        <div className="mb-3">
                          <StepParamForm
                            step={editBuilderStep}
                            onFieldChange={handleEditFieldChange}
                          />
                          <div className="flex items-center justify-end gap-2 mt-2">
                            {stepSaveStatus === "saving" && (
                              <span className="text-xs text-gray-400">Saving...</span>
                            )}
                            {stepSaveStatus === "saved" && (
                              <span className="text-xs text-green-500">Saved</span>
                            )}
                            <button
                              onClick={() => { setEditingStepId(null); setEditBuilderStep(null); }}
                              className="text-xs border border-gray-300 text-gray-600 px-3 py-1 rounded hover:bg-gray-100"
                            >
                              Close
                            </button>
                          </div>
                        </div>
                      )}
                      <MeasurementPanel
                        step={step}
                        diameterMm={wafer!.diameter_mm}
                        waferId={wafer!.id}
                        allSteps={steps}
                      />
                      <div className="mt-3 pt-3 border-t flex justify-end gap-3">
                        {editingStepId !== step.id && (
                          <button
                            onClick={() => startEditingStep(step)}
                            className="text-xs text-blue-600 hover:text-blue-800"
                          >
                            Edit Step
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteStep(step.id, step.name)}
                          className="text-xs text-red-500 hover:text-red-700"
                        >
                          Delete Step
                        </button>
                      </div>
                    </>
                  ) : editingStepId === step.id ? (
                    <>
                      {editBuilderStep ? (
                        <div className="mb-3">
                          <StepParamForm
                            step={editBuilderStep}
                            onFieldChange={handleEditFieldChange}
                          />
                        </div>
                      ) : (
                        step.parameter_values.length > 0 && (
                          <div className="grid grid-cols-2 gap-2 mb-3">
                            {step.parameter_values.map((pv) => (
                              <div key={pv.id}>
                                <label className="text-xs text-gray-500">
                                  {pv.param_name}{pv.unit ? ` (${pv.unit})` : ""}
                                </label>
                                <input
                                  className={inputClass + " w-full"}
                                  value={editStepParams[pv.param_name] ?? ""}
                                  onChange={(e) =>
                                    setEditStepParams((prev) => ({
                                      ...prev,
                                      [pv.param_name]: e.target.value,
                                    }))
                                  }
                                />
                              </div>
                            ))}
                          </div>
                        )
                      )}
                      <div className="mb-3">
                        <label className="text-xs text-gray-500">Notes</label>
                        <input
                          className={inputClass + " w-full"}
                          value={editStepNotes}
                          onChange={(e) => setEditStepNotes(e.target.value)}
                          placeholder="Optional notes..."
                        />
                      </div>
                      <div className="flex items-center justify-end gap-2">
                        {stepSaveStatus === "saving" && (
                          <span className="text-xs text-gray-400">Saving...</span>
                        )}
                        {stepSaveStatus === "saved" && (
                          <span className="text-xs text-green-500">Saved</span>
                        )}
                        <button
                          onClick={() => { setEditingStepId(null); setEditBuilderStep(null); }}
                          className="text-xs border border-gray-300 text-gray-600 px-3 py-1 rounded hover:bg-gray-100"
                        >
                          Close
                        </button>
                        <button
                          onClick={() => saveStepEdits(step)}
                          disabled={savingStep}
                          className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 disabled:opacity-50"
                        >
                          {savingStep ? "Saving..." : "Save"}
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      {step.notes && (
                        <p className="text-sm text-gray-600 mb-3">{step.notes}</p>
                      )}
                      {step.parameter_values.length > 0 ? (
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-gray-500">
                              <th className="pb-1 font-medium">Parameter</th>
                              <th className="pb-1 font-medium">Value</th>
                              <th className="pb-1 font-medium">Unit</th>
                            </tr>
                          </thead>
                          <tbody>
                            {step.parameter_values.map((pv) => (
                              <tr key={pv.id} className="border-t border-gray-200">
                                <td className="py-1 font-mono text-xs">
                                  {pv.param_name}
                                </td>
                                <td className="py-1">{pv.value_raw}</td>
                                <td className="py-1 text-gray-500">
                                  {pv.unit ?? ""}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <p className="text-sm text-gray-400">
                          No parameters recorded
                        </p>
                      )}
                      <div className="mt-3 pt-3 border-t flex justify-end gap-3">
                        <button
                          onClick={() => startEditingStep(step)}
                          className="text-xs text-blue-600 hover:text-blue-800"
                        >
                          Edit Step
                        </button>
                        <button
                          onClick={() => handleDeleteStep(step.id, step.name)}
                          className="text-xs text-red-500 hover:text-red-700"
                        >
                          Delete Step
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
