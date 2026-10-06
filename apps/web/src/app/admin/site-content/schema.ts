/**
 * Describes every editable piece of text on the redesigned marketing pages.
 * The generic editor (schema-editor.tsx) renders these definitions, so a new
 * field only needs to be added here and in the seed to appear in Admin.
 */
export type FieldDef =
  | { key: string; label: string; type: "text"; hint?: string }
  | { key: string; label: string; type: "textarea"; hint?: string }
  | { key: string; label: string; type: "select"; options: { value: string; label: string }[]; hint?: string }
  | { key: string; label: string; type: "stringList"; hint?: string }
  | { key: string; label: string; type: "objectList"; itemLabel: string; item: FieldDef[]; hint?: string; fixedLength?: boolean };

export interface SectionDef {
  title: string;
  sub?: string;
  fields: FieldDef[];
}

const t = (key: string, label: string, hint?: string): FieldDef => ({ key, label, type: "text", hint });
const ta = (key: string, label: string, hint?: string): FieldDef => ({ key, label, type: "textarea", hint });
const sl = (key: string, label: string, hint?: string): FieldDef => ({ key, label, type: "stringList", hint });

const STAGE_OPTIONS = [
  { value: "capture", label: "Capture" },
  { value: "clarify", label: "Clarify" },
  { value: "claim", label: "Claim" },
  { value: "close", label: "Close" },
  { value: "confirm", label: "Confirm" },
  { value: "none", label: "None (shown in the “Always on” strip)" },
];

const ICON_OPTIONS = ["pin", "shield", "log", "bank", "cap", "bag", "cross", "signal", "plane", "heart", "car"].map((v) => ({ value: v, label: v }));

const finalCta = (): SectionDef => ({
  title: "Closing call to action",
  sub: "The dark band at the bottom of the page, just above the footer.",
  fields: [
    t("finalCtaHeadline", "Headline"),
    t("finalCtaSubhead", "Subhead"),
    t("finalCtaPrimaryButton", "Primary button text (opens the demo form)"),
    t("finalCtaSecondaryButton", "Secondary button text"),
    t("finalCtaSecondaryHref", "Secondary button link", "A page like /pricing or a section like #loop."),
  ],
});

const meta = (): SectionDef => ({
  title: "Search & sharing",
  fields: [ta("metaDescription", "Meta description", "Shown in Google results and link previews.")],
});

export const HOME_SCHEMA: SectionDef[] = [
  {
    title: "Hero",
    sub: "The dark opening section.",
    fields: [
      t("heroEyebrow", "Small label above the headline"),
      t("heroHeadline", "Headline"),
      ta("heroSubheadline", "Subheadline"),
      t("heroPrimaryButton", "Primary button text"),
      t("heroSecondaryButton", "Secondary button text"),
      t("heroSecondaryHref", "Secondary button link", "#loop scrolls to the 5C section."),
      t("heroBuiltForLabel", "Label for the industries line (screen readers)"),
      t("heroBuiltForLine", "Industries line", "Comma-separated, shown as small bullets under the buttons."),
    ],
  },
  {
    title: "5C Framework",
    sub: "The animated Capture → Confirm section. Its illustrations use the Customer X page’s “Illustration text”.",
    fields: [
      t("loopEyebrow", "Eyebrow"),
      t("loopHeadline", "Headline"),
      ta("loopSubhead", "Side text"),
      t("loopStepFormat", "Step label format", "{n}, {total} and {label} are filled in automatically."),
      {
        key: "loopStages",
        label: "The five stages",
        type: "objectList",
        itemLabel: "Stage",
        fixedLength: true,
        item: [t("label", "Name"), t("title", "Title"), ta("body", "Description")],
      },
    ],
  },
  {
    title: "Two products",
    fields: [
      t("heroTwoProductsEyebrow", "Eyebrow"),
      t("heroTwoProductsHeadline", "Headline"),
      ta("heroTwoProductsBody", "Side text"),
      t("heroTwoProductsCxLabel", "Customer X card: label"),
      t("heroTwoProductsCxHeading", "Customer X card: heading"),
      ta("heroTwoProductsCxBody", "Customer X card: description"),
      sl("doorCxBullets", "Customer X card: bullet points"),
      t("heroTwoProductsCxCta", "Customer X card: button text"),
      t("heroTwoProductsCeLabel", "Colleague X card: label"),
      t("heroTwoProductsCeHeading", "Colleague X card: heading"),
      ta("heroTwoProductsCeBody", "Colleague X card: description"),
      sl("doorCeBullets", "Colleague X card: bullet points"),
      t("heroTwoProductsCeCta", "Colleague X card: button text"),
    ],
  },
  {
    title: "Industries",
    sub: "The tiles come from the Solutions tab.",
    fields: [t("industriesEyebrow", "Eyebrow"), t("industriesHeadline", "Headline")],
  },
  finalCta(),
  meta(),
];

const illustrationSections = (): SectionDef[] => [
  {
    title: "Illustration text: Capture",
    sub: "The survey phone and the “QR code or link” cards.",
    fields: [
      t("vizCaptureTitle", "Survey title"),
      t("vizCaptureNps", "Recommend question"),
      t("vizCaptureComment", "Comment box placeholder"),
      t("vizCaptureSend", "Send button"),
      t("vizCaptureQrTitle", "QR code card: title"),
      t("vizCaptureQrSub", "QR code card: places"),
      t("vizCaptureLinkTitle", "Link card: title"),
      t("vizCaptureLinkSub", "Link card: ways to share"),
    ],
  },
  {
    title: "Illustration text: Clarify",
    fields: [
      { key: "vizThemes", label: "Themes (bars)", type: "objectList", itemLabel: "Theme", item: [t("label", "Theme"), t("count", "Mentions")] },
      t("vizTracedBadge", "Badge letters"),
      t("vizNote", "Caption under every illustration", "Keep this: it tells visitors the figures are illustrative."),
      t("vizTracedTitle", "Finding: title"),
      t("vizTracedBody", "Finding: detail"),
    ],
  },
  {
    title: "Illustration text: Claim",
    sub: "Choose cases (a list of owned cases) or route (the diagram showing a concern skipping the manager).",
    fields: [
      { key: "vizClaimStyle", label: "Illustration style", type: "select", options: [{ value: "cases", label: "Cases" }, { value: "route", label: "Route diagram" }] },
      {
        key: "vizCases",
        label: "Cases",
        type: "objectList",
        itemLabel: "Case",
        item: [
          t("initials", "Initials or symbol"),
          t("title", "Title"),
          t("sub", "Detail line"),
          t("pill", "Status label"),
          { key: "tone", label: "Status colour", type: "select", options: [{ value: "ok", label: "Green" }, { value: "warn", label: "Orange" }] },
        ],
      },
      sl("vizPlaybookChips", "Chips under the cases"),
      t("vizRouteFrom", "Route: sender"),
      t("vizRouteFromSub", "Route: sender detail"),
      t("vizRouteManager", "Route: skipped person"),
      t("vizRouteBypassed", "Route: “bypassed” label"),
      t("vizRouteTo", "Route: receiver"),
      t("vizRouteToSub", "Route: receiver detail"),
      t("vizRouteCaption", "Route: caption"),
    ],
  },
  {
    title: "Illustration text: Close",
    fields: [
      t("vizDecisionInitials", "Decision: initials or symbol"),
      t("vizDecisionTitle", "Decision: title"),
      t("vizDecisionSub", "Decision: detail"),
      t("vizBeforeLabel", "“Before” label"),
      t("vizBefore", "Before value"),
      t("vizAfterLabel", "“After” label"),
      t("vizAfter", "After value"),
      t("vizReplyInitials", "Reply: symbol"),
      t("vizReplyTitle", "Reply: title"),
      t("vizReplyQuote", "Reply: message"),
    ],
  },
  {
    title: "Illustration text: Confirm",
    fields: [
      t("vizLadderCaption", "Caption above the ladder"),
      { key: "vizLadder", label: "Maturity levels", type: "objectList", itemLabel: "Level", fixedLength: true, item: [t("name", "Name")] },
      t("vizLadderLevel", "Current level number"),
      t("vizLadderNow", "Current level label"),
      t("vizLadderDone", "Reached level label"),
      t("vizLadderNext", "Upcoming level label"),
    ],
  },
  {
    title: "Illustration text: hero dashboard",
    sub: "Used in the page hero and on Home.",
    fields: [
      { key: "vizDashKpis", label: "Three headline numbers", type: "objectList", itemLabel: "Number", fixedLength: true, item: [t("label", "Label"), t("value", "Value"), t("delta", "Change")] },
      sl("vizDashChips", "Theme chips"),
      t("vizDashCaseInitials", "Case: initials"),
      t("vizDashCaseTitle", "Case: title"),
      t("vizDashCaseSub", "Case: detail"),
      t("vizDashCasePill", "Case: status"),
    ],
  },
];

export const PRODUCT_SCHEMA: SectionDef[] = [
  {
    title: "Hero",
    fields: [
      t("heroEyebrow", "Small label above the headline"),
      t("heroHeadline", "Headline"),
      ta("heroSubheadline", "Subheadline"),
      t("heroPrimaryButton", "Primary button text"),
      t("heroSecondaryButton", "Secondary button text"),
      t("heroSecondaryHref", "Secondary button link"),
      sl("heroChips", "Chips under the buttons"),
      { key: "heroVisual", label: "Hero illustration", type: "select", options: [{ value: "dashboard", label: "Dashboard" }, { value: "route", label: "Route diagram" }] },
    ],
  },
  {
    title: "Capture → Confirm chapters",
    sub: "Each chapter shows its definition, the features assigned to it, and its illustration.",
    fields: [
      t("railNote", "Note at the end of the sticky bar"),
      t("stepLabelFormat", "Step label format", "{n} and {total} are filled in automatically."),
      { key: "stageDefs", label: "The five chapters", type: "objectList", itemLabel: "Chapter", fixedLength: true, item: [t("label", "Name"), ta("def", "One-line definition")] },
    ],
  },
  {
    title: "Features",
    sub: "Pick which chapter each feature appears under. “None” puts it in the Always on strip.",
    fields: [
      {
        key: "features",
        label: "Features",
        type: "objectList",
        itemLabel: "Feature",
        item: [
          t("tag", "Feature name"),
          t("headline", "Headline"),
          ta("body", "Description"),
          { key: "stage", label: "Chapter", type: "select", options: STAGE_OPTIONS },
        ],
      },
      t("alwaysOnLabel", "“Always on” label"),
      ta("alwaysOnText", "“Always on” text"),
    ],
  },
  { title: "Industries band", fields: [t("industriesEyebrow", "Eyebrow"), t("industriesHeadline", "Headline")] },
  finalCta(),
  meta(),
  ...illustrationSections(),
];

const useItem: FieldDef[] = [
  { key: "icon", label: "Icon", type: "select", options: ICON_OPTIONS },
  t("title", "Title"),
  ta("body", "Description"),
];

export const SOLUTIONS_SCHEMA: SectionDef[] = [
  {
    title: "Page text",
    fields: [
      t("eyebrow", "Eyebrow"),
      t("productCxLabel", "Customer X switch label"),
      t("productExLabel", "Colleague X switch label"),
      t("primaryButton", "Primary button text"),
      t("secondaryButtonCx", "Secondary button (Customer X)"),
      t("secondaryButtonEx", "Secondary button (Colleague X)"),
      t("sceneEyebrow", "Example card label"),
      t("sceneNote", "Example card footnote"),
      t("otherEyebrow", "Other industries: eyebrow"),
      t("otherHeadline", "Other industries: headline"),
    ],
  },
  {
    title: "Industries",
    sub: "Each industry has its own page (/solutions/<slug>) and separate copy for Customer X and Colleague X.",
    fields: [
      {
        key: "industryDetails",
        label: "Industries",
        type: "objectList",
        itemLabel: "Industry",
        item: [
          {
            key: "visible",
            label: "Show on the website",
            type: "select",
            options: [
              { value: "yes", label: "Shown" },
              { value: "no", label: "Hidden everywhere (Solutions page, home tiles, sector page, footer link)" },
            ],
          },
          t("slug", "URL slug"),
          t("name", "Name"),
          t("tileBody", "Tile description"),
          t("cxHeadline", "Customer X: headline"),
          ta("cxSub", "Customer X: intro"),
          ta("cxChallenge", "Customer X: the challenge (paragraph)"),
          sl("cxMeasures", "Customer X: what can be measured"),
          { key: "cxUses", label: "Customer X: benefits (four fit the layout)", type: "objectList", itemLabel: "Benefit", item: useItem },
          t("cxScene", "Customer X: example title"),
          sl("cxSteps", "Customer X: example steps"),
          t("exHeadline", "Colleague X: headline"),
          ta("exSub", "Colleague X: intro"),
          ta("exChallenge", "Colleague X: the challenge (paragraph)"),
          sl("exMeasures", "Colleague X: what can be measured"),
          { key: "exUses", label: "Colleague X: benefits (four fit the layout)", type: "objectList", itemLabel: "Benefit", item: useItem },
          t("exScene", "Colleague X: example title"),
          sl("exSteps", "Colleague X: example steps"),
        ],
      },
    ],
  },
  {
    title: "Closing call to action",
    fields: [t("finalCtaHeadline", "Headline"), t("finalCtaSubhead", "Subhead"), ta("metaDescription", "Meta description")],
  },
];

export const SHARED_TEXT_SCHEMA: SectionDef[] = [
  {
    title: "Footer",
    sub: "The footer on every marketing page: a short description, an email, and any number of link columns.",
    fields: [
      ta("footerDescription", "Description under the logo"),
      t("footerEmail", "Contact email (shown under the description)"),
      t("footerTagline", "Line in the bottom bar", "Shown after the copyright text."),
      t("copyrightText", "Copyright text"),
      {
        key: "footerColumns",
        label: "Link columns",
        type: "objectList",
        itemLabel: "Column",
        item: [
          t("heading", "Column heading"),
          {
            key: "links",
            label: "Links",
            type: "objectList",
            itemLabel: "Link",
            item: [t("label", "Link text"), t("href", "Link address", "A page like /pricing, a section like /company#demo, or a full address.")],
          },
        ],
      },
    ],
  },
  {
    title: "Header buttons",
    fields: [
      t("navSignInLabel", "Sign in link"),
      t("navDemoLabel", "Book a demo button"),
      t("mobileMenuOpenLabel", "Mobile menu: open (screen readers)"),
      t("mobileMenuCloseLabel", "Mobile menu: close (screen readers)"),
    ],
  },
  {
    title: "Cookie banner",
    fields: [
      t("cookieTitle", "Title"),
      ta("cookieBody", "Text (the Privacy policy link follows it)"),
      t("cookiePrivacyLabel", "Privacy link text"),
      t("cookieNecessaryButton", "Necessary only button"),
      t("cookieAcceptButton", "Accept all button"),
    ],
  },
  {
    title: "Book a demo form",
    sub: "The pop-up opened by every “Book a demo” button, and the form on the Company page.",
    fields: [
      t("demoTitle", "Pop-up title"),
      ta("demoSub", "Pop-up intro"),
      t("demoLabelName", "Name label"),
      t("demoLabelEmail", "Email label"),
      t("demoLabelCompany", "Company label"),
      t("demoLabelMessage", "Message label"),
      t("demoSubmit", "Submit button"),
      t("demoSubmitting", "Submit button while sending"),
      t("demoSuccessTitle", "Success title"),
      ta("demoSuccessBody", "Success text", "{email} is replaced with the visitor’s address."),
      t("demoError", "Error message"),
    ],
  },
];

export const COMPANY_EXTRA_SCHEMA: SectionDef[] = [
  {
    title: "Hero extras",
    sub: "Beside the headline: a label, a second button and the comparison table.",
    fields: [
      t("heroEyebrow", "Small label above the headline"),
      t("heroSecondaryButton", "Second button text"),
      t("heroSecondaryHref", "Second button link"),
      t("funcTitle", "Comparison table title"),
      sl("funcColumns", "Comparison table columns", "Three columns; the last one is highlighted."),
      {
        key: "funcRows",
        label: "Comparison table rows",
        type: "objectList",
        itemLabel: "Row",
        item: [t("label", "Row label"), sl("cells", "Cell text, one per column")],
      },
    ],
  },
  {
    title: "How the platform handles responsibility",
    sub: "Keep these limited to what the product actually does.",
    fields: [
      t("trustEyebrow", "Eyebrow"),
      t("trustHeadline", "Headline"),
      ta("trustIntro", "Intro"),
      {
        key: "trustItems",
        label: "Points",
        type: "objectList",
        itemLabel: "Point",
        item: [t("title", "Title"), ta("body", "Text")],
      },
    ],
  },
  {
    title: "Demo form section",
    sub: "The “Book a demo” form at the bottom of the Company page (labels are under Menu & Footer).",
    fields: [
      t("demoEyebrow", "Eyebrow"),
      t("demoHeadline", "Headline"),
      ta("demoBody", "Text"),
      t("demoEmailPrefix", "Text before the email address"),
      t("demoProductLabel", "Product dropdown label"),
      sl("demoProductOptions", "Product dropdown options"),
    ],
  },
];

export const PRICING_EXTRA_SCHEMA: SectionDef[] = [
  {
    title: "Extra text",
    fields: [t("pricingEyebrow", "Eyebrow above the headline"), t("enterpriseLinkLabel", "Volume pricing link text")],
  },
];

export const CONTACT_EXTRA_SCHEMA: SectionDef[] = [
  {
    title: "Form labels",
    fields: [
      t("formLabelName", "Name label"),
      t("formLabelEmail", "Email label"),
      t("formLabelCompany", "Company label"),
      t("formLabelMessage", "Message label"),
      t("formSubmit", "Submit button"),
      t("formSubmitting", "Submit button while sending"),
      t("formErrName", "Error: name missing"),
      t("formErrEmail", "Error: email invalid"),
      t("formErrMessage", "Error: message missing"),
      t("formErrGeneric", "Error: something went wrong"),
    ],
  },
];
