import { parseJsonArray } from "@/lib/siteContent";

export type Fields = Record<string, string>;

export function list<T>(value: string | undefined): T[] {
  return parseJsonArray<T>(value);
}

export function strings(value: string | undefined): string[] {
  return parseJsonArray<unknown>(value).map((v) => String(v)).filter((v) => v.trim() !== "");
}

/** "Step {n} of {total}" style templates, so even the glue words are editable. */
export function fill(template: string | undefined, vars: Record<string, string | number>): string {
  return (template ?? "").replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

export const STAGE_IDS = ["capture", "clarify", "claim", "close", "confirm"] as const;
export type StageKey = (typeof STAGE_IDS)[number];

export interface StageDef {
  label: string;
  def: string;
}

export interface Feature {
  tag: string;
  headline: string;
  body: string;
  stage?: string;
  group?: string;
}

export interface CaseItem {
  initials: string;
  title: string;
  sub: string;
  pill: string;
  tone?: string;
}

export interface VizContent {
  capture: { title: string; nps: string; comment: string; send: string; qrTitle: string; qrSub: string; linkTitle: string; linkSub: string };
  themes: { label: string; count: string }[];
  traced: { badge: string; title: string; body: string };
  claimStyle: "cases" | "route";
  cases: CaseItem[];
  playbookChips: string[];
  route: { from: string; fromSub: string; manager: string; bypassed: string; to: string; toSub: string; caption: string };
  decision: { initials: string; title: string; sub: string; beforeLabel: string; before: string; afterLabel: string; after: string };
  reply: { initials: string; title: string; quote: string };
  ladder: { names: string[]; level: number; now: string; done: string; next: string; caption: string };
  dash: { kpis: { label: string; value: string; delta: string }[]; chips: string[]; caseInitials: string; caseTitle: string; caseSub: string; casePill: string };
}

/** Everything the stage illustrations say, read from a page's `viz*` fields. */
export function readViz(f: Fields): VizContent {
  return {
    capture: {
      title: f.vizCaptureTitle ?? "",
      nps: f.vizCaptureNps ?? "",
      comment: f.vizCaptureComment ?? "",
      send: f.vizCaptureSend ?? "",
      qrTitle: f.vizCaptureQrTitle ?? "",
      qrSub: f.vizCaptureQrSub ?? "",
      linkTitle: f.vizCaptureLinkTitle ?? "",
      linkSub: f.vizCaptureLinkSub ?? "",
    },
    themes: list<{ label: string; count: string }>(f.vizThemes),
    traced: { badge: f.vizTracedBadge ?? "", title: f.vizTracedTitle ?? "", body: f.vizTracedBody ?? "" },
    claimStyle: f.vizClaimStyle === "route" ? "route" : "cases",
    cases: list<CaseItem>(f.vizCases),
    playbookChips: strings(f.vizPlaybookChips),
    route: {
      from: f.vizRouteFrom ?? "",
      fromSub: f.vizRouteFromSub ?? "",
      manager: f.vizRouteManager ?? "",
      bypassed: f.vizRouteBypassed ?? "",
      to: f.vizRouteTo ?? "",
      toSub: f.vizRouteToSub ?? "",
      caption: f.vizRouteCaption ?? "",
    },
    decision: {
      initials: f.vizDecisionInitials ?? "",
      title: f.vizDecisionTitle ?? "",
      sub: f.vizDecisionSub ?? "",
      beforeLabel: f.vizBeforeLabel ?? "",
      before: f.vizBefore ?? "",
      afterLabel: f.vizAfterLabel ?? "",
      after: f.vizAfter ?? "",
    },
    reply: { initials: f.vizReplyInitials ?? "", title: f.vizReplyTitle ?? "", quote: f.vizReplyQuote ?? "" },
    ladder: {
      names: list<{ name: string }>(f.vizLadder).map((r) => r.name),
      level: Number(f.vizLadderLevel) || 3,
      now: f.vizLadderNow ?? "",
      done: f.vizLadderDone ?? "",
      next: f.vizLadderNext ?? "",
      caption: f.vizLadderCaption ?? "",
    },
    dash: {
      kpis: list<{ label: string; value: string; delta: string }>(f.vizDashKpis),
      chips: strings(f.vizDashChips),
      caseInitials: f.vizDashCaseInitials ?? "",
      caseTitle: f.vizDashCaseTitle ?? "",
      caseSub: f.vizDashCaseSub ?? "",
      casePill: f.vizDashCasePill ?? "",
    },
  };
}
