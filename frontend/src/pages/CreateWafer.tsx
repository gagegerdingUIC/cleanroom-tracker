import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useUIStore } from "../store/uiStore";
import type { Wafer } from "../types";

export default function CreateWafer() {
  const navigate = useNavigate();
  const refreshWaferList = useUIStore((s) => s.refreshWaferList);
  const [error, setError] = useState("");
  const [allWafers, setAllWafers] = useState<Wafer[]>([]);
  const [isRecycled, setIsRecycled] = useState(false);
  const [recycledFromId, setRecycledFromId] = useState("");

  useEffect(() => {
    api.listWafers().then(setAllWafers);
  }, []);

  const [form, setForm] = useState({
    wafer_id: "",
    material: "Si",
    diameter_mm: 50.8,
    shape: "circular",
    doping_type: "undoped",
    doping_level: "",
    resistivity_ohm_cm: "",
    crystal_orientation: "(100)",
    vendor: "",
    lot_number: "",
    notes: "",
  });

  const set = (field: string, value: string | number) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const payload: Record<string, unknown> = {
        ...form,
        doping_level: form.doping_level ? parseFloat(form.doping_level) : null,
        resistivity_ohm_cm: form.resistivity_ohm_cm
          ? parseFloat(form.resistivity_ohm_cm)
          : null,
        crystal_orientation: form.crystal_orientation || null,
        vendor: form.vendor || null,
        lot_number: form.lot_number || null,
        notes: form.notes || null,
        is_recycled: isRecycled,
        recycled_from_id: isRecycled && recycledFromId ? recycledFromId : null,
      };
      const wafer = await api.createWafer(payload);
      refreshWaferList();
      navigate(`/wafers/${wafer.id}`);
    } catch (err) {
      setError(String(err));
    }
  };

  const inputClass =
    "w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1";

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-6">New Wafer</h1>

      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded mb-4 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelClass}>Wafer ID *</label>
          <input
            className={inputClass}
            value={form.wafer_id}
            onChange={(e) => set("wafer_id", e.target.value)}
            placeholder="W-2026-001"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Material *</label>
            <select
              className={inputClass}
              value={form.material}
              onChange={(e) => set("material", e.target.value)}
            >
              {["Si", "GaAs", "InP", "SiC", "Sapphire", "Glass"].map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Diameter (mm) *</label>
            <select
              className={inputClass}
              value={form.diameter_mm}
              onChange={(e) => set("diameter_mm", parseFloat(e.target.value))}
            >
              {[25.4, 50.8, 76.2, 100, 150, 200, 300].map((d) => (
                <option key={d} value={d}>
                  {d} mm ({Math.round(d / 25.4)}")
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Shape</label>
            <select
              className={inputClass}
              value={form.shape}
              onChange={(e) => set("shape", e.target.value)}
            >
              {["circular", "square", "rectangular", "custom"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Doping Type *</label>
            <select
              className={inputClass}
              value={form.doping_type}
              onChange={(e) => set("doping_type", e.target.value)}
            >
              {["p", "n", "undoped", "semi-insulating"].map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Crystal Orientation</label>
            <select
              className={inputClass}
              value={form.crystal_orientation}
              onChange={(e) => set("crystal_orientation", e.target.value)}
            >
              {["(100)", "(111)", "(110)", ""].map((o) => (
                <option key={o} value={o}>
                  {o || "—"}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Resistivity (Ω·cm)</label>
            <input
              className={inputClass}
              type="number"
              step="any"
              value={form.resistivity_ohm_cm}
              onChange={(e) => set("resistivity_ohm_cm", e.target.value)}
              placeholder="Optional"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Vendor</label>
            <input
              className={inputClass}
              value={form.vendor}
              onChange={(e) => set("vendor", e.target.value)}
              placeholder="Optional"
            />
          </div>
          <div>
            <label className={labelClass}>Lot Number</label>
            <input
              className={inputClass}
              value={form.lot_number}
              onChange={(e) => set("lot_number", e.target.value)}
              placeholder="Optional"
            />
          </div>
        </div>

        <div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isRecycled}
              onChange={(e) => {
                setIsRecycled(e.target.checked);
                if (!e.target.checked) setRecycledFromId("");
              }}
              className="rounded border-gray-300"
            />
            <span className="text-sm font-medium text-gray-700">Recycled wafer</span>
          </label>
          {isRecycled && (
            <div className="mt-2 ml-6">
              <label className={labelClass}>Previous wafer (optional)</label>
              <select
                className={inputClass}
                value={recycledFromId}
                onChange={(e) => setRecycledFromId(e.target.value)}
              >
                <option value="">None</option>
                {allWafers.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.wafer_id} — {w.material} {w.diameter_mm}mm
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

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
            Create Wafer
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
