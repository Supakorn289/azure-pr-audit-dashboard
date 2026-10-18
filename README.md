# Infogrammer — Coding Complete Desk (v3.1)

Internal Azure DevOps audit dashboard for Infogrammer Co., Ltd. using the supplied NFO brand asset.

## Purpose

Show the number of Work Items where **all** attached PRs are Completed, the outstanding Work Items, all linked PR states, and the people responsible. Includes search, filters, paginated detail expansion, and CSV download.

## Audit contract

Work Items in scope: `System.TeamProject = AZURE_DEVOPS_PROJECT`, `System.State = Coding Complete`, `System.ExternalLinkCount > 0` for **every assignee**. PRs are counted distinctly by project/repository/PR ID. A Work Item is Completed only if it has at least one PR and **every** associated PR is Completed. "No PR" is not itself a PR status; it counts Work Items with no attached PR.

The REST API is unchanged. The audit model now produces a **mutually exclusive Work Item status distribution** (`PASSED`, `ACTIVE`, `ABANDONED`, `NO_PR`, `ERROR`) in addition to distinct PR-status counts. Work-item buckets sum to the Work Item total, and PR-status buckets sum to the distinct PR total; the two denominators are never mixed.

A PR can be linked to several Work Items, and a Work Item can have several PRs. For example, 86 Work Items can legitimately comprise 14 fully completed and 72 still pending, while 19 distinct PRs are completed and 75 are active. A PR:completed membership filter could also match 26 Work Items in that data; it must never be labeled as the number of fully completed Work Items.

Main view counts and status filters use Work Item units. The secondary PR status line uses PR units and is informational (not a Work Item count filter).

## Run / deploy

For new checkouts you need a `package-lock.json` created by `npm install`, or use the PATCH zip to preserve the lockfile from your existing repository.

```sh
cp .env.example .env.local  # fill organization, project and read-only PAT
npm install                 # only for a new checkout without a lockfile
npm run test
npx tsc --noEmit
npm run build
npm run dev
```

Use `/?demo=1` for labeled synthetic data; `/` for Azure DevOps. Never commit `.env.local` or a PAT.

This dashboard does not implement application authentication. Configure Vercel Deployment Protection or another appropriate access-control mechanism before exposing production data. See `DESIGN.md` and `PATCH_INSTRUCTIONS.md`.

## Quality gate

Audit-model tests checked locally (7/7), including the explicit 86/14/72/94/19/75/26 reconciliation fixture. TSX syntax transpilation checked. A full Next.js production build and live Azure/Vercel integration require a clean `npm install`/`npm ci` in the deployment environment; they have not been confirmed in this sandbox.
