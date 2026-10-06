"use client";

import { useEffect, useRef, useState, type CSSProperties, type TextareaHTMLAttributes } from "react";
import { SchemaPanel, SchemaCards } from "./schema-editor";
import { HOME_SCHEMA, PRODUCT_SCHEMA, SOLUTIONS_SCHEMA, SHARED_TEXT_SCHEMA, COMPANY_EXTRA_SCHEMA, PRICING_EXTRA_SCHEMA, CONTACT_EXTRA_SCHEMA } from "./schema";

interface NavItem {
  key: string;
  label: string;
  visible: boolean;
  order: number;
  parentKey?: string;
  children?: string[]; // array of child keys
}

interface PageContent {
  page: string;
  navItems: NavItem[];
  sections: { key: string; label: string; visible: boolean }[];
  fields: Record<string, string>;
}

const TABS: { id: string; label: string }[] = [
  { id: "menu", label: "Menu & Footer" },
  { id: "home", label: "Home" },
  { id: "pricing", label: "Pricing" },
  { id: "customer-x", label: "Customer X" },
  { id: "colleague-x", label: "Colleague X" },
  { id: "solutions", label: "Solutions" },
  { id: "how-it-works", label: "How it works" },
  { id: "company", label: "Company" },
  { id: "contact", label: "Contact" },
  { id: "privacy", label: "Privacy Policy" },
  { id: "terms", label: "Terms of Service" },
  { id: "login", label: "Login" },
  { id: "tooltips", label: "Tooltips" },
];

function parseJsonArray<T>(value: string | undefined): T[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

export default function SiteContentPage() {
  const [pages, setPages] = useState<Record<string, PageContent>>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("menu");
  const [saving, setSaving] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [resetting, setResetting] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/site-content")
      .then((res) => res.json())
      .then((data) => {
        const byPage: Record<string, PageContent> = {};
        for (const p of data.pages ?? []) byPage[p.page] = p;
        setPages(byPage);
      })
      .finally(() => setLoading(false));
  }, []);

  function updateField(page: string, key: string, value: string) {
    setPages((prev) => ({
      ...prev,
      [page]: { ...prev[page], fields: { ...prev[page].fields, [key]: value } },
    }));
  }

  function updateNavItems(page: string, navItems: NavItem[]) {
    setPages((prev) => ({ ...prev, [page]: { ...prev[page], navItems } }));
  }

  async function save(page: string) {
    setSaving(page);
    setSavedMsg(null);
    const results = await Promise.all(
      [page]
        .filter((t) => pages[t])
        .map((t) =>
          fetch(`/api/admin/site-content/${t}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ navItems: pages[t].navItems, sections: pages[t].sections, fields: pages[t].fields }),
          })
        )
    );
    setSaving(null);
    if (results.every((r) => r.ok)) setSavedMsg(`${page} saved — live on oodelscore.com`);
    else setSavedMsg(`Failed to save ${page}`);
  }

  /**
   * Completely overwrites this page's DB content with the latest platform
   * seed defaults — the only way pending copy changes made in the codebase
   * (not this UI) ever reach the live site, since an existing DB doc is
   * never auto-refreshed from the seed. Destructive to any manual edits
   * made here since the last save, hence the confirm.
   */
  async function resetToDefaults(page: string) {
    if (
      !window.confirm(
        `Reset "${page}" to the latest platform defaults?\n\nThis overwrites ALL current content on this page — including any manual edits made here — with the built-in defaults. This cannot be undone.`
      )
    ) {
      return;
    }
    setResetting(page);
    setSavedMsg(null);
    const res = await fetch(`/api/admin/site-content/${page}/reset`, { method: "POST" });
    setResetting(null);
    if (res.ok) {
      const data = await res.json();
      setPages((prev) => ({ ...prev, [page]: data.page }));
      setSavedMsg(`${page} reset to latest defaults — live on oodelscore.com`);
    } else {
      setSavedMsg(`Failed to reset ${page}`);
    }
  }

  if (loading) return <p className="subtitle">Loading…</p>;
  const current = pages[activeTab];

  return (
    <div>
      <h1>Site CMS</h1>
      <p className="subtitle">
        Every section on the live marketing site is generated from what&rsquo;s edited here — nothing on oodelscore.com is
        hard-coded copy.
      </p>
      {savedMsg && <p style={{ color: "var(--accent, #127C57)", fontSize: 13 }}>{savedMsg}</p>}

      <div className="cms-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={activeTab === tab.id ? "active" : ""}
            onClick={() => {
              setActiveTab(tab.id);
              setSavedMsg(null);
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {current && activeTab === "menu" && <MenuPanel content={current} onFieldChange={updateField} onNavItemsChange={updateNavItems} />}
      {current && activeTab === "home" && <SchemaPanel schema={HOME_SCHEMA} page="home" fields={current.fields} onFieldChange={updateField} />}
      {current && activeTab === "pricing" && (
        <>
          <PricingPanel content={current} onFieldChange={updateField} />
          <div className="grid grid-2" style={{ marginTop: 16 }}>
            <SchemaCards schema={PRICING_EXTRA_SCHEMA} page="pricing" fields={current.fields} onFieldChange={updateField} />
          </div>
        </>
      )}
      {current && activeTab === "customer-x" && <SchemaPanel schema={PRODUCT_SCHEMA} page="customer-x" fields={current.fields} onFieldChange={updateField} />}
      {current && activeTab === "colleague-x" && <SchemaPanel schema={PRODUCT_SCHEMA} page="colleague-x" fields={current.fields} onFieldChange={updateField} />}
      {current && activeTab === "solutions" && <SchemaPanel schema={SOLUTIONS_SCHEMA} page="solutions" fields={current.fields} onFieldChange={updateField} />}
      {current && activeTab === "how-it-works" && <HowItWorksPanel content={current} onFieldChange={updateField} />}
      {current && activeTab === "company" && (
        <>
          <CompanyPanel content={current} onFieldChange={updateField} />
          <div className="grid grid-2" style={{ marginTop: 16 }}>
            <SchemaCards schema={COMPANY_EXTRA_SCHEMA} page="company" fields={current.fields} onFieldChange={updateField} />
          </div>
        </>
      )}
      {current && activeTab === "contact" && (
        <>
          <ContactPanel content={current} onFieldChange={updateField} />
          <div className="grid grid-2" style={{ marginTop: 16 }}>
            <SchemaCards schema={CONTACT_EXTRA_SCHEMA} page="contact" fields={current.fields} onFieldChange={updateField} />
          </div>
        </>
      )}
      {current && (activeTab === "privacy" || activeTab === "terms") && (
        <LegalPanel content={current} page={activeTab} onFieldChange={updateField} />
      )}
      {current && activeTab === "login" && <LoginPanel content={current} onFieldChange={updateField} />}
      {activeTab === "tooltips" && <TooltipsPanel />}

      {current && (
        <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button
            className="btn"
            style={{ color: "var(--danger, #c24a3f)" }}
            disabled={resetting === activeTab}
            onClick={() => resetToDefaults(activeTab)}
            title="Overwrites all current content on this page with the latest built-in defaults"
          >
            {resetting === activeTab ? "Resetting…" : "Reset to latest defaults"}
          </button>
          <button className="btn btn-dark" disabled={saving === activeTab} onClick={() => save(activeTab)}>
            {saving === activeTab ? "Saving…" : "Save"}
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * A textarea that always fills its container's width and grows to fit its
 * content instead of starting cramped with a manual drag-handle. Uses the
 * `field-sizing: content` CSS property where supported, with an
 * onInput-driven height reset as a fallback for browsers that don't support
 * it yet (the resize-then-grow pattern below still fires even when
 * field-sizing is active — it's a harmless no-op in that case).
 */
function AutoTextarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  function resize(el: HTMLTextAreaElement | null) {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }

  useEffect(() => {
    resize(ref.current);
  }, [props.value]);

  const { style, onInput, ...rest } = props;
  // `field-sizing` isn't in React's CSSProperties typings yet — cast at the
  // boundary so the rest of the object stays type-checked normally.
  const mergedStyle = {
    width: "100%",
    boxSizing: "border-box",
    resize: "vertical",
    overflow: "hidden",
    fieldSizing: "content",
    ...style,
  } as CSSProperties;

  return (
    <textarea
      {...rest}
      ref={ref}
      style={mergedStyle}
      onInput={(e) => {
        resize(e.currentTarget);
        onInput?.(e);
      }}
    />
  );
}

function Field({
  label,
  value,
  onChange,
  textarea,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  textarea?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      {textarea ? (
        <AutoTextarea value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      ) : (
        <input type="text" value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      )}
    </div>
  );
}

function FinalCtaCard({
  page,
  content,
  onFieldChange,
  showSecondaryButton = true,
}: {
  page: string;
  content: PageContent;
  onFieldChange: (page: string, key: string, value: string) => void;
  showSecondaryButton?: boolean;
}) {
  return (
    <div className="card">
      <h3>Final call-to-action</h3>
      <p className="card-sub">The closing section at the bottom of this page, just above the footer.</p>
      <Field
        label="Headline"
        value={content.fields.finalCtaHeadline}
        onChange={(v) => onFieldChange(page, "finalCtaHeadline", v)}
      />
      <Field
        label="Subhead"
        value={content.fields.finalCtaSubhead}
        onChange={(v) => onFieldChange(page, "finalCtaSubhead", v)}
      />
      <div className="field-row">
        <Field
          label="Primary button text"
          value={content.fields.finalCtaPrimaryButton}
          onChange={(v) => onFieldChange(page, "finalCtaPrimaryButton", v)}
        />
        {showSecondaryButton && (
          <Field
            label="Secondary button text"
            value={content.fields.finalCtaSecondaryButton}
            onChange={(v) => onFieldChange(page, "finalCtaSecondaryButton", v)}
          />
        )}
      </div>
    </div>
  );
}

function StringListEditor({ items, onChange }: { items: string[]; onChange: (items: string[]) => void }) {
  return (
    <div>
      {items.map((item, i) => (
        <div className="nav-item-row" key={i}>
          <div className="nav-item-top">
            <input
              type="text"
              style={{ flex: 1, border: "none", background: "none", padding: 0 }}
              value={item}
              onChange={(e) => {
                const next = [...items];
                next[i] = e.target.value;
                onChange(next);
              }}
            />
            <span
              className="icon-btn btn-danger"
              style={{ cursor: "pointer" }}
              onClick={() => onChange(items.filter((_, idx) => idx !== i))}
            >
              🗑
            </span>
          </div>
        </div>
      ))}
      <button className="btn btn-sm" onClick={() => onChange([...items, ""])}>
        + Add
      </button>
    </div>
  );
}

function MenuPanel({
  content,
  onFieldChange,
  onNavItemsChange,
}: {
  content: PageContent;
  onFieldChange: (page: string, key: string, value: string) => void;
  onNavItemsChange: (page: string, navItems: NavItem[]) => void;
}) {
  const itemsByKey = Object.fromEntries(content.navItems.map((item) => [item.key, item]));

  function updateItem(key: string, patch: Partial<NavItem>) {
    const idx = content.navItems.findIndex((n) => n.key === key);
    if (idx === -1) return;
    const next = [...content.navItems];
    next[idx] = { ...next[idx], ...patch };

    // If setting a parent, update the parent's children array
    if (patch.parentKey !== undefined) {
      const newParentKey = patch.parentKey;
      const oldParentKey = content.navItems[idx].parentKey;

      if (oldParentKey && oldParentKey !== newParentKey) {
        const oldParentIdx = next.findIndex((n) => n.key === oldParentKey);
        if (oldParentIdx !== -1) {
          const oldParentChildren = next[oldParentIdx].children || [];
          next[oldParentIdx] = { ...next[oldParentIdx], children: oldParentChildren.filter((k) => k !== key) };
        }
      }

      if (newParentKey) {
        const newParentIdx = next.findIndex((n) => n.key === newParentKey);
        if (newParentIdx !== -1) {
          const parentChildren = next[newParentIdx].children || [];
          if (!parentChildren.includes(key)) {
            next[newParentIdx] = { ...next[newParentIdx], children: [...parentChildren, key] };
          }
        }
      }
    }

    onNavItemsChange("menu", next);
  }

  function renderNavItem(item: NavItem, depth: number = 0) {
    const childKeys = item.children || [];
    const children = childKeys.map((k) => itemsByKey[k]).filter(Boolean);

    return (
      <div key={item.key}>
        <div className="nav-item-row" style={{ paddingLeft: `${depth * 20}px` }}>
          <div className="nav-item-top">
            <div className="reorder-arrows">
              <span
                style={{ cursor: "pointer" }}
                onClick={() => {
                  const idx = content.navItems.findIndex((n) => n.key === item.key);
                  if (idx <= 0) return;
                  const next = [...content.navItems];
                  [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                  onNavItemsChange("menu", next.map((n, i) => ({ ...n, order: i })));
                }}
              >
                ▲
              </span>
              <span
                style={{ cursor: "pointer" }}
                onClick={() => {
                  const idx = content.navItems.findIndex((n) => n.key === item.key);
                  if (idx >= content.navItems.length - 1) return;
                  const next = [...content.navItems];
                  [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
                  onNavItemsChange("menu", next.map((n, i) => ({ ...n, order: i })));
                }}
              >
                ▼
              </span>
            </div>
            <input
              type="text"
              style={{ flex: 1, border: "none", background: "none", padding: 0, fontWeight: depth === 0 ? 500 : 400 }}
              value={item.label}
              onChange={(e) => updateItem(item.key, { label: e.target.value })}
            />
            <span
              className={`toggle ${item.visible ? "on" : ""}`}
              onClick={() => updateItem(item.key, { visible: !item.visible })}
            />
          </div>
        </div>
        {children.map((child) => renderNavItem(child, depth + 1))}
      </div>
    );
  }

  const rootItems = content.navItems.filter((item) => !item.parentKey).sort((a, b) => a.order - b.order);

  return (
    <div className="grid grid-2">
      <div className="card">
        <h3>Navigation</h3>
        <p className="card-sub">Reorder, rename or hide each menu item. The menu is a single flat row of links.</p>
        {rootItems.map((item) => renderNavItem(item))}
        <button
          className="btn btn-sm"
          onClick={() =>
            onNavItemsChange("menu", [
              ...content.navItems,
              { key: `link_${Date.now()}`, label: "New link", visible: true, order: content.navItems.length },
            ])
          }
        >
          + Add link
        </button>
      </div>
      <div className="card">
        <h3>Footer</h3>
        <p className="card-sub">Tagline and each column&rsquo;s links, matching the live footer.</p>
        <Field label="Tagline" value={content.fields.footerDescription} onChange={(v) => onFieldChange("menu", "footerDescription", v)} />
        <div style={{ marginBottom: 14 }}>
          <b style={{ fontSize: 12.5 }}>Footer column 1 links</b>
          <Field
            label="Column heading"
            value={content.fields.footerProductHeading}
            onChange={(v) => onFieldChange("menu", "footerProductHeading", v)}
            placeholder="Customer X"
          />
          <StringListEditor
            items={parseJsonArray<string>(content.fields.footerProductLinks)}
            onChange={(items) => onFieldChange("menu", "footerProductLinks", JSON.stringify(items))}
          />
        </div>
        <div style={{ marginBottom: 14 }}>
          <b style={{ fontSize: 12.5 }}>Footer column 2 links</b>
          <Field
            label="Column heading"
            value={content.fields.footerSolutionsHeading}
            onChange={(v) => onFieldChange("menu", "footerSolutionsHeading", v)}
            placeholder="Solutions"
          />
          <StringListEditor
            items={parseJsonArray<string>(content.fields.footerSolutionsLinks)}
            onChange={(items) => onFieldChange("menu", "footerSolutionsLinks", JSON.stringify(items))}
          />
        </div>
        <div style={{ marginBottom: 14 }}>
          <b style={{ fontSize: 12.5 }}>Footer column 3 links</b>
          <Field
            label="Column heading"
            value={content.fields.footerCompanyHeading}
            onChange={(v) => onFieldChange("menu", "footerCompanyHeading", v)}
            placeholder="Company"
          />
          <StringListEditor
            items={parseJsonArray<string>(content.fields.footerCompanyLinks)}
            onChange={(items) => onFieldChange("menu", "footerCompanyLinks", JSON.stringify(items))}
          />
        </div>
        <Field label="Copyright text" value={content.fields.copyrightText} onChange={(v) => onFieldChange("menu", "copyrightText", v)} />
      </div>
      <div className="card">
        <h3>Browser tab</h3>
        <p className="card-sub">The name shown in the browser tab and bookmarks, site-wide.</p>
        <Field label="Site name" value={content.fields.siteName} onChange={(v) => onFieldChange("menu", "siteName", v)} />
      </div>
      <div className="card">
        <h3>Header style</h3>
        <p className="card-sub">Applies to the top navigation bar across every marketing page. Defaults to Light if unset.</p>
        <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13.5 }}>
          <span
            className={`toggle ${content.fields.headerStyle === "dark" ? "on" : ""}`}
            onClick={() => onFieldChange("menu", "headerStyle", content.fields.headerStyle === "dark" ? "light" : "dark")}
          />
          {content.fields.headerStyle === "dark" ? "Dark background" : "Light background"}
        </label>
      </div>
      <SchemaCards schema={SHARED_TEXT_SCHEMA} page="menu" fields={content.fields} onFieldChange={onFieldChange} />
    </div>
  );
}

interface NarrativeStep {
  label: string;
  title: string;
  body: string;
}
interface TitleBodyItem {
  title: string;
  body: string;
}
interface CxLevel {
  level: string;
  name: string;
  desc: string;
}

// The 5 C's, in order — used to top up a shorter stored loopStages array
// (e.g. one saved before the 5C rename shipped, still holding 4 items) so
// the editor always has all five slots to fill in, with no missing-stage
// dead end and no separate migration step required.
const DEFAULT_LOOP_STAGES: NarrativeStep[] = [
  { label: "Capture", title: "Collect", body: "A QR scan, a short survey, no app or login." },
  { label: "Clarify", title: "Make sense of it", body: "Themes, root causes, and drivers surfaced automatically." },
  { label: "Claim", title: "Own it", body: "An owned case in Case Management, not a comment nobody reads." },
  { label: "Close", title: "Follow through", body: "Reply to the person who raised it and log the decision that fixed it." },
  { label: "Confirm", title: "Know if it worked", body: "CX Pulse tracks whether the loop is actually closing." },
];

function withDefaultLoopStages(stages: NarrativeStep[]): NarrativeStep[] {
  if (stages.length >= DEFAULT_LOOP_STAGES.length) return stages;
  return [...stages, ...DEFAULT_LOOP_STAGES.slice(stages.length)];
}

interface Plan {
  product?: "customer_experience" | "colleague_experience";
  name: string;
  price: string;
  priceNote: string;
  featured: boolean;
  cta: string;
  features: string[];
}

const DEFAULT_LOOP_STRIP_ITEMS: { label: string; body: string }[] = [
  { label: "Capture", body: "Unlimited QR feedback points and responses" },
  { label: "Clarify", body: "Themes and root causes surfaced automatically" },
  { label: "Claim", body: "Case Management and owned cases included" },
  { label: "Close", body: "Decision Log, Closing the Loop, and Playbooks included" },
  { label: "Confirm", body: "A maturity score on every plan tier" },
];

function withDefaultLoopStripItems(items: { label: string; body: string }[]): { label: string; body: string }[] {
  if (items.length >= DEFAULT_LOOP_STRIP_ITEMS.length) return items;
  return [...items, ...DEFAULT_LOOP_STRIP_ITEMS.slice(items.length)];
}

function PricingPanel({
  content,
  onFieldChange,
}: {
  content: PageContent;
  onFieldChange: (page: string, key: string, value: string) => void;
}) {
  const plans = parseJsonArray<Plan>(content.fields.plans);
  const storedLoopStripItems = parseJsonArray<{ label: string; body: string }>(content.fields.loopStripItems);

  // Same self-heal as the home loop stages — see that panel's comment.
  useEffect(() => {
    if (storedLoopStripItems.length > 0 && storedLoopStripItems.length < DEFAULT_LOOP_STRIP_ITEMS.length) {
      onFieldChange("pricing", "loopStripItems", JSON.stringify(withDefaultLoopStripItems(storedLoopStripItems)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storedLoopStripItems.length]);

  function updatePlan(i: number, patch: Partial<Plan>) {
    const next = [...plans];
    next[i] = { ...next[i], ...patch };
    onFieldChange("pricing", "plans", JSON.stringify(next));
  }

  return (
    <>
      <div className="card" style={{ marginBottom: 20 }}>
        <h3>Search &amp; social</h3>
        <p className="card-sub">Shown in Google results and link previews (WhatsApp, Slack, iMessage, etc).</p>
        <Field
          label="Meta description"
          textarea
          value={content.fields.metaDescription}
          onChange={(v) => onFieldChange("pricing", "metaDescription", v)}
        />
      </div>
      <div className="card" style={{ marginBottom: 20 }}>
        <h3>Pricing hero</h3>
        <Field label="Headline" value={content.fields.heroHeadline} onChange={(v) => onFieldChange("pricing", "heroHeadline", v)} />
        <Field label="Subhead" value={content.fields.heroSubhead} onChange={(v) => onFieldChange("pricing", "heroSubhead", v)} />
      </div>
      <div className="card" style={{ marginBottom: 20 }}>
        <h3>&ldquo;What you get&rdquo; strip</h3>
        <p className="card-sub">Shown above the plan cards, ties the plans back to the Capture → Clarify → Claim → Close → Confirm loop.</p>
        <Field
          label="Strip headline"
          value={content.fields.loopStripHeadline}
          onChange={(v) => onFieldChange("pricing", "loopStripHeadline", v)}
        />
        {(() => {
          const items = withDefaultLoopStripItems(storedLoopStripItems);
          return items.map((item, i) => (
            <div className="qrow" key={i}>
              <div className="qrow-top">
                <input
                  type="text"
                  style={{ width: 140, fontWeight: 600 }}
                  value={item.label}
                  onChange={(e) => {
                    const next = [...items];
                    next[i] = { ...next[i], label: e.target.value };
                    onFieldChange("pricing", "loopStripItems", JSON.stringify(next));
                  }}
                />
                <input
                  type="text"
                  style={{ flex: 1 }}
                  value={item.body}
                  onChange={(e) => {
                    const next = [...items];
                    next[i] = { ...next[i], body: e.target.value };
                    onFieldChange("pricing", "loopStripItems", JSON.stringify(next));
                  }}
                />
              </div>
            </div>
          ));
        })()}
      </div>
      <div className="card" style={{ marginBottom: 20 }}>
        <h3>Plans</h3>
        <p className="card-sub">
          &ldquo;Featured&rdquo; highlights one plan visually — only one per product should be on at a time. Each plan
          is tagged Customer Experience or Colleague Pulse — the public Pricing page renders the two as separate
          sections using the headings below.
        </p>
        <div className="qrow-top" style={{ marginBottom: 12 }}>
          <input
            type="text"
            style={{ flex: 1 }}
            placeholder="Customer Experience section heading"
            value={content.fields.cxPlansHeading}
            onChange={(e) => onFieldChange("pricing", "cxPlansHeading", e.target.value)}
          />
          <input
            type="text"
            style={{ flex: 1 }}
            placeholder="Colleague Pulse section heading"
            value={content.fields.cePlansHeading}
            onChange={(e) => onFieldChange("pricing", "cePlansHeading", e.target.value)}
          />
        </div>
        <Field
          label="Colleague Pulse section subhead"
          value={content.fields.cePlansSubhead}
          onChange={(v) => onFieldChange("pricing", "cePlansSubhead", v)}
        />
        {plans.map((plan, i) => (
          <div className="qrow" key={i}>
            <div className="qrow-top">
              <select
                value={plan.product ?? "customer_experience"}
                onChange={(e) => updatePlan(i, { product: e.target.value as Plan["product"] })}
                style={{ width: 150 }}
              >
                <option value="customer_experience">Customer X</option>
                <option value="colleague_experience">Colleague X</option>
              </select>
              <input type="text" style={{ width: 140, fontWeight: 600 }} value={plan.name} onChange={(e) => updatePlan(i, { name: e.target.value })} />
              <input type="text" style={{ width: 80 }} value={plan.price} onChange={(e) => updatePlan(i, { price: e.target.value })} />
              <input type="text" style={{ flex: 1 }} value={plan.priceNote} onChange={(e) => updatePlan(i, { priceNote: e.target.value })} />
              <input type="text" style={{ width: 130 }} placeholder="CTA label" value={plan.cta} onChange={(e) => updatePlan(i, { cta: e.target.value })} />
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, whiteSpace: "nowrap" }}>
                <input type="checkbox" checked={plan.featured} onChange={(e) => updatePlan(i, { featured: e.target.checked })} /> Featured
              </label>
              <span className="icon-btn btn-danger" onClick={() => onFieldChange("pricing", "plans", JSON.stringify(plans.filter((_, idx) => idx !== i)))}>
                🗑
              </span>
            </div>
            <div style={{ fontSize: 12, color: "var(--text-3)", margin: "6px 0" }}>Features (one per line)</div>
            <AutoTextarea
              style={{ minHeight: 80 }}
              value={plan.features.join("\n")}
              onChange={(e) => updatePlan(i, { features: e.target.value.split("\n") })}
            />
          </div>
        ))}
        <div style={{ display: "flex", gap: 10 }}>
          <button
            className="btn"
            onClick={() =>
              onFieldChange(
                "pricing",
                "plans",
                JSON.stringify([
                  ...plans,
                  { product: "customer_experience", name: "New plan", price: "", priceNote: "", featured: false, cta: "", features: [] },
                ])
              )
            }
          >
            + Add Customer Experience plan
          </button>
          <button
            className="btn"
            onClick={() =>
              onFieldChange(
                "pricing",
                "plans",
                JSON.stringify([
                  ...plans,
                  { product: "colleague_experience", name: "New plan", price: "", priceNote: "", featured: false, cta: "", features: [] },
                ])
              )
            }
          >
            + Add Colleague Pulse plan
          </button>
        </div>
      </div>
      <div className="card">
        <h3>Enterprise note</h3>
        <Field label="" value={content.fields.enterpriseNote} onChange={(v) => onFieldChange("pricing", "enterpriseNote", v)} />
      </div>
    </>
  );
}

interface Feature {
  tag: string;
  headline: string;
  body: string;
  group?: "understand" | "act";
  menuFeatured?: boolean;
}

interface IndustryDetail {
  slug: string;
  name: string;
  tagline: string;
  heroBody: string;
  locationNoun: string;
  standaloneBody: string;
  groupBody: string;
  benefits: string[];
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

interface HowItWorksStep {
  title: string;
  body: string;
}

function HowItWorksPanel({
  content,
  onFieldChange,
}: {
  content: PageContent;
  onFieldChange: (page: string, key: string, value: string) => void;
}) {
  const steps = parseJsonArray<HowItWorksStep>(content.fields.steps);

  function updateStep(i: number, patch: Partial<HowItWorksStep>) {
    const next = [...steps];
    next[i] = { ...next[i], ...patch };
    onFieldChange("how-it-works", "steps", JSON.stringify(next));
  }

  return (
    <>
      <div className="card" style={{ marginBottom: 20 }}>
        <h3>Search &amp; social</h3>
        <p className="card-sub">Shown in Google results and link previews (WhatsApp, Slack, iMessage, etc).</p>
        <Field
          label="Meta description"
          textarea
          value={content.fields.metaDescription}
          onChange={(v) => onFieldChange("how-it-works", "metaDescription", v)}
        />
      </div>
      <div className="card" style={{ marginBottom: 20 }}>
        <h3>Hero</h3>
        <Field
          label="Headline"
          value={content.fields.heroHeadline}
          onChange={(v) => onFieldChange("how-it-works", "heroHeadline", v)}
        />
        <Field label="Body" textarea value={content.fields.heroBody} onChange={(v) => onFieldChange("how-it-works", "heroBody", v)} />
      </div>
      <div className="card">
        <h3>Steps (shown in this order, numbered automatically)</h3>
        <p className="card-sub">The actual sequence a business goes through — QR code to measured result. Keep each step concrete.</p>
        {steps.map((step, i) => (
          <div className="qrow" key={i} style={{ marginBottom: 18, paddingBottom: 18, borderBottom: "1px solid var(--border,#e4e2dc)" }}>
            <div className="qrow-top">
              <span style={{ fontFamily: "var(--font-mono, monospace)", color: "var(--text-3)", marginRight: 4 }}>{i + 1}.</span>
              <input
                type="text"
                style={{ flex: 1, fontWeight: 600 }}
                placeholder="Step title"
                value={step.title}
                onChange={(e) => updateStep(i, { title: e.target.value })}
              />
              <span
                className="icon-btn btn-danger"
                onClick={() => onFieldChange("how-it-works", "steps", JSON.stringify(steps.filter((_, idx) => idx !== i)))}
              >
                🗑
              </span>
            </div>
            <div style={{ fontSize: 12, color: "var(--text-3)", margin: "6px 0" }}>Body</div>
            <AutoTextarea value={step.body} onChange={(e) => updateStep(i, { body: e.target.value })} />
          </div>
        ))}
        <button
          className="btn"
          onClick={() => onFieldChange("how-it-works", "steps", JSON.stringify([...steps, { title: "New step", body: "" }]))}
        >
          + Add step
        </button>
      </div>
      <div style={{ marginTop: 20 }}>
        <FinalCtaCard page="how-it-works" content={content} onFieldChange={onFieldChange} />
      </div>
    </>
  );
}

interface BeliefItem {
  icon: string;
  title: string;
  body: string;
}
interface AudienceContentItem {
  slug: string;
  name: string;
  body: string;
}

const BELIEF_ICON_OPTIONS = ["loop", "scale", "check", "signal"] as const;

function CompanyPanel({
  content,
  onFieldChange,
}: {
  content: PageContent;
  onFieldChange: (page: string, key: string, value: string) => void;
}) {
  const storyParagraphs = parseJsonArray<string>(content.fields.storyParagraphs);
  const beliefs = parseJsonArray<BeliefItem>(content.fields.beliefs);
  const audienceItems = parseJsonArray<AudienceContentItem>(content.fields.audienceItems);

  return (
    <>
      <div className="card" style={{ marginBottom: 20 }}>
        <h3>Search &amp; social</h3>
        <p className="card-sub">Shown in Google results and link previews (WhatsApp, Slack, iMessage, etc).</p>
        <Field
          label="Meta description"
          textarea
          value={content.fields.metaDescription}
          onChange={(v) => onFieldChange("company", "metaDescription", v)}
        />
      </div>
      <div className="card" style={{ marginBottom: 20 }}>
        <h3>Hero & mission</h3>
        <Field label="Headline" value={content.fields.heroHeadline} onChange={(v) => onFieldChange("company", "heroHeadline", v)} />
        <Field
          label="Highlighted portion (shown in italic accent green)"
          value={content.fields.heroHighlight}
          onChange={(v) => onFieldChange("company", "heroHighlight", v)}
        />
        {!!content.fields.heroHighlight && !content.fields.heroHeadline?.includes(content.fields.heroHighlight) && (
          <p className="error-text">This text doesn&rsquo;t appear in the headline above, so nothing will be highlighted.</p>
        )}
        <div className="field-hint" style={{ marginBottom: 8 }}>
          Must match a portion of the headline exactly (including punctuation) to be highlighted.
        </div>
        <Field
          label="Mission statement (sits next to the headline)"
          textarea
          value={content.fields.missionStatement}
          onChange={(v) => onFieldChange("company", "missionStatement", v)}
        />
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3>&ldquo;Our story&rdquo; section</h3>
        <Field
          label="Eyebrow label"
          value={content.fields.storyEyebrow}
          onChange={(v) => onFieldChange("company", "storyEyebrow", v)}
        />
        <Field
          label="Section headline"
          value={content.fields.storyHeadline}
          onChange={(v) => onFieldChange("company", "storyHeadline", v)}
        />
        <label style={{ display: "block", marginTop: 14, marginBottom: 6, fontWeight: 600, fontSize: 13.5 }}>
          Paragraphs (rendered in order)
        </label>
        {storyParagraphs.map((p, i) => (
          <div className="qrow" key={i}>
            <div className="qrow-top">
              <span style={{ fontSize: 12.5, color: "var(--text-2)" }}>Paragraph {i + 1}</span>
              <span
                className="icon-btn btn-danger"
                onClick={() =>
                  onFieldChange("company", "storyParagraphs", JSON.stringify(storyParagraphs.filter((_, idx) => idx !== i)))
                }
              >
                🗑
              </span>
            </div>
            <AutoTextarea
              value={p}
              onChange={(e) => {
                const next = [...storyParagraphs];
                next[i] = e.target.value;
                onFieldChange("company", "storyParagraphs", JSON.stringify(next));
              }}
            />
          </div>
        ))}
        <button
          className="btn"
          onClick={() => onFieldChange("company", "storyParagraphs", JSON.stringify([...storyParagraphs, ""]))}
        >
          + Add paragraph
        </button>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3>&ldquo;What we believe&rdquo; section</h3>
        <Field
          label="Eyebrow label"
          value={content.fields.beliefsEyebrow}
          onChange={(v) => onFieldChange("company", "beliefsEyebrow", v)}
        />
        <Field
          label="Section headline"
          value={content.fields.beliefsHeadline}
          onChange={(v) => onFieldChange("company", "beliefsHeadline", v)}
        />
        <label style={{ display: "block", marginTop: 14, marginBottom: 6, fontWeight: 600, fontSize: 13.5 }}>
          Belief cards
        </label>
        {beliefs.map((item, i) => (
          <div className="qrow" key={i}>
            <div className="qrow-top">
              <select
                value={item.icon}
                onChange={(e) => {
                  const next = [...beliefs];
                  next[i] = { ...next[i], icon: e.target.value };
                  onFieldChange("company", "beliefs", JSON.stringify(next));
                }}
                style={{ marginRight: 8 }}
              >
                {BELIEF_ICON_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              <input
                type="text"
                style={{ flex: 1, fontWeight: 600 }}
                value={item.title}
                onChange={(e) => {
                  const next = [...beliefs];
                  next[i] = { ...next[i], title: e.target.value };
                  onFieldChange("company", "beliefs", JSON.stringify(next));
                }}
              />
              <span
                className="icon-btn btn-danger"
                onClick={() => onFieldChange("company", "beliefs", JSON.stringify(beliefs.filter((_, idx) => idx !== i)))}
              >
                🗑
              </span>
            </div>
            <AutoTextarea
              value={item.body}
              onChange={(e) => {
                const next = [...beliefs];
                next[i] = { ...next[i], body: e.target.value };
                onFieldChange("company", "beliefs", JSON.stringify(next));
              }}
            />
          </div>
        ))}
        <button
          className="btn"
          onClick={() =>
            onFieldChange("company", "beliefs", JSON.stringify([...beliefs, { icon: "loop", title: "", body: "" }]))
          }
        >
          + Add belief
        </button>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3>&ldquo;Who we build for&rdquo; section</h3>
        <Field
          label="Eyebrow label"
          value={content.fields.audienceEyebrow}
          onChange={(v) => onFieldChange("company", "audienceEyebrow", v)}
        />
        <Field
          label="Section headline"
          textarea
          value={content.fields.audienceHeadline}
          onChange={(v) => onFieldChange("company", "audienceHeadline", v)}
        />
        <div className="field-hint" style={{ marginBottom: 8 }}>
          The slug controls which icon renders — use banking, education, retail, or healthcare to match the icon set,
          or any other slug for a generic mark. Each card links to /solutions.
        </div>
        {audienceItems.map((item, i) => (
          <div className="qrow" key={i}>
            <div className="qrow-top">
              <input
                type="text"
                style={{ width: 110, fontFamily: "monospace", fontSize: 12.5 }}
                value={item.slug}
                placeholder="slug"
                onChange={(e) => {
                  const next = [...audienceItems];
                  next[i] = { ...next[i], slug: e.target.value };
                  onFieldChange("company", "audienceItems", JSON.stringify(next));
                }}
              />
              <input
                type="text"
                style={{ flex: 1, fontWeight: 600 }}
                value={item.name}
                placeholder="Name"
                onChange={(e) => {
                  const next = [...audienceItems];
                  next[i] = { ...next[i], name: e.target.value };
                  onFieldChange("company", "audienceItems", JSON.stringify(next));
                }}
              />
              <span
                className="icon-btn btn-danger"
                onClick={() =>
                  onFieldChange("company", "audienceItems", JSON.stringify(audienceItems.filter((_, idx) => idx !== i)))
                }
              >
                🗑
              </span>
            </div>
            <AutoTextarea
              value={item.body}
              onChange={(e) => {
                const next = [...audienceItems];
                next[i] = { ...next[i], body: e.target.value };
                onFieldChange("company", "audienceItems", JSON.stringify(next));
              }}
            />
          </div>
        ))}
        <button
          className="btn"
          onClick={() =>
            onFieldChange(
              "company",
              "audienceItems",
              JSON.stringify([...audienceItems, { slug: "", name: "", body: "" }])
            )
          }
        >
          + Add industry
        </button>
      </div>

      <div className="card">
        <h3>Contact</h3>
        <Field
          label="Contact email shown on page"
          value={content.fields.contactEmail}
          onChange={(v) => onFieldChange("company", "contactEmail", v)}
        />
      </div>

      <FinalCtaCard page="company" content={content} onFieldChange={onFieldChange} showSecondaryButton={false} />
    </>
  );
}

function ContactPanel({
  content,
  onFieldChange,
}: {
  content: PageContent;
  onFieldChange: (page: string, key: string, value: string) => void;
}) {
  return (
    <>
      <div className="card" style={{ marginBottom: 20 }}>
        <h3>Search &amp; social</h3>
        <p className="card-sub">Shown in Google results and link previews (WhatsApp, Slack, iMessage, etc).</p>
        <Field
          label="Meta description"
          textarea
          value={content.fields.metaDescription}
          onChange={(v) => onFieldChange("contact", "metaDescription", v)}
        />
      </div>
      <div className="card" style={{ marginBottom: 20 }}>
        <h3>Hero</h3>
        <Field label="Headline" value={content.fields.heroHeadline} onChange={(v) => onFieldChange("contact", "heroHeadline", v)} />
        <Field
          label="Subhead"
          textarea
          value={content.fields.heroSubhead}
          onChange={(v) => onFieldChange("contact", "heroSubhead", v)}
        />
      </div>
      <div className="card" style={{ marginBottom: 20 }}>
        <h3>Success message</h3>
        <p className="card-sub">Shown in place of the form once a message is sent.</p>
        <Field
          label="Headline"
          value={content.fields.successHeadline}
          onChange={(v) => onFieldChange("contact", "successHeadline", v)}
        />
        <Field
          label="Body"
          textarea
          value={content.fields.successBody}
          onChange={(v) => onFieldChange("contact", "successBody", v)}
        />
      </div>
      <div className="card">
        <h3>Contact</h3>
        <Field
          label="Contact email (for reference — not shown on the page)"
          value={content.fields.contactEmail}
          onChange={(v) => onFieldChange("contact", "contactEmail", v)}
        />
      </div>
    </>
  );
}

interface LegalSection {
  heading: string;
  text: string;
}

function LegalPanel({
  content,
  page,
  onFieldChange,
}: {
  content: PageContent;
  page: string;
  onFieldChange: (page: string, key: string, value: string) => void;
}) {
  const sections = parseJsonArray<LegalSection>(content.fields.body);

  function updateSection(i: number, patch: Partial<LegalSection>) {
    const next = [...sections];
    next[i] = { ...next[i], ...patch };
    onFieldChange(page, "body", JSON.stringify(next));
  }

  return (
    <>
      <div className="card" style={{ marginBottom: 20 }}>
        <h3>Search &amp; social</h3>
        <p className="card-sub">Shown in Google results and link previews (WhatsApp, Slack, iMessage, etc).</p>
        <Field
          label="Meta description"
          textarea
          value={content.fields.metaDescription}
          onChange={(v) => onFieldChange(page, "metaDescription", v)}
        />
      </div>
      <div className="card">
      <h3>Page heading</h3>
      <div className="field-row">
        <Field label="Heading" value={content.fields.heading} onChange={(v) => onFieldChange(page, "heading", v)} />
        <Field label="Last updated" value={content.fields.lastUpdated} onChange={(v) => onFieldChange(page, "lastUpdated", v)} />
      </div>
      <h3 style={{ marginTop: 24 }}>Sections</h3>
      {sections.map((section, i) => (
        <div className="qrow" key={i}>
          <div className="qrow-top">
            <input
              type="text"
              style={{ flex: 1, fontWeight: 600 }}
              value={section.heading}
              onChange={(e) => updateSection(i, { heading: e.target.value })}
            />
            <span className="icon-btn btn-danger" onClick={() => onFieldChange(page, "body", JSON.stringify(sections.filter((_, idx) => idx !== i)))}>
              🗑
            </span>
          </div>
          <AutoTextarea style={{ minHeight: 70 }} value={section.text} onChange={(e) => updateSection(i, { text: e.target.value })} />
        </div>
      ))}
      <button className="btn" onClick={() => onFieldChange(page, "body", JSON.stringify([...sections, { heading: "", text: "" }]))}>
        + Add section
      </button>
      </div>
    </>
  );
}

interface TooltipEntry {
  key: string;
  label: string;
  text: string;
}
interface TooltipScreenData {
  screenKey: string;
  screenLabel: string;
  tooltips: TooltipEntry[];
}

/**
 * Structurally separate from the marketing-page fields above (a
 * TooltipScreen doc is `{ screenKey, screenLabel, tooltips: [] }`, not the
 * Map<string,string>-per-page shape those panels edit) — so it manages its
 * own fetch/save cycle rather than plugging into the `pages` state and the
 * outer Save/Reset footer above.
 *
 * Built as a list that iterates over however many screens the API returns,
 * so a future phase adding more screens (e.g. "business-dashboard") needs
 * no changes here — the second-level nav and editor just grow to match.
 */
function TooltipsPanel() {
  const [screens, setScreens] = useState<TooltipScreenData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeScreen, setActiveScreen] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/tooltips")
      .then((res) => res.json())
      .then((data) => {
        const list: TooltipScreenData[] = data.screens ?? [];
        setScreens(list);
        setActiveScreen((prev) => prev ?? list[0]?.screenKey ?? null);
      })
      .finally(() => setLoading(false));
  }, []);

  function updateEntryText(screenKey: string, entryKey: string, text: string) {
    setScreens((prev) =>
      prev.map((s) =>
        s.screenKey !== screenKey
          ? s
          : { ...s, tooltips: s.tooltips.map((t) => (t.key === entryKey ? { ...t, text } : t)) }
      )
    );
  }

  async function save(screenKey: string) {
    const screen = screens.find((s) => s.screenKey === screenKey);
    if (!screen) return;
    setSaving(screenKey);
    setSavedMsg(null);
    const res = await fetch(`/api/admin/tooltips/${screenKey}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tooltips: screen.tooltips }),
    });
    setSaving(null);
    setSavedMsg(res.ok ? `${screen.screenLabel} tooltips saved` : `Failed to save ${screen.screenLabel}`);
  }

  if (loading) return <p className="subtitle">Loading…</p>;
  const current = screens.find((s) => s.screenKey === activeScreen);

  return (
    <div>
      <p className="card-sub" style={{ marginBottom: 12 }}>
        Copy shown in the (i) info icons across the product&rsquo;s dashboards. Each screen below lists its tooltips in
        display order.
      </p>
      {savedMsg && <p style={{ color: "var(--accent, #127C57)", fontSize: 13, marginBottom: 10 }}>{savedMsg}</p>}

      <div className="cms-tabs" style={{ marginBottom: 16 }}>
        {screens.map((s) => (
          <button
            key={s.screenKey}
            className={activeScreen === s.screenKey ? "active" : ""}
            onClick={() => {
              setActiveScreen(s.screenKey);
              setSavedMsg(null);
            }}
          >
            {s.screenLabel}
          </button>
        ))}
      </div>

      {current && (
        <div className="card">
          <h3>{current.screenLabel}</h3>
          {current.tooltips.map((entry) => (
            <div className="field" key={entry.key}>
              <label>{entry.label}</label>
              <AutoTextarea
                value={entry.text}
                onChange={(e) => updateEntryText(current.screenKey, entry.key, e.target.value)}
              />
            </div>
          ))}
          <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
            <button
              className="btn btn-dark"
              disabled={saving === current.screenKey}
              onClick={() => save(current.screenKey)}
            >
              {saving === current.screenKey ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function LoginHeadlinePreview({
  headline,
  highlight,
  imageUrl,
}: {
  headline: string;
  highlight: string;
  imageUrl?: string;
}) {
  const index = highlight ? headline.indexOf(highlight) : -1;
  const text =
    index === -1 ? (
      headline
    ) : (
      <>
        {headline.slice(0, index)}
        <span style={{ color: "#3fbe8b" }}>{headline.slice(index, index + highlight.length)}</span>
        {headline.slice(index + highlight.length)}
      </>
    );

  return (
    <div
      style={{
        background: imageUrl ? `linear-gradient(0deg, rgba(0,0,0,.65), rgba(0,0,0,.15)), url(${imageUrl}) center/cover` : "#111412",
        color: "#fff",
        borderRadius: 12,
        padding: "28px 32px",
        fontSize: 22,
        fontWeight: 700,
        lineHeight: 1.2,
        maxWidth: 420,
        minHeight: imageUrl ? 220 : undefined,
        display: "flex",
        alignItems: "flex-end",
      }}
    >
      {text}
    </div>
  );
}

function LoginPanel({
  content,
  onFieldChange,
}: {
  content: PageContent;
  onFieldChange: (page: string, key: string, value: string) => void;
}) {
  const headline = content.fields.heroHeadline ?? "";
  const highlight = content.fields.heroHighlight ?? "";
  const imageUrl = content.fields.heroImageUrl ?? "";
  const highlightNotFound = !!highlight && !headline.includes(highlight);

  return (
    <div className="card">
      <h3>Sign-in screen</h3>
      <p className="card-sub">
        Shown on the left 60% panel of the Login, Forgot Password, and Set Password screens.
      </p>
      <Field
        label="Background image URL (optional)"
        value={imageUrl}
        onChange={(v) => onFieldChange("login", "heroImageUrl", v)}
        placeholder="https://…"
      />
      <div className="field-hint" style={{ marginBottom: 16 }}>
        Recommended size: at least <b>1600 × 2000px</b> (portrait, roughly 4:5) so it covers the panel cleanly
        from a tall narrow laptop screen up to a large desktop monitor without upscaling — it&rsquo;s cropped to
        fill with the subject centered, so keep anything important away from the edges. JPEG or WebP, ideally
        under 400KB. Leave blank to keep the plain dark background with the headline below.
      </div>
      <Field label="Tagline" textarea value={headline} onChange={(v) => onFieldChange("login", "heroHeadline", v)} />
      <Field
        label="Highlighted portion (shown in green)"
        value={highlight}
        onChange={(v) => onFieldChange("login", "heroHighlight", v)}
      />
      {highlightNotFound && (
        <p className="error-text">This text doesn&rsquo;t appear in the headline above, so nothing will be highlighted.</p>
      )}
      <div className="field-hint" style={{ marginBottom: 8 }}>
        Must match a portion of the headline exactly (including punctuation) to be highlighted.
        {imageUrl && " With a background image set, the headline shows near the bottom over a darkened gradient."}
      </div>
      <div style={{ marginTop: 16 }}>
        <div className="field-hint" style={{ marginBottom: 8 }}>
          Preview
        </div>
        <LoginHeadlinePreview headline={headline} highlight={highlight} imageUrl={imageUrl} />
      </div>
    </div>
  );
}
