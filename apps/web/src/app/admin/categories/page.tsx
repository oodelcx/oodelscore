"use client";

import { Fragment, useEffect, useState } from "react";

interface UsedByBusiness {
  businessId: string;
  businessName: string;
  parentOrgId: string | null;
  parentOrgName: string | null;
}
interface CategoryRow {
  _id: string;
  name: string;
  product: string;
  sensitive: boolean;
  questionCount: number;
  templateCount: number;
  usedByBusinesses: UsedByBusiness[];
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState("");
  const [product, setProduct] = useState("customer_experience");
  const [sensitive, setSensitive] = useState(false);
  const [creating, setCreating] = useState(false);

  const [editingCategory, setEditingCategory] = useState<CategoryRow | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingSensitive, setEditingSensitive] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [expandedUsageFor, setExpandedUsageFor] = useState<string | null>(null);

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
    setProduct("customer_experience");
    setSensitive(false);
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
      body: JSON.stringify({ name, product, sensitive }),
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
    setEditingSensitive(cat.sensitive);
    setError(null);
  }

  async function saveEdit() {
    if (!editingCategory || !editingName.trim()) return;
    setSavingEdit(true);
    const res = await fetch(`/api/admin/categories/${editingCategory._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editingName, sensitive: editingSensitive }),
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
              <th>Product</th>
              <th>Used in</th>
              <th>Used by</th>
              <th style={{ textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => (
              <Fragment key={c._id}>
                <tr>
                  <td>
                    {c.name}
                    {c.sensitive && (
                      <span className="pill pill-red" style={{ marginLeft: 6 }} title="Sensitive category — bypasses normal category-owner routing">
                        Sensitive
                      </span>
                    )}
                  </td>
                  <td>
                    <span className={`pill ${c.product === "colleague_experience" ? "pill-blue" : "pill-gray"}`}>
                      {c.product === "colleague_experience" ? "Colleague" : "Customer"}
                    </span>
                  </td>
                  <td style={{ color: c.questionCount === 0 ? "var(--text-3)" : undefined }}>
                    {c.questionCount === 0
                      ? "Not currently used"
                      : `${c.questionCount} question${c.questionCount === 1 ? "" : "s"} across ${c.templateCount} template${c.templateCount === 1 ? "" : "s"}`}
                  </td>
                  <td>
                    {c.usedByBusinesses.length === 0 ? (
                      <span className="subtitle" style={{ margin: 0 }}>
                        No business yet
                      </span>
                    ) : (
                      <span
                        className="btn btn-sm"
                        style={{ cursor: "pointer" }}
                        onClick={() => setExpandedUsageFor(expandedUsageFor === c._id ? null : c._id)}
                      >
                        {c.usedByBusinesses.length} business{c.usedByBusinesses.length === 1 ? "" : "es"}{" "}
                        {expandedUsageFor === c._id ? "▲" : "▼"}
                      </span>
                    )}
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
                {expandedUsageFor === c._id && c.usedByBusinesses.length > 0 && (
                  <tr>
                    <td colSpan={5} style={{ background: "var(--bg-2, #f7f7f8)" }}>
                      <ul style={{ margin: "4px 0", paddingLeft: 18, fontSize: "12.5px", color: "var(--text-2)" }}>
                        {c.usedByBusinesses.map((b) => (
                          <li key={b.businessId}>
                            {b.businessName}
                            {b.parentOrgName && <span style={{ color: "var(--text-3)" }}> — {b.parentOrgName}</span>}
                          </li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {categories.length === 0 && (
              <tr>
                <td colSpan={5} className="subtitle">
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
            <div className="field">
              <label>Product</label>
              <select value={product} onChange={(e) => setProduct(e.target.value)}>
                <option value="customer_experience">Customer Experience</option>
                <option value="colleague_experience">Colleague Experience</option>
              </select>
            </div>
            {product === "colleague_experience" && (
              <div className="field" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input type="checkbox" id="cat-sensitive" checked={sensitive} onChange={(e) => setSensitive(e.target.checked)} />
                <label htmlFor="cat-sensitive" style={{ margin: 0 }}>
                  Sensitive (HR/leadership) — bypasses normal category-owner routing, goes to the designated
                  sensitive-routing contact instead
                </label>
              </div>
            )}
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
            {editingCategory.product === "colleague_experience" && (
              <div className="field" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  id="cat-edit-sensitive"
                  checked={editingSensitive}
                  onChange={(e) => setEditingSensitive(e.target.checked)}
                />
                <label htmlFor="cat-edit-sensitive" style={{ margin: 0 }}>
                  Sensitive (HR/leadership) — bypasses normal category-owner routing
                </label>
              </div>
            )}
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
