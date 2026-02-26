// js/AttendancePortal.js
(function () {
  const { useState, useEffect, useRef } = React;

  // --- Helpers ---
  function getQueryParam(name) {
    const params = new URLSearchParams(window.location.search);
    return params.get(name);
  }

  function statusLabel(status) {
    if (status === "success") return "CHECK-IN RECORDED";
    if (status === "repeat") return "ALREADY CHECKED IN";
    if (status === "not_approved") return "NOT APPROVED";
    if (status === "wrong_event") return "NOT REGISTERED ON THIS EVENT"; // <-- ADDED THIS
    return "NOT FOUND";
}

  function statusTagClass(status) {
    if (status === "success") return "bg-emerald-500/10 border border-emerald-400/40 text-emerald-200";
    if (status === "repeat") return "bg-amber-500/10 border border-amber-400/40 text-amber-200";
    if (status === "not_approved") return "bg-sky-500/10 border border-sky-400/40 text-sky-200";
    if (status === "wrong_event") return "bg-orange-500/10 border border-orange-400/40 text-orange-200"; // <-- ADDED THIS
    return "bg-rose-500/10 border border-rose-400/40 text-rose-200";
}

  // --- Main App ---
  function AttendancePortalApp() {
    const [scanInput, setScanInput] = useState("");
    const [lastResult, setLastResult] = useState(null);
    const [portalData, setPortalData] = useState(null);
    
    // 1. NEW: Loading state for instant feedback
    const [isScanning, setIsScanning] = useState(false);
    
    const inputRef = useRef(null);

    // Load Context from LocalStorage
    useEffect(() => {
        const portalId = getQueryParam("portal");
        if (portalId) {
            const raw = window.localStorage.getItem("conexus_portal_" + portalId);
            if (raw) setPortalData(JSON.parse(raw));
        }
        if (inputRef.current) inputRef.current.focus();
    }, []);

    // Keep focus on input so you can scan repeatedly
    useEffect(() => {
        const interval = setInterval(() => {
            if (inputRef.current && document.activeElement !== inputRef.current) {
                inputRef.current.focus();
            }
        }, 2000);
        return () => clearInterval(interval);
    }, []);

    // Handle Scan
    async function handleSubmit(e) {
        e.preventDefault();
        const code = scanInput.trim();
        if (!code) return;

        const portalId = getQueryParam("portal");

        // 2. NEW: Immediate Feedback
        setIsScanning(true); 
        
        try {
            // IMPORTANT: Use localhost for testing, change to Railway URL for production
            // const API_URL = 'https://conexus-backend-production.up.railway.app/api/attendance/scan';
            const API_URL = 'https://conexus-backend-production.up.railway.app/api/attendance/scan';

            const res = await fetch(API_URL, {
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
                setLastResult({
                    status: data.status || 'not_found', 
                    displayName: data.name || "Unknown",
                    code: code,
                    time: new Date().toLocaleTimeString()
                });
            }

        } catch (err) {
            console.error("Scan Error:", err);
            alert("Network Error: Is the server running?");
        } finally {
            // 3. Reset UI
            setIsScanning(false);
            setScanInput(""); 
            if(inputRef.current) inputRef.current.focus();
        }
    }

    if (!portalData) {
        return <div className="text-white text-center p-10 font-mono animate-pulse">Initializing Portal...</div>;
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
          </div>
          <button onClick={() => window.close()} className="text-xs px-3 py-1.5 rounded-full bg-white/10 border border-white/15 text-white/85 hover:bg-white/20 transition">Close</button>
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
                  className="flex-1 rounded-2xl bg-white/5 border border-white/15 px-4 py-3 text-sm text-white placeholder:text-white/35 focus:outline-none focus:border-accent2/70 focus:ring-2 focus:ring-accent2/20 transition-all"
                  placeholder="Ready to scan..."
                  autoFocus
                  autoComplete="off"
                  disabled={isScanning} // Disable input while processing
                />
                <button type="submit" disabled={isScanning} className="px-5 py-3 rounded-2xl grad-btn text-white text-xs font-semibold border border-white/10 hover:opacity-95 disabled:opacity-50">
                    {isScanning ? "..." : "Check In"}
                </button>
              </div>
            </form>

            {/* Result Display Area */}
            <div className="rounded-2xl border border-white/12 bg-brand/30 p-6 md:p-8 min-h-[210px] flex items-center justify-center transition-all duration-300">
              
              {/* STATE 1: PROCESSING */}
              {isScanning ? (
                  <div className="text-center space-y-3 animate-pulse">
                      <div className="w-16 h-16 mx-auto border-4 border-accent2 border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-lg font-bold text-accent2">Verifying...</p>
                  </div>
              ) : 
              
              /* STATE 2: SHOW RESULT */
              lastResult ? (
                <div className="w-full max-w-2xl text-center space-y-3 animate-fade-in-up">
                  {lastResult.status === "success" && (
                    <div className="check-wrapper mx-auto mb-4"><div className="check-icon">✓</div></div>
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
              ) : 
              
              /* STATE 3: IDLE */
              (
                <div className="text-center max-w-md space-y-2">
                  <div className="text-4xl opacity-50 mb-2">📡</div>
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