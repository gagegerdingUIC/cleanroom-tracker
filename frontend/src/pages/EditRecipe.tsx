import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import type { Machine, StepCategory } from "../types";

const CATEGORIES: StepCategory[] = [
  "deposition",
  "etching",
  "lithography",
  "characterization",
  "packaging",
  "miscellaneous",
];

interface ParamEntry {
  name: string;
  display_name: string;
  unit: string;
  default_value: string;
}

interface StepEntry {
  name: string;
  category: string;
  machine_id: string;
  notes: string;
  expected_parameters: ParamEntry[];
}

const blankStep = (): StepEntry => ({
  name: "",
  category: "",
  machine_id: "",
  notes: "",
  expected_parameters: [],
});

const blankParam = (): ParamEntry => ({
  name: "",
  display_name: "",
  unit: "",
  default_value: "",
});

export default function EditRecipe() {
  const { recipeId } = useParams<{ recipeId: string }>();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [machines, setMachines] = useState<Machine[]>([]);

  const [form, setForm] = useState({
    name: "",
    description: "",
    category: "deposition" as string,
  });

  const [steps, setSteps] = useState<StepEntry[]>([blankStep()]);

  useEffect(() => {
    api.listMachines().then(setMachines);
  }, []);

  // Load existing recipe
  useEffect(() => {
    if (!recipeId) return;
    api.getRecipe(recipeId).then((recipe) => {
      setForm({
        name: recipe.name,
        description: recipe.description ?? "",
        category: recipe.category,
      });
      if (recipe.steps.length > 0) {
        setSteps(
          recipe.steps
            .sort((a, b) => a.step_index - b.step_index)
            .map((s) => ({
              name: s.name,
              category: s.category ?? "",
              machine_id: s.machine_id ?? "",
              notes: s.notes ?? "",
              expected_parameters: (s.expected_parameters ?? []).map((p) => ({
                name: p.name,
                display_name: p.display_name,
                unit: p.unit ?? "",
                default_value: p.default_value ?? "",
              })),
            }))
        );
      }
      setLoading(false);
    });
  }, [recipeId]);

  const set = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const addStep = () => setSteps((prev) => [...prev, blankStep()]);
  const removeStep = (i: number) =>
    setSteps((prev) => prev.filter((_, idx) => idx !== i));
  const updateStep = (i: number, field: keyof StepEntry, value: string) =>
    setSteps((prev) =>
      prev.map((s, idx) => (idx === i ? { ...s, [field]: value } : s))
    );
  const moveStep = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= steps.length) return;
    setSteps((prev) => {
      const arr = [...prev];
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return arr;
    });
  };

  const addParam = (stepIdx: number) =>
    setSteps((prev) =>
      prev.map((s, i) =>
        i === stepIdx
          ? { ...s, expected_parameters: [...s.expected_parameters, blankParam()] }
          : s
      )
    );
  const removeParam = (stepIdx: number, paramIdx: number) =>
    setSteps((prev) =>
      prev.map((s, i) =>
        i === stepIdx
          ? {
              ...s,
              expected_parameters: s.expected_parameters.filter(
                (_, pi) => pi !== paramIdx
              ),
            }
          : s
      )
    );
  const updateParam = (
    stepIdx: number,
    paramIdx: number,
    field: keyof ParamEntry,
    value: string
  ) =>
    setSteps((prev) =>
      prev.map((s, i) =>
        i === stepIdx
          ? {
              ...s,
              expected_parameters: s.expected_parameters.map((p, pi) =>
                pi === paramIdx ? { ...p, [field]: value } : p
              ),
            }
          : s
      )
    );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!recipeId) return;

    const payload = {
      name: form.name,
      description: form.description || null,
      category: form.category,
      steps: steps.map((s, i) => ({
        step_index: i,
        name: s.name,
        category: s.category || null,
        machine_id: s.machine_id || null,
        notes: s.notes || null,
        expected_parameters: s.expected_parameters
          .filter((p) => p.name)
          .map((p) => ({
            name: p.name,
            display_name: p.display_name || p.name,
            unit: p.unit || null,
            default_value: p.default_value || null,
          })),
      })),
    };

    try {
      await api.updateRecipe(recipeId, payload);
      navigate("/recipes");
    } catch (err) {
      setError(String(err));
    }
  };

  const inputClass =
    "w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1";

  if (loading) return <p className="text-gray-500">Loading...</p>;

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Edit Recipe</h1>

      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded mb-4 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2">
            <label className={labelClass}>Recipe Name *</label>
            <input
              className={inputClass}
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. Standard Nb liftoff"
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
          <label className={labelClass}>Description</label>
          <textarea
            className={inputClass}
            rows={2}
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="Optional description..."
          />
        </div>

        {/* Steps builder */}
        <div>
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-semibold">
              Steps ({steps.length})
            </h2>
            <button
              type="button"
              onClick={addStep}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              + Add Step
            </button>
          </div>

          <div className="space-y-3">
            {steps.map((step, i) => (
              <div
                key={i}
                className="border rounded-lg p-4 bg-white space-y-3"
              >
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-500">
                      Step {i + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => moveStep(i, -1)}
                      disabled={i === 0}
                      className="text-xs text-gray-400 hover:text-gray-600 disabled:opacity-30"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      onClick={() => moveStep(i, 1)}
                      disabled={i === steps.length - 1}
                      className="text-xs text-gray-400 hover:text-gray-600 disabled:opacity-30"
                    >
                      ▼
                    </button>
                  </div>
                  {steps.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeStep(i)}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      Remove
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-gray-500">Name *</label>
                    <input
                      className={inputClass}
                      value={step.name}
                      onChange={(e) => updateStep(i, "name", e.target.value)}
                      placeholder="e.g. Pre-clean"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Category</label>
                    <select
                      className={inputClass}
                      value={step.category}
                      onChange={(e) =>
                        updateStep(i, "category", e.target.value)
                      }
                    >
                      <option value="">Same as recipe</option>
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Machine</label>
                    <select
                      className={inputClass}
                      value={step.machine_id}
                      onChange={(e) =>
                        updateStep(i, "machine_id", e.target.value)
                      }
                    >
                      <option value="">None</option>
                      {machines.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.abbreviation} — {m.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-gray-500">Notes</label>
                  <input
                    className={inputClass}
                    value={step.notes}
                    onChange={(e) => updateStep(i, "notes", e.target.value)}
                    placeholder="Optional instructions..."
                  />
                </div>

                {/* Expected parameters */}
                <div className="bg-gray-50 rounded p-3">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-medium text-gray-500">
                      Expected Parameters ({step.expected_parameters.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => addParam(i)}
                      className="text-xs text-blue-600 hover:text-blue-800"
                    >
                      + Add Param
                    </button>
                  </div>
                  {step.expected_parameters.map((p, pi) => (
                    <div key={pi} className="grid grid-cols-5 gap-2 mb-1">
                      <input
                        className={inputClass}
                        value={p.name}
                        onChange={(e) =>
                          updateParam(i, pi, "name", e.target.value)
                        }
                        placeholder="name"
                      />
                      <input
                        className={inputClass}
                        value={p.display_name}
                        onChange={(e) =>
                          updateParam(i, pi, "display_name", e.target.value)
                        }
                        placeholder="Display Name"
                      />
                      <input
                        className={inputClass}
                        value={p.unit}
                        onChange={(e) =>
                          updateParam(i, pi, "unit", e.target.value)
                        }
                        placeholder="unit"
                      />
                      <input
                        className={inputClass}
                        value={p.default_value}
                        onChange={(e) =>
                          updateParam(i, pi, "default_value", e.target.value)
                        }
                        placeholder="default"
                      />
                      <button
                        type="button"
                        onClick={() => removeParam(i, pi)}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
          >
            Update Recipe
          </button>
          <button
            type="button"
            onClick={() => navigate("/recipes")}
            className="border px-6 py-2 rounded hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
