import Link from "next/link";

const ICONS: Record<string, string> = {
  bank: "M3 10l9-6 9 6M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18",
  cap: "M2 9l10-5 10 5-10 5L2 9zM6 11.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.5",
  bag: "M5 8h14l-1 12H6L5 8zM9 8V6a3 3 0 016 0v2",
  cross: "M9 3h6v6h6v6h-6v6H9v-6H3V9h6V3z",
  pin: "M12 21s7-6.2 7-11a7 7 0 10-14 0c0 4.8 7 11 7 11z",
  shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3zM9 12l2.2 2.2L15.5 10",
  log: "M5 4h14v16H5zM9 9h6M9 13h6M9 17h3",
};

const ICON_BY_SLUG: Record<string, string> = { banking: "bank", education: "cap", retail: "bag", healthcare: "cross" };

export function Icon({ name }: { name: string }) {
  const d = ICONS[name] ?? ICONS.pin;
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
      {name === "pin" && <circle cx="12" cy="10" r="2.5" />}
    </svg>
  );
}

export function iconForIndustry(slug: string): string {
  return ICON_BY_SLUG[slug] ?? "pin";
}

export function IndustryTiles({ industries }: { industries: { slug: string; name: string; tileBody?: string }[] }) {
  return (
    <div className="ds-inds">
      {industries.map((i) => (
        <Link className="ds-ind-t" href={`/solutions/${i.slug}`} key={i.slug}>
          <Icon name={iconForIndustry(i.slug)} />
          <b>{i.name}</b>
          <span>{i.tileBody}</span>
        </Link>
      ))}
    </div>
  );
}
