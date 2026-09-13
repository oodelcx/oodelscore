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

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  const [editingCategory, setEditingCategory] = useState<CategoryRow | null>(null);
  const [editingName, setEditingName] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  function load() {
    setLoading(true);
    fetch("/api/admin/categories")
      .then((res) => res.json())
      .then((data) => setCategories(data.categories ?? []))
      .catch(() => setError("Failed to load categories"))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  function openCreateModal() {
    setName("");
    setError(null);
    setShowCreateModal(true);
  }

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
    setShowCreateModal(false);
    load();
  }

  function openEditModal(cat: CategoryRow) {
    setEditingCategory(cat);
    setEditingName(cat.name);
    setError(null);
  }

  async function saveEdit() {
    if (!editingCategory || !editingName.trim()) return;
    setSavingEdit(true);
    const res = await fetch(`/api/admin/categories/${editingCategory._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editingName }),
    });
    const data = await res.json().catch(() => null);
    setSavingEdit(false);
    if (!res.ok) {
      setError(data?.message ?? "Failed to rename category");
      return;
    }
    setEditingCategory(null);
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
        <button className="btn btn-dark" onClick={openCreateModal}>
          + New Category
        </button>
      </div>

      {error && <p className="error-text">{error}</p>}
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
                <td>{c.name}</td>
                <td style={{ color: c.questionCount === 0 ? "var(--text-3)" : undefined }}>
                  {c.questionCount === 0
                    ? "Not currently used"
                    : `${c.questionCount} question${c.questionCount === 1 ? "" : "s"} across ${c.templateCount} template${c.templateCount === 1 ? "" : "s"}`}
                </td>
                <td style={{ textAlign: "right" }}>
                  <span className="icon-btn" onClick={() => openEditModal(c)} style={{ cursor: "pointer" }}>
                    ✏
                  </span>{" "}
                  <span className="icon-btn btn-danger" onClick={() => deleteCategory(c)} style={{ cursor: "pointer" }}>
                    🗑
                  </span>
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

      {showCreateModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowCreateModal(false)}>
          <div className="modal-box narrow">
            <div className="modal-head">
              <h2>Create Category</h2>
              <button className="modal-close" onClick={() => setShowCreateModal(false)}>
                ×
              </button>
            </div>
            <div className="field">
              <input
                type="text"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Category name"
                onKeyDown={(e) => e.key === "Enter" && createCategory()}
              />
            </div>
            {error && <p className="error-text">{error}</p>}
            <div className="modal-actions">
              <button className="btn" onClick={() => setShowCreateModal(false)}>
                Cancel
              </button>
              <button className="btn btn-dark" disabled={creating || !name.trim()} onClick={createCategory}>
                {creating ? "Creating…" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {editingCategory && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setEditingCategory(null)}>
          <div className="modal-box narrow">
            <div className="modal-head">
              <h2>Edit Category</h2>
              <button className="modal-close" onClick={() => setEditingCategory(null)}>
                ×
              </button>
            </div>
            <div className="field">
              <input
                type="text"
                autoFocus
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveEdit()}
              />
            </div>
            {error && <p className="error-text">{error}</p>}
            <div className="modal-actions">
              <button className="btn" onClick={() => setEditingCategory(null)}>
                Cancel
              </button>
              <button className="btn btn-dark" disabled={savingEdit || !editingName.trim()} onClick={saveEdit}>
                {savingEdit ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
