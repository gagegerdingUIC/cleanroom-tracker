import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import type { Machine, MachineParameterDefinition } from "../types";
import { nowCST, cstToISO } from "../utils/datetime";
import DateTimeInput from "../components/DateTimeInput";
import MachineParamField from "../components/MachineParamField";

const CATEGORIES = [
  "deposition",
  "etching",
  "lithography",
  "characterization",
  "packaging",
  "miscellaneous",
] as const;

export default function CreateStep() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const waferId = searchParams.get("wafer_id") ?? "";

  const [machines, setMachines] = useState<Machine[]>([]);
  const [paramDefs, setParamDefs] = useState<MachineParameterDefinition[]>([]);
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    name: "",
    category: "deposition" as string,
    machine_id: "",
    step_number: "",
    timestamp_start: nowCST(),
    timestamp_end: "",
    status: "completed",
    notes: "",
  });

  useEffect(() => {
    api.listMachines().then(setMachines);
  }, []);

  // Filter machines by selected category
  const filteredMachines = machines.filter(
    (m) => m.category === form.category
  );

  // Fetch param definitions when machine changes
  useEffect(() => {
    if (!form.machine_id) {
      setParamDefs([]);
      setParamValues({});
      return;
    }
    api.getParamDefs(form.machine_id).then((defs) => {
      setParamDefs(defs);
      const defaults: Record<string, string> = {};
      for (const d of defs) {
        defaults[d.id] = d.default_value ?? "";
      }
      setParamValues(defaults);
    });
  }, [form.machine_id]);

  // Reset machine when category changes
  useEffect(() => {
    setForm((prev) => ({ ...prev, machine_id: "" }));
  }, [form.category]);

  const set = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const parameter_values = paramDefs
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

    const payload: Record<string, unknown> = {
      wafer_id: waferId,
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
      await api.createStep(payload);
      navigate(`/wafers/${waferId}`);
    } catch (err) {
      setError(String(err));
    }
  };

  const inputClass =
    "w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1";

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Add Process Step</h1>

      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded mb-4 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Category + Name */}
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

        {/* Machine */}
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
          {filteredMachines.length === 0 && machines.length > 0 && (
            <p className="text-xs text-gray-400 mt-1">
              No machines for "{form.category}". You can still log the step
              without a machine.
            </p>
          )}
        </div>

        {/* Timing */}
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

        {/* Status */}
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

        {/* Machine Parameters — auto-populated */}
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

        {/* Notes */}
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

        {/* Submit */}
        <div className="flex gap-3">
          <button
            type="submit"
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
          >
            Save Step
          </button>
          <button
            type="button"
            onClick={() => navigate(`/wafers/${waferId}`)}
            className="border px-6 py-2 rounded hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
