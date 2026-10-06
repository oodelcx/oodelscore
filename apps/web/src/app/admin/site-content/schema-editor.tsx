"use client";

import { useEffect, useRef, type CSSProperties, type TextareaHTMLAttributes } from "react";
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
  const str = typeof value === "string" ? value : value == null ? "" : String(value);
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
  if (def.type === "visibilityList") {
    const rows = parseList(str) as Obj[];
    const set = (i: number, on: boolean) => {
      const next = [...rows];
      next[i] = { ...rows[i], [def.visibleKey]: on ? "yes" : "no" };
      onChange(JSON.stringify(next));
    };
    return (
      <div className="field">
        <label>{def.label}</label>
        {rows.map((row, i) => {
          const on = row[def.visibleKey] !== "no";
          return (
            <div className="nav-item-row" key={i}>
              <div className="nav-item-top" style={{ alignItems: "center" }}>
                <span style={{ flex: 1, fontSize: 13.5, opacity: on ? 1 : 0.55 }}>{String(row[def.nameKey] ?? `Sector ${i + 1}`)}</span>
                <span style={{ fontSize: 12, marginRight: 8, opacity: 0.7 }}>{on ? "Shown" : "Hidden"}</span>
                <span className={`toggle ${on ? "on" : ""}`} role="switch" aria-checked={on} onClick={() => set(i, !on)} />
              </div>
            </div>
          );
        })}
        {def.hint && <small className="card-sub">{def.hint}</small>}
      </div>
    );
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
        <div className="card" key={section.title}>
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
