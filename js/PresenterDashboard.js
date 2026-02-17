// js/PresenterDashboard.js
// Uses your SQL table: public.paper_submissions
// Uploads PDF to Supabase Storage bucket: "papers"
// Browser/UMD setup required in HTML BEFORE this script:
//   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
//   <script>window.SUPABASE_PUBLISHABLE_KEY="sb_publishable_...";</script>
//
// IMPORTANT for your RLS policies to work:
// - user must be authenticated via Supabase Auth (auth.email() must exist).
// - If you are NOT using Supabase Auth yet, inserts/selects will fail due to RLS.

(function () {
  const { useState, useEffect } = React;

  const SUPABASE_URL = "https://afmvwhymdjatlaamxxqz.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY =
    (window && (window.SUPABASE_PUBLISHABLE_KEY || window.SUPABASE_ANON_KEY)) ||
    "sb_publishable_hx2yJG_QMt65JJzfEGqsoA_K94fF6l6";

  function getSupabaseClient() {
    try {
      if (window.__conexus_supabase) return window.__conexus_supabase;

      if (window.supabase && typeof window.supabase.createClient === "function") {
        window.__conexus_supabase = window.supabase.createClient(
          SUPABASE_URL,
          SUPABASE_PUBLISHABLE_KEY
        );
        return window.__conexus_supabase;
      }

      if (typeof window.createClient === "function") {
        window.__conexus_supabase = window.createClient(
          SUPABASE_URL,
          SUPABASE_PUBLISHABLE_KEY
        );
        return window.__conexus_supabase;
      }

      console.warn(
        "Supabase client not found. Load @supabase/supabase-js UMD before PresenterDashboard.js"
      );
      return null;
    } catch (e) {
      console.error("Failed to init Supabase", e);
      return null;
    }
  }

  // -------- Normalizers (so UI works with multiple schemas) ----------
  function normalizeEvent(row) {
    if (!row) return row;
    return {
      ...row,
      id: row.id,
      title: row.title || row.event_title || row.name || "",
      location: row.location || row.venue || "",
      track: row.track || row.event_track || "",
      description: row.description || row.long_description || "",
      shortDescription: row.short_description || row.shortDescription || "",
      date: row.date || row.event_date || row.start_date || row.starts_at || "",
      startDate: row.start_date || row.startDate || row.starts_at || null,
      endDate: row.end_date || row.endDate || row.ends_at || null,
    };
  }

  function normalizeRegistration(row) {
    if (!row) return row;
    return {
      ...row,
      id: row.id,
      eventId: row.event_id ?? row.eventId,
      eventTitle: row.event_title ?? row.eventTitle ?? row.event_name ?? row.eventName,
      userEmail: row.user_email ?? row.userEmail,
      contact: row.contact ?? row.phone ?? row.mobile ?? row.contactNumber,
      university: row.university ?? row.school ?? "",
      notes: row.notes ?? row.topic ?? "",
      participantsCount: row.participants_count ?? row.participantsCount ?? 1,
      status: row.status ?? "For approval",
      createdAt: row.created_at ?? row.createdAt ?? null,
    };
  }

  // THIS is the key change: align to public.paper_submissions columns
  function normalizeSubmission(row) {
    if (!row) return row;
    return {
      ...row,
      id: row.id,
      userEmail: row.user_email ?? row.userEmail, // table uses user_email
      eventId: row.event_id ?? row.eventId ?? null,
      title: row.title,
      track: row.track || "General Research",
      abstract: row.abstract || "",
      status: row.status || "under_review",
      filePath: row.file_path || "",
      fileName: row.file_name || "",
      submittedAt: row.submitted_at || row.created_at || null,
    };
  }

  function slugify(s) {
    return String(s || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }

  // ===================================================================
  // PresenterDashboard Component
  // ===================================================================
  function PresenterDashboard({
    user,
    events: eventsProp,
    registrations: regsProp,
    submissions: subsProp,
    onRegisterForEvent, // from App (optional; we still call Supabase directly)
    onDownloadInvitation, // from App (optional)
    onSubmitPaper, // from App (optional; we still call Supabase directly)
    onLogout,
  }) {
    const [events, setEvents] = useState(Array.isArray(eventsProp) ? eventsProp : []);
    const [registrations, setRegistrations] = useState(
      Array.isArray(regsProp) ? regsProp : []
    );

    // keep prop name "submissions" but store paper_submissions rows
    const [submissions, setSubmissions] = useState(
      Array.isArray(subsProp) ? subsProp : []
    );

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [tab, setTab] = useState("events"); // 'events' | 'submissions'
    const [search, setSearch] = useState("");
    const [selectedEvent, setSelectedEvent] = useState(null);

    const [eventForm, setEventForm] = useState({
      contactNumber: "",
      university: user.university || "",
      notes: "",
    });

    const [paperForm, setPaperForm] = useState({
      title: "",
      track: "General Research",
      abstract: "",
      // Optional future wiring:
      // eventId: ""  // if you later want paper tied to an event
    });

    const [paperFile, setPaperFile] = useState(null);
    const [fileName, setFileName] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");

    // ---------- Supabase fetch ----------
    useEffect(() => {
      let cancelled = false;
      const supabase = getSupabaseClient();

      async function loadAll() {
        try {
          setLoading(true);
          setError(null);

          if (!supabase) {
            setLoading(false);
            return;
          }

          // events
          const { data: evRows, error: evErr } = await supabase
            .from("events")
            .select("*")
            .order("created_at", { ascending: false });

          if (evErr) throw evErr;

          // registrations (only for this user)
          const { data: regRows, error: regErr } = await supabase
            .from("registrations")
            .select("*")
            .eq("user_email", user.email)
            .order("created_at", { ascending: false });

          if (regErr) throw regErr;

          // paper submissions (only for this user) — TABLE NAME MATCHES YOUR SQL
          const { data: subRows, error: subErr } = await supabase
            .from("paper_submissions")
            .select("*")
            .eq("user_email", user.email)
            .order("submitted_at", { ascending: false });

          if (subErr) throw subErr;

          if (!cancelled) {
            setEvents((evRows || []).map(normalizeEvent));
            setRegistrations((regRows || []).map(normalizeRegistration));
            setSubmissions((subRows || []).map(normalizeSubmission));
          }
        } catch (e) {
          if (!cancelled) setError(e);
        } finally {
          if (!cancelled) setLoading(false);
        }
      }

      loadAll();

      // optional realtime (best effort)
      let chEvents, chRegs, chSubs;
      try {
        if (supabase && supabase.channel) {
          chEvents = supabase
            .channel("rt_events_presenter")
            .on(
              "postgres_changes",
              { event: "*", schema: "public", table: "events" },
              (payload) => {
                setEvents((prev) => {
                  const next = [...prev];
                  if (payload.eventType === "DELETE") {
                    return next.filter((x) => x.id !== payload.old.id);
                  }
                  const row = normalizeEvent(payload.new);
                  const idx = next.findIndex((x) => x.id === row.id);
                  if (idx >= 0) next[idx] = { ...next[idx], ...row };
                  else next.unshift(row);
                  return next;
                });
              }
            )
            .subscribe();

          chRegs = supabase
            .channel("rt_regs_presenter")
            .on(
              "postgres_changes",
              {
                event: "*",
                schema: "public",
                table: "registrations",
                filter: `user_email=eq.${user.email}`,
              },
              (payload) => {
                setRegistrations((prev) => {
                  const next = [...prev];
                  if (payload.eventType === "DELETE") {
                    return next.filter((x) => x.id !== payload.old.id);
                  }
                  const row = normalizeRegistration(payload.new);
                  const idx = next.findIndex((x) => x.id === row.id);
                  if (idx >= 0) next[idx] = { ...next[idx], ...row };
                  else next.unshift(row);
                  return next;
                });
              }
            )
            .subscribe();

          chSubs = supabase
            .channel("rt_paper_subs_presenter")
            .on(
              "postgres_changes",
              {
                event: "*",
                schema: "public",
                table: "paper_submissions",
                filter: `user_email=eq.${user.email}`,
              },
              (payload) => {
                setSubmissions((prev) => {
                  const next = [...prev];
                  if (payload.eventType === "DELETE") {
                    return next.filter((x) => x.id !== payload.old.id);
                  }
                  const row = normalizeSubmission(payload.new);
                  const idx = next.findIndex((x) => x.id === row.id);
                  if (idx >= 0) next[idx] = { ...next[idx], ...row };
                  else next.unshift(row);
                  return next;
                });
              }
            )
            .subscribe();
        }
      } catch {
        // ignore
      }

      return () => {
        cancelled = true;
        try {
          if (supabase && supabase.removeChannel) {
            if (chEvents) supabase.removeChannel(chEvents);
            if (chRegs) supabase.removeChannel(chRegs);
            if (chSubs) supabase.removeChannel(chSubs);
          }
        } catch {
          // ignore
        }
      };
    }, [user.email]);

    // -------- Derived ----------
    const myEventIds = new Set(
      registrations
        .filter((r) => (r.userEmail || "") === user.email)
        .map((r) => r.eventId)
    );

    const myEvents = events.filter((evt) => myEventIds.has(evt.id));

    const filteredEvents = events.filter((evt) =>
      (String(evt.title || "") + String(evt.location || "") + String(evt.track || ""))
        .toLowerCase()
        .includes(search.toLowerCase())
    );

    const mySubmissions = submissions.filter((s) => s.userEmail === user.email);
    const visibleSubmissions =
      statusFilter === "all"
        ? mySubmissions
        : mySubmissions.filter(
            (s) => (s.status || "under_review") === statusFilter
          );

    // -------- event registration handlers ----------
    const handleEventFormChange = (e) => {
      const { name, value } = e.target;
      setEventForm((prev) => ({ ...prev, [name]: value }));
    };

    async function supabaseRegisterForEvent(eventObj, payload) {
      const supabase = getSupabaseClient();
      if (!supabase) throw new Error("Supabase not initialized");

      if (typeof onRegisterForEvent === "function") {
        try {
          onRegisterForEvent(eventObj, payload);
        } catch {
          // ignore
        }
      }

      const row = {
        event_id: eventObj.id,
        event_title: eventObj.title,
        user_email: user.email,
        contact: payload.contact,
        university: payload.university,
        notes: payload.notes,
        participants_count: payload.participantsCount || 1,
        status: "For approval",
        created_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from("registrations")
        .insert(row)
        .select("*")
        .single();

      if (error) throw error;

      setRegistrations((prev) => [normalizeRegistration(data), ...prev]);
    }

    const handleRegisterForEventSubmit = async (e) => {
      e.preventDefault();
      if (!selectedEvent) return;

      try {
        await supabaseRegisterForEvent(selectedEvent, {
          contact: eventForm.contactNumber,
          university: eventForm.university,
          notes: eventForm.notes,
          participantsCount: 1,
        });

        setEventForm({
          contactNumber: "",
          university: user.university || "",
          notes: "",
        });
        setSelectedEvent(null);
      } catch (e2) {
        console.error(e2);
        alert(
          "Failed to register. If you enabled RLS, make sure the user is authenticated in Supabase Auth."
        );
      }
    };

    // -------- paper submission handlers ----------
    const handlePaperFormChange = (e) => {
      const { name, value } = e.target;
      setPaperForm((prev) => ({ ...prev, [name]: value }));
    };

    const handleFileChange = (e) => {
      const file = e.target.files && e.target.files[0];
      setPaperFile(file || null);
      setFileName(file ? file.name : "");
    };

    async function supabaseSubmitPaper({ title, track, abstract, file, eventId }) {
      const supabase = getSupabaseClient();
      if (!supabase) throw new Error("Supabase not initialized");

      if (typeof onSubmitPaper === "function") {
        try {
          await onSubmitPaper({ title, track, abstract, file, eventId });
        } catch {
          // ignore
        }
      }

      // 1) Upload to Storage
      const bucket = "papers";
      const ext = (file && file.name && file.name.split(".").pop()) || "pdf";
      const safeTitle = slugify(title).slice(0, 60) || "paper";
      const path = `papers/${user.email}/${Date.now()}_${safeTitle}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from(bucket)
        .upload(path, file, { contentType: file.type || "application/pdf" });

      if (upErr) throw upErr;

      // 2) Insert row into public.paper_submissions (matches your SQL)
      const row = {
        user_email: user.email,
        event_id: eventId || null,
        title: title,
        track: track || "General Research",
        abstract: abstract || null,
        file_path: path,
        file_name: file.name,
        // status and submitted_at are defaults in your SQL, but it's fine to omit:
        // status: "under_review",
        // submitted_at: new Date().toISOString(),
      };

      const { data, error: insErr } = await supabase
        .from("paper_submissions")
        .insert(row)
        .select("*")
        .single();

      if (insErr) throw insErr;

      setSubmissions((prev) => [normalizeSubmission(data), ...prev]);
    }

    const handlePaperSubmit = async (e) => {
      e.preventDefault();

      if (!paperForm.title || !paperFile) {
        alert("Please enter a title and attach your PDF paper.");
        return;
      }

      try {
        await supabaseSubmitPaper({
          title: paperForm.title,
          track: paperForm.track,
          abstract: paperForm.abstract,
          file: paperFile,
          eventId: null, // keep null per your current UI
        });

        setPaperForm({
          title: "",
          track: "General Research",
          abstract: "",
        });
        setPaperFile(null);
        setFileName("");
      } catch (e2) {
        console.error(e2);
        alert(
          "Failed to submit paper. Check: (1) user authenticated (RLS), (2) Storage bucket 'papers' exists, (3) Storage policies allow upload for logged-in users."
        );
      }
    };

    // -------- invitation download ----------
    async function supabaseDownloadInvitation(eventObj) {
      if (typeof onDownloadInvitation === "function") {
        try {
          await onDownloadInvitation(eventObj);
          return;
        } catch {
          // fallthrough
        }
      }

      alert(
        "Invitation download is not configured yet. If you store invites in Storage, add an 'invite_path' column to events and download it here."
      );
    }

    return (
      <div className="min-h-screen flex flex-col">
        {/* Top nav */}
        <header className="px-6 lg:px-12 py-4 flex items-center justify-between border-b border-slate-800 bg-slate-950/80 backdrop-blur">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-2xl bg-gradient-to-tr from-brandAccent to-brandPink flex items-center justify-center text-xs font-bold">
              CX
            </div>
            <div>
              <div className="text-sm font-semibold">Conexus</div>
              <div className="text-[10px] text-slate-400">Presenter Dashboard</div>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="hidden sm:inline text-slate-300">
              Hi, <span className="font-semibold">{user.name}</span>
            </span>
            <details className="group relative">
              <summary className="list-none flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/80 border border-slate-700 cursor-pointer text-slate-200">
                <span className="h-6 w-6 rounded-full bg-gradient-to-tr from-brandTeal to-brandPink text-[11px] flex items-center justify-center font-semibold">
                  {user.name?.[0] || "U"}
                </span>
                <span className="hidden sm:inline">{user.email}</span>
                <span className="text-xs text-slate-400">▼</span>
              </summary>
              <div className="absolute right-0 mt-2 w-44 rounded-2xl bg-slate-900 border border-slate-700 shadow-xl z-10">
                <button className="w-full text-left text-xs px-3 py-2 hover:bg-slate-800 rounded-t-2xl">
                  Profile (soon)
                </button>
                <button
                  onClick={onLogout}
                  className="w-full text-left text-xs px-3 py-2 hover:bg-slate-800 rounded-b-2xl text-red-300"
                >
                  Logout
                </button>
              </div>
            </details>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 px-6 lg:px-12 py-6">
          {loading ? (
            <div className="rounded-2xl bg-slate-900/70 border border-slate-800 p-4 text-xs text-slate-300">
              Loading from Supabase…
            </div>
          ) : error ? (
            <div className="rounded-2xl bg-slate-900/70 border border-red-500/40 p-4 text-xs text-red-200">
              Failed to load from Supabase: {String(error.message || error)}
            </div>
          ) : null}

          {window.Breadcrumb ? (
            <window.Breadcrumb
              items={[
                { label: "Home", active: false },
                { label: "Dashboard", active: false },
                { label: "Presenter", active: true },
              ]}
            />
          ) : null}

          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left column */}
            <div className="lg:w-1/3 space-y-4">
              <h2 className="text-lg font-semibold mb-2">Overview</h2>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 rounded-2xl bg-gradient-to-br from-brandAccent to-brandPink p-4 text-xs text-white shadow-lg">
                  <div className="text-[11px] uppercase tracking-wide mb-1">
                    Submission summary
                  </div>
                  <div className="text-sm font-semibold">
                    {mySubmissions.length} paper
                    {mySubmissions.length !== 1 ? "s" : ""} submitted
                  </div>
                </div>
                <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-3 text-xs">
                  <div className="text-slate-400 text-[11px]">Registered events</div>
                  <div className="text-lg font-bold">{myEvents.length || 0}</div>
                </div>
                <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-3 text-xs">
                  <div className="text-slate-400 text-[11px]">Role</div>
                  <div className="text-sm font-semibold capitalize">{user.role}</div>
                </div>
              </div>

              {/* Simple tabs */}
              <div className="inline-flex rounded-full bg-slate-900/60 border border-slate-700 p-0.5 text-[11px]">
                {["events", "submissions"].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setTab(value)}
                    className={
                      "px-3.5 py-1.5 rounded-full transition-all " +
                      (tab === value
                        ? "bg-white text-slate-900"
                        : "text-slate-300 hover:text-white")
                    }
                  >
                    {value === "events" ? "Events" : "Paper submissions"}
                  </button>
                ))}
              </div>
            </div>

            {/* Right column */}
            <div className="lg:w-2/3 space-y-6">
              {tab === "events" ? (
                <>
                  {/* Events list */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search events…"
                      className="w-full sm:w-60 rounded-2xl bg-slate-950/70 border border-slate-700 px-3 py-2 text-xs focus:border-brandAccent"
                    />
                  </div>
                  <div className="space-y-3">
                    {filteredEvents.map((evt) => (
                      <div
                        key={evt.id}
                        className="rounded-2xl bg-slate-900/60 border border-slate-800 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div>
                          <div className="text-sm font-semibold">{evt.title}</div>
                          <div className="text-[11px] text-slate-400">
                            {evt.date || ""} {evt.date && "•"} {evt.location}
                          </div>
                          <div className="mt-1 text-xs text-slate-300">
                            {evt.shortDescription || evt.description}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <span className="inline-flex items-center px-3 py-1 rounded-full bg-slate-950/80 border border-slate-700 text-[11px] text-slate-200">
                            {evt.track || "General track"}
                          </span>
                          <button
                            onClick={() => setSelectedEvent(evt)}
                            className="text-xs px-3 py-1.5 rounded-2xl bg-white text-slate-900 font-semibold hover:bg-brandAccent hover:text-white transition"
                          >
                            Register as presenter
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* My events + invite */}
                  <div className="mt-4">
                    <h3 className="text-sm font-semibold mb-2">
                      Events you&apos;re registered in
                    </h3>
                    <div className="space-y-3">
                      {myEvents.map((evt) => (
                        <div
                          key={evt.id}
                          className="rounded-2xl bg-slate-900/60 border border-slate-800 p-3 flex items-center justify-between gap-3 text-xs"
                        >
                          <div>
                            <div className="font-semibold">{evt.title}</div>
                            <div className="text-[11px] text-slate-400">
                              {evt.date || ""} {evt.date && "•"} {evt.location}
                            </div>
                          </div>
                          <button
                            onClick={() => supabaseDownloadInvitation(evt)}
                            className="px-3 py-1.5 rounded-2xl border border-brandAccent text-brandAccent hover:bg-brandAccent hover:text-white transition"
                          >
                            Download Invitation PDF
                          </button>
                        </div>
                      ))}
                      {myEvents.length === 0 && (
                        <p className="text-xs text-slate-400">
                          You are not registered to any events yet.
                        </p>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* Paper submission UI */}
                  <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-5 space-y-4">
                    <h3 className="text-sm font-semibold mb-1">Submit a paper</h3>
                    <form className="space-y-3 text-xs" onSubmit={handlePaperSubmit}>
                      <div>
                        <label className="block mb-1 text-slate-200">Paper title</label>
                        <input
                          type="text"
                          name="title"
                          value={paperForm.title}
                          onChange={handlePaperFormChange}
                          required
                          className="w-full rounded-2xl bg-slate-950/70 border border-slate-700 px-3 py-2 focus:border-brandAccent"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block mb-1 text-slate-200">Track</label>
                          <select
                            name="track"
                            value={paperForm.track}
                            onChange={handlePaperFormChange}
                            className="w-full rounded-2xl bg-slate-950/70 border border-slate-700 px-3 py-2 focus:border-brandAccent"
                          >
                            <option>General Research</option>
                            <option>AI / Data Science</option>
                            <option>Education</option>
                            <option>Health & Life Sciences</option>
                          </select>
                        </div>
                        <div>
                          <label className="block mb-1 text-slate-200">Attached file</label>
                          <label className="flex items-center justify-center w-full h-10 rounded-2xl border border-dashed border-slate-600 bg-slate-950/60 text-[11px] text-slate-300 cursor-pointer hover:border-brandAccent hover:bg-slate-900/80 transition">
                            <input
                              type="file"
                              accept="application/pdf"
                              className="hidden"
                              onChange={handleFileChange}
                            />
                            {fileName ? fileName : "Drag & drop or click to upload PDF"}
                          </label>
                        </div>
                      </div>
                      <div>
                        <label className="block mb-1 text-slate-200">
                          Short abstract (optional)
                        </label>
                        <textarea
                          name="abstract"
                          value={paperForm.abstract}
                          onChange={handlePaperFormChange}
                          rows={3}
                          className="w-full rounded-2xl bg-slate-950/70 border border-slate-700 px-3 py-2 focus:border-brandAccent"
                          placeholder="Paste your abstract here or a brief description of your study."
                        />
                      </div>
                      <button
                        type="submit"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-brandAccent text-white font-semibold hover:bg-brandPink transition"
                      >
                        Submit paper
                      </button>
                    </form>
                  </div>

                  {/* Submissions table */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-semibold">Submission status</h3>
                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="rounded-2xl bg-slate-950/70 border border-slate-700 px-3 py-1.5 text-xs focus:border-brandAccent"
                      >
                        <option value="all">All statuses</option>
                        <option value="under_review">Under review</option>
                        <option value="accepted">Accepted</option>
                        <option value="rejected">Rejected</option>
                      </select>
                    </div>
                    <div className="overflow-hidden rounded-2xl border border-slate-800 text-xs">
                      <table className="w-full border-collapse">
                        <thead className="bg-slate-900/80">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium text-slate-300">
                              Title
                            </th>
                            <th className="px-3 py-2 text-left font-medium text-slate-300">
                              Track
                            </th>
                            <th className="px-3 py-2 text-left font-medium text-slate-300">
                              Status
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {visibleSubmissions.map((s) => {
                            const rawStatus = s.status || "under_review";
                            const statusValue =
                              rawStatus === "accepted" ||
                              rawStatus === "rejected" ||
                              rawStatus === "under_review"
                                ? rawStatus
                                : "under_review";

                            const fileLabel = s.fileName || s.file_name || "";

                            return (
                              <tr key={s.id} className="border-t border-slate-800">
                                <td className="px-3 py-2">
                                  <div className="font-semibold text-slate-100">
                                    {s.title}
                                  </div>
                                  <div className="text-[11px] text-slate-400">
                                    {fileLabel}
                                  </div>
                                </td>
                                <td className="px-3 py-2">{s.track}</td>
                                <td className="px-3 py-2">
                                  <span
                                    className={
                                      "px-2 py-1 rounded-full text-[11px] " +
                                      (statusValue === "accepted"
                                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/50"
                                        : statusValue === "rejected"
                                        ? "bg-red-500/20 text-red-300 border border-red-500/50"
                                        : "bg-yellow-500/10 text-yellow-200 border border-yellow-500/40")
                                    }
                                  >
                                    {statusValue.replace("_", " ")}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                          {visibleSubmissions.length === 0 && (
                            <tr>
                              <td
                                colSpan={3}
                                className="px-3 py-3 text-center text-slate-400"
                              >
                                No submissions yet.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Registration drawer */}
          {selectedEvent && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end justify-center z-40">
              <div className="w-full max-w-lg bg-slate-950 border border-slate-800 rounded-t-3xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">
                    Register as presenter for {selectedEvent.title}
                  </h3>
                  <button
                    onClick={() => setSelectedEvent(null)}
                    className="text-xs text-slate-400 hover:text-white"
                  >
                    ✕
                  </button>
                </div>
                <form className="space-y-3 text-xs" onSubmit={handleRegisterForEventSubmit}>
                  <div>
                    <label className="block mb-1 text-slate-200">Contact number</label>
                    <input
                      type="text"
                      name="contactNumber"
                      value={eventForm.contactNumber}
                      onChange={handleEventFormChange}
                      required
                      className="w-full rounded-2xl bg-slate-900/80 border border-slate-700 px-3 py-2 focus:border-brandAccent"
                    />
                  </div>
                  <div>
                    <label className="block mb-1 text-slate-200">University</label>
                    <input
                      type="text"
                      name="university"
                      value={eventForm.university}
                      onChange={handleEventFormChange}
                      className="w-full rounded-2xl bg-slate-900/80 border border-slate-700 px-3 py-2 focus:border-brandAccent"
                    />
                  </div>
                  <div>
                    <label className="block mb-1 text-slate-200">
                      Tentative paper title / topic
                    </label>
                    <textarea
                      name="notes"
                      value={eventForm.notes}
                      onChange={handleEventFormChange}
                      rows={3}
                      className="w-full rounded-2xl bg-slate-900/80 border border-slate-700 px-3 py-2 focus:border-brandAccent"
                      placeholder="Example: LLM-powered analytics for academic conferences"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setSelectedEvent(null)}
                      className="px-3 py-1.5 rounded-2xl text-slate-300 border border-slate-700"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 rounded-2xl bg-brandAccent text-white font-semibold hover:bg-brandPink transition"
                    >
                      Confirm registration
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </main>
      </div>
    );
  }

  window.PresenterDashboard = PresenterDashboard;
})();
