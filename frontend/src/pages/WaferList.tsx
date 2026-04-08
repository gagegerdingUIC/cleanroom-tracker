import { useEffect, useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { Wafer } from "../types";
import {
  apiStepToBuilderStep,
  stepToApiPayload,
} from "../components/process-builder/StepTemplates";

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  diced: "bg-blue-100 text-blue-800",
  archived: "bg-gray-100 text-gray-800",
  destroyed: "bg-red-100 text-red-800",
};

function nextWaferId(waferId: string): string {
  const match = waferId.match(/^(.*?)(\d+)$/);
  if (match) {
    const num = parseInt(match[2], 10) + 1;
    return match[1] + String(num).padStart(match[2].length, "0");
  }
  return waferId + "-001";
}

export default function WaferList() {
  const navigate = useNavigate();
  const [wafers, setWafers] = useState<Wafer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.listWafers().then((w) => {
      setWafers(w);
      setLoading(false);
    });
  }, []);

  const handleDelete = async (w: Wafer) => {
    if (!window.confirm(`Delete wafer ${w.wafer_id} and all its steps?`)) return;
    await api.deleteWafer(w.id);
    setWafers((prev) => prev.filter((x) => x.id !== w.id));
  };

  const [dupMenuWaferId, setDupMenuWaferId] = useState<string | null>(null);
  const dupMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dupMenuWaferId) return;
    const handler = (e: MouseEvent) => {
      if (dupMenuRef.current && !dupMenuRef.current.contains(e.target as Node)) {
        setDupMenuWaferId(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [dupMenuWaferId]);

  const handleDuplicate = async (w: Wafer, includeSteps: boolean) => {
    setDupMenuWaferId(null);
    const data: Record<string, unknown> = {
      wafer_id: nextWaferId(w.wafer_id),
      material: w.material,
      diameter_mm: w.diameter_mm,
      shape: w.shape,
      doping_type: w.doping_type,
      doping_level: w.doping_level,
      resistivity_ohm_cm: w.resistivity_ohm_cm,
      crystal_orientation: w.crystal_orientation,
      vendor: w.vendor,
      lot_number: w.lot_number,
      status: "active",
      notes: w.notes,
    };
    try {
      const created = await api.createWafer(data);
      if (includeSteps) {
        const steps = await api.listSteps(w.id);
        for (const step of steps) {
          const payload = stepToApiPayload(
            apiStepToBuilderStep(step) ?? {
              id: "dup",
              type: "generic" as const,
              name: step.name,
              category: step.category,
              machine_id: step.machine_id,
              fields: {},
              timestamp: step.timestamp_start,
            },
            created.id,
            step.step_number
          );
          await api.createStep(payload);
        }
      }
      navigate(`/wafers/${created.id}`);
    } catch (err) {
      alert(String(err));
    }
  };

  if (loading) return <p className="text-gray-500">Loading...</p>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Wafers</h1>
        <div className="flex gap-2">
          <Link
            to="/process/batch"
            className="border border-gray-400 text-gray-600 px-4 py-2 rounded hover:bg-gray-50"
          >
            Batch Process
          </Link>
          <Link
            to="/wafers/new"
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            + New Wafer
          </Link>
        </div>
      </div>

      {wafers.length === 0 ? (
        <p className="text-gray-500">
          No wafers yet.{" "}
          <Link to="/wafers/new" className="text-blue-600 underline">
            Create one
          </Link>
          .
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {wafers.map((w) => (
            <div
              key={w.id}
              className="border rounded-lg p-4 bg-white hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start mb-2">
                <Link
                  to={`/wafers/${w.id}`}
                  className="font-mono font-semibold text-lg hover:text-blue-600"
                >
                  {w.wafer_id}
                </Link>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[w.status] ?? "bg-gray-100"}`}
                >
                  {w.status}
                </span>
              </div>
              <Link to={`/wafers/${w.id}`} className="block text-sm text-gray-600 space-y-1 mb-3">
                <p>
                  {w.material} &middot; {w.diameter_mm} mm &middot;{" "}
                  {w.shape}
                </p>
                <p>Doping: {w.doping_type}</p>
                {w.vendor && <p>Vendor: {w.vendor}</p>}
                <p className="text-xs text-gray-400">
                  Created {new Date(w.created_at).toLocaleDateString()}
                </p>
              </Link>
              <div className="flex gap-2 border-t pt-2">
                <div className="relative" ref={dupMenuWaferId === w.id ? dupMenuRef : undefined}>
                  <button
                    onClick={() => setDupMenuWaferId(dupMenuWaferId === w.id ? null : w.id)}
                    className="text-xs text-gray-500 hover:text-blue-600"
                  >
                    Duplicate
                  </button>
                  {dupMenuWaferId === w.id && (
                    <div className="absolute left-0 bottom-full mb-1 bg-white border rounded-lg shadow-lg py-1 z-50 w-48">
                      <button
                        onClick={() => handleDuplicate(w, false)}
                        className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50"
                      >
                        Properties only
                      </button>
                      <button
                        onClick={() => handleDuplicate(w, true)}
                        className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50"
                      >
                        Properties + Steps
                      </button>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(w)}
                  className="text-xs text-gray-500 hover:text-red-600"
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
