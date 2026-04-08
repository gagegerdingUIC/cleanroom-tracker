export type WaferShape = "circular" | "square" | "rectangular" | "custom";
export type DopingType = "p" | "n" | "undoped" | "semi-insulating";
export type WaferStatus = "active" | "recycled" | "diced" | "archived" | "destroyed";
export type StepCategory =
  | "characterization"
  | "deposition"
  | "etching"
  | "lithography"
  | "packaging"
  | "miscellaneous";
export type StepStatus =
  | "planned"
  | "in_progress"
  | "completed"
  | "failed"
  | "skipped";
export type ParamType = "input" | "output" | "measured";
export type ConsumableType =
  | "photoresist"
  | "developer"
  | "solvent"
  | "etchant"
  | "other";
export type ParamDataType = "float" | "integer" | "string" | "boolean";

export interface Wafer {
  id: string;
  wafer_id: string;
  material: string;
  diameter_mm: number;
  shape: WaferShape;
  doping_type: DopingType;
  doping_level: number | null;
  resistivity_ohm_cm: number | null;
  crystal_orientation: string | null;
  vendor: string | null;
  lot_number: string | null;
  status: WaferStatus;
  is_recycled: boolean;
  recycled_from_id: string | null;
  notes: string | null;
  folder_id: string | null;
  carrier_id: string | null;
  slot_number: number | null;
  created_at: string;
  updated_at: string;
}

export interface Carrier {
  id: string;
  name: string;
  slot_count: number;
  wafer_diameter_mm: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface WaferFolder {
  id: string;
  name: string;
  parent_id: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface MaterialPreset {
  id: string;
  name: string;
  preset_type: string;
  default_parameters: Record<string, Record<string, string>> | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface Machine {
  id: string;
  name: string;
  category: string;
  abbreviation: string;
  is_active: boolean;
}

export interface MachineParameterDefinition {
  id: string;
  machine_id: string;
  name: string;
  display_name: string;
  param_type: ParamType;
  data_type: ParamDataType;
  unit: string | null;
  is_required: boolean;
  default_value: string | null;
  min_value: number | null;
  max_value: number | null;
  sort_order: number;
}

export interface StepParameterValue {
  id: string;
  param_def_id: string | null;
  param_name: string;
  value_raw: string;
  value_numeric: number | null;
  unit: string | null;
}

export interface ProcessStep {
  id: string;
  wafer_id: string;
  name: string;
  category: StepCategory;
  timestamp_start: string;
  timestamp_end: string | null;
  machine_id: string | null;
  step_number: number | null;
  status: StepStatus;
  is_anomalous: boolean;
  notes: string | null;
  run_id: string | null;
  created_at: string;
  parameter_values: StepParameterValue[];
}

export interface ProcessRun {
  id: string;
  run_label: string;
  machine_id: string | null;
  category: StepCategory;
  timestamp_start: string;
  timestamp_end: string | null;
  notes: string | null;
  created_at: string;
  steps: ProcessStep[];
}

export interface RecipeStepParam {
  name: string;
  display_name: string;
  unit: string | null;
  default_value: string | null;
}

export interface RecipeStep {
  id: string;
  recipe_id: string;
  step_index: number;
  name: string;
  category: StepCategory | null;
  machine_id: string | null;
  expected_parameters: RecipeStepParam[];
  notes: string | null;
}

export interface Recipe {
  id: string;
  name: string;
  description: string | null;
  category: StepCategory;
  machine_id: string | null;
  is_template: boolean;
  steps: RecipeStep[];
  created_at: string;
}

export interface Consumable {
  id: string;
  name: string;
  consumable_type: ConsumableType;
  manufacturer: string | null;
  lot_number: string | null;
  expiration_date: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
}

export type MeasurementType =
  | "step_height"
  | "resist_depth"
  | "etch_depth"
  | "feature_length"
  | "film_thickness"
  | "other";

export interface MeasurementPoint {
  id: string;
  x_um: number;
  y_um: number;
  p7_x?: number | null;
  p7_y?: number | null;
  value: number;
  upper_material?: string | null;
  lower_material?: string | null;
}

export interface Measurement {
  id: string;
  step_id: string;
  measurement_type: MeasurementType;
  instrument: string | null;
  intended_value: number | null;
  unit: string;
  notes: string | null;
  points: MeasurementPoint[];
  created_at: string;
}
