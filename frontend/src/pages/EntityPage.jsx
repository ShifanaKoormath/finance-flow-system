import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { formatINR, isoMonth } from "../utils";

function byDateDesc(a, b) {
  return new Date(b.date).getTime() - new Date(a.date).getTime();
}

function sum(list) {
  return list.reduce((s, x) => s + (Number(x.amount) || 0), 0);
}

function formatMonthStr(p) {
  if (!p) return "";
  const [y, m] = p.split("-");
  const d = new Date(y, m - 1);
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function EntityPage() {
  const { entityId } = useParams();
  const nav = useNavigate();
  const [entities, setEntities] = useState([]);
  const [balances, setBalances] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [usageBySourceTx, setUsageBySourceTx] = useState({}); // txId -> usage[]
  const [sourceSummary, setSourceSummary] = useState(null);
  const [cycles, setCycles] = useState([]);
  const [busyQuick, setBusyQuick] = useState(false);
  const [error, setError] = useState("");

  const [groups, setGroups] = useState([]);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [isSubmittingGroup, setIsSubmittingGroup] = useState(false);

  useEffect(() => {
    let alive = true;
    async function load() {
      setError("");
      try {
        const [ents, bals, txs, grps] = await Promise.all([api.listEntities(), api.balances(), api.listTransactions(), api.listGroups()]);
        if (!alive) return;
        setEntities(ents);
        
        let flatBalances = [];
        if (bals.groups) bals.groups.forEach(g => flatBalances.push(...g.children));
        if (bals.ungrouped) flatBalances.push(...bals.ungrouped);
        setBalances(flatBalances);

        setTransactions(txs);
        setGroups(grps);
      } catch (e) {
        if (!alive) return;
        setError(e?.message || "Failed to load");
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, [entityId]);

  const entity = useMemo(() => entities.find((e) => String(e._id) === String(entityId)), [entities, entityId]);
  const you = useMemo(() => entities.find((e) => e.type === "person" && e.name === "You"), [entities]);
  const balanceRow = useMemo(
    () => balances.find((b) => String(b.id || b.entityId) === String(entityId)),
    [balances, entityId]
  );

  const related = useMemo(() => {
    if (!you) return [];
    const youId = String(you._id);
    return transactions
      .filter((t) => {
        const fromId = String(t.from?._id || t.from);
        const toId = String(t.to?._id || t.to);
        return (fromId === youId && toId === String(entityId)) || (toId === youId && fromId === String(entityId));
      })
      .sort(byDateDesc);
  }, [transactions, you, entityId]);

  const gave = useMemo(() => {
    if (!you) return [];
    const youId = String(you._id);
    return related.filter((t) => String(t.from?._id || t.from) === youId);
  }, [related, you]);

  const received = useMemo(() => {
    if (!you) return [];
    const youId = String(you._id);
    return related.filter((t) => String(t.to?._id || t.to) === youId);
  }, [related, you]);

  useEffect(() => {
    let alive = true;
    async function loadSourceSummary() {
      if (!entity || entity.type !== "source") return;
      try {
        const s = await api.sourceSummary(entityId);
        if (!alive) return;
        setSourceSummary(s);

        if (entity.mode === "recurring") {
          const c = await api.listCycles(entityId);
          if (alive) setCycles(c);
        }
      } catch (e) {
        if (!alive) return;
        setError(e?.message || "Failed to load source summary");
      }
    }
    loadSourceSummary();
    return () => {
      alive = false;
    };
  }, [entity, entityId]);

  const projectStats = useMemo(() => {
    if (entity?.type === "source" && entity.mode === "project" && sourceSummary) {
      const totalAmount = entity.projectConfig?.totalAmount || entity.totalAmount || 0;
      const totalReceived = sourceSummary.totalReceived || 0;
      let status = "not started";
      const now = new Date();
      const deadline = entity.projectConfig?.deadline || entity.deadline;

      if (totalReceived > 0) status = "in progress";
      if (totalAmount > 0 && totalReceived >= totalAmount) status = "completed";
      else if (status !== "completed" && deadline && new Date(deadline) < now) status = "overdue";

      return { totalAmount, totalReceived, status };
    }
    return null;
  }, [entity, sourceSummary]);

  const [expandedUsage, setExpandedUsage] = useState({}); // txId + entityId -> bool

  function toggleExpandUsage(txId, entityId) {
    const key = `${txId}_${entityId}`;
    setExpandedUsage(p => ({ ...p, [key]: !p[key] }));
  }

  async function expandUsage(txId) {
    if (usageBySourceTx[txId]) {
      setUsageBySourceTx((p) => {
        const n = { ...p };
        delete n[txId];
        return n;
      });
      return;
    }
    try {
      const data = await api.transactionUsage(txId);
      setUsageBySourceTx((p) => ({ ...p, [txId]: data }));
    } catch (e) {
      setError(e?.message || "Failed to load usage");
    }
  }

  const sourceReceipts = useMemo(() => {
    if (!entity || entity.type !== "source") return [];
    return transactions
      .filter((t) => String(t.from?._id || t.from) === String(entityId))
      .sort(byDateDesc);
  }, [entity, transactions, entityId]);

  async function handleCreateCycle() {
    const period = prompt("Enter month period (YYYY-MM):", new Date().toISOString().slice(0, 7));
    if (!period || !/^\d{4}-\d{2}$/.test(period)) return;
    try {
      const expectedAmount = entity.recurringConfig?.expectedAmount || entity.expectedAmount || 0;
      const newCycle = await api.createCycle({ sourceId: entityId, period, expectedAmount });
      setCycles(prev => [newCycle, ...prev].sort((a,b) => b.period.localeCompare(a.period)));
    } catch (e) {
      alert(e.message || "Failed to create month cycle");
    }
  }

  const currentGroup = useMemo(() => entity?.groupId ? groups.find(g => g._id === entity.groupId) : null, [entity, groups]);

  if (!entity) {
    return (
      <div className="card cardPad">
        <div style={{ fontWeight: 900 }}>Entity not found</div>
        <div className="muted" style={{ marginTop: 8 }}>
          {error || "Try going back."}
        </div>
        <div style={{ marginTop: 12 }}>
          <button className="btn" onClick={() => nav("/")}>Back</button>
        </div>
      </div>
    );
  }

  const net = balanceRow?.balance ?? balanceRow?.value ?? 0;

  async function assignGroup(groupId) {
    try {
      setIsSubmittingGroup(true);
      await api.updateEntity(entityId, { groupId: groupId || null });
      setEntities(prev => prev.map(e => String(e._id) === String(entityId) ? { ...e, groupId: groupId || null } : e));
      setShowGroupModal(false);
    } catch (e) {
      alert("Failed to assign group");
    } finally {
      setIsSubmittingGroup(false);
    }
  }

  async function createAndAssignGroup() {
    try {
      setIsSubmittingGroup(true);
      const newGroup = await api.createGroup({ name: newGroupName, type: entity.type });
      setGroups(p => [...p, newGroup]);
      await api.updateEntity(entityId, { groupId: newGroup._id });
      setEntities(prev => prev.map(e => String(e._id) === String(entityId) ? { ...e, groupId: newGroup._id } : e));
      setNewGroupName("");
      setShowGroupModal(false);
    } catch (e) {
      alert("Failed to create/assign group");
    } finally {
      setIsSubmittingGroup(false);
    }
  }

  async function handleDeleteEntity() {
    if (!window.confirm("Are you sure you want to delete this entity?")) return;
    try {
      await api.deleteEntity(entityId);
      nav("/", { replace: true });
    } catch (e) {
      alert(e.message || "Failed to delete entity");
    }
  }

  async function handleDeleteTx(txId) {
    if (!window.confirm("Are you sure you want to delete this transaction?")) return;
    try {
      await api.deleteTransaction(txId);
      window.location.reload();
    } catch (e) {
      alert(e.message || "Failed to delete transaction");
    }
  }

  return (
    <div className="col">
      <div className="card cardPad">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 18 }}>{entity.name}</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{entity.type}</div>
            <div style={{ marginTop: 8, fontSize: 13, display: "flex", gap: 6, alignItems: "center" }}>
              <span className="muted">Group:</span> 
              <span style={{ fontWeight: 600 }}>{currentGroup ? currentGroup.name : "None"}</span>
              <button className="btnGhost" style={{ padding: "2px 6px", fontSize: 12, color: "var(--blue)", border: "none", cursor: "pointer", background: "none" }} onClick={() => setShowGroupModal(true)}>[Change]</button>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="muted" style={{ fontSize: 12 }}>Net balance</div>
            <div style={{ fontWeight: 900, fontSize: 20 }}>
              {formatINR(Math.abs(net))}
            </div>
            <div className="muted" style={{ fontSize: 12 }}>{net < 0 ? "you owe" : net > 0 ? "they owe you" : "settled"}</div>
          </div>
        </div>

        {error ? (
          <div className="pill" style={{ marginTop: 10, borderColor: "rgba(255,92,122,0.35)", color: "var(--danger)" }}>
            {error}
          </div>
        ) : null}

        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn btnPrimary" onClick={() => nav(`/add?entityId=${entityId}`)}>+ Add Transaction</button>
          <button className="btn btnGhost" style={{ color: "var(--danger)", padding: "8px 12px" }} onClick={handleDeleteEntity}>Delete Entity</button>
          <button className="btn btnGhost" onClick={() => nav("/")}>Back</button>
        </div>
      </div>

      {entity.type === "person" ? (
        <div className="card cardPad">
          <div className="sectionTitle">
            <h2>Summary</h2>
            <span className="muted">You ↔ {entity.name}</span>
          </div>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div>
              <div className="muted" style={{ fontSize: 12 }}>You gave</div>
              <div style={{ fontWeight: 900 }}>{formatINR(sum(gave))}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div className="muted" style={{ fontSize: 12 }}>You received</div>
              <div style={{ fontWeight: 900 }}>{formatINR(sum(received))}</div>
            </div>
          </div>
        </div>
      ) : null}

      {entity.type === "source" && sourceSummary ? (
        <div className="card cardPad">
          <div className="sectionTitle">
            <h2>Source summary</h2>
            <span className="muted">received → used → remaining</span>
          </div>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div>
              <div className="muted" style={{ fontSize: 12 }}>Total received</div>
              <div style={{ fontWeight: 900 }}>{formatINR(sourceSummary.totalReceived)}</div>
            </div>
            <div>
              <div className="muted" style={{ fontSize: 12 }}>Total used</div>
              <div style={{ fontWeight: 900 }}>{formatINR(sourceSummary.totalUsed)}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div className="muted" style={{ fontSize: 12 }}>Remaining</div>
              <div style={{ fontWeight: 900 }}>{formatINR(sourceSummary.remaining)}</div>
            </div>
          </div>

          <div style={{ height: 10 }} />
          <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Breakdown</div>
          {sourceSummary.breakdown?.length ? (
            <div className="list">
              {sourceSummary.breakdown.map((b) => (
                <div key={b.entityName} className="listItem">
                  <div className="listItemTitle">{b.entityName}</div>
                  <div style={{ fontWeight: 800 }}>{formatINR(b.totalAmount)}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="muted" style={{ padding: 10 }}>No usage linked yet.</div>
          )}
        </div>
      ) : null}

      {showGroupModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div className="card cardPad col" style={{ width: "100%", maxWidth: 400, border: "1px solid var(--border)" }}>
            <h3>Change Group</h3>
            <div className="list">
              <button 
                 className="listItem" 
                 onClick={() => assignGroup(null)}
                 style={{ border: entity.groupId ? "1px solid var(--border)" : "2px solid var(--accent)", background: "transparent" }}>
                <div>None</div>
              </button>
              {groups.filter(g => g.type === entity.type).map(g => (
                <button 
                   key={g._id} 
                   className="listItem" 
                   onClick={() => assignGroup(g._id)}
                   style={{ border: entity.groupId === g._id ? "2px solid var(--accent)" : "1px solid var(--border)", background: "transparent" }}>
                  <div>📁 {g.name}</div>
                </button>
              ))}
            </div>
            
            <div style={{ marginTop: 16, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
              <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>Or create new group</div>
              <div className="row">
                <input className="input" placeholder="New group name..." value={newGroupName} onChange={e=>setNewGroupName(e.target.value)} disabled={isSubmittingGroup}/>
                <button className="btn btnPrimary" disabled={isSubmittingGroup || !newGroupName.trim()} onClick={createAndAssignGroup}>Create</button>
              </div>
            </div>
            
            <button className="btn" style={{ marginTop: 16 }} onClick={() => setShowGroupModal(false)}>Cancel</button>
          </div>
        </div>
      )}

      {entity.type === "source" && entity.mode === "recurring" ? (
        <div className="card cardPad">
          <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
            <div>
              <div style={{ fontWeight: 900, fontSize: 18 }}>Months</div>
              <div className="muted" style={{ fontSize: 12 }}>monthly tracking</div>
            </div>
            <button className="btn btnGhost" style={{ padding: "4px 8px", fontSize: 12, color: "var(--primary)" }} onClick={handleCreateCycle}>
              + New Month
            </button>
          </div>
          {cycles.length ? (
            <div className="list">
              {cycles.map((c) => (
                <div key={c._id} className="listItem" style={{ alignItems: "flex-start" }}>
                  <div>
                    <div className="listItemTitle">{formatMonthStr(c.period)}</div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      Status: <span style={{ textTransform: "capitalize", fontWeight: c.status === "overdue" ? "bold" : "normal", color: c.status === "overdue" ? "var(--danger)" : "inherit" }}>{c.status}</span>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 900, color: "var(--primary)", fontSize: 16 }}>
                      Received: {formatINR(c.receivedAmount)}
                    </div>
                    <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                      Expected: {formatINR(c.expectedAmount || 0)} • Remaining: {formatINR(c.remaining || 0)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="muted" style={{ padding: 10 }}>No months yet.</div>
          )}
        </div>
      ) : null}

      {projectStats ? (
        <div className="card cardPad">
          <div className="sectionTitle">
            <h2>Project Goal Progress</h2>
            <span className="muted">Status: <span style={{ textTransform: "capitalize", fontWeight: projectStats.status === "overdue" ? "bold" : "normal", color: projectStats.status === "overdue" ? "var(--danger)" : "inherit" }}>{projectStats.status}</span></span>
          </div>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div>
              <div className="muted" style={{ fontSize: 12 }}>Received</div>
              <div style={{ fontWeight: 900, color: "var(--primary)" }}>{formatINR(projectStats.totalReceived)}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div className="muted" style={{ fontSize: 12 }}>Goal Total</div>
              <div style={{ fontWeight: 900 }}>{formatINR(projectStats.totalAmount)}</div>
            </div>
          </div>
          
          <div style={{ background: "rgba(0,0,0,0.1)", height: 8, borderRadius: 4, marginTop: 12, overflow: "hidden" }}>
             <div style={{ 
               background: "var(--primary)", 
               height: "100%", 
               width: `${Math.min(100, (projectStats.totalReceived / (projectStats.totalAmount || 1)) * 100)}%` 
             }} />
          </div>
        </div>
      ) : null}

      {entity.type === "source" ? (
        <div className="card cardPad">
          <div className="sectionTitle">
            <h2>Source transactions</h2>
            <span className="muted">tap to see usage</span>
          </div>
          {sourceReceipts.length ? (
            <div className="list">
              {sourceReceipts.map((t) => (
                <div key={t._id} className="listItem" style={{ display: "block" }}>
                  <button
                    className="btn btnGhost"
                    onClick={() => expandUsage(String(t._id))}
                    style={{ width: "100%", textAlign: "left" }}
                  >
                    <div className="row" style={{ justifyContent: "space-between" }}>
                      <div>
                        <div style={{ fontWeight: 900 }}>{formatINR(t.amount)}</div>
                        <div className="muted" style={{ fontSize: 12 }}>{t.title || new Date(t.date).toLocaleDateString()}</div>
                      </div>
                      <div className="muted" style={{ fontSize: 12 }}>
                        {usageBySourceTx[String(t._id)] ? "Hide usage" : "Show usage"}
                      </div>
                    </div>
                  </button>

                  {usageBySourceTx[String(t._id)] ? (
                    <div style={{ marginTop: 10 }}>
                      {usageBySourceTx[String(t._id)].length ? (
                        <div className="list">
                          {usageBySourceTx[String(t._id)].map((g) => {
                            const expanded = expandedUsage[`${t._id}_${g.entityId}`];
                            return (
                            <div key={g.entityId} className="col" style={{ gap: 0 }}>
                              <button 
                                className="listItem" 
                                style={{ width: "100%", textAlign: "left", cursor: "pointer", borderBottomLeftRadius: expanded ? 0 : 14, borderBottomRightRadius: expanded ? 0 : 14 }}
                                onClick={() => toggleExpandUsage(String(t._id), String(g.entityId))}
                              >
                                <div>
                                  <div className="listItemTitle">{g.entityName}</div>
                                  <div className="muted" style={{ fontSize: 12 }}>
                                    {g.transactions.length} tx {expanded ? "▲" : "▼"}
                                  </div>
                                </div>
                                <div style={{ fontWeight: 900 }}>{formatINR(g.totalAmount)}</div>
                              </button>
                              
                              {/* Level 3: Individual usage transactions */}
                              {expanded && (
                                <div className="col" style={{ padding: "8px 12px 12px 24px", background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)", borderTop: "none", borderBottomLeftRadius: 14, borderBottomRightRadius: 14 }}>
                                  {g.transactions.map((tx, i) => {
                                    const d = new Date(tx.date);
                                    const dateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                                    return (
                                      <div key={i} className="row" style={{ justifyContent: "space-between", padding: "6px 0", borderBottom: i < g.transactions.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                                        <div>
                                          <div style={{ fontWeight: 700, fontSize: 14 }}>{formatINR(tx.amount)}</div>
                                          <div className="muted" style={{ fontSize: 11 }}>{dateStr} • {tx.title || "No title"}</div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="muted" style={{ padding: 10 }}>No usage linked to this receipt.</div>
                      )}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <div className="muted" style={{ padding: 10 }}>No receipts yet.</div>
          )}
        </div>
      ) : null}

      {entity.type !== "source" ? (
        <div className="card cardPad">
          <div className="sectionTitle">
            <h2>Transactions</h2>
            <span className="muted">you ↔ {entity.name}</span>
          </div>
          {related.length ? (
            <div className="list">
              {related.slice(0, 50).map((t) => {
                const direction = you && String(t.from?._id || t.from) === String(you._id) ? "You gave" : "You received";
                const d = new Date(t.date || t.createdAt);
                const displayDate = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                return (
                  <div key={t._id} className="listItem">
                    <div>
                      <div className="listItemTitle">{direction}</div>
                      <div className="muted" style={{ fontSize: 12 }}>
                        {formatINR(t.amount)} • {displayDate}
                        {t.title ? ` • ${t.title}` : ""}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontWeight: 900 }}>{formatINR(t.amount)}</div>
                      <div className="row" style={{ gap: 8, marginTop: 4, justifyContent: "flex-end" }}>
                        <button className="btnGhost" style={{ padding: 0, fontSize: 11, color: "var(--blue)" }} onClick={() => nav(`/edit/${t._id}`)}>Edit</button>
                        <button className="btnGhost" style={{ padding: 0, fontSize: 11, color: "var(--danger)" }} onClick={() => handleDeleteTx(t._id)}>Delete</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="muted" style={{ padding: 10 }}>No transactions yet.</div>
          )}
        </div>
      ) : null}
    </div>
  );
}

