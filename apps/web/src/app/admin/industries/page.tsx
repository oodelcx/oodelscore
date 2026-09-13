"use client";

import { useEffect, useState } from "react";

interface IndustryRow {
  _id: string;
  name: string;
  usedBy: number;
}

export default function IndustriesPage() {
  const [industries, setIndustries] = useState<IndustryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  function load() {
    setLoading(true);
    fetch("/api/admin/industries")
      .then((res) => res.json())
      .then((data) => setIndustries(data.industries ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  function openModal() {
    setName("");
    setError(null);
    setShowModal(true);
  }

  async function createIndustry() {
    if (!name.trim()) return;
    setCreating(true);
    setError(null);
    const res = await fetch("/api/admin/industries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    setCreating(false);
    if (!res.ok) {
      setError(data.message);
      return;
    }
    setShowModal(false);
    load();
  }

  async function renameIndustry(industry: IndustryRow) {
    const newName = window.prompt("Rename industry:", industry.name);
    if (!newName || !newName.trim() || newName.trim() === industry.name) return;
    const res = await fetch(`/api/admin/industries/${industry._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      window.alert(data?.message ?? "Rename failed");
      return;
    }
    load();
  }

  async function deleteIndustry(industry: IndustryRow) {
    const msg =
      industry.usedBy > 0
        ? `"${industry.name}" is currently set on ${industry.usedBy} business${industry.usedBy === 1 ? "" : "es"}. They'll keep their data, but this option disappears from the dropdown. Continue?`
        : `Delete "${industry.name}"? It isn't used by any business.`;
    if (!window.confirm(msg)) return;
    await fetch(`/api/admin/industries/${industry._id}`, { method: "DELETE" });
    load();
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Industries</h1>
          <p className="subtitle" style={{ margin: 0 }}>
            The list every &ldquo;Industry&rdquo; dropdown in the app draws from — add one here, it appears everywhere
            immediately, no code change needed.
          </p>
        </div>
        <button className="btn btn-dark" onClick={openModal}>
          + New Industry
        </button>
      </div>

      {loading && <p className="subtitle">Loading…</p>}
      {!loading && (
        <table className="clean">
          <thead>
            <tr>
              <th>Name</th>
              <th>Used by</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {industries.map((i) => (
              <tr key={i._id}>
                <td>{i.name}</td>
                <td>
                  {i.usedBy > 0 ? (
                    `${i.usedBy} business${i.usedBy === 1 ? "" : "es"}`
                  ) : (
                    <span className="subtitle" style={{ margin: 0 }}>
                      Not currently used
                    </span>
                  )}
                </td>
                <td style={{ textAlign: "right" }}>
                  <span className="icon-btn" onClick={() => renameIndustry(i)} style={{ cursor: "pointer" }}>
                    ✏
                  </span>{" "}
                  <span
                    className="icon-btn btn-danger"
                    onClick={() => deleteIndustry(i)}
                    style={{ cursor: "pointer", marginLeft: 6 }}
                  >
                    🗑
                  </span>
                </td>
              </tr>
            ))}
            {industries.length === 0 && (
              <tr>
                <td colSpan={3} className="subtitle">
                  No industries yet — add one above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal-box">
            <div className="modal-head">
              <h2>Create Industry</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                ×
              </button>
            </div>
            <div className="field">
              <label>Name</label>
              <input
                type="text"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Restaurants"
                onKeyDown={(e) => e.key === "Enter" && createIndustry()}
              />
            </div>
            {error && <p className="error-text">{error}</p>}
            <div className="modal-actions">
              <button className="btn" onClick={() => setShowModal(false)}>
                Cancel
              </button>
              <button className="btn btn-dark" disabled={creating || !name.trim()} onClick={createIndustry}>
                {creating ? "Creating…" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
