# scope. — Azure DevOps Coding Complete Audit Dashboard

Next.js 14 + Tailwind CSS dashboard focused on the real Azure DevOps `Coding Complete` + Pull Request audit workflow.

## Run locally

```bash
cp .env.example .env.local
# Edit .env.local with your Azure DevOps organization, project, and PAT
npm ci
npm run dev
```

Open http://localhost:3000 for **real Azure data** or http://localhost:3000/?demo=1 for **explicitly labeled synthetic preview data** (no Azure token required).

## UI functions

- Overview: audit pass-rate, work-item counts, PR status, and reconciliation by audit category.
- Follow-up queue: prioritizes audit errors, abandoned PR, missing PR, and active PR.
- Individual assignee and target-team filter; click-to-filter KPI cards and status breakdown.
- Search by work-item ID, title, owner, release, repository, PR ID or PR title; sorting, paging, and expandable PR details.
- Export the currently filtered rows to UTF-8 BOM CSV (Excel compatible), with CSV formula injection protection.
- Real connection failures are displayed. **No automatic fake data fallback.**

## Important scope semantics

Original backend criteria are retained: `State = Coding Complete` **and** `ExternalLinkCount > 0`. Therefore dashboard totals are not the total number of all Coding Complete work items; work items with zero external links are outside the audit. The "team being followed" comes from the existing name matcher in `app/api/audit/route.ts`, not an Azure security group.

The statuses `PASSED`, `ACTIVE`, `ABANDONED`, `NO_PR`, `ERROR` are mutually exclusive based on PR reconciliation rules. Coding Complete on the Work Item does **not** imply that PRs are merged. The dashboard is read-only with respect to Azure DevOps.

## Security and deployment

- **The original uploaded ZIP included a `.env.local` file**; this package deliberately excludes it. Do not publish local `.env` credentials or your original archive. If that file contains a real PAT and was shared externally, revoke/rotate it.
- PAT must remain server-only in environment variables. Use a minimally scoped read-only token and add authentication/network restrictions before publishing this dashboard.
- API currently reads Azure work items/PRs with a server-side PAT. Restrict access to trusted users. CORS is not a substitute for authentication.
- After `npm run build`, deploy using the usual Next.js / Vercel process and configure `AZURE_DEVOPS_ORG`, `AZURE_DEVOPS_PROJECT`, `AZURE_DEVOPS_PAT` in the platform's server environment settings.
- `?demo=1` intentionally uses fixed, visibly labeled sample items; it never writes to Azure.

## Quality checks

```bash
npx tsc --noEmit
npm run build
```
