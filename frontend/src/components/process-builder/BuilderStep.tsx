import { useState, useRef, useEffect } from "react";
import { GripVertical, X, ChevronDown, ChevronRight, MoreVertical } from "lucide-react";
import type { BuilderStepData } from "./StepTemplates";
import { BLOCK_DEFS, makeBlockFields } from "./StepTemplates";
import StepParamForm from "./StepParamForm";

const DEFAULTS_KEY_PREFIX = "builder-step-defaults:";

export function getSavedDefaults(type: string): Record<string, string> | null {
  try {
    const raw = localStorage.getItem(DEFAULTS_KEY_PREFIX + type);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveDefaults(type: string, fields: Record<string, string>) {
  localStorage.setItem(DEFAULTS_KEY_PREFIX + type, JSON.stringify(fields));
}

export function clearSavedDefaults(type: string) {
  localStorage.removeItem(DEFAULTS_KEY_PREFIX + type);
}

interface Props {
  step: BuilderStepData;
  index: number;
  onRemove: () => void;
  onFieldChange: (field: string, value: string) => void;
  onTimestampChange: (value: string) => void;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
  onBulkFieldChange?: (fields: Record<string, string>) => void;
}

export default function BuilderStep({
  step,
  index,
  onRemove,
  onFieldChange,
  onTimestampChange,
  onDragStart,
  onDragOver,
  onDrop,
  onBulkFieldChange,
}: Props) {
  const [expanded, setExpanded] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const def = BLOCK_DEFS.find((d) => d.type === step.type);
  const label = def?.label || step.name || "Step";

  const hasSavedDefaults = step.type !== "generic" && getSavedDefaults(step.type) !== null;

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const handleSaveAsDefaults = () => {
    if (step.type !== "generic") {
      saveDefaults(step.type, step.fields);
    }
    setMenuOpen(false);
  };

  const handleLoadSavedDefaults = () => {
    if (step.type === "generic") return;
    const saved = getSavedDefaults(step.type);
    if (saved && onBulkFieldChange) {
      onBulkFieldChange(saved);
    }
    setMenuOpen(false);
  };

  const handleResetDefaults = () => {
    if (step.type === "generic") return;
    const defaults = makeBlockFields(step.type);
    if (onBulkFieldChange) {
      onBulkFieldChange(defaults);
    }
    setMenuOpen(false);
  };

  const handleClearSaved = () => {
    if (step.type !== "generic") {
      clearSavedDefaults(step.type);
    }
    setMenuOpen(false);
  };

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className="border rounded bg-white overflow-hidden"
    >
      <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b">
        <span className="cursor-grab active:cursor-grabbing text-gray-400">
          <GripVertical size={14} />
        </span>
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="text-gray-400 hover:text-gray-600"
        >
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        <span className="text-xs font-medium text-gray-700 flex-1">
          <span className="text-gray-400 mr-1">{index + 1}.</span>
          {label}
        </span>
        <input
          type="datetime-local"
          className="border rounded px-1.5 py-0.5 text-xs text-gray-500 w-40"
          value={step.timestamp}
          onChange={(e) => onTimestampChange(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          title="Timestamp"
        />
        {step.type !== "generic" && (
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              className="text-gray-400 hover:text-gray-600 ml-1 p-0.5 rounded hover:bg-gray-200"
              title="Default parameters"
            >
              <MoreVertical size={14} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 bg-white border rounded-lg shadow-lg py-1 z-50 w-48">
                <button
                  onClick={handleSaveAsDefaults}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50"
                >
                  Save current as defaults
                </button>
                {hasSavedDefaults && (
                  <button
                    onClick={handleLoadSavedDefaults}
                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50"
                  >
                    Load saved defaults
                  </button>
                )}
                <button
                  onClick={handleResetDefaults}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50"
                >
                  Reset to factory defaults
                </button>
                {hasSavedDefaults && (
                  <button
                    onClick={handleClearSaved}
                    className="w-full text-left px-3 py-1.5 text-xs text-red-500 hover:bg-red-50"
                  >
                    Clear saved defaults
                  </button>
                )}
              </div>
            )}
          </div>
        )}
        <button
          type="button"
          onClick={onRemove}
          className="text-gray-400 hover:text-red-500 ml-1"
        >
          <X size={14} />
        </button>
      </div>
      {expanded && (
        <div className="p-2">
          <StepParamForm step={step} onFieldChange={onFieldChange} />
        </div>
      )}
    </div>
  );
}
