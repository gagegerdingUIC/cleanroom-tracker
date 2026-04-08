import { useEffect, useState, useRef, useCallback } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import type { Machine, MachineParameterDefinition, Consumable } from "../types";
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

/* ── Litho helpers ── */

const FALLBACK_RESISTS = ["AZ1518", "AZ1505", "P4330", "PMMA", "SU-8", "S1813"];
const FALLBACK_DEVELOPERS = ["AZ 300 MIF", "AZ 340", "AZ 400K", "MF-319", "MIBK:IPA"];

function expiryTag(c: Consumable): string {
  if (!c.expiration_date) return "";
  const days = Math.ceil(
    (new Date(c.expiration_date).getTime() - Date.now()) / 86400000
  );
  if (days < 0) return ` [EXPIRED ${-days}d ago]`;
  if (days <= 30) return ` [${days}d left]`;
  return "";
}
function isExpired(c: Consumable): boolean {
  if (!c.expiration_date) return false;
  return new Date(c.expiration_date) < new Date();
}

const CLEANING_METHODS = [
  "Triple wash (acetone → IPA → DI → N₂)",
  "Sonication in acetone",
  "Sonication in IPA",
  "Sonication in warm AZ Kwik Strip",
  "1165 Remover soak",
  "O₂ plasma clean",
];
const isSonication = (m: string) => m.toLowerCase().startsWith("sonication");
const isSoak = (m: string) =>
  m.toLowerCase().includes("soak") || m.toLowerCase().includes("remover");

const now16 = () => nowCST();

/* ── Litho block types ── */

type LithoBlockType = "clean" | "spin_coat" | "bake" | "expose" | "flood_expose" | "develop";

const BAKE_TYPES = [
  "Dehydration",
  "Softbake",
  "Post-exposure bake",
  "Hard bake",
] as const;

const BAKE_EQUIPMENT = ["Hotplate", "Convection Oven", "Softbake"] as const;

const FLOOD_EQUIPMENT = ["MA6 Mask Aligner", "DYMAX"] as const;

interface LithoBlock {
  id: string;
  type: LithoBlockType;
  fields: Record<string, string>;
  timestamp: string;
}

const BLOCK_DEFS: { type: LithoBlockType; label: string; icon: string }[] = [
  { type: "clean", label: "Clean", icon: "" },
  { type: "spin_coat", label: "Spin Coat", icon: "" },
  { type: "bake", label: "Bake", icon: "" },
  { type: "expose", label: "Expose (MLA 150)", icon: "" },
  { type: "flood_expose", label: "Flood Expose", icon: "" },
  { type: "develop", label: "Develop", icon: "" },
];

function makeBlockFields(type: LithoBlockType): Record<string, string> {
  switch (type) {
    case "clean":
      return { method: CLEANING_METHODS[0], temp: "", time: "", solvent: "" };
    case "spin_coat":
      return {
        resist: "AZ1518",
        spinRpm: "4000",
        spinTime: "45",
        spinAccel: "",
        spinDecel: "",
      };
    case "bake":
      return { bakeType: "Softbake", equipment: "Hotplate", temp: "100", time: "60" };
    case "expose":
      return { designName: "", jobNumber: "", dose: "", defoc: "" };
    case "flood_expose":
      return { equipment: "MA6 Mask Aligner", duration: "" };
    case "develop":
      return { developer: "AZ 300 MIF", ratio: "1:3", time: "60", temp: "" };
  }
}

let blockIdCounter = 0;
function createBlock(type: LithoBlockType): LithoBlock {
  return {
    id: `block-${++blockIdCounter}`,
    type,
    fields: makeBlockFields(type),
    timestamp: "",
  };
}

/* ── Main component ── */

export default function LogProcess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const waferId = searchParams.get("wafer_id") ?? "";
  const initialCategory = searchParams.get("category") ?? "deposition";

  const [category, setCategory] = useState(initialCategory);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  /* ── Shared: machines + params (non-litho) ── */
  const [machines, setMachines] = useState<Machine[]>([]);
  const [paramDefs, setParamDefs] = useState<MachineParameterDefinition[]>([]);
  const [paramValues, setParamValues] = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    name: "",
    machine_id: "",
    step_number: "",
    timestamp_start: now16(),
    timestamp_end: "",
    status: "completed",
    notes: "",
  });

  useEffect(() => {
    api.listMachines().then(setMachines);
  }, []);

  const filteredMachines = machines.filter((m) => m.category === category);

  useEffect(() => {
    if (!form.machine_id) {
      setParamDefs([]);
      setParamValues({});
      return;
    }
    api.getParamDefs(form.machine_id).then((defs) => {
      setParamDefs(defs);
      const defaults: Record<string, string> = {};
      for (const d of defs) defaults[d.id] = d.default_value ?? "";
      setParamValues(defaults);
    });
  }, [form.machine_id]);

  // Reset machine when category changes
  useEffect(() => {
    setForm((prev) => ({ ...prev, machine_id: "" }));
  }, [category]);

  const set = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  /* ── Litho-specific state ── */
  const [resists, setResists] = useState<Consumable[]>([]);
  const [developers, setDevelopers] = useState<Consumable[]>([]);
  useEffect(() => {
    api.listConsumables("photoresist").then(setResists);
    api.listConsumables("developer").then(setDevelopers);
  }, []);

  const resistNames =
    resists.length > 0 ? resists.map((r) => r.name) : FALLBACK_RESISTS;
  const developerNames =
    developers.length > 0 ? developers.map((d) => d.name) : FALLBACK_DEVELOPERS;
  const resistByName = (name: string) => resists.find((r) => r.name === name);
  const developerByName = (name: string) => developers.find((d) => d.name === name);

  // Dynamic block list
  const [lithoBlocks, setLithoBlocks] = useState<LithoBlock[]>([]);
  const [lithoStepBase, setLithoStepBase] = useState("");
  const [lithoNotes, setLithoNotes] = useState("");

  const addBlock = (type: LithoBlockType) => {
    setLithoBlocks((prev) => [...prev, createBlock(type)]);
  };

  const removeBlock = (id: string) => {
    setLithoBlocks((prev) => prev.filter((b) => b.id !== id));
  };

  const updateBlockField = (id: string, field: string, value: string) => {
    setLithoBlocks((prev) =>
      prev.map((b) =>
        b.id === id ? { ...b, fields: { ...b.fields, [field]: value } } : b
      )
    );
  };

  const updateBlockTimestamp = (id: string, value: string) => {
    setLithoBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, timestamp: value } : b))
    );
  };

  // Drag-and-drop state
  const dragItem = useRef<string | null>(null);
  const dragOverItem = useRef<string | null>(null);

  const handleDragStart = useCallback((blockId: string) => {
    dragItem.current = blockId;
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent, blockId: string) => {
      e.preventDefault();
      dragOverItem.current = blockId;
    },
    []
  );

  const handleDrop = useCallback(() => {
    if (!dragItem.current || !dragOverItem.current) return;
    if (dragItem.current === dragOverItem.current) return;

    setLithoBlocks((prev) => {
      const items = [...prev];
      const dragIdx = items.findIndex((b) => b.id === dragItem.current);
      const overIdx = items.findIndex((b) => b.id === dragOverItem.current);
      if (dragIdx < 0 || overIdx < 0) return prev;
      const [removed] = items.splice(dragIdx, 1);
      items.splice(overIdx, 0, removed);
      return items;
    });

    dragItem.current = null;
    dragOverItem.current = null;
  }, []);

  /* ── Submit handlers ── */

  const handleGenericSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

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

    try {
      await api.createStep({
        wafer_id: waferId,
        name: form.name,
        category,
        timestamp_start: cstToISO(form.timestamp_start),
        timestamp_end: form.timestamp_end
          ? cstToISO(form.timestamp_end)
          : null,
        machine_id: form.machine_id || null,
        step_number: form.step_number ? parseInt(form.step_number) : null,
        status: form.status,
        notes: form.notes || null,
        parameter_values,
      });
      navigate(`/wafers/${waferId}`);
    } catch (err) {
      setError(String(err));
      setSubmitting(false);
    }
  };

  const handleLithoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (lithoBlocks.length === 0) {
      setError("Add at least one step block.");
      return;
    }

    setSubmitting(true);

    try {
      let stepNum = lithoStepBase ? parseInt(lithoStepBase) : null;
      const nextStep = () => (stepNum != null ? stepNum++ : null);
      const fallbackTs = cstToISO(nowCST());
      const ts = (val: string) =>
        val ? cstToISO(val) : fallbackTs;

      const stepsToCreate: Record<string, unknown>[] = [];

      for (const block of lithoBlocks) {
        const f = block.fields;
        const timestamp = ts(block.timestamp);

        switch (block.type) {
          case "clean": {
            const params: Record<string, unknown>[] = [
              { param_name: "cleaning_method", value_raw: f.method, unit: null },
            ];
            if (isSonication(f.method) || isSoak(f.method)) {
              if (f.temp)
                params.push({
                  param_name: "temp_c",
                  value_raw: f.temp,
                  value_numeric: parseFloat(f.temp),
                  unit: "°C",
                });
              if (f.time)
                params.push({
                  param_name: "duration_s",
                  value_raw: f.time,
                  value_numeric: parseFloat(f.time),
                  unit: "s",
                });
            }
            if (f.solvent)
              params.push({ param_name: "solvent", value_raw: f.solvent, unit: null });

            stepsToCreate.push({
              wafer_id: waferId,
              name: `Clean: ${f.method.split("(")[0].trim()}`,
              category: "miscellaneous",
              timestamp_start: timestamp,
              status: "completed",
              step_number: nextStep(),
              parameter_values: params,
            });
            break;
          }

          case "spin_coat": {
            const spinParams: Record<string, unknown>[] = [
              { param_name: "photoresist_type", value_raw: f.resist, unit: null },
              {
                param_name: "spin_speed_rpm",
                value_raw: f.spinRpm,
                value_numeric: parseFloat(f.spinRpm),
                unit: "RPM",
              },
              {
                param_name: "spin_time_s",
                value_raw: f.spinTime,
                value_numeric: parseFloat(f.spinTime),
                unit: "s",
              },
            ];
            if (f.spinAccel)
              spinParams.push({
                param_name: "acceleration",
                value_raw: f.spinAccel,
                value_numeric: parseFloat(f.spinAccel),
                unit: "RPM/s",
              });
            if (f.spinDecel)
              spinParams.push({
                param_name: "deceleration",
                value_raw: f.spinDecel,
                value_numeric: parseFloat(f.spinDecel),
                unit: "RPM/s",
              });

            stepsToCreate.push({
              wafer_id: waferId,
              name: `Spin coat ${f.resist}`,
              category: "lithography",
              timestamp_start: timestamp,
              status: "completed",
              step_number: nextStep(),
              parameter_values: spinParams,
            });
            break;
          }

          case "bake": {
            const bakeType = f.bakeType || "Softbake";
            const equipment = f.equipment || "Hotplate";
            stepsToCreate.push({
              wafer_id: waferId,
              name: `${bakeType} ${f.temp}°C (${equipment})`,
              category: "lithography",
              timestamp_start: timestamp,
              status: "completed",
              step_number: nextStep(),
              parameter_values: [
                { param_name: "bake_type", value_raw: bakeType.toLowerCase(), unit: null },
                { param_name: "equipment", value_raw: equipment, unit: null },
                {
                  param_name: "temp_c",
                  value_raw: f.temp,
                  value_numeric: parseFloat(f.temp),
                  unit: "°C",
                },
                {
                  param_name: "duration_s",
                  value_raw: f.time,
                  value_numeric: parseFloat(f.time),
                  unit: "s",
                },
              ],
            });
            break;
          }

          case "expose": {
            const params: Record<string, unknown>[] = [];
            if (f.designName)
              params.push({ param_name: "design_name", value_raw: f.designName, unit: null });
            if (f.jobNumber)
              params.push({ param_name: "job_number", value_raw: f.jobNumber, unit: null });
            if (f.dose)
              params.push({
                param_name: "dose",
                value_raw: f.dose,
                value_numeric: parseFloat(f.dose),
                unit: "mJ/cm²",
              });
            if (f.defoc)
              params.push({
                param_name: "defoc",
                value_raw: f.defoc,
                value_numeric: parseFloat(f.defoc),
                unit: "µm",
              });

            const exposeName = f.designName
              ? `MLA 150 Exposure: ${f.designName}`
              : "MLA 150 Exposure";
            stepsToCreate.push({
              wafer_id: waferId,
              name: exposeName,
              category: "lithography",
              timestamp_start: timestamp,
              status: "completed",
              step_number: nextStep(),
              parameter_values: params,
            });
            break;
          }

          case "flood_expose": {
            const floodEquip = f.equipment || "MA6 Mask Aligner";
            const floodParams: Record<string, unknown>[] = [
              { param_name: "equipment", value_raw: floodEquip, unit: null },
            ];
            if (f.duration)
              floodParams.push({
                param_name: "duration_s",
                value_raw: f.duration,
                value_numeric: parseFloat(f.duration),
                unit: "s",
              });

            stepsToCreate.push({
              wafer_id: waferId,
              name: `Flood Exposure (${floodEquip})`,
              category: "lithography",
              timestamp_start: timestamp,
              status: "completed",
              step_number: nextStep(),
              parameter_values: floodParams,
            });
            break;
          }

          case "develop": {
            const devParams: Record<string, unknown>[] = [
              { param_name: "process_type", value_raw: "develop", unit: null },
              { param_name: "chemical", value_raw: f.developer, unit: null },
              { param_name: "ratio", value_raw: f.ratio, unit: null },
              {
                param_name: "duration_s",
                value_raw: f.time,
                value_numeric: parseFloat(f.time),
                unit: "s",
              },
            ];
            if (f.temp)
              devParams.push({
                param_name: "temp_c",
                value_raw: f.temp,
                value_numeric: parseFloat(f.temp),
                unit: "°C",
              });

            stepsToCreate.push({
              wafer_id: waferId,
              name: `Develop (${f.developer})`,
              category: "lithography",
              timestamp_start: timestamp,
              status: "completed",
              step_number: nextStep(),
              parameter_values: devParams,
            });
            break;
          }
        }
      }

      for (const step of stepsToCreate) {
        await api.createStep(step);
      }
      navigate(`/wafers/${waferId}`);
    } catch (err) {
      setError(String(err));
      setSubmitting(false);
    }
  };

  /* ── Styles ── */
  const inputClass =
    "w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1";

  const isLitho = category === "lithography";

  /* ── Block renderers ── */

  const renderBlockFields = (block: LithoBlock) => {
    const f = block.fields;
    const upd = (field: string, value: string) =>
      updateBlockField(block.id, field, value);

    switch (block.type) {
      case "clean":
        return (
          <div className="space-y-2">
            <select
              className={inputClass}
              value={f.method}
              onChange={(e) => upd("method", e.target.value)}
            >
              {CLEANING_METHODS.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
            {(isSonication(f.method) || isSoak(f.method)) && (
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className={labelClass}>Temp (°C)</label>
                  <input
                    className={inputClass}
                    type="number"
                    value={f.temp}
                    onChange={(e) => upd("temp", e.target.value)}
                    placeholder={isSonication(f.method) ? "40" : "80"}
                  />
                </div>
                <div>
                  <label className={labelClass}>Time (s)</label>
                  <input
                    className={inputClass}
                    type="number"
                    value={f.time}
                    onChange={(e) => upd("time", e.target.value)}
                    placeholder="300"
                  />
                </div>
                <div>
                  <label className={labelClass}>Solvent</label>
                  <input
                    className={inputClass}
                    value={f.solvent}
                    onChange={(e) => upd("solvent", e.target.value)}
                    placeholder="Optional"
                  />
                </div>
              </div>
            )}
          </div>
        );

      case "spin_coat":
        return (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelClass}>Photoresist</label>
                <select
                  className={`${inputClass} ${resistByName(f.resist) && isExpired(resistByName(f.resist)!) ? "border-red-400 text-red-700" : ""}`}
                  value={f.resist}
                  onChange={(e) => upd("resist", e.target.value)}
                >
                  {resistNames.map((r) => {
                    const c = resistByName(r);
                    return (
                      <option key={r} value={r}>
                        {r}
                        {c ? expiryTag(c) : ""}
                      </option>
                    );
                  })}
                </select>
                {resistByName(f.resist) && isExpired(resistByName(f.resist)!) && (
                  <p className="text-xs text-red-600 mt-0.5">Expired!</p>
                )}
              </div>
              <div>
                <label className={labelClass}>Speed (RPM)</label>
                <input
                  className={inputClass}
                  type="number"
                  value={f.spinRpm}
                  onChange={(e) => upd("spinRpm", e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className={labelClass}>Time (s)</label>
                <input
                  className={inputClass}
                  type="number"
                  value={f.spinTime}
                  onChange={(e) => upd("spinTime", e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>Accel (RPM/s)</label>
                <input
                  className={inputClass}
                  type="number"
                  value={f.spinAccel}
                  onChange={(e) => upd("spinAccel", e.target.value)}
                  placeholder="Optional"
                />
              </div>
              <div>
                <label className={labelClass}>Decel (RPM/s)</label>
                <input
                  className={inputClass}
                  type="number"
                  value={f.spinDecel}
                  onChange={(e) => upd("spinDecel", e.target.value)}
                  placeholder="Optional"
                />
              </div>
            </div>
          </div>
        );

      case "bake":
        return (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelClass}>Bake Type</label>
                <select
                  className={inputClass}
                  value={f.bakeType}
                  onChange={(e) => upd("bakeType", e.target.value)}
                >
                  {BAKE_TYPES.map((bt) => (
                    <option key={bt} value={bt}>
                      {bt}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Equipment</label>
                <select
                  className={inputClass}
                  value={f.equipment}
                  onChange={(e) => upd("equipment", e.target.value)}
                >
                  {BAKE_EQUIPMENT.map((eq) => (
                    <option key={eq} value={eq}>
                      {eq}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelClass}>Temp (°C)</label>
                <input
                  className={inputClass}
                  type="number"
                  value={f.temp}
                  onChange={(e) => upd("temp", e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>Time (s)</label>
                <input
                  className={inputClass}
                  type="number"
                  value={f.time}
                  onChange={(e) => upd("time", e.target.value)}
                />
              </div>
            </div>
          </div>
        );

      case "expose":
        return (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelClass}>Design Name</label>
                <input
                  className={inputClass}
                  value={f.designName}
                  onChange={(e) => upd("designName", e.target.value)}
                  placeholder="e.g. pattern_v3.gds"
                />
              </div>
              <div>
                <label className={labelClass}>Job #</label>
                <input
                  className={inputClass}
                  value={f.jobNumber}
                  onChange={(e) => upd("jobNumber", e.target.value)}
                  placeholder="e.g. 1234"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelClass}>Dose (mJ/cm²)</label>
                <input
                  className={inputClass}
                  type="number"
                  step="any"
                  value={f.dose}
                  onChange={(e) => upd("dose", e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>Defoc (µm)</label>
                <input
                  className={inputClass}
                  type="number"
                  step="any"
                  value={f.defoc}
                  onChange={(e) => upd("defoc", e.target.value)}
                />
              </div>
            </div>
          </div>
        );

      case "flood_expose":
        return (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelClass}>Equipment</label>
                <select
                  className={inputClass}
                  value={f.equipment}
                  onChange={(e) => upd("equipment", e.target.value)}
                >
                  {FLOOD_EQUIPMENT.map((eq) => (
                    <option key={eq} value={eq}>
                      {eq}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Duration (s)</label>
                <input
                  className={inputClass}
                  type="number"
                  value={f.duration}
                  onChange={(e) => upd("duration", e.target.value)}
                />
              </div>
            </div>
          </div>
        );

      case "develop":
        return (
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className={labelClass}>Developer</label>
                <select
                  className={`${inputClass} ${developerByName(f.developer) && isExpired(developerByName(f.developer)!) ? "border-red-400 text-red-700" : ""}`}
                  value={f.developer}
                  onChange={(e) => upd("developer", e.target.value)}
                >
                  {developerNames.map((d) => {
                    const c = developerByName(d);
                    return (
                      <option key={d} value={d}>
                        {d}
                        {c ? expiryTag(c) : ""}
                      </option>
                    );
                  })}
                </select>
                {developerByName(f.developer) &&
                  isExpired(developerByName(f.developer)!) && (
                    <p className="text-xs text-red-600 mt-0.5">Expired!</p>
                  )}
              </div>
              <div>
                <label className={labelClass}>Ratio (dev:DI)</label>
                <input
                  className={inputClass}
                  value={f.ratio}
                  onChange={(e) => upd("ratio", e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>Temp (°C)</label>
                <input
                  className={inputClass}
                  type="number"
                  value={f.temp}
                  onChange={(e) => upd("temp", e.target.value)}
                  placeholder="RT"
                />
              </div>
            </div>
            <div>
              <label className={labelClass}>Time (s)</label>
              <input
                className={inputClass}
                type="number"
                value={f.time}
                onChange={(e) => upd("time", e.target.value)}
              />
            </div>
          </div>
        );
    }
  };

  /* ── Render ── */
  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Log Process</h1>
      <p className="text-sm text-gray-500 mb-6">
        {isLitho ? (
          <>
            Build a lithography sequence by adding blocks from the palette.{" "}
            <Link to="/consumables" className="text-blue-600 hover:underline">
              Manage consumables
            </Link>
          </>
        ) : (
          "Record a process step with machine parameters."
        )}
      </p>

      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded mb-4 text-sm">
          {error}
        </div>
      )}

      {/* Category picker — always shown */}
      <div className="mb-4">
        <label className={labelClass}>Process Category *</label>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                category === c
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* ─── LITHOGRAPHY MODE ─── */}
      {isLitho ? (
        <form onSubmit={handleLithoSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4 mb-2">
            <div>
              <label className={labelClass}>Starting Step #</label>
              <input
                className={inputClass}
                type="number"
                value={lithoStepBase}
                onChange={(e) => setLithoStepBase(e.target.value)}
                placeholder="Auto"
              />
            </div>
          </div>

          {/* Block palette */}
          <div>
            <label className={labelClass}>Add Steps</label>
            <div className="flex flex-wrap gap-2">
              {BLOCK_DEFS.map((def) => (
                <button
                  key={def.type}
                  type="button"
                  onClick={() => addBlock(def.type)}
                  className="px-3 py-1.5 rounded border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:border-blue-400 hover:bg-blue-50 transition-colors"
                >
                  {def.icon} {def.label}
                </button>
              ))}
            </div>
          </div>

          {/* Block list */}
          {lithoBlocks.length === 0 ? (
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center text-gray-400">
              Click a block above to start building your lithography sequence.
            </div>
          ) : (
            <div className="space-y-2">
              {lithoBlocks.map((block, idx) => {
                const def = BLOCK_DEFS.find((d) => d.type === block.type)!;
                return (
                  <div
                    key={block.id}
                    draggable
                    onDragStart={() => handleDragStart(block.id)}
                    onDragOver={(e) => handleDragOver(e, block.id)}
                    onDrop={handleDrop}
                    className="border rounded-lg bg-white overflow-hidden hover:shadow-sm transition-shadow"
                  >
                    {/* Block header */}
                    <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b cursor-grab active:cursor-grabbing">
                      <span className="text-gray-400 select-none" title="Drag to reorder">
                        ≡
                      </span>
                      <span className="text-sm font-medium text-gray-700 flex-1">
                        <span className="text-gray-400 mr-1">{idx + 1}.</span>
                        {def.icon} {def.label}
                      </span>
                      <div className="flex items-center gap-1">
                        <input
                          type="datetime-local"
                          className="border rounded px-2 py-1 text-xs text-gray-500 w-44"
                          value={block.timestamp}
                          onChange={(e) =>
                            updateBlockTimestamp(block.id, e.target.value)
                          }
                          onClick={(e) => e.stopPropagation()}
                          title="Timestamp (optional)"
                        />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            updateBlockTimestamp(block.id, nowCST());
                          }}
                          className="text-xs text-blue-600 hover:text-blue-800 px-1 whitespace-nowrap"
                          title="Set to current time"
                        >
                          Now
                        </button>
                        <button
                          type="button"
                          onClick={() => removeBlock(block.id)}
                          className="text-red-400 hover:text-red-600 text-sm px-1"
                          title="Remove block"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                    {/* Block fields */}
                    <div className="px-3 py-3">
                      {renderBlockFields(block)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Notes */}
          <div className="pt-2">
            <label className={labelClass}>Notes</label>
            <textarea
              className={inputClass}
              rows={2}
              value={lithoNotes}
              onChange={(e) => setLithoNotes(e.target.value)}
              placeholder="Optional notes for this lithography run..."
            />
          </div>

          {/* Submit */}
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={submitting || lithoBlocks.length === 0}
              className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting
                ? "Saving..."
                : `Save ${lithoBlocks.length} Step${lithoBlocks.length !== 1 ? "s" : ""}`}
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
      ) : (
        /* ─── GENERIC MODE ─── */
        <form onSubmit={handleGenericSubmit} className="space-y-4">
          {/* Name */}
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
                No machines for "{category}". You can still log the step without
                a machine.
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
              disabled={submitting}
              className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? "Saving..." : "Save Step"}
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
      )}
    </div>
  );
}
