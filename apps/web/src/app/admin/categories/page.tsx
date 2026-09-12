"use client";

import { useEffect, useState } from "react";

interface CategoryRow {
  _id: string;
  name: string;
  questionCount: number;
  templateCount: number;
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  function load() {
    setLoading(true);
    fetch("/api/admin/categories")
      .then((res) => res.json())
      .then((data) => setCategories(data.categories ?? []))
      .catch(() => setError("Failed to load categories"))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function createCategory() {
    if (!name.trim()) return;
    setCreating(true);
    setError(null);
    const res = await fetch("/api/admin/categories", {
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

  async function saveEdit(id: string) {
    if (!editingName.trim()) return;
    const res = await fetch(`/api/admin/categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editingName }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setError(data?.message ?? "Failed to rename category");
      return;
    }
    setEditingId(null);
    load();
  }

  async function deleteCategory(cat: CategoryRow) {
    const usageNote =
      cat.questionCount > 0
        ? `'${cat.name}' is used in ${cat.questionCount} question(s) across ${cat.templateCount} template(s). Deleting it removes the tag from all of them — the questions themselves stay. Continue?`
        : `Delete '${cat.name}'? It isn't used in any template.`;
    if (!confirm(usageNote)) return;

    const res = await fetch(`/api/admin/categories/${cat._id}?force=true`, { method: "DELETE" });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setError(data?.message ?? "Failed to delete category");
      return;
    }
    load();
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Question Categories</h1>
          <p className="subtitle" style={{ margin: 0 }}>
            Used to tag questions across all templates (e.g. Service, Cleanliness).
          </p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <h3>New category</h3>
        <div className="field-row">
          <div className="field">
            <label>Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Communication" />
          </div>
        </div>
        {error && <p className="error-text">{error}</p>}
        <button className="btn btn-dark" disabled={creating} onClick={createCategory}>
          {creating ? "Creating…" : "+ New Category"}
        </button>
      </div>

      {loading && <p className="subtitle">Loading…</p>}
      {!loading && (
        <table className="clean">
          <thead>
            <tr>
              <th>Name</th>
              <th>Used in</th>
              <th style={{ textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c._id}>
                <td>
                  {editingId === c._id ? (
                    <input value={editingName} onChange={(e) => setEditingName(e.target.value)} autoFocus />
                  ) : (
                    c.name
                  )}
                </td>
                <td style={{ color: c.questionCount === 0 ? "var(--text-3)" : undefined }}>
                  {c.questionCount === 0
                    ? "Not currently used"
                    : `${c.questionCount} question${c.questionCount === 1 ? "" : "s"} across ${c.templateCount} template${c.templateCount === 1 ? "" : "s"}`}
                </td>
                <td style={{ textAlign: "right" }}>
                  {editingId === c._id ? (
                    <>
                      <button className="btn btn-sm" onClick={() => saveEdit(c._id)}>
                        Save
                      </button>{" "}
                      <button className="btn btn-sm" onClick={() => setEditingId(null)}>
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <span
                        className="icon-btn"
                        onClick={() => {
                          setEditingId(c._id);
                          setEditingName(c.name);
                        }}
                      >
                        ✏
                      </span>{" "}
                      <span className="icon-btn btn-danger" onClick={() => deleteCategory(c)}>
                        🗑
                      </span>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {categories.length === 0 && (
              <tr>
                <td colSpan={3} className="subtitle">
                  No categories yet — add one above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
