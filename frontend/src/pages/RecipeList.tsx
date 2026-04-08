import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
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

export default function RecipeList() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);

  useEffect(() => {
    api.listRecipes().then(setRecipes);
  }, []);

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete recipe "${name}"?`)) return;
    await api.deleteRecipe(id);
    setRecipes((prev) => prev.filter((r) => r.id !== id));
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Recipes</h1>
        <Link
          to="/recipes/new"
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          + New Recipe
        </Link>
      </div>

      {recipes.length === 0 ? (
        <p className="text-gray-500 text-sm">
          No recipes yet.{" "}
          <Link to="/recipes/new" className="text-blue-600 underline">
            Create your first recipe
          </Link>
          .
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {recipes.map((recipe) => (
            <div
              key={recipe.id}
              className="bg-white border rounded-lg p-4 hover:shadow-sm transition-shadow"
            >
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-semibold text-lg">{recipe.name}</h3>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[recipe.category] ?? "bg-gray-100"}`}
                >
                  {recipe.category}
                </span>
              </div>
              {recipe.description && (
                <p className="text-sm text-gray-600 mb-2">
                  {recipe.description}
                </p>
              )}
              <p className="text-xs text-gray-400 mb-3">
                {recipe.steps.length} step{recipe.steps.length !== 1 ? "s" : ""}
              </p>
              {recipe.steps.length > 0 && (
                <div className="text-xs text-gray-500 space-y-0.5 mb-3">
                  {recipe.steps.map((s) => (
                    <div key={s.id} className="flex gap-2">
                      <span className="text-gray-400 w-4">{s.step_index + 1}.</span>
                      <span>{s.name}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex justify-end gap-3">
                <Link
                  to={`/recipes/${recipe.id}/edit`}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  Edit
                </Link>
                <button
                  onClick={() => handleDelete(recipe.id, recipe.name)}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
