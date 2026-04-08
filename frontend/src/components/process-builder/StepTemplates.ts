import type { StepCategory, ProcessStep } from "../../types";

export type LithoBlockType =
  | "clean"
  | "hmds"
  | "spin_coat"
  | "bake"
  | "expose"
  | "series_expose"
  | "flood_expose"
  | "develop"
  | "trion_etch"
  | "sputter"
  | "step_height";

export interface BlockDef {
  type: LithoBlockType;
  label: string;
}

export const BLOCK_DEFS: BlockDef[] = [
  { type: "clean", label: "Clean" },
  { type: "hmds", label: "HMDS" },
  { type: "spin_coat", label: "Spin Coat" },
  { type: "bake", label: "Bake" },
  { type: "expose", label: "Expose (MLA 150)" },
  { type: "series_expose", label: "Series Expose" },
  { type: "flood_expose", label: "Flood Expose" },
  { type: "develop", label: "Develop" },
  { type: "trion_etch", label: "Etch (Trion)" },
  { type: "sputter", label: "Sputter (CVC)" },
  { type: "step_height", label: "Step Height" },
];

export const CATEGORIES: StepCategory[] = [
  "deposition",
  "etching",
  "lithography",
  "characterization",
  "packaging",
  "miscellaneous",
];

export const BAKE_TYPES = [
  "Dehydration",
  "Softbake",
  "Post-exposure bake",
  "Hard bake",
  "Rest in ambient conditions",
];

export const BAKE_EQUIPMENT = ["Hotplate", "Convection Oven", "Softbake"];
export const FLOOD_EQUIPMENT = ["MA6 Mask Aligner", "DYMAX"];
export const MLA_LASERS = ["405", "365"];
export const SWEEP_MODES = ["dose", "defocus", "both"];

export const CLEANING_METHODS = [
  "Triple wash (acetone -> IPA -> DI -> N2)",
  "Sonication",
  "1165 Remover soak",
  "O2 plasma clean",
];

export const SONICATION_SOLVENTS = [
  "Acetone",
  "IPA",
  "AZ Kwik Strip",
  "NMP",
  "DI Water",
];

export const TRION_GAS_NAMES = [
  "SiCl4", "SF6", "O2/CHF3/CClF2", "Cl2", "CF4/Ar/He-O2", "NF3", "H2", "CH4",
];

/** Gas lines that share a physical MFC — user picks exactly one */
export const TRION_GAS_OPTIONS: Record<number, string[]> = {
  3: ["O2", "CHF3", "CClF2"],
  5: ["CF4", "Ar", "He-O2"],
};

/** Default selection for each shared gas line */
export const TRION_GAS_DEFAULTS: Record<number, string> = {
  3: "O2",
  5: "CF4",
};

export const SPUTTER_TARGETS = ["Nb", "Ti", "Co", "NbTi"];

export const FALLBACK_RESISTS = ["AZ1518", "AZ1505", "P4330", "PMMA", "SU-8", "S1813", "LOR1A", "LOR10A"];
export const FALLBACK_DEVELOPERS = [
  "AZ 300 MIF",
  "AZ 340",
  "AZ 400K",
  "MF-319",
  "MIBK:IPA",
];

export function makeBlockFields(type: LithoBlockType): Record<string, string> {
  switch (type) {
    case "clean":
      return { method: CLEANING_METHODS[0], solvent: "Acetone", temp: "", time: "" };
    case "hmds":
      return { method: "Vapor prime", time: "5", timeUnit: "min" };
    case "spin_coat":
      return {
        resist: "AZ1518",
        spinRpm: "4000",
        spinTime: "45",
        spinAccel: "",
        spinDecel: "",
      };
    case "bake":
      return {
        bakeType: "Softbake",
        equipment: "Hotplate",
        temp: "100",
        tempUnit: "C",
        time: "60",
        timeUnit: "s",
        humidity: "",
      };
    case "expose":
      return { designName: "", jobNumber: "", laser: "405", dose: "", defoc: "" };
    case "series_expose":
      return {
        designName: "HIMT_MLA1000",
        laser: "405",
        sweepMode: "both",
        doseStart: "",
        doseStep: "",
        doseCount: "",
        defocStart: "",
        defocStep: "",
        defocCount: "",
        bestDose: "",
        bestDefoc: "",
        bestResist: "",
        bestSpinRpm: "",
      };
    case "flood_expose":
      return { equipment: "MA6 Mask Aligner", duration: "" };
    case "develop":
      return { developer: "AZ 300 MIF", ratio: "1:3", time: "60", temp: "" };
    case "trion_etch":
      return {
        recipeName: "",
        stepNumber: "",
        pressureSet: "",
        icpPower: "",
        riePower: "",
        processTime: "",
        gas1Set: "", gas2Set: "", gas3Set: "", gas3Name: "O2", gas4Set: "",
        gas5Set: "", gas5Name: "CF4", gas6Set: "", gas7Set: "", gas8Set: "",
        dcBias: "",
        pressureActual: "",
      };
    case "sputter":
      return {
        target: "Nb",
        basePressure: "2e-6",
        chamberPressure: "0.442",
        argonFlow: "30",
        nitrogenFlow: "7",
        rfPower: "200",
        dcBias: "",
        reflectedPower: "",
        substrateTemp: "",
        precleanTime: "10",
        motorSpeed: "10",
        depositionTime: "5",
      };
    case "step_height":
      return {
        instrument: "Stylus Profiler",
        intendedValue: "",
        unit: "nm",
      };
  }
}

export function isSonication(m: string) {
  return m.toLowerCase() === "sonication";
}

export function isSoak(m: string) {
  return m.toLowerCase().includes("soak") || m.toLowerCase().includes("remover");
}

export interface BuilderStepData {
  id: string;
  type: LithoBlockType | "generic";
  name: string;
  category: StepCategory;
  machine_id: string | null;
  fields: Record<string, string>;
  timestamp: string;
  /** Maps waferId → API step ID for steps that have been applied */
  appliedStepIds?: Record<string, string>;
}

/** Convert a builder step into the API payload for creating a ProcessStep */
export function stepToApiPayload(
  step: BuilderStepData,
  waferId: string,
  stepNumber: number | null
): Record<string, unknown> {
  const f = step.fields;
  // datetime-local gives "YYYY-MM-DDTHH:MM" in local time; convert properly
  const timestamp = step.timestamp
    ? new Date(step.timestamp).toISOString()
    : new Date().toISOString();

  if (step.type === "generic") {
    return {
      wafer_id: waferId,
      name: step.name,
      category: step.category,
      timestamp_start: timestamp,
      status: "completed",
      machine_id: step.machine_id || null,
      step_number: stepNumber,
      parameter_values: [],
    };
  }

  // Litho block types
  switch (step.type) {
    case "clean": {
      const params: Record<string, unknown>[] = [
        { param_name: "cleaning_method", value_raw: f.method, unit: null },
      ];
      if ((isSonication(f.method) || isSoak(f.method)) && f.temp)
        params.push({
          param_name: "temp_c",
          value_raw: f.temp,
          value_numeric: parseFloat(f.temp),
          unit: "\u00b0C",
        });
      if ((isSonication(f.method) || isSoak(f.method)) && f.time)
        params.push({
          param_name: "duration_s",
          value_raw: f.time,
          value_numeric: parseFloat(f.time),
          unit: "s",
        });
      if (f.solvent)
        params.push({ param_name: "solvent", value_raw: f.solvent, unit: null });
      const cleanLabel = isSonication(f.method)
        ? `Sonication in ${f.solvent}`
        : f.method.split("(")[0].trim();
      return {
        wafer_id: waferId,
        name: `Clean: ${cleanLabel}`,
        category: "miscellaneous",
        timestamp_start: timestamp,
        status: "completed",
        step_number: stepNumber,
        parameter_values: params,
      };
    }
    case "hmds": {
      const timeUnit = f.timeUnit || "min";
      const TIME_TO_S_HMDS: Record<string, number> = { s: 1, min: 60 };
      const rawTime = parseFloat(f.time);
      const timeS = rawTime * (TIME_TO_S_HMDS[timeUnit] ?? 1);
      const params: Record<string, unknown>[] = [
        { param_name: "method", value_raw: f.method, unit: null },
        {
          param_name: "duration_s",
          value_raw: f.time,
          value_numeric: isFinite(timeS) ? timeS : undefined,
          unit: timeUnit,
        },
      ];
      return {
        wafer_id: waferId,
        name: `HMDS ${f.method}`,
        category: "lithography",
        timestamp_start: timestamp,
        status: "completed",
        step_number: stepNumber,
        parameter_values: params,
      };
    }
    case "spin_coat": {
      const params: Record<string, unknown>[] = [
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
        params.push({
          param_name: "acceleration",
          value_raw: f.spinAccel,
          value_numeric: parseFloat(f.spinAccel),
          unit: "RPM/s",
        });
      if (f.spinDecel)
        params.push({
          param_name: "deceleration",
          value_raw: f.spinDecel,
          value_numeric: parseFloat(f.spinDecel),
          unit: "RPM/s",
        });
      return {
        wafer_id: waferId,
        name: `Spin coat ${f.resist}`,
        category: "lithography",
        timestamp_start: timestamp,
        status: "completed",
        step_number: stepNumber,
        parameter_values: params,
      };
    }
    case "bake": {
      const bakeType = f.bakeType || "Softbake";
      const equipment = f.equipment || "Hotplate";
      const isAmbient = bakeType === "Rest in ambient conditions";
      const tempUnit = f.tempUnit || "C";
      const timeUnit = f.timeUnit || "s";

      // Convert temp to Celsius for storage
      const rawTemp = parseFloat(f.temp);
      const tempC = tempUnit === "F" ? (rawTemp - 32) * 5 / 9 : rawTemp;

      // Convert time to seconds for storage
      const TIME_TO_S: Record<string, number> = { s: 1, min: 60, hr: 3600, d: 86400, wk: 604800, mo: 2592000 };
      const rawTime = parseFloat(f.time);
      const timeS = rawTime * (TIME_TO_S[timeUnit] ?? 1);

      const name = isAmbient
        ? `Rest in ambient (${f.time}${timeUnit})`
        : `${bakeType} ${f.temp}°${tempUnit} (${equipment})`;

      const params: Record<string, unknown>[] = [
        { param_name: "bake_type", value_raw: bakeType.toLowerCase(), unit: null },
      ];
      if (!isAmbient) {
        params.push({ param_name: "equipment", value_raw: equipment, unit: null });
      }
      params.push({
        param_name: "temp_c",
        value_raw: f.temp,
        value_numeric: isFinite(tempC) ? tempC : undefined,
        unit: `°${tempUnit}`,
      });
      params.push({
        param_name: "duration_s",
        value_raw: f.time,
        value_numeric: isFinite(timeS) ? timeS : undefined,
        unit: timeUnit,
      });
      if (f.humidity) {
        params.push({
          param_name: "humidity_pct",
          value_raw: f.humidity,
          value_numeric: parseFloat(f.humidity),
          unit: "%RH",
        });
      }

      return {
        wafer_id: waferId,
        name,
        category: isAmbient ? "miscellaneous" : "lithography",
        timestamp_start: timestamp,
        status: "completed",
        step_number: stepNumber,
        parameter_values: params,
      };
    }
    case "expose": {
      const params: Record<string, unknown>[] = [];
      if (f.laser)
        params.push({ param_name: "laser_nm", value_raw: f.laser, value_numeric: parseFloat(f.laser), unit: "nm" });
      if (f.designName)
        params.push({ param_name: "design_name", value_raw: f.designName, unit: null });
      if (f.jobNumber)
        params.push({ param_name: "job_number", value_raw: f.jobNumber, unit: null });
      if (f.dose)
        params.push({
          param_name: "dose",
          value_raw: f.dose,
          value_numeric: parseFloat(f.dose),
          unit: "mJ/cm\u00b2",
        });
      if (f.defoc)
        params.push({
          param_name: "defoc",
          value_raw: f.defoc,
          value_numeric: parseFloat(f.defoc),
          unit: "\u00b5m",
        });
      return {
        wafer_id: waferId,
        name: f.designName
          ? `MLA 150 Exposure: ${f.designName}`
          : "MLA 150 Exposure",
        category: "lithography",
        timestamp_start: timestamp,
        status: "completed",
        step_number: stepNumber,
        parameter_values: params,
      };
    }
    case "series_expose": {
      const sweepMode = f.sweepMode || "both";
      const params: Record<string, unknown>[] = [
        { param_name: "exposure_type", value_raw: "series", unit: null },
        { param_name: "laser_nm", value_raw: f.laser, value_numeric: parseFloat(f.laser), unit: "nm" },
        { param_name: "sweep_mode", value_raw: sweepMode, unit: null },
      ];
      if (f.designName)
        params.push({ param_name: "design_name", value_raw: f.designName, unit: null });
      if (sweepMode === "dose" || sweepMode === "both") {
        if (f.doseStart)
          params.push({ param_name: "dose_start", value_raw: f.doseStart, value_numeric: parseFloat(f.doseStart), unit: "mJ/cm\u00b2" });
        if (f.doseStep)
          params.push({ param_name: "dose_step", value_raw: f.doseStep, value_numeric: parseFloat(f.doseStep), unit: "mJ/cm\u00b2" });
        if (f.doseCount)
          params.push({ param_name: "dose_count", value_raw: f.doseCount, value_numeric: parseFloat(f.doseCount), unit: null });
      }
      if (sweepMode === "defocus" || sweepMode === "both") {
        if (f.defocStart)
          params.push({ param_name: "defoc_start", value_raw: f.defocStart, value_numeric: parseFloat(f.defocStart), unit: "\u00b5m" });
        if (f.defocStep)
          params.push({ param_name: "defoc_step", value_raw: f.defocStep, value_numeric: parseFloat(f.defocStep), unit: "\u00b5m" });
        if (f.defocCount)
          params.push({ param_name: "defoc_count", value_raw: f.defocCount, value_numeric: parseFloat(f.defocCount), unit: null });
      }
      if (f.bestDose)
        params.push({ param_name: "best_dose", value_raw: f.bestDose, value_numeric: parseFloat(f.bestDose), unit: "mJ/cm\u00b2" });
      if (f.bestDefoc)
        params.push({ param_name: "best_defoc", value_raw: f.bestDefoc, value_numeric: parseFloat(f.bestDefoc), unit: "\u00b5m" });
      if (f.bestResist)
        params.push({ param_name: "best_resist", value_raw: f.bestResist, unit: null });
      if (f.bestSpinRpm)
        params.push({ param_name: "best_spin_rpm", value_raw: f.bestSpinRpm, value_numeric: parseFloat(f.bestSpinRpm), unit: "RPM" });
      const label = f.designName ? `Series Exposure: ${f.designName}` : "Series Exposure";
      return {
        wafer_id: waferId,
        name: label,
        category: "lithography",
        timestamp_start: timestamp,
        status: "completed",
        step_number: stepNumber,
        parameter_values: params,
      };
    }
    case "flood_expose": {
      const equip = f.equipment || "MA6 Mask Aligner";
      const params: Record<string, unknown>[] = [
        { param_name: "equipment", value_raw: equip, unit: null },
      ];
      if (f.duration)
        params.push({
          param_name: "duration_s",
          value_raw: f.duration,
          value_numeric: parseFloat(f.duration),
          unit: "s",
        });
      return {
        wafer_id: waferId,
        name: `Flood Exposure (${equip})`,
        category: "lithography",
        timestamp_start: timestamp,
        status: "completed",
        step_number: stepNumber,
        parameter_values: params,
      };
    }
    case "develop": {
      const params: Record<string, unknown>[] = [
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
        params.push({
          param_name: "temp_c",
          value_raw: f.temp,
          value_numeric: parseFloat(f.temp),
          unit: "\u00b0C",
        });
      return {
        wafer_id: waferId,
        name: `Develop (${f.developer})`,
        category: "lithography",
        timestamp_start: timestamp,
        status: "completed",
        step_number: stepNumber,
        parameter_values: params,
      };
    }
    case "trion_etch": {
      const params: Record<string, unknown>[] = [];
      if (f.recipeName)
        params.push({ param_name: "recipe_name", value_raw: f.recipeName, unit: null });
      if (f.stepNumber)
        params.push({ param_name: "step_number", value_raw: f.stepNumber, unit: null });
      if (f.pressureSet)
        params.push({ param_name: "pressure_set_mt", value_raw: f.pressureSet, value_numeric: parseFloat(f.pressureSet), unit: "mT" });
      if (f.icpPower)
        params.push({ param_name: "icp_power_w", value_raw: f.icpPower, value_numeric: parseFloat(f.icpPower), unit: "W" });
      if (f.riePower)
        params.push({ param_name: "rie_power_w", value_raw: f.riePower, value_numeric: parseFloat(f.riePower), unit: "W" });
      if (f.processTime)
        params.push({ param_name: "process_time_s", value_raw: f.processTime, value_numeric: parseFloat(f.processTime), unit: "s" });
      const gasNames = [
        "SiCl4", "SF6",
        f.gas3Name || "O2",   // shared line: O2 / CHF3 / CClF2
        "Cl2",
        f.gas5Name || "CF4",  // shared line: CF4 / Ar / He-O2
        "NF3", "H2", "CH4",
      ];
      for (let i = 1; i <= 8; i++) {
        const val = f[`gas${i}Set`];
        if (val)
          params.push({ param_name: `gas${i}_${gasNames[i - 1].toLowerCase().replace("-", "")}_sccm`, value_raw: val, value_numeric: parseFloat(val), unit: "sccm" });
      }
      if (f.dcBias)
        params.push({ param_name: "dc_bias_v", value_raw: f.dcBias, value_numeric: parseFloat(f.dcBias), unit: "V" });
      if (f.pressureActual)
        params.push({ param_name: "pressure_actual_mt", value_raw: f.pressureActual, value_numeric: parseFloat(f.pressureActual), unit: "mT" });
      const label = f.recipeName ? `Trion Etch: ${f.recipeName}` : "Trion ICP RIE Etch";
      return {
        wafer_id: waferId,
        name: label + (f.stepNumber ? ` (Step ${f.stepNumber})` : ""),
        category: "etching",
        timestamp_start: timestamp,
        status: "completed",
        step_number: stepNumber,
        parameter_values: params,
      };
    }
    case "sputter": {
      const params: Record<string, unknown>[] = [
        { param_name: "target", value_raw: f.target, unit: null },
      ];
      if (f.basePressure)
        params.push({ param_name: "base_pressure_torr", value_raw: f.basePressure, value_numeric: parseFloat(f.basePressure), unit: "Torr" });
      if (f.chamberPressure)
        params.push({ param_name: "chamber_pressure_mtorr", value_raw: f.chamberPressure, value_numeric: parseFloat(f.chamberPressure), unit: "mTorr" });
      if (f.argonFlow)
        params.push({ param_name: "argon_flow_sccm", value_raw: f.argonFlow, value_numeric: parseFloat(f.argonFlow), unit: "sccm" });
      if (f.nitrogenFlow)
        params.push({ param_name: "nitrogen_flow_sccm", value_raw: f.nitrogenFlow, value_numeric: parseFloat(f.nitrogenFlow), unit: "sccm" });
      if (f.rfPower)
        params.push({ param_name: "rf_power_w", value_raw: f.rfPower, value_numeric: parseFloat(f.rfPower), unit: "W" });
      if (f.dcBias)
        params.push({ param_name: "dc_bias_v", value_raw: f.dcBias, value_numeric: parseFloat(f.dcBias), unit: "V" });
      if (f.reflectedPower)
        params.push({ param_name: "avg_reflected_power_w", value_raw: f.reflectedPower, value_numeric: parseFloat(f.reflectedPower), unit: "W" });
      if (f.substrateTemp)
        params.push({ param_name: "substrate_temp_c", value_raw: f.substrateTemp, value_numeric: parseFloat(f.substrateTemp), unit: "\u00b0C" });
      if (f.precleanTime)
        params.push({ param_name: "preclean_time_min", value_raw: f.precleanTime, value_numeric: parseFloat(f.precleanTime), unit: "min" });
      if (f.motorSpeed)
        params.push({ param_name: "motor_speed", value_raw: f.motorSpeed, value_numeric: parseFloat(f.motorSpeed), unit: null });
      if (f.depositionTime)
        params.push({ param_name: "deposition_time_min", value_raw: f.depositionTime, value_numeric: parseFloat(f.depositionTime), unit: "min" });
      return {
        wafer_id: waferId,
        name: `CVC Sputter ${f.target}`,
        category: "deposition",
        timestamp_start: timestamp,
        status: "completed",
        step_number: stepNumber,
        parameter_values: params,
      };
    }
    case "step_height": {
      const params: Record<string, unknown>[] = [
        { param_name: "instrument", value_raw: f.instrument, unit: null },
        { param_name: "unit", value_raw: f.unit, unit: null },
      ];
      if (f.intendedValue)
        params.push({
          param_name: "intended_value",
          value_raw: f.intendedValue,
          value_numeric: parseFloat(f.intendedValue),
          unit: f.unit,
        });
      return {
        wafer_id: waferId,
        name: "Step Height Measurement",
        category: "characterization",
        timestamp_start: timestamp,
        status: "completed",
        step_number: stepNumber,
        parameter_values: params,
      };
    }
  }
}

/* ── Reverse mapping: API ProcessStep → BuilderStepData ────────────── */

/** Infer the builder block type from an API step's name */
export function inferBlockType(step: ProcessStep): LithoBlockType | null {
  const n = step.name.toLowerCase();
  if (n.startsWith("clean:")) return "clean";
  if (n.startsWith("hmds")) return "hmds";
  if (n.startsWith("spin coat")) return "spin_coat";
  // Bake types
  if (
    n.startsWith("softbake") ||
    n.startsWith("hard bake") ||
    n.startsWith("post-exposure bake") ||
    n.startsWith("dehydration")
  )
    return "bake";
  if (n.startsWith("series exposure")) return "series_expose";
  if (n.startsWith("flood exposure")) return "flood_expose";
  if (n.startsWith("mla 150 exposure") || n.startsWith("mla150")) return "expose";
  if (n.startsWith("develop")) return "develop";
  if (n.startsWith("trion etch") || n.startsWith("trion icp")) return "trion_etch";
  if (n.startsWith("cvc sputter")) return "sputter";
  if (n.startsWith("step height")) return "step_height";
  return null;
}

/** Maps API param_name → builder field name, per block type */
const API_TO_BUILDER_FIELD: Record<string, Record<string, string>> = {
  clean: { cleaning_method: "method", solvent: "solvent", temp_c: "temp", duration_s: "time" },
  hmds: { method: "method", duration_s: "time" },
  spin_coat: { photoresist_type: "resist", spin_speed_rpm: "spinRpm", spin_time_s: "spinTime", acceleration: "spinAccel", deceleration: "spinDecel" },
  bake: { bake_type: "bakeType", equipment: "equipment", temp_c: "temp", duration_s: "time", humidity_pct: "humidity" },
  expose: { laser_nm: "laser", design_name: "designName", job_number: "jobNumber", dose: "dose", defoc: "defoc" },
  series_expose: { laser_nm: "laser", design_name: "designName", sweep_mode: "sweepMode", dose_start: "doseStart", dose_step: "doseStep", dose_count: "doseCount", defoc_start: "defocStart", defoc_step: "defocStep", defoc_count: "defocCount", best_dose: "bestDose", best_defoc: "bestDefoc", best_resist: "bestResist", best_spin_rpm: "bestSpinRpm" },
  flood_expose: { equipment: "equipment", duration_s: "duration" },
  develop: { chemical: "developer", ratio: "ratio", duration_s: "time", temp_c: "temp" },
  trion_etch: {
    recipe_name: "recipeName", step_number: "stepNumber", pressure_set_mt: "pressureSet",
    icp_power_w: "icpPower", rie_power_w: "riePower", process_time_s: "processTime",
    gas1_sicl4_sccm: "gas1Set", gas2_sf6_sccm: "gas2Set",
    // Gas line 3 variants (shared MFC)
    gas3_o2_sccm: "gas3Set", gas3_chf3_sccm: "gas3Set", gas3_cclf2_sccm: "gas3Set",
    gas4_cl2_sccm: "gas4Set",
    // Gas line 5 variants (shared MFC)
    gas5_cf4_sccm: "gas5Set", gas5_ar_sccm: "gas5Set", gas5_heo2_sccm: "gas5Set",
    gas6_nf3_sccm: "gas6Set", gas7_h2_sccm: "gas7Set", gas8_ch4_sccm: "gas8Set",
    dc_bias_v: "dcBias", pressure_actual_mt: "pressureActual",
  },
  sputter: { target: "target", base_pressure_torr: "basePressure", chamber_pressure_mtorr: "chamberPressure", argon_flow_sccm: "argonFlow", nitrogen_flow_sccm: "nitrogenFlow", rf_power_w: "rfPower", dc_bias_v: "dcBias", avg_reflected_power_w: "reflectedPower", substrate_temp_c: "substrateTemp", preclean_time_min: "precleanTime", motor_speed: "motorSpeed", deposition_time_min: "depositionTime" },
  step_height: { instrument: "instrument", intended_value: "intendedValue", unit: "unit" },
};

/** Convert an API ProcessStep back into a BuilderStepData for editing with StepParamForm */
export function apiStepToBuilderStep(step: ProcessStep): BuilderStepData | null {
  const blockType = inferBlockType(step);
  if (!blockType) return null;

  const fieldMap = API_TO_BUILDER_FIELD[blockType] || {};
  // Start with defaults so all expected keys exist
  const fields = makeBlockFields(blockType);

  // Overwrite with actual values from the API step
  for (const pv of step.parameter_values) {
    const builderField = fieldMap[pv.param_name];
    if (builderField) {
      fields[builderField] = pv.value_raw;
    }
  }

  // Special case: infer selected gas name for shared MFC lines when loading from API
  if (blockType === "trion_etch") {
    for (const pv of step.parameter_values) {
      if (pv.param_name.startsWith("gas3_") && pv.param_name.endsWith("_sccm")) {
        const gasId = pv.param_name.replace("gas3_", "").replace("_sccm", "");
        const nameMap: Record<string, string> = { o2: "O2", chf3: "CHF3", cclf2: "CClF2" };
        if (nameMap[gasId]) fields.gas3Name = nameMap[gasId];
      }
      if (pv.param_name.startsWith("gas5_") && pv.param_name.endsWith("_sccm")) {
        const gasId = pv.param_name.replace("gas5_", "").replace("_sccm", "");
        const nameMap: Record<string, string> = { cf4: "CF4", ar: "Ar", heo2: "He-O2" };
        if (nameMap[gasId]) fields.gas5Name = nameMap[gasId];
      }
    }
  }

  // Special case: bake_type comes back lowercase, capitalize for the dropdown
  if (blockType === "bake" && fields.bakeType) {
    fields.bakeType = fields.bakeType.charAt(0).toUpperCase() + fields.bakeType.slice(1);
    // Fix multi-word bake types
    if (fields.bakeType === "Post-exposure bake") fields.bakeType = "Post-exposure bake";
    if (fields.bakeType === "Hard bake") fields.bakeType = "Hard bake";
  }

  return {
    id: `edit-${step.id}`,
    type: blockType,
    name: step.name,
    category: step.category,
    machine_id: step.machine_id,
    fields,
    timestamp: step.timestamp_start,
    appliedStepIds: { [step.wafer_id]: step.id },
  };
}
