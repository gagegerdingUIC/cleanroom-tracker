import { useUIStore } from "../../store/uiStore";
import ProcessBuilder from "../process-builder/ProcessBuilder";

export default function RightPanel() {
  const open = useUIStore((s) => s.rightPanelOpen);

  if (!open) return null;

  return (
    <div className="w-96 border-l border-gray-200 bg-white flex flex-col shrink-0 overflow-hidden">
      <ProcessBuilder />
    </div>
  );
}
