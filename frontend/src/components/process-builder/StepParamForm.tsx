import { useState, useEffect, useCallback, useRef } from "react";
import type { BuilderStepData, LithoBlockType } from "./StepTemplates";
import {
  CLEANING_METHODS,
  SONICATION_SOLVENTS,
  BAKE_TYPES,
  BAKE_EQUIPMENT,
  FLOOD_EQUIPMENT,
  MLA_LASERS,
  SWEEP_MODES,
  SPUTTER_TARGETS,
  TRION_GAS_NAMES,
  FALLBACK_RESISTS,
  FALLBACK_DEVELOPERS,
  isSonication,
  isSoak,
} from "./StepTemplates";
import { usePresets } from "../../hooks/usePresets";

/** localStorage key for MLA best-dose/defoc defaults, keyed by resist + RPM */
function mlaBestKey(resist: string, rpm: string): string {
  return `mla-best-${resist}-${rpm}`;
}

interface MlaBestDefaults {
  dose: string;
  defoc: string;
}

function saveMlaBest(resist: string, rpm: string, defaults: MlaBestDefaults) {
  if (!resist || !rpm) return;
  localStorage.setItem(mlaBestKey(resist, rpm), JSON.stringify(defaults));
}

function loadMlaBest(resist: string, rpm: string): MlaBestDefaults | null {
  if (!resist || !rpm) return null;
  try {
    const raw = localStorage.getItem(mlaBestKey(resist, rpm));
    if (!raw) return null;
    return JSON.parse(raw) as MlaBestDefaults;
  } catch {
    return null;
  }
}

const inputClass =
  "w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500";
const labelClass = "block text-xs font-medium text-gray-600 mb-0.5";

/** Sub-component for expose form so we can use hooks for localStorage lookup */
function ExposeForm({ f, upd, resistOptions }: {
  f: Record<string, string>;
  upd: (field: string, value: string) => void;
  resistOptions: string[];
}) {
  const [defaultsResist, setDefaultsResist] = useState(f._defaultsResist || "");
  const [defaultsRpm, setDefaultsRpm] = useState(f._defaultsRpm || "");
  const [loadedFrom, setLoadedFrom] = useState("");

  // Try to load defaults when resist+RPM change
  const tryLoad = useCallback((resist: string, rpm: string) => {
    const best = loadMlaBest(resist, rpm);
    if (best) {
      if (best.dose && !f.dose) upd("dose", best.dose);
      if (best.defoc && !f.defoc) upd("defoc", best.defoc);
      setLoadedFrom(`${resist} @ ${rpm} RPM`);
    } else {
      setLoadedFrom("");
    }
  }, [f.dose, f.defoc, upd]);

  useEffect(() => {
    if (defaultsResist && defaultsRpm) {
      tryLoad(defaultsResist, defaultsRpm);
    }
  }, [defaultsResist, defaultsRpm, tryLoad]);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className={labelClass}>Design Name</label>
          <input
            className={inputClass}
            value={f.designName}
            onChange={(e) => upd("designName", e.target.value)}
            placeholder="e.g. HEMT_v3"
          />
        </div>
        <div>
          <label className={labelClass}>Job #</label>
          <input
            className={inputClass}
            value={f.jobNumber}
            onChange={(e) => upd("jobNumber", e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass}>Laser (nm)</label>
          <select
            className={inputClass}
            value={f.laser}
            onChange={(e) => upd("laser", e.target.value)}
          >
            {MLA_LASERS.map((l) => (
              <option key={l} value={l}>{l} nm</option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={labelClass}>Dose (mJ/cm2)</label>
          <input
            className={inputClass}
            type="number"
            value={f.dose}
            onChange={(e) => upd("dose", e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass}>Defoc (um)</label>
          <input
            className={inputClass}
            type="number"
            value={f.defoc}
            onChange={(e) => upd("defoc", e.target.value)}
          />
        </div>
      </div>
      {/* Load defaults from series exposure */}
      <div className="border-t pt-2">
        <div className="text-xs font-medium text-gray-500 mb-1">
          Load saved defaults
          {loadedFrom && (
            <span className="ml-2 text-[10px] text-green-600 font-normal">
              from {loadedFrom}
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={labelClass}>Resist</label>
            <select
              className={inputClass}
              value={defaultsResist}
              onChange={(e) => setDefaultsResist(e.target.value)}
            >
              <option value="">--</option>
              {resistOptions.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Spin RPM</label>
            <input
              className={inputClass}
              type="number"
              value={defaultsRpm}
              onChange={(e) => setDefaultsRpm(e.target.value)}
              placeholder="e.g. 4000"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Trion log parser ──────────────────────────────────── */

interface TrionLogStep {
  stepNum: number;
  pressureSet: string;
  pressureActual: string;
  icpPower: string;
  riePower: string;
  processTime: string;
  gasSet: string[]; // 8 gas set values
  dcBias: string;
}

interface TrionLogData {
  recipeName: string;
  date: string;
  startTime: string;
  username: string;
  steps: TrionLogStep[];
}

function parseTrionLog(text: string): TrionLogData | null {
  const lines = text.replace(/\r/g, "").split("\n");
  if (lines.length < 13) return null;

  // Parse header
  const recipeName = lines[4]?.replace("Recipe: ", "").trim() || "";
  const date = lines[5]?.replace("Date: ", "").trim() || "";
  const startTime = lines[6]?.replace("Start Time: ", "").trim() || "";
  const username = lines[2]?.replace("Username: ", "").trim() || "";

  // Data rows start after the "-------" separator line
  let dataStart = -1;
  for (let i = 0; i < Math.min(lines.length, 20); i++) {
    if (lines[i].startsWith("---")) { dataStart = i + 1; break; }
  }
  if (dataStart < 0) return null;

  // Group rows by step number (col 5, 1-indexed → index 4)
  const stepMap = new Map<number, { rows: number[][]; }>();
  for (let i = dataStart; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith("PROCESS")) break;
    const cols = line.split("\t").map((c) => parseFloat(c) || 0);
    if (cols.length < 45) continue;
    const stepNum = cols[4];
    if (stepNum === 0) continue;
    if (!stepMap.has(stepNum)) stepMap.set(stepNum, { rows: [] });
    stepMap.get(stepNum)!.rows.push(cols);
  }

  const steps: TrionLogStep[] = [];
  for (const [stepNum, { rows }] of stepMap) {
    if (rows.length === 0) continue;
    // Use the first row for SET values (they're constant within a step)
    const first = rows[0];
    // Average actual values over all rows in the step
    const avgPressure = rows.reduce((s, r) => s + r[7], 0) / rows.length;
    const avgDcBias = rows.reduce((s, r) => s + r[53], 0) / rows.length;

    const fmt = (v: number) => v === 0 ? "" : String(Math.round(v * 100) / 100);

    steps.push({
      stepNum,
      pressureSet: fmt(first[6]),
      pressureActual: fmt(avgPressure),
      icpPower: fmt(first[8]),   // RF#1 Set
      riePower: fmt(first[11]),  // RIE Set
      processTime: fmt(first[14]),
      gasSet: [
        fmt(first[29]), fmt(first[31]), fmt(first[33]), fmt(first[35]),
        fmt(first[37]), fmt(first[39]), fmt(first[41]), fmt(first[43]),
      ],
      dcBias: fmt(avgDcBias),
    });
  }

  return { recipeName, date, startTime, username, steps };
}

function TrionEtchForm({ f, upd }: {
  f: Record<string, string>;
  upd: (field: string, value: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [logData, setLogData] = useState<TrionLogData | null>(null);
  const [selectedStep, setSelectedStep] = useState<number | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const parsed = parseTrionLog(text);
    if (!parsed || parsed.steps.length === 0) {
      alert("Could not parse Trion log file. Make sure it's a .log file from the Trion RIE/ICP.");
      return;
    }
    setLogData(parsed);
    upd("recipeName", parsed.recipeName);
    // Auto-select if only one step, or the last actual process step
    if (parsed.steps.length === 1) {
      applyStep(parsed.steps[0]);
    } else {
      setSelectedStep(null);
    }
  };

  const applyStep = (step: TrionLogStep) => {
    setSelectedStep(step.stepNum);
    upd("stepNumber", String(step.stepNum));
    upd("pressureSet", step.pressureSet);
    upd("pressureActual", step.pressureActual);
    upd("icpPower", step.icpPower);
    upd("riePower", step.riePower);
    upd("processTime", step.processTime);
    for (let i = 0; i < 8; i++) {
      upd(`gas${i + 1}Set`, step.gasSet[i]);
    }
    upd("dcBias", step.dcBias);
  };

  // Which gases are in use (non-empty set value)
  const activeGases = Array.from({ length: 8 }, (_, i) => ({
    index: i,
    name: TRION_GAS_NAMES[i],
    fieldKey: `gas${i + 1}Set`,
    value: f[`gas${i + 1}Set`] || "",
  })).filter((g) => g.value !== "");

  const inactiveGases = Array.from({ length: 8 }, (_, i) => ({
    index: i,
    name: TRION_GAS_NAMES[i],
    fieldKey: `gas${i + 1}Set`,
    value: f[`gas${i + 1}Set`] || "",
  })).filter((g) => g.value === "");

  return (
    <div className="space-y-2">
      {/* Log file upload */}
      <div>
        <input
          ref={fileRef}
          type="file"
          accept=".log"
          className="hidden"
          onChange={handleFileUpload}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="w-full border border-dashed border-gray-300 rounded px-3 py-2 text-xs text-gray-500 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
        >
          Upload Trion .log file to auto-fill
        </button>
      </div>

      {/* Step picker from log */}
      {logData && logData.steps.length > 1 && (
        <div className="bg-blue-50 border border-blue-200 rounded p-2">
          <div className="text-xs font-medium text-blue-700 mb-1">
            Recipe: {logData.recipeName} ({logData.steps.length} steps)
          </div>
          <div className="space-y-1">
            {logData.steps.map((step) => {
              const activeGasLabels = step.gasSet
                .map((v, i) => v ? `${TRION_GAS_NAMES[i]}=${v}` : "")
                .filter(Boolean)
                .join(", ");
              return (
                <button
                  key={step.stepNum}
                  type="button"
                  onClick={() => applyStep(step)}
                  className={`w-full text-left px-2 py-1 rounded text-xs ${
                    selectedStep === step.stepNum
                      ? "bg-blue-200 text-blue-800"
                      : "bg-white hover:bg-blue-100 text-gray-700"
                  }`}
                >
                  <span className="font-medium">Step {step.stepNum}:</span>{" "}
                  {step.pressureSet} mT, ICP {step.icpPower}W, RIE {step.riePower}W, {step.processTime}s
                  {activeGasLabels && <span className="text-gray-500 ml-1">({activeGasLabels})</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Recipe name */}
      <div>
        <label className={labelClass}>Recipe Name</label>
        <input
          className={inputClass}
          value={f.recipeName}
          onChange={(e) => upd("recipeName", e.target.value)}
          placeholder="e.g. GageNbTiNEtch2"
        />
      </div>

      {/* Main parameters */}
      <div className="grid grid-cols-4 gap-2">
        <div>
          <label className={labelClass}>Pressure (mT)</label>
          <input
            className={inputClass}
            type="number"
            value={f.pressureSet}
            onChange={(e) => upd("pressureSet", e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass}>ICP Power (W)</label>
          <input
            className={inputClass}
            type="number"
            value={f.icpPower}
            onChange={(e) => upd("icpPower", e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass}>RIE Power (W)</label>
          <input
            className={inputClass}
            type="number"
            value={f.riePower}
            onChange={(e) => upd("riePower", e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass}>Time (s)</label>
          <input
            className={inputClass}
            type="number"
            value={f.processTime}
            onChange={(e) => upd("processTime", e.target.value)}
          />
        </div>
      </div>

      {/* Gas flows — show active first, then collapsible inactive */}
      <div>
        <div className="text-xs font-medium text-gray-600 mb-1">Gas Flows (sccm)</div>
        <div className="grid grid-cols-4 gap-2">
          {activeGases.map((g) => (
            <div key={g.index}>
              <label className={labelClass}>{g.name}</label>
              <input
                className={inputClass}
                type="number"
                value={g.value}
                onChange={(e) => upd(g.fieldKey, e.target.value)}
              />
            </div>
          ))}
        </div>
        {inactiveGases.length > 0 && activeGases.length > 0 && (
          <details className="mt-1">
            <summary className="text-[10px] text-gray-400 cursor-pointer hover:text-gray-600">
              + {inactiveGases.length} more gases
            </summary>
            <div className="grid grid-cols-4 gap-2 mt-1">
              {inactiveGases.map((g) => (
                <div key={g.index}>
                  <label className={labelClass}>{g.name}</label>
                  <input
                    className={inputClass}
                    type="number"
                    value={g.value}
                    onChange={(e) => upd(g.fieldKey, e.target.value)}
                  />
                </div>
              ))}
            </div>
          </details>
        )}
        {activeGases.length === 0 && (
          <div className="grid grid-cols-4 gap-2">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i}>
                <label className={labelClass}>{TRION_GAS_NAMES[i]}</label>
                <input
                  className={inputClass}
                  type="number"
                  value={f[`gas${i + 1}Set`]}
                  onChange={(e) => upd(`gas${i + 1}Set`, e.target.value)}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Readbacks */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={labelClass}>DC Bias (V, readback)</label>
          <input
            className={inputClass}
            type="number"
            value={f.dcBias}
            onChange={(e) => upd("dcBias", e.target.value)}
            placeholder="measured"
          />
        </div>
        <div>
          <label className={labelClass}>Pressure Actual (mT, avg)</label>
          <input
            className={inputClass}
            type="number"
            value={f.pressureActual}
            onChange={(e) => upd("pressureActual", e.target.value)}
            placeholder="measured"
          />
        </div>
      </div>
    </div>
  );
}

interface Props {
  step: BuilderStepData;
  onFieldChange: (field: string, value: string) => void;
}

export default function StepParamForm({ step, onFieldChange }: Props) {
  const f = step.fields;
  const upd = onFieldChange;
  const { presetNames } = usePresets("photoresist");
  const resistOptions = presetNames.length > 0 ? presetNames : FALLBACK_RESISTS;
  const { presetNames: targetPresetNames } = usePresets("sputter_target");
  const targetOptions = targetPresetNames.length > 0 ? targetPresetNames : SPUTTER_TARGETS;

  if (step.type === "generic") {
    return (
      <div className="text-xs text-gray-400 py-1">
        Configure via machine parameters (coming soon).
      </div>
    );
  }

  const blockType = step.type as LithoBlockType;

  switch (blockType) {
    case "clean":
      return (
        <div className="space-y-2">
          <div className={isSonication(f.method) ? "grid grid-cols-2 gap-2" : ""}>
            <div>
              <label className={labelClass}>Method</label>
              <select
                className={inputClass}
                value={f.method}
                onChange={(e) => upd("method", e.target.value)}
              >
                {CLEANING_METHODS.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </div>
            {isSonication(f.method) && (
              <div>
                <label className={labelClass}>Solvent</label>
                <select
                  className={inputClass}
                  value={f.solvent}
                  onChange={(e) => upd("solvent", e.target.value)}
                >
                  {SONICATION_SOLVENTS.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          {(isSonication(f.method) || isSoak(f.method)) && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelClass}>Temp (C)</label>
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
            </div>
          )}
        </div>
      );

    case "hmds": {
      const hmdsTimeUnit = f.timeUnit || "min";
      return (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelClass}>Method</label>
              <select
                className={inputClass}
                value={f.method}
                onChange={(e) => upd("method", e.target.value)}
              >
                <option>Vapor prime</option>
                <option>Liquid prime</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Time</label>
              <div className="flex gap-1">
                <input
                  className={inputClass}
                  type="number"
                  value={f.time}
                  onChange={(e) => upd("time", e.target.value)}
                  placeholder="5"
                />
                <select
                  className="border rounded px-1 py-1.5 text-xs bg-white shrink-0"
                  value={hmdsTimeUnit}
                  onChange={(e) => upd("timeUnit", e.target.value)}
                >
                  <option value="s">sec</option>
                  <option value="min">min</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      );
    }

    case "spin_coat":
      return (
        <div className="space-y-2">
          <div>
            <label className={labelClass}>Resist</label>
            <select
              className={inputClass}
              value={f.resist}
              onChange={(e) => upd("resist", e.target.value)}
            >
              {resistOptions.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelClass}>Speed (RPM)</label>
              <input
                className={inputClass}
                type="number"
                value={f.spinRpm}
                onChange={(e) => upd("spinRpm", e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>Time (s)</label>
              <input
                className={inputClass}
                type="number"
                value={f.spinTime}
                onChange={(e) => upd("spinTime", e.target.value)}
              />
            </div>
          </div>
        </div>
      );

    case "bake": {
      const isAmbient = f.bakeType === "Rest in ambient conditions";
      const tempUnit = f.tempUnit || "C";
      const timeUnit = f.timeUnit || "s";
      return (
        <div className="space-y-2">
          <div className={isAmbient ? "" : "grid grid-cols-2 gap-2"}>
            <div>
              <label className={labelClass}>Bake Type</label>
              <select
                className={inputClass}
                value={f.bakeType}
                onChange={(e) => {
                  upd("bakeType", e.target.value);
                  if (e.target.value === "Rest in ambient conditions") {
                    upd("temp", "70");
                    upd("tempUnit", "F");
                    upd("humidity", "50");
                  }
                }}
              >
                {BAKE_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
            {!isAmbient && (
              <div>
                <label className={labelClass}>Equipment</label>
                <select
                  className={inputClass}
                  value={f.equipment}
                  onChange={(e) => upd("equipment", e.target.value)}
                >
                  {BAKE_EQUIPMENT.map((e) => (
                    <option key={e}>{e}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className={`grid gap-2 ${isAmbient ? "grid-cols-3" : "grid-cols-2"}`}>
            <div>
              <label className={labelClass}>
                Temp ({tempUnit === "F" ? "°F" : "°C"})
              </label>
              <div className="flex gap-1">
                <input
                  className={inputClass}
                  type="number"
                  value={f.temp}
                  onChange={(e) => upd("temp", e.target.value)}
                />
                <select
                  className="border rounded px-1 py-1.5 text-xs bg-white shrink-0"
                  value={tempUnit}
                  onChange={(e) => {
                    const from = tempUnit;
                    const to = e.target.value;
                    upd("tempUnit", to);
                    const v = parseFloat(f.temp);
                    if (isFinite(v)) {
                      const converted = from === "C" && to === "F"
                        ? (v * 9 / 5 + 32).toFixed(1)
                        : from === "F" && to === "C"
                          ? ((v - 32) * 5 / 9).toFixed(1)
                          : f.temp;
                      upd("temp", converted);
                    }
                  }}
                >
                  <option value="C">°C</option>
                  <option value="F">°F</option>
                </select>
              </div>
            </div>
            <div>
              <label className={labelClass}>Time</label>
              <div className="flex gap-1">
                <input
                  className={inputClass}
                  type="number"
                  value={f.time}
                  onChange={(e) => upd("time", e.target.value)}
                />
                <select
                  className="border rounded px-1 py-1.5 text-xs bg-white shrink-0"
                  value={timeUnit}
                  onChange={(e) => upd("timeUnit", e.target.value)}
                >
                  <option value="s">sec</option>
                  <option value="min">min</option>
                  <option value="hr">hr</option>
                  <option value="d">day</option>
                  <option value="wk">wk</option>
                  <option value="mo">mo</option>
                </select>
              </div>
            </div>
            {isAmbient && (
              <div>
                <label className={labelClass}>Humidity (%RH)</label>
                <input
                  className={inputClass}
                  type="number"
                  value={f.humidity}
                  onChange={(e) => upd("humidity", e.target.value)}
                  placeholder="50"
                />
              </div>
            )}
          </div>
        </div>
      );
    }

    case "expose":
      return <ExposeForm f={f} upd={upd} resistOptions={resistOptions} />;

    case "series_expose": {
      const sweepMode = f.sweepMode || "both";
      const showDose = sweepMode === "dose" || sweepMode === "both";
      const showDefoc = sweepMode === "defocus" || sweepMode === "both";

      const doseEnd = f.doseStart && f.doseStep && f.doseCount
        ? (parseFloat(f.doseStart) + parseFloat(f.doseStep) * (parseFloat(f.doseCount) - 1)).toFixed(1)
        : "";
      const defocEnd = f.defocStart && f.defocStep && f.defocCount
        ? (parseFloat(f.defocStart) + parseFloat(f.defocStep) * (parseFloat(f.defocCount) - 1)).toFixed(1)
        : "";

      // Auto-save best params to localStorage when resist+rpm+dose/defoc are filled
      const hasBest = f.bestResist && f.bestSpinRpm && (f.bestDose || f.bestDefoc);
      if (hasBest) {
        saveMlaBest(f.bestResist, f.bestSpinRpm, { dose: f.bestDose, defoc: f.bestDefoc });
      }

      return (
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className={labelClass}>Design</label>
              <input
                className={inputClass}
                value={f.designName}
                onChange={(e) => upd("designName", e.target.value)}
                placeholder="HIMT_MLA1000"
              />
            </div>
            <div>
              <label className={labelClass}>Laser (nm)</label>
              <select
                className={inputClass}
                value={f.laser}
                onChange={(e) => upd("laser", e.target.value)}
              >
                {MLA_LASERS.map((l) => (
                  <option key={l} value={l}>{l} nm</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Sweep</label>
              <select
                className={inputClass}
                value={f.sweepMode}
                onChange={(e) => upd("sweepMode", e.target.value)}
              >
                {SWEEP_MODES.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>

          {showDose && (
            <div>
              <div className="text-xs font-medium text-gray-500 mb-1">
                Dose (mJ/cm2)
                {doseEnd && <span className="text-gray-400 ml-1">end: {doseEnd}</span>}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className={labelClass}>Start</label>
                  <input
                    className={inputClass}
                    type="number"
                    value={f.doseStart}
                    onChange={(e) => upd("doseStart", e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelClass}>Step</label>
                  <input
                    className={inputClass}
                    type="number"
                    value={f.doseStep}
                    onChange={(e) => upd("doseStep", e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelClass}>Count</label>
                  <input
                    className={inputClass}
                    type="number"
                    value={f.doseCount}
                    onChange={(e) => upd("doseCount", e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {showDefoc && (
            <div>
              <div className="text-xs font-medium text-gray-500 mb-1">
                Defocus (um)
                {defocEnd && <span className="text-gray-400 ml-1">end: {defocEnd}</span>}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className={labelClass}>Start</label>
                  <input
                    className={inputClass}
                    type="number"
                    value={f.defocStart}
                    onChange={(e) => upd("defocStart", e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelClass}>Step</label>
                  <input
                    className={inputClass}
                    type="number"
                    value={f.defocStep}
                    onChange={(e) => upd("defocStep", e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelClass}>Count</label>
                  <input
                    className={inputClass}
                    type="number"
                    value={f.defocCount}
                    onChange={(e) => upd("defocCount", e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Best Results — saved as default for resist + RPM */}
          <div className="border-t pt-2 mt-1">
            <div className="text-xs font-medium text-gray-500 mb-1">
              Best Results
              {hasBest && (
                <span className="ml-2 text-[10px] text-green-600 font-normal">
                  Saved as default for {f.bestResist} @ {f.bestSpinRpm} RPM
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div>
                <label className={labelClass}>Resist</label>
                <select
                  className={inputClass}
                  value={f.bestResist}
                  onChange={(e) => upd("bestResist", e.target.value)}
                >
                  <option value="">--</option>
                  {resistOptions.map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Spin RPM</label>
                <input
                  className={inputClass}
                  type="number"
                  value={f.bestSpinRpm}
                  onChange={(e) => upd("bestSpinRpm", e.target.value)}
                  placeholder="e.g. 4000"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelClass}>Best Dose (mJ/cm2)</label>
                <input
                  className={inputClass}
                  type="number"
                  value={f.bestDose}
                  onChange={(e) => upd("bestDose", e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>Best Defoc (um)</label>
                <input
                  className={inputClass}
                  type="number"
                  value={f.bestDefoc}
                  onChange={(e) => upd("bestDefoc", e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>
      );
    }

    case "flood_expose":
      return (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={labelClass}>Equipment</label>
            <select
              className={inputClass}
              value={f.equipment}
              onChange={(e) => upd("equipment", e.target.value)}
            >
              {FLOOD_EQUIPMENT.map((e) => (
                <option key={e}>{e}</option>
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
      );

    case "develop":
      return (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelClass}>Developer</label>
              <select
                className={inputClass}
                value={f.developer}
                onChange={(e) => upd("developer", e.target.value)}
              >
                {FALLBACK_DEVELOPERS.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Ratio</label>
              <input
                className={inputClass}
                value={f.ratio}
                onChange={(e) => upd("ratio", e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelClass}>Time (s)</label>
              <input
                className={inputClass}
                type="number"
                value={f.time}
                onChange={(e) => upd("time", e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>Temp (C)</label>
              <input
                className={inputClass}
                type="number"
                value={f.temp}
                onChange={(e) => upd("temp", e.target.value)}
                placeholder="RT"
              />
            </div>
          </div>
        </div>
      );

    case "step_height":
      return (
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className={labelClass}>Instrument</label>
              <input
                className={inputClass}
                value={f.instrument}
                onChange={(e) => upd("instrument", e.target.value)}
                placeholder="Stylus Profiler"
              />
            </div>
            <div>
              <label className={labelClass}>Target Value</label>
              <input
                className={inputClass}
                type="number"
                value={f.intendedValue}
                onChange={(e) => upd("intendedValue", e.target.value)}
                placeholder="e.g. 500"
              />
            </div>
            <div>
              <label className={labelClass}>Unit</label>
              <select
                className={inputClass}
                value={f.unit}
                onChange={(e) => upd("unit", e.target.value)}
              >
                <option value="nm">nm</option>
                <option value="µm">µm</option>
                <option value="Å">Å</option>
              </select>
            </div>
          </div>
        </div>
      );

    case "sputter":
      return (
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className={labelClass}>Target</label>
              <select
                className={inputClass}
                value={f.target}
                onChange={(e) => upd("target", e.target.value)}
              >
                {targetOptions.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Base Press. (Torr)</label>
              <input
                className={inputClass}
                value={f.basePressure}
                onChange={(e) => upd("basePressure", e.target.value)}
                placeholder="2e-6"
              />
            </div>
            <div>
              <label className={labelClass}>Chamber (mTorr)</label>
              <input
                className={inputClass}
                type="number"
                step="0.001"
                value={f.chamberPressure}
                onChange={(e) => upd("chamberPressure", e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className={labelClass}>Ar (sccm)</label>
              <input
                className={inputClass}
                type="number"
                value={f.argonFlow}
                onChange={(e) => upd("argonFlow", e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>N2 (sccm)</label>
              <input
                className={inputClass}
                type="number"
                value={f.nitrogenFlow}
                onChange={(e) => upd("nitrogenFlow", e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>Power (W)</label>
              <input
                className={inputClass}
                type="number"
                value={f.rfPower}
                onChange={(e) => upd("rfPower", e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2">
            <div>
              <label className={labelClass}>DC Bias (V)</label>
              <input
                className={inputClass}
                type="number"
                value={f.dcBias}
                onChange={(e) => upd("dcBias", e.target.value)}
                placeholder="measured"
              />
            </div>
            <div>
              <label className={labelClass}>Refl. Power (W)</label>
              <input
                className={inputClass}
                type="number"
                value={f.reflectedPower}
                onChange={(e) => upd("reflectedPower", e.target.value)}
                placeholder="<5"
              />
            </div>
            <div>
              <label className={labelClass}>Sub. Temp (C)</label>
              <input
                className={inputClass}
                type="number"
                value={f.substrateTemp}
                onChange={(e) => upd("substrateTemp", e.target.value)}
                placeholder="RT"
              />
            </div>
            <div>
              <label className={labelClass}>Motor (1-10)</label>
              <input
                className={inputClass}
                type="number"
                min="1"
                max="10"
                value={f.motorSpeed}
                onChange={(e) => upd("motorSpeed", e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelClass}>Pre-clean (min)</label>
              <input
                className={inputClass}
                type="number"
                value={f.precleanTime}
                onChange={(e) => upd("precleanTime", e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>Deposition Time (min)</label>
              <input
                className={inputClass}
                type="number"
                value={f.depositionTime}
                onChange={(e) => upd("depositionTime", e.target.value)}
              />
            </div>
          </div>
        </div>
      );

    case "trion_etch":
      return <TrionEtchForm f={f} upd={upd} />;
  }
}
