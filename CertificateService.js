// js/CertificateService.js
// Certificate helper utilities (UI + PDF generation) for AdminDashboard.
// Exposes: window.CertificateService
(function () {
  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function stripHtml(html) {
    if (!html) return "";
    return String(html)
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/h[1-6]>/gi, "\n\n")
      .replace(/<\/div>/gi, "\n")
      .replace(/<\/li>/gi, "\n")
      .replace(/<li>/gi, "• ")
      .replace(/<[^>]+>/g, " ")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim();
  }

  function compileTemplate(templateHtml, data) {
    const d = data || {};
    const map = {
      "{{name}}": d.name || "",
      "{{email}}": d.email || "",
      "{{event}}": d.eventTitle || "",
      "{{event_title}}": d.eventTitle || "",
      "{{date}}": d.dateLabel || "",
      "{{issued_at}}": d.issuedAt || "",
      "{{issuer_name}}": d.issuerName || "",
      "{{issuer_role}}": d.issuerRole || "",
      "{{certificate_id}}": d.certificateId || "",
    };

    let out = String(templateHtml || "");
    Object.keys(map).forEach((k) => {
      out = out.split(k).join(map[k]);
    });

    return out;
  }

  function defaultTemplateHtml() {
    // Editable HTML template with placeholders.
    // Keep it safe/basic. Admin can customize in UI.
    return `
<div style="font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial; padding: 24px;">
  <div style="border: 2px solid #111827; border-radius: 18px; padding: 28px;">
    <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:16px;">
      <div>
        <div style="font-size: 12px; letter-spacing: .18em; text-transform: uppercase; color:#6b7280;">Certificate</div>
        <div style="font-size: 28px; font-weight: 800; color:#111827; margin-top: 6px;">Certificate of Participation</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size: 12px; color:#6b7280;">Issued at</div>
        <div style="font-size: 12px; font-weight: 600; color:#111827;">{{issued_at}}</div>
      </div>
    </div>

    <div style="margin-top: 22px; font-size: 14px; color:#111827; line-height: 1.65;">
      This certifies that
    </div>
    <div style="margin-top: 10px; font-size: 22px; font-weight: 800; color:#111827;">
      {{name}}
    </div>
    <div style="margin-top: 10px; font-size: 14px; color:#111827; line-height: 1.65;">
      has successfully participated in the event
    </div>
    <div style="margin-top: 8px; font-size: 16px; font-weight: 700; color:#111827;">
      {{event}}
    </div>
    <div style="margin-top: 6px; font-size: 12px; color:#6b7280;">
      {{date}}
    </div>

    <div style="display:flex; justify-content:space-between; margin-top: 26px; gap:18px;">
      <div style="flex:1;">
        <div style="height: 1px; background:#d1d5db; margin-bottom: 8px;"></div>
        <div style="font-size: 12px; font-weight: 700; color:#111827;">{{issuer_name}}</div>
        <div style="font-size: 11px; color:#6b7280;">{{issuer_role}}</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size: 10px; color:#9ca3af;">Certificate ID</div>
        <div style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; font-size: 10px; color:#111827;">{{certificate_id}}</div>
      </div>
    </div>
  </div>
</div>
`.trim();
  }

  function getJsPDF() {
    // jsPDF may be exposed as window.jspdf.jsPDF (common) or window.jsPDF.
    try {
      if (window.jspdf && window.jspdf.jsPDF) return window.jspdf.jsPDF;
      if (window.jsPDF) return window.jsPDF;
    } catch (e) {}
    return null;
  }

  function makeCertificateId() {
    const rand =
      (window.crypto && window.crypto.getRandomValues
        ? Array.from(window.crypto.getRandomValues(new Uint8Array(6)))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("")
        : Math.random().toString(16).slice(2, 14));
    return `CX-${Date.now().toString(36).toUpperCase()}-${rand.toUpperCase()}`;
  }

  function buildIssuedAtLabel() {
    try {
      return new Date().toLocaleString();
    } catch {
      return String(new Date());
    }
  }

  function downloadCertificatePDF(options) {
    const opts = options || {};
    const JsPDF = getJsPDF();
    if (!JsPDF) {
      throw new Error(
        "jsPDF not found. Please load jsPDF before using CertificateService.downloadCertificatePDF()."
      );
    }

    const {
      templateHtml,
      data,
      fileName = "certificate.pdf",
      meta = {},
    } = opts;

    const compiledHtml = compileTemplate(templateHtml, data);
    const plain = stripHtml(compiledHtml);

    // Reliable: generate simple PDF with text (works without html2canvas)
    const doc = new JsPDF({
      orientation: "landscape",
      unit: "pt",
      format: "a4",
    });

    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();

    // Frame
    doc.setLineWidth(2);
    doc.rect(30, 30, pageW - 60, pageH - 60, "S");

    // Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(28);
    doc.text("Certificate", pageW / 2, 95, { align: "center" });

    doc.setFontSize(16);
    doc.setFont("helvetica", "normal");
    doc.text("of Participation", pageW / 2, 125, { align: "center" });

    // Body
    doc.setFontSize(12);
    doc.setTextColor(60);

    const lines = doc.splitTextToSize(plain, pageW - 140);
    doc.text(lines, 70, 170);

    // Footer meta
    doc.setTextColor(100);
    doc.setFontSize(10);

    const issuedAt = (data && data.issuedAt) || buildIssuedAtLabel();
    const cid = (data && data.certificateId) || makeCertificateId();

    doc.text(`Issued at: ${issuedAt}`, 70, pageH - 75);
    doc.text(`Certificate ID: ${cid}`, pageW - 70, pageH - 75, { align: "right" });

    if (meta && meta.brand) {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(20);
      doc.text(String(meta.brand), pageW - 70, 60, { align: "right" });
    }

    doc.save(fileName);
    return { certificateId: cid, issuedAt };
  }

  // New helper: return PDF as a Blob instead of saving immediately
  function downloadCertificatePDFBlob(options) {
    const opts = options || {};
    const JsPDF = getJsPDF();
    if (!JsPDF) {
      throw new Error(
        "jsPDF not found. Please load jsPDF before using CertificateService.downloadCertificatePDFBlob()."
      );
    }

    const {
      templateHtml,
      data,
      fileName = "certificate.pdf",
      meta = {},
    } = opts;

    const compiledHtml = compileTemplate(templateHtml, data);
    const plain = stripHtml(compiledHtml);

    // Create PDF like downloadCertificatePDF but return blob
    const doc = new JsPDF({
      orientation: "landscape",
      unit: "pt",
      format: "a4",
    });

    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();

    // Frame
    doc.setLineWidth(2);
    doc.rect(30, 30, pageW - 60, pageH - 60, "S");

    // Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(28);
    doc.text("Certificate", pageW / 2, 95, { align: "center" });

    doc.setFontSize(16);
    doc.setFont("helvetica", "normal");
    doc.text("of Participation", pageW / 2, 125, { align: "center" });

    // Body
    doc.setFontSize(12);
    doc.setTextColor(60);

    const lines = doc.splitTextToSize(plain, pageW - 140);
    doc.text(lines, 70, 170);

    // Footer meta
    doc.setTextColor(100);
    doc.setFontSize(10);

    const issuedAt = (data && data.issuedAt) || buildIssuedAtLabel();
    const cid = (data && data.certificateId) || makeCertificateId();

    doc.text(`Issued at: ${issuedAt}`, 70, pageH - 75);
    doc.text(`Certificate ID: ${cid}`, pageW - 70, pageH - 75, { align: "right" });

    if (meta && meta.brand) {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(20);
      doc.text(String(meta.brand), pageW - 70, 60, { align: "right" });
    }

    // Prefer blob output; fallback to arraybuffer
    const blob = typeof doc.output === 'function' ? doc.output('blob') : new Blob([doc.output('arraybuffer')], { type: 'application/pdf' });

    return { certificateId: cid, issuedAt, blob, fileName };
  }

  function previewHtml(templateHtml, data) {
    const compiled = compileTemplate(templateHtml, data);
    // We allow admin-provided HTML; render inside a container.
    // No script/style execution here (still could include inline styles; OK).
    return compiled;
  }

  // New function to handle the Visual Designer logic
  function generateVisualPDF({ recipientName, templateDataUrl, yPos, fontSize }) {
    const JsPDF = getJsPDF();
    if (!JsPDF) {
      alert("jsPDF not found. Please ensure it is loaded.");
      return;
    }

    // Create a landscape PDF
    const doc = new JsPDF({
      orientation: "landscape",
      unit: "px", // Use pixels to match the web designer's feel
      format: "a4"
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // 1. Add the Background Image (the template)
    // We stretch the image to fit the full A4 page
    try {
      // Detect mime type from dataURL (e.g. data:image/png;base64,...) and pick format for jsPDF
      const m = String(templateDataUrl).match(/^data:(image\/[a-z0-9.+-]+);base64,/i);
      let imgFormat = 'PNG';
      if (m && m[1]) {
        const mime = m[1].toLowerCase();
        if (mime === 'image/jpeg' || mime === 'image/jpg') imgFormat = 'JPEG';
        else if (mime === 'image/png') imgFormat = 'PNG';
        else if (mime === 'image/webp') imgFormat = 'WEBP';
        else imgFormat = mime.split('/')[1].toUpperCase();
      }
      doc.addImage(templateDataUrl, imgFormat, 0, 0, pageWidth, pageHeight);
    } catch (err) {
      // try fallback without explicit format
      try { doc.addImage(templateDataUrl, 0, 0, pageWidth, pageHeight); } catch (e) { console.warn('addImage fallback failed', e); }
    }

    // 2. Add the Recipient Name
    doc.setFont("helvetica", "bold");
    doc.setFontSize(fontSize);
    doc.setTextColor(0, 0, 0); // Black text

    // Calculate position
    // yPos is a percentage (0-100) from the designer
    const finalY = (yPos / 100) * pageHeight;

    // Center the text horizontally
    doc.text(recipientName, pageWidth / 2, finalY, { align: "center" });

    // 3. Save the file
    doc.save(`Certificate_${recipientName.replace(/\s+/g, '_')}.pdf`);
  }

  // Return visual PDF as a blob (do not auto-download)
  function generateVisualPDFBlob({ recipientName, templateDataUrl, yPos = 50, fontSize = 32, fileName = 'certificate.pdf' }) {
    const JsPDF = getJsPDF();
    if (!JsPDF) {
      throw new Error('jsPDF not found. Please ensure it is loaded.');
    }

    const doc = new JsPDF({ orientation: 'landscape', unit: 'px', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    try {
      const m = String(templateDataUrl).match(/^data:(image\/[a-z0-9.+-]+);base64,/i);
      let imgFormat = 'PNG';
      if (m && m[1]) {
        const mime = m[1].toLowerCase();
        if (mime === 'image/jpeg' || mime === 'image/jpg') imgFormat = 'JPEG';
        else if (mime === 'image/png') imgFormat = 'PNG';
        else if (mime === 'image/webp') imgFormat = 'WEBP';
        else imgFormat = mime.split('/')[1].toUpperCase();
      }
      doc.addImage(templateDataUrl, imgFormat, 0, 0, pageWidth, pageHeight);
    } catch (err) {
      try { doc.addImage(templateDataUrl, 0, 0, pageWidth, pageHeight); } catch (e) { console.warn('addImage fallback failed', e); }
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(Number(fontSize) || 32);
    doc.setTextColor(0, 0, 0);

    const finalY = (Number(yPos) / 100) * pageHeight;
    doc.text(recipientName, pageWidth / 2, finalY, { align: 'center' });

    const certificateId = makeCertificateId();
    const issuedAt = buildIssuedAtLabel();

    const blob = typeof doc.output === 'function' ? doc.output('blob') : new Blob([doc.output('arraybuffer')], { type: 'application/pdf' });

    return { certificateId, issuedAt, blob, fileName };
  }

  // Backend Integration Functions for Batch Certificate Generation & Email
  
  /**
   * Send certificates to batch of participants via backend service
   * @param {Array} participants - Array of {name, role, email, eventTitle}
   * @param {String} serverUrl - Backend server URL (e.g., "http://localhost:3000")
   * @returns {Promise}
   */
  async function sendBatchCertificates(participants, serverUrl = "http://localhost:3000") {
    try {
      if (!participants || participants.length === 0) {
        throw new Error("No participants provided");
      }

      const response = await fetch(`${serverUrl}/send-certificates`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          eventTitle: participants[0].eventTitle || "Event Certificate",
          participants: participants
        })
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const result = await response.json();
      return {
        success: true,
        message: result.message || `Certificates sent to ${participants.length} participants`,
        count: result.count || participants.length
      };
    } catch (error) {
      console.error("Batch certificate error:", error);
      return {
        success: false,
        message: "Failed to send batch certificates",
        error: error.message
      };
    }
  }

  /**
   * Send certificate to single participant via backend service
   * @param {Object} participant - {name, email, role, eventTitle}
   * @param {String} serverUrl - Backend server URL
   * @returns {Promise}
   */
  async function sendCertificate(participant, serverUrl = "http://localhost:3000") {
    try {
      if (!participant.name || !participant.email) {
        throw new Error("Missing required fields: name, email");
      }

      const response = await fetch(`${serverUrl}/send-certificate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: participant.name,
          email: participant.email,
          role: participant.role || "Participant",
          eventTitle: participant.eventTitle || "Event"
        })
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const result = await response.json();
      return {
        success: true,
        message: result.message || `Certificate sent to ${participant.email}`
      };
    } catch (error) {
      console.error("Certificate sending error:", error);
      return {
        success: false,
        message: "Failed to send certificate",
        error: error.message
      };
    }
  }

  /**
   * Generate PDF certificate with template
   * @param {Object} data - {name, role, eventTitle, date}
   * @param {String} templateHtml - Optional custom HTML template
   * @returns {Object} - {certificateId, issuedAt}
   */
  function generatePDFCertificate(data, templateHtml) {
    const template = templateHtml || defaultTemplateHtml();
    const certData = {
      name: data.name || "Recipient",
      email: data.email || "",
      eventTitle: data.eventTitle || "Event",
      dateLabel: data.dateLabel || new Date().toLocaleDateString(),
      issuedAt: buildIssuedAtLabel(),
      certificateId: makeCertificateId(),
      issuerName: data.issuerName || "Event Organizer",
      issuerRole: data.issuerRole || "Administrator"
    };

    return downloadCertificatePDF({
      templateHtml: template,
      data: certData,
      fileName: `Certificate_${data.name.replace(/\s+/g, '_')}.pdf`,
      meta: { brand: data.brand || "" }
    });
  }

  /**
   * Check backend service health
   * @param {String} serverUrl - Backend server URL
   * @returns {Promise<Boolean>}
   */
  async function checkServiceHealth(serverUrl = "http://localhost:3000") {
    try {
      const response = await fetch(`${serverUrl}/health`);
      return response.ok;
    } catch (error) {
      console.error("Service health check failed:", error);
      return false;
    }
  }

  window.CertificateService = {
    compileTemplate,
    defaultTemplateHtml,
    previewHtml,
    downloadCertificatePDF,
    downloadCertificatePDFBlob,
    generateVisualPDF,
    generateVisualPDFBlob,
    generatePDFCertificate,
    makeCertificateId,
    buildIssuedAtLabel,
    stripHtml,
    escapeHtml,
    sendBatchCertificates,
    sendCertificate,
    checkServiceHealth,
  }; 
})();
