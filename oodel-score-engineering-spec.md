# Oodel Score — Engineering Specification

**Purpose of this document:** this is the handoff spec for building the real, working application behind the finalized mockups — four dashboards (Admin, Group, Business-standalone, Business-as-branch) plus the public marketing site. It captures the data model, permissions, billing logic, email triggers, and known bugs discussed and designed across the mockup phase, so none of that reasoning has to be re-derived from scratch.

**Stack:** MongoDB (data), Render (hosting), Stripe (billing, starting in sandbox/test mode — do not switch to live keys until the full application and website are verified end-to-end), Resend (transactional email), Claude API (AI Insights generation — use `claude-haiku-4-5-20251001` via the Batch API, see Section 10). Existing codebase is on GitHub, originally scaffolded via Emergent, live at oodelscore.com.

**Reference mockups** (open these directly for exact visual/interaction spec — every button, modal, and page listed below corresponds to something built and click-tested in these files):
- `oodel-score-admin-rebuild.html` — Admin portal (Overview, Accounts incl. Businesses/Parent Orgs/Staff/Roles, Question Templates, Categories, Email Templates, Site Content, Feedback Responses, AI Insights Queue, Alert Rules, **Billing Oversight — full finance view**, CX Pulse)
- `oodel-score-group-dashboard.html` — Parent Organization (Group) portal
- `oodel-score-redesign.html` — standalone Business portal
- `oodel-score-business-branch-mode.html` — Business portal when it belongs to a Parent Org
- `oodel-score-marketing-site.html` — the public marketing site: **Home, Product, Solutions, Pricing, Company** (5 pages), every section of which is editable from Admin's Site Content tab
- `oodel-score-feedback-form.html` — the actual respondent-facing survey a customer sees after scanning a QR code, in both layout modes (all questions on one screen / one question per screen), demonstrated live against two real businesses with different branding and different demographic configurations — this is the "what the QR code actually opens" spec, previously missing

---

## 1. Product overview

Oodel Score is a B2B feedback-intelligence platform. A business puts up a QR code; customers answer a short survey; the business gets AI-analyzed dashboards instead of a spreadsheet.

Three account tiers:
- **Admin** (Oodel Score internal staff) — full platform control.
- **Parent Organization ("Group")** — oversees multiple Businesses ("branches").
- **Business** — a single location. May be standalone or belong to a Parent Org.

Product philosophy established during design (build to this, don't deviate without reason):
- **Listen → Act → Measure.** Collecting feedback (Listen) is not enough — there must be a place work actually happens (Act: Action Board, Decision Log, Playbooks), and a way to know if that work is effective (Measure: CX Pulse).
- **Every number shown must have a place it comes from.** No dashboard should display a stat, badge, or count without a corresponding page/config where that data is entered, computed, or editable. When building a new screen, ask "where does this number get produced, and is there a link there?"
- **Admin controls platform-wide configuration; Group/Business only see effects of it, with visible escalation paths.** Billing assignment (who pays) and survey/question setup are Admin-only. A Group or Business sees these read-only with a "message us to change" path — never a self-service toggle for these two specifically.
- **One data entry point per entity, used for both create and edit.** "+ New Business" and "+ New Parent Organization" open the same tabbed detail page that "Manage" opens — not a separate, differently-structured modal. On create, the page opens in a locked state (tabs that depend on the record existing, like Feedback Points & QR, are disabled until the record is saved), then unlocks into the normal edit view. Never build a second form for the same entity.

---

## 2. Data model (MongoDB collections)

All IDs are ObjectId unless noted. Timestamps (`createdAt`, `updatedAt`) implied on every collection.

### `users`
Covers Admin/staff, Group logins, Business logins, and Team Member logins in one collection, differentiated by `accountType` and `parentType`/`parentId`.
```
{
  email: String (unique, used for login),
  passwordHash: String,
  accountType: enum["admin_staff", "parent_org", "business", "team_member"],
  parentId: ObjectId,          // -> parentOrganizations._id or businesses._id, null for admin_staff
  roleId: ObjectId,            // -> roles._id (admin_staff only; parent_org/business use implicit owner role)
  teamRole: String,            // team_member only — free text (e.g. "Shift Lead"), cosmetic, no permission effect
  tier: enum["full", "limited"],  // team_member only — see Section 16
  teamOfType: enum["business", "parentOrg"],  // team_member only — since parentId is polymorphic, this says which collection it points at
  inviteStatus: enum["active", "invite_pending", "invite_expired"],
  inviteTokenHash: String,
  inviteExpiresAt: Date,       // 7 days from send, per original spec
  lastLoginAt: Date
}
```
`team_member.parentId` points at the same Business or Parent Org the inviting primary account belongs to (never at another `team_member`) — invited via the exact same invite-email mechanism as everything else in this collection, no new invite pattern. See Section 16 for the full permission split and seat-limit rules.

### `roles`  (Admin/staff RBAC — see Section 4)
```
{
  name: String,                // "Admin", "Account manager", or custom
  description: String,
  isSystemRole: Boolean,       // true for Admin/Account manager, false for custom
  permissions: {
    businesses:        { view: Bool, edit: Bool, delete: Bool, scope: enum["all","assigned"] },
    parentOrgs:         { view, edit, delete, scope },
    staffAndRoles:      { view, edit, delete },
    billingOversight:   { view, edit, delete },
    questionTemplates:  { view, edit, delete },
    emailAndSiteContent:{ view, edit, delete },
    aiInsightsQueue:    { view, edit, delete, scope }
  }
}
```
Seed three system roles on launch: **Admin** (all true, scope "all"); **Account manager** (view/edit only on businesses/parentOrgs/aiInsightsQueue, scope "assigned"; view-only on questionTemplates; nothing on staffAndRoles/billing/content); and **Finance** (view+edit on billingOversight only, view-only on businesses/parentOrgs restricted to name/status fields — no access to feedback data, staff, templates, or content). Finance is for a CEO, CFO, or accounts manager who needs full financial visibility without customer-data access — see Section 5.

### `parentOrganizations`
```
{
  name: String,
  contactName: String, contactEmail: String, contactPhone: String,
  address: { street, city, postcode },
  billingAddressSameAsAddress: Boolean,
  defaultBillingMode: enum["group_pays", "branch_pays"],  // default only — see billingAssignment on businesses
  accountManagerId: ObjectId,  // -> users._id (staff)
  branchSeatLimit: Number | null,      // ADMIN-EDITABLE ONLY. null = unlimited. See Section 16.
  teamMemberSeatLimit: Number | null   // ADMIN-EDITABLE ONLY. The Group's own staff pool — independent of any branch's. See Section 16.
}
```

### `businesses`
```
{
  name: String,
  industry: String,                 // controlled vocabulary: Restaurant, Education, Retail, Healthcare, ...
  parentOrgId: ObjectId,             // null = standalone
  region: String,                   // only meaningful when parentOrgId set and org has regions
  contactName, contactEmail, contactPhone,
  address, billingAddressSameAsAddress,
  billingAssignment: enum["group_pays", "branch_pays", "unassigned"],  // ADMIN-EDITABLE ONLY, ever
  plan: enum["business_monthly", "business_yearly", "comp"],
  maxFeedbackPoints: Number,
  questionTemplateId: ObjectId,      // -> questionTemplates._id
  demographicConfig: {
    name:   enum["off","optional","mandatory"],
    email:  enum["off","optional","mandatory"],
    phone:  enum["off","optional","mandatory"],
    ageGroup: enum["off","optional","mandatory"],
    gender: enum["off","optional","mandatory"]
  },
  accountManagerId: ObjectId,
  teamMemberSeatLimit: Number | null,  // ADMIN-EDITABLE ONLY. null = unlimited. See Section 16.
  active: Boolean
}
```
**Rule to enforce in code:** `billingAssignment`, `demographicConfig`/`questionTemplateId`, and both seat-limit fields on this collection and `parentOrganizations` are writable only by `accountType: "admin_staff"`. Group/Business API routes must reject writes to these fields even if the request body includes them.

### `feedbackPoints`
```
{
  businessId: ObjectId,
  name: String, description: String,
  qrToken: String,              // random, unguessable — the QR image just encodes a URL containing this
  questionTemplateOverride: ObjectId,   // null = use business's default template
  formLayoutOverride: enum["single_page","one_per_screen",null],  // null = use business default
  demographicOverride: Object,  // null = use business default demographicConfig; same shape otherwise
  active: Boolean
}
```
**QR generation timing:** there is no separate "generate QR" step. The QR is a direct, deterministic function of `qrToken` — it exists the instant this document is created (`qrToken` generated server-side on insert). "View QR" never creates anything; it just renders the existing token as an image. The only action that produces a *new* QR for the same feedback point is an explicit "Regenerate" — which replaces `qrToken` with a fresh random value, immediately invalidating the old one (any printed poster using it stops working). The Admin mockup reflects this directly: clicking "Create" in the New Feedback Point modal closes straight into the QR view/download modal, with no intermediate step.

### `questionTemplates`
```
{
  name: String,
  suggestedIndustries: [String],   // drives the "suggested first" behavior in Business creation
  questions: [{
    text: String,
    type: enum["star_1_5","nps_0_10","open_text","yes_no","emoji_scale",
               "multiple_choice","multi_select","slider","dropdown"],
    categoryId: ObjectId,          // -> categories._id
    required: Boolean,
    isTracker: Boolean,
    options: [String]             // for multiple_choice/multi_select/dropdown
  }],
  usedByCount: Number  // denormalized, recompute on business save
}
```

### `categories`
```
{ name: String }
```
Before delete: compute and warn with the count of questions/templates using it (mirrors the Admin mockup's Categories page — "used in 12 questions across 2 templates").

### `industries`
```
{ name: String, usedByCount: Number }
```
**Every enumerated list an Admin might need to extend lives in a collection like this, not in application code.** Industries is the concrete example built in the mockup (Admin → Survey setup → Industries), and it's the pattern to replicate for any future controlled vocabulary — the rule is: if a non-engineer would reasonably want to add an option someday, it's data with a management screen, not a hardcoded `<option>`. Engineering only gets involved for genuinely new *capability* (a new question type, a new billing model) — never for "add one more item to a list."

### `responses`  (raw feedback submissions)
```
{
  feedbackPointId: ObjectId, businessId: ObjectId,
  answers: [{ questionId: ObjectId, type: String, value: Mixed, categoryId: ObjectId }],
  respondentEmail: String,   // null if not collected
  demographics: { ageGroup: String, gender: String },
  submittedAt: Date
}
```
**Critical scoring rule (Section 13, bug #1):** when computing any average score shown to a user, **only aggregate `star_1_5` type answers**. NPS (`nps_0_10`) is a separate metric, always reported as its own number (e.g., "+42" on -100..+100 or 0-10 scale), never averaged into the star score. This was found live and broken (scores like 5.6/5) — do not reintroduce it.

### `alertRules`
```
{
  scope: enum["business","parentOrg_all","parentOrg_region"],
  ownerId: ObjectId,           // business or parentOrg that owns this rule
  ruleType: enum["fixed_threshold","regional_outlier","sudden_drop","nps_floor"],
  metric: String, threshold: Number,     // for fixed_threshold / nps_floor
  sensitivity: Number,                   // std deviations, for regional_outlier
  baselineWindowDays: Number, dropPercent: Number, // for sudden_drop
  recipients: [String],
  delivery: enum["immediate","weekly_digest"],
  active: Boolean,
  isInherited: Boolean          // true when set by parentOrg/admin and cascaded to a business — read-only there
}
```

### `alertActivity`
```
{ alertRuleId: ObjectId, businessId: ObjectId, triggeredAt: Date, snapshotValue: Number }
```
Powers the "fired X times this week" displays and the Overview "flagged" counts — never hardcode those, always compute from this collection.

### `billingSubscriptions`
```
{
  ownerType: enum["business","parentOrg"], ownerId: ObjectId,
  stripeCustomerId: String, stripeSubscriptionId: String,
  plan: String, isComp: Boolean,
  mrrValue: Number,              // 0 for comp; used to compute the Billing Oversight MRR totals and by-plan breakdown
  nextPaymentDate: Date,
  status: enum["active","overdue","canceled"],
  paymentMethodLast4: String
}
```
**Rule:** a `businesses` document with `billingAssignment: "group_pays"` should NOT have its own `billingSubscriptions` row — its cost rolls into the parent org's subscription. Reconcile/prevent orphaned rows (see bug #4 in Section 13) with a DB constraint or a nightly integrity check job.

### `invoices`
```
{
  subscriptionId: ObjectId,       // -> billingSubscriptions._id
  ownerType, ownerId,             // denormalized for the platform-wide invoice ledger
  amount: Number, currency: String,
  status: enum["paid","failed","refunded"],
  stripeInvoiceId: String, paymentMethodLast4: String,
  issuedAt: Date
}
```
Powers Billing Oversight's invoice ledger (searchable, date-filterable, exportable to CSV for accounting) and each account's own invoice-history modal.

### `billingCredits`
```
{ ownerType, ownerId, type: enum["credit","refund"], amount: Number, reason: String, issuedBy: ObjectId, issuedAt: Date }
```
Written whenever Finance/Admin issues a credit or refund from Billing Oversight — kept as a permanent audit trail, never edited or deleted after creation.

### `emailTemplates`
```
{
  key: String,   // "welcome","email_changed","password_reset","invite_to_team",
                 // "alert_notification","report_ready","action_assigned",
                 // "invoice_receipt","payment_failed"
  subject: String, body: String,   // body supports {{merge_vars}}
  availableVars: [String],
  lastEditedAt: Date
}
```
Full trigger table in Section 11 — seed this collection with the defaults from the mockup on first migration.

### `siteContent`
```
{
  page: enum["menu","home","pricing","product","solutions","company"],
  navItems: [{ key, label, visible: Boolean, order: Number }],   // page: "menu" only
  sections: [{ key, label, visible: Boolean }],                   // page: "menu" only
  fields: { [fieldKey]: String }                                  // page-specific text fields
}
```

### `aiInsightReports`
```
{
  ownerType: enum["business","parentOrg"], ownerId: ObjectId,
  period: enum["weekly","monthly","quarterly","yearly"],
  periodStart: Date, periodEnd: Date,
  bodyMarkdown: String,          // AI-generated, admin-editable before publish
  status: enum["pending","approved","rejected"],
  showChartOnDashboard: Boolean,
  generatedAt: Date, reviewedAt: Date, reviewedBy: ObjectId
}
```
**Rule:** nothing in this collection is visible on a Group/Business dashboard while `status: "pending"`. Approval triggers the `report_ready` email (Section 11) and flips visibility.

### `actionBoardItems`
```
{
  parentOrgId: ObjectId | null,     // null when businessId is a standalone business — see correction below
  title: String, description: String,
  businessId: ObjectId, categoryId: ObjectId,
  priority: enum["low","medium","high","critical"],
  status: enum["open","in_progress","resolved"],
  ownerId: ObjectId, dueDate: Date,
  sourceResponseIds: [ObjectId],   // linked feedback that generated this item
  resolutionNote: String, resolvedAt: Date,
  source: enum["manual", "auto_suggested", "auto_assigned", "escalated"]  // see Section 16
}
```
**Correction (Section 16):** the Act layer was originally scoped Group-only (`parentOrgId` required). AI-assisted triage (Section 16) fires an Action Board item whenever an Alert Rule fires — including for a standalone business with no parent org — so `parentOrgId` is now nullable, `businessId` is always present, and a standalone business gets its own single-business Action Board (same UI/API shape, scoped by `businessId` instead of `parentOrgId`).

### `categoryOwnerMappings`  (Section 16 — feeds AI-assisted triage's default owner)
```
{
  ownerScope: enum["business", "parentOrg"],
  ownerScopeId: ObjectId,          // -> businesses._id or parentOrganizations._id
  categoryId: ObjectId,
  defaultOwnerId: ObjectId,        // -> users._id — who a new item in this category is suggested/assigned to
  autoAssignWithoutConfirmation: Boolean  // per-business/org toggle, default false — see Section 16
}
```

### `decisionLogEntries`
```
{
  parentOrgId: ObjectId,
  title: String,
  trigger: String, linkedActionIds: [ObjectId],
  affectedBusinessIds: [ObjectId],
  ownerId: ObjectId, implementationDate: Date,
  status: enum["planned","in_progress","implemented"],
  outcomeMetricDescription: String,
  outcomeBefore: Number, outcomeAfter: Number, outcomeMeasuredAt: Date
}
```

### `playbooks`
```
{
  parentOrgId: ObjectId,
  title: String, categoryId: ObjectId, triggerCondition: String,
  steps: [String], escalationContactId: ObjectId,
  usageCount: Number   // increment whenever an actionBoardItem references this playbook
}
```

### `cxPulseScores`  (computed, not hand-entered — see Section 7)
```
{
  ownerType: enum["business","parentOrg"], ownerId: ObjectId,
  period: Date,           // month this score covers
  dimensions: { awareness: Number, response: Number, ownership: Number, culture: Number, outcome: Number },
  compositeScore: Number, level: enum[1,2,3,4,5]
}
```

### `cxPulseFramework`  (singleton, admin-editable)
```
{
  weights: { awareness: Number, response: Number, ownership: Number, culture: Number, outcome: Number }, // sum to 100
  pulseQuestions: [String]   // quarterly self-assessment questions sent to account holders
}
```

### `cxPulsePulseResponses`  (quarterly self-assessment answers, feeds culture/outcome dimensions)
```
{ ownerType, ownerId, quarter: String, answers: [{ question: String, answer: String }] }
```

---

## 3. Authentication & account creation

- No password is ever set by Admin. Creating any account (`users` doc) generates an invite token, sends the `welcome` email via Resend with a set-password link, and sets `inviteStatus: "invite_pending"`. Token expires in 7 days → `inviteStatus: "invite_expired"`.
- **Bug found live:** every seeded account in the current app shows "Invite Expired." Before shipping, verify Resend delivery logs for the welcome email — this pattern (100% expired) suggests either emails aren't sending or the expiry window is being hit before users see them.
- JWT-based sessions. Bcrypt password hashing. Session token versioning (invalidate on password change). Brute-force lockout on login.

---

## 4. Permission matrix (enforce server-side, not just hidden in UI)

| Area | Admin | Account manager | Finance | Business (owner) | Parent Org (owner) |
|---|---|---|---|---|---|
| Businesses/Parent Orgs — view/edit/delete | ✓ all | ✓ assigned only, no delete | view name/status only | own record only, read-mostly | own + child businesses (read-mostly on billing/survey) |
| Billing assignment (`billingAssignment` field) | ✓ edit | — | — | read-only | read-only |
| Question template & demographic config | ✓ edit | view only | — | read-only | read-only |
| Staff & Roles | ✓ | — | — | — | — |
| Billing Oversight (Stripe-level, MRR, invoices, credits) | ✓ | — | ✓ full | own subscription only, if `branch_pays` | own group invoice, payment method |
| Email Templates / Site Content | ✓ | — | — | — | — |
| AI Insights Queue (approve/reject) | ✓ | ✓ assigned only | — | — | — |
| Action Board | view (oversight) | view (assigned) | — | — | ✓ full |
| Decision Log / Playbooks | view (oversight) | view (assigned) | — | — | ✓ full |
| Alert Rules | view all (oversight) | — | — | own business rules; view-only on inherited | own + cascade to businesses |
| CX Pulse | portfolio view, framework config | portfolio (assigned) | — | own score | own + all child businesses |

Custom roles (created via Admin's "+ New role") use the same shape as the `roles.permissions` object — any new admin-side feature must be added as a new key to that object and to this table, not left ungoverned.

**Correction (post-launch product decision, not in the original spec):** Parent Org access to a branch's **Action Board** is read-only plus two exceptions — commenting on an item, and toggling an `escalated` flag for visibility — not the "✓ full" CRUD this table originally specified. Assigning owners, changing priority/status, creating items, and resolving items is exclusively the branch's own job; the Group creating or reassigning a branch's work item defeated the point of branch ownership in practice. Escalating an item does **not** create or touch a Decision Log entry — Decision Log stays keyed off the branch's own resolution, same as before. Decision Log and Playbooks are unaffected by this correction and remain "✓ full" for Parent Org as originally specified.

**Deletion correction (Section 16):** only `accountType: "admin_staff"` can ever delete a Business or Parent Org record, enforced server-side regardless of any UI state. There is no delete option anywhere in the Business or Group-facing frontend, for the primary account or any Team Member at any tier — this isn't hidden behind a permission toggle, the button/route simply doesn't exist outside Admin. Deletion only happens via Admin's Danger Zone. This reads as stricter than the "own record only, read-mostly" language above for Business/Parent Org owners — the correction is intentional and takes precedence over that row.

---

## 5. Billing logic (Stripe)

- **Who decides what:** `billingAssignment` on a `businesses` doc (`group_pays` / `branch_pays` / `unassigned`) is **Admin-only**, set per business, not a one-time org-level choice. `parentOrganizations.defaultBillingMode` is only the *default* applied to newly created businesses under that org — Admin can override any individual one afterward from the org's detail page.
- **Group pays:** the business has no `billingSubscriptions` row of its own. Its cost rolls into the parent org's single Stripe subscription/invoice. Group portal Billing page shows this read-only with a count of branches covered, next payment date, and payment method — editable by the Group (they manage *how* they pay, not *who* is assigned to pay).
- **Branch pays:** the business has its own `billingSubscriptions` row, own Stripe customer, manages its own payment method like a standalone business.
- **Unassigned:** newly onboarded businesses under an org may sit here until Admin decides — surface these prominently in Admin's Parent Org detail page.
- **Comp accounts:** `isComp: true` bypasses Stripe charge but should still be visible in Billing Oversight with a `comp` badge (per current live app behavior).
- **Webhooks:** `payment_succeeded` → `invoice_receipt` email. `payment_failed` → `payment_failed` email + set `status: "overdue"`.
- **Bug found live:** two Billing Oversight rows show `Account: "Unknown"` — orphaned `billingSubscriptions` docs with no resolvable `ownerId`. Add a foreign-key check / migration to find and fix these before launch, and add a DB-level safeguard (e.g., a `$lookup`-validated write, or app-level check before insert) to prevent recurrence.

---

## 6. Question Templates & Categories

- Templates are built/edited on a **dedicated full page**, not a modal — the authoring surface needs real estate for a live preview panel showing exactly what a respondent will see (star icons render as stars, NPS as a 0–10 button row, etc.), not just a form.
- 9 question types (see `questionTemplates.questions[].type` enum above). `isTracker: true` questions are aggregated month-by-month indefinitely on the business's Analytics page, independent of the standard date-range views.
- Categories are shared platform-wide. Deleting one must show the real impact first ("used in N questions across M templates") — never a generic "are you sure?"
- `suggestedIndustries` on a template + `industry` on a business: when Admin creates a business and picks an industry, pre-highlight/reorder the template dropdown to surface matching templates first.

---

## 7. CX Pulse framework

Five dimensions, each scored 0–100, weighted (`cxPulseFramework.weights`, admin-configurable, default 20/25/20/15/20):

| Dimension | Computed from |
|---|---|
| Awareness | Insights report open/view rate; login frequency of business/group managers |
| Response | % of flagged/negative `responses` with a linked `actionBoardItem` created within 48h |
| Ownership | % of `actionBoardItems` with a non-null `ownerId` |
| Culture | Playbook adoption rate (`playbooks.usageCount` relative to relevant flagged items) + `cxPulsePulseResponses` quarterly answers |
| Outcome | % of `decisionLogEntries` with `outcomeAfter` showing a confirmed positive delta vs `outcomeBefore` |

Composite score → level: 0–20 **Collecting**, 21–40 **Reacting**, 41–60 **Responding**, 61–80 **Improving**, 81–100 **Embedded**.

Recompute `cxPulseScores` on a scheduled job (nightly or on relevant writes) — never compute live in a page request, it aggregates across too many collections.

Admin's Framework Settings page edits `cxPulseFramework` directly. Admin's Portfolio view flags accounts stuck at Level 1–2 for 3+ months as "at risk" (churn signal) and Level 4–5 as "expansion ready" (upsell/case-study candidates) — this logic should run as a scheduled aggregation, not ad hoc.

---

## 8. The Act layer (Group-level feature)

- **Action Board**: every flagged `response` can spawn an `actionBoardItem` via a "Log action taken" button (present on Raw Feedback in both Group and Business views). Overdue = `dueDate < now && status != "resolved"`.
- **Decision Log**: for changes affecting multiple businesses. Must support linking `sourceResponseIds`/`actionBoardItems` that triggered it, and later attaching a measured `outcomeBefore`/`outcomeAfter` (this is what feeds the Outcome CX Pulse dimension — build the "measure again in N weeks" reminder as a scheduled job or manual re-visit prompt).
- **Playbooks**: standard guidance per category/issue type with a trigger condition (e.g., "3+ mentions in 2 weeks" — this should ideally be a real scheduled check that surfaces a suggestion to create an Action Board item, not just descriptive text).
- A business that belongs to a Group should see relevant `decisionLogEntries` where it's in `affectedBusinessIds`, read-only, on its own dashboard for context (see the branch-mode mockup).

---

## 9. Alert Rules

- Types: `fixed_threshold`, `regional_outlier` (score N std deviations below the region average), `sudden_drop` (% drop vs a rolling baseline), `nps_floor`.
- Prefer outlier/baseline types over fixed thresholds for anything scoped `parentOrg_all` — a flat "<4.5" rule doesn't generalize across branches with very different natural baselines (confirmed problem during design).
- `isInherited: true` rules cascade from parentOrg/admin down to businesses — visible on the business dashboard, not editable there, with a note on who to contact for a change.
- Every firing writes to `alertActivity` — all "X times this week" and Overview "flagged" counts must be computed from this, never hardcoded.
- **Bug found live:** an Alert Rule recipient list includes `business@oodelscore.com` alongside a real owner email — looks like a stray default. Audit all `alertRules.recipients` before launch.

---

## 10. AI Insights pipeline

**Schedule — this was never pinned down precisely before now, so here it is exact:**

| Period | Generation trigger | Date range covered |
|---|---|---|
| Weekly | Every Monday, 06:00 UTC | The prior Monday 00:00:00 through Sunday 23:59:59 — a full 7-day calendar week, not a rolling 7 days from generation time |
| Monthly | 1st of the month, 06:00 UTC | The full previous calendar month |
| Quarterly | 1st day of Jan/Apr/Jul/Oct, 06:00 UTC | The full previous calendar quarter |
| Yearly | 1st of January, 06:00 UTC | The full previous calendar year |
| Trust-wide monthly | Same as Monthly, run once per Parent Org | Ranks every child business for that org over the same month |

Run this as a scheduled job (cron on Render, or a scheduled Render job/worker) that queries all active businesses/orgs due for that period, generates one `aiInsightReports` document per owner per period, and leaves each at `status: "pending"` for human review — generation and publication are two separate steps, never combined.

**Model to use: Claude Haiku 4.5** (`claude-haiku-4-5-20251001`), Anthropic's current cheapest model at $1/$5 per million input/output tokens. This is the right fit specifically because generating one of these reports is a **templated summarization of numbers you've already computed** (averages, trends, category breakdowns) into plain English — it doesn't require frontier-level reasoning, and Haiku 4.5 is explicitly positioned by Anthropic for exactly this class of high-volume, structured task. Two further cost levers, both trivial to add given this job already runs overnight, non-interactively:
- **Batch API** — an additional 50% discount for asynchronous jobs like this one (you're not making a user wait on a live response), bringing effective cost to roughly $0.50/$2.50 per million tokens.
- **Prompt caching** — if the generation prompt's instructions/format template is shared across every business's report in a given run, cache it once per batch run rather than resending it per report; cached input tokens cost about 90% less.

Don't route this to Sonnet or Opus — the human-review gate below is what actually protects quality here, not model size.

- **Every report sits at `status: "pending"` until a human at Admin approves it.** Nothing reaches a Group/Business dashboard unapproved. Admin can edit `bodyMarkdown` inline, toggle `showChartOnDashboard`, regenerate a single report, or bulk-regenerate all pending via "Rebuild All Reports."
- Approval triggers the `report_ready` email and flips visibility.
- Generation logic must respect the scoring rule in Section 2 (`responses`) — star average and NPS reported separately, never blended, and any comparison to a prior period with too little data (e.g., "vs previous: 3 responses") should be flagged as low-confidence in the generated text, not stated with false precision.

---

## 10a. Scheduled jobs summary

For a single reference point when setting up Render's scheduled jobs/workers, everything in this spec that runs on a timer, gathered in one place:

| Job | Cadence | Section |
|---|---|---|
| AI Insights generation | See schedule table above | 10 |
| CX Pulse scoring | Nightly (recompute `cxPulseScores` from the prior day's activity) | 7 |
| Alert Rule evaluation | Real-time on new `responses`, or hourly batch sweep for `regional_outlier`/`sudden_drop` types since those need a rolling baseline, not a single new data point | 9 |
| Data retention / Atlas Online Archive | Ongoing, policy-driven (age threshold per plan tier) | Storage discussion above — not yet a numbered section, add one if this grows |

---

## 11. Email templates (Resend) — full trigger table

Respondents who fill out a feedback form **never** receive an email. All of the below are account-side only, sent via Resend, editable at Admin → Email Templates.

| Key | Triggered by | Key merge vars |
|---|---|---|
| `welcome` | Admin creates a business, org, or staff account | `{{name}}` `{{email}}` `{{set_password_link}}` |
| `email_changed` | User's login email is updated | `{{name}}` `{{email}}` |
| `password_reset` | User requests a reset link | `{{name}}` `{{reset_link}}` |
| `invite_to_team` | Someone invites a staff or org member | `{{name}}` `{{inviter_name}}` `{{business_name}}` `{{set_password_link}}` |
| `alert_notification` | An Alert Rule fires (write to `alertActivity`) | `{{name}}` `{{business_name}}` `{{alert_condition}}` `{{alert_link}}` |
| `report_ready` | An `aiInsightReports` doc flips to `approved` | `{{name}}` `{{report_period}}` `{{business_name}}` `{{report_link}}` |
| `action_assigned` | An `actionBoardItems.ownerId` is set/changed | `{{name}}` `{{action_title}}` `{{due_date}}` `{{action_link}}` |
| `invoice_receipt` | Stripe `payment_succeeded` webhook | `{{name}}` `{{invoice_amount}}` |
| `payment_failed` | Stripe `payment_failed` webhook | `{{name}}` `{{business_name}}` `{{billing_link}}` |

Store delivery stats (sent count, delivered %, open rate) by reading Resend's own reporting API rather than tracking separately where possible.

---

## 12. Site Content CMS

- Tabs: Menu & Sections, Home, Services, Process, Features, About, Pricing, Login & Auth — one `siteContent` doc per `page` value.
- Menu & Sections tab: nav items are reorderable (drag or up/down arrows, persisted via `order` field) and independently toggleable (`visible`); landing page sections likewise toggle independently. Hiding a section must remove its layout space entirely on the public site, not leave a gap.
- The public marketing site should read `siteContent` at render time (SSR or ISR) so changes go live without a deploy.

---

## 13. Known bugs to fix on day one

These were found live in the current app during the design phase — fix before or alongside the rebuild, not after:

1. **NPS/star-blend scoring bug.** Feedback Responses shows averages above 5.0 on a 1–5 scale (e.g., 5.6, 5.8). Root cause: an NPS (0–10) answer is being averaged together with 1–5 star answers. Fix per the scoring rule in Section 2 — NPS is always a separate metric.
2. **Orphaned billing records.** Billing Oversight shows `Account: "Unknown"` rows — subscriptions with no resolvable owner. Needs a data migration and a write-time integrity check.
3. **Universal "Invite Expired" status.** Every account in the current data shows this. Check Resend delivery logs and the expiry-window logic; this may be dummy seed data, but verify before assuming so.
4. **Suspicious duplicate alert recipient** — `business@oodelscore.com` appearing alongside real owner emails on alert rules. Audit for a stray default that shouldn't be silently CC'd on every alert.
5. **Chart axis/display bugs** seen in earlier dashboard states: y-axis maxing at 8 for a 1–5 scale, category-breakdown axes showing arbitrary maxima, "vs previous: 0/5" instead of "no prior period data." Ensure chart rendering always derives axis bounds from the actual metric range, and comparison cards explicitly handle the zero/no-data case.

---

## 14. Suggested build order

1. **Data model migration** — stand up the collections in Section 2 against the existing Mongo instance; write migration scripts to fix bugs #1–#4 above during migration, not after.
2. **Auth & RBAC** — `users`, `roles`, invite flow, JWT sessions, permission-matrix enforcement as middleware (reject writes that violate Section 4/5's ownership rules server-side, not just hide buttons client-side).
3. **Core CRUD** — Businesses, Parent Orgs, Staff, Question Templates, Categories, Feedback Points, Responses ingestion.
4. **Stripe integration** — billing model per Section 5, webhooks, Billing Oversight.
5. **Resend integration** — wire every trigger in Section 11's table to a real send.
6. **AI Insights pipeline** — generation + human review gate (Section 10).
7. **Act layer + Alert Rules** — Action Board, Decision Log, Playbooks, Alert Rules + activity log.
8. **CX Pulse** — scheduled scoring job (Section 7), framework config, portfolio views.
9. **Frontend** — build each of the four dashboards against the finalized mockup HTML files, wiring every screen to the real endpoints above.
10. **Site Content CMS** — lowest urgency; can ship after the core product loop is live.
11. **Staging deploy on Render → QA against the bug list in Section 13 → production deploy.**

---

## 15. Open decisions to confirm before building

- Should quarterly CX Pulse self-assessment questions go to every account automatically, or only to accounts below a certain maturity level?
- Should "Compare branches" (Group portal) support more than pairwise comparison for very large networks, or is region-level rollup the intended path for that?
- Confirm whether the current "Invite Expired" pattern across all seeded accounts is dummy data or a real delivery issue before treating it as either.

---

## 16. Team Members, seat limits, deletion correction & AI-assisted Action Board triage

One connected feature covering four things, added together so the schema stays consistent. See also the `users`, `parentOrganizations`, `businesses`, `actionBoardItems`, and `categoryOwnerMappings` schema changes in Section 2, and the deletion correction in Section 4.

### 16.1 Team Members — a new account type

`accountType: "team_member"` (see `users` in Section 2). Invited via the exact same invite-email mechanism already built for Admin staff (Section 3) — no new invite pattern. Two tiers, permission split enforced server-side:

- **Full** — same as the primary account's dashboard access (Dashboard, Insights, Analytics, Raw Feedback, full Act layer, Alert Rules, CX Pulse, read-only Survey Settings) — **except** Billing (any kind) and Team Members management (inviting/removing others), which only the primary account can see or do.
- **Limited** — only a narrow view of Action Board items assigned to them, with a status field and a note. No Analytics, no Raw Feedback, no visibility into other people's items, nothing else.

`teamRole` (e.g. "Shift Lead") is free text, purely cosmetic — it has no effect on permissions.

### 16.2 Two independent seat limits

Both Admin-set, both read-only to the customer, with a "Request more" link to Messages (same visual pattern as other Admin-only-config callouts in the app):

- **`branchSeatLimit`** on `parentOrganizations` — caps how many active businesses that org can have. `null` renders as "Unlimited," not a number. Enforce against the **currently-active** business count, not total-ever-created, so deactivating one branch frees a slot for a new one. Block lowering the limit below the current active count.
- **`teamMemberSeatLimit`** on `businesses` and separately on `parentOrganizations` (a Group's own staff pool is independent from any branch's pool) — same active-count-based enforcement logic as `branchSeatLimit`, reused rather than reimplemented.

Show usage plainly wherever relevant ("3 of 5 branches used," "2 of 5 team seats used").

### 16.3 Deletion rule correction

See Section 4's correction. Only `admin_staff` can delete a Business or Parent Org, enforced server-side; no delete UI exists outside Admin for any Business/Group account or Team Member at any tier.

### 16.4 AI-assisted Action Board triage on alert firing

When an Alert Rule fires (Section 9), automatically create an Action Board item — don't wait for a manual "Log action taken." Use Claude Haiku 4.5 to read the triggering response's open-text comment (if any) and generate: a real descriptive title (not "Low rating alert"), a severity level, and the best-matching category from the business's existing categories. The AI does not choose the owner — that comes from `categoryOwnerMappings` (Section 2), a simple human-configured category → default-owner mapping per business/org.

Default behavior: create the item as a suggestion, notify the mapped owner with Accept/Reassign, don't silently assign. A per-business toggle, "Auto-assign without confirmation" (`categoryOwnerMappings.autoAssignWithoutConfirmation`, off by default), switches to silent auto-assignment once a business trusts the mapping. `actionBoardItems.source` (`manual` | `auto_suggested` | `auto_assigned` | `escalated`) makes this reportable later.

This requires the Section 2 correction making `actionBoardItems.parentOrgId` nullable — a standalone business's own Alert Rule firing needs somewhere to put the auto-created item too, so a standalone business now gets its own single-business Action Board.

### 16.5 CX Pulse portfolio addition

Admin's CX Pulse portfolio view shows branch-seat usage next to CX Pulse level per account (e.g. "5 of 5 branches used · Level 4 · Improving") — this pairing is the actual expansion-ready signal for account managers, so surface it directly rather than making them cross-reference two pages.
