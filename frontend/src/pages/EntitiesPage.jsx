import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import { formatINR } from "../utils";

function groupByType(items) {
  const out = { person: [], source: [], expense: [] };
  if (!items) return out;
  for (const it of items) {
    if (out[it.type]) out[it.type].push(it);
  }
  return out;
}

function formatEntityLabel(e) {
  const bal = e.balance ?? e.value ?? e.totalValue;
  if (e.type === "person") {
    if (bal < 0) return { text: `You owe ${formatINR(Math.abs(bal))}`, color: "var(--danger)" };
    if (bal > 0) return { text: `They owe you ${formatINR(Math.abs(bal))}`, color: "var(--ok)" };
    return { text: "Settled", color: "var(--muted)" };
  }
  if (e.type === "source") return { text: `Received ${formatINR(Math.abs(bal))}`, color: "var(--ok)" };
  if (e.type === "expense") return { text: `Spent ${formatINR(Math.abs(bal))}`, color: "var(--danger)" };
  return { text: formatINR(Math.abs(bal)), color: "var(--text)" };
}

export function EntitiesPage() {
  const nav = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  const [data, setData] = useState({ groups: [], ungrouped: [] });
  const [expandedSection, setExpandedSection] = useState("person");

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const balData = await api.balances();
        if (!alive) return;
        setData({
           groups: balData.groups || [],
           ungrouped: (balData.ungrouped || []).filter(b => b.name !== "You")
        });
      } catch (e) {
        if (!alive) return;
        setError(e?.message || "Failed to load");
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => { alive = false; };
  }, []);

  const groupedGroups = useMemo(() => groupByType(data.groups), [data.groups]);
  const groupedUngrouped = useMemo(() => groupByType(data.ungrouped), [data.ungrouped]);

  async function handleCreateGroup(name, type) {
    const g = await api.createGroup({ name, type });
    setData(prev => ({
      ...prev,
      groups: [...prev.groups, { ...g, totalValue: 0, children: [] }]
    }));
  }

  if (loading) {
    return <div className="card cardPad"><div className="muted">Loading accounts...</div></div>;
  }

  return (
    <div className="col">
      <div className="card cardPad">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div style={{ fontWeight: 900, fontSize: 20 }}>Accounts & Categories</div>
          <button className="btn btnGhost" style={{ padding: "4px 8px", color: "var(--accent)" }} onClick={() => nav("/add-entity?returnTo=/entities")}>+ Add New</button>
        </div>
        {error && <div className="pill" style={{ marginTop: 10, color: "var(--danger)" }}>{error}</div>}
      </div>

      <EntityGroup type="person" title="People" groups={groupedGroups.person} ungrouped={groupedUngrouped.person} expanded={expandedSection === 'person'} onToggle={() => setExpandedSection(expandedSection === 'person' ? null : 'person')} onCreateGroup={handleCreateGroup} />
      <EntityGroup type="source" title="Income Sources" groups={groupedGroups.source} ungrouped={groupedUngrouped.source} expanded={expandedSection === 'source'} onToggle={() => setExpandedSection(expandedSection === 'source' ? null : 'source')} onCreateGroup={handleCreateGroup} />
      <EntityGroup type="expense" title="Categories" groups={groupedGroups.expense} ungrouped={groupedUngrouped.expense} expanded={expandedSection === 'expense'} onToggle={() => setExpandedSection(expandedSection === 'expense' ? null : 'expense')} onCreateGroup={handleCreateGroup} />
    </div>
  );
}

function EntityGroup({ type, title, groups, ungrouped, expanded, onToggle, onCreateGroup }) {
  const count = groups.length + ungrouped.length;
  const [showInput, setShowInput] = useState(false);
  const [newName, setNewName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function handleSave() {
    if (!newName.trim()) return;
    setIsSaving(true);
    try {
      await onCreateGroup(newName.trim(), type);
      setNewName("");
      setShowInput(false);
    } catch (e) {
      alert("Failed to create group");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 16 }}>
      <button 
        className="row" 
        onClick={onToggle}
        style={{ width: "100%", background: "transparent", border: "none", padding: "16px", margin: 0, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
      >
        <div className="row">
          <h2 style={{ fontSize: 16, margin: 0, fontWeight: 700 }}>{title}</h2>
          <span className="muted" style={{ fontSize: 13, background: "rgba(0,0,0,0.04)", padding: "2px 8px", borderRadius: 12 }}>{count}</span>
        </div>
        <div className="muted" style={{ transition: "transform 0.2s", transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}>
          ▼
        </div>
      </button>

      {expanded && (
        <div style={{ padding: "0 8px 12px" }}>
          <div className="list">
            {groups.map((g) => {
              const label = formatEntityLabel({ ...g, value: g.totalValue });
              return (
                <Link key={g.id} to={`/group/${g.id}`} className="listItem" style={{ background: "rgba(0,0,0,0.02)", borderLeft: "4px solid var(--border)" }}>
                  <div>
                    <div className="listItemTitle">📁 {g.name}</div>
                    <div className="muted" style={{ fontSize: 13, textTransform: "capitalize" }}>
                      Group ({g.children?.length} items)
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 800, color: label.color, fontSize: 15 }}>
                      {label.text}
                    </div>
                  </div>
                </Link>
              );
            })}
            {ungrouped.map((e) => {
              const label = formatEntityLabel(e);
              const id = e.id || e.entityId || e._id;
              return (
                <Link key={id} to={`/entity/${id}`} className="listItem">
                  <div>
                    <div className="listItemTitle">{e.name}</div>
                    <div className="muted" style={{ fontSize: 13, textTransform: "capitalize" }}>
                      {e.type}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 800, color: label.color, fontSize: 15 }}>
                      {label.text}
                    </div>
                  </div>
                </Link>
              );
            })}
            
            {showInput ? (
              <div className="listItem" style={{ flexDirection: "column", alignItems: "stretch", padding: "12px", background: "rgba(0,0,0,0.02)", border: "1px dashed var(--border)", cursor: "default" }}>
                 <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>New {type} group</div>
                 <input className="input" autoFocus placeholder="Group name" value={newName} onChange={e => setNewName(e.target.value)} disabled={isSaving} onKeyDown={e => { if(e.key === "Enter") handleSave(); }} />
                 <div className="row" style={{ justifyContent: "flex-end", marginTop: 8, gap: 8 }}>
                    <button className="btnGhost" style={{ padding: "4px 8px", fontSize: 13 }} onClick={() => setShowInput(false)}>Cancel</button>
                    <button className="btn btnPrimary" style={{ padding: "4px 12px", fontSize: 13 }} disabled={isSaving || !newName.trim()} onClick={handleSave}>Create</button>
                 </div>
              </div>
            ) : (
              <button 
                 className="listItem" 
                 onClick={() => setShowInput(true)}
                 style={{ justifyContent: "center", cursor: "pointer", background: "transparent", border: "1px dashed var(--border)" }}
              >
                 <div style={{ color: "var(--accent)", fontWeight: 700 }}>+ New Group</div>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
