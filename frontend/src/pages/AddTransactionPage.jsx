import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { formatINR, safeTrim } from "../utils";

function buildTitle({ kind, amount, otherName }) {
  if (!otherName) return "";
  if (kind === "gave") return `Paid ${formatINR(amount)} to ${otherName}`;
  return `Received ${formatINR(amount)} from ${otherName}`;
}

function formatMonthStr(p) {
  if (!p) return "";
  const [y, m] = p.split("-");
  const d = new Date(y, m - 1);
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function bumpUsage(entityId) {
  try {
    const raw = localStorage.getItem("ft_entity_usage") || "{}";
    const obj = JSON.parse(raw);
    obj[entityId] = (obj[entityId] || 0) + 1;
    localStorage.setItem("ft_entity_usage", JSON.stringify(obj));
  } catch {
    // ignore
  }
}

export function AddTransactionPage() {
  const nav = useNavigate();
  const loc = useLocation();
  const searchParams = new URLSearchParams(loc.search);
  const preselectedEntityId = searchParams.get("entityId");
  const preselectedType = searchParams.get("type");

  const initialKind = preselectedType === "income" ? "received" : (preselectedType === "expense" ? "gave" : null);

  const [step, setStep] = useState(preselectedEntityId && initialKind ? 3 : 1);
  const [kind, setKind] = useState(initialKind); // "gave" | "received"
  const [entities, setEntities] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [selectedEntityId, setSelectedEntityId] = useState(preselectedEntityId || "");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [linking, setLinking] = useState({ mode: "none", id: "" }); // {mode:"none"|"sourceTx"|"sourceEntity", id}
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const { txId } = useParams();
  const [editingLoaded, setEditingLoaded] = useState(false);

  const [cycles, setCycles] = useState([]);
  const [selectedCycleId, setSelectedCycleId] = useState("");

  const you = useMemo(() => entities.find((e) => e.type === "person" && e.name === "You"), [entities]);
  const selectedEntity = useMemo(() => entities.find((e) => String(e._id) === String(selectedEntityId)), [entities, selectedEntityId]);

  useEffect(() => {
    if (txId && transactions.length > 0 && !editingLoaded) {
      const tx = transactions.find(t => String(t._id) === txId);
      if (tx) {
        const isIncome = tx.type === "income";
        const youId = you ? String(you._id) : "";

        let otherEntityId = "";
        let k = "";

        if (isIncome) {
          k = "received";
          otherEntityId = String(tx.from?._id || tx.from);
        } else {
          k = "gave";
          otherEntityId = String(tx.to?._id || tx.to);
        }

        setKind(k);
        setSelectedEntityId(otherEntityId);
        setAmount(String(tx.amount));
        if (tx.date) setDate(new Date(tx.date).toISOString().substring(0, 10));
        setTitle(tx.title || "");
        setNote(tx.note || "");

        if (tx.sourceTransactionId) setLinking({ mode: "sourceTx", id: String(tx.sourceTransactionId) });
        else if (tx.sourceEntityId) setLinking({ mode: "sourceEntity", id: String(tx.sourceEntityId) });

        if (tx.cycleId) setSelectedCycleId(String(tx.cycleId));

        setStep(3); // Jump to amount input manually
      }
      setEditingLoaded(true);
    }
  }, [txId, transactions, editingLoaded, you]);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const [ents, txs] = await Promise.all([api.listEntities(), api.listTransactions()]);
        if (!alive) return;
        setEntities(ents);
        setTransactions(txs);
      } catch (e) {
        if (!alive) return;
        setError(e?.message || "Failed to load");
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, []);

  const recentEntities = useMemo(() => {
    const seen = new Set();
    const out = [];
    for (const tx of transactions) {
      const fromId = String(tx.from?._id || tx.from);
      const toId = String(tx.to?._id || tx.to);
      const candidateIds = [fromId, toId].filter((id) => you && id !== String(you._id));
      for (const id of candidateIds) {
        if (!seen.has(id)) {
          seen.add(id);
          const ent = entities.find((e) => String(e._id) === id);
          if (ent && ent.name !== "You") out.push(ent);
        }
      }
      if (out.length >= 6) break;
    }
    return out;
  }, [transactions, entities, you]);

  const frequentEntities = useMemo(() => {
    let usage = {};
    try {
      usage = JSON.parse(localStorage.getItem("ft_entity_usage") || "{}");
    } catch {
      usage = {};
    }
    const pairs = Object.entries(usage)
      .map(([id, count]) => ({ id, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
    return pairs
      .map((p) => entities.find((e) => String(e._id) === String(p.id)))
      .filter(Boolean);
  }, [entities]);

  const specificSourceTxs = useMemo(() => {
    // "Specific transactions" = transactions where from is a source entity
    const sourceIds = new Set(entities.filter((e) => e.type === "source").map((e) => String(e._id)));
    return transactions
      .filter((t) => sourceIds.has(String(t.from?._id || t.from)))
      .slice(0, 12);
  }, [entities, transactions]);

  const sourceEntities = useMemo(() => entities.filter((e) => e.type === "source"), [entities]);

  const activeSourceIdForCycle = useMemo(() => {
    if (kind === "received" && selectedEntity?.type === "source" && selectedEntity?.mode === "recurring") {
      return selectedEntityId;
    }
    if (linking.mode === "sourceEntity") {
      const s = sourceEntities.find(s => String(s._id) === linking.id);
      if (s && s.mode === "recurring") return linking.id;
    }
    return null;
  }, [kind, selectedEntity, selectedEntityId, linking, sourceEntities]);

  useEffect(() => {
    let alive = true;
    if (activeSourceIdForCycle) {
      api.listCycles(activeSourceIdForCycle).then(res => {
        if (alive) setCycles(res);
      }).catch(() => { });
    } else {
      setCycles([]);
      setSelectedCycleId("");
    }
    return () => { alive = false; }
  }, [activeSourceIdForCycle]);

  async function create() {
    setBusy(true);
    setError("");
    try {
      if (!you) throw new Error('Missing "You" entity. Go to Setup.');
      if (!kind) throw new Error("Choose gave/received");
      if (!selectedEntityId) throw new Error("Choose an entity");
      const amt = Number(amount);
      if (!Number.isFinite(amt) || amt <= 0) throw new Error("Enter a valid amount");

      if (activeSourceIdForCycle && !selectedCycleId) {
        throw new Error("Please select a cycle for this recurring source.");
      }

      const from = kind === "gave" ? you._id : selectedEntityId;
      const to = kind === "gave" ? selectedEntityId : you._id;
      const finalTitle = safeTrim(title) || buildTitle({ kind, amount: amt, otherName: selectedEntity?.name });

      const payload = {
        amount: amt,
        from,
        to,
        date: date || undefined,
        title: finalTitle || undefined,
        note: safeTrim(note) || undefined,
        type: kind === "received" ? "income" : "expense"
      };

      if (selectedCycleId) payload.cycleId = selectedCycleId;

      if (linking.mode === "sourceTx" && linking.id) payload.sourceTransactionId = linking.id;
      if (linking.mode === "sourceEntity" && linking.id) payload.sourceEntityId = linking.id;

      if (txId) {
        await api.editTransaction(txId, payload);
      } else {
        await api.createTransaction(payload);
        bumpUsage(selectedEntityId);
      }
      nav(-1, { replace: true, state: { celebrated: true } });
    } catch (e) {
      setError(e?.message || "Failed to create");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="col">
      <div className="card cardPad">
        <div style={{ fontWeight: 900, fontSize: 18 }}>{txId ? "Edit transaction" : "Add transaction"}</div>
        <div className="muted" style={{ marginTop: 6 }}>
          Keep it simple: you gave / you received.
        </div>
        {error ? (
          <div className="pill" style={{ marginTop: 10, borderColor: "rgba(255,92,122,0.35)", color: "var(--danger)" }}>
            {error}
          </div>
        ) : null}
      </div>

      {step === 1 ? (
        <div className="card cardPad">
          <div className="sectionTitle">
            <h2>Step 1</h2>
            <span className="muted">Choose direction</span>
          </div>
          <div className="row">
            <button className={`btn ${kind === "gave" ? "btnPrimary" : ""}`} onClick={() => { setKind("gave"); setStep(selectedEntityId && !txId ? 3 : 2); }}>
              Money You Gave
            </button>
            <button className={`btn ${kind === "received" ? "btnPrimary" : ""}`} onClick={() => { setKind("received"); setStep(selectedEntityId && !txId ? 3 : 2); }}>
              Money You Received
            </button>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="card cardPad">
          <div className="sectionTitle">
            <h2>Step 2</h2>
            <span className="muted">Pick entity</span>
          </div>

          {frequentEntities.length ? (
            <>
              <div className="muted" style={{ fontSize: 12, margin: "6px 0" }}>Most used</div>
              <div className="list">
                {frequentEntities.map((e) => (
                  <button
                    key={e._id}
                    className="listItem"
                    onClick={() => { setSelectedEntityId(String(e._id)); setStep(3); }}
                    style={{ cursor: "pointer", textAlign: "left" }}
                  >
                    <div className="listItemTitle">{e.name}</div>
                    <span className="muted">{e.type}</span>
                  </button>
                ))}
              </div>
              <div style={{ height: 10 }} />
            </>
          ) : null}

          {recentEntities.length ? (
            <>
              <div className="muted" style={{ fontSize: 12, margin: "6px 0" }}>Recently used</div>
              <div className="list">
                {recentEntities.map((e) => (
                  <button
                    key={e._id}
                    className="listItem"
                    onClick={() => { setSelectedEntityId(String(e._id)); setStep(3); }}
                    style={{ cursor: "pointer", textAlign: "left" }}
                  >
                    <div className="listItemTitle">{e.name}</div>
                    <span className="muted">{e.type}</span>
                  </button>
                ))}
              </div>
              <div style={{ height: 10 }} />
            </>
          ) : null}

          <div className="muted" style={{ fontSize: 12, margin: "6px 0" }}>All entities</div>
          <input
            className="input"
            placeholder="Search entities..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ marginBottom: 12 }}
          />
          <div className="list">
            {(() => {
              const filtered = entities
                .filter((e) => e.name !== "You")
                .filter((e) => e.name.toLowerCase().includes(searchQuery.toLowerCase().trim()))
                .sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));

              if (filtered.length === 0) {
                return (
                  <button className="listItem" onClick={() => nav("/add-entity?returnTo=/add")} style={{ cursor: "pointer", justifyContent: "center" }}>
                    <div style={{ color: "var(--primary)", fontWeight: 800 }}>+ Add new</div>
                  </button>
                );
              }

              return filtered.map((e) => (
                <button
                  key={e._id}
                  className="listItem"
                  onClick={() => { setSelectedEntityId(String(e._id)); setStep(3); }}
                  style={{ cursor: "pointer", textAlign: "left" }}
                >
                  <div className="listItemTitle">{e.name}</div>
                  <span className="muted">{e.type}</span>
                </button>
              ));
            })()}
          </div>

          <div className="row" style={{ justifyContent: "space-between", marginTop: 12 }}>
            <button className="btn btnGhost" onClick={() => setStep(1)}>Back</button>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="card cardPad">
          <div className="sectionTitle">
            <h2>Step 3</h2>
            <span className="muted">Enter amount</span>
          </div>
          <div className="pill" style={{ marginBottom: 10 }}>
            {kind === "gave" ? "You gave" : "You received"} → <b style={{ color: "var(--text)" }}>{selectedEntity?.name}</b>
          </div>
          <input
            className="input"
            inputMode="numeric"
            placeholder="Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <div style={{ height: 12 }} />
          <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>Date</div>
          <input
            className="input"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />

          {kind === "received" && activeSourceIdForCycle && (
            <div style={{ marginTop: 12 }}>
              <div className="muted" style={{ fontSize: 12, marginBottom: 4, color: "var(--primary)" }}>Select Month (Required)</div>
              <select className="input" style={{ padding: 10 }} value={selectedCycleId} onChange={e => setSelectedCycleId(e.target.value)}>
                <option value="">-- Choose a Month --</option>
                {cycles.map(c => (
                  <option key={c._id} value={c._id}>{formatMonthStr(c.period)} (Expected: {formatINR(c.expectedAmount)})</option>
                ))}
              </select>
            </div>
          )}

          <div className="row" style={{ justifyContent: "space-between", marginTop: 12 }}>
            <button className="btn btnGhost" onClick={() => setStep(preselectedEntityId ? 1 : 2)}>Back</button>
            <button className="btn btnPrimary" onClick={() => setStep(4)} disabled={!amount}>Next</button>
          </div>
        </div>
      ) : null}

      {step === 4 ? (
        <div className="card cardPad">
          <div className="sectionTitle">
            <h2>Optional</h2>
            <span className="muted">What was this for?</span>
          </div>
          <input className="input" placeholder="Title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} />
          <div style={{ height: 8 }} />
          <input className="input" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />

          <div style={{ height: 14 }} />

          {/* Source linking UI totally separated */}
          <div className="sectionTitle" style={{ marginTop: 24 }}>
            <h2>Link to Source (Optional)</h2>
          </div>

          <div className="card cardPad" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)", marginBottom: 12 }}>
            <div className="muted" style={{ fontSize: 13, marginBottom: 8, fontWeight: 700 }}>Link Specific Transaction</div>
            <div className="muted" style={{ fontSize: 12, marginBottom: 10 }}>Links this expense to a specific receipt from a source.</div>
            {specificSourceTxs.length ? (
              <div className="list">
                {specificSourceTxs.map((t) => {
                  const d = new Date(t.date || t.createdAt);
                  const displayDate = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                  return (
                    <button
                      key={t._id}
                      className="listItem"
                      onClick={() => setLinking({ mode: "sourceTx", id: String(t._id) })}
                      style={{
                        cursor: "pointer",
                        textAlign: "left",
                        borderColor: linking.mode === "sourceTx" && linking.id === String(t._id) ? "rgba(124, 92, 255, 0.65)" : undefined,
                        background: linking.mode === "sourceTx" && linking.id === String(t._id) ? "rgba(124, 92, 255, 0.1)" : undefined,
                      }}
                    >
                      <div>
                        <div className="listItemTitle">{formatINR(t.amount)}</div>
                        <div className="muted" style={{ fontSize: 12 }}>
                          {displayDate} • {t.title || (t.from?.name ? `From ${t.from.name}` : "Source receipt")}
                        </div>
                      </div>
                      <span className="muted">link</span>
                    </button>
                  );
                })}
              </div>
            ) : <div className="muted" style={{ fontSize: 12 }}>No recent source transactions available.</div>}
          </div>

          <div className="card cardPad" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)" }}>
            <div className="muted" style={{ fontSize: 13, marginBottom: 8, fontWeight: 700 }}>Link General Source</div>
            <div className="muted" style={{ fontSize: 12, marginBottom: 10 }}>Links this expense generally to a source entity.</div>
            {sourceEntities.length ? (
              <div className="list">
                {sourceEntities.map((s) => (
                  <button
                    key={s._id}
                    className="listItem"
                    onClick={() => setLinking({ mode: "sourceEntity", id: String(s._id) })}
                    style={{
                      cursor: "pointer",
                      textAlign: "left",
                      borderColor: linking.mode === "sourceEntity" && linking.id === String(s._id) ? "rgba(124, 92, 255, 0.65)" : undefined,
                      background: linking.mode === "sourceEntity" && linking.id === String(s._id) ? "rgba(124, 92, 255, 0.1)" : undefined,
                    }}
                  >
                    <div className="listItemTitle">{s.name}</div>
                    <span className="muted">{s.mode === "recurring" ? "recurring" : "link"}</span>
                  </button>
                ))}
              </div>
            ) : <div className="muted" style={{ fontSize: 12 }}>No sources available.</div>}

            {linking.mode === "sourceEntity" && activeSourceIdForCycle && (
              <div style={{ marginTop: 12, padding: 8, background: "rgba(0,0,0,0.02)", borderRadius: 6 }}>
                <div className="muted" style={{ fontSize: 12, marginBottom: 4, color: "var(--primary)" }}>Select Month (Required)</div>
                <select className="input" style={{ padding: 10, background: "var(--bg)" }} value={selectedCycleId} onChange={e => setSelectedCycleId(e.target.value)}>
                  <option value="">-- Choose a Month --</option>
                  {cycles.map(c => (
                    <option key={c._id} value={c._id}>{formatMonthStr(c.period)} (Remaining Income: {formatINR(c.remainingAmount)})</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {linking.mode !== "none" && (
            <div style={{ marginTop: 12, textAlign: "right" }}>
              <button className="btn btnGhost" onClick={() => setLinking({ mode: "none", id: "" })}>Clear Selection</button>
            </div>
          )}

          <div className="row" style={{ justifyContent: "space-between", marginTop: 12 }}>
            <button className="btn btnGhost" onClick={() => setStep(3)}>Back</button>
            <button className="btn btnPrimary" disabled={busy} onClick={create}>
              {busy ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

