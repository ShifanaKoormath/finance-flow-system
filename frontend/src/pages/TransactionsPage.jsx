import { useEffect, useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import { formatINR } from "../utils";

export function TransactionsPage() {
  const nav = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      try {
        const txs = await api.listTransactions();
        if (alive) setTransactions(txs);
      } catch (e) {
        if (alive) setError(e?.message || "Failed to load transactions");
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => { alive = false; };
  }, []);

  if (loading) {
    return <div className="card cardPad"><div className="muted">Loading transactions...</div></div>;
  }

  return (
    <div className="col">
      <div className="card cardPad">
        <div style={{ fontWeight: 900, fontSize: 20 }}>Transaction History</div>
        {error && <div className="pill" style={{ marginTop: 10, color: "var(--danger)" }}>{error}</div>}
      </div>

      <div className="card cardPad">
        {transactions.length === 0 ? (
          <div className="col" style={{ alignItems: "center", padding: "40px 20px", textAlign: "center" }}>
            <h2 style={{ fontSize: 18, margin: "0 0 8px", color: "var(--text)" }}>No transactions yet</h2>
            <p className="muted" style={{ margin: 0, fontSize: 14 }}>Your transaction history will appear here.</p>
          </div>
        ) : (
          <div className="list">
            {transactions.map(t => {
              const d = new Date(t.date || t.createdAt);
              const displayDate = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
              const isIncome = t.type === "income";

              let contextName = t.from?.name || "Unknown";
              if (!isIncome) {
                contextName = t.to?.name || "Unknown";
              }

              return (
                <button
                  key={t._id}
                  className="listItem"
                  onClick={() => nav(`/edit/${t._id}`)}
                  style={{ textAlign: "left", cursor: "pointer", border: "none", borderBottom: "1px solid var(--border)", borderRadius: 0 }}
                >
                  <div>
                    <div className="listItemTitle" style={{ fontWeight: 600 }}>{contextName}</div>
                    <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                      {displayDate} {t.title ? `• ${t.title}` : ""}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 900, fontSize: 16, color: isIncome ? "var(--ok)" : "var(--danger)" }}>
                      {isIncome ? "+" : "-"}{formatINR(t.amount)}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
