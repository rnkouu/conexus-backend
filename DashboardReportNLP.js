// js/DashboardReportNLP.js
// Conexus — Dashboard NLP Report Generator (Browser-safe, no external APIs)
// Exposes:
//   window.DashboardReportNLP.generateDashboardReport(payload)
//
// Added (non-breaking extras):
//   window.DashboardReportNLP.downloadWord(report, baseName?)
//   window.DashboardReportNLP.downloadHtml(report, baseName?)
//   window.DashboardReportNLP.downloadText(report, baseName?)
//   window.DashboardReportNLP.downloadAll(report, baseName?)
//
// Usage (from AdminDashboard.js):
// const report = window.DashboardReportNLP.generateDashboardReport({ eventStats, events, registrations, meta });
// download report.html + report.txt (+ optional report.doc)
//
// Notes:
// - Attendance metrics are computed if attendance info exists in registrations/eventStats.
// - Morning/Afternoon is inferred from scan timestamps (hour < 12 = morning, else afternoon) unless a "session"/"period" field exists.

(function () {
  function safeNum(n, fallback = 0) {
    const x = Number(n);
    return Number.isFinite(x) ? x : fallback;
  }

  function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
  }

  function safeText(s) {
    return String(s ?? "").replace(/[<>]/g, (m) => (m === "<" ? "&lt;" : "&gt;"));
  }

  function safeSlug(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 60) || "report";
  }

  function formatDate(dateStr) {
    if (!dateStr) return "";
    try {
      const d = new Date(dateStr);
      if (Number.isNaN(d.getTime())) return String(dateStr);
      return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    } catch {
      return String(dateStr);
    }
  }

  function formatTime(dateStr) {
    if (!dateStr) return "";
    try {
      const d = new Date(dateStr);
      if (Number.isNaN(d.getTime())) return "";
      return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  }

  function formatRange(start, end) {
    const s = start ? formatDate(start) : "";
    const e = end ? formatDate(end) : "";
    if (s && e) return `${s} → ${e}`;
    return s || e || "";
  }

  // --- Lightweight NLP-ish keywords ----------------------------------------
  const STOP = new Set([
    "the","a","an","and","or","to","for","of","in","on","at","with","by","from",
    "event","conference","summit","workshop","webinar","symposium","meetup","training",
    "day","days","session","sessions","research","paper","papers"
  ]);

  function tokenize(text) {
    return String(text || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s\-]/g, " ")
      .split(/\s+/g)
      .map((t) => t.trim())
      .filter(Boolean);
  }

  function topKeywords(items, k = 8) {
    const freq = new Map();
    items.forEach((it) => {
      const words = tokenize(it);
      words.forEach((w) => {
        if (w.length < 3) return;
        if (STOP.has(w)) return;
        freq.set(w, (freq.get(w) || 0) + 1);
      });
    });

    return Array.from(freq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, k)
      .map(([w, c]) => ({ w, c }));
  }

  // --- Attendance extraction (robust to multiple shapes) --------------------
  function toDateMaybe(x) {
    if (!x) return null;
    if (x instanceof Date) {
      if (Number.isNaN(x.getTime())) return null;
      return x;
    }
    if (typeof x === "number") {
      const d = new Date(x);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    if (typeof x === "string") {
      const d = new Date(x);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    return null;
  }

  function extractSessionLabel(obj) {
    // Try explicit session/period markers
    const cand = [
      obj?.session,
      obj?.period,
      obj?.shift,
      obj?.time_of_day,
      obj?.timeOfDay,
      obj?.slot,
      obj?.checkinType,
      obj?.checkInType
    ].filter(Boolean)[0];

    const s = String(cand || "").toLowerCase().trim();
    if (!s) return "";

    if (s.includes("morning") || s === "am") return "morning";
    if (s.includes("afternoon") || s === "pm") return "afternoon";

    return "";
  }

  function collectScanItemsFromRegistration(reg) {
    // Returns array of "scan objects" or timestamps
    const out = [];

    // Common containers
    const candidates = [
      reg?.attendance,
      reg?.attendanceLogs,
      reg?.attendance_log,
      reg?.attendance_records,
      reg?.attendanceRecords,
      reg?.checkins,
      reg?.checkIns,
      reg?.scans,
      reg?.scanLogs,
      reg?.scan_logs,
      reg?.logs,
      reg?.nfcLogs,
      reg?.nfc_logs
    ];

    candidates.forEach((c) => {
      if (!c) return;
      if (Array.isArray(c)) out.push(...c);
      else if (typeof c === "object") {
        // if object contains an array field
        const arr = c?.records || c?.logs || c?.scans || c?.items || c?.data;
        if (Array.isArray(arr)) out.push(...arr);
      }
    });

    // Single timestamp fields
    const singleTs = [
      reg?.checkedInAt,
      reg?.checked_in_at,
      reg?.checkInAt,
      reg?.check_in_time,
      reg?.checkInTime,
      reg?.attendance_time,
      reg?.attendanceTime,
      reg?.scannedAt,
      reg?.scanned_at,
      reg?.timestamp,
      reg?.time
    ].filter(Boolean);

    singleTs.forEach((t) => out.push(t));

    return out;
  }

  function normalizeScan(scan) {
    // Output: { at: Date|null, session: "morning"|"afternoon"|"" }
    if (scan == null) return { at: null, session: "" };

    // If scan is a raw date-like value
    const direct = toDateMaybe(scan);
    if (direct) return { at: direct, session: "" };

    if (typeof scan === "object") {
      const session = extractSessionLabel(scan);

      const timeKeys = [
        "timestamp","time","datetime","dateTime","created_at","createdAt","scanned_at","scannedAt",
        "check_in_time","checkInTime","checked_in_at","checkedInAt","at"
      ];

      for (let i = 0; i < timeKeys.length; i++) {
        const v = scan[timeKeys[i]];
        const d = toDateMaybe(v);
        if (d) return { at: d, session };
      }

      // Sometimes nested
      const nested = scan?.meta || scan?.data || scan?.payload;
      if (nested && typeof nested === "object") {
        for (let i = 0; i < timeKeys.length; i++) {
          const v2 = nested[timeKeys[i]];
          const d2 = toDateMaybe(v2);
          if (d2) return { at: d2, session };
        }
      }

      // No timestamp, but session exists
      if (session) return { at: null, session };
    }

    return { at: null, session: "" };
  }

  function timeOfDayFromDate(d) {
    if (!d) return "";
    const h = d.getHours();
    return h < 12 ? "morning" : "afternoon";
  }

  function extractAttendanceSummary(reg) {
    // Returns:
    // { attended: boolean, scans: [{at, session, tod}], scanCount, morningScans, afternoonScans, unknownScans,
    //   morningAttended: boolean, afternoonAttended: boolean, firstScanAt: Date|null }
    const rawItems = collectScanItemsFromRegistration(reg);
    const scans = [];

    rawItems.forEach((it) => {
      const norm = normalizeScan(it);
      const tod = norm.session || timeOfDayFromDate(norm.at);
      scans.push({ at: norm.at, session: norm.session || "", tod });
    });

    // Fallback: boolean markers
    const attendedFlag = !!(reg?.attended || reg?.isAttended || reg?.hasAttendance || reg?.checkedIn || reg?.checked_in);

    const scanCount = scans.length;
    let morningScans = 0, afternoonScans = 0, unknownScans = 0;

    scans.forEach((s) => {
      if (s.tod === "morning") morningScans++;
      else if (s.tod === "afternoon") afternoonScans++;
      else unknownScans++;
    });

    const morningAttended = morningScans > 0 || scans.some((s) => s.session === "morning");
    const afternoonAttended = afternoonScans > 0 || scans.some((s) => s.session === "afternoon");

    // First scan time
    const dated = scans.map((s) => s.at).filter(Boolean);
    dated.sort((a, b) => a.getTime() - b.getTime());
    const firstScanAt = dated.length ? dated[0] : null;

    const attended = scanCount > 0 || attendedFlag;

    return {
      attended,
      scans,
      scanCount,
      morningScans,
      afternoonScans,
      unknownScans,
      morningAttended,
      afternoonAttended,
      firstScanAt,
    };
  }

  // --- SVG charts (no dependencies) -----------------------------------------
  function svgBarChart({ title, series, width = 980, height = 250, color = "#0b3b82" }) {
    // series: [{ label, value, sublabel }]
    const padL = 52, padR = 16, padT = 36, padB = 44;
    const w = width, h = height;
    const innerW = w - padL - padR;
    const innerH = h - padT - padB;

    const maxV = Math.max(1, ...series.map((s) => safeNum(s.value, 0)));
    const barGap = 10;
    const barW = series.length > 0 ? Math.max(10, (innerW - barGap * (series.length - 1)) / series.length) : innerW;

    const bars = series.map((s, i) => {
      const v = safeNum(s.value, 0);
      const bh = Math.round((v / maxV) * innerH);
      const x = padL + i * (barW + barGap);
      const y = padT + (innerH - bh);

      const lbl = safeText(s.label || "");
      const sub = safeText(s.sublabel || "");

      return `
        <g>
          <rect x="${x}" y="${y}" width="${barW}" height="${bh}" rx="10" ry="10" fill="${color}" opacity="0.88"></rect>
          <text x="${x + barW / 2}" y="${padT + innerH + 18}" text-anchor="middle" font-size="11" fill="#6b7280">${lbl}</text>
          ${sub ? `<text x="${x + barW / 2}" y="${padT + innerH + 33}" text-anchor="middle" font-size="10" fill="#9ca3af">${sub}</text>` : ""}
        </g>
      `;
    }).join("");

    const yTicks = 4;
    const ticks = Array.from({ length: yTicks + 1 }, (_, i) => i).map((i) => {
      const t = i / yTicks;
      const v = Math.round(maxV * (1 - t));
      const y = padT + innerH * t;
      return `
        <g>
          <line x1="${padL}" y1="${y}" x2="${w - padR}" y2="${y}" stroke="#eef2f7" />
          <text x="${padL - 10}" y="${y + 4}" text-anchor="end" font-size="11" fill="#9ca3af">${v}</text>
        </g>
      `;
    }).join("");

    return `
      <svg viewBox="0 0 ${w} ${h}" width="100%" height="auto" role="img" aria-label="${safeText(title)}">
        <rect x="0" y="0" width="${w}" height="${h}" rx="18" ry="18" fill="#ffffff" stroke="#eef2f7"></rect>
        <text x="${padL}" y="24" font-size="14" font-weight="800" fill="#0f172a">${safeText(title)}</text>
        ${ticks}
        ${bars}
      </svg>
    `;
  }

  function svgGroupedBarChart({
    title,
    categories,
    aValues,
    bValues,
    aLabel = "Registered",
    bLabel = "Attended",
    width = 980,
    height = 270,
    color = "#0b3b82"
  }) {
    const padL = 52, padR = 16, padT = 44, padB = 44;
    const w = width, h = height;
    const innerW = w - padL - padR;
    const innerH = h - padT - padB;

    const n = Math.max(0, (categories || []).length);
    const maxV = Math.max(1, ...[].concat(aValues || [], bValues || []).map((v) => safeNum(v, 0)));

    const groupGap = 12;
    const groupW = n > 0 ? (innerW - groupGap * (n - 1)) / n : innerW;
    const barGap = 6;
    const barW = Math.max(8, (groupW - barGap) / 2);

    const yTicks = 4;
    const ticks = Array.from({ length: yTicks + 1 }, (_, i) => i).map((i) => {
      const t = i / yTicks;
      const v = Math.round(maxV * (1 - t));
      const y = padT + innerH * t;
      return `
        <g>
          <line x1="${padL}" y1="${y}" x2="${w - padR}" y2="${y}" stroke="#eef2f7" />
          <text x="${padL - 10}" y="${y + 4}" text-anchor="end" font-size="11" fill="#9ca3af">${v}</text>
        </g>
      `;
    }).join("");

    const bars = Array.from({ length: n }, (_, i) => {
      const cat = safeText(categories[i] || "");
      const a = safeNum(aValues[i], 0);
      const b = safeNum(bValues[i], 0);

      const aH = Math.round((a / maxV) * innerH);
      const bH = Math.round((b / maxV) * innerH);

      const gx = padL + i * (groupW + groupGap);

      const aX = gx;
      const aY = padT + (innerH - aH);

      const bX = gx + barW + barGap;
      const bY = padT + (innerH - bH);

      // label truncation
      const lbl = (cat.length > 12 ? cat.slice(0, 12) + "…" : cat);

      return `
        <g>
          <rect x="${aX}" y="${aY}" width="${barW}" height="${aH}" rx="10" ry="10" fill="${color}" opacity="0.28"></rect>
          <rect x="${bX}" y="${bY}" width="${barW}" height="${bH}" rx="10" ry="10" fill="${color}" opacity="0.88"></rect>
          <text x="${gx + groupW / 2}" y="${padT + innerH + 18}" text-anchor="middle" font-size="11" fill="#6b7280">${safeText(lbl)}</text>
        </g>
      `;
    }).join("");

    const legend = `
      <g>
        <rect x="${padL}" y="28" width="12" height="12" rx="3" fill="${color}" opacity="0.28"></rect>
        <text x="${padL + 18}" y="38" font-size="11" fill="#64748b">${safeText(aLabel)}</text>

        <rect x="${padL + 120}" y="28" width="12" height="12" rx="3" fill="${color}" opacity="0.88"></rect>
        <text x="${padL + 138}" y="38" font-size="11" fill="#64748b">${safeText(bLabel)}</text>
      </g>
    `;

    return `
      <svg viewBox="0 0 ${w} ${h}" width="100%" height="auto" role="img" aria-label="${safeText(title)}">
        <rect x="0" y="0" width="${w}" height="${h}" rx="18" ry="18" fill="#ffffff" stroke="#eef2f7"></rect>
        <text x="${padL}" y="22" font-size="14" font-weight="800" fill="#0f172a">${safeText(title)}</text>
        ${legend}
        ${ticks}
        ${bars}
      </svg>
    `;
  }

  function svgDonut({ title, slices, width = 980, height = 240, color = "#0b3b82" }) {
    // slices: [{ label, value }]
    const w = width, h = height;
    const cx = 150, cy = 125, r = 72, strokeW = 18;

    const total = Math.max(1, slices.reduce((s, x) => s + safeNum(x.value, 0), 0));
    let acc = 0;

    const arcs = slices.map((s, idx) => {
      const v = safeNum(s.value, 0);
      const frac = v / total;
      const dash = frac * (2 * Math.PI * r);
      const gap = 2;

      const rotate = (acc / total) * 360 - 90;
      acc += v;

      const opacity = clamp(0.22 + idx * 0.22, 0.22, 0.95);

      return `
        <circle cx="${cx}" cy="${cy}" r="${r}"
          fill="transparent"
          stroke="${color}"
          stroke-opacity="${opacity}"
          stroke-width="${strokeW}"
          stroke-dasharray="${Math.max(0, dash - gap)} ${2 * Math.PI * r}"
          transform="rotate(${rotate} ${cx} ${cy})"
          stroke-linecap="round"
        />
      `;
    }).join("");

    const legend = slices.map((s, idx) => {
      const v = safeNum(s.value, 0);
      const pct = Math.round((v / total) * 100);
      const opacity = clamp(0.22 + idx * 0.22, 0.22, 0.95);
      return `
        <div class="legend-row">
          <span class="dot" style="opacity:${opacity};background:${safeText(color)}"></span>
          <div class="legend-text">
            <div class="legend-label">${safeText(s.label)}</div>
            <div class="legend-meta">${v} (${pct}%)</div>
          </div>
        </div>
      `;
    }).join("");

    return `
      <div class="donut-wrap">
        <div class="donut-left">
          <svg viewBox="0 0 ${w} ${h}" width="100%" height="auto" role="img" aria-label="${safeText(title)}">
            <rect x="0" y="0" width="${w}" height="${h}" rx="18" ry="18" fill="#ffffff" stroke="#eef2f7"></rect>
            <text x="52" y="22" font-size="14" font-weight="800" fill="#0f172a">${safeText(title)}</text>

            <g>
              <circle cx="${cx}" cy="${cy}" r="${r}" fill="transparent" stroke="#eef2f7" stroke-width="${strokeW}" />
              ${arcs}
            </g>

            <text x="${cx}" y="${cy - 4}" text-anchor="middle" font-size="18" font-weight="900" fill="#0f172a">${total}</text>
            <text x="${cx}" y="${cy + 18}" text-anchor="middle" font-size="11" fill="#64748b">total</text>
          </svg>
        </div>
        <div class="donut-right">
          <div class="legend">
            ${legend}
          </div>
        </div>
      </div>
    `;
  }

  // --- Word export helpers ---------------------------------------------------
  function wrapAsWordDoc(htmlBody, title) {
    // Minimal Word-compatible HTML wrapper.
    // Word will open .doc files containing HTML.
    const t = safeText(title || "Conexus Report");
    return `
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<title>${t}</title>
<!--[if gte mso 9]><xml>
  <w:WordDocument>
    <w:View>Print</w:View>
    <w:Zoom>100</w:Zoom>
    <w:DoNotOptimizeForBrowser/>
  </w:WordDocument>
</xml><![endif]-->
<style>
  body { font-family: Calibri, Arial, sans-serif; color:#0f172a; }
  h1,h2,h3 { color:#0b3b82; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #e5e7eb; padding: 8px; vertical-align: top; }
  th { background: #f8fafc; }
  .muted { color:#64748b; }
</style>
</head>
<body>
${htmlBody}
</body>
</html>
`.trim();
  }

  function downloadFile(filename, mime, content) {
    try {
      const blob = new Blob([content], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 500);
      return true;
    } catch (e) {
      console.error("Download failed:", e);
      return false;
    }
  }

  // --- Narrative generation --------------------------------------------------
  function generateDashboardReport(payload) {
    const events = Array.isArray(payload?.events) ? payload.events : [];
    const registrations = Array.isArray(payload?.registrations) ? payload.registrations : [];
    const eventStats = Array.isArray(payload?.eventStats) ? payload.eventStats : [];

    const createdAt = new Date().toISOString();
    const meta = payload?.meta || {};
    const org = meta.org || "Conexus";
    const generatedBy = meta.generatedBy || "DashboardReportNLP";

    // Index events by id for titles/dates
    const eventById = new Map();
    events.forEach((e) => {
      const id = e?.id;
      if (id == null) return;
      eventById.set(id, e);
    });

    // Registration status counts (overall)
    const statusCounts = registrations.reduce((acc, r) => {
      const s = String(r?.status || "For approval");
      acc[s] = (acc[s] || 0) + 1;
      return acc;
    }, {});

    const approvedRegs = safeNum(statusCounts["Approved"], 0);
    const rejectedRegs = safeNum(statusCounts["Rejected"], 0);
    const pendingRegs = safeNum(statusCounts["For approval"], 0);

    const totalRegs = registrations.length || payload?.totals?.registrations || 0;

    // Participants: prefer explicit participantsCount else 1 + companions length (if present)
    function registrationParticipantsCount(r) {
      if (Number.isFinite(Number(r?.participantsCount))) return safeNum(r?.participantsCount, 1);
      const companionsLen = Array.isArray(r?.companions) ? r.companions.length : 0;
      // main attendee + companions
      return 1 + companionsLen;
    }

    const totalParticipants = registrations.reduce((sum, r) => sum + registrationParticipantsCount(r), 0);

    // Attendance rollups (overall + per event)
    const attendanceOverall = {
      attendedRegs: 0,
      morningRegs: 0,
      afternoonRegs: 0,
      scanCount: 0,
      morningScans: 0,
      afternoonScans: 0,
      unknownScans: 0,
      earliestScan: null,
      latestScan: null,
    };

    // Per-event metric accumulator
    const metricsByEventId = new Map();

    function ensureEventMetric(eventId) {
      if (!metricsByEventId.has(eventId)) {
        const e = eventById.get(eventId) || {};
        metricsByEventId.set(eventId, {
          id: eventId,
          title: e?.title || e?.name || "Untitled",
          startDate: e?.startDate || e?.start_date || "",
          endDate: e?.endDate || e?.end_date || "",
          location: e?.location || "",
          type: e?.type || "Event",
          mode: e?.mode || "On-site",

          registrations: 0,
          participants: 0,

          approvedRegs: 0,
          pendingRegs: 0,
          rejectedRegs: 0,

          attendedRegs: 0,
          morningRegs: 0,
          afternoonRegs: 0,

          scanCount: 0,
          morningScans: 0,
          afternoonScans: 0,
          unknownScans: 0,

          earliestScan: null,
          latestScan: null,
        });
      }
      return metricsByEventId.get(eventId);
    }

    // Merge eventStats (if present) as baseline
    // (We do NOT trust its attendance fields; we combine with registrations if available.)
    eventStats.forEach((es) => {
      const id = es?.id ?? es?.eventId ?? es?.event_id;
      if (id == null) return;
      const m = ensureEventMetric(id);
      // Only set if empty to avoid overwriting real events array values
      if (!m.title && es?.title) m.title = es.title;
      if (!m.startDate && (es?.startDate || es?.start_date)) m.startDate = es.startDate || es.start_date;
      if (!m.endDate && (es?.endDate || es?.end_date)) m.endDate = es.endDate || es.end_date;

      // Basic registration-derived stats, if provided
      if (Number.isFinite(Number(es?.participants))) m.participants = Math.max(m.participants, safeNum(es.participants, 0));
      if (Number.isFinite(Number(es?.approved))) m.approvedRegs = Math.max(m.approvedRegs, safeNum(es.approved, 0));
      if (Number.isFinite(Number(es?.pending))) m.pendingRegs = Math.max(m.pendingRegs, safeNum(es.pending, 0));
    });

    // Build metrics from registrations
    registrations.forEach((r) => {
      const eventId = r?.eventId ?? r?.event_id;
      if (eventId == null) return;

      const m = ensureEventMetric(eventId);

      m.registrations += 1;
      m.participants += registrationParticipantsCount(r);

      const status = String(r?.status || "For approval");
      if (status === "Approved") m.approvedRegs += 1;
      else if (status === "Rejected") m.rejectedRegs += 1;
      else m.pendingRegs += 1;

      // Attendance
      const att = extractAttendanceSummary(r);
      if (att.attended) {
        m.attendedRegs += 1;
        attendanceOverall.attendedRegs += 1;

        if (att.morningAttended) {
          m.morningRegs += 1;
          attendanceOverall.morningRegs += 1;
        }
        if (att.afternoonAttended) {
          m.afternoonRegs += 1;
          attendanceOverall.afternoonRegs += 1;
        }
      }

      m.scanCount += att.scanCount;
      m.morningScans += att.morningScans;
      m.afternoonScans += att.afternoonScans;
      m.unknownScans += att.unknownScans;

      attendanceOverall.scanCount += att.scanCount;
      attendanceOverall.morningScans += att.morningScans;
      attendanceOverall.afternoonScans += att.afternoonScans;
      attendanceOverall.unknownScans += att.unknownScans;

      // Track earliest/latest scan timestamps
      const scanTimes = att.scans.map((s) => s.at).filter(Boolean);
      scanTimes.forEach((d) => {
        if (!m.earliestScan || d.getTime() < m.earliestScan.getTime()) m.earliestScan = d;
        if (!m.latestScan || d.getTime() > m.latestScan.getTime()) m.latestScan = d;

        if (!attendanceOverall.earliestScan || d.getTime() < attendanceOverall.earliestScan.getTime()) attendanceOverall.earliestScan = d;
        if (!attendanceOverall.latestScan || d.getTime() > attendanceOverall.latestScan.getTime()) attendanceOverall.latestScan = d;
      });
    });

    // If there are events with no registrations, still include them for completeness
    events.forEach((e) => {
      const id = e?.id;
      if (id == null) return;
      ensureEventMetric(id);
    });

    const allEventMetrics = Array.from(metricsByEventId.values());

    // Derived KPI rates
    const approvalRate = totalRegs ? (approvedRegs / totalRegs) : 0;
    const pendingRate = totalRegs ? (pendingRegs / totalRegs) : 0;
    const avgPaxPerReg = totalRegs ? (totalParticipants / totalRegs) : 0;

    // Attendance rates (registration-level)
    const attendedRateAll = totalRegs ? (attendanceOverall.attendedRegs / totalRegs) : 0;
    const attendedRateApproved = approvedRegs ? (attendanceOverall.attendedRegs / approvedRegs) : 0;

    // Identify top events
    const topByRegistered = [...allEventMetrics]
      .sort((a, b) => b.registrations - a.registrations)
      .slice(0, 8);

    const topByAttended = [...allEventMetrics]
      .sort((a, b) => b.attendedRegs - a.attendedRegs)
      .slice(0, 8);

    const topByAttendanceRate = [...allEventMetrics]
      .filter((e) => e.registrations > 0)
      .map((e) => ({
        ...e,
        attendanceRate: e.registrations ? (e.attendedRegs / e.registrations) : 0,
      }))
      .sort((a, b) => b.attendanceRate - a.attendanceRate)
      .slice(0, 6);

    // Topics / keywords
    const titleCorpus = events.map((e) => e.title || e.name || "");
    const descCorpus = events.map((e) => e.description || "");
    const keywords = topKeywords([...titleCorpus, ...descCorpus], 8);

    const keywordLine =
      keywords.length === 0
        ? "No dominant recurring topics detected from event titles/descriptions."
        : keywords.map((k) => `${k.w} (${k.c})`).join(", ");

    // Flags / operational notes
    const flags = [];
    if (pendingRate >= 0.35 && totalRegs >= 10) {
      flags.push("High pending share — approvals may be slowing down registrations. Consider using bulk approval and clear rules.");
    }
    if (totalRegs > 0 && attendanceOverall.scanCount === 0) {
      flags.push("No attendance scans detected. If NFC attendance is enabled, check scanner setup or attendance mode usage.");
    }
    if (totalRegs > 0 && attendedRateAll < 0.4) {
      flags.push("Low attendance capture vs registrations. Consider check-in reminders and more scanning lanes to reduce bottlenecks.");
    }

    // Charts data
    const regVsAttendCategories = topByRegistered.map((e) => (e.title || "Untitled"));
    const regVsAttendA = topByRegistered.map((e) => safeNum(e.registrations, 0));
    const regVsAttendB = topByRegistered.map((e) => safeNum(e.attendedRegs, 0));

    const statusDonutSlices = [
      { label: "Approved", value: approvedRegs },
      { label: "For approval", value: pendingRegs },
      { label: "Rejected", value: rejectedRegs },
    ];

    const daypartDonutSlices = [
      { label: "Morning scans", value: attendanceOverall.morningScans },
      { label: "Afternoon scans", value: attendanceOverall.afternoonScans },
      { label: "Unknown time", value: attendanceOverall.unknownScans },
    ];

    const attendanceRateBar = topByAttendanceRate.map((e) => ({
      label: (e.title || "Untitled").slice(0, 14) + ((e.title || "").length > 14 ? "…" : ""),
      sublabel: e.startDate || e.endDate ? formatDate(e.startDate || e.endDate).replace(/\s/g, "\u00A0") : "",
      value: Math.round((e.attendanceRate || 0) * 100),
    }));

    // Narrative
    const totalEvents = allEventMetrics.length || events.length || 0;

    const execSummary = [];
    execSummary.push(
      `Across ${totalEvents} event(s), Conexus recorded ${totalRegs} registration(s) representing ${totalParticipants} participant(s).`
    );
    if (totalRegs) {
      execSummary.push(
        `Registration status is ${approvedRegs} approved, ${pendingRegs} pending, and ${rejectedRegs} rejected. The approval rate is ${(approvalRate * 100).toFixed(1)}%.`
      );
    } else {
      execSummary.push(`No registrations are recorded yet. Once users register, the dashboard will automatically populate approval and attendance metrics.`);
    }

    if (attendanceOverall.scanCount > 0 || attendanceOverall.attendedRegs > 0) {
      execSummary.push(
        `Attendance captured ${attendanceOverall.attendedRegs} check-ins (registration-level). Attendance rate is ${(attendedRateAll * 100).toFixed(1)}% vs all registrations and ${(attendedRateApproved * 100).toFixed(1)}% vs approved registrations.`
      );
      const w = attendanceOverall.earliestScan ? formatTime(attendanceOverall.earliestScan) : "";
      const l = attendanceOverall.latestScan ? formatTime(attendanceOverall.latestScan) : "";
      if (w && l) execSummary.push(`Attendance scans ranged from ${w} to ${l} (local time).`);
    } else {
      execSummary.push(
        `No attendance scans were detected from the dataset. If NFC attendance is active, make sure the scanner station is used to record check-ins.`
      );
    }

    if (topByRegistered.length) {
      const t = topByRegistered[0];
      execSummary.push(
        `Top event by registrations is “${t.title}” with ${t.registrations} registration(s) and ${t.attendedRegs} attended check-in(s).`
      );
    }

    const insights = [];
    if (keywords.length) insights.push(`Recurring topics in event titles/descriptions are: ${keywordLine}.`);
    if (topByAttendanceRate.length) {
      const best = topByAttendanceRate[0];
      insights.push(
        `Highest attendance capture rate is “${best.title}” at ${(best.attendanceRate * 100).toFixed(1)}% (${best.attendedRegs}/${best.registrations}).`
      );
    }
    if (flags.length) flags.forEach((f) => insights.push(f));

    const recos = [
      `Operational: set an approval SLA (for example, approve or reject within 24–48 hours) to reduce pending registrations.`,
      `On event day: prepare at least one dedicated NFC scanner station per expected arrival peak, and open the scanning page in advance for faster throughput.`,
      `Data quality: ensure the scanner logs timestamps (scan time) so morning/afternoon reporting becomes reliable and consistent.`,
      `Growth: reuse the strongest-performing event keywords in future titles to improve discovery.`,
    ];

    // --- HTML report ---------------------------------------------------------
    const BRAND = "#0b3b82"; // University blue
    const GOLD = "#f5c518";  // Gold

    const filenameBase = safeSlug(`${org}_dashboard_${new Date(createdAt).toISOString().slice(0, 10)}`);

    const eventRows = allEventMetrics
      .slice()
      .sort((a, b) => (b.registrations - a.registrations))
      .map((e) => {
        const attendRate = e.registrations ? ((e.attendedRegs / e.registrations) * 100) : 0;
        const approveRateEvt = e.registrations ? ((e.approvedRegs / e.registrations) * 100) : 0;

        return `
          <tr>
            <td>
              <div style="font-weight:800;color:#0f172a;">${safeText(e.title)}</div>
              <div class="muted" style="margin-top:3px;">
                ${safeText(e.type || "Event")} • ${safeText(e.mode || "On-site")} • ${safeText(e.location || "")}
              </div>
            </td>
            <td class="muted">${safeText(formatRange(e.startDate, e.endDate))}</td>
            <td><b>${safeNum(e.registrations, 0)}</b><div class="muted" style="font-size:11px;">pax: ${safeNum(e.participants, 0)}</div></td>
            <td>${safeNum(e.approvedRegs, 0)}<div class="muted" style="font-size:11px;">${approveRateEvt.toFixed(1)}%</div></td>
            <td><b>${safeNum(e.attendedRegs, 0)}</b><div class="muted" style="font-size:11px;">${attendRate.toFixed(1)}%</div></td>
            <td>${safeNum(e.morningRegs, 0)} / ${safeNum(e.afternoonRegs, 0)}<div class="muted" style="font-size:11px;">(morning / afternoon)</div></td>
            <td>${safeNum(e.morningScans, 0)} / ${safeNum(e.afternoonScans, 0)} / ${safeNum(e.unknownScans, 0)}<div class="muted" style="font-size:11px;">(AM / PM / unknown)</div></td>
          </tr>
        `;
      })
      .join("");

    const keywordTags = keywords.map((k) => `<span class="tag"><span class="dot"></span>${safeText(k.w)} <span class="muted">(${k.c})</span></span>`).join("");

    // Buttons for downloads inside HTML (self-contained)
    // These buttons will work when the downloaded report.html is opened.
    const downloadControls = `
      <div class="dlbar">
        <button class="dlbtn" type="button" onclick="__dlWord()">Download Word (.doc)</button>
        <button class="dlbtn secondary" type="button" onclick="__dlTxt()">Download Text (.txt)</button>
      </div>
    `;

    const html = `
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${safeText(org)} — Admin Dashboard Report</title>
  <style>
    :root{
      --brand:${BRAND};
      --gold:${GOLD};
      --text:#0f172a;
      --muted:#64748b;
      --border:#e8edf5;
      --soft:#f6f8fc;
    }
    body{
      margin:0;
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial;
      background: linear-gradient(180deg, #fbfcff, #ffffff);
      color:var(--text);
    }
    .wrap{max-width:1120px;margin:0 auto;padding:26px 18px 60px;}
    .card{
      background:#fff;border:1px solid var(--border);border-radius:18px;
      box-shadow: 0 14px 38px rgba(15,23,42,0.07);
      overflow:hidden;
    }
    .hdr{
      padding:18px 18px;border-bottom:1px solid var(--border);
      display:flex;align-items:flex-start;justify-content:space-between;gap:12px;
      background:
        radial-gradient(900px 380px at 10% 20%, rgba(11,59,130,0.14), transparent 55%),
        radial-gradient(900px 380px at 85% 10%, rgba(245,197,24,0.12), transparent 55%),
        linear-gradient(90deg, rgba(11,59,130,.06), rgba(11,59,130,.02));
    }
    .title{font-weight:900;font-size:18px;letter-spacing:.2px;}
    .sub{font-size:12px;color:var(--muted);margin-top:4px;line-height:1.35;max-width:720px;}
    .meta{font-size:11px;color:var(--muted);text-align:right;line-height:1.4;}
    .kpis{display:grid;grid-template-columns: repeat(4, minmax(0,1fr));gap:10px;padding:16px;}
    @media(max-width:860px){.kpis{grid-template-columns: repeat(2, minmax(0,1fr));}}
    .kpi{
      border:1px solid var(--border);border-radius:14px;background:rgba(255,255,255,.96);
      padding:12px 12px;
    }
    .kpi .lbl{font-size:11px;color:var(--muted);}
    .kpi .val{font-size:20px;font-weight:900;color:var(--brand);margin-top:6px;}
    .grid{display:grid;gap:14px;padding:16px;}
    @media(min-width:980px){.grid{grid-template-columns: 1fr 1fr;}}
    .section{
      padding:16px;border-top:1px solid var(--border);
    }
    .section h3{margin:0 0 8px;font-size:13px;font-weight:900;color:#0f172a;}
    .bullets{margin:0;padding-left:16px;color:#0f172a;font-size:12px;line-height:1.6;}
    .bullets li{margin:4px 0;}
    .muted{color:var(--muted);}
    .table{
      width:100%;border-collapse:separate;border-spacing:0;
      overflow:hidden;border:1px solid var(--border);border-radius:14px;
      font-size:12px;
    }
    .table th,.table td{padding:10px 10px;border-bottom:1px solid var(--border);text-align:left;vertical-align:top;}
    .table th{background:var(--soft);font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.12em;}
    .table tr:last-child td{border-bottom:none;}
    .tag{
      display:inline-flex;align-items:center;gap:8px;padding:6px 10px;
      border-radius:999px;border:1px solid var(--border);background:#fff;font-size:11px;color:#0f172a;
      margin:6px 8px 0 0;
    }
    .tag .dot{width:8px;height:8px;border-radius:999px;background:var(--gold);opacity:.95}
    .donut-wrap{display:grid;gap:10px;align-items:stretch;}
    @media(min-width:980px){.donut-wrap{grid-template-columns: 1fr 1fr;}}
    .legend{
      padding:14px 14px;border:1px solid var(--border);border-radius:18px;background:#fff;
      box-shadow: 0 10px 24px rgba(15,23,42,0.06);
    }
    .legend-row{display:flex;gap:10px;align-items:flex-start;padding:10px 0;border-bottom:1px dashed var(--border);}
    .legend-row:last-child{border-bottom:none;}
    .legend .dot{width:10px;height:10px;border-radius:999px;background:var(--brand);margin-top:2px;}
    .legend-label{font-weight:800;font-size:12px;}
    .legend-meta{font-size:11px;color:var(--muted);margin-top:2px;}
    .foot{padding:12px 16px;color:var(--muted);font-size:11px;border-top:1px solid var(--border);background:linear-gradient(180deg,#fff,#fbfcff);}
    .mono{font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;}

    .dlbar{
      display:flex;gap:10px;align-items:center;justify-content:flex-end;
      padding:12px 16px;border-top:1px solid var(--border);background:#fff;
    }
    .dlbtn{
      appearance:none;border:1px solid rgba(11,59,130,0.20);
      background: linear-gradient(135deg, rgba(11,59,130,0.10), rgba(11,59,130,0.02));
      color:#0f172a;font-weight:900;font-size:12px;
      padding:10px 12px;border-radius:12px;cursor:pointer;
      transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease;
    }
    .dlbtn:hover{transform: translateY(-1px);box-shadow: 0 10px 20px rgba(15,23,42,0.08);border-color: rgba(245,197,24,0.45);}
    .dlbtn.secondary{
      border-color: rgba(100,116,139,0.25);
      background: linear-gradient(135deg, rgba(100,116,139,0.10), rgba(100,116,139,0.02));
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card" id="__reportRoot">
      <div class="hdr">
        <div>
          <div class="title">${safeText(org)} — Admin Dashboard Report</div>
          <div class="sub">
            Detailed report of registrations and attendance based on the Admin Dashboard dataset. Attendance metrics appear if NFC check-in logs/timestamps exist.
          </div>
        </div>
        <div class="meta">
          <div><span class="muted">Generated:</span> ${safeText(new Date(createdAt).toLocaleString())}</div>
          <div><span class="muted">Engine:</span> <span class="mono">${safeText(generatedBy)}</span></div>
        </div>
      </div>

      <div class="kpis">
        <div class="kpi"><div class="lbl">Events</div><div class="val">${totalEvents}</div></div>
        <div class="kpi"><div class="lbl">Registrations</div><div class="val">${totalRegs}</div></div>
        <div class="kpi"><div class="lbl">Participants</div><div class="val">${totalParticipants}</div></div>
        <div class="kpi"><div class="lbl">Attendance rate (vs all regs)</div><div class="val">${totalRegs ? (attendedRateAll * 100).toFixed(1) + "%" : "—"}</div></div>
      </div>

      <div class="grid">
        <div class="section">
          <h3>Executive summary</h3>
          <ul class="bullets">
            ${execSummary.map((x) => `<li>${safeText(x)}</li>`).join("")}
          </ul>

          <h3 style="margin-top:14px;">Detected topics (lightweight NLP)</h3>
          <div class="muted" style="font-size:12px;line-height:1.6;">
            ${safeText(keywordLine)}
          </div>
          <div style="margin-top:8px;">
            ${keywordTags}
          </div>
        </div>

        <div class="section">
          <h3>Registration status distribution</h3>
          ${svgDonut({ title: "Registrations by status", slices: statusDonutSlices, width: 980, height: 240, color: BRAND })}
          <div class="muted" style="font-size:12px;line-height:1.6;margin-top:10px;">
            Pending share is ${totalRegs ? (pendingRate * 100).toFixed(1) + "%" : "—"}. Average participants per registration is ${totalRegs ? avgPaxPerReg.toFixed(2) : "—"}.
          </div>
        </div>
      </div>

      <div class="section">
        <h3>Registered vs Attended (top events)</h3>
        ${svgGroupedBarChart({
          title: "Registered vs Attended (Top 8 by registrations)",
          categories: regVsAttendCategories,
          aValues: regVsAttendA,
          bValues: regVsAttendB,
          aLabel: "Registered",
          bLabel: "Attended",
          width: 980,
          height: 270,
          color: BRAND
        })}
        <div class="muted" style="font-size:12px;line-height:1.6;margin-top:10px;">
          “Attended” is computed from attendance scans/timestamps per registration. If scans are not logged, attended counts may appear as zero.
        </div>
      </div>

      <div class="grid">
        <div class="section">
          <h3>Attendance scan timing (morning vs afternoon)</h3>
          ${svgDonut({ title: "Attendance scans by time of day", slices: daypartDonutSlices, width: 980, height: 240, color: BRAND })}
          <div class="muted" style="font-size:12px;line-height:1.6;margin-top:10px;">
            Morning vs afternoon is inferred from scan time (hour &lt; 12 = morning). If timestamps are missing, scans are counted as “Unknown time”.
          </div>
        </div>

        <div class="section">
          <h3>Highest attendance capture rate</h3>
          ${svgBarChart({
            title: "Attendance rate by event (Top 6)",
            series: attendanceRateBar,
            width: 980,
            height: 250,
            color: BRAND
          })}
          <div class="muted" style="font-size:12px;line-height:1.6;margin-top:10px;">
            Values show attendance rate (%) = attended registrations ÷ total registrations for that event.
          </div>
        </div>
      </div>

      <div class="section">
        <h3>Insights</h3>
        <ul class="bullets">
          ${(insights.length ? insights : ["No additional insights detected yet. Add more events, registrations, and attendance logs to enrich analysis."])
            .map((x) => `<li>${safeText(x)}</li>`).join("")}
        </ul>

        <h3 style="margin-top:14px;">Recommendations</h3>
        <ul class="bullets">
          ${recos.map((x) => `<li>${safeText(x)}</li>`).join("")}
        </ul>
      </div>

      <div class="section">
        <h3>Event appendix (detailed)</h3>
        <table class="table">
          <thead>
            <tr>
              <th>Event</th>
              <th>Date range</th>
              <th>Registered</th>
              <th>Approved</th>
              <th>Attended</th>
              <th>Attendance timing</th>
              <th>Scan counts</th>
            </tr>
          </thead>
          <tbody>
            ${eventRows || `<tr><td colspan="7" class="muted">No events available.</td></tr>`}
          </tbody>
        </table>
      </div>

      ${downloadControls}

      <div class="foot">
        Source: Conexus Admin Dashboard dataset (events, registrations, attendance logs if present). Generated client-side (no external NLP API).
      </div>
    </div>
  </div>

  <script>
    // Self-contained downloads from the HTML file.
    (function(){
      function dl(filename, mime, content){
        try{
          var blob = new Blob([content], {type: mime});
          var url = URL.createObjectURL(blob);
          var a = document.createElement('a');
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(function(){ URL.revokeObjectURL(url); }, 500);
        }catch(e){
          alert('Download failed. ' + (e && e.message ? e.message : ''));
        }
      }

      function asWordDoc(htmlBody, title){
        return (
          '<html xmlns:o="urn:schemas-microsoft-com:office:office" ' +
          'xmlns:w="urn:schemas-microsoft-com:office:word" ' +
          'xmlns="http://www.w3.org/TR/REC-html40">' +
          '<head><meta charset="utf-8"><title>' + title + '</title>' +
          '<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom><w:DoNotOptimizeForBrowser/></w:WordDocument></xml><![endif]-->' +
          '<style>body{font-family:Calibri,Arial,sans-serif;color:#0f172a}h1,h2,h3{color:#0b3b82}table{border-collapse:collapse;width:100%}th,td{border:1px solid #e5e7eb;padding:8px;vertical-align:top}th{background:#f8fafc}.muted{color:#64748b}.dlbar{display:none}</style>' +
          '</head><body>' + htmlBody + '</body></html>'
        );
      }

      window.__dlWord = function(){
        var root = document.getElementById('__reportRoot');
        if(!root) return;
        // Clone, remove the download buttons for the Word export
        var clone = root.cloneNode(true);
        var dlbar = clone.querySelector('.dlbar');
        if(dlbar) dlbar.remove();
        var foot = clone.querySelector('.foot');
        if(foot) foot.style.marginTop = '14px';

        var title = ${JSON.stringify(`${org} — Admin Dashboard Report`)};
        var doc = asWordDoc(clone.outerHTML, title);
        dl(${JSON.stringify(filenameBase + ".doc")}, 'application/msword', doc);
      };

      window.__dlTxt = function(){
        dl(${JSON.stringify(filenameBase + ".txt")}, 'text/plain;charset=utf-8', ${JSON.stringify("")});
      };
    })();
  </script>

  <script>
    // Inject the plain-text content into the __dlTxt handler (keeps HTML readable)
    (function(){
      var txt = ${JSON.stringify("")};
      // The generator will replace this string below with the final text using a second pass:
      window.__REPORT_TEXT__ = txt;
      if (window.__dlTxt) {
        var old = window.__dlTxt;
        window.__dlTxt = function(){
          try{
            var content = window.__REPORT_TEXT__ || '';
            var blob = new Blob([content], {type:'text/plain;charset=utf-8'});
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url;
            a.download = ${JSON.stringify(filenameBase + ".txt")};
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(function(){ URL.revokeObjectURL(url); }, 500);
          }catch(e){
            old();
          }
        };
      }
    })();
  </script>
</body>
</html>
`.trim();

    // Text report
    const text = [
      `${org} — Admin Dashboard Report`,
      `Generated: ${new Date(createdAt).toLocaleString()}`,
      ``,
      `KPIs`,
      `- Events: ${totalEvents}`,
      `- Registrations: ${totalRegs}`,
      `- Participants: ${totalParticipants}`,
      `- Approval rate: ${totalRegs ? (approvalRate * 100).toFixed(1) + "%" : "—"}`,
      `- Pending share: ${totalRegs ? (pendingRate * 100).toFixed(1) + "%" : "—"}`,
      `- Avg participants / registration: ${totalRegs ? avgPaxPerReg.toFixed(2) : "—"}`,
      `- Attended check-ins (registration-level): ${attendanceOverall.attendedRegs}`,
      `- Attendance rate vs all registrations: ${totalRegs ? (attendedRateAll * 100).toFixed(1) + "%" : "—"}`,
      `- Attendance rate vs approved: ${approvedRegs ? (attendedRateApproved * 100).toFixed(1) + "%" : "—"}`,
      `- Attendance scans: total=${attendanceOverall.scanCount}, morning=${attendanceOverall.morningScans}, afternoon=${attendanceOverall.afternoonScans}, unknown=${attendanceOverall.unknownScans}`,
      attendanceOverall.earliestScan && attendanceOverall.latestScan
        ? `- Scan window (local time): ${formatTime(attendanceOverall.earliestScan)} → ${formatTime(attendanceOverall.latestScan)}`
        : `- Scan window: —`,
      ``,
      `Executive summary`,
      ...execSummary.map((x) => `- ${x}`),
      ``,
      `Detected topics (lightweight NLP)`,
      `- ${keywordLine}`,
      ``,
      `Insights`,
      ...(insights.length ? insights.map((x) => `- ${x}`) : [`- No additional insights detected yet.`]),
      ``,
      `Recommendations`,
      ...recos.map((x) => `- ${x}`),
      ``,
      `Event appendix (detailed)`,
      ...allEventMetrics
        .slice()
        .sort((a, b) => b.registrations - a.registrations)
        .map((e) => {
          const rate = e.registrations ? ((e.attendedRegs / e.registrations) * 100) : 0;
          return `- ${e.title} | ${formatRange(e.startDate, e.endDate)} | registered=${e.registrations} | approved=${e.approvedRegs} | attended=${e.attendedRegs} (${rate.toFixed(1)}%) | morning/afternoon regs=${e.morningRegs}/${e.afternoonRegs} | scans AM/PM/UNK=${e.morningScans}/${e.afternoonScans}/${e.unknownScans}`;
        }),
      ``,
      `Notes`,
      `- Attendance is computed from registration attendance logs/timestamps when available.`,
      `- Morning/Afternoon is inferred from scan time (hour < 12 = morning).`,
      `- Report generated client-side; no external API used.`,
    ].join("\n");

    // Patch the HTML: inject the actual text into __REPORT_TEXT__
    const htmlPatched = html.replace(
      /window\.__REPORT_TEXT__ = txt;/,
      `window.__REPORT_TEXT__ = ${JSON.stringify(text)};`
    ).replace(
      /dl\(.+?\.txt'\)\}, 'text\/plain;charset=utf-8', ""\);\s*\};/,
      ``
    );

    // Word content (separate .doc export)
    // Use the main report root only (no download buttons)
    const wordBody = `
      <div>
        <h2 style="margin:0 0 6px 0;">${safeText(org)} — Admin Dashboard Report</h2>
        <div class="muted" style="margin:0 0 14px 0;">Generated: ${safeText(new Date(createdAt).toLocaleString())}</div>
      </div>
      ${safeText("")}
    `.trim();

    // Instead of building a separate simplified body, we build Word from the HTML report root by reusing the full HTML and letting Word ignore scripts.
    // But we also expose docHtml for direct download.
    const docHtml = wrapAsWordDoc(htmlPatched, `${org} — Admin Dashboard Report`);

    return {
      html: htmlPatched,
      text,
      createdAt,
      // new (non-breaking)
      docHtml,
      filenameBase,
    };
  }

  // --- Public download helpers (optional) -----------------------------------
  function downloadHtml(report, baseName) {
    const name = safeSlug(baseName || report?.filenameBase || "dashboard_report");
    return downloadFile(name + ".html", "text/html;charset=utf-8", report?.html || "");
  }

  function downloadText(report, baseName) {
    const name = safeSlug(baseName || report?.filenameBase || "dashboard_report");
    return downloadFile(name + ".txt", "text/plain;charset=utf-8", report?.text || "");
  }

  function downloadWord(report, baseName) {
    const name = safeSlug(baseName || report?.filenameBase || "dashboard_report");
    const doc = report?.docHtml || wrapAsWordDoc(report?.html || "", name);
    return downloadFile(name + ".doc", "application/msword", doc);
  }

  function downloadAll(report, baseName) {
    downloadHtml(report, baseName);
    downloadText(report, baseName);
    downloadWord(report, baseName);
    return true;
  }

  window.DashboardReportNLP = {
    generateDashboardReport,
    downloadHtml,
    downloadText,
    downloadWord,
    downloadAll,
  };
})();
