import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../api";
import { safeTrim } from "../utils";

export function AddEntityPage() {
  const nav = useNavigate();
  const loc = useLocation();
  const returnTo = new URLSearchParams(loc.search).get("returnTo") || "/";

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [groups, setGroups] = useState([]);

  // Form state
  const [type, setType] = useState("person");
  const [groupId, setGroupId] = useState("");
  const [name, setName] = useState("");
  const [mode, setMode] = useState("simple");
  const [expectedAmount, setExpectedAmount] = useState("");
  const [frequency, setFrequency] = useState("monthly");

  const [showNewGroupInput, setShowNewGroupInput] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);

  useEffect(() => {
    let alive = true;
    api.listGroups().then((grps) => {
      if (alive) setGroups(grps);
    }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const possibleGroups = groups.filter(g => g.type === type);

  async function handleCreateGroup() {
    if (!newGroupName.trim()) return;
    setIsCreatingGroup(true);
    setError("");
    try {
      const g = await api.createGroup({ name: newGroupName.trim(), type });
      setGroups(p => [...p, g]);
      setGroupId(g._id);
      setShowNewGroupInput(false);
      setNewGroupName("");
    } catch (e) {
      setError(e?.message || "Failed to create group");
    } finally {
      setIsCreatingGroup(false);
    }
  }

  async function save() {
    setBusy(true);
    setError("");
    try {
      const trimmedName = safeTrim(name);
      if (!trimmedName) throw new Error("Name is required");

      const payload = { type, name: trimmedName };
      if (groupId) payload.groupId = groupId;

      if (type === "source") {
        payload.mode = mode;
        if (mode === "recurring") {
          payload.frequency = frequency;
          const amt = Number(expectedAmount);
          if (amt > 0) payload.expectedAmount = amt;
        }
      }

      await api.createEntity(payload);
      nav(returnTo, { replace: true });
    } catch (e) {
      setError(e?.message || "Failed to create entity");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="col">
      <div className="card cardPad">
        <div className="sectionTitle">
          <h2>Add Entity</h2>
          <span className="muted">Create a new Person, Source, or Expense</span>
        </div>

        {error && (
          <div className="pill" style={{ marginBottom: 10, borderColor: "rgba(255,92,122,0.35)", color: "var(--danger)" }}>
            {error}
          </div>
        )}

        {/* Type */}
        <div style={{ marginBottom: 12 }}>
          <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>Type</div>
          <div className="row">
            <button className={`btn ${type === "person" ? "btnPrimary" : "btnGhost"}`} onClick={() => { setType("person"); setGroupId(""); }}>Person</button>
            <button className={`btn ${type === "source" ? "btnPrimary" : "btnGhost"}`} onClick={() => { setType("source"); setGroupId(""); }}>Source</button>
            <button className={`btn ${type === "expense" ? "btnPrimary" : "btnGhost"}`} onClick={() => { setType("expense"); setGroupId(""); }}>Expense</button>
          </div>
        </div>

        {/* Group (Optional) */}
        <div style={{ marginBottom: 12 }}>
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 4 }}>
            <div className="muted" style={{ fontSize: 12 }}>Group Under (Optional)</div>
            {!showNewGroupInput && (
              <button 
                className="btnGhost muted" 
                style={{ fontSize: 12, padding: 0, height: "auto", color: "var(--blue)", border: "none", cursor: "pointer", background: "none" }} 
                onClick={() => setShowNewGroupInput(true)}
              >
                + Create new group
              </button>
            )}
          </div>
          
          {showNewGroupInput ? (
            <div className="card cardPad col" style={{ background: "rgba(0,0,0,0.02)", border: "1px solid var(--border)", padding: 12 }}>
              <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>New {type} Group</div>
              <input 
                className="input" 
                placeholder="Group name" 
                value={newGroupName} 
                onChange={e => setNewGroupName(e.target.value)} 
                disabled={isCreatingGroup} 
                autoFocus
              />
              <div className="row" style={{ justifyContent: "flex-end", marginTop: 8, gap: 8 }}>
                <button className="btnGhost" style={{ padding: "4px 8px", fontSize: 13 }} onClick={() => setShowNewGroupInput(false)}>Cancel</button>
                <button className="btn btnPrimary" style={{ padding: "4px 12px", fontSize: 13 }} onClick={handleCreateGroup} disabled={isCreatingGroup || !newGroupName.trim()}>Create</button>
              </div>
            </div>
          ) : (
            possibleGroups.length > 0 ? (
              <select className="input" value={groupId} onChange={e => setGroupId(e.target.value)} style={{ padding: 10 }}>
                <option value="">-- No Group --</option>
                {possibleGroups.map(g => (
                  <option key={g._id} value={g._id}>{g.name}</option>
                ))}
              </select>
            ) : (
              <div className="muted" style={{ fontSize: 13, padding: "8px 0" }}>No {type} groups available. Create one above.</div>
            )
          )}
        </div>

        {/* Name */}
        <div style={{ marginBottom: 12 }}>
          <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>Name</div>
          <input className="input" placeholder="Name" value={name} onChange={e => setName(e.target.value)} />
        </div>

        {/* Source Conditionals */}
        {type === "source" && (
          <div style={{ marginBottom: 12 }}>
            <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>Mode</div>
            <div className="row" style={{ flexWrap: "wrap", rowGap: 8 }}>
              <button className={`btn ${mode === "simple" ? "btnPrimary" : "btnGhost"}`} onClick={() => setMode("simple")}>Simple</button>
              <button className={`btn ${mode === "recurring" ? "btnPrimary" : "btnGhost"}`} onClick={() => setMode("recurring")}>Recurring</button>
              <button className={`btn ${mode === "project" ? "btnPrimary" : "btnGhost"}`} onClick={() => setMode("project")}>Project</button>
            </div>
            
            {mode === "recurring" && (
              <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>Expected Amount</div>
                  <input className="input" type="number" placeholder="0" value={expectedAmount} onChange={e => setExpectedAmount(e.target.value)} />
                </div>
                <div style={{ flex: 1 }}>
                  <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>Frequency</div>
                  <select className="input" value={frequency} onChange={e => setFrequency(e.target.value)} style={{ padding: 10 }}>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="row" style={{ justifyContent: "space-between", marginTop: 20 }}>
          <button className="btn btnGhost" onClick={() => nav(returnTo)}>Cancel</button>
          <button className="btn btnPrimary" onClick={save} disabled={busy || !name.trim()}>Save Entity</button>
        </div>
      </div>
    </div>
  );
}
