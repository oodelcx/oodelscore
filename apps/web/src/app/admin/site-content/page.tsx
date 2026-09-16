"use client";

import { useEffect, useState } from "react";

interface NavItem {
  key: string;
  label: string;
  visible: boolean;
  order: number;
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
  { id: "product", label: "Product" },
  { id: "solutions", label: "Solutions" },
  { id: "industries", label: "Industries" },
  { id: "company", label: "Company" },
  { id: "privacy", label: "Privacy Policy" },
  { id: "terms", label: "Terms of Service" },
  { id: "login", label: "Login" },
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
    const content = pages[page];
    const res = await fetch(`/api/admin/site-content/${page}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ navItems: content.navItems, sections: content.sections, fields: content.fields }),
    });
    setSaving(null);
    if (res.ok) setSavedMsg(`${page} saved — live on oodelscore.com`);
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
      <h1>Site Content</h1>
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
      {current && activeTab === "home" && <HomePanel content={current} onFieldChange={updateField} />}
      {current && activeTab === "pricing" && <PricingPanel content={current} onFieldChange={updateField} />}
      {current && activeTab === "product" && <ProductPanel content={current} onFieldChange={updateField} />}
      {current && activeTab === "solutions" && <SolutionsPanel content={current} onFieldChange={updateField} />}
      {current && activeTab === "industries" && <IndustriesPanel content={current} onFieldChange={updateField} />}
      {current && activeTab === "company" && <CompanyPanel content={current} onFieldChange={updateField} />}
      {current && (activeTab === "privacy" || activeTab === "terms") && (
        <LegalPanel content={current} page={activeTab} onFieldChange={updateField} />
      )}
      {current && activeTab === "login" && <LoginPanel content={current} onFieldChange={updateField} />}

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
        <textarea value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      ) : (
        <input type="text" value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      )}
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
  return (
    <div className="grid grid-2">
      <div className="card">
        <h3>Navigation</h3>
        <p className="card-sub">Reorder, rename, or hide. Matches the live nav exactly.</p>
        {content.navItems.map((item, i) => (
          <div className="nav-item-row" key={item.key}>
            <div className="nav-item-top">
              <div className="reorder-arrows">
                <span
                  onClick={() => {
                    if (i === 0) return;
                    const next = [...content.navItems];
                    [next[i - 1], next[i]] = [next[i], next[i - 1]];
                    onNavItemsChange("menu", next.map((n, idx) => ({ ...n, order: idx })));
                  }}
                >
                  ▲
                </span>
                <span
                  onClick={() => {
                    if (i === content.navItems.length - 1) return;
                    const next = [...content.navItems];
                    [next[i], next[i + 1]] = [next[i + 1], next[i]];
                    onNavItemsChange("menu", next.map((n, idx) => ({ ...n, order: idx })));
                  }}
                >
                  ▼
                </span>
              </div>
              <input
                type="text"
                style={{ flex: 1, border: "none", background: "none", padding: 0, fontWeight: 500 }}
                value={item.label}
                onChange={(e) => {
                  const next = [...content.navItems];
                  next[i] = { ...next[i], label: e.target.value };
                  onNavItemsChange("menu", next);
                }}
              />
              <span
                className={`toggle ${item.visible ? "on" : ""}`}
                onClick={() => {
                  const next = [...content.navItems];
                  next[i] = { ...next[i], visible: !next[i].visible };
                  onNavItemsChange("menu", next);
                }}
              />
            </div>
          </div>
        ))}
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
          <b style={{ fontSize: 12.5 }}>Product links</b>
          <StringListEditor
            items={parseJsonArray<string>(content.fields.footerProductLinks)}
            onChange={(items) => onFieldChange("menu", "footerProductLinks", JSON.stringify(items))}
          />
        </div>
        <div style={{ marginBottom: 14 }}>
          <b style={{ fontSize: 12.5 }}>Solutions links</b>
          <StringListEditor
            items={parseJsonArray<string>(content.fields.footerSolutionsLinks)}
            onChange={(items) => onFieldChange("menu", "footerSolutionsLinks", JSON.stringify(items))}
          />
        </div>
        <div style={{ marginBottom: 14 }}>
          <b style={{ fontSize: 12.5 }}>Company links</b>
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

function HomePanel({
  content,
  onFieldChange,
}: {
  content: PageContent;
  onFieldChange: (page: string, key: string, value: string) => void;
}) {
  const steps = parseJsonArray<NarrativeStep>(content.fields.narrativeSteps);
  const levels = parseJsonArray<CxLevel>(content.fields.cxPulseLevels);
  const whyItems = parseJsonArray<TitleBodyItem>(content.fields.whyItems);

  return (
    <>
      <div className="card" style={{ marginBottom: 20 }}>
        <h3>Search &amp; social</h3>
        <p className="card-sub">Shown in Google results and link previews (WhatsApp, Slack, iMessage, etc).</p>
        <Field
          label="Meta description"
          textarea
          value={content.fields.metaDescription}
          onChange={(v) => onFieldChange("home", "metaDescription", v)}
        />
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3>Hero</h3>
        <p className="card-sub">The first thing every visitor sees.</p>
        <Field label="Headline" value={content.fields.heroHeadline} onChange={(v) => onFieldChange("home", "heroHeadline", v)} />
        <Field
          label="Subheadline"
          textarea
          value={content.fields.heroSubheadline}
          onChange={(v) => onFieldChange("home", "heroSubheadline", v)}
        />
        <div className="field-row">
          <Field
            label="Primary button label"
            value={content.fields.heroPrimaryButton}
            onChange={(v) => onFieldChange("home", "heroPrimaryButton", v)}
          />
          <Field
            label="Secondary button label"
            value={content.fields.heroSecondaryButton}
            onChange={(v) => onFieldChange("home", "heroSecondaryButton", v)}
          />
        </div>
        <Field
          label={'"Built for" line'}
          value={content.fields.heroBuiltForLine}
          onChange={(v) => onFieldChange("home", "heroBuiltForLine", v)}
        />
        <Field
          label="Example card rotation speed (seconds)"
          value={content.fields.heroCarouselIntervalSeconds}
          onChange={(v) => onFieldChange("home", "heroCarouselIntervalSeconds", v)}
          placeholder="3"
        />
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3>Narrative — Listen / Act / Measure</h3>
        <div className="field-row">
          <Field
            label="Section headline"
            value={content.fields.narrativeHeadline}
            onChange={(v) => onFieldChange("home", "narrativeHeadline", v)}
          />
        </div>
        <Field
          label="Section subhead"
          value={content.fields.narrativeSubhead}
          onChange={(v) => onFieldChange("home", "narrativeSubhead", v)}
        />
        {steps.map((step, i) => (
          <div className="qrow" key={i}>
            <div className="qrow-top">
              <input
                type="text"
                style={{ width: 110, fontWeight: 600 }}
                value={step.label}
                onChange={(e) => {
                  const next = [...steps];
                  next[i] = { ...next[i], label: e.target.value };
                  onFieldChange("home", "narrativeSteps", JSON.stringify(next));
                }}
              />
              <input
                type="text"
                style={{ flex: 1 }}
                value={step.title}
                onChange={(e) => {
                  const next = [...steps];
                  next[i] = { ...next[i], title: e.target.value };
                  onFieldChange("home", "narrativeSteps", JSON.stringify(next));
                }}
              />
              <span
                className="icon-btn btn-danger"
                onClick={() => onFieldChange("home", "narrativeSteps", JSON.stringify(steps.filter((_, idx) => idx !== i)))}
              >
                🗑
              </span>
            </div>
            <textarea
              value={step.body}
              onChange={(e) => {
                const next = [...steps];
                next[i] = { ...next[i], body: e.target.value };
                onFieldChange("home", "narrativeSteps", JSON.stringify(next));
              }}
            />
          </div>
        ))}
        <button
          className="btn"
          onClick={() => onFieldChange("home", "narrativeSteps", JSON.stringify([...steps, { label: "", title: "", body: "" }]))}
        >
          + Add step
        </button>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3>Scale split</h3>
        <div className="field-row">
          <Field
            label="Section headline"
            value={content.fields.scaleHeadline}
            onChange={(v) => onFieldChange("home", "scaleHeadline", v)}
          />
          <Field label="Section subhead" value={content.fields.scaleSubhead} onChange={(v) => onFieldChange("home", "scaleSubhead", v)} />
        </div>
        <div className="field-row">
          <Field label="Panel 1 tag" value={content.fields.scalePanel1Tag} onChange={(v) => onFieldChange("home", "scalePanel1Tag", v)} />
          <Field label="Panel 2 tag" value={content.fields.scalePanel2Tag} onChange={(v) => onFieldChange("home", "scalePanel2Tag", v)} />
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3>CX Pulse feature</h3>
        <p className="card-sub">
          The 5 levels shown on the site — should match the CX Pulse framework under Configuration, or the marketing site will
          describe a different scale than the product actually uses.
        </p>
        <Field label="Headline" value={content.fields.cxPulseHeadline} onChange={(v) => onFieldChange("home", "cxPulseHeadline", v)} />
        {levels.map((lvl, i) => (
          <div className="qrow" key={i}>
            <div className="qrow-top">
              <input
                type="text"
                style={{ width: 40 }}
                value={lvl.level}
                onChange={(e) => {
                  const next = [...levels];
                  next[i] = { ...next[i], level: e.target.value };
                  onFieldChange("home", "cxPulseLevels", JSON.stringify(next));
                }}
              />
              <input
                type="text"
                style={{ width: 140, fontWeight: 600 }}
                value={lvl.name}
                onChange={(e) => {
                  const next = [...levels];
                  next[i] = { ...next[i], name: e.target.value };
                  onFieldChange("home", "cxPulseLevels", JSON.stringify(next));
                }}
              />
              <input
                type="text"
                style={{ flex: 1 }}
                value={lvl.desc}
                onChange={(e) => {
                  const next = [...levels];
                  next[i] = { ...next[i], desc: e.target.value };
                  onFieldChange("home", "cxPulseLevels", JSON.stringify(next));
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <h3>Why teams choose us</h3>
        {whyItems.map((item, i) => (
          <div className="qrow" key={i}>
            <div className="qrow-top">
              <input
                type="text"
                style={{ flex: 1, fontWeight: 600 }}
                value={item.title}
                onChange={(e) => {
                  const next = [...whyItems];
                  next[i] = { ...next[i], title: e.target.value };
                  onFieldChange("home", "whyItems", JSON.stringify(next));
                }}
              />
              <span
                className="icon-btn btn-danger"
                onClick={() => onFieldChange("home", "whyItems", JSON.stringify(whyItems.filter((_, idx) => idx !== i)))}
              >
                🗑
              </span>
            </div>
            <textarea
              value={item.body}
              onChange={(e) => {
                const next = [...whyItems];
                next[i] = { ...next[i], body: e.target.value };
                onFieldChange("home", "whyItems", JSON.stringify(next));
              }}
            />
          </div>
        ))}
        <button className="btn" onClick={() => onFieldChange("home", "whyItems", JSON.stringify([...whyItems, { title: "", body: "" }]))}>
          + Add item
        </button>
      </div>
    </>
  );
}

interface Plan {
  name: string;
  price: string;
  priceNote: string;
  featured: boolean;
  cta: string;
  features: string[];
}

function PricingPanel({
  content,
  onFieldChange,
}: {
  content: PageContent;
  onFieldChange: (page: string, key: string, value: string) => void;
}) {
  const plans = parseJsonArray<Plan>(content.fields.plans);

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
        <p className="card-sub">Shown above the plan cards, ties the plans back to the Listen → Understand → Act → Measure loop.</p>
        <Field
          label="Strip headline"
          value={content.fields.loopStripHeadline}
          onChange={(v) => onFieldChange("pricing", "loopStripHeadline", v)}
        />
        {(() => {
          const items = parseJsonArray<{ label: string; body: string }>(content.fields.loopStripItems);
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
        <p className="card-sub">&ldquo;Featured&rdquo; highlights one plan visually — only one should be on at a time.</p>
        {plans.map((plan, i) => (
          <div className="qrow" key={i}>
            <div className="qrow-top">
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
            <textarea
              style={{ minHeight: 80 }}
              value={plan.features.join("\n")}
              onChange={(e) => updatePlan(i, { features: e.target.value.split("\n") })}
            />
          </div>
        ))}
        <button
          className="btn"
          onClick={() =>
            onFieldChange(
              "pricing",
              "plans",
              JSON.stringify([...plans, { name: "New plan", price: "", priceNote: "", featured: false, cta: "", features: [] }])
            )
          }
        >
          + Add plan
        </button>
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
}

function ProductPanel({
  content,
  onFieldChange,
}: {
  content: PageContent;
  onFieldChange: (page: string, key: string, value: string) => void;
}) {
  const features = parseJsonArray<Feature>(content.fields.features);

  function updateFeature(i: number, patch: Partial<Feature>) {
    const next = [...features];
    next[i] = { ...next[i], ...patch };
    onFieldChange("product", "features", JSON.stringify(next));
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
          onChange={(v) => onFieldChange("product", "metaDescription", v)}
        />
      </div>
      <div className="card" style={{ marginBottom: 20 }}>
        <h3>Intro</h3>
        <p className="card-sub">Replaces the old big hero band — a slim headline leading straight into the feature sections below.</p>
        <Field label="Headline" value={content.fields.heroHeadline} onChange={(v) => onFieldChange("product", "heroHeadline", v)} />
        <Field
          label="Subheadline"
          textarea
          value={content.fields.heroSubheadline}
          onChange={(v) => onFieldChange("product", "heroSubheadline", v)}
        />
      </div>
      <div className="card">
        <h3>Feature sections</h3>
        <p className="card-sub">
          Each renders as an alternating text/visual row, in this order. Tag should match a real product capability (CX Pulse, Theme
          Intelligence, Root Cause Analysis, Driver Analysis, Action Board, Decision Log) so the right illustrative visual shows.
        </p>
        {features.map((feature, i) => (
          <div className="qrow" key={i}>
            <div className="qrow-top">
              <input
                type="text"
                style={{ width: 160, fontWeight: 600 }}
                placeholder="Tag"
                value={feature.tag}
                onChange={(e) => updateFeature(i, { tag: e.target.value })}
              />
              <input
                type="text"
                style={{ flex: 1 }}
                placeholder="Headline"
                value={feature.headline}
                onChange={(e) => updateFeature(i, { headline: e.target.value })}
              />
              <span
                className="icon-btn btn-danger"
                onClick={() => onFieldChange("product", "features", JSON.stringify(features.filter((_, idx) => idx !== i)))}
              >
                🗑
              </span>
            </div>
            <textarea placeholder="Body" value={feature.body} onChange={(e) => updateFeature(i, { body: e.target.value })} />
          </div>
        ))}
        <button
          className="btn"
          disabled={features.length >= 6}
          onClick={() => onFieldChange("product", "features", JSON.stringify([...features, { tag: "", headline: "", body: "" }]))}
        >
          + Add feature (max 6)
        </button>
      </div>
    </>
  );
}

function SolutionsPanel({
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
          onChange={(v) => onFieldChange("solutions", "metaDescription", v)}
        />
      </div>
      <div className="card" style={{ marginBottom: 20 }}>
        <h3>Hero</h3>
        <Field label="Headline" value={content.fields.heroHeadline} onChange={(v) => onFieldChange("solutions", "heroHeadline", v)} />
        <Field label="Body" textarea value={content.fields.heroBody} onChange={(v) => onFieldChange("solutions", "heroBody", v)} />
      </div>
      <div className="card" style={{ marginBottom: 20 }}>
        <h3>Single business panel</h3>
        <Field label="Title" value={content.fields.singleTitle} onChange={(v) => onFieldChange("solutions", "singleTitle", v)} />
        <StringListEditor
          items={parseJsonArray<string>(content.fields.singlePoints)}
          onChange={(items) => onFieldChange("solutions", "singlePoints", JSON.stringify(items))}
        />
      </div>
      <div className="card" style={{ marginBottom: 20 }}>
        <h3>Multi-location groups panel</h3>
        <Field label="Title" value={content.fields.groupTitle} onChange={(v) => onFieldChange("solutions", "groupTitle", v)} />
        <StringListEditor
          items={parseJsonArray<string>(content.fields.groupPoints)}
          onChange={(items) => onFieldChange("solutions", "groupPoints", JSON.stringify(items))}
        />
      </div>
      <div className="card">
        <h3>Enterprise panel</h3>
        <Field label="Title" value={content.fields.entTitle} onChange={(v) => onFieldChange("solutions", "entTitle", v)} />
        <StringListEditor
          items={parseJsonArray<string>(content.fields.entPoints)}
          onChange={(items) => onFieldChange("solutions", "entPoints", JSON.stringify(items))}
        />
      </div>
    </>
  );
}

interface Sector {
  key: string;
  label: string;
  painPoints: string[];
  outcomes: string[];
  stats: { label: string; value: string }[];
}

function IndustriesPanel({
  content,
  onFieldChange,
}: {
  content: PageContent;
  onFieldChange: (page: string, key: string, value: string) => void;
}) {
  const sectors = parseJsonArray<Sector>(content.fields.sectors);

  function updateSector(i: number, patch: Partial<Sector>) {
    const next = [...sectors];
    next[i] = { ...next[i], ...patch };
    onFieldChange("industries", "sectors", JSON.stringify(next));
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
          onChange={(v) => onFieldChange("industries", "metaDescription", v)}
        />
      </div>
      <div className="card" style={{ marginBottom: 20 }}>
        <h3>Hero</h3>
        <Field label="Headline" value={content.fields.heroHeadline} onChange={(v) => onFieldChange("industries", "heroHeadline", v)} />
        <Field label="Body" textarea value={content.fields.heroBody} onChange={(v) => onFieldChange("industries", "heroBody", v)} />
      </div>
      <div className="card">
        <h3>Sectors (shown as tabs, in this order)</h3>
        <p className="card-sub">Keep pain points and outcomes short — a few sentences, not a full feature list.</p>
        {sectors.map((sector, i) => (
          <div className="qrow" key={sector.key || i} style={{ marginBottom: 18, paddingBottom: 18, borderBottom: "1px solid var(--border,#e4e2dc)" }}>
            <div className="qrow-top">
              <input
                type="text"
                style={{ flex: 1, fontWeight: 600 }}
                placeholder="Label (e.g. Banking)"
                value={sector.label}
                onChange={(e) => updateSector(i, { label: e.target.value, key: sector.key || e.target.value.toLowerCase() })}
              />
              <span
                className="icon-btn btn-danger"
                onClick={() => onFieldChange("industries", "sectors", JSON.stringify(sectors.filter((_, idx) => idx !== i)))}
              >
                🗑
              </span>
            </div>
            <div style={{ fontSize: 12, color: "var(--text-3)", margin: "6px 0" }}>Pain points (one per line)</div>
            <textarea
              value={sector.painPoints.join("\n")}
              onChange={(e) => updateSector(i, { painPoints: e.target.value.split("\n") })}
            />
            <div style={{ fontSize: 12, color: "var(--text-3)", margin: "6px 0" }}>What OodelCX does (one per line)</div>
            <textarea value={sector.outcomes.join("\n")} onChange={(e) => updateSector(i, { outcomes: e.target.value.split("\n") })} />
            <div style={{ fontSize: 12, color: "var(--text-3)", margin: "6px 0" }}>Stat chips</div>
            {sector.stats.map((stat, j) => (
              <div className="field-row" key={j}>
                <input
                  type="text"
                  placeholder="Value (e.g. 9)"
                  value={stat.value}
                  onChange={(e) => {
                    const nextStats = [...sector.stats];
                    nextStats[j] = { ...nextStats[j], value: e.target.value };
                    updateSector(i, { stats: nextStats });
                  }}
                />
                <input
                  type="text"
                  placeholder="Label (e.g. Question types)"
                  value={stat.label}
                  onChange={(e) => {
                    const nextStats = [...sector.stats];
                    nextStats[j] = { ...nextStats[j], label: e.target.value };
                    updateSector(i, { stats: nextStats });
                  }}
                />
              </div>
            ))}
            <button className="btn btn-sm" onClick={() => updateSector(i, { stats: [...sector.stats, { label: "", value: "" }] })}>
              + Add stat
            </button>
          </div>
        ))}
        <button
          className="btn"
          onClick={() =>
            onFieldChange(
              "industries",
              "sectors",
              JSON.stringify([...sectors, { key: "", label: "New sector", painPoints: [], outcomes: [], stats: [] }])
            )
          }
        >
          + Add sector
        </button>
      </div>
    </>
  );
}

function CompanyPanel({
  content,
  onFieldChange,
}: {
  content: PageContent;
  onFieldChange: (page: string, key: string, value: string) => void;
}) {
  const items = parseJsonArray<TitleBodyItem>(content.fields.howWeWorkItems);
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
          label="Mission statement"
          textarea
          value={content.fields.missionStatement}
          onChange={(v) => onFieldChange("company", "missionStatement", v)}
        />
      </div>
      <div className="card" style={{ marginBottom: 20 }}>
        <h3>&ldquo;How we work&rdquo; items</h3>
        {items.map((item, i) => (
          <div className="qrow" key={i}>
            <div className="qrow-top">
              <input
                type="text"
                style={{ flex: 1, fontWeight: 600 }}
                value={item.title}
                onChange={(e) => {
                  const next = [...items];
                  next[i] = { ...next[i], title: e.target.value };
                  onFieldChange("company", "howWeWorkItems", JSON.stringify(next));
                }}
              />
              <span
                className="icon-btn btn-danger"
                onClick={() => onFieldChange("company", "howWeWorkItems", JSON.stringify(items.filter((_, idx) => idx !== i)))}
              >
                🗑
              </span>
            </div>
            <textarea
              value={item.body}
              onChange={(e) => {
                const next = [...items];
                next[i] = { ...next[i], body: e.target.value };
                onFieldChange("company", "howWeWorkItems", JSON.stringify(next));
              }}
            />
          </div>
        ))}
        <button
          className="btn"
          onClick={() => onFieldChange("company", "howWeWorkItems", JSON.stringify([...items, { title: "", body: "" }]))}
        >
          + Add item
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
          <textarea style={{ minHeight: 70 }} value={section.text} onChange={(e) => updateSection(i, { text: e.target.value })} />
        </div>
      ))}
      <button className="btn" onClick={() => onFieldChange(page, "body", JSON.stringify([...sections, { heading: "", text: "" }]))}>
        + Add section
      </button>
      </div>
    </>
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
