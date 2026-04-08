import type { MachineParameterDefinition } from "../types";

/** Parameters that should render as dropdowns instead of free text */
export const DROPDOWN_OPTIONS: Record<string, string[]> = {
  bake_type: ["Dehydration", "Softbake", "Post-exposure bake", "Hard bake"],
  process_type: ["develop", "clean", "strip", "etch"],
  photoresist_type: ["AZ1518", "AZ1505", "AZ5214", "PMMA", "SU-8", "S1813", "LOR1A"],
  developer: ["AZ 300 MIF", "AZ 340", "AZ 400K", "MF-319", "MIBK:IPA"],
  chemical: [
    "Acetone",
    "IPA",
    "DI Water",
    "Methanol",
    "Piranha",
    "BOE",
    "HF",
    "KOH",
    "NaOH",
    "AZ 300 MIF",
    "AZ 340",
    "AZ 400K",
    "MF-319",
  ],
  cleaning_method: [
    "Triple wash (acetone -> IPA -> DI -> N2)",
    "Sonication in acetone",
    "Sonication in IPA",
    "Sonication in warm AZ Kwik Strip",
    "1165 Remover soak",
    "O2 plasma clean",
  ],
  equipment: ["Hotplate", "Convection Oven", "Softbake", "MA6 Mask Aligner", "DYMAX"],
  material: ["Si", "GaAs", "InP", "SiC", "Sapphire", "Glass", "GaN", "Ge"],
  atmosphere: ["N2", "Ar", "O2", "Forming Gas (N2/H2)", "Vacuum"],
};

interface Props {
  def: MachineParameterDefinition;
  value: string;
  onChange: (value: string) => void;
}

export default function MachineParamField({ def, value, onChange }: Props) {
  const options = DROPDOWN_OPTIONS[def.name];

  if (def.data_type === "boolean") {
    return (
      <input
        type="checkbox"
        checked={value === "true"}
        onChange={(e) => onChange(e.target.checked ? "true" : "false")}
      />
    );
  }

  if (options) {
    return (
      <select
        className="flex-1 border rounded px-2 py-1 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={def.is_required}
      >
        {!value && <option value="">— Select —</option>}
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    );
  }

  return (
    <input
      className="flex-1 border rounded px-2 py-1 text-sm"
      type={
        def.data_type === "float" || def.data_type === "integer"
          ? "number"
          : "text"
      }
      step={def.data_type === "float" ? "any" : undefined}
      min={def.min_value ?? undefined}
      max={def.max_value ?? undefined}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={def.is_required}
    />
  );
}
