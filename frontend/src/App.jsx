import { Navigate, Route, Routes } from "react-router-dom";
import { SetupPage } from "./pages/SetupPage";
import { HomePage } from "./pages/HomePage";
import { AddTransactionPage } from "./pages/AddTransactionPage";
import { EntityPage } from "./pages/EntityPage";
import { AddEntityPage } from "./pages/AddEntityPage";
import { GroupPage } from "./pages/GroupPage";

export default function App() {
  return (
    <div className="appShell">
      <header className="topbar">
        <div className="brand">
          <div className="brandTitle">Finance Tracker</div>
          <div className="brandSub">You gave • You received</div>
        </div>
      </header>

      <main className="main">
        <Routes>
          <Route path="/setup" element={<SetupPage />} />
          <Route path="/" element={<HomePage />} />
          <Route path="/add" element={<AddTransactionPage />} />
          <Route path="/add-entity" element={<AddEntityPage />} />
          <Route path="/entity/:entityId" element={<EntityPage />} />
          <Route path="/group/:id" element={<GroupPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
