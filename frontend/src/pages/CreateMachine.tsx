import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";

const CATEGORIES = [
  "deposition",
  "etching",
  "lithography",
  "characterization",
  "packaging",
  "miscellaneous",
] as const;

const PARAM_TYPES = ["input", "output", "measured"] as const;
const DATA_TYPES = ["float", "integer", "string", "boolean"] as const;

interface ParamDef {
  name: string;
  display_name: string;
  param_type: string;
  data_type: string;
  unit: string;
  is_required: boolean;
  default_value: string;
}

const blankParam = (): ParamDef => ({
  name: "",
  display_name: "",
  param_type: "input",
  data_type: "float",
  unit: "",
  is_required: false,
  default_value: "",
});

export default function CreateMachine() {
  const navigate = useNavigate();
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    name: "",
    abbreviation: "",
    category: "deposition" as string,
    notes: "",
  });

  const [params, setParams] = useState<ParamDef[]>([]);

  const set = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const addParam = () => setParams((prev) => [...prev, blankParam()]);
  const removeParam = (i: number) =>
    setParams((prev) => prev.filter((_, idx) => idx !== i));
  const updateParam = (i: number, field: keyof ParamDef, value: string | boolean) =>
    setParams((prev) =>
      prev.map((p, idx) => (idx === i ? { ...p, [field]: value } : p))
    );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const payload = {
      name: form.name,
      abbreviation: form.abbreviation,
      category: form.category,
      notes: form.notes || null,
      parameter_definitions: params.map((p, i) => ({
        name: p.name,
        display_name: p.display_name || p.name,
        param_type: p.param_type,
        data_type: p.data_type,
        unit: p.unit || null,
        is_required: p.is_required,
        default_value: p.default_value || null,
        min_value: null,
        max_value: null,
        sort_order: i,
      })),
    };

    try {
      await api.createMachine(payload);
      navigate(-1);
    } catch (err) {
      setError(String(err));
    }
  };

  const inputClass =
    "w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1";

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Add Machine</h1>

      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded mb-4 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>Name *</label>
            <input
              className={inputClass}
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. Trion Phantom III"
              required
            />
          </div>
          <div>
            <label className={labelClass}>Abbreviation *</label>
            <input
              className={inputClass}
              value={form.abbreviation}
              onChange={(e) => set("abbreviation", e.target.value)}
              placeholder="e.g. ICP-RIE"
              required
            />
          </div>
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
        </div>

        <div>
          <label className={labelClass}>Notes</label>
          <textarea
            className={inputClass}
            rows={2}
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            placeholder="Optional notes about this machine..."
          />
        </div>

        {/* Parameter Definitions */}
        <div className="border rounded-lg p-4 bg-gray-50">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-medium text-sm">
              Parameter Definitions ({params.length})
            </h3>
            <button
              type="button"
              onClick={addParam}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              + Add Parameter
            </button>
          </div>

          {params.length === 0 ? (
            <p className="text-sm text-gray-400">
              No parameters defined yet. Add parameters that users will fill in
              when logging steps on this machine.
            </p>
          ) : (
            <div className="space-y-3">
              {params.map((p, i) => (
                <div
                  key={i}
                  className="bg-white border rounded p-3 space-y-2"
                >
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-medium text-gray-500">
                      Parameter {i + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeParam(i)}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-xs text-gray-500">Name (snake_case) *</label>
                      <input
                        className={inputClass}
                        value={p.name}
                        onChange={(e) => updateParam(i, "name", e.target.value)}
                        placeholder="rf_power_w"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Display Name</label>
                      <input
                        className={inputClass}
                        value={p.display_name}
                        onChange={(e) =>
                          updateParam(i, "display_name", e.target.value)
                        }
                        placeholder="RF Power (W)"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Unit</label>
                      <input
                        className={inputClass}
                        value={p.unit}
                        onChange={(e) => updateParam(i, "unit", e.target.value)}
                        placeholder="W, sccm, etc."
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    <div>
                      <label className="text-xs text-gray-500">Type</label>
                      <select
                        className={inputClass}
                        value={p.param_type}
                        onChange={(e) =>
                          updateParam(i, "param_type", e.target.value)
                        }
                      >
                        {PARAM_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Data Type</label>
                      <select
                        className={inputClass}
                        value={p.data_type}
                        onChange={(e) =>
                          updateParam(i, "data_type", e.target.value)
                        }
                      >
                        {DATA_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Default Value</label>
                      <input
                        className={inputClass}
                        value={p.default_value}
                        onChange={(e) =>
                          updateParam(i, "default_value", e.target.value)
                        }
                        placeholder="Optional"
                      />
                    </div>
                    <div className="flex items-end pb-2">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={p.is_required}
                          onChange={(e) =>
                            updateParam(i, "is_required", e.target.checked)
                          }
                        />
                        Required
                      </label>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
          >
            Save Machine
          </button>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="border px-6 py-2 rounded hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
