import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { MaterialPreset } from "../types";

export function usePresets(type?: string) {
  const [presets, setPresets] = useState<MaterialPreset[]>([]);

  useEffect(() => {
    api.listPresets(type).then(setPresets);
  }, [type]);

  const getDefaults = (
    presetName: string
  ): Record<string, Record<string, string>> | null => {
    const preset = presets.find(
      (p) => p.name.toLowerCase() === presetName.toLowerCase()
    );
    return preset?.default_parameters ?? null;
  };

  const presetNames = presets.map((p) => p.name);

  return { presets, presetNames, getDefaults };
}
