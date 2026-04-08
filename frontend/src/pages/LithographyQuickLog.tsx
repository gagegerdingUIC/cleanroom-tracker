import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import type { Consumable } from "../types";
import { nowCST, cstToISO } from "../utils/datetime";
import DateTimeInput from "../components/DateTimeInput";

const FALLBACK_RESISTS = ["AZ1518", "AZ1505", "P4330", "PMMA", "SU-8", "S1813"];
const FALLBACK_DEVELOPERS = ["AZ 300 MIF", "AZ 340", "AZ 400K", "MF-319", "MIBK:IPA"];

function expiryTag(c: Consumable): string {
  if (!c.expiration_date) return "";
  const exp = new Date(c.expiration_date);
  const days = Math.ceil((exp.getTime() - Date.now()) / 86400000);
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

const isSonication = (method: string) =>
  method.toLowerCase().startsWith("sonication");
const isSoak = (method: string) =>
  method.toLowerCase().includes("soak") || method.toLowerCase().includes("remover");

interface CleanEntry {
  method: string;
  temp: string;
  time: string;
  solvent: string;
}

interface SpinBakeEntry {
  resist: string;
  spinRpm: string;
  spinTime: string;
  spinAccel: string;
  spinDecel: string;
  prebakeTemp: string;
  prebakeTime: string;
  bakeTemp: string;
  bakeTime: string;
}

const now16 = () => nowCST();

export default function LithographyQuickLog() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const waferId = searchParams.get("wafer_id") ?? "";
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Consumables from API
  const [resists, setResists] = useState<Consumable[]>([]);
  const [developers, setDevelopers] = useState<Consumable[]>([]);
  useEffect(() => {
    api.listConsumables("photoresist").then(setResists);
    api.listConsumables("developer").then(setDevelopers);
  }, []);

  const resistNames =
    resists.length > 0 ? resists.map((r) => r.name) : FALLBACK_RESISTS;
  const developerNames =
    developers.length > 0
      ? developers.map((d) => d.name)
      : FALLBACK_DEVELOPERS;

  const resistByName = (name: string) => resists.find((r) => r.name === name);
  const developerByName = (name: string) =>
    developers.find((d) => d.name === name);

  // Toggles
  const [enableClean, setEnableClean] = useState(true);
  const [enablePrebake, setEnablePrebake] = useState(false);
  const [enableSpin, setEnableSpin] = useState(true);
  const [enableExpose, setEnableExpose] = useState(true);
  const [enablePostbake, setEnablePostbake] = useState(false);
  const [enableDevelop, setEnableDevelop] = useState(true);
  const [enableHardbake, setEnableHardbake] = useState(false);

  // Per-section timestamps
  const [cleanTime, setCleanTime] = useState(now16());
  const [prebakeTime, setPrebakeTime] = useState("");
  const [spinTime, setSpinTime] = useState("");
  const [exposeTime, setExposeTime] = useState("");
  const [developTime, setDevelopTime] = useState("");

  // Repeatable: cleaning steps
  const [cleanSteps, setCleanSteps] = useState<CleanEntry[]>([
    { method: CLEANING_METHODS[0], temp: "", time: "", solvent: "" },
  ]);
  const addClean = () =>
    setCleanSteps((prev) => [
      ...prev,
      { method: CLEANING_METHODS[1], temp: "40", time: "300", solvent: "" },
    ]);
  const removeClean = (i: number) =>
    setCleanSteps((prev) => prev.filter((_, idx) => idx !== i));
  const updateClean = (i: number, field: keyof CleanEntry, val: string) =>
    setCleanSteps((prev) =>
      prev.map((c, idx) => (idx === i ? { ...c, [field]: val } : c))
    );

  // Dehydration / pre-bake
  const [dehydrateTemp, setDehydrateTemp] = useState("180");
  const [dehydrateTime, setDehydrateTime] = useState("300");

  // Repeatable: spin + bake cycles
  const [spinBakes, setSpinBakes] = useState<SpinBakeEntry[]>([
    {
      resist: "AZ1518",
      spinRpm: "4000",
      spinTime: "45",
      spinAccel: "",
      spinDecel: "",
      prebakeTemp: "",
      prebakeTime: "",
      bakeTemp: "100",
      bakeTime: "60",
    },
  ]);
  const addSpinBake = () =>
    setSpinBakes((prev) => {
      const last = prev[prev.length - 1];
      return [
        ...prev,
        {
          resist: last?.resist ?? "AZ1518",
          spinRpm: last?.spinRpm ?? "4000",
          spinTime: last?.spinTime ?? "45",
          spinAccel: "",
          spinDecel: "",
          prebakeTemp: "",
          prebakeTime: "",
          bakeTemp: last?.bakeTemp ?? "100",
          bakeTime: last?.bakeTime ?? "60",
        },
      ];
    });
  const removeSpinBake = (i: number) =>
    setSpinBakes((prev) => prev.filter((_, idx) => idx !== i));
  const updateSpinBake = (i: number, field: keyof SpinBakeEntry, val: string) =>
    setSpinBakes((prev) =>
      prev.map((s, idx) => (idx === i ? { ...s, [field]: val } : s))
    );

  // Exposure
  const [patternFile, setPatternFile] = useState("");
  const [energyPercent, setEnergyPercent] = useState("");
  const [focusOffset, setFocusOffset] = useState("");
  const [exposeDuration, setExposeDuration] = useState("");

  // Post-exposure bake
  const [postbakeTemp, setPostbakeTemp] = useState("110");
  const [postbakeTimeVal, setPostbakeTimeVal] = useState("60");

  // Develop
  const [developer, setDeveloper] = useState("AZ 300 MIF");
  const [devRatio, setDevRatio] = useState("1:3");
  const [devTime, setDevTime] = useState("60");
  const [devTemp, setDevTemp] = useState("");

  // Hard bake
  const [hardbakeTemp, setHardbakeTemp] = useState("120");
  const [hardbakeTimeVal, setHardbakeTimeVal] = useState("120");

  // Shared
  const [stepNumberBase, setStepNumberBase] = useState("");
  const [notes, setNotes] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      let stepNum = stepNumberBase ? parseInt(stepNumberBase) : null;
      const nextStep = () => (stepNum != null ? stepNum++ : null);
      const ts = (val: string) =>
        val ? cstToISO(val) : cstToISO(cleanTime);

      const stepsToCreate: Record<string, unknown>[] = [];

      // Cleaning steps
      if (enableClean) {
        for (const c of cleanSteps) {
          const params: Record<string, unknown>[] = [
            { param_name: "cleaning_method", value_raw: c.method, unit: null },
          ];
          if (isSonication(c.method) || isSoak(c.method)) {
            if (c.temp)
              params.push({
                param_name: "temp_c",
                value_raw: c.temp,
                value_numeric: parseFloat(c.temp),
                unit: "°C",
              });
            if (c.time)
              params.push({
                param_name: "duration_s",
                value_raw: c.time,
                value_numeric: parseFloat(c.time),
                unit: "s",
              });
          }
          if (c.solvent)
            params.push({
              param_name: "solvent",
              value_raw: c.solvent,
              unit: null,
            });

          stepsToCreate.push({
            wafer_id: waferId,
            name: `Clean: ${c.method.split("(")[0].trim()}`,
            category: "miscellaneous",
            timestamp_start: ts(cleanTime),
            status: "completed",
            step_number: nextStep(),
            parameter_values: params,
          });
        }
      }

      // Dehydration pre-bake
      if (enablePrebake) {
        stepsToCreate.push({
          wafer_id: waferId,
          name: "Dehydration bake",
          category: "lithography",
          timestamp_start: ts(prebakeTime),
          status: "completed",
          step_number: nextStep(),
          parameter_values: [
            { param_name: "bake_type", value_raw: "dehydration", unit: null },
            {
              param_name: "temp_c",
              value_raw: dehydrateTemp,
              value_numeric: parseFloat(dehydrateTemp),
              unit: "°C",
            },
            {
              param_name: "duration_s",
              value_raw: dehydrateTime,
              value_numeric: parseFloat(dehydrateTime),
              unit: "s",
            },
          ],
        });
      }

      // Spin + bake cycles
      if (enableSpin) {
        for (let i = 0; i < spinBakes.length; i++) {
          const sb = spinBakes[i];
          const label =
            spinBakes.length > 1
              ? `Spin coat ${sb.resist} (${i + 1}/${spinBakes.length})`
              : `Spin coat ${sb.resist}`;

          // Optional per-coat prebake
          if (sb.prebakeTemp && sb.prebakeTime) {
            stepsToCreate.push({
              wafer_id: waferId,
              name:
                spinBakes.length > 1
                  ? `Pre-spin bake (${i + 1}/${spinBakes.length})`
                  : "Pre-spin bake",
              category: "lithography",
              timestamp_start: ts(spinTime),
              status: "completed",
              step_number: nextStep(),
              parameter_values: [
                { param_name: "bake_type", value_raw: "pre-spin", unit: null },
                {
                  param_name: "temp_c",
                  value_raw: sb.prebakeTemp,
                  value_numeric: parseFloat(sb.prebakeTemp),
                  unit: "°C",
                },
                {
                  param_name: "duration_s",
                  value_raw: sb.prebakeTime,
                  value_numeric: parseFloat(sb.prebakeTime),
                  unit: "s",
                },
              ],
            });
          }

          // Spin step
          const spinParams: Record<string, unknown>[] = [
            { param_name: "photoresist_type", value_raw: sb.resist, unit: null },
            {
              param_name: "spin_speed_rpm",
              value_raw: sb.spinRpm,
              value_numeric: parseFloat(sb.spinRpm),
              unit: "RPM",
            },
            {
              param_name: "spin_time_s",
              value_raw: sb.spinTime,
              value_numeric: parseFloat(sb.spinTime),
              unit: "s",
            },
          ];
          if (sb.spinAccel)
            spinParams.push({
              param_name: "acceleration",
              value_raw: sb.spinAccel,
              value_numeric: parseFloat(sb.spinAccel),
              unit: "RPM/s",
            });
          if (sb.spinDecel)
            spinParams.push({
              param_name: "deceleration",
              value_raw: sb.spinDecel,
              value_numeric: parseFloat(sb.spinDecel),
              unit: "RPM/s",
            });

          stepsToCreate.push({
            wafer_id: waferId,
            name: label,
            category: "lithography",
            timestamp_start: ts(spinTime),
            status: "completed",
            step_number: nextStep(),
            parameter_values: spinParams,
          });

          // Softbake
          if (sb.bakeTemp && sb.bakeTime) {
            stepsToCreate.push({
              wafer_id: waferId,
              name:
                spinBakes.length > 1
                  ? `Softbake (${i + 1}/${spinBakes.length})`
                  : "Softbake",
              category: "lithography",
              timestamp_start: ts(spinTime),
              status: "completed",
              step_number: nextStep(),
              parameter_values: [
                { param_name: "bake_type", value_raw: "softbake", unit: null },
                {
                  param_name: "temp_c",
                  value_raw: sb.bakeTemp,
                  value_numeric: parseFloat(sb.bakeTemp),
                  unit: "°C",
                },
                {
                  param_name: "duration_s",
                  value_raw: sb.bakeTime,
                  value_numeric: parseFloat(sb.bakeTime),
                  unit: "s",
                },
              ],
            });
          }
        }
      }

      // Exposure
      if (enableExpose) {
        const params: Record<string, unknown>[] = [];
        if (patternFile)
          params.push({ param_name: "pattern_file", value_raw: patternFile, unit: null });
        if (energyPercent)
          params.push({
            param_name: "energy_percent",
            value_raw: energyPercent,
            value_numeric: parseFloat(energyPercent),
            unit: "%",
          });
        if (focusOffset)
          params.push({
            param_name: "focus_offset",
            value_raw: focusOffset,
            value_numeric: parseFloat(focusOffset),
            unit: null,
          });
        if (exposeDuration)
          params.push({
            param_name: "exposure_duration_s",
            value_raw: exposeDuration,
            value_numeric: parseFloat(exposeDuration),
            unit: "s",
          });

        stepsToCreate.push({
          wafer_id: waferId,
          name: "DWL Exposure",
          category: "lithography",
          timestamp_start: ts(exposeTime),
          status: "completed",
          step_number: nextStep(),
          parameter_values: params,
        });
      }

      // Post-exposure bake
      if (enablePostbake) {
        stepsToCreate.push({
          wafer_id: waferId,
          name: "Post-exposure bake",
          category: "lithography",
          timestamp_start: ts(exposeTime),
          status: "completed",
          step_number: nextStep(),
          parameter_values: [
            { param_name: "bake_type", value_raw: "post-exposure bake", unit: null },
            {
              param_name: "temp_c",
              value_raw: postbakeTemp,
              value_numeric: parseFloat(postbakeTemp),
              unit: "°C",
            },
            {
              param_name: "duration_s",
              value_raw: postbakeTimeVal,
              value_numeric: parseFloat(postbakeTimeVal),
              unit: "s",
            },
          ],
        });
      }

      // Develop
      if (enableDevelop) {
        const devParams: Record<string, unknown>[] = [
          { param_name: "process_type", value_raw: "develop", unit: null },
          { param_name: "chemical", value_raw: developer, unit: null },
          { param_name: "ratio", value_raw: devRatio, unit: null },
          {
            param_name: "duration_s",
            value_raw: devTime,
            value_numeric: parseFloat(devTime),
            unit: "s",
          },
        ];
        if (devTemp)
          devParams.push({
            param_name: "temp_c",
            value_raw: devTemp,
            value_numeric: parseFloat(devTemp),
            unit: "°C",
          });

        stepsToCreate.push({
          wafer_id: waferId,
          name: `Develop (${developer})`,
          category: "lithography",
          timestamp_start: ts(developTime),
          status: "completed",
          step_number: nextStep(),
          parameter_values: devParams,
        });
      }

      // Hard bake
      if (enableHardbake) {
        stepsToCreate.push({
          wafer_id: waferId,
          name: "Hard bake",
          category: "lithography",
          timestamp_start: ts(developTime),
          status: "completed",
          step_number: nextStep(),
          parameter_values: [
            { param_name: "bake_type", value_raw: "hard bake", unit: null },
            {
              param_name: "temp_c",
              value_raw: hardbakeTemp,
              value_numeric: parseFloat(hardbakeTemp),
              unit: "°C",
            },
            {
              param_name: "duration_s",
              value_raw: hardbakeTimeVal,
              value_numeric: parseFloat(hardbakeTimeVal),
              unit: "s",
            },
          ],
        });
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

  const inputClass =
    "w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1";
  const addBtnClass =
    "text-xs text-blue-600 hover:text-blue-800 font-medium mt-2";
  const removeBtnClass =
    "text-xs text-red-500 hover:text-red-700 font-medium";

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Lithography Quick Log</h1>
      <p className="text-sm text-gray-500 mb-6">
        Log an entire lithography sequence. Each section has its own timestamp
        so you can record when each phase happened.{" "}
        <Link to="/consumables" className="text-blue-600 hover:underline">
          Manage consumables
        </Link>
      </p>

      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded mb-4 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Shared step numbering */}
        <div className="grid grid-cols-2 gap-4 mb-2">
          <div>
            <label className={labelClass}>Starting Step #</label>
            <input
              className={inputClass}
              type="number"
              value={stepNumberBase}
              onChange={(e) => setStepNumberBase(e.target.value)}
              placeholder="Auto"
            />
          </div>
        </div>

        {/* ============== CLEAN ============== */}
        <Section
          label="Pre-clean"
          enabled={enableClean}
          onToggle={() => setEnableClean(!enableClean)}
        >
          <DateTimeInput
            label="Timestamp"
            value={cleanTime}
            onChange={setCleanTime}
            className="mb-3"
          />
          {cleanSteps.map((c, i) => (
            <div
              key={i}
              className={`${i > 0 ? "border-t pt-3 mt-3" : ""}`}
            >
              {cleanSteps.length > 1 && (
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-medium text-gray-500">
                    Clean {i + 1}
                  </span>
                  <button
                    type="button"
                    className={removeBtnClass}
                    onClick={() => removeClean(i)}
                  >
                    Remove
                  </button>
                </div>
              )}
              <div className="mb-2">
                {i === 0 && cleanSteps.length === 1 && (
                  <label className={labelClass}>Method</label>
                )}
                <select
                  className={inputClass}
                  value={c.method}
                  onChange={(e) => updateClean(i, "method", e.target.value)}
                >
                  {CLEANING_METHODS.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </div>
              {(isSonication(c.method) || isSoak(c.method)) && (
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className={labelClass}>Temp (°C)</label>
                    <input
                      className={inputClass}
                      type="number"
                      value={c.temp}
                      onChange={(e) => updateClean(i, "temp", e.target.value)}
                      placeholder={isSonication(c.method) ? "40" : "80"}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Time (s)</label>
                    <input
                      className={inputClass}
                      type="number"
                      value={c.time}
                      onChange={(e) => updateClean(i, "time", e.target.value)}
                      placeholder="300"
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Solvent</label>
                    <input
                      className={inputClass}
                      value={c.solvent}
                      onChange={(e) =>
                        updateClean(i, "solvent", e.target.value)
                      }
                      placeholder={
                        c.method.includes("acetone") ? "Acetone" : "Optional"
                      }
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
          <button type="button" className={addBtnClass} onClick={addClean}>
            + Add another clean step
          </button>
        </Section>

        {/* ============== DEHYDRATION BAKE ============== */}
        <Section
          label="Dehydration bake (pre-bake)"
          enabled={enablePrebake}
          onToggle={() => setEnablePrebake(!enablePrebake)}
        >
          <DateTimeInput
            label="Timestamp"
            value={prebakeTime}
            onChange={setPrebakeTime}
            className="mb-3"
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Temperature (°C)</label>
              <input
                className={inputClass}
                type="number"
                value={dehydrateTemp}
                onChange={(e) => setDehydrateTemp(e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>Duration (s)</label>
              <input
                className={inputClass}
                type="number"
                value={dehydrateTime}
                onChange={(e) => setDehydrateTime(e.target.value)}
              />
            </div>
          </div>
        </Section>

        {/* ============== SPIN + BAKE ============== */}
        <Section
          label="Spin coat + Bake"
          enabled={enableSpin}
          onToggle={() => setEnableSpin(!enableSpin)}
        >
          <DateTimeInput
            label="Timestamp"
            value={spinTime}
            onChange={setSpinTime}
            className="mb-3"
          />
          {spinBakes.map((sb, i) => (
            <div
              key={i}
              className={`${i > 0 ? "border-t pt-3 mt-3" : ""}`}
            >
              {spinBakes.length > 1 && (
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-medium text-gray-500">
                    Coat {i + 1}
                  </span>
                  <button
                    type="button"
                    className={removeBtnClass}
                    onClick={() => removeSpinBake(i)}
                  >
                    Remove
                  </button>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 mb-2">
                <div>
                  <label className={labelClass}>Photoresist</label>
                  <select
                    className={`${inputClass} ${resistByName(sb.resist) && isExpired(resistByName(sb.resist)!) ? "border-red-400 text-red-700" : ""}`}
                    value={sb.resist}
                    onChange={(e) =>
                      updateSpinBake(i, "resist", e.target.value)
                    }
                  >
                    {resistNames.map((r) => {
                      const c = resistByName(r);
                      return (
                        <option key={r} value={r}>
                          {r}{c ? expiryTag(c) : ""}
                        </option>
                      );
                    })}
                  </select>
                  {resistByName(sb.resist) && isExpired(resistByName(sb.resist)!) && (
                    <p className="text-xs text-red-600 mt-0.5">This resist is expired!</p>
                  )}
                </div>
                <div>
                  <label className={labelClass}>Spin Speed (RPM)</label>
                  <input
                    className={inputClass}
                    type="number"
                    value={sb.spinRpm}
                    onChange={(e) =>
                      updateSpinBake(i, "spinRpm", e.target.value)
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-2">
                <div>
                  <label className={labelClass}>Spin Time (s)</label>
                  <input
                    className={inputClass}
                    type="number"
                    value={sb.spinTime}
                    onChange={(e) =>
                      updateSpinBake(i, "spinTime", e.target.value)
                    }
                  />
                </div>
                <div>
                  <label className={labelClass}>Accel (RPM/s)</label>
                  <input
                    className={inputClass}
                    type="number"
                    value={sb.spinAccel}
                    onChange={(e) =>
                      updateSpinBake(i, "spinAccel", e.target.value)
                    }
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <label className={labelClass}>Decel (RPM/s)</label>
                  <input
                    className={inputClass}
                    type="number"
                    value={sb.spinDecel}
                    onChange={(e) =>
                      updateSpinBake(i, "spinDecel", e.target.value)
                    }
                    placeholder="Optional"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-2">
                <div>
                  <label className={labelClass}>Softbake Temp (°C)</label>
                  <input
                    className={inputClass}
                    type="number"
                    value={sb.bakeTemp}
                    onChange={(e) =>
                      updateSpinBake(i, "bakeTemp", e.target.value)
                    }
                  />
                </div>
                <div>
                  <label className={labelClass}>Softbake Time (s)</label>
                  <input
                    className={inputClass}
                    type="number"
                    value={sb.bakeTime}
                    onChange={(e) =>
                      updateSpinBake(i, "bakeTime", e.target.value)
                    }
                  />
                </div>
              </div>
              <details className="text-sm">
                <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">
                  Per-coat pre-bake (optional)
                </summary>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <div>
                    <label className={labelClass}>Pre-spin Bake Temp (°C)</label>
                    <input
                      className={inputClass}
                      type="number"
                      value={sb.prebakeTemp}
                      onChange={(e) =>
                        updateSpinBake(i, "prebakeTemp", e.target.value)
                      }
                      placeholder="Optional"
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Pre-spin Bake Time (s)</label>
                    <input
                      className={inputClass}
                      type="number"
                      value={sb.prebakeTime}
                      onChange={(e) =>
                        updateSpinBake(i, "prebakeTime", e.target.value)
                      }
                      placeholder="Optional"
                    />
                  </div>
                </div>
              </details>
            </div>
          ))}
          <button type="button" className={addBtnClass} onClick={addSpinBake}>
            + Add another spin+bake cycle
          </button>
        </Section>

        {/* ============== EXPOSE ============== */}
        <Section
          label="Expose"
          enabled={enableExpose}
          onToggle={() => setEnableExpose(!enableExpose)}
        >
          <DateTimeInput
            label="Timestamp"
            value={exposeTime}
            onChange={setExposeTime}
            className="mb-3"
          />
          <div className="space-y-3">
            <div>
              <label className={labelClass}>Pattern File (.gds)</label>
              <input
                className={inputClass}
                value={patternFile}
                onChange={(e) => setPatternFile(e.target.value)}
                placeholder="e.g. pattern_v3.gds"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelClass}>Energy (%)</label>
                <input
                  className={inputClass}
                  type="number"
                  step="any"
                  value={energyPercent}
                  onChange={(e) => setEnergyPercent(e.target.value)}
                  placeholder="Optional"
                />
              </div>
              <div>
                <label className={labelClass}>Focus Offset</label>
                <input
                  className={inputClass}
                  type="number"
                  step="any"
                  value={focusOffset}
                  onChange={(e) => setFocusOffset(e.target.value)}
                  placeholder="Optional"
                />
              </div>
              <div>
                <label className={labelClass}>Duration (s)</label>
                <input
                  className={inputClass}
                  type="number"
                  value={exposeDuration}
                  onChange={(e) => setExposeDuration(e.target.value)}
                  placeholder="Optional"
                />
              </div>
            </div>
          </div>
        </Section>

        {/* ============== POST-EXPOSURE BAKE ============== */}
        <Section
          label="Post-exposure bake"
          enabled={enablePostbake}
          onToggle={() => setEnablePostbake(!enablePostbake)}
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Temperature (°C)</label>
              <input
                className={inputClass}
                type="number"
                value={postbakeTemp}
                onChange={(e) => setPostbakeTemp(e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>Duration (s)</label>
              <input
                className={inputClass}
                type="number"
                value={postbakeTimeVal}
                onChange={(e) => setPostbakeTimeVal(e.target.value)}
              />
            </div>
          </div>
        </Section>

        {/* ============== DEVELOP ============== */}
        <Section
          label="Develop"
          enabled={enableDevelop}
          onToggle={() => setEnableDevelop(!enableDevelop)}
        >
          <DateTimeInput
            label="Timestamp"
            value={developTime}
            onChange={setDevelopTime}
            className="mb-3"
          />
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelClass}>Developer</label>
                <select
                  className={`${inputClass} ${developerByName(developer) && isExpired(developerByName(developer)!) ? "border-red-400 text-red-700" : ""}`}
                  value={developer}
                  onChange={(e) => setDeveloper(e.target.value)}
                >
                  {developerNames.map((d) => {
                    const c = developerByName(d);
                    return (
                      <option key={d} value={d}>
                        {d}{c ? expiryTag(c) : ""}
                      </option>
                    );
                  })}
                </select>
                {developerByName(developer) && isExpired(developerByName(developer)!) && (
                  <p className="text-xs text-red-600 mt-0.5">This developer is expired!</p>
                )}
              </div>
              <div>
                <label className={labelClass}>Ratio (dev:DI)</label>
                <input
                  className={inputClass}
                  value={devRatio}
                  onChange={(e) => setDevRatio(e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>Temp (°C)</label>
                <input
                  className={inputClass}
                  type="number"
                  value={devTemp}
                  onChange={(e) => setDevTemp(e.target.value)}
                  placeholder="RT"
                />
              </div>
            </div>
            <div>
              <label className={labelClass}>Develop Time (s)</label>
              <input
                className={inputClass}
                type="number"
                value={devTime}
                onChange={(e) => setDevTime(e.target.value)}
              />
            </div>
          </div>
        </Section>

        {/* ============== HARD BAKE ============== */}
        <Section
          label="Hard bake"
          enabled={enableHardbake}
          onToggle={() => setEnableHardbake(!enableHardbake)}
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Temperature (°C)</label>
              <input
                className={inputClass}
                type="number"
                value={hardbakeTemp}
                onChange={(e) => setHardbakeTemp(e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>Duration (s)</label>
              <input
                className={inputClass}
                type="number"
                value={hardbakeTimeVal}
                onChange={(e) => setHardbakeTimeVal(e.target.value)}
              />
            </div>
          </div>
        </Section>

        {/* Notes */}
        <div className="pt-2">
          <label className={labelClass}>Notes</label>
          <textarea
            className={inputClass}
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional notes for this lithography run..."
          />
        </div>

        {/* Submit */}
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? "Saving..." : "Save All Steps"}
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
    </div>
  );
}

function Section({
  label,
  enabled,
  onToggle,
  children,
}: {
  label: string;
  enabled: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`border rounded-lg overflow-hidden ${enabled ? "border-blue-300 bg-white" : "border-gray-200 bg-gray-50"}`}
    >
      <button
        type="button"
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
        onClick={onToggle}
      >
        <input
          type="checkbox"
          checked={enabled}
          onChange={onToggle}
          className="rounded"
        />
        <span
          className={`font-medium text-sm ${enabled ? "text-gray-900" : "text-gray-400"}`}
        >
          {label}
        </span>
      </button>
      {enabled && <div className="px-4 pb-4 pt-1 border-t">{children}</div>}
    </div>
  );
}
