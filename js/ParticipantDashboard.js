// js/ParticipantDashboard.js
(function(){
  // 1. Guard: Ensure React exists
  if (!window.React || !window.React.useState) {
    console.error("ParticipantDashboard: React not found.");
    return;
  }

  const { useState, useEffect } = window.React;

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
        const sameMonth = s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear();
        const opts = { month: "short", day: "numeric" };
        const sPart = s.toLocaleDateString(undefined, opts);
        const ePart = e.toLocaleDateString(undefined, opts);
        const year = s.getFullYear();
        return sameMonth ? `${sPart}–${e.getDate()}, ${year}` : `${sPart} – ${ePart}, ${year}`;
      }
      const d = validS ? s : validE ? e : null;
      return d ? d.toLocaleDateString() : "";
    } catch { return ""; }
  }

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
      filePath: row.file_path ?? row.filePath ?? "",
      submittedAt: row.submitted_at ?? row.submittedAt ?? row.created_at ?? row.createdAt ?? null,
    };
  }

  /* =========================================================
     CONEXUS UNIVERSITY THEME (Dashboard Integration)
     ========================================================= */
  (function injectDashboardUniversityStyles() {
    try {
      if (typeof document === "undefined") return;
      const ID = "participant-university-theme";
      if (document.getElementById(ID)) return;
      const style = document.createElement("style");
      style.id = ID;
      style.textContent = `
        .badge-academic {
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          padding: 4px 10px;
          border-radius: 6px;
        }
        .badge-academic-gold { background: var(--u-gold); color: var(--u-navy); }
        .badge-academic-blue { background: var(--u-sky); color: var(--u-blue); border: 1px solid rgba(30,90,168,.15); }
        
        .u-input-academic {
          width: 100%;
          padding: 10px 14px;
          border-radius: 12px;
          border: 1px solid var(--u-border);
          font-size: 14px;
          transition: all 0.2s ease;
          background: #fff;
        }
        .u-input-academic:focus {
          border-color: var(--u-blue);
          box-shadow: 0 0 0 4px rgba(30,90,168,.08);
          outline: none;
        }

        .table-academic thead {
          background: var(--u-sky);
          border-bottom: 2px solid var(--u-border);
        }
        .table-academic th {
          font-size: 11px;
          font-weight: 800;
          color: var(--u-navy);
          text-transform: uppercase;
          letter-spacing: 0.1em;
        }

        .status-dot {
          height: 8px; width: 8px; border-radius: 50%; display: inline-block; margin-right: 6px;
        }
        .bg-under_review { background: #f59e0b; }
        .bg-accepted { background: #10b981; }
        .bg-rejected { background: #ef4444; }

        /* --- NEW REGISTRATION TAB STYLES --- */
        .reg-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 1.5rem;
        }
        .reg-card {
          background: white;
          border: 1px solid rgba(0,0,0,0.05);
          transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          position: relative;
          display: flex;
          flex-direction: column;
        }
        .reg-card:hover {
          transform: translateY(-8px);
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
          border-color: var(--u-blue);
        }
        .status-pill {
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          padding: 6px 12px;
          border-radius: 99px;
          letter-spacing: 0.05em;
        }
        .status-Approved { background: #ecfdf5; color: #065f46; border: 1px solid #10b98133; }
        .status-Pending { background: #fffbeb; color: #92400e; border: 1px solid #f59e0b33; }
        .status-Rejected { background: #fef2f2; color: #991b1b; border: 1px solid #ef444433; }
      `;
      document.head.appendChild(style);
    } catch (e) {}
  })();

  // --- COMPONENT: REGISTRATION DETAILS MODAL ---
  function RegistrationDetailsModal({ reg, event, rooms = [], dorms = [], onClose }) {
    if (!reg) return null;
    
    // Construct image URL assuming backend is on port 8000
    const fileUrl = reg.validId ? `https://conexus-backend-production.up.railway.app/${reg.validId}` : null;
    const companions = Array.isArray(reg.companions) ? reg.companions : [];

    // --- ACCOMMODATION LOOKUP LOGIC ---
    let assignedRoomName = "";
    let assignedDormName = "";
    
    // Check both roomId and room_id just in case the frontend didn't normalize it
    const actualRoomId = reg.roomId || reg.room_id;

    if (actualRoomId) {
        const foundRoom = rooms.find(r => String(r.id) === String(actualRoomId));
        if (foundRoom) {
            assignedRoomName = `Room ${foundRoom.name}`;
            
            // Look up the Dorm/Hotel name
            const actualDormId = foundRoom.dormId || foundRoom.dorm_id;
            const foundDorm = dorms.find(d => String(d.id) === String(actualDormId));
            if (foundDorm) {
                assignedDormName = foundDorm.name;
            } else {
                assignedDormName = "Unknown Location";
            }
        } else {
            // Data is still loading from the API
            assignedRoomName = `Room ID: ${actualRoomId}`;
        }
    }

    return (
      <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/65 backdrop-blur-sm p-4 overflow-y-auto" onClick={onClose}>
        <div className="w-full max-w-lg animate-fade-in-up my-auto" onClick={e => e.stopPropagation()}>
          <div className="rounded-[2rem] overflow-hidden bg-white shadow-2xl border border-gray-100">
            {/* Header */}
            <div className="px-8 py-6 bg-[var(--u-navy)] text-white relative">
               <div className="absolute top-0 left-0 right-0 h-[3px] bg-[var(--u-gold)]" />
               <div className="flex justify-between items-start">
                 <div>
                   <h3 className="text-xl font-extrabold">Registration Details</h3>
                   <p className="text-xs text-white/70 mt-1">Ref: <span className="font-mono text-[var(--u-gold)]">{reg.id}</span></p>
                 </div>
                 <button onClick={onClose} className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition">✕</button>
               </div>
            </div>

            <div className="p-8 space-y-6">
               {/* Event Summary */}
               <div className="flex items-start justify-between gap-4">
                 <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Event</p>
                    <h4 className="text-lg font-bold text-brand leading-tight">{reg.eventTitle}</h4>
                    {event && (
                        <div className="mt-2 text-xs text-gray-600 space-y-1">
                            <p className="flex items-center gap-2">📅 <strong>{formatDateRange(event.startDate, event.endDate)}</strong></p>
                            <p className="flex items-center gap-2">📍 {event.location} ({event.mode})</p>
                        </div>
                    )}
                 </div>
                 <div className="text-right shrink-0">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Status</p>
                    <span className={classNames("badge-academic", reg.status === "Approved" ? "bg-emerald-100 text-emerald-700" : reg.status === "Rejected" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700")}>
                        {reg.status || "Pending"}
                    </span>
                 </div>
               </div>

               {/* --- NEW: ADMIN NOTE BLOCK --- */}
               {(reg.adminNote || reg.admin_note) && (
                   <div className="bg-red-50 p-4 rounded-xl border border-red-200">
                       <p className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-1">Message from Admin</p>
                       <p className="text-xs text-red-800 leading-relaxed font-medium">
                           {reg.adminNote || reg.admin_note}
                       </p>
                   </div>
               )}

               {/* --- ACCOMMODATION BLOCK --- */}
               <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex items-start gap-4">
                   <div className="text-2xl pt-1">🛏️</div>
                   <div>
                       <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">Assigned Accommodation</p>
                       {actualRoomId ? (
                           <>
                               <p className="text-sm font-bold text-gray-900">{assignedDormName}</p>
                               <p className="text-xs font-semibold text-blue-700">{assignedRoomName}</p>
                           </>
                       ) : (
                           <p className="text-xs text-gray-500 italic">No room assigned yet.</p>
                       )}
                   </div>
               </div>

               {/* Event Description */}
               {event?.description && (
                   <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                       <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Description</p>
                       <p className="text-xs text-gray-600 leading-relaxed line-clamp-3">
                           {event.description}
                       </p>
                   </div>
               )}

               {/* Valid ID Display */}
               <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Submitted ID</p>
                  {fileUrl ? (
                    <div className="w-full h-40 bg-gray-100 rounded-xl overflow-hidden border border-gray-200 relative group">
                        <img 
                            src={fileUrl} 
                            alt="Valid ID" 
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                            onError={(e) => {e.target.style.display='none'; e.target.nextSibling.style.display='flex'}} 
                        />
                        <div className="hidden absolute inset-0 items-center justify-center text-xs text-gray-400 font-bold">Preview not available</div>
                        <a href={fileUrl} target="_blank" className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-bold transition-all backdrop-blur-sm">
                            View Full Image ↗
                        </a>
                    </div>
                  ) : (
                    <div className="w-full h-24 bg-gray-50 rounded-xl border border-dashed border-gray-200 flex items-center justify-center text-xs text-gray-400 italic">
                        No ID uploaded.
                    </div>
                  )}
               </div>

               {/* Companions List */}
               {companions.length > 0 && (
                 <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Companions ({companions.length})</p>
                    <div className="space-y-2 max-h-32 overflow-y-auto pr-1 scrollbar-hide">
                        {companions.map((c, i) => (
                            <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                                <span className="text-xs font-bold text-gray-700">{c.name}</span>
                                <span className="text-[10px] font-bold text-blue-500 bg-blue-50 px-2 py-1 rounded">{c.relation || "Guest"}</span>
                            </div>
                        ))}
                    </div>
                 </div>
               )}

               <button onClick={onClose} className="w-full py-3 rounded-xl border border-gray-200 font-extrabold text-sm text-gray-600 hover:bg-gray-50 transition">
                 Close
               </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // CONFIGURATION
  // ==========================================
  const API_BASE = "https://conexus-backend-production.up.railway.app/api";
  
  const getAuthHeaders = () => {
    const token = localStorage.getItem('conexus_token');
    return {
      'Authorization': `Bearer ${token}`
    };
  };

  function ParticipantDashboard({
    user,
    events,
    loading,
    registrations,
    onRegister,
    onDownloadInvitation,
    submissions: submissionsProp,
    onSubmitPaper,
    onUpdateUser
  }) {
    const [tab, setTab] = useState("upcoming");
    const [filterType, setFilterType] = useState("all");
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [formData, setFormData] = useState({ firstName: "", lastName: "", middleName: "", gender: "", age: "", email: "", university: "", contact: "" });
    
    // --- Room & Dorm State (Fetched automatically now) ---
    const [localRooms, setLocalRooms] = useState([]);
    const [localDorms, setLocalDorms] = useState([]);
    const [liveRegs, setLiveRegs] = useState([]);

    // --- Registration States ---
    const [regRole, setRegRole] = useState('participant'); // NEW
    const [participantsCount, setParticipantsCount] = useState(1);
    const [companions, setCompanions] = useState([]); 
    const [selectedFile, setSelectedFile] = useState(null);
    const [paymentFile, setPaymentFile] = useState(null); 
    const [presentationFile, setPresentationFile] = useState(null); // NEW
    const [videoFile, setVideoFile] = useState(null); // NEW
    
    // --- View/Preview State ---
    const [previewReg, setPreviewReg] = useState(null);

    // --- Submission States ---
    const [saving, setSaving] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [pendingPayload, setPendingPayload] = useState(null);
    const [modalVisible, setModalVisible] = useState(false);
    const [animateUpcoming, setAnimateUpcoming] = useState(false);
    
    // --- Paper Submission States (UPDATED) ---
    const [paperForm, setPaperForm] = useState({ eventId: "", title: "", track: "General Research", abstract: "" });
    const [paperFile, setPaperFile] = useState(null);
    const [paperFileName, setPaperFileName] = useState("");
    const [paperSaving, setPaperSaving] = useState(false);
    const [paperSuccess, setPaperSuccess] = useState("");
    const [paperError, setPaperError] = useState("");
    
    const [statusFilter, setStatusFilter] = useState("all");
    const [submissions, setSubmissions] = useState(Array.isArray(submissionsProp) ? submissionsProp.map(normalizeSubmission) : []);

    // FETCH ACCOMMODATION DATA SO IT WORKS WITHOUT CHANGING APP.JS
    useEffect(() => {
      fetch(`${API_BASE}/dorms`, { headers: getAuthHeaders() })
        .then(r => r.ok ? r.json() : [])
        .then(data => setLocalDorms(Array.isArray(data) ? data : []))
        .catch(console.error);
        
      fetch(`${API_BASE}/rooms`, { headers: getAuthHeaders() })
        .then(r => r.ok ? r.json() : [])
        .then(data => setLocalRooms(Array.isArray(data) ? data : []))
        .catch(console.error);

      // Keep User Registrations in sync directly with Database
      const fetchLiveRegs = () => {
          fetch(`${API_BASE}/registrations`, { headers: getAuthHeaders() })
            .then(r => r.ok ? r.json() : [])
            .then(data => {
                if(Array.isArray(data) && user?.email) {
                    const myRawData = data.filter(d => String(d.user_email || d.userEmail).toLowerCase() === String(user.email).toLowerCase());
                    setLiveRegs(myRawData);
                }
            })
            .catch(console.error);
      };

      fetchLiveRegs();
      const interval = setInterval(fetchLiveRegs, 3000); 
      return () => clearInterval(interval);
    }, [user]);

    useEffect(() => {
      if (Array.isArray(submissionsProp)) setSubmissions(submissionsProp.map(normalizeSubmission));
    }, [submissionsProp]);

    useEffect(() => {
      let id;
      if (selectedEvent) { setModalVisible(false); id = setTimeout(() => setModalVisible(true), 10); } 
      else { setModalVisible(false); }
      return () => id && clearTimeout(id);
    }, [selectedEvent]);

    useEffect(() => {
      if (tab !== "upcoming") return;
      setAnimateUpcoming(false);
      setTimeout(() => setAnimateUpcoming(true), 10);
    }, [tab, events?.length]);

    const upcomingEvents = Array.isArray(events) ? events.filter((e) => !e.past) : [];
    
    // MERGE PROP DATA WITH LIVE DATA AND INCLUDE CERTIFICATE TIMESTAMP
    const baseEvents = Array.isArray(registrations) ? registrations : [];
    const myEvents = baseEvents.map(baseReg => {
        const liveMatch = liveRegs.find(live => String(live.id) === String(baseReg.id));
        return {
            ...baseReg,
            room_id: liveMatch?.room_id || liveMatch?.roomId || baseReg.roomId || baseReg.room_id || null,
            adminNote: liveMatch?.admin_note || baseReg.adminNote || null,
            status: liveMatch?.status || baseReg.status,
            certificate_issued_at: liveMatch?.certificate_issued_at || baseReg.certificate_issued_at || baseReg.certificateIssuedAt || null
        };
    });

    const mySubmissions = submissions.filter((s) => String(s.userEmail || "").toLowerCase() === String(user?.email || "").toLowerCase());
    const visibleSubmissions = statusFilter === "all" ? mySubmissions : mySubmissions.filter((s) => (s.status || "under_review") === statusFilter);

    const filteredUpcoming = () => {
      let list = upcomingEvents;
      if (filterType !== "all") {
        list = list.filter(e => String(e.mode || "").toLowerCase() === filterType.toLowerCase() || String(e.type || "").toLowerCase() === filterType.toLowerCase());
      }
      return list;
    };

    const openRegisterModal = (event) => {
      setSelectedEvent(event);
      setParticipantsCount(1);
      setCompanions([]); 
      setFormData({
        firstName: user?.name ? user.name.split(' ')[0] : "",
        lastName: user?.name ? user.name.split(' ').slice(1).join(' ') : "",
        middleName: "",
        gender: "",
        age: "",
        email: user?.email || "",
        university: user?.university || "",
        contact: user?.phone || ""
      });
      setSelectedFile(null);
      setPaymentFile(null); 
    };

    const incrementParticipants = () => {
      setParticipantsCount(prev => prev + 1);
      setCompanions(prev => [...prev, { name: "", relation: "", phone: "", email: "" }]);
    };

    const decrementParticipants = () => {
      if (participantsCount > 1) {
        setParticipantsCount(prev => prev - 1);
        setCompanions(prev => prev.slice(0, -1));
      }
    };

    const handleCompanionChange = (index, field, value) => {
      const updated = [...companions];
      updated[index] = { ...updated[index], [field]: value };
      setCompanions(updated);
    };

    const handleFinalRegistration = async () => {
      if (!selectedFile) {
          window.Swal.fire({ title: 'ID Required', text: 'Please upload a valid ID to proceed.', icon: 'warning', confirmButtonColor: '#1e5aa8' });
          return;
      }
      if (regRole === 'presenter' && (!presentationFile || !videoFile)) {
          window.Swal.fire({ title: 'Missing Files', text: 'Presenters must upload both a presentation file and a sample video.', icon: 'warning', confirmButtonColor: '#1e5aa8' });
          return;
      }

      setSaving(true);
      try {
          const payload = new FormData();
          payload.append('user_email', formData.email);
          payload.append('event_id', selectedEvent.id);
          payload.append('valid_id', selectedFile);
          payload.append('proof_of_payment', paymentFile); 
          payload.append('companions', JSON.stringify(companions)); 
          
          payload.append('reg_role', regRole);
          if (presentationFile) payload.append('presentation_file', presentationFile);
          if (videoFile) payload.append('video_file', videoFile);

          payload.append('first_name', formData.firstName);
          payload.append('last_name', formData.lastName);
          payload.append('middle_name', formData.middleName);
          payload.append('gender', formData.gender);
          payload.append('age', formData.age);
          payload.append('contact_number', formData.contact);

          const token = localStorage.getItem('conexus_token'); 

          const response = await fetch('https://conexus-backend-production.up.railway.app/api/register', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${token}` },
              body: payload, 
          });
          
          const data = await response.json();
          
          if (data.success) {
              window.Swal.fire({ title: 'Registration Submitted!', text: 'Please wait for admin approval.', icon: 'success', confirmButtonColor: '#1e5aa8' });
              setSelectedEvent(null); 
              setConfirmOpen(false);
              setTab("my");
              if(onRegister) onRegister(); 
          } else {
              window.Swal.fire({ title: 'Registration Failed', text: data.message || data.error, icon: 'error', confirmButtonColor: '#1e5aa8' });
          }
      } catch (error) {
          console.error("Error:", error);
          window.Swal.fire({ title: 'Network Error', text: 'Unable to connect to the server.', icon: 'error', confirmButtonColor: '#1e5aa8' });
      } finally {
          setSaving(false);
          setConfirmOpen(false);
      }
    };

    const handlePaperSubmit = async (e) => {
      e.preventDefault();
      if (!paperForm.title || !paperFile) { setPaperError("Title and PDF file required."); return; }
      setPaperSaving(true);
      setPaperError("");
      
      const localRow = normalizeSubmission({ 
        id: Date.now(), 
        userEmail: user?.email, 
        eventId: paperForm.eventId || null,
        title: paperForm.title, 
        track: paperForm.track, 
        status: "under_review", 
        fileName: paperFile.name, 
        submittedAt: new Date().toISOString() 
      });

      try {
        if (typeof onSubmitPaper === "function") {
          const result = await onSubmitPaper({ ...paperForm, file: paperFile, user });
          setSubmissions(prev => [normalizeSubmission(result || localRow), ...prev]);
        } else { 
          setSubmissions(prev => [localRow, ...prev]); 
        }
        setPaperForm({ eventId: "", title: "", track: "General Research", abstract: "" });
        setPaperFileName("");
        setPaperSuccess("Paper submitted successfully!");
        
        setTimeout(() => setPaperSuccess(""), 4000);
      } catch (err) { 
        setPaperError("Submission failed."); 
      } finally { 
        setPaperSaving(false); 
      }
    };

    // --- NEW: GENERATE & DOWNLOAD CERTIFICATE FUNCTION ---
    const handleDownloadCertificate = (reg) => {
        const printWindow = window.open('', '_blank');
        const issueDate = reg.certificate_issued_at ? new Date(reg.certificate_issued_at).toLocaleDateString() : new Date().toLocaleDateString();
        
        // NEW: Generate verification QR code dynamically
        const verifyUrl = `https://cconexus.vercel.app/?verify=${reg.id}`;
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(verifyUrl)}`;
        
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
                <head>
                    <title>Certificate - ${reg.eventTitle}</title>
                    <style>
                        body { font-family: 'Segoe UI', Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #e5e7eb; }
                        .cert { width: 800px; height: 600px; background: white; padding: 20px; box-sizing: border-box; position: relative; text-align: center; }
                        .cert-inner { border: 4px solid #061f38; height: 100%; box-sizing: border-box; padding: 40px; position: relative; }
                        .cert-inner::before { content: ''; position: absolute; top: 10px; left: 10px; right: 10px; bottom: 10px; border: 1px solid #061f38; pointer-events: none; }
                        h1 { color: #061f38; font-size: 38px; font-weight: 400; letter-spacing: 2px; text-transform: uppercase; margin-top: 40px; margin-bottom: 20px; }
                        .subtitle { font-style: italic; color: #d97706; font-size: 16px; margin-bottom: 40px; }
                        .name { font-size: 42px; color: #111; border-bottom: 1px solid #aaa; display: inline-block; width: 70%; padding-bottom: 10px; margin-bottom: 30px; font-weight: 500; }
                        .reason { font-size: 16px; color: #555; margin-bottom: 15px; }
                        .event { font-size: 24px; color: #111; font-weight: bold; margin-bottom: 15px; }
                        .date { font-size: 14px; color: #777; }
                        .footer { position: absolute; bottom: 50px; left: 50px; right: 50px; display: flex; justify-content: space-between; align-items: flex-end; }
                        .signature { border-top: 1px solid #111; width: 200px; padding-top: 5px; font-size: 14px; font-weight: bold; text-align: left; }
                        .meta { text-align: right; font-size: 10px; color: #999; display: flex; flex-direction: column; align-items: flex-end; }
                        @media print { 
                            @page { size: landscape; margin: 0; }
                            body { background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; } 
                            .cert { width: 100%; height: 100%; border: none; } 
                        }
                    </style>
                </head>
                <body>
                    <div class="cert">
                        <div class="cert-inner">
                            <h1>Certificate of Participation</h1>
                            <div class="subtitle">is hereby awarded to</div>
                            <div class="name">${user?.name || formData?.fullName || "Participant"}</div>
                            <div class="reason">For active participation in</div>
                            <div class="event">${reg.eventTitle || "Academic Event"}</div>
                            <div class="date">${formatDateRange(reg.startDate, reg.endDate)}</div>
                            
                            <div class="footer">
                                <div class="signature">Demo Admin<br><span style="font-weight:normal;font-size:10px;color:#555;">Conexus Events Team</span></div>
                                <div class="meta">
                                    <img src="${qrUrl}" alt="QR Code" style="width: 70px; height: 70px; margin-bottom: 6px; border: 1px solid #eee; padding: 2px;" />
                                    <span>ID: CX-${reg.id}</span>
                                    <span>Issued: ${issueDate}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <script>
                        // Wait slightly longer to ensure QR image loads before printing
                        setTimeout(() => window.print(), 800);
                    </script>
                </body>
            </html>
        `);
        printWindow.document.close();
    };

    return (
      <section className="relative px-4 py-10 max-w-7xl mx-auto animate-fade-in-up">
        {/* Institutional Hero Banner */}
        <div className="relative overflow-hidden u-hero rounded-[2.5rem] p-8 md:p-12 mb-10 shadow-2xl">
          <div className="absolute inset-0 u-hero-grid" />
          <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
            <div className="max-w-xl">
              <span className="px-4 py-2 rounded-sm u-hero-badge text-[11px] font-black uppercase mb-4 inline-block shadow-sm">
                Participant Dashboard
              </span>
              <h1 className="text-4xl md:text-5xl font-black text-white mb-3">Welcome, {user?.name || "Scholar"}</h1>
              <p className="text-white/70 text-sm md:text-base leading-relaxed">
                Your central hub for academic events, symposia, and research submissions. Track your registrations and certificates in real-time.
              </p>
            </div>
            <div className="grid grid-cols-2 sm:flex gap-4">
               {[ { l: 'Events', v: upcomingEvents.length }, { l: 'Registrations', v: myEvents.length } ].map((stat, i) => (
                  <div key={i} className="u-soft rounded-2xl px-6 py-4 min-w-[120px] text-center backdrop-blur-md">
                    <p className="text-[10px] font-black text-blue-600 uppercase mb-1 tracking-widest">{stat.l}</p>
                    <p className="text-2xl font-black text-brand">{stat.v}</p>
                  </div>
               ))}
            </div>
          </div>
        </div>

        {/* Tabs / Filters Container */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div className="inline-flex items-center p-1.5 bg-white u-tabs-wrap rounded-2xl shadow-sm overflow-x-auto max-w-full">
            {["upcoming", "my", "submit", "business_card"].map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={classNames(
                  "px-5 py-2.5 rounded-xl text-xs font-bold transition-all duration-300 whitespace-nowrap",
                  tab === t ? "u-tab-active bg-[var(--u-sky)] text-brand" : "text-gray-500 hover:text-brand"
                )}
              >
                {t === "upcoming" ? "Browse Events" : t === "my" ? "Registrations" : t === "submit" ? "Submit Paper" : "Business Card"}
              </button>
            ))}
          </div>

          {tab === "upcoming" && (
            <select 
              value={filterType} 
              onChange={(e) => setFilterType(e.target.value)} 
              className="u-input-academic md:w-48 font-bold text-xs"
            >
              <option value="all">All Categories</option>
              <option value="conference">Conference</option>
              <option value="forum">Forum</option>
              <option value="webinar">Webinar</option>
            </select>
          )}
        </div>

        {/* Tab Content */}
        <div className="min-h-[400px]">
          {tab === "upcoming" && (
            <div className="grid gap-6">
              {loading && <div className="flex justify-center p-20"><div className="spinner" /></div>}
              {!loading && filteredUpcoming().map((event, idx) => (
                <div 
                  key={event.id} 
                  className={classNames(
                    "u-card p-7 rounded-[2rem] hover-card relative overflow-hidden flex flex-col md:flex-row items-center gap-8 transition-all duration-500",
                    animateUpcoming ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                  )}
                  style={{ transitionDelay: `${idx * 100}ms` }}
                >
                  <div className="absolute top-0 left-0 bottom-0 w-[4px] bg-[var(--u-blue)]" />
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="badge-academic badge-academic-blue">{event.type}</span>
                      <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest">{event.mode}</span>
                    </div>
                    <h3 className="text-2xl font-black text-brand mb-2">{event.title}</h3>
                    <p className="text-gray-500 text-sm mb-5 leading-relaxed line-clamp-2">{event.description}</p>
                    <div className="flex flex-wrap gap-5 text-xs font-bold text-gray-400">
                      <span className="flex items-center gap-2">📅 {formatDateRange(event.startDate, event.endDate)}</span>
                      <span className="flex items-center gap-2">📍 {event.location}</span>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row md:flex-col gap-3 w-full md:w-56">
                    <button onClick={() => openRegisterModal(event)} className="grad-btn px-6 py-3 rounded-xl text-white text-sm font-extrabold u-sweep relative overflow-hidden transition-all">
                      Register Now
                    </button>
                    <button onClick={() => onDownloadInvitation?.(event)} className="px-6 py-3 rounded-xl border border-gray-200 text-brand text-sm font-extrabold hover:bg-gray-50 transition-all">
                      Invitation PDF
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* --- NEW REGISTRATION GRID WITH DYNAMIC CERTIFICATE BUTTON --- */}
          {tab === "my" && (
            <div className="reg-grid animate-fade-in-up">
              {myEvents.length === 0 ? (
                <div className="col-span-full u-card p-20 text-center rounded-[2.5rem] border-dashed border-2 flex flex-col items-center">
                  <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center text-3xl mb-4">🗓️</div>
                  <h3 className="text-xl font-black text-brand mb-2">No Registrations Yet</h3>
                  <p className="text-gray-400 font-bold max-w-xs mx-auto mb-6">You haven't signed up for any academic events. Start exploring our upcoming schedule!</p>
                  <button onClick={() => setTab("upcoming")} className="grad-btn px-8 py-3 rounded-xl text-white text-sm font-extrabold u-sweep relative overflow-hidden">
                    Browse Events
                  </button>
                </div>
              ) : (
                myEvents.map((reg, idx) => {
  const status = reg.status || "Pending";
  const isApproved = status === "Approved";
  return (
    <div key={`reg-${reg.id}-${idx}`} className="reg-card rounded-[2.5rem] p-7 shadow-sm">
                      <div className="flex justify-between items-start mb-6">
                        <div className={classNames(
                            "h-14 w-14 rounded-2xl flex items-center justify-center text-2xl shadow-inner",
                            status === "Rejected" ? "bg-red-50" : "bg-[var(--u-sky)]"
                        )}>
                          {isApproved ? "✅" : status === "Rejected" ? "❌" : "⏳"}
                        </div>
                        <span className={classNames("status-pill", `status-${status}`)}>
                          {status}
                        </span>
                      </div>

                      <div className="mb-6">
                        <h3 className="text-lg font-black text-brand leading-tight mb-2 line-clamp-2">
                          {reg.eventTitle || "Unnamed Event"}
                        </h3>
                        <div className="space-y-2">
                          <p className="flex items-center gap-2 text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                            <span className="opacity-50 text-base">📅</span> {formatDateRange(reg.startDate, reg.endDate)}
                          </p>
                          {reg.companions?.length > 0 && (
                            <p className="inline-flex items-center px-2 py-1 rounded bg-blue-50 text-[10px] font-black text-blue-600 uppercase">
                              +{reg.companions.length} Attendees
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="mt-auto pt-6 border-t border-gray-50 flex flex-wrap gap-2">
                        <button 
                          onClick={() => setPreviewReg(reg)}
                          className="flex-1 py-3 rounded-xl bg-gray-50 text-gray-600 text-[10px] font-black uppercase tracking-widest hover:bg-gray-100 transition-colors"
                        >
                          Details
                        </button>
                        
                        {/* QUICK SUBMIT PAPER SHORTCUT */}
                        {isApproved && (
                          <button 
                            onClick={() => {
                                setPaperForm(p => ({ ...p, eventId: String(reg.eventId) }));
                                setTab("submit");
                            }}
                            className="flex-1 py-3 rounded-xl border border-brand text-brand text-[10px] font-black uppercase tracking-widest hover:bg-blue-50 transition-colors"
                          >
                            Paper
                          </button>
                        )}

                        {isApproved && (
                          <button 
                            onClick={() => onDownloadInvitation?.(reg)}
                            className="flex-1 py-3 rounded-xl bg-[var(--u-navy)] text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-900/20 hover:opacity-90 transition-opacity"
                          >
                            Invitation
                          </button>
                        )}

                        {/* --- NEW: DYNAMIC CERTIFICATE BUTTON --- */}
                        {isApproved && reg.certificate_issued_at && (
                          <button 
                            onClick={() => handleDownloadCertificate(reg)}
                            className="flex-1 min-w-[100%] py-3 rounded-xl bg-[var(--u-gold)] text-[var(--u-navy)] text-[10px] font-black uppercase tracking-widest shadow-md hover:brightness-105 transition-all mt-1"
                          >
                            ✨ Download Certificate
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {tab === "submit" && (
            <div className="grid lg:grid-cols-12 gap-8">
              <div className="lg:col-span-4">
               <div className="u-card p-8 rounded-[2rem]">
                  <h3 className="text-xl font-black text-brand mb-2">8IRF Full Paper Submission</h3>
                  
                  {/* AUP CUSTOM ALERT BANNER */}
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
                      <p className="text-[10px] font-black text-amber-800 uppercase tracking-widest mb-1">⚠️ Important Note</p>
                      <p className="text-xs text-amber-900 mb-2 leading-relaxed">
                          Please make sure to follow the full paper template before submitting it. <a href="https://www.aup.edu.ph/urc/wp-content/uploads/2025/02/Full-Paper-Template-with-Sample-Paper.pdf" target="_blank" rel="noreferrer" className="underline font-bold text-brand hover:text-blue-600 transition-colors">Click here for the AUP Template</a>.
                      </p>
                      <p className="text-[11px] text-amber-900 bg-amber-100/50 p-2 rounded-lg border border-amber-100 mt-2">
                          <strong>Filename format:</strong> Lastname_Firstname_PaperTitle.docx<br/>
                          <span className="opacity-75">Example: Cruz_Juan_BusinessInModernEra.docx</span>
                      </p>
                  </div>
                  
                  <form onSubmit={handlePaperSubmit} className="space-y-4">
                     {/* --- EVENT SELECTION DROPDOWN --- */}
                     <div>
                        <label className="text-[11px] font-black uppercase text-gray-400 mb-1 block">Link to Event</label>
                        <select 
                           className="u-input-academic" 
                           value={paperForm.eventId} 
                           onChange={e => setPaperForm(p => ({...p, eventId: e.target.value}))}
                        >
                           <option value="">-- Select Event --</option>
                           {myEvents.filter(r => r.status === "Approved").map(r => (
                               <option key={r.eventId} value={r.eventId}>{r.eventTitle}</option>
                           ))}
                        </select>
                     </div>

                     <div>
                         <label className="text-[11px] font-black uppercase text-gray-400 mb-1 block">Paper Title *</label>
                         <input className="u-input-academic" value={paperForm.title} onChange={e => setPaperForm(p=>({...p, title: e.target.value}))} placeholder="Full academic title" required />
                     </div>
                     
                     {/* CHANGED "Research Track" to "Select Strand" */}
                     <div>
                         <label className="text-[11px] font-black uppercase text-gray-400 mb-1 block">Select Strand *</label>
                         <select className="u-input-academic" value={paperForm.track} onChange={e => setPaperForm(p=>({...p, track: e.target.value}))} required>
                            <option value="">-- Select a Strand --</option>
                            <option value="Health and Wellness">Health and Wellness</option>
                            <option value="Business and Technology">Business and Technology</option>
                            <option value="Education and Humanities">Education and Humanities</option>
                            <option value="Religion and Theology">Religion and Theology</option>
                            <option value="Science and Agriculture">Science and Agriculture</option>
                         </select>
                     </div>
                     
                     <div>
                         <label className="text-[11px] font-black uppercase text-gray-400 mb-1 block">Abstract</label>
                         <textarea rows={4} className="u-input-academic" value={paperForm.abstract} onChange={e => setPaperForm(p=>({...p, abstract: e.target.value}))} placeholder="Brief summary of your work..." />
                     </div>
                     
                     {/* CHANGED TO ACCEPT MS WORD (.docx) INSTEAD OF PDF */}
                     <div className="relative mt-2">
                        <label className="u-input-academic border-dashed py-8 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors">
                          <input type="file" accept=".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="hidden" onChange={e => {setPaperFile(e.target.files[0]); setPaperFileName(e.target.files[0]?.name);}} required />
                          <span className="text-blue-600 font-black text-sm text-center px-4">{paperFileName || "Upload Full Manuscript (MS Word)"}</span>
                          <span className="text-[10px] text-gray-400 uppercase mt-1">Max 10 MB. .docx format only.</span>
                        </label>
                     </div>
                     
                     <button type="submit" disabled={paperSaving} className="grad-btn w-full py-3 rounded-xl text-white font-extrabold u-sweep relative overflow-hidden mt-4">
                       {paperSaving ? "Uploading Manuscript..." : "Submit Paper"}
                     </button>

                     {paperError && <p className="text-red-500 text-xs font-bold text-center mt-2">{paperError}</p>}
                     {paperSuccess && <p className="text-emerald-600 text-xs font-bold text-center mt-2">{paperSuccess}</p>}
                  </form>
                </div>
              </div>
              <div className="lg:col-span-8">
                 <div className="u-card rounded-[2rem] overflow-hidden">
                    <div className="p-6 bg-gray-50/50 border-b border-gray-100 flex justify-between items-center">
                      <h3 className="font-extrabold text-brand">Submission History</h3>
                      <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="bg-transparent border-none text-[10px] font-black uppercase tracking-widest text-gray-400 focus:ring-0 cursor-pointer">
                        <option value="all">All Records</option>
                        <option value="under_review">Reviewing</option>
                        <option value="accepted">Accepted</option>
                      </select>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full table-academic">
                        <thead>
                          <tr>
                            <th className="px-6 py-4 text-left">Research Work</th>
                            <th className="px-6 py-4 text-left">Track</th>
                            <th className="px-6 py-4 text-left">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {visibleSubmissions.length === 0 ? (
                              <tr>
                                  <td colSpan="3" className="px-6 py-10 text-center text-sm text-gray-400 italic">No submissions found.</td>
                              </tr>
                          ) : (
                              visibleSubmissions.map((s, idx) => (
  <tr key={`sub-${s.id}-${idx}`} className="hover:bg-gray-50/50 transition-colors">
                                  <td className="px-6 py-5">
                                    <p className="font-extrabold text-brand max-w-sm truncate" title={s.title}>{s.title}</p>
                                    <p className="text-[10px] text-gray-400 font-bold mt-0.5">{s.fileName}</p>
                                  </td>
                                  <td className="px-6 py-5 text-xs font-bold text-gray-500">{s.track}</td>
                                  <td className="px-6 py-5">
                                    <span className="flex items-center text-xs font-black text-brand capitalize">
                                      <span className={classNames("status-dot", `bg-${s.status}`)} />
                                      {s.status?.replace('_', ' ')}
                                    </span>
                                  </td>
                                </tr>
                              ))
                          )}
                        </tbody>
                      </table>
                    </div>
                 </div>
              </div>
            </div>
          )}

          {tab === "business_card" && (
            <div className="animate-fade-in-up">
              {/* Check if EditBusinessCard is defined globally or pass fallback */}
              {typeof EditBusinessCard !== 'undefined' ? 
                <EditBusinessCard user={user} onUpdateUser={onUpdateUser} /> 
                : <p className="text-center p-10 text-gray-400 font-bold">Business Card Component Loading...</p>
              }
            </div>
          )}
        </div>

        {/* Registration Modal */}
        {selectedEvent && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/65 backdrop-blur-sm p-4 overflow-y-auto" onClick={() => setSelectedEvent(null)}>
            <div className="w-full max-w-xl animate-fade-in-up my-auto" onClick={e => e.stopPropagation()}>
              <div className="rounded-[2.5rem] overflow-hidden u-card">
                 <div className="px-8 py-6 bg-[var(--u-navy)] text-white relative">
                    <div className="absolute top-0 left-0 right-0 h-[3px] bg-[var(--u-gold)]" />
                    <h3 className="text-xl md:text-2xl font-extrabold">Event Registration</h3>
                    <p className="text-xs text-white/75 mt-1">Enrolling in: <strong className="text-[var(--u-gold)]">{selectedEvent.title}</strong></p>
                 </div>
                 <form onSubmit={(e) => { e.preventDefault(); setPendingPayload({event: selectedEvent, formData}); setConfirmOpen(true); }} className="p-8 space-y-4">
                    
                    {/* NEW: ROLE SELECTOR */}
                    <div className="flex gap-2 p-1 bg-gray-100 rounded-xl mb-4">
                      <button type="button" onClick={() => setRegRole('participant')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${regRole === 'participant' ? 'bg-white shadow text-brand' : 'text-gray-500 hover:text-gray-700'}`}>Participant</button>
                      <button type="button" onClick={() => setRegRole('presenter')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${regRole === 'presenter' ? 'bg-brand shadow text-white' : 'text-gray-500 hover:text-gray-700'}`}>Event Presenter</button>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {/* AUP Requirements: Name Breakdown */}
                      <div className="col-span-2 sm:col-span-1"><label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Last Name *</label><input className="u-input-academic" value={formData.lastName} onChange={e => setFormData(p=>({...p, lastName: e.target.value}))} required /></div>
                      <div className="col-span-2 sm:col-span-1"><label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">First Name *</label><input className="u-input-academic" value={formData.firstName} onChange={e => setFormData(p=>({...p, firstName: e.target.value}))} required /></div>
                      <div className="col-span-2 sm:col-span-1"><label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Middle Name</label><input className="u-input-academic" value={formData.middleName} onChange={e => setFormData(p=>({...p, middleName: e.target.value}))} /></div>
                      
                      {/* Read-Only Email */}
                      <div className="col-span-2 sm:col-span-1"><label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Email *</label><input className="u-input-academic bg-gray-100 text-gray-500 cursor-not-allowed border-gray-200 shadow-inner" type="email" value={formData.email} readOnly title="Email is tied to your account." /></div>
                      
                      {/* AUP Demographics */}
                      <div className="col-span-2 sm:col-span-1">
                          <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Gender *</label>
                          <select className="u-input-academic" value={formData.gender} onChange={e => setFormData(p=>({...p, gender: e.target.value}))} required>
                              <option value="">Select...</option>
                              <option value="Female">Female</option>
                              <option value="Male">Male</option>
                          </select>
                      </div>
                      <div className="col-span-2 sm:col-span-1"><label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Age *</label><input type="number" className="u-input-academic" value={formData.age} onChange={e => setFormData(p=>({...p, age: e.target.value}))} required /></div>
                      <div className="col-span-2 sm:col-span-1"><label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Mobile Number *</label><input className="u-input-academic" value={formData.contact} onChange={e => setFormData(p=>({...p, contact: e.target.value}))} required /></div>
                      <div className="col-span-2 sm:col-span-1"><label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Institution</label><input className="u-input-academic" value={formData.university} onChange={e => setFormData(p=>({...p, university: e.target.value}))} placeholder="e.g. AUP" /></div>
                      
                      {/* --- PAYMENT ACCOUNT DETAILS --- */}
                      <div className="col-span-2 bg-[#f8fafc] border border-gray-200 p-4 rounded-xl mt-2">
                          <p className="text-[11px] font-black text-brand uppercase tracking-widest mb-2 flex items-center gap-2">
                              <span>💳</span> Payment Account Details
                          </p>
                          <div className="text-xs text-gray-600 space-y-1.5">
                              <p><span className="font-bold text-gray-800">Bank Name:</span> BPI (Bank of the Philippine Islands)</p>
                              <p><span className="font-bold text-gray-800">Account Name:</span> Adventist University of the Philippines</p>
                              <p><span className="font-bold text-gray-800">Account Number:</span> <span className="font-mono bg-white px-2 py-0.5 rounded border border-gray-200 select-all text-brand font-bold">8921003316</span></p>
                          </div>
                          <p className="text-[9px] text-gray-400 mt-3 italic leading-relaxed">
                              Please settle your registration fee via bank transfer before proceeding.
                          </p>
                      </div>

                      {/* SEPARATE UPLOADS: ID AND PAYMENT */}
                      <div className="col-span-2 sm:col-span-1">
                          <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Upload Valid ID *</label>
                          <input type="file" accept="image/*,application/pdf" className="u-input-academic bg-white file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-[10px] file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer text-xs" onChange={(e) => setSelectedFile(e.target.files[0])} required />
                      </div>

                      <div className="col-span-2 sm:col-span-1">
                          <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Proof of Payment *</label>
                          <input type="file" accept="image/*,application/pdf" className="u-input-academic bg-white file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-[10px] file:font-bold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer text-xs" onChange={(e) => setPaymentFile(e.target.files[0])} required />
                      </div>

                      {/* NEW: PRESENTER CONDITIONAL UPLOADS */}
                      {regRole === 'presenter' && (
                        <>
                          <div className="col-span-2 border-t border-gray-100 pt-4 mt-2">
                            <p className="text-xs font-black text-brand uppercase mb-3">Presenter Requirements</p>
                          </div>
                          <div className="col-span-2 sm:col-span-1">
                              <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Upload Presentation</label>
                              <input type="file" accept=".pdf,.ppt,.pptx" className="u-input-academic bg-white file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-[10px] file:font-bold file:bg-amber-50 file:text-amber-700 cursor-pointer text-xs" onChange={(e) => setPresentationFile(e.target.files[0])} required={regRole === 'presenter'} />
                          </div>
                          <div className="col-span-2 sm:col-span-1">
                              <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Sample Video (.mp4)</label>
                              <input type="file" accept="video/mp4,video/webm,video/quicktime" className="u-input-academic bg-white file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-[10px] file:font-bold file:bg-rose-50 file:text-rose-700 cursor-pointer text-xs" onChange={(e) => setVideoFile(e.target.files[0])} required={regRole === 'presenter'} />
                          </div>
                        </>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-6 border-t border-gray-100">
                      <div className="flex items-center gap-3">
                          <span className="text-[10px] font-black text-gray-400 uppercase">Attendees</span>
                          <div className="flex items-center bg-gray-100 rounded-lg p-1">
                             <button type="button" onClick={decrementParticipants} className="w-8 h-8 font-bold">-</button>
                             <span className="px-4 font-black text-brand">{participantsCount}</span>
                             <button type="button" onClick={incrementParticipants} className="w-8 h-8 font-bold">+</button>
                          </div>
                      </div>
                      <div className="flex gap-2">
                          <button type="button" onClick={() => setSelectedEvent(null)} className="px-5 py-2 text-xs font-extrabold text-gray-500 hover:text-gray-700">Cancel</button>
                          <button type="submit" className="grad-btn px-6 py-2.5 rounded-xl text-white text-xs font-extrabold u-sweep relative overflow-hidden">Proceed</button>
                      </div>
                    </div>

                    {/* DYNAMIC COMPANION INPUTS */}
                    {companions.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-gray-100 animate-fade-in-up">
                        <h4 className="text-xs font-black text-brand uppercase mb-3">Additional Attendees</h4>
                        <div className="space-y-4 max-h-60 overflow-y-auto pr-2 scrollbar-hide">
                          {companions.map((comp, index) => (
                            <div key={index} className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                              <p className="text-[10px] font-bold text-blue-500 uppercase mb-2">Guest {index + 1}</p>
                              <div className="grid grid-cols-2 gap-3">
                                <div className="col-span-2 sm:col-span-1">
                                  <input className="u-input-academic text-xs" placeholder="Full Name" value={comp.name} onChange={e => handleCompanionChange(index, "name", e.target.value)} required />
                                </div>
                                <div className="col-span-2 sm:col-span-1">
                                  <input className="u-input-academic text-xs" placeholder="Relation" value={comp.relation} onChange={e => handleCompanionChange(index, "relation", e.target.value)} />
                                </div>
                                <div className="col-span-2 sm:col-span-1">
                                  <input className="u-input-academic text-xs" placeholder="Email (Optional)" value={comp.email} onChange={e => handleCompanionChange(index, "email", e.target.value)} />
                                </div>
                                <div className="col-span-2 sm:col-span-1">
                                  <input className="u-input-academic text-xs" placeholder="Phone (Optional)" value={comp.phone} onChange={e => handleCompanionChange(index, "phone", e.target.value)} />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                 </form>
              </div>
            </div>
          </div>
        )}

        {/* Confirmation Modal */}
        {confirmOpen && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="u-card rounded-[2rem] p-8 max-w-sm w-full text-center animate-fade-in-up">
              <h3 className="text-xl font-black text-brand mb-2">Final Step</h3>
              <p className="text-sm text-gray-500 mb-6 leading-relaxed">Confirming will submit your details and ID to the organizers for approval.</p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmOpen(false)} className="flex-1 py-3 rounded-xl bg-gray-100 font-extrabold text-gray-600 text-sm hover:bg-gray-200 transition-colors">Review</button>
                <button onClick={handleFinalRegistration} disabled={saving} className="flex-1 py-3 rounded-xl grad-btn text-white font-extrabold text-sm u-sweep relative overflow-hidden disabled:opacity-70">
                  {saving ? "Processing..." : "Confirm"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* PREVIEW DETAILS MODAL */}
        {previewReg && (
            <RegistrationDetailsModal 
                // Force it to use the liveReg data so the modal shows the admin Note
                reg={myEvents.find(r => r.id === previewReg.id) || previewReg} 
                event={events.find(e => String(e.id) === String(previewReg.eventId))}
                rooms={localRooms}
                dorms={localDorms}
                onClose={() => setPreviewReg(null)} 
            />
        )}

      </section>
    );
  }

  window.ParticipantDashboard = ParticipantDashboard;
})();