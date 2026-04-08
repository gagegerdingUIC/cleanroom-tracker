import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Trash2, X } from "lucide-react";
import { api } from "../api/client";
import type { Carrier, Wafer } from "../types";

const inputClass =
  "border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500";

export default function CarrierList() {
  const navigate = useNavigate();
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [wafers, setWafers] = useState<Wafer[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formSlots, setFormSlots] = useState("25");
  const [formDiameter, setFormDiameter] = useState("50.8");
  const [creating, setCreating] = useState(false);
  const dragWaferRef = useRef<string | null>(null);
  const dragSourceRef = useRef<{ carrierId: string | null; slot: number | null }>({
    carrierId: null,
    slot: null,
  });

  const reload = () => {
    api.listCarriers().then(setCarriers);
    api.listWafers().then(setWafers);
  };

  useEffect(() => {
    reload();
  }, []);

  const handleCreate = async () => {
    if (!formName.trim()) return;
    setCreating(true);
    try {
      await api.createCarrier({
        name: formName.trim(),
        slot_count: parseInt(formSlots) || 25,
        wafer_diameter_mm: parseFloat(formDiameter) || 50.8,
      });
      setFormName("");
      setFormSlots("25");
      setFormDiameter("50.8");
      setShowForm(false);
      reload();
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (carrier: Carrier) => {
    if (!window.confirm(`Delete carrier "${carrier.name}"?`)) return;
    await api.deleteCarrier(carrier.id);
    reload();
  };

  const assignWafer = async (
    waferId: string,
    carrierId: string | null,
    slotNumber: number | null
  ) => {
    await api.updateWafer(waferId, {
      carrier_id: carrierId,
      slot_number: slotNumber,
    });
    reload();
  };

  const handleDragStart = (
    waferId: string,
    carrierId: string | null,
    slot: number | null
  ) => {
    dragWaferRef.current = waferId;
    dragSourceRef.current = { carrierId, slot };
  };

  const handleDropOnSlot = (carrierId: string, slot: number) => {
    const waferId = dragWaferRef.current;
    if (!waferId) return;
    // Check if slot is occupied by a different wafer
    const occupant = wafers.find(
      (w) => w.carrier_id === carrierId && w.slot_number === slot
    );
    if (occupant && occupant.id !== waferId) return; // slot taken
    assignWafer(waferId, carrierId, slot);
    dragWaferRef.current = null;
  };

  const handleDropOnUnassigned = () => {
    const waferId = dragWaferRef.current;
    if (!waferId) return;
    assignWafer(waferId, null, null);
    dragWaferRef.current = null;
  };

  // Build wafer lookup by carrier+slot
  const waferBySlot = new Map<string, Wafer>();
  for (const w of wafers) {
    if (w.carrier_id && w.slot_number != null) {
      waferBySlot.set(`${w.carrier_id}:${w.slot_number}`, w);
    }
  }

  const unassigned = wafers.filter((w) => !w.carrier_id);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Carriers</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1 bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700"
        >
          <Plus size={14} />
          New Carrier
        </button>
      </div>

      {showForm && (
        <div className="bg-white border rounded-lg p-4 mb-4">
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div>
              <label className="text-xs text-gray-500">Name</label>
              <input
                className={inputClass + " w-full"}
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. 2-inch Carrier A"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">Slots</label>
              <input
                className={inputClass + " w-full"}
                type="number"
                value={formSlots}
                onChange={(e) => setFormSlots(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">Wafer Diameter (mm)</label>
              <input
                className={inputClass + " w-full"}
                type="number"
                step="any"
                value={formDiameter}
                onChange={(e) => setFormDiameter(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={creating || !formName.trim()}
              className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {creating ? "Creating..." : "Create"}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="border border-gray-300 text-gray-600 px-3 py-1 rounded text-sm hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {carriers.length === 0 && !showForm && (
        <p className="text-gray-500 text-sm">
          No carriers yet. Click "+ New Carrier" to add one.
        </p>
      )}

      <div className="space-y-4">
        {carriers.map((carrier) => (
          <div key={carrier.id} className="bg-white border rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="font-semibold">{carrier.name}</h2>
                <span className="text-xs text-gray-500">
                  {carrier.slot_count} slots &middot; {carrier.wafer_diameter_mm}mm
                </span>
              </div>
              <button
                onClick={() => handleDelete(carrier)}
                className="text-gray-400 hover:text-red-500 p-1"
                title="Delete carrier"
              >
                <Trash2 size={16} />
              </button>
            </div>
            <div className="grid gap-1.5" style={{
              gridTemplateColumns: `repeat(${Math.min(carrier.slot_count, 13)}, minmax(0, 1fr))`,
            }}>
              {Array.from({ length: carrier.slot_count }, (_, i) => {
                const slot = i + 1;
                const w = waferBySlot.get(`${carrier.id}:${slot}`);
                return (
                  <div
                    key={slot}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.currentTarget.classList.add("ring-2", "ring-blue-400");
                    }}
                    onDragLeave={(e) => {
                      e.currentTarget.classList.remove("ring-2", "ring-blue-400");
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.currentTarget.classList.remove("ring-2", "ring-blue-400");
                      handleDropOnSlot(carrier.id, slot);
                    }}
                    className={`relative rounded text-center text-[10px] leading-tight py-1.5 px-0.5 min-h-[44px] flex flex-col items-center justify-center transition-colors ${
                      w
                        ? "bg-blue-50 border border-blue-200 cursor-grab"
                        : "bg-gray-50 border border-dashed border-gray-300"
                    }`}
                    draggable={!!w}
                    onDragStart={() => w && handleDragStart(w.id, carrier.id, slot)}
                  >
                    <span className="text-[9px] text-gray-400 absolute top-0.5 left-1">
                      {slot}
                    </span>
                    {w ? (
                      <button
                        onClick={() => navigate(`/wafers/${w.id}`)}
                        className="text-blue-700 font-medium hover:underline truncate w-full px-0.5"
                        title={`${w.wafer_id} - ${w.material}`}
                      >
                        {w.wafer_id}
                      </button>
                    ) : null}
                    {w && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          assignWafer(w.id, null, null);
                        }}
                        className="absolute top-0 right-0 text-gray-300 hover:text-red-500 p-0.5"
                        title="Remove from slot"
                      >
                        <X size={10} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Unassigned wafers */}
      <div className="mt-6">
        <h2 className="text-lg font-semibold mb-2">
          Unassigned Wafers ({unassigned.length})
        </h2>
        <div
          className="min-h-[48px] bg-gray-50 border border-dashed border-gray-300 rounded-lg p-2"
          onDragOver={(e) => {
            e.preventDefault();
            e.currentTarget.classList.add("ring-2", "ring-blue-400");
          }}
          onDragLeave={(e) => {
            e.currentTarget.classList.remove("ring-2", "ring-blue-400");
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.currentTarget.classList.remove("ring-2", "ring-blue-400");
            handleDropOnUnassigned();
          }}
        >
          {unassigned.length === 0 ? (
            <p className="text-gray-400 text-xs text-center py-2">
              All wafers are assigned to carriers. Drag a wafer here to unassign it.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {unassigned.map((w) => (
                <div
                  key={w.id}
                  draggable
                  onDragStart={() => handleDragStart(w.id, null, null)}
                  className="bg-white border rounded px-2 py-1 text-xs cursor-grab active:cursor-grabbing hover:bg-blue-50 flex items-center gap-1"
                >
                  <button
                    onClick={() => navigate(`/wafers/${w.id}`)}
                    className="text-blue-700 font-medium hover:underline"
                  >
                    {w.wafer_id}
                  </button>
                  <span className="text-gray-400">
                    {w.material} {w.diameter_mm}mm
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
