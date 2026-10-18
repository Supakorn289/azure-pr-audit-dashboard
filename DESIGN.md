# Infogrammer · Coding Complete Desk

Design direction: an internal engineering operations dashboard, not a generic SaaS landing page.
Inspired by Impeccable's `critique` → `distill` → `clarify` → `polish` workflow.

## Audience & job

- Audience: Infogrammer engineers, tech leads, and staff tracking Azure DevOps Work Items.
- User needs in priority order: (1) count fully completed Work Items, (2) know what's still waiting, (3) identify assignee and exact PR states, (4) open the relevant Work Item/PR.
- Non-goals: promotional copy, needless graphs, fake activity metrics, fabricated completion dates, or changing Azure DevOps data.

## Brand rules

- Use supplied NFO / Infogrammer logo, with original navy and orange. Do not redraw it or invent a new corporate logo.
- Navy `#14213a` = main identity, headings, active controls.
- Orange `#ef8a24` = completion progress and one-point emphasis only.
- Canvas `#f9f8f6`, white surfaces, soft dividers `#e6e7e7`.
- Information type: IBM Plex Sans Thai with Thai-capable system fallbacks. Avoid decorative display fonts and generic blue-purple gradients.
- Avoid nested cards, excessive round corners, oversized decorative icons, fake “live” labels, and long AI-sounding explanations.

## Information architecture

1. Top identity bar: NFO logo · team · project · data state.
2. Compact page title + true last update + refresh.
3. One dominant number: **work items with every linked PR completed** (not count of PRs).
4. Two support numbers: pending Work Items and all Work Items (all three top metrics use the same denominator).
5. Work Item status buckets are exclusive, sum exactly to Work Items total, and filter lists by primary Work Item status. In mixed PR states, precedence is ERROR > ABANDONED > ACTIVE > PASSED, with NO_PR separate.
6. PR status counts are shown in a separate, clearly labeled secondary line; deduplicated PRs sum to PR total. “ไม่มี PR” belongs to the Work Item distribution only.
7. Default actionable work list: pending only, with owner, each linked PR state, number completed/total, and expandable PR links. Work-item and assignee filters, search and CSV export remain available.

## Content language

- Work Item, PR, Completed, Active, Abandoned remain as the Azure DevOps domain terms.
- Primary UI in natural Thai. Prefer “รอติดตาม”, “PR ครบแล้ว”, “ผู้รับผิดชอบ”, “เปิดใบงาน”.
- No claim that Coding Complete means PR was merged.
- When an API refresh fails after a prior success, visibly label previously loaded data as potentially stale.
- Demo mode clearly discloses its synthetic values; it is never a hidden fallback.

## Responsive/accessibility

- Desktop: compact aligned rows with distinct columns; avoid visual clutter.
- Mobile: reorganize rows into readable stacked groups; don't force sideways table scrolling.
- Keyboard focus rings, aria names for icon controls, tab/filter state, and reduced-motion support.
- All status indicators include text and count, never color alone.

## Non-regression contract

Backend selection remains: `System.TeamProject = project AND System.State = Coding Complete AND System.ExternalLinkCount > 0`, all assignees. Read-only. Maintain separate Work Item and PR denominators and distinct PR counts. All linked PRs must be `completed` for a Work Item to pass. Preserve unknown/error/mixed statuses and CSV formula injection prevention.

## v3.1 metric guardrails

- `completedItems + pendingItems === totalItems`.
- `sum(workCounts) === totalItems` where each Work Item belongs to one bucket.
- `sum(statusCounts) === totalPRs` where PRs are deduplicated by project/repo/PR ID.
- Filtered work-list heading always includes both the number of matching Work Items and `totalItems` (e.g. `72 จาก 86 งาน`).
- Do not use `PR:completed` membership filters for headline Work Item completion metrics: one PR can link many Work Items, and a Work Item can have mixed PR statuses.
