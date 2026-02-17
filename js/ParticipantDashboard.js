// js/ParticipantDashboard.js
// Combined: ParticipantDashboard + "Submit Paper" feature (from PresenterDashboard)
// ✅ Supabase REMOVED (no DB/storage). Everything works in UI using local state + optional callbacks.
// - Registration: calls onRegister(event, preparedForm)
// - Paper submit: calls onSubmitPaper(payload) if provided, then stores locally for status table
//
// Optional new props (backward-compatible):
//   submissions: array of existing submissions
//   onSubmitPaper: async function({ title, track, abstract, file, eventId, user })
//   onUpdateUser: function(updatedUser) // NEW: Updates user state after business card edit
//
// NOTE: This file assumes your global helper classes exist (grad-btn, badge-soft, etc.)
// It also includes safe fallback helpers for classNames + formatDateRange.

const { useState, useEffect } = React;

// ---------- Safe helpers (fallbacks) ----------
function classNames(...args) {
  return args.filter(Boolean).join(" ");
}

function formatDateRange(start, end) {
  if (!start && !end) return "";
  try {
    const s = start ? new Date(start) : null;
    const e = end ? new Date(end) : null;

    const validS = s && !isNaN(s.getTime());
    const validE = e && !isNaN(e.getTime());

    if (validS && validE) {
      const sameMonth =
        s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear();
      const opts = { month: "short", day: "numeric" };
      const sPart = s.toLocaleDateString(undefined, opts);
      const ePart = e.toLocaleDateString(undefined, opts);
      const year = s.getFullYear();
      return sameMonth
        ? `${sPart}–${e.getDate()}, ${year}`
        : `${sPart} – ${ePart}, ${year}`;
    }

    const d = validS ? s : validE ? e : null;
    return d ? d.toLocaleDateString() : "";
  } catch {
    return "";
  }
}

function slugify(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// Normalize submission (keeps compatibility with your Supabase-shaped rows if you pass them in)
function normalizeSubmission(row) {
  if (!row) return row;
  return {
    id: row.id ?? `${Date.now()}_${Math.random().toString(16).slice(2)}`,
    userEmail: row.user_email ?? row.userEmail ?? row.email ?? "",
    eventId: row.event_id ?? row.eventId ?? null,
    title: row.title ?? "",
    track: row.track ?? "General Research",
    abstract: row.abstract ?? "",
    status: row.status ?? "under_review",
    fileName: row.file_name ?? row.fileName ?? "",
    filePath: row.file_path ?? row.filePath ?? "", // not used (no storage)
    submittedAt:
      row.submitted_at ??
      row.submittedAt ??
      row.created_at ??
      row.createdAt ??
      null,
  };
}

/* =========================================================
   CONEXUS UNIVERSITY THEME (design-only; no logic changes)
   - Matches App.js palette + card/button system
   ========================================================= */
(function injectConexusParticipantTheme() {
  try {
    if (typeof document === "undefined") return;

    // 1) Base theme (shared) — only insert if missing
    const BASE_ID = "conexus-global-styles";
    if (!document.getElementById(BASE_ID)) {
      const style = document.createElement("style");
      style.id = BASE_ID;
      style.textContent = `
        :root{
          --u-navy:#0B1735;
          --u-blue:#1E5AA8;
          --u-sky:#F3F7FF;
          --u-gold:#F5C518;
          --u-ink:#0B1735;
          --u-muted:rgba(11,23,53,.62);

          /* legacy compat */
          --brand: var(--u-blue);
          --accent1: var(--u-blue);
          --accent2: #1b4e91;
          --accent3: var(--u-gold);
        }
        html,body{height:100%}
        body{
          background: radial-gradient(900px 420px at 10% 10%, rgba(30,90,168,.18), transparent 60%),
                      radial-gradient(900px 420px at 90% 20%, rgba(245,197,24,.16), transparent 60%),
                      linear-gradient(180deg,#fff,var(--u-sky));
          color:var(--u-ink);
        }
        .bg-page{
          background: radial-gradient(900px 420px at 10% 10%, rgba(30,90,168,.18), transparent 60%),
                      radial-gradient(900px 420px at 90% 20%, rgba(245,197,24,.16), transparent 60%),
                      linear-gradient(180deg,#fff,var(--u-sky));
        }
        .text-brand{color:var(--u-navy)}
        .text-muted{color:var(--u-muted)}
        .u-card{
          background: rgba(255,255,255,.86);
          border: 1px solid rgba(11,23,53,.10);
          box-shadow: 0 18px 44px rgba(11,23,53,.10);
          backdrop-filter: blur(10px);
        }
        .u-soft{background: rgba(30,90,168,.06)}
        .u-line{border-color: rgba(11,23,53,.10)}
        .u-btn-gold{
          background: var(--u-gold);
          color: var(--u-navy);
          border: 1px solid rgba(11,23,53,.12);
          box-shadow: 0 12px 28px rgba(11,23,53,.12);
        }
        .u-btn-outline{
          background: rgba(255,255,255,.72);
          color: var(--u-navy);
          border: 1px solid rgba(11,23,53,.14);
          box-shadow: 0 12px 28px rgba(11,23,53,.10);
        }
        .grad-btn{
          background: linear-gradient(135deg,var(--u-blue),var(--u-navy));
          box-shadow: 0 14px 36px rgba(11,23,53,.18);
        }
        .hover-card{transition: transform .2s ease, box-shadow .2s ease}
        .hover-card:hover{transform: translateY(-2px); box-shadow: 0 22px 54px rgba(11,23,53,.14)}
        .scrollbar-hide::-webkit-scrollbar{display:none}
        .scrollbar-hide{-ms-overflow-style:none; scrollbar-width:none}

        /* legacy helper classes */
        .bg-soft{background: rgba(30,90,168,.06)}
        .shadow-card{box-shadow: 0 18px 44px rgba(11,23,53,.10)}
        .shadow-glow{box-shadow: 0 28px 70px rgba(11,23,53,.16)}
        .bg-brand{background: linear-gradient(135deg,var(--u-blue),var(--u-navy))}
        .border-brand{border-color: rgba(30,90,168,.28)}
        .animate-fade-in-up{animation: fadeInUp .25s ease both}
        @keyframes fadeInUp{from{opacity:0; transform: translateY(8px)}to{opacity:1; transform: translateY(0)}}
      `;
      document.head.appendChild(style);
    }

    // 2) Participant-specific extras — insert once
    const EXTRA_ID = "conexus-participant-styles";
    if (document.getElementById(EXTRA_ID)) return;

    const extra = document.createElement("style");
    extra.id = EXTRA_ID;
    extra.textContent = `
      /* badges (fallback if not defined elsewhere) */
      .badge-soft{
        display:inline-flex; align-items:center;
        padding:.28rem .55rem;
        border-radius:999px;
        font-weight:800;
        font-size:11px;
        border:1px solid rgba(11,23,53,.10);
        background: rgba(255,255,255,.72);
        color: rgba(11,23,53,.78);
      }
      .badge-soft-amber{ background: rgba(245,197,24,.18); border-color: rgba(245,197,24,.28); color: rgba(11,23,53,.86); }
      .badge-soft-green{ background: rgba(16,185,129,.14); border-color: rgba(16,185,129,.24); color: rgba(11,23,53,.86); }
      .badge-soft-rose{  background: rgba(244,63,94,.12); border-color: rgba(244,63,94,.22); color: rgba(11,23,53,.86); }

      /* spinner fallback */
      .spinner{
        width:16px; height:16px; border-radius:999px;
        border:2px solid rgba(11,23,53,.18);
        border-top-color: rgba(30,90,168,.70);
        animation: spin .8s linear infinite;
      }
      @keyframes spin{to{transform: rotate(360deg)}}

      /* nicer table header */
      .table-head{
        background: rgba(30,90,168,.06);
        border-bottom: 1px solid rgba(11,23,53,.08);
      }
    `;
    document.head.appendChild(extra);
  } catch (_) {}
})();

function ParticipantDashboard({
  user,
  events,
  loading,
  registrations,
  onRegister,
  onDownloadInvitation,
  submissions: submissionsProp,
  onSubmitPaper,
  onUpdateUser // <-- NEW PROP for Business Card editing
}) {
  // Tabs: upcoming | my | submit | business_card
  const [tab, setTab] = useState("upcoming");
  const [filterType, setFilterType] = useState("all");
  const [selectedEvent, setSelectedEvent] = useState(null);

  // Registration form
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    university: "",
    contact: "",
    notes: "",
  });

  const [participantsCount, setParticipantsCount] = useState(1);
  const [saving, setSaving] = useState(false);

  // confirmation modal for irreversible action
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingPayload, setPendingPayload] = useState(null);

  // animation for register modal
  const [modalVisible, setModalVisible] = useState(false);

  // animation for upcoming events list
  const [animateUpcoming, setAnimateUpcoming] = useState(false);

  // inline error text (now for callback errors / validation)
  const [errorMessage, setErrorMessage] = useState("");

  // -------- Submit Paper state (LOCAL) --------
  const [paperForm, setPaperForm] = useState({
    title: "",
    track: "General Research",
    abstract: "",
    // future: eventId
  });
  const [paperFile, setPaperFile] = useState(null);
  const [paperFileName, setPaperFileName] = useState("");
  const [paperSaving, setPaperSaving] = useState(false);
  const [paperError, setPaperError] = useState("");
  const [paperSuccess, setPaperSuccess] = useState("");

  const [statusFilter, setStatusFilter] = useState("all");
  const [submissions, setSubmissions] = useState(
    Array.isArray(submissionsProp) ? submissionsProp.map(normalizeSubmission) : []
  );

  // Keep in sync if parent sends new submissions
  useEffect(() => {
    if (Array.isArray(submissionsProp)) {
      setSubmissions(submissionsProp.map(normalizeSubmission));
    }
  }, [submissionsProp]);

  const upcomingEvents = (events || []).filter((e) => !e.past);
  const myEvents = registrations || [];

  const upcomingCount = upcomingEvents.length;
  const myCount = myEvents.length;

  const mySubmissions = submissions.filter((s) => {
    const email = (user && (user.email || user.userEmail)) || "";
    return (
      String(s.userEmail || "").toLowerCase() === String(email).toLowerCase()
    );
  });

  const visibleSubmissions =
    statusFilter === "all"
      ? mySubmissions
      : mySubmissions.filter(
          (s) => (s.status || "under_review") === statusFilter
        );

  // smooth pop-in for register modal
  useEffect(() => {
    let id;
    if (selectedEvent) {
      setModalVisible(false);
      id = setTimeout(() => setModalVisible(true), 10);
    } else {
      setModalVisible(false);
    }
    return () => id && clearTimeout(id);
  }, [selectedEvent]);

  // pop-up animation whenever Upcoming tab is active
  useEffect(() => {
    if (tab !== "upcoming") return;
    setAnimateUpcoming(false);
    const id = setTimeout(() => setAnimateUpcoming(true), 10);
    return () => clearTimeout(id);
  }, [tab, upcomingEvents.length]);

  function filteredUpcoming() {
    let list = upcomingEvents;
    if (filterType !== "all") {
      list = list.filter(
        (e) =>
          String(e.mode || "").toLowerCase() ===
            String(filterType).toLowerCase() ||
          String(e.type || "").toLowerCase() ===
            String(filterType).toLowerCase()
      );
    }
    return list;
  }

  function openRegisterModal(event) {
    setSelectedEvent(event);
    setParticipantsCount(1);
    setFormData({
      fullName: user?.name || "",
      email: user?.email || "",
      university: user?.university || "",
      contact: "",
      notes: "",
    });
    setErrorMessage("");
  }

  function closeRegisterModal() {
    if (saving) return;
    setSelectedEvent(null);
    setErrorMessage("");
  }

  function incrementParticipants() {
    setParticipantsCount((prev) => Math.min(prev + 1, 99));
  }

  function decrementParticipants() {
    setParticipantsCount((prev) => Math.max(prev - 1, 1));
  }

  function handleRegistrationFieldChange(e) {
    const { name, value } = e.target;
    setFormData((p) => ({ ...p, [name]: value }));
  }

  // first step: user submits the form -> open confirmation pop-up
  function handleSubmit(e) {
    e.preventDefault();
    if (!selectedEvent) return;

    // simple validation
    if (!formData.fullName || !formData.email) {
      setErrorMessage("Please enter your full name and email.");
      return;
    }

    const preparedForm = {
      ...formData,
      participantsCount,
    };

    setPendingPayload({
      event: selectedEvent,
      formData: preparedForm,
    });
    setConfirmOpen(true);
  }

  // second step: confirm irreversible action
  async function handleConfirmProceed() {
    if (!pendingPayload) {
      setConfirmOpen(false);
      return;
    }

    const { event, formData: preparedForm } = pendingPayload;

    setSaving(true);
    setErrorMessage("");

    try {
      if (typeof onRegister === "function") {
        await onRegister(event, preparedForm);
      } else {
        console.warn(
          "onRegister callback not provided. Registration will not persist."
        );
      }

      // reset local state
      setSelectedEvent(null);
      setFormData({
        fullName: "",
        email: "",
        university: "",
        contact: "",
        notes: "",
      });
      setParticipantsCount(1);
      setTab("my");
    } catch (err) {
      console.error(err);
      setErrorMessage(
        "There was a problem submitting your registration. Please try again."
      );
      setConfirmOpen(false);
      return;
    } finally {
      setSaving(false);
      setPendingPayload(null);
    }

    setConfirmOpen(false);
  }

  function handleConfirmCancel() {
    if (saving) return;
    setConfirmOpen(false);
  }

  // ---------- Submit Paper handlers (LOCAL) ----------
  function handlePaperFormChange(e) {
    const { name, value } = e.target;
    setPaperForm((p) => ({ ...p, [name]: value }));
  }

  function handlePaperFileChange(e) {
    const file = e.target.files && e.target.files[0];
    setPaperFile(file || null);
    setPaperFileName(file ? file.name : "");
  }

  async function handlePaperSubmit(e) {
    e.preventDefault();
    setPaperError("");
    setPaperSuccess("");

    if (!paperForm.title) {
      setPaperError("Please enter a paper title.");
      return;
    }
    if (!paperFile) {
      setPaperError("Please attach a PDF file.");
      return;
    }
    if (paperFile && paperFile.type && paperFile.type !== "application/pdf") {
      setPaperError("File must be a PDF.");
      return;
    }

    setPaperSaving(true);

    const email = user?.email || "";
    const nowIso = new Date().toISOString();

    // Local “submission record”
    const localRow = normalizeSubmission({
      id: `${Date.now()}_${slugify(paperForm.title).slice(0, 24)}`,
      userEmail: email,
      title: paperForm.title,
      track: paperForm.track || "General Research",
      abstract: paperForm.abstract || "",
      status: "under_review",
      fileName: paperFile.name,
      submittedAt: nowIso,
    });

    try {
      if (typeof onSubmitPaper === "function") {
        const result = await onSubmitPaper({
          title: paperForm.title,
          track: paperForm.track,
          abstract: paperForm.abstract,
          file: paperFile,
          eventId: null,
          user,
        });

        if (result && typeof result === "object") {
          const normalized = normalizeSubmission(result);
          setSubmissions((prev) => [normalized, ...prev]);
        } else {
          setSubmissions((prev) => [localRow, ...prev]);
        }
      } else {
        setSubmissions((prev) => [localRow, ...prev]);
      }

      setPaperForm({ title: "", track: "General Research", abstract: "" });
      setPaperFile(null);
      setPaperFileName("");
      setPaperSuccess("Paper submitted! Status: under review.");
    } catch (err) {
      console.error(err);
      setPaperError("Failed to submit paper. Please try again.");
    } finally {
      setPaperSaving(false);
    }
  }

  const upcomingFiltered = filteredUpcoming();

  // shared “App.js-like” field styles
  const labelCls =
    "block mb-1 text-[10px] text-[rgba(11,23,53,.65)] font-extrabold uppercase tracking-widest";
  const inputCls =
    "w-full rounded-2xl border border-[rgba(11,23,53,.14)] bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[rgba(30,90,168,.22)]";
  const textareaCls =
    "w-full rounded-2xl border border-[rgba(11,23,53,.14)] bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[rgba(30,90,168,.22)]";
  const selectCls =
    "w-full rounded-2xl border border-[rgba(11,23,53,.14)] bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[rgba(30,90,168,.22)]";

  const btnGold =
    "px-4 py-2.5 rounded-2xl u-btn-gold text-[var(--u-navy)] text-sm font-extrabold shadow-card hover:opacity-[.98] hover:-translate-y-0.5 transition disabled:opacity-70";
  const btnOutline =
    "px-4 py-2.5 rounded-2xl u-btn-outline text-[var(--u-navy)] text-sm font-extrabold hover:-translate-y-0.5 transition disabled:opacity-70";
  const btnGrad =
    "px-4 py-2.5 rounded-2xl grad-btn text-white text-sm font-extrabold shadow-card hover:opacity-[.98] hover:-translate-y-0.5 transition disabled:opacity-70";

  return (
    <section className="relative px-4 py-10 max-w-7xl mx-auto">
      {/* Hero / stats */}
      <div className="relative mb-8 rounded-3xl overflow-hidden bg-brand text-white shadow-glow">
        <div className="absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_10%_10%,rgba(245,197,24,0.20),transparent_55%),radial-gradient(circle_at_90%_0,rgba(255,255,255,0.18),transparent_55%)]" />
        <div className="relative px-6 py-6 md:px-8 md:py-7 flex flex-col md:flex-row md:items-center md:justify-between gap-5">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/70 mb-1 font-extrabold">
              Participant dashboard
            </p>
            <h1 className="text-2xl sm:text-3xl font-black truncate">
              Hello, {user?.name || "Participant"} 👋
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-white/85 max-w-xl">
              Discover campus research events, reserve your slot, and submit your paper when ready.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            {/* Submit Paper button */}
            <button
              type="button"
              onClick={() => setTab("submit")}
              className={classNames(btnGold, "w-full sm:w-auto")}
            >
              Submit Paper
            </button>

            <div className="flex gap-3 text-xs sm:text-sm">
              <div className="bg-white/12 backdrop-blur-sm rounded-2xl px-4 py-3 min-w-[110px] border border-white/15">
                <div className="text-[11px] uppercase tracking-wide text-white/70 mb-1 font-extrabold">
                  Upcoming
                </div>
                <div className="text-lg font-black leading-tight">{upcomingCount}</div>
                <div className="text-[11px] text-white/80 font-extrabold">events</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl px-4 py-3 min-w-[110px] border border-white/12">
                <div className="text-[11px] uppercase tracking-wide text-white/70 mb-1 font-extrabold">
                  My spots
                </div>
                <div className="text-lg font-black leading-tight">{myCount}</div>
                <div className="text-[11px] text-white/80 font-extrabold">registrations</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl px-4 py-3 min-w-[110px] border border-white/12">
                <div className="text-[11px] uppercase tracking-wide text-white/70 mb-1 font-extrabold">
                  Papers
                </div>
                <div className="text-lg font-black leading-tight">{mySubmissions.length}</div>
                <div className="text-[11px] text-white/80 font-extrabold">submitted</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs + filters */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-full u-soft border border-[rgba(11,23,53,.10)] p-1 text-[11px] shadow-sm">
          {["upcoming", "my", "submit", "business_card"].map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={classNames(
                "px-4 py-2 rounded-full transition-all font-extrabold",
                tab === t
                  ? "bg-white shadow-card text-brand"
                  : "text-[rgba(11,23,53,.60)] hover:text-[var(--u-navy)]"
              )}
            >
              {t === "upcoming"
                ? "Upcoming events"
                : t === "my"
                ? "My registrations"
                : t === "submit"
                ? "Submit paper"
                : "My Business Card"}
            </button>
          ))}
        </div>

        {tab === "upcoming" && (
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="text-xs rounded-full border border-[rgba(11,23,53,.14)] px-4 py-2 bg-white text-[rgba(11,23,53,.78)] shadow-sm font-extrabold"
          >
            <option value="all">All types</option>
            <option value="conference">Conferences</option>
            <option value="forum">Forums</option>
            <option value="webinar">Webinars</option>
            <option value="hybrid">Hybrid</option>
            <option value="on-site">On-site</option>
            <option value="online">Online</option>
          </select>
        )}

        {tab === "submit" && (
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs rounded-full border border-[rgba(11,23,53,.14)] px-4 py-2 bg-white text-[rgba(11,23,53,.78)] shadow-sm font-extrabold"
          >
            <option value="all">All statuses</option>
            <option value="under_review">Under review</option>
            <option value="accepted">Accepted</option>
            <option value="rejected">Rejected</option>
          </select>
        )}
      </div>

      {/* UPCOMING EVENTS TAB */}
      {tab === "upcoming" && (
        <div className="space-y-4">
          {loading && (
            <div className="flex items-center gap-3 text-sm text-[rgba(11,23,53,.62)] font-extrabold">
              <div className="spinner" />
              Loading upcoming events…
            </div>
          )}

          {!loading && upcomingFiltered.length === 0 && (
            <div className="rounded-3xl border border-dashed border-[rgba(11,23,53,.18)] bg-white/80 p-6 text-sm text-[rgba(11,23,53,.62)] u-card">
              No upcoming events yet. Once your research office publishes events, they’ll appear here.
            </div>
          )}

          {!loading &&
            upcomingFiltered.map((event, idx) => (
              <div
                key={event.id}
                className={classNames(
                  "relative overflow-hidden rounded-3xl u-card p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4 transition-all duration-200",
                  animateUpcoming
                    ? "opacity-100 translate-y-0 scale-100"
                    : "opacity-0 translate-y-3 scale-95"
                )}
                style={{ transitionDelay: `${idx * 40}ms` }}
              >
                <div className="absolute inset-y-0 left-0 w-1 bg-[linear-gradient(180deg,var(--u-blue),var(--u-navy))]" />
                <div className="relative flex-1">
                  <h3 className="font-black text-brand mb-1">{event.title}</h3>
                  <p className="text-sm text-[rgba(11,23,53,.70)] mb-2">
                    {event.description}
                  </p>
                  <p className="text-xs text-[rgba(11,23,53,.62)] mb-2 font-extrabold">
                    📅 {formatDateRange(event.startDate, event.endDate)} • 📍 {event.location}
                  </p>
                  <p className="text-[11px] text-[rgba(11,23,53,.55)] font-extrabold">
                    Type: {event.type} • Mode: {event.mode}
                  </p>
                </div>

                <div className="relative flex flex-col items-stretch gap-2 w-full md:w-[240px]">
                  <button
                    type="button"
                    onClick={() => openRegisterModal(event)}
                    className={classNames(btnGrad, "w-full")}
                  >
                    Register for this event
                  </button>
                  <button
                    type="button"
                    onClick={() => onDownloadInvitation && onDownloadInvitation(event)}
                    className={classNames(btnOutline, "w-full")}
                  >
                    Download invitation
                  </button>
                </div>
              </div>
            ))}
        </div>
      )}

      {/* MY REGISTRATIONS TAB */}
      {tab === "my" && (
        <div className="space-y-4">
          {myEvents.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-[rgba(11,23,53,.18)] bg-white/80 p-6 text-sm text-[rgba(11,23,53,.62)] u-card">
              Once you register for an event, it will appear here.
            </div>
          ) : (
            myEvents.map((reg) => {
              const status = reg.status || "For approval";
              let badgeClass = "badge-soft badge-soft-amber";
              if (status === "Approved") badgeClass = "badge-soft badge-soft-green";
              else if (status === "Rejected") badgeClass = "badge-soft badge-soft-rose";

              return (
                <div
                  key={reg.id}
                  className="relative overflow-hidden rounded-3xl u-card p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                >
                  <div className="absolute inset-y-0 left-0 w-1 bg-[linear-gradient(180deg,rgba(16,185,129,.80),var(--u-blue))]" />
                  <div className="relative">
                    <h3 className="font-black text-brand mb-1">{reg.eventTitle}</h3>
                    <p className="text-xs text-[rgba(11,23,53,.62)] font-extrabold">
                      📅 {formatDateRange(reg.startDate, reg.endDate)} • 📍 {reg.location}
                    </p>
                    {reg.notes && (
                      <p className="mt-1 text-xs text-[rgba(11,23,53,.62)]">
                        Notes: {reg.notes}
                      </p>
                    )}
                  </div>
                  <div className="relative flex flex-col items-end gap-1 text-xs text-[rgba(11,23,53,.62)] font-extrabold">
                    <span className={badgeClass}>{status}</span>
                    <span>Registered as {user?.name || user?.email}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* SUBMIT PAPER TAB */}
      {tab === "submit" && (
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Left: Submit form */}
          <div className="lg:col-span-1">
            <div className="hover-card rounded-3xl u-card overflow-hidden">
              <div className="px-6 py-5 border-b border-[rgba(11,23,53,.08)] bg-[rgba(30,90,168,.04)]">
                <p className="text-[11px] uppercase tracking-[0.2em] text-[rgba(11,23,53,.55)] font-extrabold">
                  Paper submission
                </p>
                <h3 className="text-lg text-brand font-black mt-1">
                  Submit your research paper
                </h3>
                <p className="text-xs text-[rgba(11,23,53,.62)] mt-1">
                  Upload a PDF, choose a track, and we’ll mark it as <b>Under review</b>.
                </p>
              </div>

              <form onSubmit={handlePaperSubmit} className="px-6 py-5 space-y-3 text-sm">
                {paperError && (
                  <div className="rounded-2xl bg-rose-50 border border-rose-200 px-3 py-2 text-xs text-rose-700 font-extrabold">
                    {paperError}
                  </div>
                )}
                {paperSuccess && (
                  <div className="rounded-2xl bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-700 font-extrabold">
                    {paperSuccess}
                  </div>
                )}

                <div>
                  <label className={labelCls}>Paper title</label>
                  <input
                    type="text"
                    name="title"
                    value={paperForm.title}
                    onChange={handlePaperFormChange}
                    className={inputCls}
                    placeholder="e.g., Predictive Analytics for Academic Excellence"
                    required
                  />
                </div>

                <div>
                  <label className={labelCls}>Track</label>
                  <select
                    name="track"
                    value={paperForm.track}
                    onChange={handlePaperFormChange}
                    className={selectCls}
                  >
                    <option>General Research</option>
                    <option>AI / Data Science</option>
                    <option>Education</option>
                    <option>Health & Life Sciences</option>
                  </select>
                </div>

                <div>
                  <label className={labelCls}>Abstract</label>
                  <textarea
                    name="abstract"
                    value={paperForm.abstract}
                    onChange={handlePaperFormChange}
                    rows={4}
                    className={textareaCls}
                    placeholder="Paste a short abstract or summary of your study."
                  />
                </div>

                <div>
                  <label className={labelCls}>PDF file</label>
                  <label className="block w-full rounded-2xl border border-dashed border-[rgba(11,23,53,.20)] bg-[rgba(30,90,168,.05)] px-3 py-3 text-xs text-[rgba(11,23,53,.62)] cursor-pointer hover:bg-white hover:border-[rgba(11,23,53,.22)] transition font-extrabold">
                    <input
                      type="file"
                      accept="application/pdf"
                      className="hidden"
                      onChange={handlePaperFileChange}
                    />
                    {paperFileName ? (
                      <span>
                        <span className="font-black text-brand">{paperFileName}</span>
                        <span className="text-[rgba(11,23,53,.55)]"> (click to change)</span>
                      </span>
                    ) : (
                      <span>Click to upload PDF</span>
                    )}
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={paperSaving}
                  className={classNames(btnGold, "mt-2 w-full")}
                >
                  {paperSaving ? "Submitting..." : "Submit paper"}
                </button>

                <p className="text-[11px] text-[rgba(11,23,53,.55)] font-extrabold">
                  Tip: If you want this to persist, pass an <code>onSubmitPaper</code> callback and save to your backend.
                </p>
              </form>
            </div>
          </div>

          {/* Right: Status list */}
          <div className="lg:col-span-2">
            <div className="hover-card rounded-3xl u-card overflow-hidden">
              <div className="px-6 py-5 border-b border-[rgba(11,23,53,.08)] bg-[rgba(30,90,168,.04)] flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-[rgba(11,23,53,.55)] font-extrabold">
                    Submission status
                  </p>
                  <h3 className="text-lg text-brand font-black mt-1">
                    Your submitted papers
                  </h3>
                  <p className="text-xs text-[rgba(11,23,53,.62)] mt-1">
                    Filter by status using the dropdown above.
                  </p>
                </div>
                <div className="hidden sm:flex items-center gap-2 text-xs">
                  <span className="badge-soft badge-soft-amber">Under review</span>
                  <span className="badge-soft badge-soft-green">Accepted</span>
                  <span className="badge-soft badge-soft-rose">Rejected</span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <thead className="table-head">
                    <tr>
                      <th className="px-4 py-3 text-left font-extrabold text-[rgba(11,23,53,.60)] uppercase tracking-widest">
                        Title
                      </th>
                      <th className="px-4 py-3 text-left font-extrabold text-[rgba(11,23,53,.60)] uppercase tracking-widest">
                        Track
                      </th>
                      <th className="px-4 py-3 text-left font-extrabold text-[rgba(11,23,53,.60)] uppercase tracking-widest">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left font-extrabold text-[rgba(11,23,53,.60)] uppercase tracking-widest">
                        Submitted
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[rgba(11,23,53,.06)]">
                    {visibleSubmissions.map((s) => {
                      const status = s.status || "under_review";
                      let badgeClass = "badge-soft badge-soft-amber";
                      if (status === "accepted") badgeClass = "badge-soft badge-soft-green";
                      else if (status === "rejected") badgeClass = "badge-soft badge-soft-rose";

                      const submittedLabel = s.submittedAt
                        ? (() => {
                            try {
                              const d = new Date(s.submittedAt);
                              return isNaN(d.getTime()) ? "" : d.toLocaleString();
                            } catch {
                              return "";
                            }
                          })()
                        : "";

                      return (
                        <tr key={s.id} className="hover:bg-[rgba(30,90,168,.03)] transition">
                          <td className="px-4 py-3">
                            <div className="font-black text-[rgba(11,23,53,.88)]">{s.title}</div>
                            {s.fileName ? (
                              <div className="text-[11px] text-[rgba(11,23,53,.55)] font-extrabold">
                                {s.fileName}
                              </div>
                            ) : null}
                            {s.abstract ? (
                              <div className="mt-1 text-[11px] text-[rgba(11,23,53,.55)] line-clamp-2">
                                {s.abstract}
                              </div>
                            ) : null}
                          </td>
                          <td className="px-4 py-3 text-[rgba(11,23,53,.70)] font-extrabold">
                            {s.track}
                          </td>
                          <td className="px-4 py-3">
                            <span className={badgeClass}>
                              {String(status).replace("_", " ")}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-[rgba(11,23,53,.62)] font-extrabold">
                            {submittedLabel}
                          </td>
                        </tr>
                      );
                    })}

                    {visibleSubmissions.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-10 text-center text-[rgba(11,23,53,.62)] font-extrabold">
                          No submissions yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="px-6 py-4 bg-[rgba(30,90,168,.04)] text-[11px] text-[rgba(11,23,53,.62)] border-t border-[rgba(11,23,53,.08)] font-extrabold">
                Need approval workflows? You can update submission statuses (accepted/rejected) from an admin screen later.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MY BUSINESS CARD TAB */}
      {tab === "business_card" && (
        <div className="animate-fade-in-up">
          <EditBusinessCard user={user} onUpdateUser={onUpdateUser} />
        </div>
      )}

      {/* REGISTRATION MODAL */}
      {selectedEvent && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center px-4 py-8 bg-black/60 backdrop-blur-sm"
          onClick={closeRegisterModal}
        >
          <div
            className={classNames(
              "relative w-full max-w-5xl rounded-3xl u-card px-6 py-6 sm:px-8 sm:py-7 transform transition-all duration-200",
              modalVisible
                ? "opacity-100 scale-100 translate-y-0"
                : "opacity-0 scale-95 translate-y-2"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="min-w-0">
                <p className="text-[11px] text-[rgba(11,23,53,.55)] mb-1 font-extrabold uppercase tracking-widest">
                  Register for
                </p>
                <h3 className="text-xl md:text-2xl text-brand font-black truncate">
                  {selectedEvent.title}
                </h3>
                <p className="text-xs text-[rgba(11,23,53,.62)] mt-1 font-extrabold">
                  📅 {formatDateRange(selectedEvent.startDate, selectedEvent.endDate)} • 📍{" "}
                  {selectedEvent.location}
                </p>
              </div>
              <button
                type="button"
                onClick={closeRegisterModal}
                className="px-3 py-2 rounded-2xl u-btn-outline border border-[rgba(11,23,53,.14)] hover:opacity-95 transition text-sm font-extrabold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-[rgba(11,23,53,.62)] mb-4 font-extrabold">
              Fill out a few details so the organisers know who&apos;s attending.
            </p>

            {errorMessage && (
              <div className="mb-3 rounded-2xl bg-rose-50 border border-rose-200 px-3 py-2 text-xs text-rose-700 font-extrabold">
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
              <div>
                <label className={labelCls}>Full name</label>
                <input
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleRegistrationFieldChange}
                  className={inputCls}
                  placeholder="Juan Dela Cruz"
                  required
                />
              </div>

              <div>
                <label className={labelCls}>Email</label>
                <input
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleRegistrationFieldChange}
                  className={inputCls}
                  placeholder="you@email.com"
                  required
                />
              </div>

              <div>
                <label className={labelCls}>University</label>
                <input
                  name="university"
                  value={formData.university}
                  onChange={handleRegistrationFieldChange}
                  className={inputCls}
                  placeholder="AUP / DLSU / etc."
                />
              </div>

              <div>
                <label className={labelCls}>Contact</label>
                <input
                  name="contact"
                  value={formData.contact}
                  onChange={handleRegistrationFieldChange}
                  className={inputCls}
                  placeholder="+63 9xx xxx xxxx"
                />
              </div>

              <div className="md:col-span-2">
                <label className={labelCls}>Notes</label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleRegistrationFieldChange}
                  rows={3}
                  className={textareaCls}
                  placeholder="Anything the organisers should know?"
                />
              </div>

              <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-[rgba(11,23,53,.62)] font-extrabold">
                    Participants
                  </span>
                  <div className="inline-flex items-center rounded-2xl border border-[rgba(11,23,53,.14)] bg-white overflow-hidden">
                    <button
                      type="button"
                      onClick={decrementParticipants}
                      className="px-3 py-2 text-sm text-[rgba(11,23,53,.70)] hover:bg-[rgba(30,90,168,.06)] font-extrabold"
                      disabled={saving}
                    >
                      −
                    </button>
                    <span className="px-4 py-2 text-sm font-black text-[rgba(11,23,53,.88)]">
                      {participantsCount}
                    </span>
                    <button
                      type="button"
                      onClick={incrementParticipants}
                      className="px-3 py-2 text-sm text-[rgba(11,23,53,.70)] hover:bg-[rgba(30,90,168,.06)] font-extrabold"
                      disabled={saving}
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeRegisterModal}
                    className={classNames(btnOutline, "text-xs px-4 py-2")}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className={classNames(btnGold, "text-xs px-5 py-2")}
                    disabled={saving}
                  >
                    {saving ? "Submitting..." : "Confirm registration"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRMATION POP-UP */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl u-card p-6 text-sm">
            <h3 className="font-black text-base text-brand mb-2">Confirm registration</h3>
            <p className="text-xs text-[rgba(11,23,53,.62)] mb-2 font-extrabold">
              This action will submit your registration for approval by the organisers.
            </p>

            <div className="mb-4 rounded-2xl bg-rose-50 border border-rose-200 px-3 py-2 text-xs text-rose-700 font-extrabold">
              Action is irreversible once submitted.
            </div>

            {pendingPayload ? (
              <div className="mb-4 rounded-2xl bg-[rgba(30,90,168,.05)] border border-[rgba(11,23,53,.10)] p-3 text-xs text-[rgba(11,23,53,.78)] font-extrabold">
                <div className="font-black text-brand">{pendingPayload.event?.title}</div>
                <div className="text-[rgba(11,23,53,.62)] mt-1">
                  {pendingPayload.formData?.fullName} • {pendingPayload.formData?.email}
                </div>
                <div className="text-[rgba(11,23,53,.62)] mt-1">
                  Participants: {pendingPayload.formData?.participantsCount || 1}
                </div>
              </div>
            ) : null}

            <div className="flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={handleConfirmCancel}
                className={classNames(btnOutline, "text-xs px-4 py-2")}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmProceed}
                className={classNames(btnGold, "text-xs px-5 py-2")}
                disabled={saving}
              >
                {saving ? "Submitting..." : "Proceed"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

window.ParticipantDashboard = ParticipantDashboard;