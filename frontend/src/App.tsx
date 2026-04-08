import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "./components/layout/AppLayout";
import WaferDetail from "./pages/WaferDetail";
import CreateWafer from "./pages/CreateWafer";
import LogProcess from "./pages/LogProcess";
import CreateMachine from "./pages/CreateMachine";
import RecipeList from "./pages/RecipeList";
import CreateRecipe from "./pages/CreateRecipe";
import EditRecipe from "./pages/EditRecipe";
import EditStep from "./pages/EditStep";
import BatchProcess from "./pages/BatchProcess";
import UseRecipe from "./pages/UseRecipe";
import ConsumableList from "./pages/ConsumableList";
import CarrierList from "./pages/CarrierList";

function WaferHome() {
  return (
    <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
      Select a wafer from the sidebar to view its details.
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/wafers" />} />
          <Route path="/wafers" element={<WaferHome />} />
          <Route path="/wafers/new" element={<CreateWafer />} />
          <Route path="/wafers/:id" element={<WaferDetail />} />
          <Route path="/process/new" element={<LogProcess />} />
          <Route path="/process/batch" element={<BatchProcess />} />
          <Route path="/machines/new" element={<CreateMachine />} />
          <Route path="/recipes" element={<RecipeList />} />
          <Route path="/recipes/new" element={<CreateRecipe />} />
          <Route path="/recipes/:recipeId/edit" element={<EditRecipe />} />
          <Route path="/recipes/use" element={<UseRecipe />} />
          <Route path="/steps/:stepId/edit" element={<EditStep />} />
          <Route path="/consumables" element={<ConsumableList />} />
          <Route path="/carriers" element={<CarrierList />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
