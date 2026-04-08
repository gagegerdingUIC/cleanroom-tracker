import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { Wafer, Machine, MachineParameterDefinition } from "../types";
import { nowCST, cstToISO, todayCST } from "../utils/datetime";
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

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  diced: "bg-blue-100 text-blue-800",
  archived: "bg-gray-100 text-gray-800",
  destroyed: "bg-red-100 text-red-800",
};

export default function BatchProcess() {
  const navigate = useNavigate();
  const [wafers, setWafers] = useState<Wafer[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
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
    api.listWafers().then(setWafers);
    api.listMachines().then(setMachines);
  }, []);

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

  const toggleWafer = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === wafers.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(wafers.map((w) => w.id)));
    }
  };

  const set = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (selectedIds.size === 0) {
      setError("Select at least one wafer.");
      return;
    }

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

    // Auto-generate run label
    const parts: string[] = [];
    if (form.name) parts.push(form.name.replace(/\s+/g, "-"));
    else parts.push(form.category);
    parts.push(todayCST());
    const machine = machines.find((m) => m.id === form.machine_id);
    if (machine) parts.push(machine.abbreviation);

    const payload = {
      wafer_ids: Array.from(selectedIds),
      run_label: parts.join("-"),
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
      await api.createBatchSteps(payload);
      navigate("/wafers");
    } catch (err) {
      setError(String(err));
    }
  };

  const inputClass =
    "w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1";

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Batch Process</h1>
      <p className="text-sm text-gray-500 mb-4">
        Apply the same process step to multiple wafers at once.
      </p>

      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded mb-4 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Wafer selection */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className={labelClass}>
              Select Wafers ({selectedIds.size} selected) *
            </label>
            <button
              type="button"
              onClick={selectAll}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              {selectedIds.size === wafers.length ? "Deselect All" : "Select All"}
            </button>
          </div>
          {wafers.length === 0 ? (
            <p className="text-sm text-gray-400">No wafers found.</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-64 overflow-y-auto border rounded-lg p-3 bg-white">
              {wafers.map((w) => (
                <label
                  key={w.id}
                  className={`flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-gray-50 ${
                    selectedIds.has(w.id) ? "bg-blue-50 ring-1 ring-blue-300" : ""
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(w.id)}
                    onChange={() => toggleWafer(w.id)}
                    className="rounded"
                  />
                  <div className="min-w-0">
                    <span className="font-mono text-sm font-medium block truncate">
                      {w.wafer_id}
                    </span>
                    <span className="text-xs text-gray-500">
                      {w.material} &middot;{" "}
                      <span
                        className={`px-1 py-0.5 rounded text-xs ${STATUS_COLORS[w.status] ?? ""}`}
                      >
                        {w.status}
                      </span>
                    </span>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

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

        {/* Machine Parameters */}
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
            Apply to {selectedIds.size} Wafer{selectedIds.size !== 1 ? "s" : ""}
          </button>
          <button
            type="button"
            onClick={() => navigate("/wafers")}
            className="border px-6 py-2 rounded hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
