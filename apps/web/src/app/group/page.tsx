"use client";

import { useEffect, useState } from "react";

interface BusinessRow {
  _id: string;
  name: string;
  industry: string;
  region: string;
  active: boolean;
}

export default function GroupBusinessesPage() {
  const [businesses, setBusinesses] = useState<BusinessRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/group/businesses")
      .then((res) => res.json())
      .then((data) => setBusinesses(data.businesses ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Businesses</h1>
          <p className="subtitle">Every business under your organization.</p>
        </div>
      </div>

      {loading && <p className="subtitle">Loading…</p>}
      {!loading && (
        <table className="clean">
          <thead>
            <tr>
              <th>Name</th>
              <th>Industry</th>
              <th>Region</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {businesses.map((b) => (
              <tr key={b._id}>
                <td>{b.name}</td>
                <td>{b.industry || "—"}</td>
                <td>{b.region || "—"}</td>
                <td>
                  <span className={`pill ${b.active ? "pill-green" : "pill-gray"}`}>{b.active ? "Active" : "Inactive"}</span>
                </td>
              </tr>
            ))}
            {businesses.length === 0 && (
              <tr>
                <td colSpan={4} className="subtitle">
                  No businesses under your organization yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
