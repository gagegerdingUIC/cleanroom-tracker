import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Consumable, ConsumableType } from "../types";

const TYPES: ConsumableType[] = [
  "photoresist",
  "developer",
  "solvent",
  "etchant",
  "other",
];

const TYPE_COLORS: Record<string, string> = {
  photoresist: "bg-yellow-100 text-yellow-800",
  developer: "bg-blue-100 text-blue-800",
  solvent: "bg-green-100 text-green-800",
  etchant: "bg-red-100 text-red-800",
  other: "bg-gray-100 text-gray-800",
};

function expiryStatus(date: string | null): {
  label: string;
  className: string;
} {
  if (!date) return { label: "No expiry", className: "text-gray-400" };
  const exp = new Date(date);
  const now = new Date();
  const daysLeft = Math.ceil(
    (exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (daysLeft < 0)
    return { label: `Expired ${-daysLeft}d ago`, className: "text-red-600 font-medium" };
  if (daysLeft <= 30)
    return { label: `${daysLeft}d left`, className: "text-orange-600 font-medium" };
  return { label: exp.toLocaleDateString(), className: "text-gray-500" };
}

export default function ConsumableList() {
  const [consumables, setConsumables] = useState<Consumable[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    name: "",
    consumable_type: "photoresist" as ConsumableType,
    manufacturer: "",
    lot_number: "",
    expiration_date: "",
    notes: "",
  });
  const [error, setError] = useState("");

  const load = () => api.listConsumables().then(setConsumables);
  useEffect(() => {
    load();
  }, []);

  const set = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await api.createConsumable({
        name: form.name,
        consumable_type: form.consumable_type,
        manufacturer: form.manufacturer || null,
        lot_number: form.lot_number || null,
        expiration_date: form.expiration_date || null,
        notes: form.notes || null,
      });
      setForm({
        name: "",
        consumable_type: "photoresist",
        manufacturer: "",
        lot_number: "",
        expiration_date: "",
        notes: "",
      });
      setShowAdd(false);
      load();
    } catch (err) {
      setError(String(err));
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete "${name}"?`)) return;
    await api.deleteConsumable(id);
    setConsumables((prev) => prev.filter((c) => c.id !== id));
  };

  const inputClass =
    "w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1";

  // Group by type
  const grouped = TYPES.map((t) => ({
    type: t,
    items: consumables.filter((c) => c.consumable_type === t),
  })).filter((g) => g.items.length > 0);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Consumables</h1>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          {showAdd ? "Cancel" : "+ Add Consumable"}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded mb-4 text-sm">
          {error}
        </div>
      )}

      {showAdd && (
        <form
          onSubmit={handleAdd}
          className="bg-white border rounded-lg p-4 mb-6 space-y-3"
        >
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelClass}>Name *</label>
              <input
                className={inputClass}
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="e.g. AZ1518"
                required
              />
            </div>
            <div>
              <label className={labelClass}>Type *</label>
              <select
                className={inputClass}
                value={form.consumable_type}
                onChange={(e) => set("consumable_type", e.target.value)}
              >
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Manufacturer</label>
              <input
                className={inputClass}
                value={form.manufacturer}
                onChange={(e) => set("manufacturer", e.target.value)}
                placeholder="e.g. Merck"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelClass}>Lot Number</label>
              <input
                className={inputClass}
                value={form.lot_number}
                onChange={(e) => set("lot_number", e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div>
              <label className={labelClass}>Expiration Date</label>
              <input
                className={inputClass}
                type="date"
                value={form.expiration_date}
                onChange={(e) => set("expiration_date", e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>Notes</label>
              <input
                className={inputClass}
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>
          <button
            type="submit"
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm"
          >
            Save
          </button>
        </form>
      )}

      {grouped.length === 0 ? (
        <p className="text-gray-500 text-sm">
          No consumables tracked yet. Add your photoresists, developers, and
          solvents to track their expiration dates.
        </p>
      ) : (
        <div className="space-y-6">
          {grouped.map((group) => (
            <div key={group.type}>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
                {group.type}s
              </h2>
              <div className="space-y-2">
                {group.items.map((c) => {
                  const expiry = expiryStatus(c.expiration_date);
                  return (
                    <div
                      key={c.id}
                      className="bg-white border rounded-lg px-4 py-3 flex items-center gap-4"
                    >
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[c.consumable_type] ?? "bg-gray-100"}`}
                      >
                        {c.consumable_type}
                      </span>
                      <span className="font-medium flex-1">{c.name}</span>
                      {c.manufacturer && (
                        <span className="text-xs text-gray-400">
                          {c.manufacturer}
                        </span>
                      )}
                      {c.lot_number && (
                        <span className="text-xs text-gray-400">
                          Lot: {c.lot_number}
                        </span>
                      )}
                      <span className={`text-xs ${expiry.className}`}>
                        {expiry.label}
                      </span>
                      <button
                        onClick={() => handleDelete(c.id, c.name)}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Delete
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
