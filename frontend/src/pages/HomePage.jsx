import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { formatINR } from "../utils";

function totalsForPeople(ungrouped, groups) {
  let youOwe = 0;
  let youReceive = 0;

  const processItems = (items) => {
    for (const b of items) {
      if (b.type !== "person") continue;
      if (b.name === "You") continue;
      const bal = b.balance ?? b.value ?? b.totalValue;
      if (bal < 0) youOwe += Math.abs(bal);
      if (bal > 0) youReceive += bal;
    }
  };

  processItems(ungrouped);
  if (groups) processItems(groups);

  return { youOwe, youReceive };
}

export function HomePage() {
  const nav = useNavigate();
  const [loading, setLoading] = useState(true);

  const [data, setData] = useState({ groups: [], ungrouped: [] });
  const [transactions, setTransactions] = useState([]);
  const [entities, setEntities] = useState([]);

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      try {
        const [balData, txs, ents] = await Promise.all([
          api.balances(),
          api.listTransactions(),
          api.listEntities()
        ]);
        if (!alive) return;

        setData({
          groups: balData.groups || [],
          ungrouped: balData.ungrouped || []
        });
        setTransactions(txs);
        setEntities(ents);
      } catch (e) {
        // ignore for now to keep home screen fast, we can add a small error indicator if needed
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => { alive = false; };
  }, []);

  const totals = useMemo(() => totalsForPeople(data.ungrouped, data.groups), [data]);
  const netBalance = totals.youReceive - totals.youOwe;

  // Smart Insight Calculation
  const insight = useMemo(() => {
    if (!transactions.length) return "Welcome to FlowLedger";
    const today = new Date().toISOString().substring(0, 10);
    const spentToday = transactions
      .filter(t => t.type === "expense" && (t.date || t.createdAt).substring(0, 10) === today)
      .reduce((sum, t) => sum + Number(t.amount), 0);

    if (spentToday > 0) return `You spent ${formatINR(spentToday)} today`;

    const receivedToday = transactions
      .filter(t => t.type === "income" && (t.date || t.createdAt).substring(0, 10) === today)
      .reduce((sum, t) => sum + Number(t.amount), 0);

    if (receivedToday > 0) return `You received ${formatINR(receivedToday)} today`;

    if (netBalance > 0) return `You're ${formatINR(netBalance)} ahead overall`;
    if (netBalance < 0) return `You're down ${formatINR(Math.abs(netBalance))} overall`;

    return "You're all settled up";
  }, [transactions, netBalance]);

  // Recent 4 Transactions
  const recentTxs = useMemo(() => transactions.slice(0, 4), [transactions]);

  // Frequent / Quick Access Entities
  const frequentEntities = useMemo(() => {
    let usage = {};
    try {
      usage = JSON.parse(localStorage.getItem("ft_entity_usage") || "{}");
    } catch { usage = {}; }

    // Sort entities by usage score
    const pairs = Object.entries(usage)
      .map(([id, count]) => ({ id, count }))
      .sort((a, b) => b.count - a.count);

    let top = pairs
      .map(p => entities.find(e => String(e._id) === String(p.id) && e.name !== "You"))
      .filter(Boolean);

    // If no usage, just pick recent from transactions
    if (top.length === 0) {
      const seen = new Set();
      for (const tx of transactions) {
        const otherId = String(tx.type === "income" ? (tx.from?._id || tx.from) : (tx.to?._id || tx.to));
        if (!seen.has(otherId)) {
          seen.add(otherId);
          const ent = entities.find(e => String(e._id) === otherId && e.name !== "You");
          if (ent) top.push(ent);
        }
      }
    }

    // Fill up with some default expenses if still empty
    if (top.length < 3) {
      const expenses = entities.filter(e => e.type === "expense" && !top.includes(e));
      top = [...top, ...expenses.slice(0, 5 - top.length)];
    }

    return top.slice(0, 6);
  }, [entities, transactions]);

  // Check if completely empty account
  const isCompletelyEmpty = transactions.length === 0 && entities.length <= 1;

  return (
    <div className="col" style={{ paddingBottom: 16 }}>
      {/* Search Header */}
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ fontWeight: 800, fontSize: 13, color: "var(--accent)" }}>
          {insight}
        </div>
        <button className="btnGhost" style={{ padding: "4px 8px", fontSize: 18, color: "var(--text)" }} aria-label="Search">
          🔍
        </button>
      </div>

      {isCompletelyEmpty && !loading ? (
        <div className="emptyState" style={{ marginTop: 20 }}>
          <div style={{ fontSize: 40 }}>💰</div>
          <h2 style={{ fontSize: 20, margin: 0 }}>Welcome to FlowLedger</h2>
          <p className="muted" style={{ margin: 0, fontSize: 14 }}>Track who you owe, who owes you, and where your money goes.</p>
          <button className="btn btnPrimary" style={{ marginTop: 12, width: "100%" }} onClick={() => nav("/add")}>
            Add your first transaction
          </button>
        </div>
      ) : (
        <>
          {/* Summary Card */}
          <div className="card cardPad" style={{ padding: "20px 16px", background: "linear-gradient(to bottom right, var(--panel), #faf5ff)" }}>
            <div className="muted" style={{ fontSize: 12, fontWeight: 600 }}>Net Balance</div>
            <div style={{ fontWeight: 900, fontSize: 32, margin: "4px 0 12px", color: netBalance < 0 ? "var(--danger)" : netBalance > 0 ? "var(--ok)" : "var(--text)" }}>
              {netBalance < 0 ? "-" : (netBalance > 0 ? "+" : "")}{formatINR(Math.abs(netBalance))}
            </div>

            <div className="row" style={{ gap: 16, borderTop: "1px solid rgba(0,0,0,0.05)", paddingTop: 12 }}>
              <div style={{ flex: 1 }}>
                <div className="muted" style={{ fontSize: 11 }}>You owe</div>
                <div style={{ fontWeight: 700, fontSize: 14, color: totals.youOwe > 0 ? "var(--danger)" : "var(--text)" }}>{formatINR(totals.youOwe)}</div>
              </div>
              <div style={{ width: 1, height: 24, background: "rgba(0,0,0,0.05)" }} />
              <div style={{ flex: 1 }}>
                <div className="muted" style={{ fontSize: 11 }}>You'll get</div>
                <div style={{ fontWeight: 700, fontSize: 14, color: totals.youReceive > 0 ? "var(--ok)" : "var(--text)" }}>{formatINR(totals.youReceive)}</div>
              </div>
            </div>
          </div>

          {/* Quick Access List */}
          {frequentEntities.length > 0 && (
            <div style={{ marginBottom: 8, marginTop: 4 }}>
              <div className="muted" style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, paddingLeft: 4 }}>Quick Actions</div>
              <div className="horizontalScrollList">
                {frequentEntities.map(e => {
                  const icon = e.type === "expense" ? "🛍️" : e.type === "source" ? "💸" : "👤";
                  return (
                    <div key={e._id} className="quickAccessItem" onClick={() => nav(`/add?entityId=${e._id}`)}>
                      <div style={{ fontSize: 24 }}>{icon}</div>
                      <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", width: "100%" }}>
                        {e.name}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recent Transactions */}
          {recentTxs.length > 0 && (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="row sectionTitle" style={{ padding: "16px 16px 8px", margin: 0 }}>
                <h2 style={{ fontSize: 14, fontWeight: 700 }}>Recent</h2>
                <button className="btnGhost muted" style={{ fontSize: 12, padding: 0 }} onClick={() => nav('/transactions')}>See all</button>
              </div>
              <div className="list" style={{ padding: "0 8px 12px" }}>
                {recentTxs.map(t => {
                  const isIncome = t.type === "income";
                  const otherName = isIncome ? (t.from?.name || "Income") : (t.to?.name || "Expense");
                  const d = new Date(t.date || t.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });

                  return (
                    <div key={t._id} className="listItem" onClick={() => nav(`/edit/${t._id}`)} style={{ border: "none", background: "transparent", padding: "10px 8px" }}>
                      <div className="row">
                        <div style={{ width: 36, height: 36, borderRadius: 18, background: isIncome ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>
                          {isIncome ? "↓" : "↑"}
                        </div>
                        <div>
                          <div className="listItemTitle">{otherName}</div>
                          <div className="muted" style={{ fontSize: 12 }}>{d} {t.title ? `• ${t.title}` : ""}</div>
                        </div>
                      </div>
                      <div style={{ fontWeight: 800, fontSize: 15, color: isIncome ? "var(--ok)" : "var(--text)" }}>
                        {isIncome ? "+" : "-"}{formatINR(t.amount)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
