# Infogrammer Dashboard v3.1 — Metrics Reconciliation Patch

Apply on top of the existing v3 dashboard in your GitHub repository. This patch changes Work Item aggregation and dashboard presentation, **not the Azure DevOps REST API**.

## Change summary

- Primary Work Item totals use a common denominator: fully PR-completed + pending = all Coding Complete Work Items.
- All Work Items belong to exactly one *primary* status bucket: PASSED, ACTIVE, ABANDONED, NO_PR, ERROR. Buckets are exclusive and sum to the total.
- Independent, read-only PR status breakdown counts distinct PRs (one PR may be referenced by multiple Work Items).
- Clicking status Work Item buckets filters by the same exclusive classification; therefore the count shown in a status button matches work item records with that status when no additional search/assignee filter is applied.
- The result list explicitly labels its filtered count as a subset of the total (`X จาก Y งาน`), preventing the earlier misleading `26` count.
- All existing assignee search, per-PR statuses, details, CSV export, and API conditions remain.

## Patch files

`app/page.tsx`, `app/audit-model.ts`, `app/globals.css`, `tests/audit-model.test.mjs`, `DESIGN.md`, `README.md`.

Do **not** overwrite your `package-lock.json`, `.env.local`, or `app/api/audit/route.ts`.

## Apply (Windows CMD)

1. Commit/backup your v3 working tree.
2. Extract `infogrammer-dashboard-v3-1-metrics-patch.zip` at repository root, replacing matching files.
3. Run:

```bat
cd /d D:\Myproject\azure-pr-audit-dashboard
npm ci
node --experimental-strip-types --test tests\audit-model.test.mjs
npx tsc --noEmit
npm run build
npm run dev
```

4. Compare `http://localhost:3000` to real Azure DevOps data; `/?demo=1` uses synthetic data. Expected invariants:

- Work Item counts: `Completed Work Items + Pending Work Items = Total Work Items`.
- Work Item status chip counts sum to total, even with mixed PR statuses.
- Distinct PR status counts sum to `totalPRs`, *not* to Work Items.
- Clicking a Work Item status chip matches the number of list items when the assignee is All and search is blank.

The screenshots 86 Work Items / 14 completed / 72 pending / 19 completed PR / 75 active PR are **user-observed snapshots**, not verified Azure results. A synthetic fixture reproduces this scenario in unit tests. If the API returns something else when refreshed, the dashboard should show current API data, not hardcoded screenshot counts.

## Quality gate / caveats

`node --experimental-strip-types --test`: 7/7 PASS. TypeScript TSX transpilation syntax check: PASS. Full Next.js `npm run build` and live Azure DevOps verification were not executed in this environment. Review on your machine before GitHub/Vercel Production deployment. Keep Azure PAT server-only and use access protection.
