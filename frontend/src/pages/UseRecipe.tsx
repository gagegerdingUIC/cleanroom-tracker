import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import type { Recipe } from "../types";

const CATEGORY_COLORS: Record<string, string> = {
  deposition: "bg-purple-100 text-purple-800",
  etching: "bg-orange-100 text-orange-800",
  lithography: "bg-yellow-100 text-yellow-800",
  characterization: "bg-cyan-100 text-cyan-800",
  packaging: "bg-pink-100 text-pink-800",
  miscellaneous: "bg-gray-100 text-gray-800",
};

export default function UseRecipe() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const waferId = searchParams.get("wafer_id") ?? "";

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [selected, setSelected] = useState<Recipe | null>(null);
  const [paramValues, setParamValues] = useState<Record<string, Record<string, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.listRecipes().then(setRecipes);
  }, []);

  const selectRecipe = (recipe: Recipe) => {
    setSelected(recipe);
    // Pre-populate defaults
    const defaults: Record<string, Record<string, string>> = {};
    for (const step of recipe.steps) {
      defaults[step.id] = {};
      for (const p of step.expected_parameters) {
        defaults[step.id][p.name] = p.default_value ?? "";
      }
    }
    setParamValues(defaults);
  };

  const updateValue = (stepId: string, paramName: string, value: string) => {
    setParamValues((prev) => ({
      ...prev,
      [stepId]: { ...prev[stepId], [paramName]: value },
    }));
  };

  const handleApply = async () => {
    if (!selected || !waferId) return;
    setSubmitting(true);
    setError("");

    try {
      const now = new Date().toISOString();

      for (const step of selected.steps) {
        const stepParams = paramValues[step.id] ?? {};
        const parameter_values = step.expected_parameters
          .filter((p) => stepParams[p.name])
          .map((p) => ({
            param_name: p.name,
            value_raw: stepParams[p.name],
            value_numeric: isNaN(parseFloat(stepParams[p.name]))
              ? null
              : parseFloat(stepParams[p.name]),
            unit: p.unit,
          }));

        await api.createStep({
          wafer_id: waferId,
          name: step.name,
          category: step.category ?? selected.category,
          timestamp_start: now,
          machine_id: step.machine_id ?? null,
          step_number: step.step_index + 1,
          status: "completed",
          notes: step.notes ?? null,
          parameter_values,
        });
      }

      navigate(`/wafers/${waferId}`);
    } catch (err) {
      setError(String(err));
      setSubmitting(false);
    }
  };

  const inputClass =
    "w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  if (!selected) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">Use Recipe</h1>
        <p className="text-sm text-gray-500 mb-4">
          Select a recipe to apply to this wafer. All steps will be created
          with their default parameters.
        </p>

        {recipes.length === 0 ? (
          <p className="text-gray-500 text-sm">
            No recipes available.{" "}
            <a href="/recipes/new" className="text-blue-600 underline">
              Create one first
            </a>
            .
          </p>
        ) : (
          <div className="space-y-2">
            {recipes.map((recipe) => (
              <button
                key={recipe.id}
                onClick={() => selectRecipe(recipe)}
                className="w-full text-left bg-white border rounded-lg p-4 hover:bg-gray-50 flex items-center gap-3"
              >
                <span className="font-medium flex-1">{recipe.name}</span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[recipe.category] ?? "bg-gray-100"}`}
                >
                  {recipe.category}
                </span>
                <span className="text-xs text-gray-400">
                  {recipe.steps.length} steps
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <button
            onClick={() => setSelected(null)}
            className="text-sm text-blue-600 hover:underline"
          >
            &larr; Back to recipes
          </button>
          <h1 className="text-2xl font-bold mt-1">{selected.name}</h1>
          {selected.description && (
            <p className="text-sm text-gray-500">{selected.description}</p>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded mb-4 text-sm">
          {error}
        </div>
      )}

      <p className="text-sm text-gray-500 mb-4">
        Review and fill in parameter values, then apply all steps to the wafer.
      </p>

      <div className="space-y-3 mb-6">
        {selected.steps.map((step) => (
          <div key={step.id} className="bg-white border rounded-lg p-4">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-gray-400 font-mono text-sm w-8">
                #{step.step_index + 1}
              </span>
              {(step.category ?? selected.category) && (
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[step.category ?? selected.category] ?? "bg-gray-100"}`}
                >
                  {step.category ?? selected.category}
                </span>
              )}
              <span className="font-medium">{step.name}</span>
            </div>
            {step.notes && (
              <p className="text-xs text-gray-500 mb-2 ml-11">{step.notes}</p>
            )}
            {step.expected_parameters.length > 0 && (
              <div className="ml-11 space-y-2">
                {step.expected_parameters.map((p) => (
                  <div key={p.name} className="flex items-center gap-3">
                    <label className="text-sm w-40 flex-shrink-0">
                      {p.display_name || p.name}
                    </label>
                    <input
                      className={inputClass + " flex-1"}
                      value={paramValues[step.id]?.[p.name] ?? ""}
                      onChange={(e) =>
                        updateValue(step.id, p.name, e.target.value)
                      }
                    />
                    {p.unit && (
                      <span className="text-xs text-gray-500 w-12">
                        {p.unit}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleApply}
          disabled={submitting}
          className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting
            ? "Applying..."
            : `Apply ${selected.steps.length} Steps`}
        </button>
        <button
          onClick={() => navigate(`/wafers/${waferId}`)}
          className="border px-6 py-2 rounded hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
