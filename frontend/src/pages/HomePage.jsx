import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
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
  if (e.type === "source") return { text: `Received ${formatINR(Math.abs(bal))}`, color: "var(--blue)" };
  if (e.type === "expense") return { text: `Spent ${formatINR(Math.abs(bal))}`, color: "var(--orange)" };
  return { text: formatINR(Math.abs(bal)), color: "var(--text)" };
}

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
  processItems(groups);

  return { youOwe, youReceive };
}

export function HomePage() {
  const nav = useNavigate();
  const loc = useLocation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  const [data, setData] = useState({ groups: [], ungrouped: [] });
  const [transactions, setTransactions] = useState([]);
  
  const [showConfetti, setShowConfetti] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedSection, setExpandedSection] = useState("person");

  useEffect(() => {
    if (loc.state?.celebrated) {
      setShowConfetti(true);
      window.history.replaceState({}, document.title);
      setTimeout(() => setShowConfetti(false), 3000);
    }
  }, [loc.state]);

  useEffect(() => {
    const done = localStorage.getItem("ft_setup_done") === "1";
    if (!done) nav("/setup", { replace: true });
  }, [nav]);

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [balData, txs] = await Promise.all([api.balances(), api.listTransactions()]);
        if (!alive) return;
        setData({
           groups: balData.groups || [],
           ungrouped: (balData.ungrouped || []).filter(b => b.name !== "You")
        });
        setTransactions(txs);
      } catch (e) {
        if (!alive) return;
        setError(e?.message || "Failed to load");
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, []);

  const allEntities = useMemo(() => {
    const list = [...data.ungrouped];
    for (const g of data.groups) {
      if (g.children) {
        for (const child of g.children) {
          list.push({ ...child, type: g.type, parentName: g.name, isChild: true });
        }
      }
    }
    return list;
  }, [data]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    const res = [];
    for (const item of allEntities) {
      if (item.name.toLowerCase().includes(q) || item.type.toLowerCase().includes(q) || (item.parentName && item.parentName.toLowerCase().includes(q))) {
        res.push(item);
      }
    }
    for (const g of data.groups) {
      if (g.name.toLowerCase().includes(q) || g.type.toLowerCase().includes(q)) {
        res.push({ ...g, isGroup: true });
      }
    }
    return res;
  }, [allEntities, data.groups, searchQuery]);

  const groupedSearchResults = useMemo(() => groupByType(searchResults), [searchResults]);
  const groupedGroups = useMemo(() => groupByType(data.groups), [data.groups]);
  const groupedUngrouped = useMemo(() => groupByType(data.ungrouped), [data.ungrouped]);
  const totals = useMemo(() => totalsForPeople(data.ungrouped, data.groups), [data]);

  const isSearching = searchQuery.trim().length > 0;
  const isCompletelyEmpty = data.groups.length === 0 && data.ungrouped.length === 0;

  async function handleCreateGroup(name, type) {
    const g = await api.createGroup({ name, type });
    setData(prev => ({
      ...prev,
      groups: [...prev.groups, { ...g, totalValue: 0, children: [] }]
    }));
  }

  return (
    <div className="col">
      {showConfetti && <div className="toastContainer"><div className="toastMsg">🎉 Transaction Saved!</div></div>}
      
      <div style={{ position: "relative", marginBottom: 16 }}>
        <input 
          className="input" 
          placeholder="Search people, sources, expenses..." 
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
        {isSearching && (
          <button 
            onClick={() => setSearchQuery("")}
            className="muted"
            style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 4, fontWeight: "bold" }}
          >
            ✕
          </button>
        )}
      </div>

      {isSearching ? (
        <div className="col">
          <div className="muted" style={{ fontSize: 13, marginBottom: 4, fontWeight: 700 }}>Search Results</div>
          
          <SearchResultsList title="People" items={groupedSearchResults.person} />
          <SearchResultsList title="Sources" items={groupedSearchResults.source} />
          <SearchResultsList title="Expenses" items={groupedSearchResults.expense} />
          
          {groupedSearchResults.person.length === 0 && groupedSearchResults.source.length === 0 && groupedSearchResults.expense.length === 0 && (
            <div className="card cardPad muted" style={{ textAlign: "center", padding: "30px 10px" }}>
              No entities found matching "{searchQuery}"
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="card cardPad">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <div>
                <div className="muted" style={{ fontSize: 12, fontWeight: 600 }}>Total you owe</div>
                <div style={{ fontWeight: 800, fontSize: 20, color: totals.youOwe ? "var(--danger)" : "var(--text)" }}>
                  {formatINR(totals.youOwe)}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="muted" style={{ fontSize: 12, fontWeight: 600 }}>Total you will receive</div>
                <div style={{ fontWeight: 800, fontSize: 20, color: totals.youReceive ? "var(--ok)" : "var(--text)" }}>
                  {formatINR(totals.youReceive)}
                </div>
              </div>
            </div>
            {error ? (
              <div className="pill" style={{ marginTop: 10, borderColor: "rgba(255,92,122,0.35)", color: "var(--danger)" }}>
                {error}
              </div>
            ) : null}
            {loading ? <div className="muted" style={{ marginTop: 10 }}>Loading…</div> : null}
          </div>

          <div className="row" style={{ marginTop: 6, marginBottom: 12, justifyContent: "center" }}>
            <button className="btn btnGhost" style={{ fontWeight: 700, color: "var(--blue)" }} onClick={() => nav("/add-entity?returnTo=/")}>+ Add Entity</button>
          </div>

          {!loading && isCompletelyEmpty ? (
            <div className="col" style={{ alignItems: "center", padding: "40px 20px", textAlign: "center" }}>
              <h2 style={{ fontSize: 18, margin: "0 0 8px", color: "var(--text)" }}>No transactions yet</h2>
              <p className="muted" style={{ margin: 0, fontSize: 14 }}>Start by adding one with the (+) button below.</p>
            </div>
          ) : (
            <>
              <EntityGroup type="person" title="People" groups={groupedGroups.person} ungrouped={groupedUngrouped.person} expanded={expandedSection === 'person'} onToggle={() => setExpandedSection(expandedSection === 'person' ? null : 'person')} onCreateGroup={handleCreateGroup} />
              <EntityGroup type="source" title="Sources" groups={groupedGroups.source} ungrouped={groupedUngrouped.source} expanded={expandedSection === 'source'} onToggle={() => setExpandedSection(expandedSection === 'source' ? null : 'source')} onCreateGroup={handleCreateGroup} />
              <EntityGroup type="expense" title="Expenses" groups={groupedGroups.expense} ungrouped={groupedUngrouped.expense} expanded={expandedSection === 'expense'} onToggle={() => setExpandedSection(expandedSection === 'expense' ? null : 'expense')} onCreateGroup={handleCreateGroup} />
            </>
          )}
        </>
      )}

      <button className="fab" onClick={() => nav("/add")} aria-label="Add Transaction">
        +
      </button>
    </div>
  );
}

function SearchResultsList({ title, items }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 16 }}>
       <div className="row sectionTitle" style={{ padding: "16px", margin: 0 }}>
         <h2 style={{ fontSize: 16, margin: 0, fontWeight: 700 }}>{title} ({items.length})</h2>
       </div>
       <div className="list" style={{ padding: "0 8px 12px" }}>
         {items.map(e => {
            const isGroup = e.isGroup;
            const label = formatEntityLabel({ ...e, value: isGroup ? e.totalValue : e.value });
            const navLink = isGroup ? `/group/${e.id}` : `/entity/${e.id || e.entityId || e._id}`;
            const subtext = isGroup ? `Group (${e.children?.length} items)` : (e.isChild && e.parentName ? `Under: ${e.parentName}` : e.type);
            const prefix = isGroup ? "📁 " : "";
            
            return (
              <Link key={(isGroup ? 'g_' : 'e_') + e.id} to={navLink} className="listItem" style={isGroup ? { background: "rgba(0,0,0,0.02)", borderLeft: "4px solid var(--border)" } : {}}>
                 <div>
                    <div className="listItemTitle">{prefix}{e.name}</div>
                    <div className="muted" style={{ fontSize: 13, textTransform: "capitalize" }}>{subtext}</div>
                 </div>
                 <div style={{ textAlign: "right" }}>
                   <div style={{ fontWeight: 800, color: label.color, fontSize: 15 }}>{label.text}</div>
                 </div>
              </Link>
            )
         })}
       </div>
    </div>
  )
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
                 <div style={{ color: "var(--blue)", fontWeight: 700 }}>+ New Group</div>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
