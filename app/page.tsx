"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle, ArrowDownToLine, ArrowUpRight, Check, ChevronDown,
  ChevronLeft, ChevronRight, ExternalLink, GitPullRequest, LoaderCircle,
  RefreshCw, Search, X,
} from "lucide-react";
import {
  type AuditWorkItem, type PRInfo, type StatusView,
  isCompleted, matchesView, normalizeStatus, priority, summarize,
} from "./audit-model";

const PAGE_SIZE = 10;
const priorityStatuses = ["completed", "active", "abandoned", "error", "unknown"];
const workBuckets = [
  { status: "PASSED", label: "PR ครบแล้ว", tone: "completed", view: "PASSED" },
  { status: "ACTIVE", label: "มี PR Active", tone: "active", view: "WORK:ACTIVE" },
  { status: "ABANDONED", label: "มี PR Abandoned", tone: "abandoned", view: "WORK:ABANDONED" },
  { status: "NO_PR", label: "ไม่มี PR", tone: "missing", view: "NO_PR" },
  { status: "ERROR", label: "ตรวจสอบไม่ได้", tone: "unknown", view: "WORK:ERROR" },
] as const;

function labelStatus(status: string) {
  const labels: Record<string, string> = {
    completed: "Completed", active: "Active", abandoned: "Abandoned",
    error: "ตรวจสอบไม่ได้", unknown: "ไม่ทราบสถานะ", notset: "Not set",
  };
  return labels[status] || status;
}
function statusTone(status: string) {
  return ["completed", "active", "abandoned"].includes(status) ? status : "unknown";
}
const number = (value: number) => value.toLocaleString("th-TH");
function shortTime(value: string) {
  if (!value || Number.isNaN(Date.parse(value))) return "—";
  return new Date(value).toLocaleString("th-TH", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}
function csvSafe(value: unknown) {
  let str = String(value ?? "");
  if (/^\s*[=+@\-\t\r]/.test(str)) str = "'" + str;
  return `"${str.replace(/"/g, '""')}"`;
}
function initials(text: string) {
  const bits = text.trim().split(/\s+/).filter(Boolean);
  return (bits.length >= 2 ? bits.slice(0, 2).map((part) => part[0]).join("") : (bits[0] || "?").slice(0, 2)).toUpperCase();
}
function WorkLink({ href, children, className = "" }: { href: string; children: React.ReactNode; className?: string }) {
  if (!/^https:\/\//i.test(href || "")) return <span className={className}>{children}</span>;
  return <a className={className} href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
}

// Deliberate synthetic sample for ?demo=1 only. Never used as a fallback for failed requests.
const samplePeople = ["Biw Piyanut", "Watcharanon", "Nattaya K.", "Anan T.", "Kittisak P.", "Kamon S."];
const samplePRs = [
  ["completed"], ["active"], ["completed"], ["completed", "active"], ["abandoned"],
  ["completed"], [], ["completed"], ["active"], ["completed", "abandoned"],
  ["error"], ["completed"], ["active"], ["completed"], ["completed"],
  ["completed"], [], ["active"], ["completed"], ["completed"],
];
const sampleTitles = [
  "ปรับเงื่อนไขตรวจสอบข้อมูลลูกค้า", "แก้ไขรายการธุรกรรมในหน้ารายงาน",
  "เพิ่ม validation ในหน้าสร้างคำขอ", "ปรับ API ค้นหาข้อมูลลูกค้า",
  "แก้ไขสิทธิ์เข้าถึงเมนูจัดการ", "ปรับรายงานประจำวัน",
  "ตรวจสอบการเชื่อมต่อ Repository", "เพิ่ม Unit Test ของ Business Rules",
  "แก้ไขการแจ้งเตือนสถานะคำขอ", "ปรับขั้นตอนการอนุมัติ",
  "ตรวจสอบ Deployment Metadata", "ปรับการแสดงผลหน้าโปรไฟล์",
  "เพิ่มตัวกรองหน้าค้นหา", "ลดเวลาตอบกลับ API รายการงาน",
  "ปรับระบบ Cache", "แก้ไขการเชื่อมต่อหมดเวลา",
  "แก้ไขงานแจ้งเตือนแบบ Batch", "ปรับระบบกำหนดสิทธิ์",
  "ปรับการเรียงข้อมูล", "เพิ่ม Test Case สำหรับ API",
];
const sampleItems: AuditWorkItem[] = samplePRs.map((states, index) => {
  const prs: PRInfo[] = states.map((status, sub) => ({
    prId: String(9321 + index * 7 + sub), repoId: "demo-repo", projectId: "demo",
    repoName: index % 2 ? "fbpro-web" : "fbpro-api", status, title: sampleTitles[index], url: "#",
  }));
  const completed = states.length > 0 && states.every((status) => status === "completed");
  const categoryCode = completed ? "PASSED" : !states.length ? "NO_PR" : states.includes("error") ? "ERROR" : states.includes("abandoned") ? "ABANDONED" : "ACTIVE";
  return {
    id: 30426 - index * 13, type: index % 4 === 0 ? "Bug" : "User Story",
    title: sampleTitles[index], state: "Coding Complete",
    assignedTo: samplePeople[index % samplePeople.length], workItemUrl: "#",
    categoryCode, categoryLabel: categoryCode, isPassed: completed,
    prCount: prs.length, completedPrCount: prs.filter((pr) => pr.status === "completed").length,
    prs, otherLinks: states.length === 0 ? ["Commit", "Branch"] : [],
    releaseVersion: index % 3 ? "R26.11" : "R26.10",
  };
});

function PRBadges({ prs }: { prs: PRInfo[] }) {
  if (!prs.length) return <span className="state-tag missing"><i />ไม่มี PR</span>;
  const counts = new Map<string, number>();
  prs.forEach((pr) => {
    const status = normalizeStatus(pr.status);
    counts.set(status, (counts.get(status) ?? 0) + 1);
  });
  return <div className="pr-badges">{Array.from(counts).map(([status, count]) =>
    <span key={status} className={`state-tag ${statusTone(status)}`}>
      <i />{labelStatus(status)}{count > 1 ? ` · ${count}` : ""}
    </span>
  )}</div>;
}

function RowDetails({ item }: { item: AuditWorkItem }) {
  return <div className="row-detail">
    <div className="row-detail-top"><span>Pull requests ({item.prs.length})</span>
      <WorkLink className="text-link" href={item.workItemUrl}>เปิดใบงาน <ExternalLink size={14}/></WorkLink>
    </div>
    {item.prs.length ? <div className="linked-prs">{item.prs.map((pr, idx) =>
      <WorkLink className="linked-pr" href={pr.url} key={`${pr.projectId}/${pr.repoId}/${pr.prId}/${idx}`}>
        <span className="linked-pr-code"><GitPullRequest size={16}/> #{pr.prId}</span>
        <span className="linked-pr-title">{pr.title || pr.repoName}<small>{pr.repoName}</small></span>
        <span className={`state-tag ${statusTone(normalizeStatus(pr.status))}`}><i/>{labelStatus(normalizeStatus(pr.status))}</span>
        <ArrowUpRight size={15} className="pr-out"/>
      </WorkLink>
    )}</div> : <p className="detail-empty">ไม่พบ PR ในลิงก์ของงานนี้{item.otherLinks.length ? ` (มี ${item.otherLinks.join(", ")})` : ""}</p>}
    <div className="detail-footer"><span>สถานะใบงาน: {item.state}</span>{item.releaseVersion && item.releaseVersion !== "-" && <span>Release: {item.releaseVersion}</span>}</div>
  </div>;
}

export default function Dashboard() {
  const [items, setItems] = useState<AuditWorkItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState("");
  const [project, setProject] = useState("FBPro_Trunk");
  const [demo, setDemo] = useState(false);
  const [view, setView] = useState<StatusView>("ATTENTION");
  const [owner, setOwner] = useState("ALL");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/audit", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `Azure DevOps HTTP ${response.status}`);
      if (!Array.isArray(data.items)) throw new Error("ข้อมูลรายการงานจาก Azure DevOps ไม่ถูกต้อง");
      setItems(data.items);
      if (typeof data.project === "string" && data.project) setProject(data.project);
      setUpdatedAt(data.updatedAt || new Date().toISOString());
      setLoaded(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ไม่สามารถโหลดข้อมูลได้");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("demo") === "1") {
      setDemo(true);
      setItems(sampleItems);
      setUpdatedAt(new Date().toISOString());
      setLoaded(true);
      setLoading(false);
    } else {
      void fetchData();
    }
  }, [fetchData]);

  const totals = useMemo(() => summarize(items), [items]);
  const owners = useMemo(() => [...new Set(items.map((item) => item.assignedTo || "Unassigned"))].sort((a, b) => a.localeCompare(b, "th")), [items]);
  const statusKeys = useMemo(() => [...new Set([...priorityStatuses, ...Object.keys(totals.statusCounts)])].sort((a, b) => {
    const ai = priorityStatuses.indexOf(a);
    const bi = priorityStatuses.indexOf(b);
    return (ai < 0 ? 100 : ai) - (bi < 0 ? 100 : bi) || a.localeCompare(b);
  }), [totals.statusCounts]);
  const filtered = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();
    return items.filter((item) => {
      if (owner !== "ALL" && (item.assignedTo || "Unassigned") !== owner) return false;
      if (!matchesView(item, view)) return false;
      if (!needle) return true;
      return [String(item.id), item.title, item.assignedTo, item.type, item.releaseVersion || "", ...item.prs.flatMap((pr) => [pr.prId, pr.title || "", pr.repoName, pr.status])]
        .some((text) => String(text).toLocaleLowerCase().includes(needle));
    }).sort((a, b) => priority(a) - priority(b) || b.id - a.id);
  }, [items, view, owner, search]);
  const maxPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const atPage = Math.min(page, maxPages);
  const currentItems = filtered.slice((atPage - 1) * PAGE_SIZE, atPage * PAGE_SIZE);
  const completionRate = totals.totalItems ? Math.round(totals.completedItems / totals.totalItems * 100) : 0;
  const display = (num: number) => loaded ? number(num) : "—";
  const changeView = (next: StatusView) => { setView(next); setPage(1); setExpanded(null); };
  const refresh = () => {
    if (demo) { setUpdatedAt(new Date().toISOString()); return; }
    void fetchData();
  };
  const download = () => {
    const columns = ["WorkItemId", "Title", "Assignee", "WorkItemState", "AllPRCompleted", "PRCount", "CompletedPRCount", "PRStatuses", "PRDetails", "Release", "WorkItemURL"];
    const lines = filtered.map((item) => [
      item.id, item.title, item.assignedTo, item.state, isCompleted(item), item.prs.length,
      item.prs.filter((pr) => normalizeStatus(pr.status) === "completed").length,
      item.prs.map((pr) => normalizeStatus(pr.status)).join(" | "),
      item.prs.map((pr) => `${pr.repoName}#${pr.prId} (${pr.status})`).join(" | "),
      item.releaseVersion || "", item.workItemUrl,
    ].map(csvSafe).join(","));
    const content = "\uFEFF" + [columns.map(csvSafe).join(","), ...lines].join("\r\n");
    const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `NFO_Coding_Complete_${demo ? "DEMO_" : ""}${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.append(link);
    link.click(); link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const focusTable = (next: StatusView) => {
    changeView(next);
    document.getElementById("work-list")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return <div className="site-shell">
    <header className="site-header">
      <div className="header-inner">
        <a className="logo-link" href="/" aria-label="Infogrammer — หน้าภาพรวม">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/nfo-logo.png" alt="NFO — Infogrammer Co., Ltd." width="110" height="82"/>
        </a>
        <div className="header-separator" aria-hidden="true"/>
        <div className="header-section"><span className="workspace-name">ทีมพัฒนาซอฟต์แวร์</span><span className="workspace-sub">ติดตาม Coding Complete</span></div>
        <div className="header-trail"><span className="project-text">{project}</span><span className={`connect-tag ${error ? "is-error" : demo ? "is-demo" : ""}`}><i/>{demo ? "ตัวอย่าง" : error ? "มีปัญหา" : loading ? "กำลังโหลด" : loaded ? "โหลดข้อมูลแล้ว" : "รอเชื่อมต่อ"}</span></div>
      </div>
    </header>

    <main className="page-container">
      <div className="page-intro">
        <div className="intro-copy"><span className="eyebrow">WORKFLOW / AZURE DEVOPS</span><h1>ภาพรวมการส่งงาน</h1><p>งาน Coding Complete ของทุกคนในโปรเจกต์</p></div>
        <div className="intro-controls"><span className="last-updated">ข้อมูลล่าสุด {shortTime(updatedAt)}</span><button className="refresh-button" type="button" onClick={refresh} disabled={loading} aria-label="โหลดข้อมูลล่าสุด" title="โหลดข้อมูลล่าสุด"><RefreshCw size={17} className={loading ? "spinning" : ""}/><span>อัปเดต</span></button></div>
      </div>

      {demo && <div className="notice demo-notice"><span><strong>โหมดตัวอย่าง</strong> — ข้อมูลจำลอง ไม่ใช่ข้อมูลบริษัท</span><a href="/">ดูข้อมูลจริง <ArrowUpRight size={14}/></a></div>}
      {error && <div className="notice error-notice" role="alert"><AlertCircle size={18}/><span><strong>โหลดข้อมูลไม่สำเร็จ</strong> · {error}{loaded ? " · ตัวเลขที่เห็นเป็นข้อมูลจากครั้งก่อน" : ""}</span><button type="button" onClick={refresh}>ลองอีกครั้ง</button></div>}

      <section className="scoreboard" aria-label="ภาพรวมสถานะ Coding Complete">
        <div className="lead-number">
          <div className="metric-title"><span className="orange-stroke"/> งานที่ PR ครบแล้ว</div>
          <div className="value-line"><strong>{display(totals.completedItems)}</strong><span>งาน</span></div>
          <div className="lead-context">จากทั้งหมด {display(totals.totalItems)} งาน <span className="context-dot">·</span> PR ทุกตัวต้องเป็น Completed</div>
          <div className="score-progress" role="progressbar" aria-label="สัดส่วนงานที่ PR Completed ครบ" aria-valuemin={0} aria-valuemax={100} aria-valuenow={loaded ? completionRate : 0}><span style={{ width: `${loaded ? completionRate : 0}%` }}/></div>
          <div className="progress-note"><span>สัดส่วนงานที่ PR ครบ</span><b>{loaded ? completionRate + "%" : "—"}</b></div>
        </div>
        <div className="support-numbers">
          <button type="button" className="support-metric" onClick={() => focusTable("ATTENTION")}><span>ยังไม่ครบ</span><strong>{display(totals.pendingItems)}</strong><small>งานที่ต้องติดตาม <ArrowUpRight size={13}/></small></button>
          <button type="button" className="support-metric" onClick={() => focusTable("ALL")}><span>งานทั้งหมด</span><strong>{display(totals.totalItems)}</strong><small>Coding Complete <ArrowUpRight size={13}/></small></button>
        </div>
      </section>

      <section className="status-section" aria-label="จำนวน Work Item แยกตามสถานะหลัก">
        <div className="section-hint"><h2>สถานะงาน</h2><span>หน่วย: งาน · รวม {display(totals.totalItems)}</span></div>
        <div className="status-row">
          {workBuckets.map(({ status, label, tone, view: nextView }) => (
            <button key={status} type="button" className={`status-filter ${view === nextView ? "active-filter" : ""}`}
              aria-pressed={view === nextView} onClick={() => focusTable(nextView)}
              title="งานหนึ่งรายการจะอยู่ในสถานะหลักเพียงกลุ่มเดียว">
              <span className={`small-dot ${tone}`}/><span>{label}</span><b>{display(totals.workCounts[status])}</b>
            </button>
          ))}
        </div>
      </section>

      <section className="pr-overview" aria-label="สรุป Pull Request ที่เชื่อมกับใบงาน">
        <div className="pr-overview-heading"><span>Pull Requests</span><strong>{display(totals.totalPRs)} <small>PR ไม่ซ้ำ</small></strong></div>
        <div className="pr-overview-list">
          {statusKeys.filter((key) => (totals.statusCounts[key] ?? 0) > 0 || ["completed", "active", "abandoned"].includes(key)).map((status) => (
            <span className="pr-overview-item" key={status}><i className={`small-dot ${statusTone(status)}`}/>{labelStatus(status)} <b>{display(totals.statusCounts[status] ?? 0)}</b></span>
          ))}
        </div>
      </section>

      <section className="work-area" id="work-list" aria-label="รายการงาน Coding Complete">
        <div className="area-heading"><div><span className="eyebrow">WORK ITEMS</span><h2>รายการงาน <span className="heading-total">{display(filtered.length)} จาก {display(totals.totalItems)} งาน</span></h2></div><button type="button" className="export-button" onClick={download} disabled={!loaded || !filtered.length}><ArrowDownToLine size={16}/> ส่งออก CSV</button></div>
        <div className="work-table">
          <div className="control-bar">
            <div className="switcher" role="group" aria-label="เลือกกลุ่มรายการงาน">
              <button type="button" aria-pressed={view === "ATTENTION"} className={view === "ATTENTION" ? "selected" : ""} onClick={() => changeView("ATTENTION")}>รอติดตาม <span>{display(totals.pendingItems)}</span></button>
              <button type="button" aria-pressed={view === "PASSED"} className={view === "PASSED" ? "selected" : ""} onClick={() => changeView("PASSED")}>PR ครบแล้ว <span>{display(totals.completedItems)}</span></button>
              <button type="button" aria-pressed={view === "ALL"} className={view === "ALL" ? "selected" : ""} onClick={() => changeView("ALL")}>ทั้งหมด <span>{display(totals.totalItems)}</span></button>
            </div>
            <div className="search-controls">
              <label className="search-input"><Search size={17}/><input type="search" placeholder="ค้นหาชื่องานหรือ ID" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} aria-label="ค้นหางาน"/>{search && <button onClick={() => { setSearch(""); setPage(1); }} type="button" aria-label="ล้างคำค้นหา"><X size={15}/></button>}</label>
              <label className="owner-select"><span className="sr-only">กรองผู้รับผิดชอบ</span><select value={owner} onChange={(event) => { setOwner(event.target.value); setPage(1); }}><option value="ALL">ผู้รับผิดชอบ: ทุกคน</option>{owners.map((name) => <option key={name} value={name}>{name}</option>)}</select><ChevronDown size={16}/></label>
            </div>
          </div>
          {view.startsWith("PR:") || view.startsWith("WORK:") || view === "NO_PR" ? <div className="active-filter-note"><span>สถานะงาน: {view === "NO_PR" ? "ไม่มี PR" : view.startsWith("WORK:") ? workBuckets.find((b) => b.status === view.slice(5))?.label || "อื่น ๆ" : `มี PR ${labelStatus(view.slice(3))}`}</span><button type="button" onClick={() => changeView("ATTENTION")}>กลับไปงานค้าง <X size={14}/></button></div> : null}
          <div className="table-head" aria-hidden="true"><span>ใบงาน</span><span>ผู้รับผิดชอบ</span><span>สถานะ PR</span><span>Completed</span><span/></div>
          <div className="table-body" aria-live="polite">
            {loading && !loaded ? <div className="empty-table"><LoaderCircle className="spinning" size={26}/><strong>กำลังดึงงานจาก Azure DevOps</strong></div>
            : currentItems.length === 0 ? <div className="empty-table"><Check size={26}/><strong>{error && !loaded ? "ไม่สามารถแสดงรายการ" : view === "ATTENTION" && !search && owner === "ALL" ? "ไม่มีงานที่ต้องติดตาม" : "ไม่พบงาน"}</strong><p>{error && !loaded ? "ตรวจสอบการเชื่อมต่อและลองอีกครั้ง" : "ลองเปลี่ยนตัวกรองหรือคำค้นหา"}</p></div>
            : currentItems.map((item) => <article className="work-entry" key={item.id}>
              <div className="work-entry-main">
                <div className="work-item-title"><div className="work-id-line"><WorkLink href={item.workItemUrl} className="work-id">#{item.id} <ArrowUpRight size={12}/></WorkLink><span className="work-type">{item.type}</span></div><strong title={item.title}>{item.title}</strong></div>
                <div className="assignee-cell"><span className="avatar">{initials(item.assignedTo || "Unassigned")}</span><span>{item.assignedTo || "Unassigned"}</span></div>
                <PRBadges prs={item.prs}/>
                <span className="pr-fraction" aria-label={`Completed ${item.prs.filter((pr) => normalizeStatus(pr.status) === "completed").length} จาก ${item.prs.length} PR`}><b>{item.prs.filter((pr) => normalizeStatus(pr.status) === "completed").length}</b> / {item.prs.length}</span>
                <button type="button" className={`row-toggle ${expanded === item.id ? "opened" : ""}`} onClick={() => setExpanded(expanded === item.id ? null : item.id)} aria-expanded={expanded === item.id} aria-label={`${expanded === item.id ? "ปิด" : "เปิด"}รายละเอียดใบงาน ${item.id}`}><ChevronDown size={19}/></button>
              </div>
              {expanded === item.id && <RowDetails item={item}/>}
            </article>)}
          </div>
          <div className="table-footer"><span>{filtered.length ? `${number((atPage - 1) * PAGE_SIZE + 1)}–${number(Math.min(atPage * PAGE_SIZE, filtered.length))} จาก ${number(filtered.length)} งาน` : "0 งาน"}</span><div className="pagination"><button type="button" disabled={atPage === 1} onClick={() => setPage(atPage - 1)} aria-label="หน้าก่อน"><ChevronLeft size={18}/></button><span>{atPage} / {maxPages}</span><button type="button" disabled={atPage === maxPages} onClick={() => setPage(atPage + 1)} aria-label="หน้าถัดไป"><ChevronRight size={18}/></button></div></div>
        </div>
      </section>
      <footer className="site-footer"><span>Infogrammer Co., Ltd. · Internal use</span><span>Coding Complete · External Link &gt; 0 · อ่านข้อมูลอย่างเดียว</span></footer>
    </main>
  </div>;
}
