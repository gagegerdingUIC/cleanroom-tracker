import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { PanelRightOpen, PanelRightClose, Download } from "lucide-react";
import { useUIStore } from "../../store/uiStore";

const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

interface UpdateInfo {
  current: string;
  latest: string | null;
  update_available: boolean;
  download_url: string;
}

export default function TopBar() {
  const rightPanelOpen = useUIStore((s) => s.rightPanelOpen);
  const toggleRightPanel = useUIStore((s) => s.toggleRightPanel);
  const [update, setUpdate] = useState<UpdateInfo | null>(null);

  useEffect(() => {
    fetch(`${BASE}/api/v1/check-update`)
      .then((r) => r.json())
      .then((data: UpdateInfo) => {
        if (data.update_available) setUpdate(data);
      })
      .catch(() => {});
  }, []);

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
        {update && (
          <a
            href={update.download_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sm text-white bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded"
          >
            <Download size={14} />
            Update available (v{update.latest})
          </a>
        )}
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
