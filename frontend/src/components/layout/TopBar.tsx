import { Link } from "react-router-dom";
import { PanelRightOpen, PanelRightClose } from "lucide-react";
import { useUIStore } from "../../store/uiStore";

export default function TopBar() {
  const rightPanelOpen = useUIStore((s) => s.rightPanelOpen);
  const toggleRightPanel = useUIStore((s) => s.toggleRightPanel);

  return (
    <nav className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-4 shrink-0">
      <Link to="/wafers" className="font-semibold text-gray-900 mr-2">
        Cleanroom Tracker
      </Link>
      <Link
        to="/recipes"
        className="text-sm text-gray-600 hover:text-gray-900"
      >
        Recipes
      </Link>
      <Link
        to="/carriers"
        className="text-sm text-gray-600 hover:text-gray-900"
      >
        Carriers
      </Link>
      <Link
        to="/consumables"
        className="text-sm text-gray-600 hover:text-gray-900"
      >
        Consumables
      </Link>
      <Link
        to="/machines/new"
        className="text-sm text-gray-600 hover:text-gray-900"
      >
        + Machine
      </Link>

      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={toggleRightPanel}
          className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 px-2 py-1 rounded hover:bg-gray-100"
          title={rightPanelOpen ? "Close process builder" : "Open process builder"}
        >
          {rightPanelOpen ? (
            <PanelRightClose size={16} />
          ) : (
            <PanelRightOpen size={16} />
          )}
          <span>Builder</span>
        </button>
      </div>
    </nav>
  );
}
