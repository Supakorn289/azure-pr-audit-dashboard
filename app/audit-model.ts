export type Category = "PASSED" | "ACTIVE" | "ABANDONED" | "NO_PR" | "ERROR";
export type StatusView = "ATTENTION" | "ALL" | "PASSED" | "NO_PR" | `PR:${string}` | `WORK:${Category}`;

export interface PRInfo {
  prId: string;
  repoId: string;
  projectId: string;
  repoName: string;
  status: string;
  title?: string;
  url: string;
}

export interface AuditWorkItem {
  id: number;
  type: string;
  title: string;
  state: string;
  assignedTo: string;
  workItemUrl: string;
  categoryCode: Category;
  categoryLabel: string;
  isPassed: boolean;
  prCount: number;
  completedPrCount: number;
  prs: PRInfo[];
  otherLinks: string[];
  releaseVersion?: string;
}

export function normalizeStatus(value: string | undefined): string {
  return (value || "unknown").trim().toLowerCase() || "unknown";
}

export function isCompleted(item: AuditWorkItem): boolean {
  return item.prs.length > 0 && item.prs.every((pr) => normalizeStatus(pr.status) === "completed");
}

/** One Work Item belongs to exactly one summary bucket, even if its PR statuses are mixed. */
export function primaryWorkStatus(item: AuditWorkItem): Category {
  if (item.prs.length === 0) return "NO_PR";
  const statuses = item.prs.map((pr) => normalizeStatus(pr.status));
  if (statuses.some((status) => !["completed", "active", "abandoned"].includes(status))) return "ERROR";
  if (statuses.every((status) => status === "completed")) return "PASSED";
  if (statuses.includes("abandoned")) return "ABANDONED";
  return "ACTIVE";
}

export function summarize(items: AuditWorkItem[]) {
  const prs = new Map<string, PRInfo>();
  for (const item of items) {
    for (const pr of item.prs) {
      // One PR can be attached to multiple Work Items; count it once in PR-level metrics.
      const key = `${pr.projectId}/${pr.repoId}/${pr.prId}`;
      if (!prs.has(key)) prs.set(key, pr);
    }
  }
  const statusCounts: Record<string, number> = {};
  for (const pr of prs.values()) {
    const status = normalizeStatus(pr.status);
    statusCounts[status] = (statusCounts[status] ?? 0) + 1;
  }
  const workCounts: Record<Category, number> = { PASSED: 0, ACTIVE: 0, ABANDONED: 0, NO_PR: 0, ERROR: 0 };
  for (const item of items) workCounts[primaryWorkStatus(item)]++;
  const completedItems = workCounts.PASSED;
  return {
    totalItems: items.length,
    completedItems,
    pendingItems: items.length - completedItems,
    totalPRs: prs.size,
    completedPRs: statusCounts.completed ?? 0,
    missingPRItems: workCounts.NO_PR,
    workCounts,
    statusCounts,
  };
}

export function matchesView(item: AuditWorkItem, view: StatusView): boolean {
  if (view === "ALL") return true;
  if (view === "ATTENTION") return !isCompleted(item);
  if (view === "PASSED") return isCompleted(item);
  if (view === "NO_PR") return primaryWorkStatus(item) === "NO_PR";
  if (view.startsWith("WORK:")) return primaryWorkStatus(item) === view.slice(5);
  if (view.startsWith("PR:")) {
    const status = view.slice(3);
    return item.prs.some((pr) => normalizeStatus(pr.status) === status);
  }
  return false;
}

export function priority(item: AuditWorkItem): number {
  if (item.prs.length === 0) return 2;
  if (item.prs.some((pr) => ["error", "unknown"].includes(normalizeStatus(pr.status)) || !["completed", "active", "abandoned"].includes(normalizeStatus(pr.status)))) return 0;
  if (item.prs.some((pr) => normalizeStatus(pr.status) === "abandoned")) return 1;
  if (item.prs.some((pr) => normalizeStatus(pr.status) === "active")) return 3;
  return 4;
}
