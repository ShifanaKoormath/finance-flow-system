import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export function ProfilePage() {
  const nav = useNavigate();
  const userName = localStorage.getItem("userName");

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("userName");
    localStorage.removeItem("ft_setup_done");
    window.location.reload();
  };

  return (
    <div className="col" style={{ paddingBottom: 80 }}>
      <div className="card cardPad">
        <h2>Profile</h2>
        <div className="muted" style={{ marginBottom: 16 }}>Signed in as <b>{userName || "User"}</b></div>
        <button className="btn btnGhost" style={{ color: "var(--danger)" }} onClick={handleLogout}>Logout</button>
      </div>
    </div>
  );
}
