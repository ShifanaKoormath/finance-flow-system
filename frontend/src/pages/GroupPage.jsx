import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api } from "../api";
import { formatINR } from "../utils";

function renderSummaryText(group) {
  const val = group.totalValue || 0;
  if (group.type === "person") {
    if (val < 0) return `You owe ${formatINR(Math.abs(val))}`;
    if (val > 0) return `They owe you ${formatINR(Math.abs(val))}`;
    return "Settled";
  }
  if (group.type === "source") return `Received ${formatINR(Math.abs(val))}`;
  if (group.type === "expense") return `Spent ${formatINR(Math.abs(val))}`;
  return formatINR(Math.abs(val));
}

export function GroupPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [isEditing, setIsEditing] = useState(false);
  const [newName, setNewName] = useState("");

  const [entities, setEntities] = useState([]);
  const [showAddExisting, setShowAddExisting] = useState(false);
  const [showCreateNew, setShowCreateNew] = useState(false);
  const [newEntityName, setNewEntityName] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    async function fetchGroup() {
      try {
        const [balData, ents] = await Promise.all([api.balances(), api.listEntities()]);
        if (!alive) return;
        setEntities(ents);
        const matched = balData.groups.find(g => g.id === id);
        if (matched) {
          setGroup(matched);
          setNewName(matched.name);
        } else {
          setError("Group not found");
        }
      } catch (err) {
        if (!alive) return;
        setError("Failed to load group details");
      } finally {
        if (alive) setLoading(false);
      }
    }
    fetchGroup();
    return () => { alive = false; };
  }, [id]);

  async function reloadGroup() {
    const balData = await api.balances();
    const matched = balData.groups.find(g => g.id === id);
    if (matched) {
      setGroup(matched);
      setNewName(matched.name);
    }
  }

  async function handleRename() {
    if (!newName.trim() || newName.trim() === group.name) {
      setIsEditing(false);
      return;
    }
    try {
      await api.updateGroup(id, { name: newName.trim() });
      setGroup({ ...group, name: newName.trim() });
      setIsEditing(false);
    } catch (e) {
      alert("Failed to rename group");
    }
  }

  async function handleDelete() {
    if (!confirm(`Are you sure you want to delete the group "${group.name}"? This will NOT delete the actual entities inside it, they will just be moved out of the group.`)) return;
    try {
      await api.deleteGroup(id);
      nav("/");
    } catch (e) {
      alert("Failed to delete group");
    }
  }

  async function assignEntity(entityId) {
    try {
      setIsBusy(true);
      await api.updateEntity(entityId, { groupId: id });
      setShowAddExisting(false);
      api.listEntities().then(setEntities);
      await reloadGroup();
    } catch(e) {
      alert("Failed to assign entity");
    } finally {
      setIsBusy(false);
    }
  }

  async function createNewEntity() {
    if (!newEntityName.trim()) return;
    try {
      setIsBusy(true);
      await api.createEntity({
        type: group.type,
        name: newEntityName.trim(),
        groupId: id,
        mode: group.type === "source" ? "simple" : undefined
      });
      setShowCreateNew(false);
      setNewEntityName("");
      api.listEntities().then(setEntities);
      await reloadGroup();
    } catch(e) {
      alert("Failed to create entity");
    } finally {
      setIsBusy(false);
    }
  }

  if (loading) return <div className="card cardPad col" style={{ margin: 16 }}>Loading...</div>;
  if (error || !group) return (
    <div className="card cardPad col" style={{ margin: 16 }}>
      <h2>{error}</h2>
      <button className="btn" onClick={() => nav("/")}>Back</button>
    </div>
  );

  const availableEntities = entities.filter(e => e.type === group.type && String(e.groupId) !== String(id) && e.name !== "You");

  return (
    <div className="col" style={{ padding: "0 16px" }}>
      <div className="card cardPad" style={{ marginTop: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            {isEditing ? (
              <input 
                autoFocus
                className="input"
                style={{ fontSize: 18, fontWeight: 900, padding: 8, marginBottom: 4 }}
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onBlur={handleRename}
                onKeyDown={e => e.key === "Enter" && handleRename()}
              />
            ) : (
              <div style={{ fontWeight: 900, fontSize: 24, display: "flex", alignItems: "center", gap: 8 }}>
                📁 {group.name}
              </div>
            )}
            <div className="muted" style={{ fontSize: 13, textTransform: "capitalize", marginTop: 4 }}>
              {group.type} Group
            </div>
          </div>
        </div>

        <div style={{ marginTop: 24 }}>
          <div className="muted" style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Group Aggregation</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: group.type === 'person' ? (group.totalValue < 0 ? 'var(--danger)' : group.totalValue > 0 ? 'var(--ok)' : 'var(--text)') : group.type === 'source' ? 'var(--blue)' : 'var(--orange)' }}>
            {renderSummaryText(group)}
          </div>
        </div>

        <div className="row" style={{ marginTop: 24, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
          {!isEditing && <button className="btn btnGhost" style={{ color: "var(--blue)" }} onClick={() => setIsEditing(true)}>Rename</button>}
          <button className="btn btnGhost" style={{ color: "var(--danger)" }} onClick={handleDelete}>Delete Group</button>
        </div>
      </div>

      <div className="card cardPad" style={{ marginTop: 16 }}>
        <div className="sectionTitle">
          <h2>Items in this Group</h2>
          <span className="muted" style={{ background: "rgba(0,0,0,0.04)", padding: "2px 8px", borderRadius: 12 }}>{group.children?.length || 0}</span>
        </div>
        
        {(!group.children || group.children.length === 0) ? (
          <div className="muted" style={{ padding: 10 }}>No items assigned to this group.</div>
        ) : (
          <div className="list">
            {group.children.map(child => (
              <Link key={child.id} to={`/entity/${child.id}`} className="listItem">
                <div>
                  <div className="listItemTitle">{child.name}</div>
                  <div className="muted" style={{ fontSize: 12, textTransform: "capitalize" }}>{group.type}</div>
                </div>
                <div style={{ textAlign: "right", fontWeight: 800 }}>
                  {formatINR(Math.abs(child.value))}
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Inline Creation / Addition UI */}
        <div style={{ marginTop: 16, borderTop: "1px dashed var(--border)", paddingTop: 12 }}>
          {showCreateNew ? (
            <div className="col" style={{ background: "rgba(0,0,0,0.02)", padding: 12, borderRadius: 8, border: "1px solid var(--border)" }}>
               <div className="muted" style={{ fontSize: 12, marginBottom: 8, fontWeight: 600 }}>New Entity inside {group.name}</div>
               <input className="input" autoFocus placeholder="Entity name" value={newEntityName} onChange={e => setNewEntityName(e.target.value)} disabled={isBusy} onKeyDown={e => { if(e.key === "Enter") createNewEntity(); }} />
               <div className="row" style={{ justifyContent: "flex-end", marginTop: 8, gap: 8 }}>
                  <button className="btnGhost" style={{ padding: "4px 8px", fontSize: 13 }} onClick={() => setShowCreateNew(false)}>Cancel</button>
                  <button className="btn btnPrimary" style={{ padding: "4px 12px", fontSize: 13 }} disabled={isBusy || !newEntityName.trim()} onClick={createNewEntity}>Create</button>
               </div>
            </div>
          ) : showAddExisting ? (
            <div className="col" style={{ background: "rgba(0,0,0,0.02)", padding: 12, borderRadius: 8, border: "1px solid var(--border)" }}>
               <div className="muted" style={{ fontSize: 12, marginBottom: 8, fontWeight: 600 }}>Assign Existing Entity</div>
               {availableEntities.length === 0 ? (
                 <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>No available {group.type}s to assign.</div>
               ) : (
                 <div className="list" style={{ maxHeight: 200, overflowY: "auto" }}>
                   {availableEntities.map(e => (
                     <button key={e._id} className="listItem" onClick={() => assignEntity(e._id)} disabled={isBusy} style={{ cursor: "pointer", background: "transparent", border: "1px solid var(--border)" }}>
                        <div className="listItemTitle">{e.name}</div>
                     </button>
                   ))}
                 </div>
               )}
               <div style={{ textAlign: "right", marginTop: 8 }}>
                  <button className="btnGhost" style={{ padding: "4px 8px", fontSize: 13 }} onClick={() => setShowAddExisting(false)}>Cancel</button>
               </div>
            </div>
          ) : (
            <div className="row" style={{ gap: 8 }}>
               <button className="btn btnGhost" style={{ flex: 1, padding: "8px", fontSize: 13, color: "var(--blue)", border: "1px dashed var(--border)" }} onClick={() => setShowAddExisting(true)}>+ Add existing</button>
               <button className="btn btnGhost" style={{ flex: 1, padding: "8px", fontSize: 13, color: "var(--blue)", border: "1px dashed var(--border)" }} onClick={() => setShowCreateNew(true)}>+ Create new</button>
            </div>
          )}
        </div>
      </div>

      <button className="btn btnGhost" style={{ margin: "24px auto", display: "block" }} onClick={() => nav("/")}>Back to Home</button>
    </div>
  );
}
