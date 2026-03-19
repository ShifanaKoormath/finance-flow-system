import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

const DEFAULT_SOURCES = [
  "Salary",
  "Rent Income",
  "Business Income",
  "Freelance Income",
  "Other Income",
];

const DEFAULT_EXPENSES = [
  "Groceries",
  "Rent / Housing",
  "Utilities",
  "Medical / Healthcare",
  "Food & Dining",
  "Shopping (Clothing & Fashion)",
  "Entertainment",
  "EMI / Loan Payments",
  "Insurance",
  "Travel",
  "Education",
  "Miscellaneous",
];

function keyFor(type, name) {
  return `${type}:${name}`;
}

export function SetupPage() {
  const nav = useNavigate();
  const [selected, setSelected] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const initial = useMemo(() => {
    const s = new Set();
    for (const n of DEFAULT_SOURCES) s.add(keyFor("source", n));
    for (const n of DEFAULT_EXPENSES) s.add(keyFor("expense", n));
    return s;
  }, []);

  useEffect(() => {
    // preselect defaults
    setSelected(new Set(initial));
  }, [initial]);

  async function ensureYouEntity() {
    try {
      await api.createEntity({ name: "You", type: "person" });
    } catch (e) {
      if (e?.status !== 409) throw e;
    }
  }

  async function onContinue({ skip = false } = {}) {
    setBusy(true);
    setError("");
    try {
      await ensureYouEntity();

      if (!skip) {
        const items = Array.from(selected).map((k) => {
          const [type, name] = k.split(":");
          return { type, name };
        });
        for (const it of items) {
          try {
            await api.createEntity({ name: it.name, type: it.type });
          } catch (e) {
            if (e?.status !== 409) throw e;
          }
        }
      }

      localStorage.setItem("ft_setup_done", "1");
      nav("/", { replace: true });
    } catch (e) {
      setError(e?.message || "Setup failed");
    } finally {
      setBusy(false);
    }
  }

  function toggle(type, name) {
    const k = keyFor(type, name);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }

  return (
    <div className="col">
      <div className="card cardPad">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 18 }}>First launch setup</div>
            <div className="muted" style={{ marginTop: 6 }}>
              Pick a few defaults. You can add more later.
            </div>
          </div>
          <span className="pill">{selected.size} selected</span>
        </div>

        {error ? (
          <div className="pill" style={{ marginTop: 10, borderColor: "rgba(255,92,122,0.35)", color: "var(--danger)" }}>
            {error}
          </div>
        ) : null}
      </div>

      <div className="card cardPad">
        <div className="sectionTitle">
          <h2>Income Sources</h2>
          <span className="muted">Select what you use</span>
        </div>
        <div className="list">
          {DEFAULT_SOURCES.map((name) => {
            const k = keyFor("source", name);
            const on = selected.has(k);
            return (
              <button
                key={k}
                className="listItem"
                onClick={() => toggle("source", name)}
                style={{ cursor: "pointer", textAlign: "left" }}
              >
                <div className="row" style={{ gap: 12 }}>
                  <div
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 6,
                      border: "1px solid var(--border)",
                      background: on ? "var(--accent)" : "transparent",
                    }}
                  />
                  <div className="listItemTitle">{name}</div>
                </div>
                <span className="muted">{on ? "Selected" : "Tap to select"}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="card cardPad">
        <div className="sectionTitle">
          <h2>Expenses</h2>
          <span className="muted">Essentials + lifestyle</span>
        </div>
        <div className="list">
          {DEFAULT_EXPENSES.map((name) => {
            const k = keyFor("expense", name);
            const on = selected.has(k);
            return (
              <button
                key={k}
                className="listItem"
                onClick={() => toggle("expense", name)}
                style={{ cursor: "pointer", textAlign: "left" }}
              >
                <div className="row" style={{ gap: 12 }}>
                  <div
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 6,
                      border: "1px solid var(--border)",
                      background: on ? "var(--accent)" : "transparent",
                    }}
                  />
                  <div className="listItemTitle">{name}</div>
                </div>
                <span className="muted">{on ? "Selected" : "Tap to select"}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="row" style={{ justifyContent: "space-between" }}>
        <button className="btn btnGhost" disabled={busy} onClick={() => onContinue({ skip: true })}>
          Skip setup
        </button>
        <button className="btn btnPrimary" disabled={busy} onClick={() => onContinue({ skip: false })}>
          {busy ? "Creating..." : "Continue"}
        </button>
      </div>
    </div>
  );
}

