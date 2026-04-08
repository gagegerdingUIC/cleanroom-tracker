import { Outlet } from "react-router-dom";
import TopBar from "./TopBar";
import LeftPanel from "./LeftPanel";
import RightPanel from "./RightPanel";

export default function AppLayout() {
  return (
    <div className="h-screen flex flex-col">
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        <LeftPanel />
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-6 py-6">
            <Outlet />
          </div>
        </main>
        <RightPanel />
      </div>
    </div>
  );
}
