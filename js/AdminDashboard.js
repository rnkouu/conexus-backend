// js/AdminDashboard.js
(function () {
  // 1. Guard: Ensure React exists
  if (!window.React || !window.React.useState) {
    console.error("AdminDashboard.js: React not found.");
    return;
  }

  const { useState, useEffect, useRef } = window.React;
  const ReactDOM = window.ReactDOM || {};
  const createPortal = ReactDOM.createPortal;

  // ==========================================
  // CONFIGURATION
  // ==========================================
  const API_BASE = "https://conexus-backend-production.up.railway.app/api";
  const EMAIL_API = "https://conexus-backend-production.up.railway.app/api";
  
  const OJS_DASHBOARD_URL = "http://localhost:8080/index.php/crj/dashboard/editorial#submissions";

  const getAuthHeaders = () => {
    const token = localStorage.getItem('conexus_token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  };

  // ==========================================
  // UTILITIES & HELPERS
  // ==========================================
  function classNames(...args) { return args.filter(Boolean).join(" "); }
  function makeUUID() { return crypto.randomUUID ? crypto.randomUUID() : 'x'.repeat(32); }

  function downloadBlob({ content, mime, filename }) {
    try {
      const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename || "download.bin";
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    } catch (e) { console.error("Download failed", e); }
  }

  function formatDateRange(start, end) {
    if (!start) return "";
    try {
      const s = new Date(start); const e = end ? new Date(end) : null;
      if (isNaN(s.getTime())) return start;
      const opts = { month: "short", day: "numeric" };
      return e && !isNaN(e.getTime()) ? `${s.toLocaleDateString(undefined, opts)} – ${e.toLocaleDateString(undefined, opts)}, ${s.getFullYear()}` : `${s.toLocaleDateString()}, ${s.getFullYear()}`;
    } catch (e) { return String(start); }
  }

  function formatDateTime(iso) {
    try { return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); } catch (e) { return ""; }
  }

  function toIsoDateString(v) {
    try { return new Date(v).toISOString().slice(0, 10); } catch (e) { return ""; }
  }

  // --- HTML Generator ---
  const SafeCertGenerator = {
    generateHTML: (data) => `
      <div style="width: 100%; height: 100%; padding: 40px; text-align: center; background: #fff; border: 10px double #002147; font-family: 'Times New Roman', serif; color: #333; display: flex; flex-direction: column; justify-content: center; box-sizing: border-box;">
        <div style="margin-bottom: 20px;">
            <h1 style="font-size: 40px; margin: 0; color: #002147; text-transform: uppercase; letter-spacing: 2px;">Certificate of Participation</h1>
            <p style="font-size: 16px; color: #b45309; font-style: italic; margin-top: 10px;">is hereby awarded to</p>
        </div>
        <h2 style="font-size: 48px; margin: 10px 0; border-bottom: 1px solid #999; display: inline-block; padding-bottom: 5px; font-family: Helvetica, sans-serif;">${data.name}</h2>
        <div style="margin-top: 20px;">
            <p style="font-size: 18px;">For active participation in</p>
            <h3 style="font-size: 28px; margin: 15px 0; font-weight: bold;">${data.eventTitle}</h3>
            <p style="font-size: 16px; color: #555;">${data.dateLabel}</p>
        </div>
        <div style="margin-top: 50px; display: flex; justify-content: space-between; padding: 0 60px;">
            <div style="text-align: center;">
                <div style="border-top: 1px solid #333; width: 200px; margin: 0 auto 5px auto;"></div>
                <p style="font-weight: bold; margin: 0;">${data.issuerName}</p>
                <p style="font-size: 12px; margin: 0;">${data.issuerRole}</p>
            </div>
            <div style="text-align: right;">
                <p style="font-size: 10px; color: #aaa; margin: 0;">ID: ${data.certificateId}</p>
                <p style="font-size: 10px; color: #aaa; margin: 0;">Issued: ${data.issuedAt}</p>
            </div>
        </div>
      </div>`
  };

  // --- Normalizers ---
  const normalizeEvent = (row) => (!row ? {} : {
    id: row.id,
    title: row.title || row.event_title || "Untitled",
    startDate: toIsoDateString(row.start_date || row.startDate),
    endDate: toIsoDateString(row.end_date || row.endDate),
    description: row.description || "",
    location: row.location || "",
    featured: !!(row.featured || row.is_featured),
    status: 'upcoming',
    createdAt: row.created_at || row.createdAt,
    type: row.type || "Conference",
    mode: row.mode || "On-site"
  });

  const normalizeRegistration = (row) => {
    if (!row) return {};
    const companionList = Array.isArray(row.companions) ? row.companions : (typeof row.companions === 'string' ? JSON.parse(row.companions) : []);
    return {
        id: row.id,
        eventId: row.event_id,
        eventTitle: row.event_title || "Unknown Event",
        userEmail: row.user_email,
        fullName: row.full_name || row.user_email,
        university: row.university || "",
        status: row.status || "For approval",
        nfc_card_id: row.nfc_card_id || null,
        participantsCount: 1 + companionList.length,
        roomId: row.room_id || null,
        companions: companionList,
        validId: row.valid_id_path || null,
        adminNote: row.admin_note || null,
        certificateIssuedAt: row.certificate_issued_at || null,
        profile_slug: row.profile_slug || null
    };
  };

  const normalizePortal = (row) => (!row ? {} : {
    id: String(row.id),
    eventId: row.event_id || row.eventId,
    eventTitle: row.event_title || row.eventTitle,
    name: row.name,
    createdAt: row.created_at || row.createdAt || new Date().toISOString(),
  });

  const normalizeDorm = (row) => (!row ? {} : { id: row.id, name: row.name, type: row.type || "Dorm" });
  
  const normalizeRoom = (row) => (!row ? {} : {
    id: row.id,
    dormId: row.dorm_id || row.dormId,
    name: row.name,
    beds: row.beds,
    occupied: row.occupied
  });

  // ==========================================
  // VISUAL CERTIFICATE DESIGNER
  // ==========================================
  const CertificateDesigner = ({ onBack }) => {
    const [bgImage, setBgImage] = useState(null);
    const [elements, setElements] = useState([
      { id: 'name', type: 'text', text: '{Participant Name}', x: 50, y: 50, fontSize: 40, fontFamily: 'Helvetica', fontWeight: 'bold', color: '#002147', align: 'center' },
      { id: 'event', type: 'text', text: '{Event Title}', x: 50, y: 65, fontSize: 24, fontFamily: 'Helvetica', fontWeight: 'normal', color: '#555555', align: 'center' },
      { id: 'date', type: 'text', text: '{Date}', x: 50, y: 75, fontSize: 16, fontFamily: 'Times New Roman', fontWeight: 'normal', color: '#777777', align: 'center' }
    ]);
    const [selectedId, setSelectedId] = useState('name');
    const [isDownloading, setIsDownloading] = useState(false);
    
    const previewRef = useRef(null);
    const fileInputRef = useRef(null);

    const handleImageUpload = (e) => {
      const file = e.target.files[0];
      if (file) setBgImage(URL.createObjectURL(file));
    };

    const updateElement = (key, value) => {
      setElements(prev => prev.map(el => el.id === selectedId ? { ...el, [key]: value } : el));
    };

    const selectedElement = elements.find(el => el.id === selectedId);

    const handleDownload = async () => {
      if (!window.html2canvas || !window.jspdf) {
        alert("PDF libraries not loaded.");
        return;
      }
      setIsDownloading(true);
      try {
        const canvas = await window.html2canvas(previewRef.current, { scale: 2, useCORS: true });
        const imgData = canvas.toDataURL('image/png');
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('l', 'mm', 'a4'); 
        pdf.addImage(imgData, 'PNG', 0, 0, pdf.internal.pageSize.getWidth(), pdf.internal.pageSize.getHeight());
        pdf.save("certificate_template.pdf");
      } catch (err) { alert("Failed to generate PDF."); } finally { setIsDownloading(false); }
    };

    return (
      <div className="flex h-[calc(100vh-100px)] gap-6 p-4">
        <div className="w-80 flex flex-col gap-6 bg-white p-6 rounded-3xl shadow-xl border border-gray-100 overflow-y-auto">
          <div>
            <button onClick={onBack} className="flex items-center text-sm text-gray-500 hover:text-brand font-bold mb-4">← Back to Dashboard</button>
            <h2 className="text-2xl font-black text-brand font-display">Designer</h2>
            <p className="text-xs text-gray-500">Customize layout & style</p>
          </div>
          <div className="space-y-4 border-t border-gray-100 pt-4">
            <div onClick={() => fileInputRef.current.click()} className="cursor-pointer border-2 border-dashed border-gray-200 rounded-xl p-4 text-center hover:border-brand hover:bg-blue-50 transition-all">
                <p className="text-xs font-bold text-brand">Upload Image</p>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Select Element</label>
              <div className="flex gap-2 bg-gray-100 p-1 rounded-xl">
                {elements.map(el => (
                  <button key={el.id} onClick={() => setSelectedId(el.id)} className={`flex-1 py-2 text-[10px] font-bold rounded-lg transition-all ${selectedId === el.id ? 'bg-white shadow text-brand' : 'text-gray-500 hover:text-gray-700'}`}>{el.id.toUpperCase()}</button>
                ))}
              </div>
            </div>
            {selectedElement && (
              <div className="space-y-4 animate-fade-in-up">
                <div><label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Text</label><input value={selectedElement.text} onChange={e => updateElement('text', e.target.value)} className="w-full text-xs font-bold p-2 rounded-lg border border-gray-200 focus:border-brand outline-none" /></div>
                <div className="grid grid-cols-2 gap-3">
                   <div><label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Size</label><input type="number" value={selectedElement.fontSize} onChange={e => updateElement('fontSize', parseInt(e.target.value))} className="w-full text-xs p-2 rounded-lg border border-gray-200" /></div>
                   <div><label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Color</label><input type="color" value={selectedElement.color} onChange={e => updateElement('color', e.target.value)} className="w-full h-8 p-0 border-0 rounded cursor-pointer" /></div>
                </div>
                <div><label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Pos Y%</label><input type="range" min="0" max="100" value={selectedElement.y} onChange={e => updateElement('y', parseInt(e.target.value))} className="w-full accent-brand h-2 bg-gray-200 rounded-lg" /></div>
                <div><label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Pos X%</label><input type="range" min="0" max="100" value={selectedElement.x} onChange={e => updateElement('x', parseInt(e.target.value))} className="w-full accent-brand h-2 bg-gray-200 rounded-lg" /></div>
              </div>
            )}
          </div>
          <div className="mt-auto pt-4 border-t border-gray-100">
             <button onClick={handleDownload} disabled={isDownloading} className="w-full py-3 rounded-xl bg-brand text-white font-bold text-sm shadow-xl hover:bg-black transition-all flex justify-center items-center gap-2">{isDownloading ? "Generating..." : "Download PDF"}</button>
          </div>
        </div>
        <div className="flex-1 bg-gray-100 rounded-3xl border-4 border-dashed border-gray-200 flex items-center justify-center overflow-hidden relative p-8">
            <div ref={previewRef} className="relative bg-white shadow-2xl transition-all origin-center" style={{ width: '1123px', height: '794px', transform: 'scale(0.65)', backgroundImage: bgImage ? `url(${bgImage})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center', backgroundColor: bgImage ? 'transparent' : '#ffffff' }}>
              {elements.map(el => (
                <div key={el.id} onClick={() => setSelectedId(el.id)} className={`absolute transform -translate-x-1/2 -translate-y-1/2 cursor-move border-2 transition-colors px-2 py-1 ${selectedId === el.id ? 'border-brand bg-blue-50/20' : 'border-transparent hover:border-gray-200'}`} style={{ left: `${el.x}%`, top: `${el.y}%`, fontSize: `${el.fontSize}px`, fontFamily: el.fontFamily, fontWeight: el.fontWeight, color: el.color, textAlign: el.align, whiteSpace: 'nowrap', width: 'auto' }}>{el.text}</div>
              ))}
            </div>
        </div>
      </div>
    );
  };

  // ==========================================
  // MODALS & HELPERS
  // ==========================================

  function ModalWrapper({ children, onClose }) {
    if (!createPortal) return null;
    return createPortal(<div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"><div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-xl overflow-hidden animate-fade-in-up">{children}</div></div>, document.body);
  }

  // --- UPDATED REVOKE MODAL ---
  function RevokeModal({ isOpen, onClose, onConfirm, targetName, isPending }) {
    if (!isOpen) return null;
    const [note, setNote] = useState("");

    const handleSubmit = (e) => {
        e.preventDefault();
        onConfirm(note);
    };

    return createPortal(
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden animate-fade-in-up p-8">
            <h3 className="text-xl font-extrabold text-gray-900 mb-2">
                {isPending ? "Reject Registration" : "Revoke Registration"}
            </h3>
            <p className="text-sm text-gray-500 mb-6">
                You are about to {isPending ? "reject" : "revoke approval for"} <strong className="text-brand">{targetName}</strong>. 
                Please provide a reason or admin note.
            </p>
            <form onSubmit={handleSubmit}>
                <textarea 
                    className="w-full p-4 bg-gray-50 rounded-xl border border-gray-200 text-sm focus:border-brand outline-none resize-none"
                    rows="4"
                    placeholder="Reason for decision (e.g. Invalid ID, Not eligible)..."
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    autoFocus
                    required
                />
                <div className="flex gap-3 mt-6">
                    <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50">Cancel</button>
                    <button 
                        type="submit"
                        className="flex-1 py-3 rounded-xl bg-red-500 text-white text-sm font-bold hover:bg-red-600 shadow-lg"
                    >
                        {isPending ? "Confirm Reject" : "Confirm Revoke"}
                    </button>
                </div>
            </form>
        </div>
      </div>, 
      document.body
    );
  }

  function RegistrationPreviewModal({ reg, onClose }) {
    if (!reg) return null;
    const companionList = Array.isArray(reg.companions) ? reg.companions : (typeof reg.companions === 'string' ? JSON.parse(reg.companions) : []);
    const fileUrl = reg.validId ? `https://conexus-backend-production.up.railway.app/${reg.validId}` : null;

    return (
      <ModalWrapper onClose={onClose}>
        <div className="p-8">
          <div className="flex justify-between items-start mb-6"><div><h3 className="text-2xl font-black text-brand">Registration Detail</h3><p className="text-sm text-gray-500">{reg.eventTitle}</p></div><button onClick={onClose} className="p-2 bg-gray-50 rounded-full hover:bg-gray-100 transition-colors">✕</button></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <div className="space-y-6">
                <div className="space-y-2">
                    <h4 className="text-[11px] font-black text-brand uppercase tracking-widest border-b pb-1">Primary Participant</h4>
                    <div><p className="text-[10px] font-bold text-gray-400 uppercase">Name</p><p className="text-sm font-bold text-gray-800">{reg.fullName}</p></div>
                    <div><p className="text-[10px] font-bold text-gray-400 uppercase">Email</p><p className="text-sm font-medium text-gray-600">{reg.userEmail}</p></div>
                </div>
                
                {/* Valid ID Preview */}
                <div className="space-y-2 pt-4">
                    <h4 className="text-[11px] font-black text-brand uppercase tracking-widest border-b pb-1">Valid ID</h4>
                    {fileUrl ? (
                        <div className="group relative w-full h-40 bg-gray-100 rounded-xl overflow-hidden border border-gray-200">
                            <img src={fileUrl} alt="ID" className="w-full h-full object-cover group-hover:scale-105 transition-transform" onError={(e)=>{e.target.style.display='none'}}/>
                            <a href={fileUrl} target="_blank" className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-bold transition-all">View Full</a>
                        </div>
                    ) : <p className="text-xs text-gray-400 italic">No ID uploaded.</p>}
                </div>

                {/* Show Admin Note in Preview */}
                {(reg.adminNote || reg.admin_note) && (
                    <div className="p-3 bg-red-50 border border-red-100 rounded-xl mt-4">
                        <p className="text-[10px] font-bold text-red-600 uppercase">Admin Note</p>
                        <p className="text-xs text-red-800 mt-1">{reg.adminNote || reg.admin_note}</p>
                    </div>
                )}
            </div>
            <div className="space-y-4"><h4 className="text-[11px] font-black text-amber-600 uppercase tracking-widest border-b pb-1">Associates ({companionList.length})</h4><div className="max-h-[30vh] overflow-y-auto space-y-4 pr-2 scrollbar-hide">{companionList.length === 0 ? (<p className="text-xs text-gray-400 italic py-4">No associates registered.</p>) : companionList.map((c, idx) => (<div key={idx} className="bg-soft/40 p-3 rounded-xl border border-blue-50"><div className="text-sm font-bold text-gray-800">{c.name}</div><div className="text-[10px] font-bold text-amber-600 uppercase">{c.relation}</div></div>))}</div></div>
          </div>
          <button onClick={onClose} className="w-full py-4 rounded-2xl bg-brand text-white font-bold hover:bg-black transition-all shadow-xl">Close</button>
        </div>
      </ModalWrapper>
    );
  }

  function NfcModal({ isOpen, targetReg, onClose, onSubmit }) {
    if (!isOpen) return null;
    const [scannedId, setScannedId] = useState("");
    const inputRef = useRef(null);
    useEffect(() => { if (isOpen) setTimeout(() => inputRef.current?.focus(), 100); }, [isOpen]);
    const handleSubmit = (e) => { e.preventDefault(); onSubmit(scannedId); setScannedId(""); };
    return createPortal(<div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"><div className="bg-white p-8 rounded-2xl shadow-2xl max-w-md w-full text-center"><div className="mb-4 text-4xl">📡</div><h3 className="text-xl font-bold mb-2">Scan Card Now</h3><p className="text-sm text-gray-600 mb-6">Assigning to: <strong className="text-brand">{targetReg?.fullName}</strong></p><form onSubmit={handleSubmit}><input ref={inputRef} value={scannedId} onChange={(e) => setScannedId(e.target.value)} className="w-full text-center text-xl font-mono border-2 border-blue-100 rounded-xl py-3 mb-4 focus:border-brand outline-none" placeholder="Tap card..." autoFocus /><div className="flex gap-2 justify-center"><button type="button" onClick={onClose} className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-lg font-bold">Cancel</button><button type="submit" className="px-6 py-2 bg-brand text-white rounded-lg font-bold shadow-lg">Save ID</button></div></form></div></div>, document.body);
  }

  function CreateEventModal({ isOpen, isSaving, editId, formData, onChange, onClose, onSave }) {
    if (!isOpen) return null;
    return createPortal(
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6">
        <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-md transition-opacity" onClick={onClose}></div>
        <div className="relative bg-white rounded-[40px] shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
          
          <div className="px-10 pt-10 pb-6 shrink-0">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[11px] font-black text-brand uppercase tracking-[0.2em] mb-2">Conexus Platform</p>
                <h3 className="text-3xl font-extrabold text-gray-900 font-display">{editId ? "Edit Event" : "Add a new event card"}</h3>
              </div>
              <button onClick={onClose} className="p-3 bg-gray-50 rounded-full text-gray-400 hover:text-gray-900 transition-all">✕</button>
            </div>
          </div>

          <div className="px-10 py-4 overflow-y-auto scrollbar-hide">
            <form id="createEventForm" onSubmit={onSave} className="space-y-7 pb-6">
              
              <div className="space-y-2">
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Event Name</label>
                <input type="text" name="title" required className="w-full p-4 rounded-2xl border-2 border-gray-100 bg-gray-50 text-gray-800 focus:bg-white focus:border-brand transition-all text-lg outline-none" value={formData.title} onChange={onChange} />
              </div>

              <div className="grid grid-cols-2 gap-6">
                 <div className="space-y-2">
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Event Type</label>
                    <select name="type" value={formData.type || "Conference"} onChange={onChange} className="w-full p-4 rounded-2xl border-2 border-gray-100 bg-gray-50 text-gray-800 focus:bg-white focus:border-brand outline-none appearance-none">
                        <option value="Conference">Conference</option>
                        <option value="Forum">Forum</option>
                        <option value="Colloquium">Colloquium</option>
                        <option value="Summit">Summit</option>
                        <option value="Workshop">Workshop</option>
                    </select>
                 </div>
                 <div className="space-y-2">
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Mode</label>
                    <select name="mode" value={formData.mode || "On-site"} onChange={onChange} className="w-full p-4 rounded-2xl border-2 border-gray-100 bg-gray-50 text-gray-800 focus:bg-white focus:border-brand outline-none appearance-none">
                        <option value="On-site">On-site</option>
                        <option value="Virtual">Virtual</option>
                        <option value="Hybrid">Hybrid</option>
                    </select>
                 </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Event Description</label>
                <textarea name="description" rows="4" className="w-full p-4 rounded-2xl border-2 border-gray-100 bg-gray-50 text-gray-800 focus:bg-white focus:border-brand transition-all outline-none resize-none" value={formData.description} onChange={onChange}></textarea>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Start Date</label>
                    <input type="date" name="startDate" required className="w-full p-4 rounded-2xl border-2 border-gray-100 bg-gray-50 outline-none" value={formData.startDate} onChange={onChange} />
                </div>
                <div className="space-y-2">
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">End Date</label>
                    <input type="date" name="endDate" required className="w-full p-4 rounded-2xl border-2 border-gray-100 bg-gray-50 outline-none" value={formData.endDate} onChange={onChange} />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Location</label>
                <input type="text" name="location" required className="w-full p-4 rounded-2xl border-2 border-gray-100 bg-gray-50 outline-none" value={formData.location} onChange={onChange} />
              </div>

              <div className="flex items-center justify-between p-6 rounded-3xl bg-gray-50 border-2 border-gray-100">
                <div><div className="text-lg font-bold text-gray-900">Featured event</div></div>
                <label className="flex items-center gap-4 cursor-pointer group">
                    <input type="checkbox" name="featured" checked={formData.featured} onChange={onChange} className="w-7 h-7 rounded-lg border-2 border-gray-300 text-brand cursor-pointer" />
                    <span className="text-base font-bold text-gray-700 group-hover:text-brand transition-colors">Featured</span>
                </label>
              </div>
            </form>
          </div>

          <div className="px-10 py-8 bg-gray-50 border-t border-gray-100 flex justify-end gap-4 shrink-0">
            <button type="button" onClick={onClose} className="px-8 py-3 rounded-2xl bg-white border-2 border-gray-200 text-gray-600 font-bold hover:bg-gray-100 transition-all">Cancel</button>
            <button type="submit" form="createEventForm" disabled={isSaving} className="px-10 py-3 rounded-2xl bg-gradient-to-r from-brand to-brandLight text-white font-bold shadow-xl disabled:opacity-50 transition-all">
                {isSaving ? "Saving..." : (editId ? "Update Event" : "Save Event")}
            </button>
          </div>
        </div>
      </div>, 
      document.body
    );
  }

  function AssignRoomModal({ isOpen, targetReg, dorms, rooms, registrations, onClose, onAssign }) {
    if (!isOpen) return null;
    const [flow, setFlow] = useState({ type: null, locationId: null, roomId: null });
    const relevantDorms = dorms.filter(d => !flow.type || d.type === flow.type);
    const relevantRooms = rooms.filter(r => String(r.dormId) === String(flow.locationId));
    return createPortal(<div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"><div className="bg-white rounded-[32px] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"><div className="p-6 border-b border-gray-100 flex justify-between items-center"><div><h3 className="text-xl font-bold text-gray-900">Assign Room</h3><p className="text-sm text-gray-500">For {targetReg?.fullName}</p></div><button onClick={onClose} className="text-gray-400 hover:text-gray-800">✕</button></div><div className="flex-1 overflow-y-auto p-8 space-y-8"><div><p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">1. Select Housing Type</p><div className="flex gap-4">{['Dorm', 'Hotel'].map(t => (<button key={t} onClick={() => setFlow({ type: t, locationId: null, roomId: null })} className={`flex-1 py-4 rounded-2xl border-2 text-sm font-bold transition-all ${flow.type === t ? 'border-brand bg-blue-50 text-brand' : 'border-gray-100 bg-white text-gray-600'}`}>{t === 'Dorm' ? '🏫 Dormitory' : '🏨 Hotel'}</button>))}</div></div>{flow.type && (<div><p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">2. Select Location</p><div className="grid grid-cols-2 gap-3">{relevantDorms.map(d => (<button key={d.id} onClick={() => setFlow({ ...flow, locationId: d.id, roomId: null })} className={`py-3 px-4 rounded-xl border-2 text-left text-sm font-bold transition-all ${flow.locationId === d.id ? 'border-brand bg-blue-50 text-brand' : 'border-gray-100 bg-white text-gray-600'}`}>{d.name}</button>))}</div></div>)}{flow.locationId && (<div><p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">3. Select Room</p><div className="grid grid-cols-3 gap-3">{relevantRooms.map(r => {const occupiedCount = registrations.filter(reg => String(reg.roomId) === String(r.id) && reg.status === "Approved").length;const isFull = occupiedCount >= r.beds;return (<button key={r.id} disabled={isFull} onClick={() => setFlow({ ...flow, roomId: r.id })} className={`p-3 rounded-xl border-2 text-left transition-all ${flow.roomId === r.id ? 'border-brand bg-brand text-white' : isFull ? 'border-gray-100 bg-gray-50 text-gray-300' : 'border-gray-100 bg-white text-gray-700'}`}><div className="text-sm font-bold">Rm {r.name}</div><div className={`text-xs ${flow.roomId === r.id ? 'text-blue-200' : isFull ? 'text-red-300' : 'text-emerald-600'}`}>{occupiedCount}/{r.beds} filled</div></button>)})}</div></div>)}</div><div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-end gap-3"><button onClick={onClose} className="px-6 py-3 rounded-xl text-sm font-bold text-gray-500 hover:bg-gray-200">Cancel</button><button disabled={!flow.roomId} onClick={() => onAssign(flow.roomId)} className="px-8 py-3 rounded-xl bg-brand text-white text-sm font-bold shadow-lg disabled:opacity-50">Confirm</button></div></div></div>, document.body);
  }

  function CertificateDrawer({ isOpen, target, html, isSending, status, onClose, onEmail, onPrint }) {
    if (!isOpen) return null;
    return createPortal(<div className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}><div className="bg-white w-full max-w-5xl rounded-t-3xl p-8 h-[92vh] flex flex-col shadow-2xl transition-all" onClick={e => e.stopPropagation()}><div className="flex justify-between items-center mb-6"><div><h3 className="text-2xl font-bold font-display">Issue Certificate</h3><p className="text-sm text-gray-500">Preview and download for {target?.fullName}.</p></div><div className="flex items-center gap-3"><button onClick={() => onEmail(target)} disabled={isSending} className="px-6 py-2.5 rounded-xl border-2 border-blue-100 text-brand font-bold hover:bg-blue-50 disabled:opacity-50 transition-all">{isSending ? "Sending..." : "📧 Email"}</button><button onClick={onPrint} className="px-6 py-2.5 rounded-xl grad-btn text-white font-bold shadow-lg">Download PDF</button><button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-800 transition-all">✕</button></div></div><div className="flex-1 bg-gray-100 rounded-3xl border-4 border-dashed border-gray-200 overflow-hidden flex items-center justify-center p-10"><div id="certPreview" dangerouslySetInnerHTML={{ __html: html }} className="bg-white shadow-2xl p-0 w-[800px] h-[600px] origin-center scale-[0.8] md:scale-[1]" /></div>{status && <div className="mt-4 p-3 bg-blue-50 text-brand rounded-xl text-center font-medium shadow-sm transition-all">{status}</div>}</div></div>, document.body);
  }

  // --- OJS SUBMISSIONS TAB ---
  const SubmissionsTab = ({ API_BASE, OJS_DASHBOARD_URL, getAuthHeaders }) => {
    const [submissions, setSubmissions] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchSubmissions = () => {
        fetch(`${API_BASE}/submissions`, { headers: getAuthHeaders() })
            .then(r => r.ok ? r.json() : []) 
            .then(data => {
                setSubmissions(Array.isArray(data) ? data : []); 
                setLoading(false);
            })
            .catch(err => {
                console.error("Fetch submissions error:", err);
                setLoading(false);
            });
    };

    useEffect(() => { fetchSubmissions(); }, []);

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h2 className="font-display text-2xl font-semibold mb-1">Paper Submissions</h2>
                    <p className="text-sm text-gray-600">Local backups of participant uploads. Reviews are managed via Open Journal Systems (Docker).</p>
                </div>
                <a 
                    href={OJS_DASHBOARD_URL} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="px-6 py-3 rounded-xl bg-brand text-white text-sm font-bold shadow-lg hover:bg-black hover:-translate-y-0.5 transition-all flex items-center gap-2"
                >
                    <span>Open OJS Dashboard</span>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                </a>
            </div>

            <div className="rounded-2xl bg-white/95 border border-gray-100 p-4 shadow-sm overflow-x-auto">
                {submissions.length === 0 && !loading && <p className="text-sm text-gray-500 p-4">No submissions found in Conexus database.</p>}
                
                {submissions.length > 0 && (
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 text-[10px] uppercase font-bold text-gray-400">
                            <tr>
                                <th className="px-6 py-4">Title / Author</th>
                                <th className="px-6 py-4">Event</th>
                                <th className="px-6 py-4">API Sync</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {submissions.map(s => (
                                <tr key={s.id} className="group hover:bg-soft/20 transition-colors">
                                    <td className="px-6 py-4 min-w-0">
                                        <div className="text-sm font-semibold text-gray-800 truncate">{s.title}</div>
                                        <div className="text-[11px] text-gray-500 truncate">{s.user_email}</div>
                                    </td>
                                    <td className="px-6 py-4 text-[11px] text-gray-500 font-medium">
                                        {s.event_title || "Unknown Event"}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`text-[10px] px-2 py-1 rounded-full border ${
                                            s.status === 'under_review' ? 'border-emerald-200 text-emerald-700 bg-emerald-50' : 
                                            'border-amber-200 text-amber-700 bg-amber-50'
                                        }`}>
                                            ✅ Synced to OJS
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex gap-2 justify-end">
                                            <a href={`https://conexus-backend-production.up.railway.app/${s.file_path}`} target="_blank" rel="noreferrer" className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-[10px] font-bold shadow-sm hover:bg-gray-50 transition">
                                                Download Local
                                            </a>
                                            <a href={OJS_DASHBOARD_URL} target="_blank" rel="noreferrer" className="px-3 py-1.5 rounded-lg bg-brand text-white text-[10px] font-bold shadow-sm hover:bg-black transition">
                                                Review in OJS
                                            </a>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
  };

  const CertificatesTab = ({ events, registrations, onIssueCert, onEmail, batchStatus, onBatchEmail, onOpenDesigner }) => {
    const [filterEvent, setFilterEvent] = useState("all");
    const [filterIssued, setFilterIssued] = useState("all"); 
    const [search, setSearch] = useState("");
    const [selectedIds, setSelectedIds] = useState(new Set());

    // Filter Logic
    const visible = registrations.filter(r => {
        const matchesEvent = filterEvent === "all" || String(r.eventId) === filterEvent;
        const matchesSearch = (r.fullName + r.userEmail).toLowerCase().includes(search.toLowerCase());
        const isApproved = r.status === "Approved";
        
        const isIssued = !!r.certificateIssuedAt; 
        const matchesIssueStatus = 
            filterIssued === "all" ? true :
            filterIssued === "issued" ? isIssued :
            !isIssued; 

        return isApproved && matchesEvent && matchesSearch && matchesIssueStatus;
    });

    const toggleSelect = (id) => { const newSet = new Set(selectedIds); if (newSet.has(id)) newSet.delete(id); else newSet.add(id); setSelectedIds(newSet); };
    const toggleSelectAll = () => { if (selectedIds.size === visible.length) setSelectedIds(new Set()); else setSelectedIds(new Set(visible.map(r => r.id))); };
    const getTargets = () => { if (selectedIds.size > 0) return visible.filter(r => selectedIds.has(r.id)); return visible; };

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
                <h2 className="font-display text-2xl font-bold text-gray-900">Certificates</h2>
                <p className="text-sm text-gray-500 mt-1">Issue and track certificates for approved attendees.</p>
                <button onClick={onOpenDesigner} className="mt-3 px-4 py-2 bg-brand text-white rounded-xl text-xs font-bold shadow-md hover:bg-black transition-all inline-flex items-center gap-2">
                    <span>🎨</span> Open Visual Designer
                </button>
            </div>
            <div className="flex flex-col gap-2 items-end">
                <div className="flex gap-2">
                    <select value={filterEvent} onChange={e => { setFilterEvent(e.target.value); setSelectedIds(new Set()); }} className="text-xs font-bold rounded-xl border border-gray-200 px-3 py-2 bg-white text-gray-600 outline-none focus:border-brand">
                        <option value="all">All Events</option>
                        {events.map(e => <option key={e.id} value={String(e.id)}>{e.title}</option>)}
                    </select>
                    <select value={filterIssued} onChange={e => setFilterIssued(e.target.value)} className="text-xs font-bold rounded-xl border border-gray-200 px-3 py-2 bg-white text-gray-600 outline-none focus:border-brand">
                        <option value="all">All Statuses</option>
                        <option value="pending">Pending Issuance</option>
                        <option value="issued">Already Issued</option>
                    </select>
                </div>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search participant..." className="rounded-xl border border-gray-200 px-4 py-2 text-xs w-64 bg-white outline-none focus:border-brand" />
            </div>
        </div>

        {/* Batch Action Bar */}
        <div className="rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 p-5 flex items-center justify-between shadow-sm">
            <div>
                <h3 className="text-sm font-bold text-brand flex items-center gap-2">
                    <span>⚡</span> Batch Processing
                </h3>
                <p className="text-xs text-blue-600 mt-1">
                    {selectedIds.size > 0 ? `${selectedIds.size} participants selected.` : `Select participants below to batch issue.`}
                </p>
            </div>
            {batchStatus.state === 'idle' || batchStatus.state === 'complete' ? (
                <button 
                    onClick={() => onBatchEmail(getTargets())} 
                    disabled={selectedIds.size === 0} 
                    className="px-5 py-2 bg-brand text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition shadow-md disabled:opacity-50 disabled:shadow-none"
                >
                    Email Selected
                </button>
            ) : (
                <div className="w-48 space-y-2">
                    <div className="flex justify-between text-[10px] font-bold text-brand"><span>Sending... {batchStatus.processed}/{batchStatus.total}</span></div>
                    <div className="h-1.5 bg-blue-200 rounded-full overflow-hidden"><div className="h-full bg-brand transition-all duration-300" style={{ width: `${(batchStatus.processed / batchStatus.total) * 100}%` }}></div></div>
                </div>
            )}
        </div>

        {/* Main List */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-xl shadow-gray-200/40 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50 flex items-center gap-3">
                <input type="checkbox" checked={visible.length > 0 && selectedIds.size === visible.length} onChange={toggleSelectAll} className="rounded border-gray-300 text-brand focus:ring-brand w-4 h-4" />
                <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">Select All</span>
            </div>
            
            <div className="divide-y divide-gray-50 max-h-[600px] overflow-y-auto">
                {visible.length === 0 ? (
                    <div className="p-8 text-center text-sm text-gray-400 italic">No approved participants found.</div>
                ) : visible.map(r => {
                    const isIssued = !!r.certificateIssuedAt;
                    return (
                        <div key={r.id} className={`flex items-center justify-between p-5 transition-all hover:bg-blue-50/30 ${selectedIds.has(r.id) ? 'bg-blue-50/40' : ''}`}>
                            <div className="flex items-center gap-4">
                                <input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggleSelect(r.id)} className="rounded border-gray-300 text-brand focus:ring-brand w-4 h-4" />
                                <div>
                                    <div className="text-sm font-bold text-gray-900">{r.fullName}</div>
                                    <div className="text-xs text-gray-500">{r.eventTitle}</div>
                                </div>
                                {isIssued && (
                                    <span className="ml-2 px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700 text-[10px] font-bold border border-emerald-200 uppercase tracking-wide">
                                        Issued
                                    </span>
                                )}
                            </div>
                            <button 
                                onClick={() => onIssueCert(r)} 
                                className={`px-4 py-1.5 rounded-lg text-xs font-bold shadow-sm transition-all border ${
                                    isIssued 
                                    ? "bg-white text-gray-600 border-gray-200 hover:bg-gray-50" 
                                    : "grad-btn text-white border-transparent hover:shadow-md"
                                }`}
                            >
                                {isIssued ? "Re-issue" : "Issue Cert"}
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
      </div>
    );
  };

  const DashboardTab = ({ events, registrations, onCreateEvent, onExport, onEditEvent, onDeleteEvent }) => {
    const eventStats = events.map(ev => {
      const regs = registrations.filter(r => r.eventId === ev.id);
      return { ...ev, participants: regs.reduce((sum, r) => sum + (r.participantsCount || 1), 0), pending: regs.filter(r => r.status === "For approval").length };
    });
    const maxParticipants = eventStats.length ? Math.max(1, ...eventStats.map(e => e.participants)) : 1;
    return (
      <div className="space-y-8"><div className="flex items-start justify-between gap-4"><div><h2 className="font-display text-3xl font-bold mb-2">Admin dashboard</h2><p className="text-base text-gray-500">Snapshot of events and registrations.</p></div><div className="flex items-center gap-4"><button onClick={onCreateEvent} className="px-6 py-3 rounded-full bg-brand text-white text-sm font-semibold shadow-lg hover:bg-brandLight transition-all">Create Event</button><button onClick={() => onExport(eventStats)} className="px-6 py-3 rounded-full bg-amber-500 text-white text-sm font-semibold shadow-lg hover:bg-amber-600 transition-all">Export CSV</button></div></div>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-2"><div className="hover-card rounded-3xl bg-white border border-gray-100 p-7 shadow-sm"><p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-2">Active events</p><p className="text-4xl font-extrabold text-gray-800">{events.length}</p></div><div className="hover-card rounded-3xl bg-white border border-gray-100 p-7 shadow-sm"><p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-2">Total registrations</p><p className="text-4xl font-extrabold text-gray-800">{registrations.length}</p></div></div>
      <div className="rounded-3xl bg-white border border-gray-100 p-8 shadow-sm"><div className="flex items-center justify-between mb-8"><h3 className="font-bold text-xl text-gray-800">Participants per event</h3></div>{eventStats.length === 0 ? <div className="text-center py-12 text-gray-400">No events yet.</div> : (<div className="space-y-8">{eventStats.map(ev => {const pct = maxParticipants ? Math.round((ev.participants / maxParticipants) * 100) : 0;return (<div key={ev.id} className="group"><div className="flex items-center justify-between mb-3"><span className="text-base font-bold text-gray-700 truncate max-w-md">{ev.title}</span><div className="flex items-center gap-4"><span className="text-sm text-gray-400 font-medium">{ev.participants} pax</span><button onClick={() => onEditEvent(ev)} className="px-4 py-1.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50">Edit</button><button onClick={() => onDeleteEvent(ev.id)} className="px-4 py-1.5 rounded-xl border border-red-100 text-sm font-semibold text-red-500 hover:bg-red-50">Delete</button></div></div><div className="h-3 rounded-full bg-gray-100 overflow-hidden"><div className="h-full bg-gradient-to-r from-brand to-accent1 rounded-full transition-all duration-700" style={{ width: Math.max(2, pct) + "%" }} /></div></div>);})}</div>)}</div></div>
    );
  };

  const RegistrationsTab = ({ events, registrations, rooms, dorms, onUpdateStatus, onAssign, onNfc, onPreview, onCert, onDelete, onRevoke }) => {
    const [filterEvent, setFilterEvent] = useState("all");
    const [filterStatus, setFilterStatus] = useState("all");
    const filtered = registrations.filter(r => (filterEvent === "all" || String(r.eventId) === filterEvent) && (filterStatus === "all" || r.status === filterStatus));
    
    const handleWriteNFC = async (participant) => {
        if (!('NDEFReader' in window)) {
            alert('⚠️ Web NFC is not supported on this device. Please use Google Chrome on an Android phone or tablet.');
            return;
        }
        try {
            const slug = participant.profile_slug || `user-${participant.id}`;
            const nfcUrl = `https://cconexus.vercel.app/?nfc=${slug}`;
            const ndef = new window.NDEFReader();
            
            alert(`Ready to write! Tap the blank NFC card against the back of your phone now.`);
            
            await ndef.write({
                records: [{ recordType: "url", data: nfcUrl }]
            });
            alert(`✅ Success! ${participant.fullName}'s Digital Business Card is now linked.`);
        } catch (error) {
            console.error("NFC Write Error:", error);
            alert(`❌ Failed to write to card. Error: ${error.message}`);
        }
    };
    
    return (
      <div className="space-y-6">
        {/* Header Controls */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-bold text-gray-900">Registrations</h2>
            <p className="text-sm text-gray-500 mt-1">Manage attendee approvals, assignments, and check-in details.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <select value={filterEvent} onChange={e => setFilterEvent(e.target.value)} className="flex-1 md:flex-none text-xs font-semibold rounded-xl border border-gray-200 px-4 py-2.5 bg-white text-gray-600 focus:border-brand outline-none shadow-sm hover:border-gray-300 transition-colors">
                <option value="all">All Events</option>
                {events.map(e => <option key={e.id} value={String(e.id)}>{e.title}</option>)}
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="flex-1 md:flex-none text-xs font-semibold rounded-xl border border-gray-200 px-4 py-2.5 bg-white text-gray-600 focus:border-brand outline-none shadow-sm hover:border-gray-300 transition-colors">
                <option value="all">All Statuses</option>
                <option>For approval</option>
                <option>Approved</option>
                <option>Rejected</option>
            </select>
          </div>
        </div>

        {/* Main Table Container (MOBILE FRIENDLY SCROLL) */}
        <div className="rounded-3xl bg-white border border-gray-100 shadow-xl shadow-gray-200/40 overflow-hidden">
          <div className="overflow-x-auto w-full scrollbar-hide">
            {/* Added min-w-[1050px] so it never squishes columns on small screens */}
            <table className="w-full text-left border-collapse min-w-[1050px]">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-100 text-[10px] uppercase font-extrabold text-gray-400 tracking-wider">
                    <th className="px-6 py-4">Participant Details</th>
                    <th className="px-4 py-4">Status</th>
                    <th className="px-4 py-4">Accommodation</th>
                    <th className="px-4 py-4">NFC Identity</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.length === 0 ? (
                    <tr>
                        <td colSpan="5" className="px-6 py-12 text-center text-gray-400 text-sm italic">
                            No registrations found matching your filters.
                        </td>
                    </tr>
                ) : filtered.map(r => {
                  const isApproved = r.status === "Approved";
                  const isRejected = r.status === "Rejected";
                  const assignedRoom = rooms.find(rm => String(rm.id) === String(r.roomId));
                  const assignedPlace = assignedRoom ? dorms.find(d => String(d.id) === String(assignedRoom.dormId)) : null;
                  
                  return (
                    <tr key={r.id} className="group hover:bg-blue-50/40 transition-all duration-200">
                      
                      {/* 1. Participant Info */}
                      <td className="px-6 py-4 align-middle">
                        <div className="flex flex-col">
                            <span className="text-sm font-bold text-gray-900 group-hover:text-brand transition-colors">{r.fullName}</span>
                            <span className="text-xs text-gray-500 mt-0.5">{r.userEmail}</span>
                            <span className="text-[10px] text-brand bg-blue-50 border border-blue-100 mt-1.5 px-2 py-0.5 rounded-md w-fit font-semibold">{r.eventTitle}</span>
                        </div>
                      </td>

                      {/* 2. Status Badge */}
                      <td className="px-4 py-4 align-middle">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border ${
                            isApproved ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 
                            isRejected ? 'bg-red-50 text-red-600 border-red-200' : 
                            'bg-amber-50 text-amber-600 border-amber-200' /* Changed For Approval to amber */
                        }`}>
                            <span className={`w-1.5 h-1.5 rounded-full mr-2 ${isApproved ? 'bg-emerald-500' : isRejected ? 'bg-red-500' : 'bg-amber-500'}`}></span>
                            {r.status}
                        </span>
                      </td>
                      
                      {/* 3. Accommodation Assignment */}
                      <td className="px-4 py-4 align-middle">
                        {assignedRoom ? (
                          <button 
                            onClick={() => onAssign(r)} 
                            className="group/btn flex items-center gap-2 px-3 py-1.5 rounded-lg border border-blue-100 bg-blue-50/50 hover:bg-white hover:border-blue-300 hover:shadow-sm transition-all"
                            title="Click to change assignment"
                          >
                             <span className="text-lg leading-none">🛏️</span>
                             <div className="text-left whitespace-nowrap">
                                <div className="text-xs font-bold text-gray-700 group-hover/btn:text-brand">
                                    {assignedPlace?.name || '...'} <span className="text-gray-400 mx-1">•</span> {assignedRoom.name}
                                </div>
                             </div>
                          </button>
                        ) : (
                          <button 
                            onClick={() => onAssign(r)} 
                            className="px-3 py-1.5 rounded-lg border border-dashed border-gray-300 text-xs font-bold text-gray-400 hover:text-brand hover:border-brand hover:bg-blue-50 transition-all flex items-center gap-2 whitespace-nowrap"
                          >
                            <span>+</span> Assign Room
                          </button>
                        )}
                      </td>

                      {/* 4. NFC Column */}
                      <td className="px-4 py-4 align-middle">
                        {r.nfc_card_id ? (
                          <button 
                            onClick={() => onNfc(r)} 
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-200 hover:border-brand hover:shadow-sm group/nfc transition-all whitespace-nowrap"
                          >
                            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                            <span className="font-mono text-xs font-bold text-gray-600 group-hover/nfc:text-brand">{r.nfc_card_id}</span>
                          </button>
                        ) : (
                          <button onClick={() => onNfc(r)} className="px-3 py-1.5 rounded-lg border border-gray-200 bg-gray-50 text-xs font-bold text-gray-500 hover:text-brand hover:border-brand hover:bg-blue-50 transition-all whitespace-nowrap flex items-center gap-2">
                            <span>🔗</span> Link Card
                          </button>
                        )}
                      </td>

                      {/* 5. Actions (MODERN PROFESSIONAL UI) */}
                      <td className="px-6 py-4 align-middle text-right">
                          <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                              
                              {/* NFC Writer - Soft Secondary */}
                              <button 
                                  onClick={() => handleWriteNFC(r)}
                                  className="h-8 w-8 flex items-center justify-center rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                                  title="Write to physical NFC Card (Android Only)"
                              >
                                  📳
                              </button>

                              {/* Preview - Outline Secondary */}
                              <button 
                                  onClick={() => onPreview(r)} 
                                  className="h-8 px-3 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-xs font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                              >
                                Preview
                              </button>
                              
                              {!isApproved && !isRejected && (
                                  <>
                                      {/* Approve - Flat Primary Success */}
                                      <button 
                                          onClick={() => onUpdateStatus(r.id, "Approved", r.roomId)} 
                                          className="h-8 px-4 flex items-center justify-center rounded-lg bg-emerald-500 text-white text-xs font-medium hover:bg-emerald-600 transition-colors"
                                      >
                                        Approve
                                      </button>

                                      {/* Reject - Flat Primary Danger */}
                                      <button 
                                          onClick={() => onRevoke(r)} 
                                          className="h-8 px-4 flex items-center justify-center rounded-lg bg-rose-500 text-white text-xs font-medium hover:bg-rose-600 transition-colors"
                                      >
                                        Reject
                                      </button>
                                  </>
                              )}

                              {isApproved && (
                                  /* Revoke - Flat Primary Warning */
                                  <button 
                                      onClick={() => onRevoke(r)} 
                                      className="h-8 px-4 flex items-center justify-center rounded-lg bg-amber-500 text-white text-xs font-medium hover:bg-amber-600 transition-colors"
                                  >
                                    Revoke
                                  </button>
                              )}
                              
                              {/* Delete - Ghost Icon */}
                              <button 
                                  onClick={() => onDelete(r.id)} 
                                  className="h-8 w-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors ml-1" 
                                  title="Delete Registration"
                              >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                              </button>
                          </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const AccommodationTab = ({ dorms, rooms, registrations, onAddDorm, onDeleteDorm, onAddRoom, onDeleteRoom }) => {
    const [filterDorm, setFilterDorm] = useState("all");
    const [search, setSearch] = useState("");
    const [newDormName, setNewDormName] = useState("");
    const [newDormType, setNewDormType] = useState("Dorm");
    const [roomForm, setRoomForm] = useState({ dormId: "", name: "", beds: 1 });

    // FILTER LOGIC
    const filteredRooms = rooms.filter(room => {
      const matchesDormSelect = filterDorm === "all" || String(room.dormId) === filterDorm;
      const dorm = dorms.find(d => d.id === room.dormId);
      const assignedPeople = registrations.filter(r => String(r.roomId) === String(room.id) && r.status === "Approved");
      
      const query = search.toLowerCase();
      const matchesSearch = !search || 
          (dorm?.name || "").toLowerCase().includes(query) || 
          (room.name || "").toLowerCase().includes(query) || 
          assignedPeople.some(p => (p.fullName || "").toLowerCase().includes(query));

      return matchesDormSelect && matchesSearch;
    });

    const handleDormSubmit = (e) => { 
      e.preventDefault(); 
      if (newDormName) onAddDorm(newDormName, newDormType).then(() => setNewDormName("")); 
    };

    const handleRoomSubmit = (e) => { 
      e.preventDefault(); 
      if (roomForm.name && roomForm.dormId) onAddRoom(roomForm).then(() => setRoomForm({ ...roomForm, name: "", beds: 1 })); 
    };

    return (
      <div className="space-y-8">
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h2 className="font-display text-3xl font-bold mb-1">Accommodation</h2>
          <div className="flex flex-col md:flex-row gap-3">
            <input 
                type="text" 
                placeholder="Search person, room, or place..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="rounded-full border-2 border-gray-200 px-4 py-2 bg-white text-sm outline-none focus:border-brand w-full md:w-64"
            />
            <select value={filterDorm} onChange={e => setFilterDorm(e.target.value)} className="text-sm rounded-full border-2 border-gray-200 px-4 py-2 bg-white text-gray-700 font-semibold focus:border-brand outline-none">
                <option value="all">All Locations</option>
                {dorms.map(d => <option key={d.id} value={String(d.id)}>{d.name} ({d.type})</option>)}
            </select>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* LEFT COLUMN: CONTROLS */}
          <div className="lg:col-span-1 space-y-6">
            
            {/* 1. ADD PLACE FORM */}
            <div className="rounded-3xl bg-white border border-gray-100 p-6 shadow-sm">
              <h3 className="font-bold text-lg mb-4">Add Place</h3>
              <form onSubmit={handleDormSubmit} className="space-y-4">
                <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
                  {['Dorm', 'Hotel'].map(t => (
                    <button key={t} type="button" onClick={() => setNewDormType(t)} className={`flex-1 py-2 rounded-lg text-xs font-bold ${newDormType === t ? "bg-white shadow-sm text-brand" : "text-gray-500"}`}>{t}</button>
                  ))}
                </div>
                <input value={newDormName} onChange={e => setNewDormName(e.target.value)} className="w-full rounded-xl border-2 border-gray-100 px-4 py-2 text-sm" placeholder="Location Name..." />
                <button className="w-full py-3 rounded-xl grad-btn text-white font-bold text-sm">Create Location</button>
              </form>
            </div>

            {/* 2. ADD ROOM FORM */}
            <div className="rounded-3xl bg-white border border-gray-100 p-6 shadow-sm">
              <h3 className="font-bold text-lg mb-4">Add Room</h3>
              <form onSubmit={handleRoomSubmit} className="space-y-4">
                <select value={roomForm.dormId} onChange={e => setRoomForm({ ...roomForm, dormId: e.target.value })} className="w-full rounded-xl border-2 border-gray-100 px-4 py-2 text-sm">
                  <option value="">Select Location...</option>
                  {dorms.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                <input value={roomForm.name} onChange={e => setRoomForm({ ...roomForm, name: e.target.value })} className="w-full rounded-xl border-2 border-gray-100 px-4 py-2 text-sm" placeholder="Room Name (e.g. 101)..." />
                <input type="number" value={roomForm.beds} onChange={e => setRoomForm({ ...roomForm, beds: parseInt(e.target.value) })} className="w-full rounded-xl border-2 border-gray-100 px-4 py-2 text-sm" placeholder="Beds" min="1" />
                <button className="w-full py-3 rounded-xl bg-brand text-white font-bold text-sm">Add Room</button>
              </form>
            </div>

            {/* 3. NEW: MANAGE LOCATIONS (DELETE DORMS) */}
            <div className="rounded-3xl bg-white border border-gray-100 p-6 shadow-sm">
                <h3 className="font-bold text-lg mb-4">Manage Locations</h3>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-2 scrollbar-hide">
                    {dorms.map(dorm => (
                        <div key={dorm.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100 group hover:bg-red-50 hover:border-red-100 transition-colors">
                            <div>
                                <div className="text-sm font-bold text-gray-700">{dorm.name}</div>
                                <div className="text-[10px] text-gray-400 uppercase tracking-widest">{dorm.type}</div>
                            </div>
                            <button 
                                onClick={() => onDeleteDorm(dorm.id)} 
                                className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                                title="Delete Location and all its rooms"
                            >
                                🗑️
                            </button>
                        </div>
                    ))}
                    {dorms.length === 0 && <p className="text-xs text-gray-400 italic text-center">No locations created yet.</p>}
                </div>
            </div>

          </div>

          {/* RIGHT COLUMN: ROOMS LIST */}
          <div className="lg:col-span-2 space-y-4">
            {filteredRooms.length === 0 ? (
                <div className="p-12 text-center text-gray-400 bg-gray-50 rounded-[32px] border border-dashed border-gray-200">
                    <p className="text-sm font-bold">No rooms found.</p>
                    <p className="text-xs mt-1">Create a location and add a room to get started.</p>
                </div>
            ) : filteredRooms.map(room => {
              const dorm = dorms.find(d => d.id === room.dormId);
              const assignedPeople = registrations.filter(r => String(r.roomId) === String(room.id) && r.status === "Approved");
              return (
                <div key={room.id} className="bg-white rounded-[32px] border border-gray-100 p-6 shadow-sm flex justify-between items-start animate-fade-in-up">
                  <div className="flex-1">
                    <h4 className="text-lg font-extrabold text-gray-800">{dorm?.name} — {room.name}</h4>
                    <p className="text-xs text-gray-400 mb-4">{assignedPeople.length}/{room.beds} beds occupied</p>
                    <div className="bg-gray-50 rounded-2xl p-4 space-y-2">
                      {assignedPeople.length > 0 ? assignedPeople.map(p => (
                        <div key={p.id} className="text-xs font-semibold text-gray-700 bg-white p-2 rounded-xl border border-gray-100 flex items-center gap-2">
                            <span>👤</span> 
                            <span className={search && p.fullName.toLowerCase().includes(search.toLowerCase()) ? "bg-yellow-200" : ""}>
                                {p.fullName}
                            </span>
                        </div>
                      )) : <p className="text-[10px] text-gray-400 italic">No one assigned yet</p>}
                    </div>
                  </div>
                  <button onClick={() => onDeleteRoom(room.id)} className="text-red-400 hover:text-red-600 p-2 ml-4 bg-white rounded-xl border border-transparent hover:border-red-100 hover:shadow-sm transition-all">🗑️</button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const PortalsTab = ({ portals, events, onCreatePortal, onDeletePortal }) => {
    const [filterEvent, setFilterEvent] = useState("all");
    const [form, setForm] = useState({ eventId: "", name: "" });
    const filtered = portals.filter(p => filterEvent === "all" || String(p.eventId) === filterEvent);
    const handleSubmit = (e) => { e.preventDefault(); onCreatePortal(form).then(ok => ok && setForm({ eventId: "", name: "" })); };
    const openPortal = (p) => {
      const event = events.find(e => e.id === p.eventId) || {};
      window.localStorage.setItem("conexus_portal_" + p.id, JSON.stringify({ portal: p, event }));
      window.open(`/attendance-portal.html?portal=${p.id}`, "_blank");
    };
    return (
      <div className="space-y-4">
        <div className="flex items-end justify-between gap-3"><div><h2 className="font-display text-2xl font-semibold mb-1">Portals</h2><p className="text-sm text-gray-600">Create attendance portals per event.</p></div><select value={filterEvent} onChange={e => setFilterEvent(e.target.value)} className="text-xs rounded-full border border-gray-200 px-3 py-1.5 bg-white text-gray-700"><option value="all">All events</option>{events.map(e => <option key={e.id} value={String(e.id)}>{e.title}</option>)}</select></div>
        <div className="rounded-2xl bg-white/95 border border-gray-100 p-5 shadow-sm">
          <form onSubmit={handleSubmit} className="grid gap-2 sm:grid-cols-3 mb-4">
            <select value={form.eventId} onChange={e => setForm({ ...form, eventId: e.target.value })} className="rounded-xl border border-gray-200 px-3 py-2 bg-white text-sm outline-none"><option value="">Select event</option>{events.map(e => <option key={e.id} value={String(e.id)}>{e.title}</option>)}</select>
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="rounded-xl border border-gray-200 px-3 py-2 bg-white text-sm" placeholder="Portal name" />
            <button className="px-4 py-2 rounded-xl grad-btn text-white text-sm font-semibold">Create</button>
          </form>
          <div className="space-y-2">
            {filtered.map(p => (<div key={p.id} className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-soft/60 p-3"><div className="min-w-0"><div className="text-sm font-semibold text-gray-800 truncate">{p.name}</div><div className="text-[11px] text-gray-500 truncate">{p.eventTitle}</div></div><div className="flex items-center gap-2"><button onClick={() => openPortal(p)} className="px-3 py-1.5 rounded-lg bg-brand text-white text-[11px] font-bold">Open</button><button onClick={() => onDeletePortal(p.id)} className="px-3 py-1.5 rounded-lg border border-rose-200 text-rose-600 bg-white text-[11px] font-bold">Delete</button></div></div>))}
          </div>
        </div>
      </div>
    );
  };

  const AttendanceTab = ({ logs }) => (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold mb-1">Attendance Logs</h2>
          <p className="text-sm text-gray-600">Real-time scan logs.</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 rounded-full border border-emerald-100">
            <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest">Live Syncing</span>
        </div>
      </div>
      <div className="rounded-2xl bg-white/95 border border-gray-100 p-5 overflow-x-auto shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-gray-500 border-b border-gray-100">
            <tr>
              <th className="pb-4 font-medium">Participant</th>
              <th className="pb-4 font-medium">Event</th>
              <th className="pb-4 font-medium">Room</th>
              <th className="pb-4 font-medium text-right">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {logs.length === 0 ? (
               <tr><td colSpan="4" className="py-10 text-center text-gray-400 italic">No logs recorded yet.</td></tr>
            ) : logs.map((log, idx) => (
              <tr key={log.id} className={classNames("group hover:bg-soft/50 transition-all", idx === 0 ? "bg-blue-50/30" : "")}>
                <td className="py-3 font-medium text-gray-800">{log.participant_name}</td>
                <td className="py-3 text-gray-600">{log.event_title}</td>
                <td className="py-3">
                  <span className="bg-blue-50 text-brand px-2 py-1 rounded text-xs font-semibold border border-blue-100">
                    {log.room_name}
                  </span>
                </td>
                <td className="py-3 text-right text-gray-400 font-mono text-xs">{formatDateTime(log.scanned_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  // ==========================================
  // MAIN COMPONENT
  // ==========================================
  function AdminDashboard(props) {
    const user = props.user || {};
    const [section, setSection] = useState("dashboard");
    
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const [events, setEvents] = useState([]);
    const [registrations, setRegistrations] = useState([]);
    const [dorms, setDorms] = useState([]);
    const [rooms, setRooms] = useState([]);
    const [portals, setPortals] = useState([]);
    const [logs, setLogs] = useState([]);

    const [createEventOpen, setCreateEventOpen] = useState(false);
    const [createEventSaving, setCreateEventSaving] = useState(false);
    const [editEventId, setEditEventId] = useState(null);
    const [eventForm, setEventForm] = useState({ title: "", description: "", startDate: "", endDate: "", location: "", featured: false });
    const [nfcModalOpen, setNfcModalOpen] = useState(false);
    const [nfcTargetReg, setNfcTargetReg] = useState(null);
    const [assignModalOpen, setAssignModalOpen] = useState(false);
    const [assignTargetReg, setAssignTargetReg] = useState(null);
    const [certDrawerOpen, setCertDrawerOpen] = useState(false);
    const [certTarget, setCertTarget] = useState(null);
    const [certEmailSending, setCertEmailSending] = useState(false);
    const [certEmailStatus, setCertEmailStatus] = useState("");
    const [batchStatus, setBatchStatus] = useState({ state: 'idle', processed: 0, total: 0, errors: 0 });
    const [previewTarget, setPreviewTarget] = useState(null);
    
    // NEW: State for Revoke Modal
    const [revokeTarget, setRevokeTarget] = useState(null);

    const loadData = () => {
      Promise.all([
        fetch(`${API_BASE}/events`).then(r => r.ok ? r.json() : []).catch(() => []),
        fetch(`${API_BASE}/registrations`, { headers: getAuthHeaders() }).then(r => r.ok ? r.json() : []).catch(() => []), 
        fetch(`${API_BASE}/portals`, { headers: getAuthHeaders() }).then(r => r.ok ? r.json() : []).catch(() => []), 
        fetch(`${API_BASE}/dorms`, { headers: getAuthHeaders() }).then(r => r.ok ? r.json() : []).catch(() => []), 
        fetch(`${API_BASE}/rooms`, { headers: getAuthHeaders() }).then(r => r.ok ? r.json() : []).catch(() => []), 
        fetch(`${API_BASE}/attendance_logs`, { headers: getAuthHeaders() }).then(r => r.ok ? r.json() : []).catch(() => []) 
      ]).then(([ev, reg, por, dor, roo, lgs]) => {
        setEvents(Array.isArray(ev) ? ev.map(normalizeEvent) : []);
        setRegistrations(Array.isArray(reg) ? reg.map(normalizeRegistration) : []);
        setPortals(Array.isArray(por) ? por.map(normalizePortal) : []);
        setDorms(Array.isArray(dor) ? dor.map(normalizeDorm) : []);
        setRooms(Array.isArray(roo) ? roo.map(normalizeRoom) : []);
        setLogs(Array.isArray(lgs) ? lgs : []);
      });
    };

    useEffect(() => { loadData(); }, []);

    useEffect(() => {
        let interval;
        if (section === "attendance") {
            const fetchLogs = () => {
                fetch(`${API_BASE}/attendance_logs`, { headers: getAuthHeaders() }) 
                    .then(r => r.ok ? r.json() : []) 
                    .then(data => setLogs(Array.isArray(data) ? data : [])) 
                    .catch(console.error);
            };

            fetchLogs();
            interval = setInterval(fetchLogs, 3000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [section]);

    const handleExport = (stats) => {
      const rows = [['Event', 'Participants', 'Pending', 'Approved', 'Start Date'], ...stats.map(ev => [ev.title, ev.participants, ev.pending, ev.approved, ev.startDate])];
      downloadBlob({ content: rows.map(e => e.join(",")).join("\n"), mime: 'text/csv', filename: `export_${new Date().toISOString().slice(0, 10)}.csv` });
    };

    const saveEvent = async (e) => {
      e.preventDefault();
      setCreateEventSaving(true);
      try {
        const isEdit = !!editEventId;
        const url = isEdit ? `${API_BASE}/events/${editEventId}` : `${API_BASE}/create_event`;
        const method = isEdit ? "PUT" : "POST";

        const res = await fetch(url, {
            method: method,
            headers: getAuthHeaders(),
            body: JSON.stringify(eventForm)
        });
        
        const data = await res.json();
        if (data.success) { loadData(); setCreateEventOpen(false); }
        else { alert("Failed: " + (data.error || "Unknown Error")); }
      } catch (err) { alert("Save failed"); }
      setCreateEventSaving(false);
    };
    
    const handleDeleteEvent = async (id) => { 
        if (confirm("Delete event?")) { 
            setEvents(prev => prev.filter(e => e.id !== id));
            try {
                await fetch(`${API_BASE}/delete_event/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
            } catch (e) {
                loadData(); 
            }
        } 
    };

    const handleUpdateStatus = async (id, status, roomId, note = null) => {
      setRegistrations(p => p.map(r => r.id === id ? { ...r, status, roomId, adminNote: note } : r));
      const payload = { status, room_id: roomId };
      if (note) payload.admin_note = note;

      await fetch(`${API_BASE}/registrations/${id}`, { 
          method: 'PUT', 
          headers: getAuthHeaders(),
          body: JSON.stringify(payload) 
      });
      loadData();
    };

    const handleRevokeConfirm = async (note) => {
        if (revokeTarget) {
            await handleUpdateStatus(revokeTarget.id, "Rejected", null, note);
            setRevokeTarget(null);
        }
    };

    const handleDeleteRegistration = async (id) => { 
        if (confirm("Delete?")) { 
            setRegistrations(prev => prev.filter(r => r.id !== id));
            try {
                await fetch(`${API_BASE}/registrations/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
            } catch (e) {
                loadData();
            }
        } 
    };

    const handleNfcSubmit = async (scannedId) => {
      setRegistrations(prev => prev.map(r => 
        r.id === nfcTargetReg.id ? { ...r, nfc_card_id: scannedId } : r
      ));
      setNfcModalOpen(false);

      try {
        const res = await fetch(`${API_BASE}/registrations/${nfcTargetReg.id}/assign-nfc`, {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify({ nfc_card_id: scannedId })
        });
        
        const data = await res.json();
        if (!data.success) {
          alert(data.message || "Failed to link card");
          loadData(); 
        }
      } catch (err) {
        alert("Server error linking card");
        loadData();
      }
    };

    const handleAddDorm = async (name, type) => { 
        await fetch(`${API_BASE}/dorms`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ name, type }) });
        loadData(); 
    };
    
    const handleDeleteDorm = async (id) => { 
        if (confirm("Delete location?")) { 
            setDorms(prev => prev.filter(d => d.id !== id));
            try {
                await fetch(`${API_BASE}/dorms/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
            } catch(e) { loadData(); }
        } 
    };

    const handleAddRoom = async (form) => { 
        await fetch(`${API_BASE}/rooms`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(form) });
        loadData(); 
    };
    
    const handleDeleteRoom = async (id) => { 
        if (confirm("Delete room?")) { 
            setRooms(prev => prev.filter(r => r.id !== id));
            try {
                await fetch(`${API_BASE}/rooms/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
            } catch(e) { loadData(); }
        } 
    };

    const handleCreatePortal = async (form) => { 
        const newPortal = { id: makeUUID(), ...form, createdAt: new Date().toISOString() };
        setPortals(prev => [newPortal, ...prev]);
        try {
            await fetch(`${API_BASE}/portals`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(newPortal) });
        } catch (e) {
            loadData();
        }
        return true; 
    };
    
    const handleDeletePortal = async (id) => { 
        if (confirm("Delete?")) { 
            setPortals(prev => prev.filter(p => p.id !== id));
            try {
                await fetch(`${API_BASE}/portals/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
            } catch(e) { loadData(); }
        } 
    };

    const getCertHtml = () => {
      if (!certTarget) return "";
      const ev = events.find(e => String(e.id) === String(certTarget.eventId)) || { title: "Event" };
      return SafeCertGenerator.generateHTML({ name: certTarget.fullName, eventTitle: ev.title, dateLabel: formatDateRange(ev.startDate, ev.endDate), issuerName: user.name || "Admin", issuerRole: user.university || "Research Office", certificateId: "CX-" + Date.now(), issuedAt: new Date().toLocaleDateString() });
    };

    const handleBatchEmail = async (targets) => {
        setBatchStatus({ state: 'sending', processed: 0, total: targets.length, errors: 0 });
        for(let t of targets) { setBatchStatus(p => ({...p, processed: p.processed + 1})); }
        setBatchStatus(p => ({ ...p, state: 'complete' })); alert("Batch complete!");
    };
    const issueCertNow = () => { const win = window.open('','_blank'); win.document.write(getCertHtml()); win.document.close(); win.print(); };

    if (section === "admin-certificate-designer") return (<section className="relative max-w-7xl mx-auto px-4 py-8"><CertificateDesigner onBack={() => setSection("certificates")} /></section>);

    return (
      <section className="relative max-w-7xl mx-auto px-4 py-8">
        
        {/* UNIFIED HEADER & ANIMATED DROPDOWN (PC & Mobile) */}
        <div className="relative mb-8 z-40">
          
          {/* 1. Top Header Bar */}
          <div className="flex items-center justify-between bg-white rounded-[2rem] border border-gray-100 p-5 md:px-8 md:py-6 shadow-sm relative z-50">
            <div>
              <p className="text-[10px] md:text-xs text-gray-400 mb-1 font-black uppercase tracking-[0.2em]">Conexus Event System</p>
              <p className="font-display text-xl md:text-2xl font-black text-brand tracking-tight flex items-center gap-3">
                 <span className="w-3 h-3 rounded-full bg-[var(--u-gold)] shadow-[0_0_0_4px_rgba(245,197,24,0.15)]"></span>
                 Admin: {user.name || "Administrator"}
              </p>
            </div>
            
            {/* Hamburger Button with Rotation Animation */}
            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} 
              className={classNames(
                  "p-3 md:p-4 rounded-2xl border-2 transition-all duration-300",
                  isMobileMenuOpen ? "bg-brand border-brand text-white shadow-lg" : "bg-gray-50 border-gray-100 text-gray-600 hover:border-gray-200 hover:bg-gray-100"
              )}
              title="Toggle Menu"
            >
              <svg 
                className="w-6 h-6 md:w-7 md:h-7 transition-transform duration-300" 
                style={{ transform: isMobileMenuOpen ? 'rotate(90deg)' : 'rotate(0deg)' }} 
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                {isMobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>

          {/* 2. The Animated Dropdown Menu (Fireship/Facebook Style) */}
          <div 
            className={classNames(
              "absolute top-full right-0 mt-4 w-full md:w-80 bg-white border border-gray-100 rounded-[2rem] shadow-2xl overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] origin-top-right",
              isMobileMenuOpen ? "opacity-100 scale-100 translate-y-0 pointer-events-auto" : "opacity-0 scale-95 -translate-y-4 pointer-events-none"
            )}
          >
            <nav className="flex flex-col p-3">
              {[{ id: "dashboard", label: "Dashboard", icon: "📊" }, { id: "accommodation", label: "Accommodation", icon: "🛏️" }, { id: "registrations", label: "Registrations", icon: "📝" }, { id: "ojs", label: "Submissions", icon: "📄" }, { id: "attendance", label: "Attendance", icon: "🎟️" }, { id: "portals", label: "Portals", icon: "🌐" }, { id: "certificates", label: "Certificates", icon: "🏅" }].map((item) => (
                <button 
                    key={item.id} 
                    onClick={() => {
                        setSection(item.id);
                        setIsMobileMenuOpen(false); // Auto-close when clicked
                    }} 
                    className={classNames(
                        "w-full flex items-center gap-4 rounded-xl px-5 py-4 transition-all duration-200 font-bold text-sm", 
                        section === item.id ? "bg-blue-50 text-brand scale-[0.98]" : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                    )}
                >
                  <div className={classNames(
                      "flex items-center justify-center w-10 h-10 rounded-xl text-lg transition-colors",
                      section === item.id ? "bg-brand text-white shadow-md" : "bg-white border border-gray-100"
                  )}>
                     {item.icon}
                  </div>
                  <span className="flex-1 text-left">{item.label}</span>
                  
                  {/* Arrow indicator for active tab */}
                  {section === item.id && (
                      <svg className="w-5 h-5 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                      </svg>
                  )}
                </button>
              ))}
            </nav>
          </div>

        </div>

        {/* 3. Main Content Area (Now takes full width of the screen) */}
        <main className="min-w-0 animate-fade-in-up">
            {section === "dashboard" && <DashboardTab events={events} registrations={registrations} onCreateEvent={() => { setEditEventId(null); setEventForm({ title: "", description: "", startDate: "", endDate: "", location: "", featured: false }); setCreateEventOpen(true); }} onExport={handleExport} onEditEvent={(ev) => { setEditEventId(ev.id); setEventForm({ ...ev }); setCreateEventOpen(true); }} onDeleteEvent={handleDeleteEvent} />}
            {section === "accommodation" && <AccommodationTab dorms={dorms} rooms={rooms} registrations={registrations} onAddDorm={handleAddDorm} onDeleteDorm={handleDeleteDorm} onAddRoom={handleAddRoom} onDeleteRoom={handleDeleteRoom} />}
            {section === "registrations" && 
                <RegistrationsTab 
                    events={events} 
                    registrations={registrations} 
                    rooms={rooms} 
                    dorms={dorms} 
                    onUpdateStatus={handleUpdateStatus} 
                    onRevoke={(r) => setRevokeTarget(r)}
                    onAssign={(r) => { setAssignTargetReg(r); setAssignModalOpen(true); }} 
                    onNfc={(r) => { setNfcTargetReg(r); setNfcModalOpen(true); }} 
                    onPreview={setPreviewTarget} 
                    onCert={(r) => { setCertTarget(r); setCertDrawerOpen(true); }} 
                    onDelete={handleDeleteRegistration} 
                />
            }
            {section === "ojs" && <SubmissionsTab API_BASE={API_BASE} OJS_DASHBOARD_URL={OJS_DASHBOARD_URL} getAuthHeaders={getAuthHeaders} />}
            {section === "attendance" && <AttendanceTab logs={logs} />}
            {section === "portals" && <PortalsTab portals={portals} events={events} onCreatePortal={handleCreatePortal} onDeletePortal={handleDeletePortal} />}
            {section === "certificates" && <CertificatesTab events={events} registrations={registrations} onIssueCert={(r) => { setCertTarget(r); setCertDrawerOpen(true); }} batchStatus={batchStatus} onBatchEmail={handleBatchEmail} onOpenDesigner={() => setSection("admin-certificate-designer")} />}
        </main>
        
        {/* Modals */}
        <CreateEventModal isOpen={createEventOpen} isSaving={createEventSaving} editId={editEventId} formData={eventForm} onChange={(e) => { const { name, value, type, checked } = e.target; setEventForm(p => ({ ...p, [name]: type === 'checkbox' ? checked : value })); }} onClose={() => setCreateEventOpen(false)} onSave={saveEvent} />
        <NfcModal isOpen={nfcModalOpen} targetReg={nfcTargetReg} onClose={() => setNfcModalOpen(false)} onSubmit={handleNfcSubmit} />
        <AssignRoomModal isOpen={assignModalOpen} targetReg={assignTargetReg} dorms={dorms} rooms={rooms} registrations={registrations} onClose={() => setAssignModalOpen(false)} onAssign={(id) => handleUpdateStatus(assignTargetReg.id, "Approved", id)} />
        <CertificateDrawer isOpen={certDrawerOpen} target={certTarget} html={getCertHtml()} isSending={certEmailSending} status={certEmailStatus} onClose={() => setCertDrawerOpen(false)} onPrint={issueCertNow} />
        <RegistrationPreviewModal reg={previewTarget} onClose={() => setPreviewTarget(null)} />
        
        {/* REVOKE / REJECT MODAL */}
        <RevokeModal 
            isOpen={!!revokeTarget} 
            targetName={revokeTarget?.fullName} 
            isPending={revokeTarget?.status === 'For approval'}
            onClose={() => setRevokeTarget(null)} 
            onConfirm={handleRevokeConfirm} 
        />
      </section>
    );
  }

  window.AdminDashboard = AdminDashboard;
})();