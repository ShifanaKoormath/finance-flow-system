import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { SetupPage } from "./pages/SetupPage";
import { HomePage } from "./pages/HomePage";
import { AddTransactionPage } from "./pages/AddTransactionPage";
import { EntityPage } from "./pages/EntityPage";
import { AddEntityPage } from "./pages/AddEntityPage";
import { GroupPage } from "./pages/GroupPage";
import { AuthPage } from "./pages/AuthPage";
import { ProfilePage } from "./pages/ProfilePage";
import { EntitiesPage } from "./pages/EntitiesPage";
import { TransactionsPage } from "./pages/TransactionsPage";
import { useState, useEffect } from "react";

export default function App() {
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const loc = useLocation();
  const nav = useNavigate();

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

  // Which paths show bottom nav?
  const isMainTab = ["/", "/transactions", "/entities", "/profile"].includes(loc.pathname);

  return (
    <div className="appShell">
      <main className="main" style={{ paddingBottom: isMainTab ? "100px" : "16px" }}>
        <Routes>
          <Route path="/setup" element={<SetupPage />} />
          <Route path="/" element={<HomePage />} />
          <Route path="/transactions" element={<TransactionsPage />} />
          <Route path="/entities" element={<EntitiesPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/add" element={<AddTransactionPage />} />
          <Route path="/edit/:txId" element={<AddTransactionPage />} />
          <Route path="/add-entity" element={<AddEntityPage />} />
          <Route path="/entity/:entityId" element={<EntityPage />} />
          <Route path="/group/:id" element={<GroupPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {isMainTab && (
        <nav className="bottomNav">
          <button className={`navBtn ${loc.pathname === "/" ? "active" : ""}`} onClick={() => nav("/")}>
            <div className="icon">🏠</div>
            <span>Home</span>
          </button>
          
          <button className={`navBtn ${loc.pathname === "/transactions" ? "active" : ""}`} onClick={() => nav("/transactions")}>
            <div className="icon">📋</div>
            <span>History</span>
          </button>
          
          <div className="navCenterWrapper">
            <button className="navCenterFab" onClick={() => nav("/add")}>
              <span className="plus">+</span>
            </button>
          </div>

          <button className={`navBtn ${loc.pathname === "/entities" ? "active" : ""}`} onClick={() => nav("/entities")}>
            <div className="icon">🗂️</div>
            <span>Accounts</span>
          </button>

          <button className={`navBtn ${loc.pathname === "/profile" ? "active" : ""}`} onClick={() => nav("/profile")}>
            <div className="icon">👤</div>
            <span>Profile</span>
          </button>
        </nav>
      )}
    </div>
  );
}

