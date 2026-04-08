import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import type { Machine, MachineParameterDefinition, ProcessStep, StepParameterValue } from "../types";
import { toLocalInput, cstToISO } from "../utils/datetime";
import DateTimeInput from "../components/DateTimeInput";
import MachineParamField from "../components/MachineParamField";
import { DROPDOWN_OPTIONS } from "../components/MachineParamField";

const CATEGORIES = [
  "deposition",
  "etching",
  "lithography",
  "characterization",
  "packaging",
  "miscellaneous",
] as const;

/** Known equipment/option dropdowns for orphan params */
const ORPHAN_DROPDOWNS: Record<string, string[]> = {
  ...DROPDOWN_OPTIONS,
  equipment: ["Hotplate", "Convection Oven", "Softbake", "MA6 Mask Aligner", "DYMAX"],
};

/** Params where the value looks numeric */
function looksNumeric(value: string): boolean {
  return value !== "" && !isNaN(Number(value));
}

export default function EditStep() {
  const { stepId } = useParams<{ stepId: string }>();
  const navigate = useNavigate();

  const [machines, setMachines] = useState<Machine[]>([]);
  const [paramDefs, setParamDefs] = useState<MachineParameterDefinition[]>([]);
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<ProcessStep | null>(null);

  // Orphan params: keyed by param_name, stores {value_raw, unit}
  const [orphanParams, setOrphanParams] = useState<
    { param_name: string; value_raw: string; unit: string | null }[]
  >([]);

  const [form, setForm] = useState({
    name: "",
    category: "deposition" as string,
    machine_id: "",
    step_number: "",
    timestamp_start: "",
    timestamp_end: "",
    status: "completed",
    notes: "",
  });

  useEffect(() => {
    api.listMachines().then(setMachines);
  }, []);

  // Load existing step
  useEffect(() => {
    if (!stepId) return;
    api.getStep(stepId).then((s) => {
      setStep(s);
      setForm({
        name: s.name,
        category: s.category,
        machine_id: s.machine_id ?? "",
        step_number: s.step_number?.toString() ?? "",
        timestamp_start: toLocalInput(s.timestamp_start),
        timestamp_end: s.timestamp_end ? toLocalInput(s.timestamp_end) : "",
        status: s.status,
        notes: s.notes ?? "",
      });
      // Split params into machine-backed vs orphan
      const vals: Record<string, string> = {};
      const orphans: { param_name: string; value_raw: string; unit: string | null }[] = [];
      for (const pv of s.parameter_values) {
        if (pv.param_def_id) {
          vals[pv.param_def_id] = pv.value_raw;
        } else {
          orphans.push({
            param_name: pv.param_name,
            value_raw: pv.value_raw,
            unit: pv.unit,
          });
        }
      }
      setParamValues(vals);
      setOrphanParams(orphans);
      setLoading(false);
    });
  }, [stepId]);

  const filteredMachines = machines.filter(
    (m) => m.category === form.category
  );

  // Fetch param definitions when machine changes
  useEffect(() => {
    if (!form.machine_id) {
      setParamDefs([]);
      return;
    }
    api.getParamDefs(form.machine_id).then((defs) => {
      setParamDefs(defs);
      // Only set defaults for params not already set
      setParamValues((prev) => {
        const merged = { ...prev };
        for (const d of defs) {
          if (!(d.id in merged)) {
            merged[d.id] = d.default_value ?? "";
          }
        }
        return merged;
      });
    });
  }, [form.machine_id]);

  const set = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const updateOrphan = (index: number, value: string) => {
    setOrphanParams((prev) =>
      prev.map((p, i) => (i === index ? { ...p, value_raw: value } : p))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!stepId) return;

    // Machine-backed params
    const parameter_values: Record<string, unknown>[] = paramDefs
      .filter((def) => paramValues[def.id] !== "" && paramValues[def.id] != null)
      .map((def) => {
        const raw = paramValues[def.id];
        const isNumeric = def.data_type === "float" || def.data_type === "integer";
        return {
          param_def_id: def.id,
          param_name: def.name,
          value_raw: raw,
          value_numeric: isNumeric ? parseFloat(raw) || null : null,
          unit: def.unit,
        };
      });

    // Orphan params
    for (const op of orphanParams) {
      if (op.value_raw === "") continue;
      parameter_values.push({
        param_def_id: null,
        param_name: op.param_name,
        value_raw: op.value_raw,
        value_numeric: looksNumeric(op.value_raw) ? parseFloat(op.value_raw) : null,
        unit: op.unit,
      });
    }

    const payload: Record<string, unknown> = {
      name: form.name,
      category: form.category,
      timestamp_start: cstToISO(form.timestamp_start),
      timestamp_end: form.timestamp_end
        ? cstToISO(form.timestamp_end)
        : null,
      machine_id: form.machine_id || null,
      step_number: form.step_number ? parseInt(form.step_number) : null,
      status: form.status,
      notes: form.notes || null,
      parameter_values,
    };

    try {
      await api.updateStep(stepId, payload);
      navigate(`/wafers/${step?.wafer_id}`);
    } catch (err) {
      setError(String(err));
    }
  };

  const inputClass =
    "w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1";

  /** Pretty-print a param_name like "bake_type" → "Bake Type" */
  const prettyName = (name: string) =>
    name
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());

  if (loading) return <p className="text-gray-500">Loading...</p>;

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Edit Process Step</h1>

      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded mb-4 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Category *</label>
            <select
              className={inputClass}
              value={form.category}
              onChange={(e) => set("category", e.target.value)}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Step Name *</label>
            <input
              className={inputClass}
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. Nb RF sputtering"
              required
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>Machine</label>
          <select
            className={inputClass}
            value={form.machine_id}
            onChange={(e) => set("machine_id", e.target.value)}
          >
            <option value="">— No machine —</option>
            {filteredMachines.map((m) => (
              <option key={m.id} value={m.id}>
                {m.abbreviation} — {m.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <DateTimeInput
            label="Start Time"
            value={form.timestamp_start}
            onChange={(v) => set("timestamp_start", v)}
            required
          />
          <DateTimeInput
            label="End Time"
            value={form.timestamp_end}
            onChange={(v) => set("timestamp_end", v)}
          />
          <div>
            <label className={labelClass}>Step #</label>
            <input
              className={inputClass}
              type="number"
              value={form.step_number}
              onChange={(e) => set("step_number", e.target.value)}
              placeholder="Auto"
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>Status</label>
          <select
            className={inputClass}
            value={form.status}
            onChange={(e) => set("status", e.target.value)}
          >
            {["planned", "in_progress", "completed", "failed", "skipped"].map(
              (s) => (
                <option key={s} value={s}>
                  {s.replace("_", " ")}
                </option>
              )
            )}
          </select>
        </div>

        {/* Machine-backed parameters */}
        {paramDefs.length > 0 && (
          <div className="border rounded-lg p-4 bg-gray-50">
            <h3 className="font-medium mb-3 text-sm">Machine Parameters</h3>
            <div className="space-y-3">
              {paramDefs.map((def) => (
                <div key={def.id} className="flex items-center gap-3">
                  <label className="text-sm w-48 flex-shrink-0">
                    {def.display_name}
                    {def.is_required && (
                      <span className="text-red-500 ml-1">*</span>
                    )}
                  </label>
                  <MachineParamField
                    def={def}
                    value={paramValues[def.id] ?? ""}
                    onChange={(v) =>
                      setParamValues((prev) => ({ ...prev, [def.id]: v }))
                    }
                  />
                  {def.unit && (
                    <span className="text-xs text-gray-500 w-12">
                      {def.unit}
                    </span>
                  )}
                  <span className="text-xs text-gray-400 w-16">
                    {def.param_type}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Orphan parameters (from litho blocks or other non-machine steps) */}
        {orphanParams.length > 0 && (
          <div className="border rounded-lg p-4 bg-gray-50">
            <h3 className="font-medium mb-3 text-sm">Step Parameters</h3>
            <div className="space-y-3">
              {orphanParams.map((op, idx) => {
                const dropdownOpts = ORPHAN_DROPDOWNS[op.param_name];
                return (
                  <div key={op.param_name} className="flex items-center gap-3">
                    <label className="text-sm w-48 flex-shrink-0">
                      {prettyName(op.param_name)}
                    </label>
                    {dropdownOpts ? (
                      <select
                        className="flex-1 border rounded px-2 py-1 text-sm"
                        value={op.value_raw}
                        onChange={(e) => updateOrphan(idx, e.target.value)}
                      >
                        {!dropdownOpts.includes(op.value_raw) && (
                          <option value={op.value_raw}>{op.value_raw}</option>
                        )}
                        {dropdownOpts.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        className="flex-1 border rounded px-2 py-1 text-sm"
                        type={looksNumeric(op.value_raw) ? "number" : "text"}
                        step="any"
                        value={op.value_raw}
                        onChange={(e) => updateOrphan(idx, e.target.value)}
                      />
                    )}
                    {op.unit && (
                      <span className="text-xs text-gray-500 w-12">
                        {op.unit}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div>
          <label className={labelClass}>Notes</label>
          <textarea
            className={inputClass}
            rows={3}
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            placeholder="Optional notes..."
          />
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
          >
            Update Step
          </button>
          <button
            type="button"
            onClick={() => navigate(`/wafers/${step?.wafer_id}`)}
            className="border px-6 py-2 rounded hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
