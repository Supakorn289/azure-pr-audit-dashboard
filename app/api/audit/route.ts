import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface PRInfo {
  prId: string;
  repoId: string;
  projectId: string;
  repoName: string;
  status: string;
  title?: string;
  url: string;
}

export async function GET(request: Request) {
  try {
    // This dashboard audits a fixed, trusted WIQL state; avoid injecting query parameters into WIQL.
    const stateFilter = "Coding Complete";

    const org = process.env.AZURE_DEVOPS_ORG || "infogrammer";
    const project = process.env.AZURE_DEVOPS_PROJECT || "FBPro_Trunk";
    const pat = process.env.AZURE_DEVOPS_PAT;

    if (!pat) {
      return NextResponse.json(
        { error: "ยังไม่ได้ตั้งค่า AZURE_DEVOPS_PAT ใน Environment Variables" },
        { status: 500 }
      );
    }

    const base64Auth = Buffer.from(`:${pat}`).toString("base64");
    const headers = {
      Authorization: `Basic ${base64Auth}`,
      "Content-Type": "application/json",
    };

    // 1. ดึงรายการ WorkItem IDs ด้วย WIQL
    const wiqlUrl = `https://dev.azure.com/${org}/${project}/_apis/wit/wiql?api-version=7.0`;
    const wiqlQuery = {
      query: `SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = '${project}' AND [System.State] = '${stateFilter}' AND [System.ExternalLinkCount] > 0 ORDER BY [System.Id] DESC`,
    };

    const wiqlRes = await fetch(wiqlUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(wiqlQuery),
      cache: "no-store",
    });

    if (!wiqlRes.ok) {
      return NextResponse.json(
        { error: `Azure DevOps WIQL request failed (HTTP ${wiqlRes.status})` },
        { status: wiqlRes.status }
      );
    }

    const wiqlData = await wiqlRes.json();
    const workItemIds: number[] = (wiqlData.workItems || []).map((w: any) => w.id);

    if (workItemIds.length === 0) {
      return NextResponse.json({
        updatedAt: new Date().toISOString(),
        totalProjectItems: 0,
        items: [],
      });
    }

    // 2. ดึงรายละเอียด Work Items ทีละ 200 รายการ
    const allWorkItems: any[] = [];
    for (let i = 0; i < workItemIds.length; i += 200) {
      const batchIds = workItemIds.slice(i, i + 200).join(",");
      const witUrl = `https://dev.azure.com/${org}/${project}/_apis/wit/workitems?ids=${batchIds}&$expand=relations&api-version=7.0`;
      const witRes = await fetch(witUrl, { headers, cache: "no-store" });
      if (!witRes.ok) {
        return NextResponse.json(
          { error: `Work Item batch could not be loaded (HTTP ${witRes.status}); results would be incomplete` },
          { status: 502 }
        );
      }
      const witData = await witRes.json();
      allWorkItems.push(...(witData.value || []));
    }

    // 3. รวบรวม PR ที่ไม่ซ้ำกันทั้งหมดเพื่อดึงข้อมูลแบบขนาน (Parallel Fetch + Cache)
    const uniquePrMap = new Map<string, { prProjId: string; repoId: string; prId: string }>();

    for (const wi of allWorkItems) {
      const relations = wi.relations || [];
      for (const rel of relations) {
        if (
          rel.rel === "ArtifactLink" &&
          (rel.attributes?.name === "Pull Request" || rel.url?.includes("PullRequestId"))
        ) {
          const decodedUrl = decodeURIComponent(rel.url);
          const parts = decodedUrl.split("/");
          const prId = parts[parts.length - 1];
          const repoId = parts[parts.length - 2];
          const prProjId = parts[parts.length - 3];
          const key = `${prProjId}/${repoId}/${prId}`;
          if (!uniquePrMap.has(key)) {
            uniquePrMap.set(key, { prProjId, repoId, prId });
          }
        }
      }
    }

    // ดึงสถานะ PR แบบ Parallel
    const prDetailsCache = new Map<string, PRInfo>();
    const prEntries = Array.from(uniquePrMap.entries());

    // แบ่ง Batch ละ 15 requests เพื่อความเสถียรและรวดเร็ว
    for (let i = 0; i < prEntries.length; i += 15) {
      const chunk = prEntries.slice(i, i + 15);
      await Promise.all(
        chunk.map(async ([key, { prProjId, repoId, prId }]) => {
          try {
            let prRes = await fetch(
              `https://dev.azure.com/${org}/${prProjId}/_apis/git/repositories/${repoId}/pullrequests/${prId}?api-version=7.0`,
              { headers, cache: "no-store" }
            );
            if (!prRes.ok) {
              prRes = await fetch(
                `https://dev.azure.com/${org}/_apis/git/pullrequests/${prId}?api-version=7.0`,
                { headers, cache: "no-store" }
              );
            }
            if (prRes.ok) {
              const prData = await prRes.json();
              const repoName = prData.repository?.name || "UnknownRepo";
              const projName = prData.repository?.project?.name || project;
              prDetailsCache.set(key, {
                prId,
                repoId,
                projectId: prProjId,
                repoName,
                status: (prData.status || "unknown").toLowerCase(),
                title: prData.title || "",
                url: `https://dev.azure.com/${org}/${encodeURIComponent(projName)}/_git/${encodeURIComponent(repoName)}/pullrequest/${prId}`,
              });
            } else {
              prDetailsCache.set(key, {
                prId,
                repoId,
                projectId: prProjId,
                repoName: "Error",
                status: "error",
                url: `https://dev.azure.com/${org}/${project}/_git/${repoId}/pullrequest/${prId}`,
              });
            }
          } catch {
            prDetailsCache.set(key, {
              prId,
              repoId,
              projectId: prProjId,
              repoName: "Error",
              status: "error",
              url: "#",
            });
          }
        })
      );
    }

    // 4. Include ALL assignees. Keep original Coding Complete + ExternalLinkCount > 0 criteria.
    // Work Item passes only if every linked PR is completed. Mixed PR states remain visible.
    const items = allWorkItems.map((wi) => {
      const assignedTo = wi.fields?.["System.AssignedTo"]?.displayName || "Unassigned";
      const relations = wi.relations || [];
      const artifactLinks = relations.filter((r: any) => r.rel === "ArtifactLink");
      const prLinks = artifactLinks.filter(
        (r: any) =>
          r.attributes?.name === "Pull Request" || r.url?.includes("PullRequestId")
      );
      const otherDevLinks = artifactLinks.filter(
        (r: any) =>
          r.attributes?.name !== "Pull Request" && !r.url?.includes("PullRequestId")
      );

      const otherLinkTypes = otherDevLinks.map(
        (r: any) => r.attributes?.name || "Link"
      );

      // Deduplicate PR links on a single Work Item before calculating pass/fail.
      const prsByKey = new Map<string, PRInfo>();
      for (const prLink of prLinks) {
        const decodedUrl = decodeURIComponent(prLink.url);
        const parts = decodedUrl.split("/");
        const prId = parts[parts.length - 1];
        const repoId = parts[parts.length - 2];
        const prProjId = parts[parts.length - 3];
        const key = `${prProjId}/${repoId}/${prId}`;
        if (!prsByKey.has(key)) {
          prsByKey.set(key, prDetailsCache.get(key) || {
            prId,
            repoId,
            projectId: prProjId,
            repoName: "Unknown",
            status: "unknown",
            url: "#",
          });
        }
      }
      const prs = Array.from(prsByKey.values());

      let categoryCode: "PASSED" | "ACTIVE" | "ABANDONED" | "NO_PR" | "ERROR" = "NO_PR";
      let categoryLabel = "4. ไม่มี PR (มีเฉพาะ Commit/Branch)";
      let isPassed = false;

      if (prs.length === 0) {
        categoryCode = "NO_PR";
        categoryLabel = "4. ไม่มี PR (มีเฉพาะ Commit/Branch)";
      } else if (prs.some((p) => !["completed", "active", "abandoned"].includes(p.status))) {
        categoryCode = "ERROR";
        categoryLabel = "5. ดึงข้อมูล PR ไม่สำเร็จ";
      } else if (prs.every((p) => p.status === "completed")) {
        categoryCode = "PASSED";
        categoryLabel = "1. ผ่านเงื่อนไข (PR Completed ทั้งหมด)";
        isPassed = true;
      } else if (prs.some((p) => p.status === "active")) {
        categoryCode = "ACTIVE";
        categoryLabel = "2. ไม่ผ่าน (มี PR สถานะ Active ค้างอยู่)";
      } else if (prs.some((p) => p.status === "abandoned")) {
        categoryCode = "ABANDONED";
        categoryLabel = "3. ไม่ผ่าน (มี PR สถานะ Abandoned/ยกเลิก)";
      }

      const completedPrCount = prs.filter((p) => p.status === "completed").length;

      return {
        id: wi.id,
        type: wi.fields?.["System.WorkItemType"] || "",
        title: wi.fields?.["System.Title"] || "",
        state: wi.fields?.["System.State"] || "",
        assignedTo,
        releaseVersion: wi.fields?.["Custom.ReleaseVersion"] || wi.fields?.["Microsoft.VSTS.Common.ReleaseVersion"] || "-",
        workItemUrl: `https://dev.azure.com/${org}/${project}/_workitems/edit/${wi.id}`,
        categoryCode,
        categoryLabel,
        isPassed,
        prCount: prs.length,
        completedPrCount,
        prs,
        otherLinks: otherLinkTypes,
      };
    });

    return NextResponse.json({
      updatedAt: new Date().toISOString(),
      org,
      project,
      totalProjectItems: items.length,
      items,
    });
  } catch (error) {
    console.error("Azure DevOps audit failed", error);
    return NextResponse.json(
      { error: "Azure DevOps audit failed unexpectedly. Check the server logs." },
      { status: 500 }
    );
  }
}
