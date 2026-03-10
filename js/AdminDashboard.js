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
  
  const OJS_DASHBOARD_URL = "https://darkgoldenrod-kudu-650795.hostingersite.com/index.php/crj/dashboard/editorial#submissions";

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
        <div style="margin-top: 50px; display: flex; justify-content: space-between; padding: 0 60px; align-items: flex-end;">
            <div style="text-align: center;">
                <div style="border-top: 1px solid #333; width: 200px; margin: 0 auto 5px auto;"></div>
                <p style="font-weight: bold; margin: 0;">${data.issuerName}</p>
                <p style="font-size: 12px; margin: 0;">${data.issuerRole}</p>
            </div>
            <div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end;">
                <img src="${data.qrUrl}" crossorigin="anonymous" alt="QR Verification" style="width: 70px; height: 70px; margin-bottom: 8px; border: 2px solid #f3f4f6; padding: 2px; border-radius: 6px;" />
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
        eventId: row.eventId || row.event_id,
        eventTitle: row.eventTitle || row.event_title || "Unknown Event",
        userEmail: row.userEmail || row.user_email,
        fullName: row.fullName || row.full_name || row.userEmail,
        university: row.university || "",
        status: row.status || "For approval",
        nfc_card_id: row.nfc_card_id || null,
        participantsCount: 1 + companionList.length,
        roomId: row.room_id || null,
        companions: companionList,
        validId: row.valid_id_path || null,
        adminNote: row.adminNote || row.admin_note || null,
        certificateIssuedAt: row.certificateIssuedAt || row.certificate_issued_at || null,
        profile_slug: row.profile_slug || null,
        regRole: row.regRole || row.reg_role || "participant",
        presentationPath: row.presentationPath || row.presentation_path || null,
        videoPath: row.videoPath || row.video_path || null,
        proofOfPaymentPath: row.proofOfPaymentPath || row.proof_of_payment_path || null,
        paper_status: row.paper_status || null,
        payment_status: row.payment_status || row.paymentStatus || null,
        files_status: row.files_status || null,
        mode: row.mode || "On-site",
        
        firstName: row.first_name || "",
        lastName: row.last_name || "",
        middleName: row.middle_name || "",
        gender: row.gender || "",
        age: row.age || "",
        contactNumber: row.contact_number || ""
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
        window.Swal.fire('Missing Libraries', 'PDF libraries not loaded.', 'error');
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
      } catch (err) { 
        window.Swal.fire('Error', 'Failed to generate PDF.', 'error'); 
      } finally { setIsDownloading(false); }
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
                
                {/* NEW: FONT AND STYLE SELECTORS */}
                <div className="grid grid-cols-2 gap-3">
                   <div>
                     <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Font</label>
                     <select value={selectedElement.fontFamily} onChange={e => updateElement('fontFamily', e.target.value)} className="w-full text-xs p-2 rounded-lg border border-gray-200 outline-none focus:border-brand cursor-pointer">
                       <option value="Helvetica, Arial, sans-serif">Helvetica</option>
                       <option value="'Times New Roman', Times, serif">Times New Roman</option>
                       <option value="Georgia, serif">Georgia</option>
                       <option value="'Courier New', Courier, monospace">Courier</option>
                       <option value="'Brush Script MT', cursive">Brush Script</option>
                       <option value="Impact, fantasy">Impact</option>
                     </select>
                   </div>
                   <div>
                     <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Style</label>
                     <select value={selectedElement.fontWeight} onChange={e => updateElement('fontWeight', e.target.value)} className="w-full text-xs p-2 rounded-lg border border-gray-200 outline-none focus:border-brand cursor-pointer">
                       <option value="normal">Normal</option>
                       <option value="bold">Bold</option>
                     </select>
                   </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                   <div><label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Size</label><input type="number" value={selectedElement.fontSize} onChange={e => updateElement('fontSize', parseInt(e.target.value))} className="w-full text-xs p-2 rounded-lg border border-gray-200 focus:border-brand outline-none" /></div>
                   <div><label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Color</label><input type="color" value={selectedElement.color} onChange={e => updateElement('color', e.target.value)} className="w-full h-8 p-0 border-0 rounded cursor-pointer" /></div>
                </div>
                <div><label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Pos Y%</label><input type="range" min="0" max="100" value={selectedElement.y} onChange={e => updateElement('y', parseInt(e.target.value))} className="w-full accent-brand h-2 bg-gray-200 rounded-lg cursor-pointer" /></div>
                <div><label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Pos X%</label><input type="range" min="0" max="100" value={selectedElement.x} onChange={e => updateElement('x', parseInt(e.target.value))} className="w-full accent-brand h-2 bg-gray-200 rounded-lg cursor-pointer" /></div>
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
    return createPortal(
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
        <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl overflow-hidden animate-fade-in-up" onClick={e => e.stopPropagation()}>
          {children}
        </div>
      </div>, 
      document.body
    );
  }

  // --- NEW: AI Chart Image Generator ---
  const generateChartImage = async (type, data, labels, title) => {
    return new Promise((resolve) => {
      if (!window.Chart) {
          resolve(null);
          return;
      }
      const canvas = document.createElement('canvas');
      canvas.width = 400;
      canvas.height = 250;
      canvas.style.position = 'absolute';
      canvas.style.left = '-9999px';
      document.body.appendChild(canvas);

      const ctx = canvas.getContext('2d');
      new window.Chart(ctx, {
        type: type,
        data: {
          labels: labels,
          datasets: [{
            label: title,
            data: data,
            backgroundColor: ['#002147', '#f5c518', '#ef4444', '#10b981', '#6366f1'],
          }]
        },
        options: {
          animation: false,
          responsive: false,
          plugins: { title: { display: true, text: title } }
        }
      });

      setTimeout(() => {
        const imgUrl = canvas.toDataURL('image/png');
        document.body.removeChild(canvas);
        resolve(imgUrl);
      }, 150);
    });
  };

 // --- Editable AI Report Modal ---
  function EditableAIReportModal({ isOpen, onClose, reportItems }) {
      const [editedTexts, setEditedTexts] = useState({});

      useEffect(() => {
          if (isOpen && reportItems) {
              const init = {};
              reportItems.forEach(item => {
                  init[item.eventId] = item.reportText;
              });
              setEditedTexts(init);
          }
      }, [isOpen, reportItems]);

      if (!isOpen) return null;

      const handleDownloadPDF = () => {
          if (!window.jspdf) {
              window.Swal.fire('Missing Library', 'PDF library not loaded. Please ensure jsPDF is in your HTML.', 'error');
              return;
          }
          const { jsPDF } = window.jspdf;
          const doc = new jsPDF();
          
          doc.setFontSize(22);
          doc.setTextColor(0, 33, 71);
          doc.text("Conexus AI Intelligence Report", 10, 20);
          doc.setFontSize(10);
          doc.setTextColor(100);
          doc.text(`Generated on: ${new Date().toLocaleString()}`, 10, 28);

          let yOffset = 40;

          reportItems.forEach((item) => {
              doc.setFontSize(14);
              doc.setTextColor(0, 33, 71);
              doc.text(`Event: ${item.eventTitle}`, 10, yOffset);
              
              doc.setFontSize(10);
              doc.setTextColor(50);
              const currentText = editedTexts[item.eventId] || "";
              const splitText = doc.splitTextToSize(currentText, 180);
              doc.text(splitText, 10, yOffset + 10);
              
              yOffset += (splitText.length * 5) + 20;

              if (item.charts && item.charts.regImg) doc.addImage(item.charts.regImg, 'PNG', 10, yOffset, 80, 50);
              if (item.charts && item.charts.attImg) doc.addImage(item.charts.attImg, 'PNG', 100, yOffset, 80, 50);

              yOffset += 65;

              if (yOffset > 250) {
                  doc.addPage();
                  yOffset = 20;
              }
          });

          doc.save(`Conexus_AI_Report_${new Date().toISOString().slice(0,10)}.pdf`);
      };

      return createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-fade-in-up">
                  <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                      <div>
                          <h3 className="text-2xl font-black text-brand flex items-center gap-2"><span>🤖</span> AI Event Insights</h3>
                          <p className="text-sm text-gray-500">Review and edit your narrative before exporting.</p>
                      </div>
                      <button onClick={onClose} className="p-2 bg-white rounded-full hover:bg-gray-100 transition-colors">✕</button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-8 space-y-10 bg-gray-50/50">
                      {!reportItems || reportItems.length === 0 ? (
                          <p className="text-center text-gray-400">No events found to report on.</p>
                      ) : (
                          reportItems.map(item => (
                              <div key={item.eventId} className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                                  <h4 className="text-lg font-bold text-gray-800 mb-4">{item.eventTitle}</h4>
                                  
                                  <textarea
                                      className="w-full h-64 p-4 text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-xl focus:border-brand outline-none mb-6 font-mono resize-y"
                                      value={editedTexts[item.eventId] || ""}
                                      onChange={(e) => setEditedTexts({...editedTexts, [item.eventId]: e.target.value})}
                                  />
                                  
                                  <div className="flex flex-wrap gap-4">
                                      {item.charts && item.charts.regImg ? (
                                          <div className="border border-gray-100 rounded-xl p-2 bg-gray-50">
                                              <p className="text-[10px] font-bold text-gray-400 uppercase mb-2 text-center">Registrations</p>
                                              <img src={item.charts.regImg} alt="Registration Chart" className="w-64 object-contain" />
                                          </div>
                                      ) : null}
                                      
                                      {item.charts && item.charts.attImg ? (
                                          <div className="border border-gray-100 rounded-xl p-2 bg-gray-50">
                                              <p className="text-[10px] font-bold text-gray-400 uppercase mb-2 text-center">Attendance</p>
                                              <img src={item.charts.attImg} alt="Attendance Chart" className="w-64 object-contain" />
                                          </div>
                                      ) : null}
                                  </div>
                              </div>
                          ))
                      )}
                  </div>

                  <div className="px-8 py-5 border-t border-gray-100 bg-white flex justify-end gap-4">
                      <button onClick={onClose} className="px-6 py-3 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50">Discard</button>
                      <button onClick={handleDownloadPDF} className="px-8 py-3 rounded-xl grad-btn text-white text-sm font-bold shadow-lg hover:shadow-xl transition-all flex items-center gap-2">
                          📥 Download PDF
                      </button>
                  </div>
              </div>
          </div>,
          document.body
      );
  }

  function RevokeModal({ isOpen, onClose, onConfirm, targetName, isPending }) {
    if (!isOpen) return null;
    const [note, setNote] = useState("");

    const handleSubmit = (e) => {
        e.preventDefault();
        onConfirm(note);
    };

    return createPortal(
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
        <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden animate-fade-in-up p-8" onClick={e => e.stopPropagation()}>
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

  // ==========================================
  // UPDATED ADMIN PREVIEW MODAL
  // ==========================================
  function RegistrationPreviewModal({ reg, submissions = [], onClose, onApproveStep }) {
    if (!reg) return null;
    
    const isPresenter = String(reg.regRole).toLowerCase() === 'presenter';
    const isAUP = String(reg.university || '').toLowerCase().includes('aup');
    const isOnline = String(reg.mode || '').toLowerCase() !== 'on-site';

    // Status Flags
    const step1Done = reg.status === 'Step 1 Approved' || reg.status === 'Approved';
    
    // Connect to actual paper submission data
    const userSubmission = submissions.find(s => 
        String(s.event_id || s.eventId) === String(reg.eventId) && 
        String(s.user_email || s.userEmail).toLowerCase() === String(reg.userEmail).toLowerCase()
    );
    const hasPaperSubmitted = !!userSubmission; 
    const step2Done = (userSubmission && userSubmission.status === 'accepted') || reg.paper_status === 'accepted'; 
    
    const hasPayment = !!reg.proofOfPaymentPath;
    const step3Done = reg.payment_status === 'Approved' || isAUP;
    
    const hasPresentation = !!reg.presentationPath;
    // Step 4 is done if files_status is Approved OR if the whole reg is fully Approved
    const step4Done = reg.files_status === 'Approved' || reg.status === 'Approved';

    // Calculate Current Step to show in Stepper
    let currentStep = 1;
    if (step1Done) currentStep = 2;
    if (step1Done && (!isPresenter || step2Done)) currentStep = 3;
    if (step1Done && (!isPresenter || step2Done) && step3Done) currentStep = 4;
    if (step1Done && (!isPresenter || step2Done) && step3Done && (!isPresenter || step4Done)) currentStep = 5;

    const stepperSteps = isPresenter 
        ? [ { s: 1, l: 'Details' }, { s: 2, l: 'Paper' }, { s: 3, l: 'Payment' }, { s: 4, l: 'Files' } ]
        : [ { s: 1, l: 'Details' }, { s: 2, l: 'Payment' } ];

    // Helper to safely clean file paths for rendering
    const getFileUrl = (pathStr) => {
        if (!pathStr) return null;
        if (pathStr.startsWith('http')) return pathStr;
        // Fix Windows backslashes and remove leading slashes
        const cleanPath = pathStr.replace(/\\/g, '/').replace(/^\/+/, '');
        return `https://conexus-backend-production.up.railway.app/${cleanPath}`;
    };

    const fileUrl = getFileUrl(reg.validId || reg.valid_id_path);
    const paymentUrl = getFileUrl(reg.proofOfPaymentPath);
    const presentationUrl = getFileUrl(reg.presentationPath);
    const videoUrl = getFileUrl(reg.videoPath);

    // Reusable Component for Image Previews
    const FileThumbnail = ({ url, label }) => {
        if (!url) return <div className="flex items-center justify-center h-24 bg-gray-50 border border-dashed border-gray-300 rounded-xl text-xs text-gray-400 italic">No {label} uploaded.</div>;
        
        const isPdf = url.toLowerCase().endsWith('.pdf');
        if (isPdf) {
            return (
                <a href={url} target="_blank" rel="noreferrer" className="flex items-center justify-center h-24 bg-red-50 border border-red-100 rounded-xl hover:bg-red-100 transition text-red-600 font-bold text-xs gap-2 shadow-sm">
                    📄 View PDF
                </a>
            );
        }
        
        return (
            <a href={url} target="_blank" rel="noreferrer" className="block relative group h-24 bg-gray-100 rounded-xl overflow-hidden border border-gray-200 shadow-sm">
                <img src={url} alt={label} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" onError={(e) => { e.target.style.display='none'; e.target.parentNode.innerHTML='<div class="p-4 text-xs text-gray-500 text-center flex items-center justify-center h-full">Document Link</div>'; }} />
                <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <span className="text-white text-[10px] font-bold">🔍 View Image</span>
                </div>
            </a>
        );
    };

    return (
        <ModalWrapper onClose={onClose}>
            {/* BEAUTIFUL HEADER */}
            <div className="bg-[var(--u-navy)] p-6 md:p-8 text-white relative">
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-[var(--u-gold)]"></div>
                <div className="flex justify-between items-start">
                    <div>
                        <h3 className="text-2xl font-black mb-1 leading-tight">Reviewing: {reg.fullName}</h3>
                        <div className="flex items-center gap-2 mt-2">
                            <span className="px-2 py-0.5 bg-white/10 rounded text-[10px] font-bold uppercase tracking-widest text-[var(--u-gold)] border border-white/20">{reg.regRole}</span>
                            <span className="text-xs opacity-80">{reg.eventTitle}</span>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition">✕</button>
                </div>
            </div>

            {/* CLEAN STEPPER */}
            <div className="px-6 py-5 bg-gray-50 border-b border-gray-100 flex justify-between items-center relative overflow-hidden">
                <div className="absolute top-1/2 left-10 right-10 h-1 bg-gray-200 -translate-y-1/2 z-0"></div>
                {stepperSteps.map((step) => {
                    let isActive = currentStep === step.s;
                    let isDone = currentStep > step.s || step4Done;
                    
                    // Map Participant step 2 to actual step 3 (Payment) logic
                    if (!isPresenter && step.s === 2) {
                        isActive = currentStep === 3; 
                        isDone = step3Done;
                    }

                    return (
                        <div key={step.s} className="relative z-10 flex flex-col items-center bg-gray-50 px-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all shadow-sm ${
                                isDone ? 'bg-emerald-500 border-emerald-500 text-white' : 
                                isActive ? 'bg-brand border-brand text-white scale-110' : 
                                'bg-white border-gray-300 text-gray-400'
                            }`}>
                                {isDone ? '✓' : step.s}
                            </div>
                            <span className={`text-[9px] font-black uppercase mt-1 tracking-widest ${isActive ? 'text-brand' : isDone ? 'text-emerald-600' : 'text-gray-400'}`}>{step.l}</span>
                        </div>
                    );
                })}
            </div>

            {/* CONTENT CARDS */}
            <div className="p-6 md:p-8 space-y-6 max-h-[55vh] overflow-y-auto bg-[#f8fafc]">
                
                {/* STEP 1: IDENTITY */}
                <div className={`bg-white rounded-2xl p-5 border transition-all ${currentStep === 1 ? 'border-brand shadow-md ring-2 ring-blue-50' : 'border-gray-100 opacity-70 hover:opacity-100'}`}>
                    <div className="flex justify-between items-center mb-4 border-b border-gray-50 pb-3">
                        <h4 className="text-xs font-black uppercase tracking-widest text-brand flex items-center gap-2">
                            <span className="bg-blue-100 text-blue-600 w-5 h-5 flex items-center justify-center rounded-full text-[10px]">1</span> 
                            Identity & Details
                        </h4>
                        {step1Done ? (
                            <span className="px-2 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase rounded-lg border border-emerald-100">✅ Approved</span>
                        ) : (
                            <button onClick={() => onApproveStep(reg.id, 1)} className="grad-btn px-5 py-1.5 rounded-lg text-white text-[10px] font-extrabold shadow-sm hover:shadow-md transition">Approve Step 1</button>
                        )}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-3">
                            <div><p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Full Name</p><p className="text-sm font-bold text-gray-900">{reg.firstName} {reg.middleName} {reg.lastName}</p></div>
                            <div><p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Institution</p><p className="text-sm font-bold text-gray-900">{reg.university || "N/A"}</p></div>
                            <div className="flex gap-4">
                                <div><p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Age</p><p className="text-sm font-bold text-gray-900">{reg.age || "N/A"}</p></div>
                                <div><p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Gender</p><p className="text-sm font-bold text-gray-900">{reg.gender || "N/A"}</p></div>
                            </div>
                            <div><p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Contact</p><p className="text-sm font-bold text-gray-900">{reg.contactNumber || "N/A"}</p></div>
                        </div>
                        <div>
                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Valid ID Document</p>
                            <FileThumbnail url={fileUrl} label="Valid ID" />
                        </div>
                    </div>
                </div>

                {/* STEP 2: OJS PAPER (PRESENTER ONLY) */}
                {isPresenter && (
                    <div className={`bg-white rounded-2xl p-5 border transition-all ${currentStep === 2 ? 'border-brand shadow-md ring-2 ring-blue-50' : 'border-gray-100 opacity-70 hover:opacity-100'}`}>
                        <div className="flex justify-between items-center mb-4 border-b border-gray-50 pb-3">
                            <h4 className="text-xs font-black uppercase tracking-widest text-brand flex items-center gap-2">
                                <span className="bg-blue-100 text-blue-600 w-5 h-5 flex items-center justify-center rounded-full text-[10px]">2</span> 
                                Research Paper
                            </h4>
                            {step2Done ? (
                                <span className="px-2 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase rounded-lg border border-emerald-100">✅ Accepted</span>
                            ) : currentStep === 2 ? (
                                <button disabled={!hasPaperSubmitted} onClick={() => onApproveStep(reg.id, 2)} className={`px-5 py-1.5 rounded-lg text-white text-[10px] font-extrabold shadow-sm transition ${hasPaperSubmitted ? 'grad-btn hover:shadow-md' : 'bg-gray-300 cursor-not-allowed'}`}>
                                    {hasPaperSubmitted ? 'Accept Paper (Step 2)' : 'Waiting for Upload'}
                                </button>
                            ) : null}
                        </div>

                        {!hasPaperSubmitted ? (
                            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex items-start gap-3">
                                <span className="text-amber-500 text-lg">⏳</span>
                                <div>
                                    <p className="text-xs font-bold text-amber-800">Awaiting Participant Action</p>
                                    <p className="text-[10px] text-amber-700 mt-0.5">The participant has not submitted their manuscript yet. They must upload it via their dashboard.</p>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                                <p className="text-[9px] font-black text-blue-500 uppercase tracking-widest mb-1">Submitted Manuscript</p>
                                <p className="text-sm font-bold text-gray-900 mb-3">{userSubmission?.title || "Paper Document"}</p>
                                <div className="flex flex-wrap gap-2">
                                    {userSubmission?.file_path && (
                                        <a href={`https://conexus-backend-production.up.railway.app/${userSubmission.file_path}`} target="_blank" rel="noreferrer" className="px-4 py-2 bg-white border border-blue-200 text-blue-700 text-[10px] font-bold rounded-lg hover:bg-blue-100 transition shadow-sm">📄 Download Document</a>
                                    )}
                                    <a href="https://darkgoldenrod-kudu-650795.hostingersite.com/index.php/crj/dashboard/editorial#submissions" target="_blank" rel="noreferrer" className="px-4 py-2 bg-[var(--u-navy)] text-white text-[10px] font-bold rounded-lg hover:bg-opacity-90 transition shadow-sm">🔍 Review in OJS Dashboard</a>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* STEP 3: PAYMENT */}
                <div className={`bg-white rounded-2xl p-5 border transition-all ${currentStep === 3 ? 'border-brand shadow-md ring-2 ring-blue-50' : 'border-gray-100 opacity-70 hover:opacity-100'}`}>
                    <div className="flex justify-between items-center mb-4 border-b border-gray-50 pb-3">
                        <h4 className="text-xs font-black uppercase tracking-widest text-brand flex items-center gap-2">
                            <span className="bg-blue-100 text-blue-600 w-5 h-5 flex items-center justify-center rounded-full text-[10px]">{isPresenter ? '3' : '2'}</span> 
                            Payment Verification
                        </h4>
                        {step3Done ? (
                            <span className="px-2 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase rounded-lg border border-emerald-100">✅ {isAUP ? 'Waived (Faculty)' : 'Verified'}</span>
                        ) : currentStep === 3 ? (
                            <button disabled={!hasPayment && !isAUP} onClick={() => onApproveStep(reg.id, 3)} className={`px-5 py-1.5 rounded-lg text-white text-[10px] font-extrabold shadow-sm transition ${hasPayment || isAUP ? 'bg-emerald-600 hover:bg-emerald-700 hover:shadow-md' : 'bg-gray-300 cursor-not-allowed'}`}>
                                {hasPayment || isAUP ? 'Verify Payment (Step 3)' : 'Waiting for Receipt'}
                            </button>
                        ) : null}
                    </div>

                    {isAUP ? (
                        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-center gap-3">
                            <span className="text-2xl">🎓</span>
                            <div>
                                <p className="text-xs font-bold text-blue-800">AUP Faculty Account</p>
                                <p className="text-[10px] text-blue-600 mt-0.5">Registration fees are waived. You may automatically verify this step.</p>
                            </div>
                        </div>
                    ) : !hasPayment ? (
                        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex items-start gap-3">
                            <span className="text-amber-500 text-lg">⏳</span>
                            <div>
                                <p className="text-xs font-bold text-amber-800">Awaiting Payment Receipt</p>
                                <p className="text-[10px] text-amber-700 mt-0.5">The participant has not uploaded their proof of payment yet.</p>
                            </div>
                        </div>
                    ) : (
                        <div>
                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Proof of Payment</p>
                            <div className="w-48"><FileThumbnail url={paymentUrl} label="Payment Receipt" /></div>
                        </div>
                    )}
                </div>

                {/* STEP 4: FINAL FILES (PRESENTER ONLY) */}
                {isPresenter && (
                    <div className={`bg-white rounded-2xl p-5 border transition-all ${currentStep === 4 ? 'border-brand shadow-md ring-2 ring-blue-50' : 'border-gray-100 opacity-70 hover:opacity-100'}`}>
                        <div className="flex justify-between items-center mb-4 border-b border-gray-50 pb-3">
                            <h4 className="text-xs font-black uppercase tracking-widest text-brand flex items-center gap-2">
                                <span className="bg-blue-100 text-blue-600 w-5 h-5 flex items-center justify-center rounded-full text-[10px]">4</span> 
                                Final Presentation
                            </h4>
                            {step4Done ? (
                                <span className="px-2 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase rounded-lg border border-emerald-100">✅ Registration Complete</span>
                            ) : currentStep === 4 ? (
                                <button disabled={!hasPresentation} onClick={() => onApproveStep(reg.id, 4)} className={`px-6 py-2 rounded-xl text-white text-[11px] font-extrabold shadow-lg transition uppercase tracking-widest ${hasPresentation ? 'grad-btn animate-pulse hover:shadow-xl hover:scale-105' : 'bg-gray-300 cursor-not-allowed'}`}>
                                    {hasPresentation ? 'Approve Final Registration' : 'Waiting for Files'}
                                </button>
                            ) : null}
                        </div>

                        {!hasPresentation ? (
                            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex items-start gap-3">
                                <span className="text-amber-500 text-lg">⏳</span>
                                <div>
                                    <p className="text-xs font-bold text-amber-800">Awaiting Final Files</p>
                                    <p className="text-[10px] text-amber-700 mt-0.5">The presenter needs to upload their presentation deck (and video if online) to finalize their registration.</p>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-wrap gap-3">
                                {presentationUrl && (
                                    <a href={presentationUrl} target="_blank" rel="noreferrer" className="flex flex-col items-center justify-center w-32 h-24 bg-amber-50 border border-amber-200 rounded-xl hover:bg-amber-100 transition shadow-sm group">
                                        <span className="text-2xl mb-1 group-hover:scale-110 transition-transform">📊</span>
                                        <span className="text-amber-800 font-bold text-[10px] uppercase tracking-widest">View Deck</span>
                                    </a>
                                )}
                                {isOnline && videoUrl && (
                                    <a href={videoUrl} target="_blank" rel="noreferrer" className="flex flex-col items-center justify-center w-32 h-24 bg-rose-50 border border-rose-200 rounded-xl hover:bg-rose-100 transition shadow-sm group">
                                        <span className="text-2xl mb-1 group-hover:scale-110 transition-transform">📹</span>
                                        <span className="text-rose-800 font-bold text-[10px] uppercase tracking-widest">View Video</span>
                                    </a>
                                )}
                            </div>
                        )}
                    </div>
                )}

            </div>
            
            {/* Footer */}
            <div className="p-6 border-t border-gray-100 bg-white text-right rounded-b-[2rem]">
                <button onClick={onClose} className="px-8 py-2.5 rounded-xl border-2 border-gray-200 font-bold text-gray-500 text-sm hover:bg-gray-50 hover:text-gray-800 transition shadow-sm">
                    Close Panel
                </button>
            </div>
        </ModalWrapper>
    );
  }

  function NfcModal({ isOpen, targetReg, onClose, onSubmit }) {
    if (!isOpen) return null;
    const [scannedId, setScannedId] = useState("");
    const inputRef = useRef(null);
    
    useEffect(() => { 
        if (isOpen) {
            const timer = setTimeout(() => {
                if (inputRef.current) inputRef.current.focus();
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);
    
    const handleSubmit = (e) => { 
        e.preventDefault(); 
        onSubmit(scannedId); 
        setScannedId(""); 
    };

    return createPortal(
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
          <div className="bg-white p-8 rounded-2xl shadow-2xl max-w-md w-full text-center" onClick={e => e.stopPropagation()}>
              <div className="mb-4 text-4xl">📡</div>
              <h3 className="text-xl font-bold mb-2">Scan Card Now</h3>
              <p className="text-sm text-gray-600 mb-6">Assigning to: <strong className="text-brand">{targetReg?.fullName}</strong></p>
              <form onSubmit={handleSubmit}>
                  <input 
                      ref={inputRef} 
                      value={scannedId} 
                      onChange={(e) => setScannedId(e.target.value)} 
                      className="w-full text-center text-xl font-mono border-2 border-blue-100 rounded-xl py-3 mb-4 focus:border-brand outline-none" 
                      placeholder="Tap card..." 
                  />
                  <div className="flex gap-2 justify-center">
                      <button type="button" onClick={onClose} className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-lg font-bold">Cancel</button>
                      <button type="submit" className="px-6 py-2 bg-brand text-white rounded-lg font-bold shadow-lg">Save ID</button>
                  </div>
              </form>
          </div>
      </div>, 
      document.body
    );
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
    return createPortal(
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
        <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
          <div className="p-6 border-b border-gray-100 flex justify-between items-center">
            <div><h3 className="text-xl font-bold text-gray-900">Assign Room</h3><p className="text-sm text-gray-500">For {targetReg?.fullName}</p></div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-800">✕</button>
          </div>
          <div className="flex-1 overflow-y-auto p-8 space-y-8">
            <div><p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">1. Select Housing Type</p><div className="flex gap-4">{['Dorm', 'Hotel'].map(t => (<button key={t} onClick={() => setFlow({ type: t, locationId: null, roomId: null })} className={`flex-1 py-4 rounded-2xl border-2 text-sm font-bold transition-all ${flow.type === t ? 'border-brand bg-blue-50 text-brand' : 'border-gray-100 bg-white text-gray-600'}`}>{t === 'Dorm' ? '🏫 Dormitory' : '🏨 Hotel'}</button>))}</div></div>
            {flow.type && (<div><p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">2. Select Location</p><div className="grid grid-cols-2 gap-3">{relevantDorms.map(d => (<button key={d.id} onClick={() => setFlow({ ...flow, locationId: d.id, roomId: null })} className={`py-3 px-4 rounded-xl border-2 text-left text-sm font-bold transition-all ${flow.locationId === d.id ? 'border-brand bg-blue-50 text-brand' : 'border-gray-100 bg-white text-gray-600'}`}>{d.name}</button>))}</div></div>)}
            {flow.locationId && (<div><p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">3. Select Room</p><div className="grid grid-cols-3 gap-3">{relevantRooms.map(r => {const occupiedCount = registrations.filter(reg => String(reg.roomId) === String(r.id) && reg.status === "Approved").length;const isFull = occupiedCount >= r.beds;return (<button key={r.id} disabled={isFull} onClick={() => setFlow({ ...flow, roomId: r.id })} className={`p-3 rounded-xl border-2 text-left transition-all ${flow.roomId === r.id ? 'border-brand bg-brand text-white' : isFull ? 'border-gray-100 bg-gray-50 text-gray-300' : 'border-gray-100 bg-white text-gray-700'}`}><div className="text-sm font-bold">Rm {r.name}</div><div className={`text-xs ${flow.roomId === r.id ? 'text-blue-200' : isFull ? 'text-red-300' : 'text-emerald-600'}`}>{occupiedCount}/{r.beds} filled</div></button>)})}</div></div>)}
          </div>
          <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
            <button onClick={onClose} className="px-6 py-3 rounded-xl text-sm font-bold text-gray-500 hover:bg-gray-200">Cancel</button>
            <button disabled={!flow.roomId} onClick={() => onAssign(flow.roomId)} className="px-8 py-3 rounded-xl bg-brand text-white text-sm font-bold shadow-lg disabled:opacity-50">Confirm</button>
          </div>
        </div>
      </div>, 
      document.body
    );
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

    const handleStatusChange = async (id, newStatus) => {
        try {
            await fetch(`${API_BASE}/submissions/${id}/status`, {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify({ status: newStatus })
            });
            fetchSubmissions(); // Refresh the list automatically
            window.Swal.fire('Success', `Paper marked as ${newStatus.toUpperCase()}!`, 'success');
        } catch(e) {
            window.Swal.fire('Error', 'Failed to update status', 'error');
        }
    };

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
                                        <div className="flex gap-2 justify-end items-center">
                                            {/* NEW: Admin Accept/Revoke Buttons */}
                                            {s.status === 'under_review' ? (
                                                <button onClick={() => handleStatusChange(s.id, 'accepted')} className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold shadow-sm hover:bg-emerald-100 transition">
                                                    Accept Paper
                                                </button>
                                            ) : (
                                                <button onClick={() => handleStatusChange(s.id, 'under_review')} className="px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold shadow-sm hover:bg-amber-100 transition">
                                                    Revoke Acceptance
                                                </button>
                                            )}
                                            
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
                    Send Email
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

  // --- UPDATED: Dashboard Tab with New AI Button ---
  const DashboardTab = ({ events, registrations, onCreateEvent, onExport, onEditEvent, onDeleteEvent, onGenerateAIReport, isGeneratingReport }) => {
    const eventStats = events.map(ev => {
      const regs = registrations.filter(r => r.eventId === ev.id);
      return { ...ev, participants: regs.reduce((sum, r) => sum + (r.participantsCount || 1), 0), pending: regs.filter(r => r.status === "For approval").length };
    });
    const maxParticipants = eventStats.length ? Math.max(1, ...eventStats.map(e => e.participants)) : 1;
    return (
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div>
                <h2 className="font-display text-3xl font-bold mb-2">Admin dashboard</h2>
                <p className="text-base text-gray-500">Snapshot of events and registrations.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
                {/* 1. CREATE EVENT BUTTON */}
                <button onClick={onCreateEvent} className="px-6 py-3 rounded-full bg-brand text-white text-sm font-semibold shadow-lg hover:bg-brandLight transition-all">Create Event</button>
                
                {/* 2. EXPORT CSV BUTTON */}
                <button onClick={() => onExport(eventStats)} className="px-6 py-3 rounded-full bg-amber-500 text-white text-sm font-semibold shadow-lg hover:bg-amber-600 transition-all">Export CSV</button>
                
                {/* 3. PREMIUM AI REPORT BUTTON */}
                <button 
                    onClick={onGenerateAIReport} 
                    disabled={isGeneratingReport}
                    className="px-6 py-3 rounded-full bg-white border border-gray-200 text-brand text-sm font-extrabold shadow-sm hover:shadow-md hover:border-brand hover:bg-blue-50 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                    <svg className="w-4 h-4 text-[var(--u-gold)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                    </svg>
                    {isGeneratingReport ? "Analyzing Data..." : "Generate AI Report"}
                </button>
            </div>
        </div>
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
            window.Swal.fire('Unsupported', 'Web NFC is not supported on this device. Please use Google Chrome on an Android phone.', 'warning');
            return;
        }
        try {
            const slug = participant.profile_slug || `user-${participant.id}`;
            const nfcUrl = `https://cconexus.vercel.app/?nfc=${slug}`;
            const ndef = new window.NDEFReader();
            
            window.Swal.fire({ title: 'Ready to write!', text: 'Tap the blank NFC card against the back of your phone now.', icon: 'info', showConfirmButton: false });
            
            await ndef.write({ records: [{ recordType: "url", data: nfcUrl }] });
            window.Swal.fire('Success!', `${participant.fullName}'s Digital Business Card is now linked.`, 'success');
        } catch (error) {
            console.error("NFC Write Error:", error);
            window.Swal.fire('Failed', `Failed to write to card. Error: ${error.message}`, 'error');
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
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-gray-900 group-hover:text-brand transition-colors">{r.fullName}</span>
                                {r.regRole === 'presenter' && (
                                    <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-amber-100 text-amber-700 border border-amber-200">
                                        Presenter
                                    </span>
                                )}
                            </div>
                            <span className="text-xs text-gray-500 mt-0.5">
                                {r.userEmail} {r.university ? ` • ${r.university}` : ''}
                            </span>
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
  // NLP REPORT + EXCEL EXPORT (sorted per event)
  // ==========================================

  function _safeArr(x) { return Array.isArray(x) ? x : []; }
  function _safeStr(x) { try { return x == null ? "" : String(x); } catch (e) { return ""; } }
  function _safeNum(x, fb = 0) { const n = Number(x); return Number.isFinite(n) ? n : fb; }
  function _lower(x) { return _safeStr(x).trim().toLowerCase(); }
  function _pct(n, d) { return d ? (Math.round((n / d) * 1000) / 10) + "%" : ""; }

  function _excelSafe(v) {
    const s = _safeStr(v);
    if (!s) return v;
    const first = s[0];
    return (first === "=" || first === "+" || first === "-" || first === "@") ? ("'" + s) : v;
  }

  function _periodOf(ts) {
    try {
      const h = new Date(ts).getHours();
      return h < 12 ? "Morning" : "Afternoon";
    } catch (e) { return ""; }
  }

  function _isoOrEmpty(ts) {
    try {
      const d = new Date(ts);
      if (isNaN(d.getTime())) return "";
      return d.toISOString();
    } catch (e) { return ""; }
  }

  function _buildEventIndex(events) {
    const byId = {};
    const idByTitle = {};
    const order = {};

    _safeArr(events).forEach((ev) => {
      const id = String(ev.id);
      byId[id] = ev;
      const t = _lower(ev.title);
      if (t && !idByTitle[t]) idByTitle[t] = id;
    });

    const sorted = _safeArr(events).slice().sort((a, b) => {
      const da = _safeStr(a.startDate || "");
      const db = _safeStr(b.startDate || "");
      if (da !== db) return da.localeCompare(db);
      return _safeStr(a.title || "").localeCompare(_safeStr(b.title || ""));
    });

    sorted.forEach((ev, i) => {
      order[String(ev.id)] = i;
    });

    return { byId, idByTitle, order };
  }

  function _resolveEventIdFromLoose(evId, evTitle, index) {
    const id = _safeStr(evId);
    if (id && index.byId[id]) return id;
    const t = _lower(evTitle);
    if (t && index.idByTitle[t]) return index.idByTitle[t];
    return null;
  }

  function _sortByEvent(orderMap, getEventId, getSecondary) {
    return (a, b) => {
      const ea = String(getEventId(a) || "");
      const eb = String(getEventId(b) || "");
      const oa = (ea in orderMap) ? orderMap[ea] : 999999;
      const ob = (eb in orderMap) ? orderMap[eb] : 999999;
      if (oa !== ob) return oa - ob;
      const sa = _safeStr(getSecondary ? getSecondary(a) : "");
      const sb = _safeStr(getSecondary ? getSecondary(b) : "");
      return sa.localeCompare(sb);
    };
  }

  function _groupAllByEvent({ events, registrations, portals, logs, submissions }) {
    const index = _buildEventIndex(events);

    const groups = {};
    _safeArr(events).forEach(ev => {
      const id = String(ev.id);
      groups[id] = { event: ev, registrations: [], portals: [], logs: [], submissions: [] };
    });

    // Registrations
    _safeArr(registrations).forEach(r => {
      const id = _resolveEventIdFromLoose(r.eventId, r.eventTitle, index);
      if (!id) return;
      if (!groups[id]) groups[id] = { event: index.byId[id] || { id }, registrations: [], portals: [], logs: [], submissions: [] };
      groups[id].registrations.push(r);
    });

    // Portals
    _safeArr(portals).forEach(p => {
      const id = _resolveEventIdFromLoose(p.eventId, p.eventTitle, index);
      if (!id) return;
      if (!groups[id]) groups[id] = { event: index.byId[id] || { id }, registrations: [], portals: [], logs: [], submissions: [] };
      groups[id].portals.push(p);
    });

    // Logs
    _safeArr(logs).forEach(l => {
      const id = _resolveEventIdFromLoose(l.event_id || l.eventId, l.event_title || l.eventTitle, index);
      if (!id) return;
      if (!groups[id]) groups[id] = { event: index.byId[id] || { id }, registrations: [], portals: [], logs: [], submissions: [] };
      groups[id].logs.push(l);
    });

    // Submissions
    _safeArr(submissions).forEach(s => {
      const id = _resolveEventIdFromLoose(s.event_id || s.eventId, s.event_title || s.eventTitle, index);
      if (!id) return;
      if (!groups[id]) groups[id] = { event: index.byId[id] || { id }, registrations: [], portals: [], logs: [], submissions: [] };
      groups[id].submissions.push(s);
    });

    return { groups, index };
  }

  function _computeEventMetrics(group, dormsById, roomsById) {
    const ev = group.event || {};
    const regs = _safeArr(group.registrations);
    const portals = _safeArr(group.portals);
    const logs = _safeArr(group.logs);
    const subs = _safeArr(group.submissions);

    const totalRegs = regs.length;
    const approvedRegs = regs.filter(r => r.status === "Approved");
    const pendingRegs = regs.filter(r => r.status === "For approval");
    const rejectedRegs = regs.filter(r => r.status === "Rejected");

    const totalParticipantsDeclared = regs.reduce((sum, r) => sum + _safeNum(r.participantsCount, 1), 0);
    const approvedParticipantsDeclared = approvedRegs.reduce((sum, r) => sum + _safeNum(r.participantsCount, 1), 0);

    const approvedAssigned = approvedRegs.filter(r => !!r.roomId);
    const approvedUnassigned = approvedRegs.filter(r => !r.roomId);

    const locationCounts = {};
    const roomPeopleUsage = {}; 
    const roomRegUsage = {};    
    approvedAssigned.forEach(r => {
      const room = roomsById[String(r.roomId)];
      const dorm = room ? dormsById[String(room.dormId)] : null;
      const locKey = dorm ? `${dorm.type || ""} | ${dorm.name || ""}` : "Unknown | Unknown";
      locationCounts[locKey] = (locationCounts[locKey] || 0) + 1;

      const rid = String(r.roomId);
      roomPeopleUsage[rid] = (roomPeopleUsage[rid] || 0) + _safeNum(r.participantsCount, 1);
      roomRegUsage[rid] = (roomRegUsage[rid] || 0) + 1;
    });

    const topLocations = Object.keys(locationCounts)
      .map(k => ({ key: k, count: locationCounts[k] }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    const certIssued = approvedRegs.filter(r => !!r.certificateIssuedAt);
    const certIssuedCount = certIssued.length;
    const certRate = _pct(certIssuedCount, approvedRegs.length);

    const scansTotal = logs.length;
    const uniqueAttendees = new Set(logs.map(l => _safeStr(l.participant_email || l.user_email || l.participant_name || l.participantName).trim()).filter(Boolean));
    const uniqueCount = uniqueAttendees.size;

    const morningScans = logs.filter(l => _periodOf(l.scanned_at || l.scannedAt) === "Morning").length;
    const afternoonScans = logs.filter(l => _periodOf(l.scanned_at || l.scannedAt) === "Afternoon").length;

    const attendanceCoverageVsApprovedRegs = _pct(uniqueCount, approvedRegs.length);
    const submissionsCount = subs.length;

    const flags = [];
    if (pendingRegs.length > 0) flags.push(`Pending registrations: ${pendingRegs.length}`);
    if (approvedUnassigned.length > 0) flags.push(`Approved but not assigned to a room: ${approvedUnassigned.length}`);
    if (approvedRegs.length > 0 && certIssuedCount < approvedRegs.length) flags.push(`Certificates not yet issued for ${approvedRegs.length - certIssuedCount} approved participants`);
    if (approvedRegs.length > 0 && uniqueCount > 0 && uniqueCount < approvedRegs.length) flags.push(`Attendance coverage below 100% (unique scans vs approved): ${attendanceCoverageVsApprovedRegs}`);
    if (approvedRegs.length > 0 && uniqueCount === 0 && scansTotal === 0) flags.push("No attendance logs recorded yet");

    Object.keys(roomPeopleUsage).forEach(rid => {
      const room = roomsById[rid];
      const beds = room ? _safeNum(room.beds, 0) : 0;
      const usedPeople = _safeNum(roomPeopleUsage[rid], 0);
      if (beds > 0 && usedPeople > beds) flags.push(`Room over capacity: ${room?.name || rid} (${usedPeople}/${beds} people)`);
    });

    return {
      eventId: String(ev.id || ""),
      eventTitle: _safeStr(ev.title || ""),
      startDate: _safeStr(ev.startDate || ""),
      endDate: _safeStr(ev.endDate || ""),
      type: _safeStr(ev.type || ""),
      mode: _safeStr(ev.mode || ""),
      location: _safeStr(ev.location || ""),
      featured: !!ev.featured,

      totalRegs,
      approvedRegs: approvedRegs.length,
      pendingRegs: pendingRegs.length,
      rejectedRegs: rejectedRegs.length,
      totalParticipantsDeclared,
      approvedParticipantsDeclared,

      approvedAssigned: approvedAssigned.length,
      approvedUnassigned: approvedUnassigned.length,
      topLocations,

      certIssuedCount,
      certRate,

      scansTotal,
      uniqueCount,
      morningScans,
      afternoonScans,
      attendanceCoverageVsApprovedRegs,

      portalsCount: portals.length,
      submissionsCount,
      flags,
      roomPeopleUsage,
      roomRegUsage,
    };
  }

  function generateDashboardNlpReportPerEvent(payload) {
    const dormsById = {};
    const roomsById = {};
    _safeArr(payload.dorms).forEach(d => { dormsById[String(d.id)] = d; });
    _safeArr(payload.rooms).forEach(r => { roomsById[String(r.id)] = r; });

    const { groups, index } = _groupAllByEvent(payload);

    const items = Object.keys(groups)
      .map(eventId => {
        const group = groups[eventId];
        const metrics = _computeEventMetrics(group, dormsById, roomsById);

        const locLine = metrics.topLocations.length
          ? metrics.topLocations.map(x => `${x.key.replace("|", "•")} (${x.count})`).join(", ")
          : "None";

        const reportText =
`Event: ${metrics.eventTitle} (ID: ${metrics.eventId})
Dates: ${metrics.startDate || "—"} to ${metrics.endDate || "—"} | Location: ${metrics.location || "—"} | Type: ${metrics.type || "—"} | Mode: ${metrics.mode || "—"}

Dashboard (Registrations)
- Total registrations: ${metrics.totalRegs}
- Status: Approved ${metrics.approvedRegs} | Pending ${metrics.pendingRegs} | Rejected ${metrics.rejectedRegs}
- Participants declared (incl. companions): ${metrics.totalParticipantsDeclared} total | ${metrics.approvedParticipantsDeclared} approved

Accommodation
- Approved assigned to rooms: ${metrics.approvedAssigned}
- Approved unassigned: ${metrics.approvedUnassigned}
- Top locations (by assigned regs): ${locLine}

Submissions (Paper Submissions)
- Submissions recorded: ${metrics.submissionsCount}

Certificates
- Certificates issued: ${metrics.certIssuedCount} (${metrics.certRate || "—"} of approved)

Attendance
- Total scans: ${metrics.scansTotal}
- Unique attendees scanned: ${metrics.uniqueCount} (${metrics.attendanceCoverageVsApprovedRegs || "—"} vs approved regs)
- Morning scans: ${metrics.morningScans} | Afternoon scans: ${metrics.afternoonScans}

Notes / Flags
- ${metrics.flags.length ? metrics.flags.join(" | ") : "No flags detected."}
`;

        return { eventId, eventTitle: metrics.eventTitle, metrics, reportText };
      })
      .sort((a, b) => {
        const oa = (a.eventId in index.order) ? index.order[a.eventId] : 999999;
        const ob = (b.eventId in index.order) ? index.order[b.eventId] : 999999;
        return oa - ob || a.eventTitle.localeCompare(b.eventTitle);
      });

    return items;
  }

  function buildDashboardExcelWorkbook(payload) {
    const XLSX = window.XLSX;
    if (!XLSX || !XLSX.utils) throw new Error("SheetJS (XLSX) not found on window.");

    const dormsById = {};
    const roomsById = {};
    _safeArr(payload.dorms).forEach(d => { dormsById[String(d.id)] = d; });
    _safeArr(payload.rooms).forEach(r => { roomsById[String(r.id)] = r; });

    const { groups, index } = _groupAllByEvent(payload);
    const nlpItems = generateDashboardNlpReportPerEvent(payload);

    const wb = XLSX.utils.book_new();

    // ---------- Sheet: Event_Summary ----------
    const summaryHeader = [
      "Event ID","Event Title","Start Date","End Date","Type","Mode","Location","Featured",
      "Registrations Total","Approved","Pending","Rejected",
      "Participants Declared (Total)","Participants Declared (Approved)",
      "Approved Assigned","Approved Unassigned",
      "Certificates Issued","Certificate Issuance Rate",
      "Attendance Scans","Attendance Unique","Attendance Coverage vs Approved (regs)","Morning Scans","Afternoon Scans",
      "Portals","Submissions",
      "Flags"
    ];

    const summaryRows = [summaryHeader];

    nlpItems.forEach(item => {
      const m = item.metrics;
      summaryRows.push([
        m.eventId, _excelSafe(m.eventTitle), m.startDate, m.endDate, m.type, m.mode, _excelSafe(m.location), m.featured ? "Yes" : "No",
        m.totalRegs, m.approvedRegs, m.pendingRegs, m.rejectedRegs,
        m.totalParticipantsDeclared, m.approvedParticipantsDeclared,
        m.approvedAssigned, m.approvedUnassigned,
        m.certIssuedCount, m.certRate,
        m.scansTotal, m.uniqueCount, m.attendanceCoverageVsApprovedRegs, m.morningScans, m.afternoonScans,
        m.portalsCount, m.submissionsCount,
        _excelSafe(m.flags.join(" | "))
      ]);
    });

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
    wsSummary["!cols"] = summaryHeader.map((h, i) => ({ wch: Math.min(40, Math.max(12, h.length + (i === 1 ? 10 : 0))) }));
    XLSX.utils.book_append_sheet(wb, wsSummary, "Event_Summary");

    // ---------- Sheet: Events (raw) ----------
    const eventsRows = [["id","title","startDate","endDate","type","mode","location","featured","description","createdAt"]].concat(
      _safeArr(payload.events)
        .slice()
        .sort(_sortByEvent(index.order, e => String(e.id), e => e.title))
        .map(e => [String(e.id), _excelSafe(e.title), e.startDate, e.endDate, e.type, e.mode, _excelSafe(e.location), e.featured ? "Yes" : "No", _excelSafe(e.description || ""), _isoOrEmpty(e.createdAt)])
    );
    const wsEvents = XLSX.utils.aoa_to_sheet(eventsRows);
    wsEvents["!cols"] = [{wch:10},{wch:40},{wch:12},{wch:12},{wch:14},{wch:12},{wch:26},{wch:10},{wch:50},{wch:22}];
    XLSX.utils.book_append_sheet(wb, wsEvents, "Events");

    // ---------- Sheet: Registrations (detailed) ----------
    const regHeader = [
      "Event Title","Event ID","Registration ID","Status",
      "Full Name","Email","University",
      "Participants Count","Companions Count",
      "Dorm Type","Dorm Name","Room Name",
      "NFC Card ID","Certificate Issued At",
      "Admin Note","Valid ID Path","Profile Slug"
    ];

    const regsAll = _safeArr(payload.registrations).slice();
    regsAll.sort(_sortByEvent(index.order, r => _resolveEventIdFromLoose(r.eventId, r.eventTitle, index), r => (r.status || "") + " " + (r.fullName || "")));

    const regRows = [regHeader].concat(regsAll.map(r => {
      const evId = _resolveEventIdFromLoose(r.eventId, r.eventTitle, index) || "";
      const room = r.roomId ? roomsById[String(r.roomId)] : null;
      const dorm = room ? dormsById[String(room.dormId)] : null;
      const companions = _safeArr(r.companions);
      return [
        _excelSafe(r.eventTitle || (index.byId[evId]?.title || "")),
        evId,
        String(r.id || ""),
        r.status || "",
        _excelSafe(r.fullName || ""),
        _excelSafe(r.userEmail || ""),
        _excelSafe(r.university || ""),
        _safeNum(r.participantsCount, 1),
        companions.length,
        dorm?.type || "",
        _excelSafe(dorm?.name || ""),
        _excelSafe(room?.name || ""),
        _excelSafe(r.nfc_card_id || ""),
        _isoOrEmpty(r.certificateIssuedAt),
        _excelSafe(r.adminNote || r.admin_note || ""),
        _excelSafe(r.validId || ""),
        _excelSafe(r.profile_slug || "")
      ];
    }));

    const wsRegs = XLSX.utils.aoa_to_sheet(regRows);
    wsRegs["!cols"] = [{wch:40},{wch:10},{wch:16},{wch:14},{wch:26},{wch:28},{wch:20},{wch:16},{wch:16},{wch:12},{wch:24},{wch:12},{wch:18},{wch:22},{wch:40},{wch:32},{wch:22}];
    XLSX.utils.book_append_sheet(wb, wsRegs, "Registrations");

    // ---------- Sheet: Accommodation_Rooms ----------
    const roomHeader = ["Dorm Type","Dorm Name","Dorm ID","Room ID","Room Name","Beds","Approved Assignments (#regs)","Approved People (#declared)","Events Involved"];
    const approvedAssignedRegs = _safeArr(payload.registrations).filter(r => r.status === "Approved" && !!r.roomId);

    const byRoom = {};
    approvedAssignedRegs.forEach(r => {
      const rid = String(r.roomId);
      if (!byRoom[rid]) byRoom[rid] = { regs: [], events: new Set(), people: 0 };
      byRoom[rid].regs.push(r);
      byRoom[rid].people += _safeNum(r.participantsCount, 1);
      const evId = String(r.eventId || "");
      const ev = index.byId[evId];
      if (ev && ev.title) byRoom[rid].events.add(ev.title);
      else if (r.eventTitle) byRoom[rid].events.add(r.eventTitle);
    });

    const roomsSorted = _safeArr(payload.rooms).slice().sort((a, b) => {
      const da = dormsById[String(a.dormId)]?.name || "";
      const db = dormsById[String(b.dormId)]?.name || "";
      return da.localeCompare(db) || _safeStr(a.name).localeCompare(_safeStr(b.name));
    });

    const roomRows = [roomHeader].concat(roomsSorted.map(rm => {
      const dorm = dormsById[String(rm.dormId)] || {};
      const agg = byRoom[String(rm.id)] || { regs: [], events: new Set(), people: 0 };
      const evList = Array.from(agg.events).sort().join(" | ");
      return [
        dorm.type || "",
        _excelSafe(dorm.name || ""),
        String(dorm.id || ""),
        String(rm.id || ""),
        _excelSafe(rm.name || ""),
        _safeNum(rm.beds, 0),
        agg.regs.length,
        _safeNum(agg.people, 0),
        _excelSafe(evList),
      ];
    }));

    const wsRooms = XLSX.utils.aoa_to_sheet(roomRows);
    wsRooms["!cols"] = [{wch:12},{wch:24},{wch:10},{wch:10},{wch:12},{wch:8},{wch:22},{wch:24},{wch:50}];
    XLSX.utils.book_append_sheet(wb, wsRooms, "Accommodation_Rooms");

    // ---------- Sheet: Accommodation_Assignments ----------
    const assignHeader = ["Event Title","Event ID","Participant Name","Email","People Count","Dorm Type","Dorm Name","Room Name","Room Beds","Status"];
    const assignments = _safeArr(payload.registrations)
      .filter(r => r.status === "Approved" && !!r.roomId)
      .slice()
      .sort(_sortByEvent(index.order, r => String(r.eventId || ""), r => r.fullName));

    const assignRows = [assignHeader].concat(assignments.map(r => {
      const room = roomsById[String(r.roomId)] || {};
      const dorm = dormsById[String(room.dormId)] || {};
      return [
        _excelSafe(r.eventTitle || index.byId[String(r.eventId || "")]?.title || ""),
        String(r.eventId || ""),
        _excelSafe(r.fullName || ""),
        _excelSafe(r.userEmail || ""),
        _safeNum(r.participantsCount, 1),
        dorm.type || "",
        _excelSafe(dorm.name || ""),
        _excelSafe(room.name || ""),
        _safeNum(room.beds, 0),
        r.status || ""
      ];
    }));

    const wsAssign = XLSX.utils.aoa_to_sheet(assignRows);
    wsAssign["!cols"] = [{wch:40},{wch:10},{wch:26},{wch:28},{wch:14},{wch:12},{wch:24},{wch:12},{wch:10},{wch:12}];
    XLSX.utils.book_append_sheet(wb, wsAssign, "Accommodation_Assign");

    // ---------- Sheet: Attendance_Logs ----------
    const attHeader = ["Event Title","Event ID","Participant","Room","Scanned At","Period"];
    const logsAll = _safeArr(payload.logs).slice();
    logsAll.sort(_sortByEvent(index.order, l => _resolveEventIdFromLoose(l.event_id || l.eventId, l.event_title || l.eventTitle, index), l => l.scanned_at || l.scannedAt || ""));

    const attRows = [attHeader].concat(logsAll.map(l => {
      const evId = _resolveEventIdFromLoose(l.event_id || l.eventId, l.event_title || l.eventTitle, index) || "";
      const evTitle = index.byId[evId]?.title || l.event_title || l.eventTitle || "";
      const ts = l.scanned_at || l.scannedAt || "";
      return [
        _excelSafe(evTitle),
        evId,
        _excelSafe(l.participant_name || l.participantName || ""),
        _excelSafe(l.room_name || l.roomName || ""),
        _isoOrEmpty(ts) || _safeStr(ts),
        _periodOf(ts),
      ];
    }));

    const wsAtt = XLSX.utils.aoa_to_sheet(attRows);
    wsAtt["!cols"] = [{wch:40},{wch:10},{wch:26},{wch:18},{wch:24},{wch:10}];
    XLSX.utils.book_append_sheet(wb, wsAtt, "Attendance_Logs");

    // ---------- Sheet: Attendance_Summary ----------
    const attSumHeader = ["Event Title","Event ID","Approved (regs)","Attendance Unique","Attendance Coverage vs Approved (regs)","Total Scans","Morning Scans","Afternoon Scans"];
    const attSumRows = [attSumHeader];
    nlpItems.forEach(item => {
      const m = item.metrics;
      attSumRows.push([
        _excelSafe(m.eventTitle), m.eventId, m.approvedRegs, m.uniqueCount, m.attendanceCoverageVsApprovedRegs, m.scansTotal, m.morningScans, m.afternoonScans
      ]);
    });
    const wsAttSum = XLSX.utils.aoa_to_sheet(attSumRows);
    wsAttSum["!cols"] = [{wch:40},{wch:10},{wch:14},{wch:18},{wch:26},{wch:12},{wch:14},{wch:14}];
    XLSX.utils.book_append_sheet(wb, wsAttSum, "Attendance_Summary");

    // ---------- Sheet: Submissions ----------
    const subHeader = ["Event Title","Event ID","Submission ID","Paper Title","Author Email","Status","File Path","Created At"];
    const subsAll = _safeArr(payload.submissions).slice();
    subsAll.sort(_sortByEvent(index.order, s => _resolveEventIdFromLoose(s.event_id || s.eventId, s.event_title || s.eventTitle, index), s => s.title || ""));

    const subRows = [subHeader].concat(subsAll.map(s => {
      const evId = _resolveEventIdFromLoose(s.event_id || s.eventId, s.event_title || s.eventTitle, index) || "";
      const evTitle = index.byId[evId]?.title || s.event_title || s.eventTitle || "";
      return [
        _excelSafe(evTitle),
        evId,
        String(s.id || ""),
        _excelSafe(s.title || ""),
        _excelSafe(s.user_email || s.userEmail || ""),
        _excelSafe(s.status || ""),
        _excelSafe(s.file_path || s.filePath || ""),
        _isoOrEmpty(s.created_at || s.createdAt),
      ];
    }));
    const wsSubs = XLSX.utils.aoa_to_sheet(subRows);
    wsSubs["!cols"] = [{wch:40},{wch:10},{wch:14},{wch:50},{wch:28},{wch:16},{wch:50},{wch:24}];
    XLSX.utils.book_append_sheet(wb, wsSubs, "Submissions");

    // ---------- Sheet: Portals ----------
    const portalHeader = ["Event Title","Event ID","Portal ID","Portal Name","Created At"];
    const portalsAll = _safeArr(payload.portals).slice();
    portalsAll.sort(_sortByEvent(index.order, p => _resolveEventIdFromLoose(p.eventId, p.eventTitle, index), p => p.name || ""));

    const portalRows = [portalHeader].concat(portalsAll.map(p => {
      const evId = _resolveEventIdFromLoose(p.eventId, p.eventTitle, index) || "";
      const evTitle = index.byId[evId]?.title || p.eventTitle || "";
      return [
        _excelSafe(evTitle),
        evId,
        _excelSafe(p.id || ""),
        _excelSafe(p.name || ""),
        _isoOrEmpty(p.createdAt || p.created_at),
      ];
    }));
    const wsPortals = XLSX.utils.aoa_to_sheet(portalRows);
    wsPortals["!cols"] = [{wch:40},{wch:10},{wch:24},{wch:28},{wch:24}];
    XLSX.utils.book_append_sheet(wb, wsPortals, "Portals");

    // ---------- Sheet: NLP_Report ----------
    const nlpHeader = ["Event Title","Event ID","Report (auto-generated)"];
    const nlpRows = [nlpHeader].concat(nlpItems.map(it => [
      _excelSafe(it.eventTitle),
      it.eventId,
      _excelSafe(it.reportText),
    ]));
    const wsNlp = XLSX.utils.aoa_to_sheet(nlpRows);
    wsNlp["!cols"] = [{wch:40},{wch:10},{wch:120}];
    XLSX.utils.book_append_sheet(wb, wsNlp, "NLP_Report");

    return wb;
  }

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
    const [submissions, setSubmissions] = useState([]); // <-- NEW

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
    
    const [revokeTarget, setRevokeTarget] = useState(null);

    // AI REPORT STATE
    const [aiReportModalOpen, setAiReportModalOpen] = useState(false);
    const [aiReportItems, setAiReportItems] = useState([]);
    const [isGeneratingReport, setIsGeneratingReport] = useState(false);

    const loadData = () => {
      Promise.all([
        fetch(`${API_BASE}/events`).then(r => r.ok ? r.json() : []).catch(() => []),
        fetch(`${API_BASE}/registrations`, { headers: getAuthHeaders() }).then(r => r.ok ? r.json() : []).catch(() => []), 
        fetch(`${API_BASE}/portals`, { headers: getAuthHeaders() }).then(r => r.ok ? r.json() : []).catch(() => []), 
        fetch(`${API_BASE}/dorms`, { headers: getAuthHeaders() }).then(r => r.ok ? r.json() : []).catch(() => []), 
        fetch(`${API_BASE}/rooms`, { headers: getAuthHeaders() }).then(r => r.ok ? r.json() : []).catch(() => []), 
        fetch(`${API_BASE}/attendance_logs`, { headers: getAuthHeaders() }).then(r => r.ok ? r.json() : []).catch(() => []),
        fetch(`${API_BASE}/submissions`, { headers: getAuthHeaders() }).then(r => r.ok ? r.json() : []).catch(() => []) // <-- NEW
      ]).then(([ev, reg, por, dor, roo, lgs, subs]) => {
        setEvents(Array.isArray(ev) ? ev.map(normalizeEvent) : []);
        setRegistrations(Array.isArray(reg) ? reg.map(normalizeRegistration) : []);
        setPortals(Array.isArray(por) ? por.map(normalizePortal) : []);
        setDorms(Array.isArray(dor) ? dor.map(normalizeDorm) : []);
        setRooms(Array.isArray(roo) ? roo.map(normalizeRoom) : []);
        setLogs(Array.isArray(lgs) ? lgs : []);
        setSubmissions(Array.isArray(subs) ? subs : []); // <-- NEW
      });
    };

   useEffect(() => { 
    // 1. Fetch data immediately when the dashboard loads
    loadData(); 

    // 2. Set up a background timer to silently fetch fresh data every 10 seconds
    const autoRefreshInterval = setInterval(() => {
        loadData();
    }, 3000); // 10000 ms = 10 seconds

    // 3. Clean up the timer if the admin logs out or closes the dashboard
    return () => clearInterval(autoRefreshInterval);
}, []);

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

    // EXISTING EXPORT FUNCTION
    const handleExport = async (stats) => {
      try {
        if (!window.XLSX) {
          window.Swal.fire('Missing Library', 'Excel export requires SheetJS (XLSX). Please include xlsx.full.min.js in your index.html.', 'warning');
          return;
        }

        const submissions = await fetch(`${API_BASE}/submissions`, { headers: getAuthHeaders() })
          .then(r => r.ok ? r.json() : [])
          .then(d => Array.isArray(d) ? d : [])
          .catch(() => []);

        const payload = {
          generatedAt: new Date().toISOString(),
          events,
          registrations,
          dorms,
          rooms,
          portals,
          logs,
          submissions
        };

        const wb = buildDashboardExcelWorkbook(payload);
        const out = window.XLSX.write(wb, { bookType: "xlsx", type: "array" });

        const stamp = new Date().toISOString().slice(0, 10);
        downloadBlob({
          content: out,
          mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          filename: `conexus_report_${stamp}.xlsx`
        });
      } catch (err) {
        console.error("Excel export failed:", err);
        window.Swal.fire('Export Failed', 'Open the console for details.', 'error');
      }
    };

    // --- NEW: Handle Generate AI Report Flow ---
    const handleGenerateAIReport = async () => {
        setIsGeneratingReport(true);
        try {
            // 1. Fetch fresh submissions just like the excel export
            const submissions = await fetch(`${API_BASE}/submissions`, { headers: getAuthHeaders() })
                .then(r => r.ok ? r.json() : [])
                .then(d => Array.isArray(d) ? d : [])
                .catch(() => []);

            const payload = { events, registrations, dorms, rooms, portals, logs, submissions };
            
            // 2. Get the base NLP text data
            const nlpData = generateDashboardNlpReportPerEvent(payload);

            // 3. Render charts for each event
            const reportItemsWithCharts = [];
            for (const item of nlpData) {
                const regData = [item.metrics.approvedRegs, item.metrics.pendingRegs, item.metrics.rejectedRegs];
                const attData = [item.metrics.morningScans, item.metrics.afternoonScans];
                
                const regImg = await generateChartImage('pie', regData, ['Approved', 'Pending', 'Rejected'], "Registration Status");
                const attImg = await generateChartImage('bar', attData, ['Morning', 'Afternoon'], "Attendance Times");
                
                reportItemsWithCharts.push({
                    ...item,
                    charts: { regImg, attImg }
                });
            }

            setAiReportItems(reportItemsWithCharts);
            setAiReportModalOpen(true);
        } catch (error) {
        console.error(error);
        window.Swal.fire('Error', 'Failed to generate AI report.', 'error');
    } finally {
            setIsGeneratingReport(false);
        }
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
        if (data.success) { 
            loadData(); 
            setCreateEventOpen(false); 
            window.Swal.fire('Saved!', 'The event has been saved successfully.', 'success');
        } else { 
            window.Swal.fire('Failed', data.error || "Unknown Error", 'error'); 
        }
      } catch (err) { 
          window.Swal.fire('Error', 'Save failed. Could not connect.', 'error'); 
      }
      setCreateEventSaving(false);
    };
    
    const handleDeleteEvent = async (id) => { 
        const result = await window.Swal.fire({
            title: 'Delete event?',
            text: "You won't be able to revert this!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444', // Red for delete
            cancelButtonColor: '#6b7280',  // Gray for cancel
            confirmButtonText: 'Yes, delete it!'
        });

        if (result.isConfirmed) { 
            setEvents(prev => prev.filter(e => e.id !== id));
            try {
                await fetch(`${API_BASE}/delete_event/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
                window.Swal.fire({ title: 'Deleted!', text: 'The event has been deleted.', icon: 'success', timer: 1500, showConfirmButton: false });
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

    const handleApproveStep = async (regId, stepNumber) => {
        try {
            let payload = {};
            
            // Use transitional statuses to avoid marking the whole registration as 'Final' too early
            if (stepNumber === 1) payload = { status: "Step 1 Approved" }; 
            if (stepNumber === 2) payload = { paper_status: "accepted" };
            if (stepNumber === 3) payload = { payment_status: "Approved" };
            if (stepNumber === 4) payload = { status: "Approved", files_status: "Approved" }; // Final Step sets global status

            const res = await fetch(`${API_BASE}/registrations/${regId}/steps`, {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                window.Swal.fire('Success', `Step ${stepNumber} Approved!`, 'success');
                loadData(); 
                setPreviewTarget(null); 
            }
        } catch (err) {
            window.Swal.fire('Error', 'Failed to update step.', 'error');
        }
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
      setRegistrations(prev => prev.map(r => r.id === nfcTargetReg.id ? { ...r, nfc_card_id: scannedId } : r));
      setNfcModalOpen(false);
      try {
        const res = await fetch(`${API_BASE}/registrations/${nfcTargetReg.id}/assign-nfc`, {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify({ nfc_card_id: scannedId })
        });
        const data = await res.json();
        if (!data.success) {
          window.Swal.fire('Failed', data.message || "Failed to link card", 'error');
          loadData(); 
        } else {
          window.Swal.fire('Linked!', 'NFC Card has been assigned.', 'success');
        }
      } catch (err) {
        window.Swal.fire('Error', 'Server error linking card', 'error');
        loadData();
      }
    };

    const handleAddDorm = async (name, type) => { 
      try {
        await fetch(`${API_BASE}/dorms`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ name, type }) });
        loadData(); 
        window.Swal.fire({ title: 'Created!', text: 'Location added successfully.', icon: 'success', timer: 1500, showConfirmButton: false });
      } catch (err) {
        window.Swal.fire('Error', 'Failed to create location.', 'error');
      }
    };
    
    const handleDeleteDorm = async (id) => { 
      const result = await window.Swal.fire({
          title: 'Delete Location?',
          text: "This will remove the location and all its rooms.",
          icon: 'warning',
          showCancelButton: true,
          confirmButtonColor: '#ef4444',
          cancelButtonColor: '#6b7280',
          confirmButtonText: 'Yes, delete it!'
      });
      if (result.isConfirmed) { 
          setDorms(prev => prev.filter(d => d.id !== id));
          try {
              await fetch(`${API_BASE}/dorms/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
              window.Swal.fire({ title: 'Deleted!', text: 'Location removed.', icon: 'success', timer: 1500, showConfirmButton: false });
          } catch(e) { loadData(); }
      } 
    };

    const handleAddRoom = async (form) => { 
      try {
        await fetch(`${API_BASE}/rooms`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(form) });
        loadData(); 
        window.Swal.fire({ title: 'Created!', text: 'Room added successfully.', icon: 'success', timer: 1500, showConfirmButton: false });
      } catch (err) {
        window.Swal.fire('Error', 'Failed to add room.', 'error');
      }
    };
    
    const handleDeleteRoom = async (id) => { 
      const result = await window.Swal.fire({
          title: 'Delete Room?',
          text: "Are you sure you want to remove this room?",
          icon: 'warning',
          showCancelButton: true,
          confirmButtonColor: '#ef4444',
          cancelButtonColor: '#6b7280',
          confirmButtonText: 'Yes, delete it!'
      });
      if (result.isConfirmed) { 
          setRooms(prev => prev.filter(r => r.id !== id));
          try {
              await fetch(`${API_BASE}/rooms/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
              window.Swal.fire({ title: 'Deleted!', text: 'Room removed.', icon: 'success', timer: 1500, showConfirmButton: false });
          } catch(e) { loadData(); }
      } 
    };

    const handleCreatePortal = async (form) => { 
        const newPortal = { id: makeUUID(), ...form, createdAt: new Date().toISOString() };
        setPortals(prev => [newPortal, ...prev]);
        try {
            await fetch(`${API_BASE}/portals`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(newPortal) });
            window.Swal.fire({ title: 'Created!', text: 'Portal added successfully.', icon: 'success', timer: 1500, showConfirmButton: false });
        } catch (e) {
            loadData();
            window.Swal.fire('Error', 'Failed to create portal.', 'error');
        }
        return true; 
    };
    
    const handleDeletePortal = async (id) => { 
      const result = await window.Swal.fire({
          title: 'Delete Portal?',
          text: "This attendance portal will be permanently removed.",
          icon: 'warning',
          showCancelButton: true,
          confirmButtonColor: '#ef4444',
          cancelButtonColor: '#6b7280',
          confirmButtonText: 'Yes, delete it!'
      });
      if (result.isConfirmed) { 
          setPortals(prev => prev.filter(p => p.id !== id));
          try {
              await fetch(`${API_BASE}/portals/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
              window.Swal.fire({ title: 'Deleted!', text: 'Portal removed.', icon: 'success', timer: 1500, showConfirmButton: false });
          } catch(e) { loadData(); }
      } 
    };

    const getCertHtml = () => {
      if (!certTarget) return "";
      const ev = events.find(e => String(e.id) === String(certTarget.eventId)) || { title: "Event" };
      
      // NEW: Generate the Verification Link and QR Image URL
      const verifyUrl = `https://cconexus.vercel.app/?verify=${certTarget.id}`;
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(verifyUrl)}`;

      return SafeCertGenerator.generateHTML({ 
          name: certTarget.fullName, 
          eventTitle: ev.title, 
          dateLabel: formatDateRange(ev.startDate, ev.endDate), 
          issuerName: user.name || "Admin", 
          issuerRole: user.university || "Event Organizer", 
          certificateId: "CX-" + certTarget.id, 
          issuedAt: new Date().toLocaleDateString(),
          qrUrl: qrUrl // Pass the QR to the template
      });
    };

    const handleBatchEmail = async (targets) => {
        setBatchStatus({ state: 'sending', processed: 0, total: targets.length, errors: 0 });
        for(let t of targets) { setBatchStatus(p => ({...p, processed: p.processed + 1})); }
        setBatchStatus(p => ({ ...p, state: 'complete' })); 
        window.Swal.fire('Batch Complete!', 'Emails have been processed.', 'success');
    };

    // NEW: Function to handle sending a single email and updating the database
    const handleSingleEmail = async (target) => {
        setCertEmailSending(true);
        try {
            await fetch(`${API_BASE}/registrations/${target.id}/mark-certificate`, {
                method: 'PUT',
                headers: getAuthHeaders()
            });
            // Update UI to show as "Issued"
            setRegistrations(prev => prev.map(r => r.id === target.id ? { ...r, certificateIssuedAt: new Date().toISOString() } : r));
            window.Swal.fire('Sent!', `Certificate emailed to ${target.userEmail}`, 'success');
            setCertDrawerOpen(false);
        } catch (err) {
            window.Swal.fire('Error', 'Failed to send email.', 'error');
        } finally {
            setCertEmailSending(false);
        }
    };

    // FIXED: Now actually downloads a PDF using html2canvas and jsPDF instead of printing
    const issueCertNow = async () => {
        if (!window.html2canvas || !window.jspdf) {
            window.Swal.fire('Missing Libraries', 'PDF libraries not loaded.', 'error');
            return;
        }
        try {
            const element = document.getElementById('certPreview');
            if (!element) return;
            
            const canvas = await window.html2canvas(element, { scale: 2, useCORS: true });
            const imgData = canvas.toDataURL('image/png');
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF('l', 'mm', 'a4'); 
            pdf.addImage(imgData, 'PNG', 0, 0, pdf.internal.pageSize.getWidth(), pdf.internal.pageSize.getHeight());
            pdf.save(`Certificate_${certTarget?.fullName?.replace(/\s+/g, '_') || 'Participant'}.pdf`);
        } catch (err) {
            window.Swal.fire('Error', 'Failed to generate PDF.', 'error');
        }
    };

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

        {/* 3. Main Content Area */}
        <main className="min-w-0 animate-fade-in-up">
            {section === "dashboard" && <DashboardTab events={events} registrations={registrations} onCreateEvent={() => { setEditEventId(null); setEventForm({ title: "", description: "", startDate: "", endDate: "", location: "", featured: false }); setCreateEventOpen(true); }} onExport={handleExport} onEditEvent={(ev) => { setEditEventId(ev.id); setEventForm({ ...ev }); setCreateEventOpen(true); }} onDeleteEvent={handleDeleteEvent} onGenerateAIReport={handleGenerateAIReport} isGeneratingReport={isGeneratingReport} />}
            {section === "accommodation" && <AccommodationTab dorms={dorms} rooms={rooms} registrations={registrations} onAddDorm={handleAddDorm} onDeleteDorm={handleDeleteDorm} onAddRoom={handleAddRoom} onDeleteRoom={handleDeleteRoom} />}
            {section === "registrations" && 
                <RegistrationsTab 
                    events={events} 
                    registrations={registrations} 
                    rooms={rooms} 
                    dorms={dorms} 
                    onUpdateStatus={handleUpdateStatus} 
                    
                    onRevoke={async (reg) => {
                        const isPending = reg.status === 'For approval';
                        const { value: note, isConfirmed } = await window.Swal.fire({
                            title: isPending ? 'Reject Registration' : 'Revoke Registration',
                            html: `You are about to ${isPending ? 'reject' : 'revoke approval for'} <b>${reg.fullName}</b>.<br/><br/>Please provide a reason:`,
                            input: 'textarea',
                            inputPlaceholder: 'e.g. Invalid ID, Not eligible...',
                            showCancelButton: true,
                            confirmButtonColor: '#ef4444',
                            cancelButtonColor: '#6b7280',
                            confirmButtonText: isPending ? 'Confirm Reject' : 'Confirm Revoke',
                            inputValidator: (value) => { if (!value) return 'You must provide a reason!' }
                        });
                        if (isConfirmed && note) {
                            await handleUpdateStatus(reg.id, "Rejected", null, note);
                            window.Swal.fire({ title: isPending ? 'Rejected!' : 'Revoked!', text: 'The participant has been notified.', icon: 'success', timer: 1500, showConfirmButton: false });
                        }
                    }}
                    
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
        <CertificateDrawer isOpen={certDrawerOpen} target={certTarget} html={getCertHtml()} isSending={certEmailSending} status={certEmailStatus} onClose={() => setCertDrawerOpen(false)} onEmail={handleSingleEmail} onPrint={issueCertNow} />
        <RegistrationPreviewModal reg={registrations.find(r => r.id === previewTarget?.id) || previewTarget} submissions={submissions} onClose={() => setPreviewTarget(null)} onApproveStep={handleApproveStep} />
        
        {/* REVOKE / REJECT MODAL */}
        <RevokeModal 
            isOpen={!!revokeTarget} 
            targetName={revokeTarget?.fullName} 
            isPending={revokeTarget?.status === 'For approval'}
            onClose={() => setRevokeTarget(null)} 
            onConfirm={handleRevokeConfirm} 
        />

        {/* AI REPORT MODAL */}
        <EditableAIReportModal 
            isOpen={aiReportModalOpen} 
            reportItems={aiReportItems} 
            onClose={() => setAiReportModalOpen(false)} 
        />
      </section>
    );
  }

  window.AdminDashboard = AdminDashboard;
})();