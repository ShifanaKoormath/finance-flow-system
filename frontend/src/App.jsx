import { Navigate, Route, Routes } from "react-router-dom";
import { SetupPage } from "./pages/SetupPage";
import { HomePage } from "./pages/HomePage";
import { AddTransactionPage } from "./pages/AddTransactionPage";
import { EntityPage } from "./pages/EntityPage";
import { AddEntityPage } from "./pages/AddEntityPage";
import { GroupPage } from "./pages/GroupPage";
import { AuthPage } from "./pages/AuthPage";
import { useState, useEffect } from "react";

export default function App() {
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("token");
    if (stored) setToken(stored);
    setLoading(false);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("userName");
    localStorage.removeItem("ft_setup_done");
    setToken(null);
  };

  useEffect(() => {
    const onUnauthorized = () => {
      handleLogout();
    };
    window.addEventListener("auth:unauthorized", onUnauthorized);
    return () => window.removeEventListener("auth:unauthorized", onUnauthorized);
  }, []);

  if (loading) {
    return (
      <div className="appShell">
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", color: "var(--text)" }}>
          Loading...
        </div>
      </div>
    );
  }

  if (!token) {
    return <AuthPage setToken={setToken} />;
  }

  const userName = localStorage.getItem("userName");

  return (
    <div className="appShell">
      <header className="topbar">
        <div className="brand">
          <div className="brandTitle">Finance Tracker</div>
          <div className="brandSub">Hi, {userName || "User"}</div>
        </div>
        <button onClick={handleLogout} style={{ marginLeft: "auto", background: "none", border: "1px solid white", color: "white", padding: "4px 8px", borderRadius: 4, cursor: "pointer" }}>
          Logout
        </button>
      </header>

      <main className="main">
        <Routes>
          <Route path="/setup" element={<SetupPage />} />
          <Route path="/" element={<HomePage />} />
          <Route path="/add" element={<AddTransactionPage />} />
          <Route path="/edit/:txId" element={<AddTransactionPage />} />
          <Route path="/add-entity" element={<AddEntityPage />} />
          <Route path="/entity/:entityId" element={<EntityPage />} />
          <Route path="/group/:id" element={<GroupPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
