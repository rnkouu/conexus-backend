// js/AttendancePortal.js
(function () {
  const { useState, useEffect, useRef } = React;

  // --- Helpers ---
  function getQueryParam(name) {
    const params = new URLSearchParams(window.location.search);
    return params.get(name);
  }

  function formatDateRange(start, end) {
    if (!start && !end) return "";
    try {
      const s = start ? new Date(start) : null;
      const e = end ? new Date(end) : null;
      if (s && e) {
        const sameMonth = s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear();
        const opts = { month: "short", day: "numeric" };
        const sPart = s.toLocaleDateString(undefined, opts);
        return sPart + " – " + e.getDate() + ", " + s.getFullYear();
      }
      return (s || e).toLocaleDateString();
    } catch { return ""; }
  }

  function statusLabel(status) {
    if (status === "success") return "CHECK-IN RECORDED";
    if (status === "repeat") return "ALREADY CHECKED IN";
    if (status === "not_approved") return "NOT APPROVED";
    return "NOT FOUND";
  }

  function statusTagClass(status) {
    if (status === "success") return "bg-emerald-500/10 border border-emerald-400/40 text-emerald-200";
    if (status === "repeat") return "bg-amber-500/10 border border-amber-400/40 text-amber-200";
    if (status === "not_approved") return "bg-sky-500/10 border border-sky-400/40 text-sky-200";
    return "bg-rose-500/10 border border-rose-400/40 text-rose-200";
  }

  // --- Main App ---
  function AttendancePortalApp() {
    const [scanInput, setScanInput] = useState("");
    const [lastResult, setLastResult] = useState(null);
    const [portalData, setPortalData] = useState(null);
    const inputRef = useRef(null);

    // Load Context from LocalStorage (Passed from Admin Dashboard)
    useEffect(() => {
        const portalId = getQueryParam("portal");
        if (portalId) {
            const raw = window.localStorage.getItem("conexus_portal_" + portalId);
            if (raw) setPortalData(JSON.parse(raw));
        }
        if (inputRef.current) inputRef.current.focus();
    }, []);

    // Handle Scan
    async function handleSubmit(e) {
        e.preventDefault();
        const code = scanInput.trim();
        if (!code) return;

        const portalId = getQueryParam("portal");

        try {
            // Send Scan to Node.js Server
            const res = await fetch('http://localhost:8000/api/attendance/scan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    portal_id: portalId, 
                    input_code: code 
                })
            });

            const data = await res.json();

            // Handle Response
            if (data.success) {
                setLastResult({
                    status: 'success',
                    displayName: data.name,
                    code: code,
                    time: new Date().toLocaleTimeString()
                });
            } else {
                // Handle Errors (Not found, Not approved, Repeat)
                setLastResult({
                    status: data.status || 'not_found', // 'not_found', 'not_approved', 'repeat'
                    displayName: data.name || "Unknown",
                    code: code,
                    time: new Date().toLocaleTimeString()
                });
            }

        } catch (err) {
            console.error("Scan Error:", err);
            alert("Network Error: Is the server running?");
        }

        setScanInput(""); // Clear for next scan
    }

    // Safety check if data is missing
    if (!portalData) {
        return <div className="text-white text-center p-10">Loading Portal Data...</div>;
    }

    const { portal, event } = portalData;

    return (
      <div className="relative text-white">
        {/* Header */}
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/60 mb-1">Attendance Portal</p>
            <h2 className="font-display text-2xl md:text-3xl font-semibold leading-tight">
              <span className="bg-gradient-to-r from-accent1 via-accent2 to-accent3 bg-clip-text text-transparent">
                {portal.name}
              </span>
            </h2>
            <p className="text-sm text-white/70 mt-1">{event.title}</p>
            <p className="text-[11px] text-white/55 mt-2 max-w-2xl">
              Keep this window focused. Scan an NFC card to check in automatically.
            </p>
          </div>
          <button onClick={() => window.close()} className="text-xs px-3 py-1.5 rounded-full bg-white/10 border border-white/15 text-white/85">Close</button>
        </div>

        {/* Scanner Card */}
        <div className="relative hover-card rounded-3xl border border-white/15 bg-white/10 backdrop-blur-xl shadow-2xl overflow-hidden">
          <div className="absolute inset-0 pointer-events-none opacity-60">
            <div className="portal-orb orb-1" />
            <div className="portal-orb orb-2" />
          </div>

          <div className="relative p-6 md:p-8 space-y-5">
            <form onSubmit={handleSubmit} className="space-y-2">
              <label className="block text-xs font-medium text-white/85">Scan NFC Card</label>
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  value={scanInput}
                  onChange={(e) => setScanInput(e.target.value)}
                  className="flex-1 rounded-2xl bg-white/5 border border-white/15 px-4 py-3 text-sm text-white placeholder:text-white/35 focus:outline-none focus:border-accent2/70 focus:ring-2 focus:ring-accent2/20"
                  placeholder="Ready to scan..."
                  autoFocus
                  autoComplete="off"
                />
                <button type="submit" className="px-5 py-3 rounded-2xl grad-btn text-white text-xs font-semibold border border-white/10 hover:opacity-95">Check In</button>
              </div>
            </form>

            {/* Result Display */}
            <div className="rounded-2xl border border-white/12 bg-brand/30 p-6 md:p-8 min-h-[210px] flex items-center justify-center">
              {lastResult ? (
                <div className="w-full max-w-2xl text-center space-y-3">
                  {lastResult.status === "success" && (
                    <div className="check-wrapper mx-auto"><div className="check-icon">✓</div></div>
                  )}
                  
                  <div className={"inline-flex items-center justify-center px-3 py-1.5 rounded-full text-[11px] font-medium uppercase tracking-[0.18em] " + statusTagClass(lastResult.status)}>
                    {statusLabel(lastResult.status)}
                  </div>

                  <div className="text-2xl md:text-3xl font-display font-semibold text-white">
                    {lastResult.displayName}
                  </div>

                  <div className="text-xs text-white/70">
                    Code: <span className="font-mono text-white/90">{lastResult.code}</span> • {lastResult.time}
                  </div>
                </div>
              ) : (
                <div className="text-center max-w-md space-y-2">
                  <p className="text-sm text-white/60">Waiting for scan...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Mount
  const rootEl = document.getElementById("portal-root");
  if (rootEl) {
    const root = ReactDOM.createRoot(rootEl);
    root.render(<AttendancePortalApp />);
  }
})();