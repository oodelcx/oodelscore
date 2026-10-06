"use client";

import { useEffect, useRef, useState, type CSSProperties, type TextareaHTMLAttributes } from "react";
import type { FieldDef, SectionDef } from "./schema";

type Obj = Record<string, unknown>;

function parseList(value: string | undefined): unknown[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function AutoText(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [props.value]);
  const style = { width: "100%", boxSizing: "border-box", resize: "vertical", overflow: "hidden", fieldSizing: "content" } as CSSProperties;
  return <textarea {...props} ref={ref} style={style} />;
}

const boxStyle: CSSProperties = { border: "1px solid var(--line, #e4e2dc)", borderRadius: 10, padding: 12, marginBottom: 10 };

/** One field, by type. `value`/`onChange` are the raw stored form (a string, or an object for list items). */
function FieldEditor({ def, value, onChange }: { def: FieldDef; value: unknown; onChange: (v: unknown) => void }) {
  // Lists inside a stored object arrive as real arrays; the editors below work on their JSON text.
  const str = typeof value === "string" ? value : Array.isArray(value) ? JSON.stringify(value) : value == null ? "" : String(value);
  if (def.type === "text") {
    return (
      <div className="field">
        <label>{def.label}</label>
        <input type="text" value={str} onChange={(e) => onChange(e.target.value)} />
        {def.hint && <small className="card-sub">{def.hint}</small>}
      </div>
    );
  }
  if (def.type === "textarea") {
    return (
      <div className="field">
        <label>{def.label}</label>
        <AutoText value={str} onChange={(e) => onChange(e.target.value)} />
        {def.hint && <small className="card-sub">{def.hint}</small>}
      </div>
    );
  }
  if (def.type === "select") {
    return (
      <div className="field">
        <label>{def.label}</label>
        <select value={str} onChange={(e) => onChange(e.target.value)}>
          {!def.options.some((o) => o.value === str) && <option value={str}>{str || "—"}</option>}
          {def.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    );
  }
  if (def.type === "sectorEditor") {
    return <SectorEditor def={def} str={str} onChange={onChange} />;
  }
  if (def.type === "stringList") {
    const items = parseList(str).map((x) => String(x));
    return (
      <div className="field">
        <label>{def.label}</label>
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
                  onChange(JSON.stringify(next));
                }}
              />
              <span className="icon-btn btn-danger" style={{ cursor: "pointer" }} onClick={() => onChange(JSON.stringify(items.filter((_, idx) => idx !== i)))}>
                🗑
              </span>
            </div>
          </div>
        ))}
        <button type="button" className="btn btn-sm" onClick={() => onChange(JSON.stringify([...items, ""]))}>
          + Add
        </button>
        {def.hint && <small className="card-sub">{def.hint}</small>}
      </div>
    );
  }
  // objectList
  const items = parseList(str) as Obj[];
  const update = (next: Obj[]) => onChange(JSON.stringify(next));
  return (
    <div className="field">
      <label>{def.label}</label>
      {items.map((item, i) => (
        <div style={boxStyle} key={i}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <b style={{ fontSize: 12.5 }}>
              {def.itemLabel} {i + 1}
            </b>
            <span style={{ display: "flex", gap: 8 }}>
              {i > 0 && (
                <span style={{ cursor: "pointer" }} title="Move up" onClick={() => { const n = [...items]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; update(n); }}>
                  ▲
                </span>
              )}
              {i < items.length - 1 && (
                <span style={{ cursor: "pointer" }} title="Move down" onClick={() => { const n = [...items]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; update(n); }}>
                  ▼
                </span>
              )}
              {!def.fixedLength && (
                <span className="icon-btn btn-danger" style={{ cursor: "pointer" }} onClick={() => update(items.filter((_, idx) => idx !== i))}>
                  🗑
                </span>
              )}
            </span>
          </div>
          {def.item.map((sub) => (
            <FieldEditor
              key={sub.key}
              def={sub}
              value={item[sub.key]}
              onChange={(v) => {
                const n = [...items];
                n[i] = { ...item, [sub.key]: v };
                update(n);
              }}
            />
          ))}
        </div>
      ))}
      {!def.fixedLength && (
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => update([...items, Object.fromEntries(def.item.map((s) => [s.key, s.type === "stringList" || s.type === "objectList" ? "[]" : s.type === "select" ? s.options[0]?.value ?? "" : ""]))])}
        >
          + Add {def.itemLabel.toLowerCase()}
        </button>
      )}
      {def.hint && <small className="card-sub">{def.hint}</small>}
    </div>
  );
}

const LIST_TYPES = new Set(["stringList", "objectList"]);

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return [];
  }
}

/** Blank value for a new item: lists start empty, the rest start as empty text. */
function blankFor(defs: FieldDef[]): Obj {
  return Object.fromEntries(defs.map((d) => [d.key, LIST_TYPES.has(d.type) ? [] : d.type === "select" ? d.options[0]?.value ?? "" : ""]));
}

const pillStyle = (active: boolean): CSSProperties => ({
  padding: "7px 14px",
  borderRadius: 99,
  border: "1px solid var(--line, #e4e2dc)",
  background: active ? "var(--ink, #111)" : "transparent",
  color: active ? "#fff" : "inherit",
  fontSize: 13,
  cursor: "pointer",
});

/**
 * One list of items (the website's sectors) edited master/detail: a compact
 * list with a show/hide switch on the left, the chosen item's fields in tabs
 * on the right, so nobody has to scroll past every other item to find one.
 */
function SectorEditor({ def, str, onChange }: { def: Extract<FieldDef, { type: "sectorEditor" }>; str: string; onChange: (v: unknown) => void }) {
  const [sel, setSel] = useState(0);
  const [tab, setTab] = useState(0);
  const items = parseList(str) as Obj[];
  const idx = Math.min(sel, Math.max(0, items.length - 1));
  const cur = items[idx];
  const write = (next: Obj[]) => onChange(JSON.stringify(next));
  const isOn = (o: Obj) => o[def.visibleKey] !== "no";
  const allFields = def.tabs.flatMap((t) => t.fields);
  const activeTab = def.tabs[Math.min(tab, def.tabs.length - 1)];

  function move(i: number, by: number) {
    const j = i + by;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    write(next);
    if (idx === i) setSel(j);
    else if (idx === j) setSel(i);
  }

  function add() {
    const n = items.length + 1;
    write([...items, { ...blankFor(allFields), [def.nameKey]: "New sector", slug: `new-sector-${n}`, [def.visibleKey]: "no" }]);
    setSel(items.length);
    setTab(0);
  }

  function remove() {
    if (!cur || !window.confirm(`Delete “${String(cur[def.nameKey] ?? "this sector")}” and all its text? This cannot be undone.`)) return;
    write(items.filter((_, i) => i !== idx));
    setSel(Math.max(0, idx - 1));
  }

  return (
    <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-start" }}>
      <div style={{ flex: "0 0 270px", maxWidth: "100%", display: "grid", gap: 6 }}>
        {items.map((o, i) => (
          <div
            key={i}
            onClick={() => setSel(i)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "9px 10px",
              borderRadius: 10,
              cursor: "pointer",
              border: `1px solid ${i === idx ? "var(--ink, #111)" : "var(--line, #e4e2dc)"}`,
              background: i === idx ? "var(--surface-2, rgba(0,0,0,.04))" : "transparent",
            }}
          >
            <span style={{ flex: 1, fontSize: 13.5, fontWeight: i === idx ? 700 : 500, opacity: isOn(o) ? 1 : 0.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {String(o[def.nameKey] || `Sector ${i + 1}`)}
            </span>
            <span style={{ display: "flex", flexDirection: "column", lineHeight: 1, fontSize: 9, opacity: 0.6 }}>
              <span title="Move up" style={{ cursor: "pointer", visibility: i > 0 ? "visible" : "hidden" }} onClick={(e) => { e.stopPropagation(); move(i, -1); }}>
                ▲
              </span>
              <span title="Move down" style={{ cursor: "pointer", visibility: i < items.length - 1 ? "visible" : "hidden" }} onClick={(e) => { e.stopPropagation(); move(i, 1); }}>
                ▼
              </span>
            </span>
            <span
              className={`toggle ${isOn(o) ? "on" : ""}`}
              role="switch"
              aria-checked={isOn(o)}
              title={isOn(o) ? "Shown on the website. Click to hide." : "Hidden. Click to show."}
              onClick={(e) => {
                e.stopPropagation();
                write(items.map((x, j) => (j === i ? { ...x, [def.visibleKey]: isOn(x) ? "no" : "yes" } : x)));
              }}
            />
          </div>
        ))}
        <button type="button" className="btn btn-sm" onClick={add}>
          + Add sector
        </button>
        <small className="card-sub">A new sector starts hidden. Fill it in, then switch it on.</small>
      </div>

      {cur ? (
        <div style={{ flex: "1 1 420px", minWidth: 0 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 12 }}>
            <div className="field" style={{ flex: "1 1 240px", margin: 0 }}>
              <label>Sector name</label>
              <input type="text" value={String(cur[def.nameKey] ?? "")} onChange={(e) => write(items.map((x, j) => (j === idx ? { ...x, [def.nameKey]: e.target.value } : x)))} />
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, paddingBottom: 8 }}>
              <span
                className={`toggle ${isOn(cur) ? "on" : ""}`}
                role="switch"
                aria-checked={isOn(cur)}
                onClick={() => write(items.map((x, j) => (j === idx ? { ...x, [def.visibleKey]: isOn(x) ? "no" : "yes" } : x)))}
              />
              {isOn(cur) ? "Shown on the website" : "Hidden"}
            </label>
            <button type="button" className="btn btn-sm btn-danger" onClick={remove}>
              Delete
            </button>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
            {def.tabs.map((t, i) => (
              <button type="button" key={t.label} style={pillStyle(i === Math.min(tab, def.tabs.length - 1))} onClick={() => setTab(i)}>
                {t.label}
              </button>
            ))}
          </div>
          {activeTab.fields.map((sub) => (
            <FieldEditor
              key={`${idx}-${sub.key}`}
              def={sub}
              value={cur[sub.key]}
              onChange={(v) => {
                // Lists are stored as real arrays, which is what the website reads.
                const stored = LIST_TYPES.has(sub.type) && typeof v === "string" ? safeParse(v) : v;
                write(items.map((x, j) => (j === idx ? { ...x, [sub.key]: stored } : x)));
              }}
            />
          ))}
        </div>
      ) : (
        <p className="card-sub">No sectors yet. Add one to begin.</p>
      )}
    </div>
  );
}

/** Renders each section of a schema as a card; plain strings live in `fields`, lists as JSON strings. */
export function SchemaCards({
  schema,
  page,
  fields,
  onFieldChange,
}: {
  schema: SectionDef[];
  page: string;
  fields: Record<string, string>;
  onFieldChange: (page: string, key: string, value: string) => void;
}) {
  return (
    <>
      {schema.map((section) => (
        <div className="card" key={section.title} style={section.wide ? { gridColumn: "1 / -1" } : undefined}>
          <h3>{section.title}</h3>
          {section.sub && <p className="card-sub">{section.sub}</p>}
          {section.fields.map((def) => (
            <FieldEditor key={def.key} def={def} value={fields[def.key]} onChange={(v) => onFieldChange(page, def.key, typeof v === "string" ? v : JSON.stringify(v))} />
          ))}
        </div>
      ))}
    </>
  );
}

export function SchemaPanel(props: { schema: SectionDef[]; page: string; fields: Record<string, string>; onFieldChange: (page: string, key: string, value: string) => void }) {
  return (
    <div className="grid grid-2">
      <SchemaCards {...props} />
    </div>
  );
}
