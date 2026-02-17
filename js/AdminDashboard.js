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
  const API_BASE = "http://localhost:8000/api";
  const EMAIL_API = "http://localhost:3000";

  // ==========================================
  // UTILITIES & HELPERS
  // ==========================================
  function classNames(...args) {
    return args.filter(Boolean).join(" ");
  }

  function makeUUID() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  function downloadBlob({ content, mime, filename }) {
    try {
      const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename || "download.bin";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) { console.error("Download failed", e); }
  }

  function formatDateRange(start, end) {
    if (!start) return "";
    try {
      const s = new Date(start);
      const e = end ? new Date(end) : null;
      if (isNaN(s.getTime())) return start;
      const opts = { month: "short", day: "numeric" };
      const sPart = s.toLocaleDateString(undefined, opts);
      const year = s.getFullYear();
      if (e && !isNaN(e.getTime())) {
        const sameMonth = s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear();
        const ePart = e.toLocaleDateString(undefined, opts);
        return sameMonth ? `${sPart}–${e.getDate()}, ${year}` : `${sPart} – ${ePart}, ${year}`;
      }
      return `${s.toLocaleDateString()}, ${year}`;
    } catch (e) { return String(start); }
  }

  function formatDateTime(iso) {
    if (!iso) return "";
    try {
      const d = new Date(iso);
      return isNaN(d.getTime()) ? "Invalid Date" : d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    } catch (e) { return ""; }
  }

  function toIsoDateString(v) {
    if (!v) return "";
    try {
      const s = String(v);
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
      const d = new Date(v);
      return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
    } catch (e) { return ""; }
  }

  // --- HTML Generator for Certificates (Legacy text fallback) ---
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
        companions: companionList
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
  // VISUAL CERTIFICATE DESIGNER (Client-Side)
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
        alert("PDF libraries not loaded. Please ensure html2canvas and jspdf are included in index.html.");
        return;
      }
      setIsDownloading(true);
      try {
        const canvas = await window.html2canvas(previewRef.current, { scale: 2, useCORS: true });
        const imgData = canvas.toDataURL('image/png');
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('l', 'mm', 'a4'); 
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save("certificate_template.pdf");
      } catch (err) {
        console.error(err);
        alert("Failed to generate PDF. See console.");
      } finally {
        setIsDownloading(false);
      }
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
                <div><label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Pos Y%</label><input type="range" min="0" max="100" value={selectedElement.y} onChange={e => updateElement('y', parseInt(e.target.value))} className="w-full accent-brand h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer" /></div>
                <div><label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Pos X%</label><input type="range" min="0" max="100" value={selectedElement.x} onChange={e => updateElement('x', parseInt(e.target.value))} className="w-full accent-brand h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer" /></div>
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
  // SUB-COMPONENTS (Modals & Tabs)
  // ==========================================

  function ModalWrapper({ children, onClose }) {
    if (!createPortal) return null;
    return createPortal(<div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"><div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-xl overflow-hidden animate-fade-in-up">{children}</div></div>, document.body);
  }

  function RegistrationPreviewModal({ reg, onClose }) {
    if (!reg) return null;
    const companionList = Array.isArray(reg.companions) ? reg.companions : (typeof reg.companions === 'string' ? JSON.parse(reg.companions) : []);
    return (
      <ModalWrapper onClose={onClose}>
        <div className="p-8">
          <div className="flex justify-between items-start mb-6"><div><h3 className="text-2xl font-black text-brand">Registration Detail</h3><p className="text-sm text-gray-500">{reg.eventTitle}</p></div><button onClick={onClose} className="p-2 bg-gray-50 rounded-full hover:bg-gray-100 transition-colors">✕</button></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <div className="space-y-4"><h4 className="text-[11px] font-black text-brand uppercase tracking-widest border-b pb-1">Primary Participant</h4><div><p className="text-[10px] font-bold text-gray-400 uppercase">Name</p><p className="text-sm font-bold text-gray-800">{reg.fullName}</p></div><div><p className="text-[10px] font-bold text-gray-400 uppercase">Email</p><p className="text-sm font-medium text-gray-600">{reg.userEmail}</p></div></div>
            <div className="space-y-4"><h4 className="text-[11px] font-black text-amber-600 uppercase tracking-widest border-b pb-1">Associates ({companionList.length})</h4><div className="max-h-[30vh] overflow-y-auto space-y-4 pr-2 scrollbar-hide">{companionList.length === 0 ? (<p className="text-xs text-gray-400 italic py-4">No associates registered.</p>) : companionList.map((c, idx) => (<div key={idx} className="bg-soft/40 p-3 rounded-xl border border-blue-50"><div className="text-sm font-bold text-gray-800">{c.name}</div><div className="text-[10px] font-bold text-amber-600 uppercase">{c.relation}</div></div>))}</div></div>
          </div>
          <button onClick={onClose} className="w-full py-4 rounded-2xl bg-brand text-white font-bold hover:bg-black transition-all shadow-xl">Close Details</button>
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
    return createPortal(<div className="fixed inset-0 z-[9999] flex items-center justify-center p-6"><div className="absolute inset-0 bg-gray-900/60 backdrop-blur-md transition-opacity" onClick={onClose}></div><div className="relative bg-white rounded-[40px] shadow-2xl w-full max-w-3xl overflow-hidden"><div className="px-10 pt-10 pb-6"><div className="flex justify-between items-start"><div><p className="text-[11px] font-black text-brand uppercase tracking-[0.2em] mb-2">Conexus Platform</p><h3 className="text-3xl font-extrabold text-gray-900 font-display">{editId ? "Edit Event" : "Add a new event card"}</h3></div><button onClick={onClose} className="p-3 bg-gray-50 rounded-full text-gray-400 hover:text-gray-900 transition-all">✕</button></div></div><div className="px-10 py-4 max-h-[70vh] overflow-y-auto scrollbar-hide"><form id="createEventForm" onSubmit={onSave} className="space-y-7 pb-6"><div className="space-y-2"><label className="block text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Event Name</label><input type="text" name="title" required className="w-full p-4 rounded-2xl border-2 border-gray-100 bg-gray-50 text-gray-800 focus:bg-white focus:border-brand transition-all text-lg outline-none" value={formData.title} onChange={onChange} /></div><div className="space-y-2"><label className="block text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Event Description</label><textarea name="description" rows="4" className="w-full p-4 rounded-2xl border-2 border-gray-100 bg-gray-50 text-gray-800 focus:bg-white focus:border-brand transition-all outline-none resize-none" value={formData.description} onChange={onChange}></textarea></div><div className="grid grid-cols-2 gap-6"><div className="space-y-2"><label className="block text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Start Date</label><input type="date" name="startDate" required className="w-full p-4 rounded-2xl border-2 border-gray-100 bg-gray-50 outline-none" value={formData.startDate} onChange={onChange} /></div><div className="space-y-2"><label className="block text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">End Date</label><input type="date" name="endDate" required className="w-full p-4 rounded-2xl border-2 border-gray-100 bg-gray-50 outline-none" value={formData.endDate} onChange={onChange} /></div></div><div className="space-y-2"><label className="block text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Location</label><input type="text" name="location" required className="w-full p-4 rounded-2xl border-2 border-gray-100 bg-gray-50 outline-none" value={formData.location} onChange={onChange} /></div><div className="flex items-center justify-between p-6 rounded-3xl bg-gray-50 border-2 border-gray-100"><div><div className="text-lg font-bold text-gray-900">Featured event</div></div><label className="flex items-center gap-4 cursor-pointer group"><input type="checkbox" name="featured" checked={formData.featured} onChange={onChange} className="w-7 h-7 rounded-lg border-2 border-gray-300 text-brand cursor-pointer" /><span className="text-base font-bold text-gray-700 group-hover:text-brand transition-colors">Featured</span></label></div></form></div><div className="px-10 py-8 bg-gray-50 border-t border-gray-100 flex justify-end gap-4"><button type="button" onClick={onClose} className="px-8 py-3 rounded-2xl bg-white border-2 border-gray-200 text-gray-600 font-bold hover:bg-gray-100 transition-all">Cancel</button><button type="submit" form="createEventForm" disabled={isSaving} className="px-10 py-3 rounded-2xl bg-gradient-to-r from-brand to-brandLight text-white font-bold shadow-xl disabled:opacity-50 transition-all">{isSaving ? "Saving..." : (editId ? "Update Event" : "Save Event")}</button></div></div></div>, document.body);
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

  // --- TABS ---
  
  // NEW: Hybrid API Bridge Tab (Conexus Uploads + OJS Gateway)
  const SubmissionsTab = ({ API_BASE }) => {
    const [submissions, setSubmissions] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Replace this with your actual third-party OJS URL once you have it
    const OJS_URL = "https://your-institution-ojs-site.com";

    const fetchSubmissions = () => {
        fetch(`${API_BASE}/submissions`)
            .then(r => r.json())
            .then(data => {
                setSubmissions(data);
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
                    <p className="text-sm text-gray-600">Local backups of participant uploads. Reviews are managed via Open Journal Systems.</p>
                </div>
                <a 
                    href={OJS_URL} 
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
                                <th className="px-6 py-4">API Status</th>
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
                                        {/* This badge visually indicates if it was successfully sent to the 3rd party API */}
                                        <span className={`text-[10px] px-2 py-1 rounded-full border ${
                                            s.status === 'under_review' ? 'border-amber-200 text-amber-700 bg-amber-50' : 
                                            'border-emerald-200 text-emerald-700 bg-emerald-50'
                                        }`}>
                                            Sent to OJS
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <a href={`http://localhost:8000/${s.file_path}`} target="_blank" rel="noreferrer" className="px-4 py-2 rounded-lg border border-gray-200 bg-white text-[11px] font-bold shadow-sm hover:bg-gray-50 transition">
                                            Download Local Copy
                                        </a>
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
    const [search, setSearch] = useState("");
    const [selectedIds, setSelectedIds] = useState(new Set());
    const visible = registrations.filter(r => r.status === "Approved" && (filterEvent === "all" || String(r.eventId) === filterEvent) && (r.fullName + r.userEmail).toLowerCase().includes(search.toLowerCase()));
    const toggleSelect = (id) => { const newSet = new Set(selectedIds); if (newSet.has(id)) newSet.delete(id); else newSet.add(id); setSelectedIds(newSet); };
    const toggleSelectAll = () => { if (selectedIds.size === visible.length) setSelectedIds(new Set()); else setSelectedIds(new Set(visible.map(r => r.id))); };
    const getTargets = () => { if (selectedIds.size > 0) return visible.filter(r => selectedIds.has(r.id)); return visible; };

    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-3"><div><h2 className="font-display text-2xl font-semibold">Certificates</h2><p className="text-sm text-gray-600">Issue certificates to approved attendees.</p><button onClick={onOpenDesigner} className="mt-3 px-4 py-2 bg-brand text-white rounded-xl text-xs font-semibold shadow-sm hover:bg-black transition-all inline-flex items-center gap-2"><span>🎨</span> Open Visual Designer</button></div><div className="flex flex-col items-end gap-2"><select value={filterEvent} onChange={e => { setFilterEvent(e.target.value); setSelectedIds(new Set()); }} className="rounded-full border border-gray-200 px-3 py-1.5 text-xs bg-white"><option value="all">All events</option>{events.map(e => <option key={e.id} value={String(e.id)}>{e.title}</option>)}</select><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="rounded-full border border-gray-200 px-3 py-1.5 text-xs w-64 bg-white" /></div></div>
        <div className="rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 p-5"><h3 className="text-sm font-semibold text-brand mb-3 flex items-center gap-2"><span>⚡</span> Batch Certificate Processing</h3>{batchStatus.state === 'idle' || batchStatus.state === 'complete' ? (<div className="flex items-center justify-between"><p className="text-xs text-brand">{selectedIds.size > 0 ? `Ready to process ${selectedIds.size} selected attendees.` : `Ready to process all ${visible.length} filtered attendees.`}</p><button onClick={() => onBatchEmail(getTargets())} disabled={visible.length === 0} className="px-4 py-2 bg-brand text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 transition shadow-sm disabled:opacity-50">{batchStatus.state === 'complete' ? "Sent! Send Again?" : "Send Emails to Targets"}</button></div>) : (<div className="space-y-2"><div className="flex justify-between text-xs font-bold text-brand"><span>Sending... {batchStatus.processed} / {batchStatus.total}</span><span>{Math.round((batchStatus.processed / batchStatus.total) * 100)}%</span></div><div className="h-2 bg-blue-200 rounded-full overflow-hidden"><div className="h-full bg-brand transition-all duration-300" style={{ width: `${(batchStatus.processed / batchStatus.total) * 100}%` }}></div></div><p className="text-[10px] text-brand">Please do not close this window.</p></div>)}</div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">{visible.length > 0 && (<div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center gap-3"><input type="checkbox" checked={visible.length > 0 && selectedIds.size === visible.length} onChange={toggleSelectAll} className="rounded border-gray-300 text-brand focus:ring-brand" /><span className="text-xs font-bold text-gray-500 uppercase">Select All</span></div>)}<div className="divide-y divide-gray-50">{visible.map(r => (<div key={r.id} className={`flex items-center justify-between p-4 transition-all hover:bg-blue-50/30 ${selectedIds.has(r.id) ? 'bg-blue-50/50' : ''}`}><div className="flex items-center gap-3"><input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggleSelect(r.id)} className="rounded border-gray-300 text-brand focus:ring-brand" /><div><div className="text-sm font-bold text-gray-800">{r.fullName}</div><div className="text-xs text-gray-500">{r.eventTitle}</div></div></div><button onClick={() => onIssueCert(r)} className="px-4 py-1.5 rounded-lg grad-btn text-white text-xs font-bold shadow-md">Issue Cert</button></div>))}</div></div>
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
      <div className="space-y-8"><div className="flex items-start justify-between gap-4"><div><h2 className="font-display text-3xl font-bold mb-2">Admin dashboard</h2><p className="text-base text-gray-500">Quick snapshot of events and registrations.</p></div><div className="flex items-center gap-4"><button onClick={onCreateEvent} className="px-6 py-3 rounded-full bg-brand text-white text-sm font-semibold shadow-lg hover:bg-brandLight hover:-translate-y-0.5 transition-all">Create Event</button><button onClick={() => onExport(eventStats)} className="px-6 py-3 rounded-full bg-amber-500 text-white text-sm font-semibold shadow-lg hover:bg-amber-600 hover:-translate-y-0.5 transition-all">Export Dashboard</button></div></div>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-2"><div className="hover-card rounded-3xl bg-white border border-gray-100 p-7 shadow-sm"><p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-2">Active events</p><p className="text-4xl font-extrabold text-gray-800">{events.length}</p></div><div className="hover-card rounded-3xl bg-white border border-gray-100 p-7 shadow-sm"><p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-2">Total registrations</p><p className="text-4xl font-extrabold text-gray-800">{registrations.length}</p></div></div>
      <div className="rounded-3xl bg-white border border-gray-100 p-8 shadow-sm"><div className="flex items-center justify-between mb-8"><h3 className="font-bold text-xl text-gray-800">Participants per event</h3></div>{eventStats.length === 0 ? <div className="text-center py-12 text-gray-400 text-base">No events configured yet.</div> : (<div className="space-y-8">{eventStats.map(ev => {const pct = maxParticipants ? Math.round((ev.participants / maxParticipants) * 100) : 0;return (<div key={ev.id} className="group"><div className="flex items-center justify-between mb-3"><span className="text-base font-bold text-gray-700 truncate max-w-md">{ev.title}</span><div className="flex items-center gap-4"><span className="text-sm text-gray-400 font-medium">{ev.participants} pax</span><button onClick={() => onEditEvent(ev)} className="px-4 py-1.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">Edit</button><button onClick={() => onDeleteEvent(ev.id)} className="px-4 py-1.5 rounded-xl border border-red-100 text-sm font-semibold text-red-500 hover:bg-red-50 transition">Delete</button></div></div><div className="h-3 rounded-full bg-gray-100 overflow-hidden"><div className="h-full bg-gradient-to-r from-brand to-accent1 rounded-full transition-all duration-700 ease-out" style={{ width: Math.max(2, pct) + "%" }} /></div></div>);})}</div>)}</div></div>
    );
  };

  const RegistrationsTab = ({ events, registrations, rooms, dorms, onUpdateStatus, onAssign, onNfc, onPreview, onCert, onDelete }) => {
    const [filterEvent, setFilterEvent] = useState("all");
    const [filterStatus, setFilterStatus] = useState("all");
    const filtered = registrations.filter(r => (filterEvent === "all" || String(r.eventId) === filterEvent) && (filterStatus === "all" || r.status === filterStatus));
    return (<div className="space-y-4"><div className="flex items-end justify-between gap-3"><div><h2 className="font-display text-2xl font-semibold mb-1">Registrations</h2><p className="text-sm text-gray-600">Manage approvals.</p></div><div className="flex items-center gap-2"><select value={filterEvent} onChange={e => setFilterEvent(e.target.value)} className="text-xs rounded-full border border-gray-200 px-3 py-1.5 bg-white text-gray-700"><option value="all">All events</option>{events.map(e => <option key={e.id} value={String(e.id)}>{e.title}</option>)}</select><select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="text-xs rounded-full border border-gray-200 px-3 py-1.5 bg-white text-gray-700"><option value="all">All statuses</option><option>For approval</option><option>Approved</option><option>Rejected</option></select></div></div><div className="rounded-2xl bg-white/95 border border-gray-100 p-4 shadow-sm overflow-x-auto">{filtered.length === 0 && <p className="text-sm text-gray-500">No registrations found.</p>}<table className="w-full text-left"><thead className="bg-gray-50 text-[10px] uppercase font-bold text-gray-400"><tr><th className="px-6 py-4">Participant</th><th className="px-6 py-4">Status</th><th className="px-6 py-4">Assignment</th><th className="px-6 py-4">NFC</th><th className="px-6 py-4 text-right">Actions</th></tr></thead><tbody className="divide-y divide-gray-100">{filtered.map(r => {const isApproved = r.status === "Approved";const isRejected = r.status === "Rejected";const assignedRoom = rooms.find(rm => String(rm.id) === String(r.roomId));const assignedPlace = assignedRoom ? dorms.find(d => String(d.id) === String(assignedRoom.dormId)) : null;return (<tr key={r.id} className="group hover:bg-soft/20 transition-colors"><td className="px-6 py-4 min-w-0"><div className="text-sm font-semibold text-gray-800 truncate">{r.fullName}</div><div className="text-[11px] text-gray-500 truncate">{r.eventTitle} • {r.userEmail}</div></td><td className="px-6 py-4"><span className={`text-[11px] px-2 py-1 rounded-full border ${isApproved ? 'border-emerald-200 text-emerald-700 bg-emerald-50' : 'border-gray-200 bg-white text-gray-700'}`}>{r.status}</span></td><td className="px-6 py-4">{assignedRoom ? <div className="flex items-center justify-between gap-3"><div><div className="text-xs font-bold text-gray-800">{assignedPlace?.name || 'Unknown'} - {assignedRoom.name}</div></div><button onClick={() => onAssign(r)} className="text-[10px] font-bold text-brand hover:underline">Change</button></div> : <button onClick={() => onAssign(r)} className="px-3 py-1.5 border border-dashed border-gray-300 rounded-lg text-xs text-gray-500 font-medium hover:border-brand hover:text-brand transition-all">+ Assign Room</button>}</td><td className="px-6 py-4"><div className="flex items-center gap-2">{r.nfc_card_id ? <><span className="font-mono text-brand text-xs font-bold bg-blue-50 px-2 py-1 rounded">{r.nfc_card_id}</span><button onClick={() => onNfc(r)} className="text-[10px] text-gray-400 hover:text-brand font-medium underline">Change</button></> : <button onClick={() => onNfc(r)} className="text-brand underline text-xs font-bold">Link Card</button>}</div></td><td className="px-6 py-4 text-right"><div className="flex items-center justify-end gap-2"><button onClick={() => onPreview(r)} className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-[11px] font-bold shadow-sm hover:bg-gray-50 transition">Preview</button>{!isApproved && <button onClick={() => onUpdateStatus(r.id, "Approved", r.roomId)} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-[11px] font-bold">Approve</button>}{!isRejected && <button onClick={() => onUpdateStatus(r.id, "Rejected", r.roomId)} className="px-3 py-1.5 rounded-lg border border-rose-200 text-rose-600 bg-white text-[11px] font-bold">{isApproved ? "Revoke" : "Reject"}</button>}{isApproved && <button onClick={() => onCert(r)} className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-[11px] font-bold">Issue Cert</button>}<button onClick={() => onDelete(r.id)} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 hover:text-red-700 transition border border-red-100" title="Delete Registration"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button></div></td></tr>);})}</tbody></table></div></div>);
  };

  const AccommodationTab = ({ dorms, rooms, registrations, onAddDorm, onDeleteDorm, onAddRoom, onDeleteRoom }) => {
    const [filterDorm, setFilterDorm] = useState("all");
    const [newDormName, setNewDormName] = useState("");
    const [newDormType, setNewDormType] = useState("Dorm");
    const [roomForm, setRoomForm] = useState({ dormId: "", name: "", beds: 1 });
    const filteredRooms = rooms.filter(r => filterDorm === "all" || String(r.dormId) === filterDorm);
    const handleDormSubmit = (e) => { e.preventDefault(); if (newDormName) onAddDorm(newDormName, newDormType).then(() => setNewDormName("")); };
    const handleRoomSubmit = (e) => { e.preventDefault(); if (roomForm.name && roomForm.dormId) onAddRoom(roomForm).then(() => setRoomForm({ ...roomForm, name: "", beds: 1 })); };
    return (<div className="space-y-8"><div className="flex items-center justify-between gap-3"><div><h2 className="font-display text-3xl font-bold mb-1">Accommodation</h2></div><div className="flex items-center gap-2"><select value={filterDorm} onChange={e => setFilterDorm(e.target.value)} className="text-sm rounded-full border-2 border-gray-200 px-4 py-2 bg-white text-gray-700 font-semibold focus:border-brand outline-none"><option value="all">All Locations</option>{dorms.map(d => <option key={d.id} value={String(d.id)}>{d.name} ({d.type})</option>)}</select>{filterDorm !== "all" && <button onClick={() => onDeleteDorm(filterDorm)} className="p-2.5 rounded-full bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-100"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>}</div></div><div className="grid gap-8 lg:grid-cols-3"><div className="lg:col-span-1 space-y-6"><div className="rounded-3xl bg-white border border-gray-100 p-6 shadow-sm"><h3 className="font-bold text-lg text-gray-800 mb-4">Add New Place</h3><form onSubmit={handleDormSubmit} className="space-y-4"><div><div className="flex gap-2 p-1 bg-gray-100 rounded-xl"><button type="button" onClick={() => setNewDormType("Dorm")} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${newDormType === "Dorm" ? "bg-white shadow-sm text-brand" : "text-gray-500"}`}>Dormitory</button><button type="button" onClick={() => setNewDormType("Hotel")} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${newDormType === "Hotel" ? "bg-white shadow-sm text-brand" : "text-gray-500"}`}>Hotel</button></div></div><input value={newDormName} onChange={e => setNewDormName(e.target.value)} className="w-full rounded-xl border-2 border-gray-100 px-4 py-2.5 text-sm focus:border-brand outline-none" placeholder="Location name..." /><button className="w-full py-3 rounded-xl grad-btn text-white font-bold text-sm shadow-md">Create Location</button></form></div><div className="rounded-3xl bg-white border border-gray-100 p-6 shadow-sm"><h3 className="font-bold text-lg text-gray-800 mb-4">Add Room</h3><form onSubmit={handleRoomSubmit} className="space-y-4"><select value={roomForm.dormId} onChange={e => setRoomForm({ ...roomForm, dormId: e.target.value })} className="w-full rounded-xl border-2 border-gray-100 px-4 py-2.5 text-sm outline-none focus:border-brand"><option value="">Select Place</option>{dorms.map(d => <option key={d.id} value={d.id}>{d.name} ({d.type})</option>)}</select><div className="grid grid-cols-2 gap-3"><input value={roomForm.name} onChange={e => setRoomForm({ ...roomForm, name: e.target.value })} className="rounded-xl border-2 border-gray-100 px-4 py-2.5 text-sm outline-none focus:border-brand" placeholder="Room #" /><input type="number" value={roomForm.beds} onChange={e => setRoomForm({ ...roomForm, beds: Number(e.target.value) })} className="rounded-xl border-2 border-gray-100 px-4 py-2.5 text-sm outline-none focus:border-brand" placeholder="Beds" /></div><button className="w-full py-3 rounded-xl bg-brand text-white font-bold text-sm hover:bg-black transition-all">Add Room</button></form></div></div><div className="lg:col-span-2 space-y-4">{filteredRooms.map(room => {const dorm = dorms.find(d => d.id === room.dormId);const assignedPeople = registrations.filter(r => String(r.roomId) === String(room.id) && r.status === "Approved");const occupancyPct = Math.round((assignedPeople.length / room.beds) * 100);return (<div key={room.id} className="bg-white rounded-[32px] border border-gray-100 p-6 shadow-sm hover:border-blue-200 transition-all flex flex-col h-fit"><div className="flex justify-between items-start mb-4"><div><span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase bg-blue-50 text-brand">{dorm?.type}</span><h4 className="text-lg font-extrabold text-gray-800 mt-1">{dorm?.name} — Room {room.name}</h4></div><button onClick={() => onDeleteRoom(room.id)} className="text-gray-300 hover:text-red-500 p-1">🗑️</button></div><div className="mb-4"><div className="flex justify-between items-center mb-1.5"><span className="text-xs font-bold text-gray-500">{assignedPeople.length} / {room.beds} Beds</span><span className="text-xs font-black text-brand">{occupancyPct}%</span></div><div className="h-2 rounded-full bg-gray-100 overflow-hidden"><div className={`h-full transition-all duration-500 ${occupancyPct >= 100 ? 'bg-red-500' : 'bg-brand'}`} style={{ width: `${Math.min(100, occupancyPct)}%` }} /></div></div><div className="bg-gray-50 rounded-2xl p-4 space-y-2"><p className="text-[10px] font-bold text-gray-400 uppercase mb-1">People</p>{assignedPeople.map(p => (<div key={p.id} className="flex items-center gap-2 text-xs font-semibold text-gray-700 bg-white p-2 rounded-xl shadow-sm border border-gray-100">👤 {p.fullName}</div>))}</div></div>);})}</div></div></div>);
  };
  const PortalsTab = ({ portals, events, onCreatePortal, onDeletePortal }) => {
    const [filterEvent, setFilterEvent] = useState("all");
    const [form, setForm] = useState({ eventId: "", name: "" });
    const filtered = portals.filter(p => filterEvent === "all" || String(p.eventId) === filterEvent);
    const handleSubmit = (e) => { e.preventDefault(); onCreatePortal(form).then(ok => ok && setForm({ eventId: "", name: "" })); };
    const openPortal = (p) => {
      const event = events.find(e => e.id === p.eventId) || {};
      window.localStorage.setItem("conexus_portal_" + p.id, JSON.stringify({ portal: p, event }));
      window.open(`attendance-portal.html?portal=${p.id}`, "_blank");
    };
    return (
      <div className="space-y-4">
        <div className="flex items-end justify-between gap-3"><div><h2 className="font-display text-2xl font-semibold mb-1">Portals</h2><p className="text-sm text-gray-600">Create attendance portals per event.</p></div><select value={filterEvent} onChange={e => setFilterEvent(e.target.value)} className="text-xs rounded-full border border-gray-200 px-3 py-1.5 bg-white text-gray-700 outline-none"><option value="all">All events</option>{events.map(e => <option key={e.id} value={String(e.id)}>{e.title}</option>)}</select></div>
        <div className="rounded-2xl bg-white/95 border border-gray-100 p-5 shadow-sm">
          <form onSubmit={handleSubmit} className="grid gap-2 sm:grid-cols-3 mb-4">
            <select value={form.eventId} onChange={e => setForm({ ...form, eventId: e.target.value })} className="rounded-xl border border-gray-200 px-3 py-2 bg-white text-sm outline-none"><option value="">Select event</option>{events.map(e => <option key={e.id} value={String(e.id)}>{e.title}</option>)}</select>
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="rounded-xl border border-gray-200 px-3 py-2 bg-white text-sm outline-none" placeholder="Portal name" />
            <button className="px-4 py-2 rounded-xl grad-btn text-white text-sm font-semibold">Create</button>
          </form>
          <div className="space-y-2">
            {filtered.length === 0 && <p className="text-gray-400 text-sm">No portals created.</p>}
            {filtered.map(p => (
              <div key={p.id} className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-soft/60 p-3"><div className="min-w-0"><div className="text-sm font-semibold text-gray-800 truncate">{p.name}</div><div className="text-[11px] text-gray-500 truncate">{p.eventTitle}</div></div><div className="flex items-center gap-2"><button onClick={() => openPortal(p)} className="px-3 py-1.5 rounded-lg bg-brand text-white text-[11px] font-bold">Open</button><button onClick={() => onDeletePortal(p.id)} className="px-3 py-1.5 rounded-lg border border-rose-200 text-rose-600 bg-white text-[11px] font-bold">Delete</button></div></div>
            ))}
          </div>
        </div>
      </div>
    );
  };
  const AttendanceTab = ({ logs }) => (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3"><div><h2 className="font-display text-2xl font-semibold mb-1">Attendance Logs</h2><p className="text-sm text-gray-600">Real-time scan logs.</p></div></div>
      <div className="rounded-2xl bg-white/95 border border-gray-100 p-5 overflow-x-auto shadow-sm">
        {logs.length === 0 ? <p className="text-sm text-gray-500 text-center py-4">No scans recorded yet.</p> : (
          <table className="w-full text-left text-sm"><thead className="text-xs text-gray-500 border-b border-gray-100"><tr><th className="pb-2 font-medium">Participant</th><th className="pb-2 font-medium">Event</th><th className="pb-2 font-medium">Room / Portal</th><th className="pb-2 font-medium">Time Scanned</th></tr></thead>
            <tbody className="divide-y divide-gray-50">{logs.map(log => <tr key={log.id} className="group hover:bg-soft/50 transition-all"><td className="py-3 font-medium text-gray-800">{log.participant_name}</td><td className="py-3 text-gray-600">{log.event_title}</td><td className="py-3"><span className="bg-blue-50 text-brand px-2 py-1 rounded text-xs font-semibold">{log.room_name}</span></td><td className="py-3 text-gray-400 font-mono text-xs">{formatDateTime(log.scanned_at)}</td></tr>)}</tbody>
          </table>
        )}
      </div>
    </div>
  );

  // ==========================================
  // MAIN COMPONENT
  // ==========================================
  function AdminDashboard(props) {
    const user = props.user || {};
    const [section, setSection] = useState("dashboard");

    // Data State
    const [events, setEvents] = useState([]);
    const [registrations, setRegistrations] = useState([]);
    const [dorms, setDorms] = useState([]);
    const [rooms, setRooms] = useState([]);
    const [portals, setPortals] = useState([]);
    const [logs, setLogs] = useState([]);

    // UI State
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

    // 1. Optimized Data Loading (Only on mount)
    const loadData = () => {
      Promise.all([
        fetch(`${API_BASE}/events`).then(r => r.json()).catch(() => []),
        fetch(`${API_BASE}/registrations`).then(r => r.json()).catch(() => []),
        fetch(`${API_BASE}/portals`).then(r => r.json()).catch(() => []),
        fetch(`${API_BASE}/dorms`).then(r => r.json()).catch(() => []),
        fetch(`${API_BASE}/rooms`).then(r => r.json()).catch(() => []),
        fetch(`${API_BASE}/attendance_logs`).then(r => r.json()).catch(() => [])
      ]).then(([ev, reg, por, dor, roo, lgs]) => {
        if (Array.isArray(ev)) setEvents(ev.map(normalizeEvent));
        if (Array.isArray(reg)) setRegistrations(reg.map(normalizeRegistration));
        if (Array.isArray(por)) setPortals(por.map(normalizePortal));
        if (Array.isArray(dor)) setDorms(dor.map(normalizeDorm));
        if (Array.isArray(roo)) setRooms(roo.map(normalizeRoom));
        if (Array.isArray(lgs)) setLogs(lgs);
      });
    };

    useEffect(() => { loadData(); }, []); // Run once on mount

    // 2. Auto-Refresh Attendance Logs
    useEffect(() => {
        let interval;
        if (section === "attendance") {
            interval = setInterval(() => {
                fetch(`${API_BASE}/attendance_logs`).then(r => r.json()).then(data => setLogs(data)).catch(console.error);
            }, 5000);
        }
        return () => clearInterval(interval);
    }, [section]);

    // --- Actions ---
    const handleExport = (stats) => {
      const rows = [['Event', 'Participants', 'Pending', 'Approved', 'Start Date'], ...stats.map(ev => [ev.title, ev.participants, ev.pending, ev.approved, ev.startDate])];
      downloadBlob({ content: rows.map(e => e.join(",")).join("\n"), mime: 'text/csv', filename: `dashboard_export_${new Date().toISOString().slice(0, 10)}.csv` });
    };

    // Event Actions
    const saveEvent = async (e) => {
      e.preventDefault();
      if (new Date(eventForm.endDate) < new Date(eventForm.startDate)) { return alert("Error: End Date cannot be earlier than Start Date."); }
      setCreateEventSaving(true);
      try {
        const res = await fetch(`${API_BASE}/create_event`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(eventForm) });
        if ((await res.json()).success) { loadData(); setCreateEventOpen(false); }
      } catch (err) { alert("Save failed"); }
      setCreateEventSaving(false);
    };
    const handleDeleteEvent = async (id) => { if (confirm("Delete event?")) { await fetch(`${API_BASE}/delete_event/${id}`, { method: 'DELETE' }); loadData(); } };

    // Registration Actions
    const handleUpdateStatus = async (id, status, roomId) => {
      setRegistrations(p => p.map(r => r.id === id ? { ...r, status, roomId } : r));
      await fetch(`${API_BASE}/registrations/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status, room_id: roomId }) });
      loadData();
    };
    const handleDeleteRegistration = async (id) => {
        if (confirm("Permanently delete registration?")) {
            try {
                await fetch(`${API_BASE}/registrations/${id}`, { method: 'DELETE' });
                setRegistrations(prev => prev.filter(r => r.id !== id));
            } catch (err) { alert("Delete failed"); }
        }
    };
    const handleNfcSubmit = async (scannedId) => {
      try {
        const res = await fetch(`${API_BASE}/registrations/${nfcTargetReg.id}/assign-nfc`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nfc_card_id: scannedId }) });
        if ((await res.json()).success) { alert(`✅ Card assigned`); loadData(); setNfcModalOpen(false); } else alert("Failed");
      } catch (err) { alert("Network error"); }
    };
    const handleAssignRoom = async (roomId) => {
      if (!assignTargetReg || !roomId) return;
      await handleUpdateStatus(assignTargetReg.id, "Approved", roomId);
      setAssignModalOpen(false);
    };

    // Accommodation Actions
    const handleAddDorm = async (name, type) => { await fetch(`${API_BASE}/dorms`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, type }) }); loadData(); };
    
    // Simplified Delete Logic (relies on DB Cascade)
    const handleDeleteDorm = async (id) => { 
        if (confirm("Delete location? All associated rooms will be deleted.")) { 
            await fetch(`${API_BASE}/dorms/${id}`, { method: 'DELETE' }); 
            loadData(); 
        } 
    };
    const handleAddRoom = async (form) => { await fetch(`${API_BASE}/rooms`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) }); loadData(); };
    const handleDeleteRoom = async (id) => { if (confirm("Delete room?")) { await fetch(`${API_BASE}/rooms/${id}`, { method: 'DELETE' }); loadData(); } };

    // Portal Actions
    const handleCreatePortal = async (form) => { await fetch(`${API_BASE}/portals`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: makeUUID(), ...form }) }); loadData(); return true; };
    const handleDeletePortal = async (id) => { if (confirm("Delete?")) { await fetch(`${API_BASE}/portals/${id}`, { method: 'DELETE' }); loadData(); } };

    // Certificate Actions
    const getCertHtml = () => {
      if (!certTarget) return "";
      const ev = events.find(e => String(e.id) === String(certTarget.eventId)) || { title: "Event" };
      return SafeCertGenerator.generateHTML({ name: certTarget.fullName, eventTitle: ev.title, dateLabel: formatDateRange(ev.startDate, ev.endDate), issuerName: user.name || "Admin", issuerRole: user.university || "Research Office", certificateId: "CX-" + Date.now(), issuedAt: new Date().toLocaleDateString() });
    };
    const sendEmailLogic = async (target) => {
        if (!target?.userEmail) throw new Error("Email missing");
        const ev = events.find(e => String(e.id) === String(target.eventId)) || {};
        const res = await fetch(`${EMAIL_API}/send-certificate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: target.fullName, email: target.userEmail, eventTitle: ev.title, certificateData: { ...target, eventTitle: ev.title } }) });
        if (!res.ok) throw new Error("Server rejected");
    };
    const sendSingleCertEmail = async (target) => {
      setCertEmailSending(true); setCertEmailStatus("Sending...");
      try { await sendEmailLogic(target); setCertEmailStatus("✅ Email sent!"); alert("Sent to " + target.userEmail); } 
      catch (err) { setCertEmailStatus("❌ Failed."); alert("Error: " + err.message); } finally { setCertEmailSending(false); }
    };
    const handleBatchEmail = async (targets) => {
        if (!confirm(`Send to ${targets.length} attendees?`)) return;
        setBatchStatus({ state: 'sending', processed: 0, total: targets.length, errors: 0 });
        let index = 0;
        const processNext = async () => {
            if (index >= targets.length) return;
            const current = targets[index++];
            try { await sendEmailLogic(current); } catch (e) { setBatchStatus(p => ({ ...p, errors: p.errors + 1 })); } 
            finally { setBatchStatus(p => ({ ...p, processed: p.processed + 1 })); await processNext(); }
        };
        await Promise.all([processNext(), processNext(), processNext()]); // Concurrency: 3
        setBatchStatus(p => ({ ...p, state: 'complete' })); alert("Batch complete!");
    };
    const issueCertNow = () => { const win = window.open('','_blank'); win.document.write(getCertHtml()); win.document.close(); win.print(); };

    // --- RENDER ---
    if (section === "admin-certificate-designer") return (<section className="relative max-w-7xl mx-auto px-4 py-8"><CertificateDesigner onBack={() => setSection("certificates")} /></section>);

    return (
      <section className="relative max-w-7xl mx-auto px-4 py-8">
        <div className="grid gap-6 md:grid-cols-[220px,minmax(0,1fr)]">
          <aside className="rounded-2xl bg-white/95 border border-gray-100 shadow-sm p-4 h-fit sticky top-4">
            <div className="mb-4"><p className="text-[11px] text-gray-500 mb-1 font-bold uppercase tracking-widest">Admin panel</p><p className="font-display text-lg font-extrabold text-brand truncate">{user.name || "Admin"}</p><p className="text-[11px] text-gray-500 font-medium">{user.university || "Research office"}</p></div>
            <nav className="space-y-1 text-xs">
              {[{ id: "dashboard", label: "Dashboard", icon: "📊" }, { id: "accommodation", label: "Accommodation", icon: "🛏️" }, { id: "registrations", label: "Registrations", icon: "📝" }, { id: "ojs", label: "Paper submissions", icon: "📄" }, { id: "attendance", label: "Attendance", icon: "🎟️" }, { id: "portals", label: "Portals", icon: "🌐" }, { id: "certificates", label: "Certificates", icon: "🏅" }].map((item) => (
                <button key={item.id} onClick={() => setSection(item.id)} className={classNames("w-full flex items-center gap-2 rounded-xl px-3 py-2 transition-all font-bold", section === item.id ? "bg-brand text-white shadow-md scale-105" : "text-gray-600 hover:bg-soft")}><span className="text-base">{item.icon}</span><span className="truncate">{item.label}</span></button>
              ))}
            </nav>
          </aside>
          <main className="min-w-0 transition-all duration-300">
            {section === "dashboard" && <DashboardTab events={events} registrations={registrations} onCreateEvent={() => { setEditEventId(null); setEventForm({ title: "", description: "", startDate: "", endDate: "", location: "", featured: false }); setCreateEventOpen(true); }} onExport={handleExport} onEditEvent={(ev) => { setEditEventId(ev.id); setEventForm({ ...ev }); setCreateEventOpen(true); }} onDeleteEvent={handleDeleteEvent} />}
            {section === "accommodation" && <AccommodationTab dorms={dorms} rooms={rooms} registrations={registrations} onAddDorm={handleAddDorm} onDeleteDorm={handleDeleteDorm} onAddRoom={handleAddRoom} onDeleteRoom={handleDeleteRoom} />}
            {section === "registrations" && <RegistrationsTab events={events} registrations={registrations} rooms={rooms} dorms={dorms} onUpdateStatus={handleUpdateStatus} onAssign={(r) => { setAssignTargetReg(r); setAssignModalOpen(true); }} onNfc={(r) => { setNfcTargetReg(r); setNfcModalOpen(true); }} onPreview={setPreviewTarget} onCert={(r) => { setCertTarget(r); setCertDrawerOpen(true); }} onDelete={handleDeleteRegistration} />}
            {section === "ojs" && <SubmissionsTab API_BASE={API_BASE} />}
            {section === "attendance" && <AttendanceTab logs={logs} />}
            {section === "portals" && <PortalsTab portals={portals} events={events} onCreatePortal={handleCreatePortal} onDeletePortal={handleDeletePortal} />}
            {section === "certificates" && <CertificatesTab events={events} registrations={registrations} onIssueCert={(r) => { setCertTarget(r); setCertDrawerOpen(true); }} onEmail={sendSingleCertEmail} batchStatus={batchStatus} onBatchEmail={handleBatchEmail} onOpenDesigner={() => setSection("admin-certificate-designer")} />}
          </main>
        </div>
        <CreateEventModal isOpen={createEventOpen} isSaving={createEventSaving} editId={editEventId} formData={eventForm} onChange={(e) => { const { name, value, type, checked } = e.target; setEventForm(p => ({ ...p, [name]: type === 'checkbox' ? checked : value })); }} onClose={() => setCreateEventOpen(false)} onSave={saveEvent} />
        <NfcModal isOpen={nfcModalOpen} targetReg={nfcTargetReg} onClose={() => setNfcModalOpen(false)} onSubmit={handleNfcSubmit} />
        <AssignRoomModal isOpen={assignModalOpen} targetReg={assignTargetReg} dorms={dorms} rooms={rooms} registrations={registrations} onClose={() => setAssignModalOpen(false)} onAssign={handleAssignRoom} />
        <CertificateDrawer isOpen={certDrawerOpen} target={certTarget} html={getCertHtml()} isSending={certEmailSending} status={certEmailStatus} onClose={() => setCertDrawerOpen(false)} onEmail={sendSingleCertEmail} onPrint={issueCertNow} />
        <RegistrationPreviewModal reg={previewTarget} onClose={() => setPreviewTarget(null)} />
      </section>
    );
  }

  window.AdminDashboard = AdminDashboard;
})();

// PORT=8000
//DB_HOST=localhost
//DB_USER=root
//DB_PASSWORD=09214573252
//DB_NAME=conexus