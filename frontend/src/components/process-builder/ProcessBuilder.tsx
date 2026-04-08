import { useState, useRef, useCallback, useEffect } from "react";
import { X, Save, Play, Plus, Undo2 } from "lucide-react";
import { api } from "../../api/client";
import { useUIStore } from "../../store/uiStore";
import { usePresets } from "../../hooks/usePresets";
import type { Recipe, Wafer } from "../../types";
import {
  BLOCK_DEFS,
  makeBlockFields,
  stepToApiPayload,
  type BuilderStepData,
  type LithoBlockType,
} from "./StepTemplates";
import BuilderStep, { getSavedDefaults } from "./BuilderStep";

let idCounter = 0;
function nextId() {
  return `bs-${++idCounter}`;
}

/** Format current local time as YYYY-MM-DDTHH:MM for datetime-local inputs */
function nowLocal(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function ProcessBuilder() {
  const selectedIds = useUIStore((s) => s.selectedWaferIds);
  const currentWaferId = useUIStore((s) => s.currentWaferId);
  const setRightPanelOpen = useUIStore((s) => s.setRightPanelOpen);

  const refreshWaferList = useUIStore((s) => s.refreshWaferList);

  const [steps, setSteps] = useState<BuilderStepData[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [wafers, setWafers] = useState<Wafer[]>([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [saveRecipeName, setSaveRecipeName] = useState("");
  const [showSave, setShowSave] = useState(false);
  const { getDefaults } = usePresets("photoresist");
  const { getDefaults: getSputterDefaults } = usePresets("sputter_target");

  // Effective target: selected wafers, or fall back to currently viewed wafer
  const effectiveTargetIds = selectedIds.size > 0
    ? selectedIds
    : currentWaferId
      ? new Set([currentWaferId])
      : new Set<string>();

  // Undo history
  const historyRef = useRef<BuilderStepData[][]>([]);
  const pushHistory = (snapshot: BuilderStepData[]) => {
    historyRef.current = [...historyRef.current.slice(-30), snapshot];
  };
  const undo = () => {
    if (historyRef.current.length === 0) return;
    const prev = historyRef.current.pop()!;
    setSteps(prev);
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    api.listRecipes().then(setRecipes);
    api.listWafers().then(setWafers);
  }, []);

  const effectiveWafers = wafers.filter((w) => effectiveTargetIds.has(w.id));

  // Auto-update already-applied steps when fields change (debounced)
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const appliedSteps = steps.filter(
      (s) => s.appliedStepIds && Object.keys(s.appliedStepIds).length > 0
    );
    if (appliedSteps.length === 0) return;

    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(async () => {
      try {
        for (const step of appliedSteps) {
          for (const [waferId, stepId] of Object.entries(step.appliedStepIds!)) {
            const payload = stepToApiPayload(step, waferId, null);
            await api.updateStep(stepId, {
              name: payload.name,
              parameter_values: payload.parameter_values,
            });
          }
        }
        refreshWaferList();
      } catch {
        // Silently fail on auto-save; user can still manually apply
      }
    }, 1000);

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [steps]);

  // Drag-and-drop
  const dragItem = useRef<string | null>(null);
  const dragOverItem = useRef<string | null>(null);

  const handleDragStart = useCallback((id: string) => {
    dragItem.current = id;
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, id: string) => {
    e.preventDefault();
    dragOverItem.current = id;
  }, []);

  const handleDrop = useCallback(() => {
    if (!dragItem.current || !dragOverItem.current) return;
    if (dragItem.current === dragOverItem.current) return;

    setSteps((prev) => {
      pushHistory([...prev]);
      const items = [...prev];
      const dragIdx = items.findIndex((s) => s.id === dragItem.current);
      const overIdx = items.findIndex((s) => s.id === dragOverItem.current);
      if (dragIdx < 0 || overIdx < 0) return prev;
      const [removed] = items.splice(dragIdx, 1);
      items.splice(overIdx, 0, removed);
      return items;
    });

    dragItem.current = null;
    dragOverItem.current = null;
  }, []);

  const addLithoBlock = (type: LithoBlockType) => {
    pushHistory([...steps]);
    const saved = getSavedDefaults(type);
    const fields = saved ? { ...makeBlockFields(type), ...saved } : makeBlockFields(type);
    const newStep: BuilderStepData = {
      id: nextId(),
      type,
      name: BLOCK_DEFS.find((d) => d.type === type)?.label || type,
      category: type === "clean" ? "miscellaneous" : type === "sputter" ? "deposition" : type === "step_height" ? "characterization" : type === "trion_etch" ? "etching" : "lithography" as const,
      machine_id: null,
      fields,
      timestamp: nowLocal(),
    };
    setSteps((prev) => [...prev, newStep]);
  };

  const removeStep = (id: string) => {
    pushHistory([...steps]);
    setSteps((prev) => prev.filter((s) => s.id !== id));
  };

  const applyPresetDefaults = (resistName: string, currentStepId: string) => {
    const defaults = getDefaults(resistName);
    if (!defaults) return;

    // Map block types to preset keys
    const typeToPresetKey: Record<string, string[]> = {
      bake: ["softbake", "post_exposure_bake"],
      develop: ["develop"],
      expose: ["exposure"],
      series_expose: ["exposure"],
      flood_expose: ["flood_expose"],
    };

    // Also apply spin_coat defaults to the current step
    const spinDefaults = defaults["spin_coat"];
    if (spinDefaults) {
      setSteps((prev) =>
        prev.map((s) => {
          if (s.id === currentStepId) {
            const updated = { ...s.fields };
            if (spinDefaults.spin_speed_rpm) updated.spinRpm = spinDefaults.spin_speed_rpm;
            if (spinDefaults.spin_time_s) updated.spinTime = spinDefaults.spin_time_s;
            return { ...s, fields: updated };
          }
          return s;
        })
      );
    }

    // Apply defaults to subsequent matching steps
    setSteps((prev) => {
      const currentIdx = prev.findIndex((s) => s.id === currentStepId);
      return prev.map((s, idx) => {
        if (idx <= currentIdx) return s;
        const presetKeys = typeToPresetKey[s.type] || [];
        for (const key of presetKeys) {
          const defs = defaults[key];
          if (!defs) continue;
          const updated = { ...s.fields };
          // Map preset param names to block field names
          if (s.type === "bake") {
            if (defs.temp_c) updated.temp = defs.temp_c;
            if (defs.duration_s) updated.time = defs.duration_s;
            if (defs.bake_type) updated.bakeType = defs.bake_type;
            if (defs.equipment) updated.equipment = defs.equipment;
          } else if (s.type === "develop") {
            if (defs.developer) updated.developer = defs.developer;
            if (defs.duration_s) updated.time = defs.duration_s;
            if (defs.chemical) updated.developer = defs.chemical;
          } else if (s.type === "expose") {
            if (defs.dose_mj_cm2) updated.dose = defs.dose_mj_cm2;
            if (defs.defoc_um) updated.defoc = defs.defoc_um;
          } else if (s.type === "series_expose") {
            // For series, use dose as center/start hint
            if (defs.dose_mj_cm2) updated.doseStart = defs.dose_mj_cm2;
          }
          return { ...s, fields: updated };
        }
        return s;
      });
    });
  };

  const applySputterDefaults = (targetName: string, stepId: string) => {
    const defaults = getSputterDefaults(targetName);
    if (!defaults) return;
    const defs = defaults["sputter"];
    if (!defs) return;

    setSteps((prev) =>
      prev.map((s) => {
        if (s.id !== stepId) return s;
        const updated = { ...s.fields };
        // Apply each preset field, but keep target as the user selected it
        for (const [key, val] of Object.entries(defs)) {
          if (key !== "target") updated[key] = val;
        }
        return { ...s, fields: updated };
      })
    );
  };

  const updateField = (stepId: string, field: string, value: string) => {
    setSteps((prev) =>
      prev.map((s) =>
        s.id === stepId ? { ...s, fields: { ...s.fields, [field]: value } } : s
      )
    );

    // If changing resist in a spin_coat step, apply preset defaults
    const step = steps.find((s) => s.id === stepId);
    if (step?.type === "spin_coat" && field === "resist") {
      applyPresetDefaults(value, stepId);
    }

    // If changing target in a sputter step, apply sputter target defaults
    if (step?.type === "sputter" && field === "target") {
      applySputterDefaults(value, stepId);
    }
  };

  const bulkUpdateFields = (stepId: string, fields: Record<string, string>) => {
    setSteps((prev) =>
      prev.map((s) =>
        s.id === stepId ? { ...s, fields: { ...s.fields, ...fields } } : s
      )
    );
  };

  const updateTimestamp = (stepId: string, value: string) => {
    setSteps((prev) =>
      prev.map((s) => (s.id === stepId ? { ...s, timestamp: value } : s))
    );
  };

  const loadRecipe = (recipeId: string) => {
    const recipe = recipes.find((r) => r.id === recipeId);
    if (!recipe) return;

    pushHistory([...steps]);
    const newSteps: BuilderStepData[] = recipe.steps.map((rs) => {
      const fields: Record<string, string> = {};
      for (const p of rs.expected_parameters || []) {
        fields[p.name] = p.default_value || "";
      }
      return {
        id: nextId(),
        type: "generic",
        name: rs.name,
        category: (rs.category as BuilderStepData["category"]) || "miscellaneous",
        machine_id: rs.machine_id,
        fields,
        timestamp: "",
      };
    });
    setSteps(newSteps);
  };

  const handleApply = async () => {
    if (effectiveTargetIds.size === 0) {
      setError("Select a wafer or view one to target it.");
      return;
    }
    if (steps.length === 0) {
      setError("Add at least one step.");
      return;
    }

    setError("");
    setSubmitting(true);

    try {
      const updatedSteps = [...steps];

      for (const waferId of effectiveTargetIds) {
        const existing = await api.listSteps(waferId);
        const maxNum = existing.reduce(
          (max, s) => Math.max(max, s.step_number ?? 0),
          0
        );
        let nextStepNum = maxNum + 1;

        for (let i = 0; i < updatedSteps.length; i++) {
          const step = updatedSteps[i];
          const existingApiId = step.appliedStepIds?.[waferId];

          if (existingApiId) {
            // Update existing step via PATCH
            const payload = stepToApiPayload(step, waferId, null);
            await api.updateStep(existingApiId, {
              name: payload.name,
              parameter_values: payload.parameter_values,
            });
          } else {
            // Create new step
            const payload = stepToApiPayload(step, waferId, nextStepNum++);
            const created = await api.createStep(payload);
            updatedSteps[i] = {
              ...step,
              appliedStepIds: {
                ...step.appliedStepIds,
                [waferId]: created.id,
              },
            };
          }
        }
      }

      setSteps(updatedSteps);
      refreshWaferList();
    } catch (err) {
      setError(String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveRecipe = async () => {
    if (!saveRecipeName.trim()) return;
    setError("");

    try {
      await api.createRecipe({
        name: saveRecipeName.trim(),
        category: steps[0]?.category || "lithography",
        is_template: true,
        steps: steps.map((s, i) => ({
          step_index: i,
          name: BLOCK_DEFS.find((d) => d.type === s.type)?.label || s.name,
          category: s.category,
          expected_parameters: Object.entries(s.fields)
            .filter(([, v]) => v)
            .map(([k, v]) => ({
              name: k,
              display_name: k.replace(/([A-Z])/g, " $1").trim(),
              default_value: v,
            })),
        })),
      });
      setShowSave(false);
      setSaveRecipeName("");
      api.listRecipes().then(setRecipes);
    } catch (err) {
      setError(String(err));
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-gray-100 flex items-center justify-between shrink-0">
        <h2 className="text-sm font-semibold text-gray-900">Process Builder</h2>
        <button
          onClick={() => setRightPanelOpen(false)}
          className="text-gray-400 hover:text-gray-600"
        >
          <X size={16} />
        </button>
      </div>

      {/* Target wafers */}
      <div className="px-3 py-2 border-b border-gray-100 shrink-0">
        <div className="text-xs text-gray-500 mb-1">
          Target: {effectiveWafers.length > 0
            ? effectiveWafers.map((w) => w.wafer_id).join(", ")
            : "No wafers selected"}
          {selectedIds.size === 0 && currentWaferId && effectiveWafers.length > 0 && (
            <span className="text-gray-400 ml-1">(current)</span>
          )}
        </div>

        {/* Load recipe */}
        {recipes.length > 0 && (
          <select
            className="w-full border rounded px-2 py-1 text-xs text-gray-600"
            value=""
            onChange={(e) => {
              if (e.target.value) loadRecipe(e.target.value);
            }}
          >
            <option value="">Load from recipe...</option>
            {recipes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {error && (
        <div className="mx-3 mt-2 bg-red-50 text-red-700 p-2 rounded text-xs">
          {error}
        </div>
      )}

      {/* Block palette */}
      <div className="px-3 py-2 border-b border-gray-100 shrink-0">
        <div className="text-xs text-gray-500 mb-1">Add steps:</div>
        <div className="flex flex-wrap gap-1">
          {BLOCK_DEFS.map((def) => (
            <button
              key={def.type}
              type="button"
              onClick={() => addLithoBlock(def.type)}
              className="px-2 py-1 rounded border border-gray-200 bg-white text-xs font-medium text-gray-600 hover:border-blue-400 hover:bg-blue-50"
            >
              <Plus size={10} className="inline mr-0.5" />
              {def.label}
            </button>
          ))}
        </div>
      </div>

      {/* Step list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {steps.length === 0 ? (
          <div className="border-2 border-dashed border-gray-200 rounded p-6 text-center text-gray-400 text-xs">
            Click a step type above to add it to the current wafer.
          </div>
        ) : (
          steps.map((step, idx) => (
            <BuilderStep
              key={step.id}
              step={step}
              index={idx}
              onRemove={() => removeStep(step.id)}
              onFieldChange={(field, value) =>
                updateField(step.id, field, value)
              }
              onTimestampChange={(value) => updateTimestamp(step.id, value)}
              onDragStart={() => handleDragStart(step.id)}
              onDragOver={(e) => handleDragOver(e, step.id)}
              onDrop={handleDrop}
              onBulkFieldChange={(fields) => bulkUpdateFields(step.id, fields)}
            />
          ))
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-gray-100 space-y-2 shrink-0">
        {showSave ? (
          <div className="flex gap-1">
            <input
              autoFocus
              value={saveRecipeName}
              onChange={(e) => setSaveRecipeName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveRecipe();
                if (e.key === "Escape") setShowSave(false);
              }}
              placeholder="Recipe name..."
              className="flex-1 border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              onClick={handleSaveRecipe}
              className="px-2 py-1 bg-gray-600 text-white rounded text-xs hover:bg-gray-700"
            >
              Save
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={undo}
              disabled={historyRef.current.length === 0}
              className="flex items-center gap-1 px-2 py-1.5 border border-gray-300 rounded text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-40"
              title="Undo (Ctrl+Z)"
            >
              <Undo2 size={12} />
            </button>
            <button
              onClick={() => setShowSave(true)}
              disabled={steps.length === 0}
              className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 rounded text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-40"
            >
              <Save size={12} />
              Save Recipe
            </button>
            <button
              onClick={handleApply}
              disabled={submitting || steps.length === 0 || effectiveTargetIds.size === 0}
              className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 disabled:opacity-40"
            >
              <Play size={12} />
              {submitting
                ? "Applying..."
                : steps.length > 0 && steps.every((s) => s.appliedStepIds && [...effectiveTargetIds].every((wid) => s.appliedStepIds?.[wid]))
                  ? `Update ${effectiveTargetIds.size} Wafer${effectiveTargetIds.size !== 1 ? "s" : ""}`
                  : `Apply to ${effectiveTargetIds.size} Wafer${effectiveTargetIds.size !== 1 ? "s" : ""}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
