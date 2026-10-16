"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity, AlertCircle, ArrowRight, ArrowUpRight,
  CheckCheck, ChevronDown, ChevronLeft, ChevronRight, CircleHelp,
  Clock3, Cloud, Download, ExternalLink, FileText, Filter,
  GitMerge, GitPullRequest, Layers3, LayoutDashboard, LoaderCircle, Menu,
  MoreHorizontal, RefreshCw, Search, ShieldAlert, SlidersHorizontal, X,
} from "lucide-react";

type Category = "PASSED" | "ACTIVE" | "ABANDONED" | "NO_PR" | "ERROR";
type ViewFilter = Category | "ALL" | "ATTENTION";
type Scope = "TARGET" | "ALL" | string;
type Sort = "NEWEST" | "OLDEST" | "PRIORITY";

interface PRInfo {
  prId: string;
  repoId: string;
  projectId: string;
  repoName: string;
  status: string;
  title?: string;
  url: string;
}
interface AuditWorkItem {
  id: number;
  type: string;
  title: string;
  state: string;
  assignedTo: string;
  isTargetAssignee: boolean;
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

const statusInfo: Record<Category, { label: string; short: string; desc: string; color: string }> = {
  PASSED: { label: "ผ่านการตรวจสอบ", short: "Completed", desc: "PR ทั้งหมด Completed", color: "var(--success)" },
  ACTIVE: { label: "รอ Merge", short: "Active PR", desc: "ยังมี PR เปิดอยู่", color: "var(--warning)" },
  ABANDONED: { label: "PR ถูกยกเลิก", short: "Abandoned", desc: "พบ PR ที่ถูกยกเลิก", color: "var(--danger)" },
  NO_PR: { label: "ไม่พบ Pull Request", short: "Missing PR", desc: "มีลิงก์พัฒนา แต่ไม่พบ PR", color: "var(--slate)" },
  ERROR: { label: "ตรวจสอบไม่สำเร็จ", short: "Audit error", desc: "ดึงข้อมูล PR ไม่สำเร็จ", color: "var(--violet)" },
};
const categories: Category[] = ["PASSED", "ACTIVE", "ABANDONED", "NO_PR", "ERROR"];
const attentionRank: Record<Category, number> = { ERROR: 0, ABANDONED: 1, NO_PR: 2, ACTIVE: 3, PASSED: 4 };
const demoTitles = [
  "ปรับปรุงเงื่อนไขการตรวจสอบข้อมูลก่อนบันทึก", "แก้ไขปัญหาการแสดงผลในหน้ารายงาน", "เพิ่ม validation สำหรับการเปลี่ยนสถานะรายการ",
  "ปรับปรุงประสิทธิภาพ API ค้นหาข้อมูล", "อัปเดตหน้าจอรายละเอียดลูกค้า", "แก้ไขการจัดการ permission ของผู้ใช้",
  "เพิ่ม unit test สำหรับ business rules", "ปรับการแสดงผลข้อมูลบนหน้าจอมือถือ", "แก้ไขปัญหาการส่งข้อมูลข้ามบริการ",
  "ปรับปรุง error handling ในขั้นตอนอนุมัติ", "พัฒนาระบบแจ้งเตือนรายการค้าง", "ตรวจสอบความถูกต้องของ release metadata",
  "แก้ไข query สำหรับการเรียกดูประวัติ", "ปรับ UX ของฟอร์มสร้างรายการใหม่", "รีแฟกเตอร์ส่วนเชื่อมต่อ repository",
  "ปรับปรุงการจัดเรียงรายการในหน้าค้นหา", "อัปเดต test cases สำหรับ workflow หลัก", "แก้ไขปัญหาการโหลดหน้า dashboard",
];
const demoKinds: Category[] = ["PASSED", "PASSED", "ACTIVE", "PASSED", "NO_PR", "ACTIVE", "PASSED", "ABANDONED", "PASSED", "ERROR", "PASSED", "ACTIVE", "PASSED", "NO_PR", "PASSED", "PASSED", "ACTIVE", "PASSED"];
const demoPeople = ["Biw Piyanut", "watcharanon", "Biw Piyanut", "watcharanon", "Biw Piyanut", "watcharanon", "Biw Piyanut", "watcharanon", "Biw Piyanut", "watcharanon", "P. Kittisak", "S. Nattaya", "T. Anan", "P. Kittisak", "S. Nattaya", "T. Anan", "P. Kittisak", "S. Nattaya"];
const demoItems: AuditWorkItem[] = demoTitles.map((title, i) => {
  const status = demoKinds[i];
  const prStatus = status === "PASSED" ? "completed" : status === "ACTIVE" ? "active" : status === "ABANDONED" ? "abandoned" : "error";
  const prs: PRInfo[] = status === "NO_PR" ? [] : [{ prId: String(8100 + i * 17), repoId: "demo", projectId: "demo", repoName: i % 3 === 0 ? "fbpro-api" : "fbpro-web", status: prStatus, url: "#", title: title }];
  return {
    id: 28460 - i * 9,
    type: i % 4 === 0 ? "Bug" : i % 3 === 0 ? "Task" : "User Story",
    title, state: "Coding Complete", assignedTo: demoPeople[i], isTargetAssignee: i < 10,
    workItemUrl: "#", categoryCode: status, categoryLabel: statusInfo[status].label, isPassed: status === "PASSED",
    prCount: prs.length, completedPrCount: status === "PASSED" ? 1 : 0, prs,
    otherLinks: status === "NO_PR" ? ["Commit", "Branch"] : i % 3 === 0 ? ["Commit"] : [],
    releaseVersion: i % 2 === 0 ? "R26.10" : "R26.11",
  };
});

function compactDate(value: string) {
  if (!value) return "—";
  return new Date(value).toLocaleString("th-TH", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function initials(value: string) {
  const parts = value.split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? parts.slice(0, 2).map((x) => x[0]).join("") : value.slice(0, 2)).toUpperCase();
}
function cleanCsvCell(value: string | number | boolean) {
  let text = String(value);
  // Excel-safe CSV: prevent formulas injected through Azure fields.
  if (/^[\s]*[=+@\-\t\r]/.test(text)) text = "'" + text;
  return `"${text.replace(/"/g, '""')}"`;
}
function StatusBadge({ status }: { status: Category }) {
  return <span className={`status-badge status-${status.toLowerCase()}`}><span className="status-dot" />{statusInfo[status].label}</span>;
}
function LinkOrText({ href, children, className = "" }: { href: string; children: React.ReactNode; className?: string }) {
  if (!href || href === "#") return <span className={className}>{children}</span>;
  return <a className={className} href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
}

export default function AuditDashboardPage() {
  const [items, setItems] = useState<AuditWorkItem[]>([]);
  const [updatedAt, setUpdatedAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demo, setDemo] = useState(false);
  const [assigneeScope, setAssigneeScope] = useState<Scope>("TARGET");
  const [statusFilter, setStatusFilter] = useState<ViewFilter>("ALL");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<Sort>("NEWEST");
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  const fetchAuditData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/audit", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "ไม่สามารถเชื่อมต่อ Azure DevOps ได้");
      if (!Array.isArray(body.items)) throw new Error("โครงสร้างข้อมูลที่ได้รับไม่ถูกต้อง");
      setItems(body.items);
      setUpdatedAt(body.updatedAt || new Date().toISOString());
      setHasLoaded(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ไม่สามารถเรียกข้อมูลได้");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("demo") === "1") {
      setDemo(true);
      setItems(demoItems);
      setUpdatedAt(new Date().toISOString());
      setHasLoaded(true);
      setLoading(false);
    } else {
      void fetchAuditData();
    }
  }, [fetchAuditData]);

  const reload = () => {
    if (demo) {
      setUpdatedAt(new Date().toISOString());
      return;
    }
    void fetchAuditData();
  };
  const assignees = useMemo(() => Array.from(new Set(items.map((x) => x.assignedTo))).sort((a, b) => a.localeCompare(b)), [items]);
  const targetCount = useMemo(() => items.filter((x) => x.isTargetAssignee).length, [items]);
  const scoped = useMemo(() => items.filter((x) => assigneeScope === "ALL" || (assigneeScope === "TARGET" ? x.isTargetAssignee : x.assignedTo === assigneeScope)), [items, assigneeScope]);
  const metrics = useMemo(() => {
    const counts = Object.fromEntries(categories.map((status) => [status, scoped.filter((x) => x.categoryCode === status).length])) as Record<Category, number>;
    const total = scoped.length;
    const passed = counts.PASSED;
    const prTotal = scoped.reduce((sum, x) => sum + x.prCount, 0);
    const completedPR = scoped.reduce((sum, x) => sum + x.completedPrCount, 0);
    return { counts, total, passed, attention: total - passed, passRate: total ? Math.round((passed / total) * 100) : 0, prTotal, completedPR };
  }, [scoped]);
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return scoped.filter((item) => {
      if (statusFilter === "ATTENTION" && item.categoryCode === "PASSED") return false;
      if (statusFilter !== "ALL" && statusFilter !== "ATTENTION" && item.categoryCode !== statusFilter) return false;
      if (!query) return true;
      return [String(item.id), item.title, item.assignedTo, item.type, item.releaseVersion || "", ...item.prs.flatMap((pr) => [pr.prId, pr.repoName, pr.title || ""])].some((field) => field.toLocaleLowerCase().includes(query));
    }).sort((a, b) => {
      if (sort === "PRIORITY") return attentionRank[a.categoryCode] - attentionRank[b.categoryCode] || b.id - a.id;
      return sort === "OLDEST" ? a.id - b.id : b.id - a.id;
    });
  }, [scoped, statusFilter, search, sort]);
  const pageSize = 8;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const shown = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const attentionItems = useMemo(() => scoped.filter((x) => x.categoryCode !== "PASSED").sort((a, b) => attentionRank[a.categoryCode] - attentionRank[b.categoryCode] || b.id - a.id).slice(0, 4), [scoped]);
  const teamTotals = useMemo(() => {
    const map = new Map<string, { name: string; total: number; passed: number }>();
    scoped.forEach((x) => {
      const current = map.get(x.assignedTo) || { name: x.assignedTo, total: 0, passed: 0 };
      current.total++;
      if (x.categoryCode === "PASSED") current.passed++;
      map.set(x.assignedTo, current);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name)).slice(0, 5);
  }, [scoped]);
  const chart = useMemo(() => {
    if (!metrics.total) return "conic-gradient(#e9ecec 0% 100%)";
    let previous = 0;
    const stops = categories.map((cat) => {
      const end = previous + (metrics.counts[cat] / metrics.total) * 100;
      const stop = `${statusInfo[cat].color} ${previous}% ${end}%`;
      previous = end;
      return stop;
    });
    return `conic-gradient(${stops.join(", ")})`;
  }, [metrics]);

  const applyFilter = (filter: ViewFilter) => { setStatusFilter(filter); setPage(1); setExpandedId(null); };
  const changeScope = (scope: Scope) => { setAssigneeScope(scope); setPage(1); setExpandedId(null); };
  const jumpToTable = (filter: ViewFilter, query = "") => {
    applyFilter(filter);
    setSearch(query);
    document.getElementById("work-items")?.scrollIntoView({ behavior: "smooth", block: "start" });
    setMobileOpen(false);
  };
  const exportCSV = () => {
    const headers = ["WorkItemId", "Type", "AssignedTo", "State", "ReleaseVersion", "AuditCategory", "IsPassed", "PR_Count", "Completed_PR_Count", "PR_Details", "OtherDevLinks", "Title", "WorkItemUrl"];
    const rows = filtered.map((item) => [
      item.id, item.type, item.assignedTo, item.state, item.releaseVersion || "-", item.categoryLabel, item.isPassed,
      item.prCount, item.completedPrCount, item.prs.map((p) => `PR #${p.prId} [${p.repoName}] (${p.status})`).join(" | "), item.otherLinks.join(" | "), item.title, item.workItemUrl,
    ].map(cleanCsvCell).join(","));
    const csv = "\uFEFF" + [headers.map(cleanCsvCell).join(","), ...rows].join("\r\n");
    const link = document.createElement("a");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    link.href = url;
    link.download = `${demo ? "DEMO_" : ""}Coding_Complete_Audit_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const noData = !hasLoaded;
  const numberDisplay = (value: number) => (noData ? "—" : value.toLocaleString("en-US"));

  return (
    <div className="app-shell">
      {mobileOpen && <button className="mobile-scrim" aria-label="ปิดเมนู" onClick={() => setMobileOpen(false)} />}
      <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
        <div className="brand-section">
          <div className="brand-mark"><Layers3 size={22} strokeWidth={2.4} /></div>
          <div className="brand-copy"><strong>scope<span className="brand-period">.</span></strong><small>ENGINEERING DESK</small></div>
          <button className="mobile-close icon-button" aria-label="ปิดเมนู" onClick={() => setMobileOpen(false)}><X size={18} /></button>
        </div>
        <div className="sidebar-body">
          <div className="nav-label">WORKSPACE</div>
          <button className="nav-item nav-active" onClick={() => { window.scrollTo({ top: 0, behavior: "smooth" }); setMobileOpen(false); }}><LayoutDashboard size={18} /> <span>ภาพรวมงาน</span><span className="nav-active-marker" /></button>
          <button className="nav-item" onClick={() => jumpToTable("ALL")}><FileText size={18} /> <span>รายการใบงาน</span><span className="nav-count">{numberDisplay(metrics.total)}</span></button>
          <button className="nav-item" onClick={() => jumpToTable("ATTENTION")}><ShieldAlert size={18} /> <span>ต้องติดตาม</span><span className="nav-count nav-count-warn">{numberDisplay(metrics.attention)}</span></button>
          <div className="nav-label second-nav-label">AUDIT STATUS</div>
          {categories.map((cat) => (
            <button key={cat} className="nav-item nav-sub-item" onClick={() => jumpToTable(cat)}><span className={`nav-status-dot nav-${cat.toLowerCase()}`} /><span>{statusInfo[cat].short}</span><span className="nav-count">{numberDisplay(metrics.counts[cat])}</span></button>
          ))}
          <div className="sidebar-card">
            <div className="sidebar-card-icon"><GitPullRequest size={20} /></div>
            <p>Azure DevOps</p>
            <strong>FBPro_Trunk</strong>
            <span>ตรวจสอบ Work Item และ PR จากโปรเจกต์เดียวกัน</span>
            <div className="sidebar-card-status"><span className={`live-dot ${demo ? "live-demo" : hasLoaded && !error ? "live-on" : "live-off"}`} />{demo ? "Demo mode" : error ? "การเชื่อมต่อมีปัญหา" : loading ? "กำลังเชื่อมต่อ" : hasLoaded ? "เชื่อมต่อสำเร็จ" : "ยังไม่เชื่อมต่อ"}</div>
          </div>
        </div>
        <div className="sidebar-footer"><div className="small-avatar">AD</div><div><strong>Audit workspace</strong><span>Read-only dashboard</span></div><MoreHorizontal size={18} /></div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb"><button className="hamburger icon-button" aria-label="เปิดเมนู" onClick={() => setMobileOpen(true)}><Menu size={20} /></button><span>Workspace</span><ChevronRight size={14} /><span>FBPro_Trunk</span><ChevronRight size={14} /><strong>Overview</strong></div>
          <div className="topbar-right"><span className="top-date">{compactDate(updatedAt)}</span><div className="topbar-divider" /><span className={`connection-pill ${demo ? "pill-demo" : error ? "pill-off" : ""}`}><span className="live-dot" />{demo ? "ข้อมูลตัวอย่าง" : error ? "เชื่อมต่อผิดพลาด" : loading ? "กำลังซิงก์" : hasLoaded ? "ข้อมูลล่าสุด" : "กำลังเชื่อมต่อ"}</span></div>
        </header>

        <main className="main-content">
          <section className="page-heading">
            <div><div className="eyebrow"><span className="eyebrow-line" /> ENGINEERING / QUALITY CONTROL</div><h1>ภาพรวมงาน <span>Coding Complete</span></h1><p>ติดตามความพร้อมของใบงาน ตรวจสอบ Pull Request และระบุจุดที่ต้องดำเนินการต่อในหน้าเดียว</p></div>
            <div className="heading-actions"><button className="button button-quiet" onClick={exportCSV} disabled={!hasLoaded || filtered.length === 0}><Download size={17} /> Export CSV</button><button className="button button-primary" onClick={reload} disabled={loading}><RefreshCw size={17} className={loading ? "spin" : ""} />{loading ? "กำลังตรวจสอบ" : "รีเฟรชข้อมูล"}</button></div>
          </section>

          {demo && <div className="info-notice"><CircleHelp size={17} /><span><strong>Preview mode:</strong> ข้อมูลทั้งหมดบนหน้านี้เป็นข้อมูลจำลองเพื่อดูดีไซน์ ไม่ได้ดึงจาก Azure DevOps จริง</span><a href="/">เปิดข้อมูลจริง <ArrowUpRight size={13} /></a></div>}
          {error && <div className="error-notice" role="alert"><AlertCircle size={20} /><div><strong>ไม่สามารถอัปเดตข้อมูลจาก Azure DevOps</strong><p>{error}{hasLoaded && !demo ? " — กำลังแสดงข้อมูลล่าสุดที่เคยโหลดสำเร็จ" : " — ยังไม่มีข้อมูลจริงสำหรับแสดงผล"}</p></div><button className="button button-small" onClick={reload}>ลองอีกครั้ง</button></div>}

          <div className="scope-strip"><div className="scope-title"><SlidersHorizontal size={16} /><span>ขอบเขตการแสดงผล</span></div><div className="scope-switch"><button className={assigneeScope === "TARGET" ? "selected" : ""} onClick={() => changeScope("TARGET")}>ทีมที่ติดตาม <span>{numberDisplay(targetCount)}</span></button><button className={assigneeScope === "ALL" ? "selected" : ""} onClick={() => changeScope("ALL")}>ทั้งโปรเจกต์ <span>{numberDisplay(items.length)}</span></button></div><div className="scope-select"><select aria-label="เลือกผู้รับผิดชอบ" value={assigneeScope === "ALL" || assigneeScope === "TARGET" ? "" : assigneeScope} onChange={(e) => e.target.value && changeScope(e.target.value)}><option value="">เลือกบุคคล</option>{assignees.map((person) => <option key={person} value={person}>{person}</option>)}</select><ChevronDown size={15} /></div><span className="scope-caption">เฉพาะสถานะ Coding Complete ที่มี External Link</span></div>

          <section className="kpi-grid" aria-label="ตัวชี้วัดหลัก">
            <button className="kpi-feature" onClick={() => jumpToTable("PASSED")}><div className="feature-top"><span><span className="feature-top-dot" /> AUDIT PERFORMANCE</span><ArrowUpRight size={18} /></div><div className="feature-center"><strong>{noData ? "—" : `${metrics.passRate}%`}</strong><div><span>อัตราผ่านการตรวจสอบ</span><p>ใบงานที่ PR ทั้งหมดเป็น Completed</p></div></div><div className="feature-progress"><span style={{ width: `${metrics.passRate}%` }} /></div><div className="feature-foot"><span>Passed {numberDisplay(metrics.passed)} รายการ</span><span>จาก {numberDisplay(metrics.total)} รายการ</span></div></button>
            <button className="kpi-card" onClick={() => jumpToTable("ALL")}><div className="kpi-icon kpi-blue"><Layers3 size={21} /></div><div className="kpi-top"><span>งานในขอบเขต</span><ArrowUpRight size={16} /></div><strong>{numberDisplay(metrics.total)}</strong><small>Work items ทั้งหมดที่พบ</small><span className="kpi-meta">CODING COMPLETE</span></button>
            <button className="kpi-card" onClick={() => jumpToTable("ACTIVE")}><div className="kpi-icon kpi-amber"><GitPullRequest size={21} /></div><div className="kpi-top"><span>รอ Merge</span><ArrowUpRight size={16} /></div><strong>{numberDisplay(metrics.counts.ACTIVE)}</strong><small>มี Pull Request สถานะ Active</small><span className="kpi-meta">PENDING REVIEW</span></button>
            <button className="kpi-card" onClick={() => jumpToTable("ATTENTION")}><div className="kpi-icon kpi-rose"><AlertCircle size={21} /></div><div className="kpi-top"><span>ยังไม่ผ่านเกณฑ์</span><ArrowUpRight size={16} /></div><strong>{numberDisplay(metrics.attention)}</strong><small>รวมงานที่ต้องตรวจสอบต่อ</small><span className="kpi-meta">NEEDS ATTENTION</span></button>
          </section>

          <section className="insights-grid">
            <div className="panel distribution-panel"><div className="panel-header"><div><span className="section-overline">AUDIT BREAKDOWN</span><h2>สถานะการตรวจสอบ</h2><p>สัดส่วนผลตรวจตามรายการในขอบเขตที่เลือก</p></div><span className="subtle-tag"><Activity size={14} /> Live summary</span></div><div className="distribution-body"><div className="donut" style={{ background: chart }} role="img" aria-label={`ผ่านการตรวจสอบ ${metrics.passed} จาก ${metrics.total} รายการ`}><div className="donut-hole"><strong>{numberDisplay(metrics.total)}</strong><span>รายการทั้งหมด</span></div></div><div className="distribution-legend">{categories.map((cat) => <button key={cat} className="legend-row" onClick={() => jumpToTable(cat)}><span className={`legend-dot legend-${cat.toLowerCase()}`} /><span>{statusInfo[cat].label}</span><strong>{numberDisplay(metrics.counts[cat])}</strong><span className="legend-percent">{metrics.total ? Math.round((metrics.counts[cat] / metrics.total) * 100) : 0}%</span></button>)}</div></div></div>
            <div className="panel queue-panel"><div className="panel-header queue-header"><div><span className="section-overline">ACTION REQUIRED</span><h2>รายการที่ควรติดตาม</h2><p>เรียงลำดับจากข้อผิดพลาดและความเสี่ยงก่อน</p></div><button className="subtle-link" onClick={() => jumpToTable("ATTENTION")}>ดูทั้งหมด <ArrowRight size={16} /></button></div><div className="queue-list">{attentionItems.length ? attentionItems.map((item) => <button key={item.id} className="queue-row" onClick={() => jumpToTable("ALL", String(item.id))}><span className={`queue-symbol queue-${item.categoryCode.toLowerCase()}`}>{item.categoryCode === "ACTIVE" ? <Clock3 size={17} /> : item.categoryCode === "NO_PR" ? <GitPullRequest size={17} /> : <AlertCircle size={17} />}</span><span className="queue-text"><strong>{item.title}</strong><small>#{item.id} <span className="queue-separator">·</span> {item.assignedTo}</small></span><span className={`queue-status queue-status-${item.categoryCode.toLowerCase()}`}>{statusInfo[item.categoryCode].short}</span><ChevronRight size={17} className="queue-chevron" /></button>) : <div className="empty-widget"><CheckCheck size={28} /><strong>{hasLoaded ? "ไม่มีงานที่ต้องติดตาม" : "รอข้อมูลจาก Azure DevOps"}</strong><span>{hasLoaded ? "ทุกใบงานในขอบเขตผ่านเกณฑ์แล้ว" : "เชื่อมต่อข้อมูลเพื่อเริ่มการตรวจสอบ"}</span></div>}</div><div className="queue-footer"><span>แสดง {attentionItems.length} จาก {numberDisplay(metrics.attention)} รายการที่ยังไม่ผ่าน</span><button onClick={() => jumpToTable("ATTENTION")}>เปิดรายการทั้งหมด <ArrowRight size={15} /></button></div></div>
          </section>

          <section className="secondary-grid">
            <div className="panel team-panel"><div className="panel-header"><div><span className="section-overline">WORKLOAD</span><h2>ภาพรวมผู้รับผิดชอบ</h2><p>จำนวนงานและงานที่ผ่านเกณฑ์ของแต่ละคน</p></div><span className="subtle-tag">Top 5</span></div><div className="team-list">{teamTotals.length ? teamTotals.map((member, idx) => <button className="team-row" key={member.name} onClick={() => {changeScope(member.name); applyFilter("ALL"); document.getElementById("work-items")?.scrollIntoView({ behavior: "smooth" });}}><span className={`team-avatar avatar-${idx % 4}`}>{initials(member.name)}</span><span className="team-main"><span className="team-name">{member.name}<strong>{member.total} งาน</strong></span><span className="team-track"><span style={{width:`${Math.round(member.passed / member.total * 100)}%`}} /></span></span><span className="team-rate">{Math.round(member.passed / member.total * 100)}%</span></button>) : <div className="empty-widget compact"><span>ยังไม่มีข้อมูลผู้รับผิดชอบ</span></div>}</div></div>
            <div className="panel integrity-panel"><div className="panel-header"><div><span className="section-overline">PULL REQUEST HEALTH</span><h2>ความครบถ้วนของ PR</h2><p>คำนวณจาก PR ที่ผูกกับใบงานในขอบเขต</p></div><div className="integrity-icon"><GitMerge size={21} /></div></div><div className="pr-stat"><div><strong>{numberDisplay(metrics.completedPR)}</strong><span>Completed PR</span></div><div><strong>{numberDisplay(Math.max(0, metrics.prTotal - metrics.completedPR))}</strong><span>PR ที่ยังไม่ Completed</span></div></div><div className="pr-progress"><span style={{width:`${metrics.prTotal ? 100 * metrics.completedPR / metrics.prTotal : 0}%`}} /></div><div className="pr-progress-footer"><span>Completion across linked PRs</span><strong>{metrics.prTotal ? Math.round(100 * metrics.completedPR / metrics.prTotal) : 0}%</strong></div><div className="integrity-note"><CircleHelp size={16} /><p>สถานะ <strong>Coding Complete</strong> ไม่ได้หมายความว่า PR ถูก Merge แล้ว ระบบตรวจสถานะ PR จริงแยกจากสถานะใบงาน</p></div></div>
          </section>

          <section id="work-items" className="work-section"><div className="work-title"><div><span className="section-overline">WORK ITEM EXPLORER</span><h2>รายการใบงาน <span className="heading-counter">{numberDisplay(filtered.length)}</span></h2><p>ค้นหา กรองสถานะ และเปิดดู PR ที่เชื่อมโยงกับแต่ละงาน</p></div><button className="button button-quiet button-sm" onClick={exportCSV} disabled={!hasLoaded || filtered.length === 0}><Download size={16} /> ส่งออกตามตัวกรอง</button></div>
            <div className="table-panel"><div className="table-toolbar"><div className="tab-list" role="group" aria-label="กรองตามสถานะ">{(["ALL", "PASSED", "ACTIVE", "ABANDONED", "NO_PR", "ERROR"] as ViewFilter[]).map((cat) => <button key={cat} onClick={() => applyFilter(cat)} className={statusFilter === cat ? "tab-active" : ""}>{cat === "ALL" ? "ทั้งหมด" : cat === "PASSED" ? "ผ่าน" : cat === "ACTIVE" ? "รอ Merge" : cat === "ABANDONED" ? "ยกเลิก" : cat === "NO_PR" ? "ไม่มี PR" : "ผิดพลาด"}</button>)}</div><div className="table-tools"><label className="search-box"><Search size={16} /><input type="search" value={search} onChange={(e) => {setSearch(e.target.value);setPage(1);}} placeholder="ค้นหา ID, งาน, ผู้รับผิดชอบ, PR..." aria-label="ค้นหาใบงาน" />{search && <button aria-label="ล้างคำค้นหา" onClick={() => setSearch("")}><X size={14}/></button>}</label><div className="sort-select"><Filter size={15} /><select aria-label="เรียงลำดับ" value={sort} onChange={(e) => {setSort(e.target.value as Sort);setPage(1);}}><option value="NEWEST">ID ใหม่สุด</option><option value="OLDEST">ID เก่าสุด</option><option value="PRIORITY">ความเร่งด่วน</option></select><ChevronDown size={14} /></div></div></div>
              {statusFilter === "ATTENTION" && <div className="filter-banner"><ShieldAlert size={16} /> กำลังแสดงรายการที่ยังไม่ผ่านเกณฑ์ <button onClick={() => applyFilter("ALL")}>ล้างตัวกรอง <X size={13}/></button></div>}
              <div className="mobile-work-list">{shown.map((item) => <MobileWorkCard key={item.id} item={item} expanded={expandedId === item.id} onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)} />)}{!shown.length && <div className="table-placeholder"><Search size={24} /><strong>{loading && !hasLoaded ? "กำลังโหลดข้อมูล" : "ไม่พบรายการตามเงื่อนไข"}</strong><p>ปรับตัวกรองหรือรีเฟรชข้อมูลอีกครั้ง</p></div>}</div>
              <div className="table-scroll"><table className="data-table"><thead><tr><th>ใบงาน / รายละเอียด</th><th>ผู้รับผิดชอบ</th><th>สถานะตรวจสอบ</th><th>Pull Request</th><th>Release</th><th aria-label="รายละเอียด"></th></tr></thead><tbody>{loading && !hasLoaded ? <tr><td colSpan={6}><div className="table-placeholder"><LoaderCircle size={26} className="spin" /><strong>กำลังตรวจสอบรายการงาน</strong><p>ดึง Work Items และตรวจสถานะ PR จาก Azure DevOps</p></div></td></tr> : !filtered.length ? <tr><td colSpan={6}><div className="table-placeholder"><Search size={26} /><strong>{error && !hasLoaded ? "ไม่สามารถโหลดข้อมูล" : "ไม่พบรายการตามเงื่อนไข"}</strong><p>{error && !hasLoaded ? "ตรวจสอบการเชื่อมต่อแล้วลองอีกครั้ง" : "ลองเปลี่ยนผู้รับผิดชอบ สถานะ หรือคำค้นหา"}</p></div></td></tr> : shown.map((item) => <FragmentRow key={item.id} item={item} expanded={expandedId === item.id} onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)} />)}</tbody></table></div>
              <div className="table-footer"><span>{filtered.length ? `แสดง ${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, filtered.length)} จาก ${filtered.length} รายการ` : "0 รายการ"}</span><div className="pagination"><button aria-label="หน้าก่อนหน้า" disabled={currentPage === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}><ChevronLeft size={17}/></button><span>หน้า {currentPage} / {totalPages}</span><button aria-label="หน้าถัดไป" disabled={currentPage === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}><ChevronRight size={17}/></button></div></div>
            </div>
          </section>
          <footer className="page-footer"><span><span className="footer-mark">scope.</span> / Engineering quality workspace</span><span>ข้อมูลจาก Azure DevOps · Read-only · ซิงก์ล่าสุด {compactDate(updatedAt)}</span></footer>
        </main>
      </div>
    </div>
  );
}
function FragmentRow({ item, expanded, onToggle }: { item: AuditWorkItem; expanded: boolean; onToggle: () => void }) {
  return <>
    <tr className={`data-row ${expanded ? "row-expanded" : ""}`}><td><div className="work-id-line"><LinkOrText href={item.workItemUrl} className="work-id">#{item.id} <ExternalLink size={12}/></LinkOrText><span className={`work-type ${item.type === "Bug" ? "type-bug" : ""}`}>{item.type}</span></div><div className="work-name" title={item.title}>{item.title}</div></td><td><div className="assignee"><span className="assignee-avatar">{initials(item.assignedTo)}</span><span>{item.assignedTo}</span></div></td><td><StatusBadge status={item.categoryCode} /></td><td><div className="pr-cell"><GitPullRequest size={15}/><strong>{item.completedPrCount}/{item.prCount}</strong><span>Completed</span></div></td><td><span className="release-label">{item.releaseVersion || "—"}</span></td><td><button className={`expand-button ${expanded ? "expanded" : ""}`} onClick={onToggle} aria-label={expanded ? `ซ่อนรายละเอียดงาน ${item.id}` : `ดูรายละเอียดงาน ${item.id}`} aria-expanded={expanded}><ChevronDown size={18} /></button></td></tr>
    {expanded && <tr className="expanded-detail"><td colSpan={6}><div className="detail-content"><div className="detail-top"><div><small>WORK ITEM #{item.id}</small><strong>{item.title}</strong><span>สถานะใบงาน: {item.state}</span></div><LinkOrText href={item.workItemUrl} className="detail-external">เปิดใน Azure DevOps <ArrowUpRight size={16}/></LinkOrText></div><div className="detail-columns"><div><h4>Pull requests ({item.prs.length})</h4>{item.prs.length ? <div className="pr-list">{item.prs.map((pr, index) => <LinkOrText key={`${pr.prId}-${index}`} href={pr.url} className="pr-link"><GitPullRequest size={16}/><span>PR #{pr.prId} <small>{pr.repoName}</small></span><span className={`pr-state pr-${pr.status}`}>{pr.status}</span><ArrowUpRight size={14}/></LinkOrText>)}</div> : <p className="detail-muted">ไม่พบ Pull Request ที่ผูกกับรายการนี้</p>}</div><div><h4>ลิงก์งานที่เกี่ยวข้อง</h4>{item.otherLinks.length ? <div className="detail-tags">{item.otherLinks.map((link, i) => <span key={`${link}-${i}`}><Cloud size={14}/>{link}</span>)}</div> : <p className="detail-muted">ไม่พบ Artifact Link ประเภทอื่น</p>}<p className="detail-note">ผลการตรวจ: {statusInfo[item.categoryCode].desc}</p></div></div></div></td></tr>}
  </>;
}

function MobileWorkCard({ item, expanded, onToggle }: { item: AuditWorkItem; expanded: boolean; onToggle: () => void }) {
  return <article className="mobile-work-card">
    <div className="mobile-work-top"><span className="work-id-line"><LinkOrText href={item.workItemUrl} className="work-id">#{item.id} <ExternalLink size={12}/></LinkOrText><span className={`work-type ${item.type === "Bug" ? "type-bug" : ""}`}>{item.type}</span></span><StatusBadge status={item.categoryCode} /></div>
    <strong className="mobile-work-name">{item.title}</strong>
    <div className="mobile-work-meta"><span><span className="assignee-avatar">{initials(item.assignedTo)}</span>{item.assignedTo}</span><span><GitPullRequest size={14}/>{item.completedPrCount}/{item.prCount} PR</span><span>{item.releaseVersion || "—"}</span></div>
    <button className="mobile-expand" onClick={onToggle} aria-expanded={expanded}><span>{expanded ? "ซ่อนรายละเอียด" : "ดู PR และลิงก์ที่เกี่ยวข้อง"}</span><ChevronDown size={16} style={{transform:expanded?"rotate(180deg)":"none"}} /></button>
    {expanded && <div className="mobile-card-detail"><strong>Pull Requests</strong>{item.prs.length ? item.prs.map((pr) => <LinkOrText key={pr.prId} href={pr.url} className="mobile-pr"><GitPullRequest size={15} /> PR #{pr.prId} <span>{pr.repoName} · {pr.status}</span><ArrowUpRight size={14}/></LinkOrText>) : <p>ไม่พบ Pull Request</p>}<strong>Artifact Links</strong><p>{item.otherLinks.join(", ") || "ไม่พบลิงก์ประเภทอื่น"}</p></div>}
  </article>;
}
