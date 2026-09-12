"use client";

import { useEffect, useState } from "react";

interface IndustryRow {
  _id: string;
  name: string;
}

export default function IndustriesPage() {
  const [industries, setIndustries] = useState<IndustryRow[]>([]);
  const [loading, setLoading] = useState(true);
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
    setName("");
    load();
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Industries</h1>
          <p className="subtitle">The controlled vocabulary businesses pick from — used on the Business detail page.</p>
        </div>
      </div>

      <div className="card">
        <h3>New industry</h3>
        <div className="field-row">
          <div className="field">
            <label>Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Restaurants" />
          </div>
        </div>
        {error && <p className="error-text">{error}</p>}
        <button className="btn btn-dark" disabled={creating} onClick={createIndustry}>
          {creating ? "Creating…" : "+ Add industry"}
        </button>
      </div>

      {loading && <p className="subtitle">Loading…</p>}
      {!loading && (
        <table className="clean">
          <thead>
            <tr>
              <th>Name</th>
            </tr>
          </thead>
          <tbody>
            {industries.map((i) => (
              <tr key={i._id}>
                <td>{i.name}</td>
              </tr>
            ))}
            {industries.length === 0 && (
              <tr>
                <td className="subtitle">No industries yet — add one above.</td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
