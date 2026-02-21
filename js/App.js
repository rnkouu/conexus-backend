const { useState, useEffect, useRef } = React;

/* =========================
   UNIVERSITY THEME (Dark Blue / Light Blue / Gold / White)
   - Design only (logic unchanged)
   ========================= */
const GLOBAL_STYLES = `
  :root{
    --u-navy:#061f38;
    --u-navy-2:#0b2b52;
    --u-blue:#1e5aa8;
    --u-sky:#e8f1ff;
    --u-gold:#f5c518;
    --u-white:#ffffff;
    --u-ink:#0b1220;
    --u-muted:rgba(6,31,56,.68);
    --u-border:rgba(6,31,56,.10);
    --u-shadow:0 10px 30px rgba(6,31,56,.14);
    --u-shadow-2:0 18px 60px rgba(6,31,56,.18);
  }

  /* Base page */
  .bg-page{
    background:
      radial-gradient(900px 420px at 18% 8%, rgba(30,90,168,.10), transparent 60%),
      radial-gradient(900px 420px at 82% 0%, rgba(245,197,24,.10), transparent 60%),
      linear-gradient(180deg, #f7f9fd 0%, #f5f8ff 60%, #f7f9fd 100%);
  }
  .text-brand{ color: var(--u-navy); }
  .text-accent1{ color: var(--u-blue); }
  .text-accent2{ color: var(--u-gold); }
  .text-accent3{ color: #2a8cff; }

  /* Institutional surface */
  .u-card{
    background: var(--u-white);
    border: 1px solid var(--u-border);
    box-shadow: var(--u-shadow);
  }
  .u-card:hover{ box-shadow: var(--u-shadow-2); }
  .u-soft{
    background: linear-gradient(180deg, #ffffff 0%, #f3f7ff 100%);
    border: 1px solid rgba(30,90,168,.10);
  }

  /* Buttons (reuse existing .grad-btn hook) */
  .grad-btn{
    background: linear-gradient(135deg, var(--u-blue) 0%, var(--u-navy) 70%);
    border: 1px solid rgba(245,197,24,.35);
    box-shadow: 0 10px 20px rgba(6,31,56,.18);
  }
  .grad-btn:hover{
    transform: translateY(-1px);
    box-shadow: 0 14px 28px rgba(6,31,56,.22);
    border-color: rgba(245,197,24,.55);
    filter: brightness(1.02);
  }
  .u-btn-gold{
    background: var(--u-gold);
    color: var(--u-navy);
    border: 1px solid rgba(6,31,56,.12);
    box-shadow: 0 10px 18px rgba(6,31,56,.16);
  }
  .u-btn-gold:hover{ filter: brightness(.98); transform: translateY(-1px); }
  .u-btn-outline{
    border: 1px solid rgba(255,255,255,.24);
    background: rgba(255,255,255,.06);
    color: rgba(255,255,255,.92);
  }
  .u-btn-outline:hover{
    border-color: rgba(245,197,24,.55);
    background: rgba(255,255,255,.10);
    color: #fff;
  }

  /* Hero (academic portal) */
  .u-hero{
    background:
      radial-gradient(1100px 700px at 10% 20%, rgba(30,90,168,.22), transparent 60%),
      radial-gradient(900px 600px at 90% 20%, rgba(245,197,24,.14), transparent 58%),
      linear-gradient(180deg, var(--u-navy) 0%, #061a31 70%, #061a31 100%);
    color: white;
  }
  .u-hero-grid{
    background-image: radial-gradient(rgba(255,255,255,.10) 1px, transparent 1px);
    background-size: 18px 18px;
    opacity: .50;
  }
  .u-hero-badge{
    background: var(--u-gold);
    color: var(--u-navy);
    letter-spacing: .14em;
  }
  .u-hero-input{
    background: rgba(255,255,255,.06);
    border: 1px solid rgba(255,255,255,.18);
  }
  .u-hero-input:focus-within{
    border-color: rgba(245,197,24,.60);
    box-shadow: 0 0 0 4px rgba(245,197,24,.14);
  }

  /* Navigation (university header) */
  .u-nav{
    background: rgba(6,31,56,.72);
    border-bottom: 1px solid rgba(255,255,255,.10);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
  }
  .u-nav-solid{
    background: rgba(6,31,56,.95);
  }
  .u-nav-link{
    color: rgba(255,255,255,.86);
    position: relative;
  }
  .u-nav-link:after{
    content:"";
    position:absolute;
    left:0;
    bottom:-8px;
    height:2px;
    width:0;
    background: var(--u-gold);
    transition: width .24s ease;
  }
  .u-nav-link:hover{ color: #fff; }
  .u-nav-link:hover:after{ width: 100%; }
  .u-nav-brand{
    color: #fff;
    letter-spacing: .02em;
  }
  .u-nav-brand-mark{
    width: 10px; height: 10px;
    background: var(--u-gold);
    border-radius: 2px;
    box-shadow: 0 0 0 3px rgba(245,197,24,.14);
  }

  /* Breadcrumbs */
  .u-breadcrumbs{
    color: rgba(6,31,56,.62);
  }
  .u-breadcrumbs button{ color: var(--u-blue); }
  .u-breadcrumbs button:hover{ text-decoration: underline; }

  /* Sections */
  .section-wash{
    background: linear-gradient(180deg, rgba(30,90,168,.06) 0%, rgba(245,197,24,.04) 50%, rgba(255,255,255,.00) 100%);
  }

  /* Hover card polish */
  .hover-card{ transition: transform .25s ease, box-shadow .25s ease, border-color .25s ease; }
  .hover-card:hover{ transform: translateY(-4px); border-color: rgba(30,90,168,.22); }

  /* Accordion / Tabs / Carousel base styling */
  .u-accordion{
    background: #fff;
    border: 1px solid rgba(6,31,56,.10);
    box-shadow: 0 10px 24px rgba(6,31,56,.08);
  }
  .u-tabs-wrap{
    border: 1px solid rgba(6,31,56,.10);
    background: #fff;
  }
  .u-tab{
    color: rgba(6,31,56,.70);
    border-bottom: 2px solid transparent;
  }
  .u-tab:hover{ color: var(--u-navy); }
  .u-tab-active{
    color: var(--u-navy);
    border-bottom-color: var(--u-gold);
    font-weight: 800;
  }
  .u-carousel-frame{
    box-shadow: 0 22px 70px rgba(0,0,0,.28);
    border: 1px solid rgba(245,197,24,.25);
  }

  /* Micro-animations */
  @keyframes fadeInUp {
    0% { opacity: 0; transform: translateY(15px) scale(0.98); }
    100% { opacity: 1; transform: translateY(0) scale(1); }
  }
  .animate-fade-in-up{ animation: fadeInUp .6s cubic-bezier(.16,1,.3,1) forwards; }

  @keyframes sweep {
    0% { transform: translateX(-40%); opacity: 0; }
    20% { opacity: .45; }
    100% { transform: translateX(140%); opacity: 0; }
  }
  .u-sweep:before{
    content:"";
    position:absolute;
    inset:0;
    background: linear-gradient(90deg, transparent, rgba(245,197,24,.18), transparent);
    transform: translateX(-40%);
    opacity:0;
  }
  .u-sweep:hover:before{
    animation: sweep 1.1s ease;
  }

  @keyframes pulseGlow {
    0%,100% { box-shadow: 0 0 0 0 rgba(245,197,24,.0); }
    50% { box-shadow: 0 0 0 8px rgba(245,197,24,.10); }
  }
  .u-pulse{ animation: pulseGlow 3.2s ease-in-out infinite; }

  /* Glass panel */
  .glass-panel{
    background: rgba(255, 255, 255, 0.92);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
  }

  .floating-orb{ opacity: .08; filter: blur(26px); }
`;

/* Inject styles once */
(function injectUniversityStylesOnce() {
  try {
    const ID = "conexus-university-theme";
    if (document.getElementById(ID)) return;
    const style = document.createElement("style");
    style.id = ID;
    style.textContent = GLOBAL_STYLES;
    document.head.appendChild(style);
  } catch (e) {
    console.error("Failed to inject GLOBAL_STYLES", e);
  }
})();

// === API BASE URL ===
const API_BASE_URL = "https://conexus-backend-production.up.railway.app/api";

function Breadcrumbs({ items = [] }) {
  return (
    <nav className="u-breadcrumbs text-xs md:text-sm mb-6 flex flex-wrap items-center gap-2" aria-label="Breadcrumb">
      {items.map((it, idx) => {
        const isLast = idx === items.length - 1;
        return (
          <React.Fragment key={idx}>
            {it.onClick && !isLast ? (
              <button type="button" className="font-semibold" onClick={it.onClick}>
                {it.label}
              </button>
            ) : (
              <span className={isLast ? "text-brand font-semibold" : "text-gray-500"}>{it.label}</span>
            )}
            {!isLast ? <span className="text-gray-400">/</span> : null}
          </React.Fragment>
        );
      })}
    </nav>
  );
}

function AccordionItem({ question, answer }) {
  const [open, setOpen] = useState(false);
  const innerRef = useRef(null);
  const [maxH, setMaxH] = useState("0px");

  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    if (open) {
      setMaxH(el.scrollHeight + "px");
      const t = setTimeout(() => setMaxH("999px"), 260);
      return () => clearTimeout(t);
    } else {
      setMaxH(el.scrollHeight + "px");
      requestAnimationFrame(() => setMaxH("0px"));
    }
  }, [open]);

  return (
    <div className="reveal break-inside-avoid p-6 rounded-2xl u-accordion hover-card">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full text-left flex items-start justify-between gap-3 group"
      >
        <span className="font-extrabold text-sm md:text-base text-brand group-hover:text-accent1 transition-colors">
          {question}
        </span>
        <svg
          className={"mt-1 shrink-0 transition-all duration-300 " + (open ? "rotate-180 text-accent2" : "text-gray-400")}
          width="20"
          height="20"
          viewBox="0 0 24 24"
        >
          <path fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" d="M6 9l6 6 6-6" />
        </svg>
      </button>
      <div
        style={{ maxHeight: maxH }}
        className={"overflow-hidden transition-all duration-300 ease-out " + (open ? "opacity-100" : "opacity-0")}
      >
        <div ref={innerRef} className="pt-3 text-[13px] md:text-sm text-gray-600 leading-relaxed">
          {answer}
        </div>
      </div>
    </div>
  );
}

function FaqItem({ question, answer }) {
  return <AccordionItem question={question} answer={answer} />;
}

function SimpleCarousel({ count, index, onPrev, onNext, onSelect, children }) {
  return (
    <div className="relative">
      {children}
      {count > 1 ? (
        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button type="button" onClick={onPrev} className="h-9 w-9 rounded-full border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition" aria-label="Previous">←</button>
            <button type="button" onClick={onNext} className="h-9 w-9 rounded-full border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition" aria-label="Next">→</button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 font-semibold">{index + 1} / {count}</span>
            <div className="flex gap-1.5">
              {Array.from({ length: count }).map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => onSelect(i)}
                  className={"h-2 rounded-full transition-all duration-300 " + (i === index ? "w-7 bg-[var(--u-gold)]" : "w-2 bg-gray-300 hover:bg-gray-400")}
                  aria-label={`Go to ${i + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* =========================
   LEGACY REGISTRATION MODAL (For non-participant flows)
   - Kept for backward compatibility, but safer now.
   ========================= */
function RegistrationModal({ event, onClose, onConfirm }) {
  const [companions, setCompanions] = useState([]);

  if (!event) return null; // Safety check for white screen issue

  const addCompanion = () => {
    setCompanions([...companions, { name: "", relation: "", phone: "", email: "" }]);
  };

  const removeCompanion = (index) => {
    setCompanions(companions.filter((_, i) => i !== index));
  };

  const updateComp = (index, field, value) => {
    const updated = companions.map((c, i) => (i === index ? { ...c, [field]: value } : c));
    setCompanions(updated);
  };

  const handleConfirm = () => {
    for (let i = 0; i < companions.length; i++) {
      if (!companions[i].name.trim()) {
        alert(`Please enter a name for companion #${i + 1}`);
        return;
      }
    }
    onConfirm(companions);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/65 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-xl animate-fade-in-up my-auto">
        <div className="rounded-3xl overflow-hidden u-card">
          <div className="px-8 py-6 bg-[var(--u-navy)] text-white relative">
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-[var(--u-gold)]" />
            <h3 className="text-xl md:text-2xl font-extrabold">Event Registration</h3>
            <p className="text-xs md:text-sm text-white/75 mt-1">
              Registering for: <strong className="text-[var(--u-gold)]">{event.title}</strong>
            </p>
          </div>

          <div className="p-8">
            <div className="flex justify-between items-center mb-4">
              <p className="text-[11px] font-black uppercase tracking-widest text-gray-500">Associates / Companions</p>
              <button onClick={addCompanion} className="px-3 py-1.5 rounded-lg text-xs font-extrabold u-btn-gold transition u-sweep relative overflow-hidden">
                + Add Person
              </button>
            </div>

            <div className="space-y-4 max-h-[42vh] overflow-y-auto pr-2 scrollbar-hide">
              {companions.length === 0 && (
                <p className="text-sm text-gray-500 italic text-center py-6 border-2 border-dashed border-gray-200 rounded-2xl bg-white">
                  No companions added. Click "+ Add Person" if someone is coming with you.
                </p>
              )}
              {companions.map((c, idx) => (
                <div key={idx} className="p-5 rounded-2xl border border-gray-200 bg-white relative animate-fade-in-up hover-card">
                  <button onClick={() => removeCompanion(idx)} className="absolute top-4 right-4 text-rose-600 font-extrabold text-xs hover:underline">Remove</button>
                  <div className="space-y-3">
                    <input type="text" placeholder="Full Name (Required)" className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-[var(--u-blue)] outline-none bg-white" value={c.name} onChange={(e) => updateComp(idx, "name", e.target.value)} />
                    <div className="grid grid-cols-2 gap-3">
                      <input type="text" placeholder="Relation (e.g. Wife)" className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-[var(--u-blue)] outline-none bg-white" value={c.relation} onChange={(e) => updateComp(idx, "relation", e.target.value)} />
                      <input type="text" placeholder="Contact Number" className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-[var(--u-blue)] outline-none bg-white" value={c.phone} onChange={(e) => updateComp(idx, "phone", e.target.value)} />
                    </div>
                    <input type="email" placeholder="Email Address" className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-[var(--u-blue)] outline-none bg-white" value={c.email} onChange={(e) => updateComp(idx, "email", e.target.value)} />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-3 mt-8">
              <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-extrabold text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={handleConfirm} className="flex-1 py-3 rounded-xl grad-btn text-white text-sm font-extrabold shadow-lg u-sweep relative overflow-hidden">Confirm Registration</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const FAKE_EVENTS = window.FAKE_EVENTS || [
  { id: 1, title: "National Research Congress 2025", description: "Flagship multi-track conference on AI, education, and health research.", type: "Conference", mode: "Hybrid", startDate: "2025-11-07", endDate: "2025-11-09", location: "Manila • Hybrid", featured: true, tags: ["AI", "Education", "Health"] }
];

function FaqAccordion() {
  const faqs = [
    { question: "Do I need an account before I can register for an event?", answer: "Yes. Create a free Conexus account, then you can register for any upcoming event in seconds." },
    { question: "Can I register for more than one event?", answer: "Yes. You can register for multiple events and see everything you joined in your dashboard." },
    { question: "How does NFC attendance work?", answer: "After registration, attendees can be issued an NFC card (or ID). On event day, scan the NFC/ID in the attendance portal to instantly verify and record check-in." },
    { question: "Can organizers issue certificates?", answer: "Yes. Organizers can generate certificates from templates and issue them to attendees (ideal for trainings, bootcamps, and seminars)." },
  ];
  return <div className="masonry columns-1 md:columns-2 gap-4">{faqs.map((item, idx) => <FaqItem key={idx} question={item.question} answer={item.answer} />)}</div>;
}

function formatDateRange(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate || startDate);
  const opts = { month: "short", day: "numeric", year: "numeric" };
  const sameDay = start.toDateString() === end.toDateString();
  if (sameDay) return start.toLocaleDateString(undefined, opts);
  return start.toLocaleDateString(undefined, opts) + " – " + end.toLocaleDateString(undefined, opts);
}

function SingleEventPage({ event, onBack, onRegisterClick }) {
  if (!event) return null;
  return (
    <section className="relative px-4 py-12 max-w-5xl mx-auto">
      <Breadcrumbs items={[{ label: "Home", onClick: onBack }, { label: "Event Details" }]} />
      <div className="rounded-3xl overflow-hidden u-card">
        <div className="relative h-48 bg-[var(--u-navy)] overflow-hidden">
          <div className="absolute inset-0 u-hero-grid" />
          <div className="absolute inset-0 bg-gradient-to-r from-[rgba(30,90,168,.32)] to-[rgba(245,197,24,.12)]" />
          <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-[var(--u-gold)]" />
          <div className="absolute -bottom-14 -right-14 w-72 h-72 rounded-full bg-white/10 blur-3xl" />
        </div>
        <div className="px-8 py-8 relative">
          <div className="absolute -top-6 left-8">
            <span className="inline-flex items-center gap-2 bg-white text-brand px-4 py-2 rounded-xl shadow-md font-extrabold text-sm border border-gray-100">
              <span className="h-2.5 w-2.5 rounded-sm bg-[var(--u-gold)]" />
              {event.type || "Event"}
            </span>
          </div>
          <div className="flex flex-col md:flex-row justify-between items-start gap-6 mb-6">
            <div className="min-w-0">
              <h1 className="text-3xl md:text-4xl font-extrabold text-brand mb-2 font-display leading-tight">{event.title}</h1>
              <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                <span className="flex items-center gap-1.5"><svg className="w-4 h-4 text-accent1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>{formatDateRange(event.startDate, event.endDate)}</span>
                <span className="flex items-center gap-1.5"><svg className="w-4 h-4 text-accent2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>{event.location}</span>
                <span className="flex items-center gap-1.5"><svg className="w-4 h-4 text-accent3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>{event.mode || "On-site"}</span>
              </div>
            </div>
            <button type="button" onClick={() => onRegisterClick(event)} className="px-8 py-3 rounded-xl grad-btn text-white font-extrabold shadow-lg u-sweep relative overflow-hidden">Register Now</button>
          </div>
          <hr className="border-gray-100 mb-6" />
          <div className="grid md:grid-cols-3 gap-8">
            <div className="md:col-span-2 space-y-6">
              <div><h3 className="text-lg font-extrabold text-brand mb-2">About this event</h3><p className="text-gray-600 leading-relaxed whitespace-pre-wrap">{event.description || "No description provided."}</p></div>
            </div>
            <div className="md:col-span-1 space-y-6">
              {event.tags && event.tags.length > 0 && (
                <div className="u-soft p-5 rounded-2xl">
                  <h4 className="text-sm font-extrabold text-brand mb-3">Tags</h4>
                  <div className="flex flex-wrap gap-2">{event.tags.map((tag) => <span key={tag} className="bg-white border border-gray-200 px-3 py-1 rounded-lg text-xs text-gray-700 font-semibold">{tag}</span>)}</div>
                </div>
              )}
              <div className="u-soft p-5 rounded-2xl">
                <h4 className="text-sm font-extrabold text-brand mb-3">Share</h4>
                <div className="flex gap-2">
                  <button className="flex-1 bg-white border border-gray-200 p-2 rounded-lg text-gray-700 hover:text-accent1 text-xs font-semibold transition-colors">Copy Link</button>
                  <button className="flex-1 bg-white border border-gray-200 p-2 rounded-lg text-gray-700 hover:text-accent1 text-xs font-semibold transition-colors">Email</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-8 text-center"><button onClick={onBack} className="text-gray-600 hover:text-brand font-semibold transition-colors">← Back to all events</button></div>
    </section>
  );
}

function PublicEventsPage({ events, loading, onBack, onRegisterClick }) {
  // 1. State for the filter
  const [filterMode, setFilterMode] = useState("All");

  // 2. Filter Logic
  const allEvents = events || [];
  const list = filterMode === "All" 
    ? allEvents 
    : allEvents.filter(e => e.mode === filterMode);

  return (
    <section className="relative px-4 py-12 max-w-7xl mx-auto">
      <Breadcrumbs items={[{ label: "Home", onClick: onBack }, { label: "Upcoming events" }]} />

      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-8">
        <div>
          <h2 className="font-display text-2xl md:text-3xl font-extrabold text-brand">Upcoming events</h2>
          <p className="text-sm text-gray-600 mt-2 max-w-xl leading-relaxed">
            Browse all scheduled events. Filter by mode to find online or on-site opportunities that fit your schedule.
          </p>
        </div>

        {/* --- NEW: MODE DROPDOWN --- */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <div className="relative">
                <select 
                    value={filterMode} 
                    onChange={(e) => setFilterMode(e.target.value)} 
                    className="appearance-none pl-5 pr-10 py-3 rounded-xl border-2 border-gray-100 bg-white text-sm font-bold text-gray-700 hover:border-brand/30 focus:border-brand focus:ring-4 focus:ring-brand/10 transition-all outline-none cursor-pointer min-w-[160px]"
                >
                    <option value="All">Show All Modes</option>
                    <option value="On-site">📍 On-site Only</option>
                    <option value="Virtual">💻 Virtual / Online</option>
                    <option value="Hybrid">🌐 Hybrid</option>
                </select>
                {/* Custom arrow icon for style */}
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6"/></svg>
                </div>
            </div>
            
            <button type="button" onClick={onBack} className="text-xs text-gray-500 hover:text-brand font-bold px-3 py-3">
                ← Back
            </button>
        </div>
      </div>

      {/* Event Grid */}
      {loading ? (
        <div className="flex justify-center py-20"><div className="spinner" /></div>
      ) : list.length === 0 ? (
        <div className="p-12 text-center bg-gray-50 rounded-[2rem] border border-dashed border-gray-200">
            <p className="text-gray-400 font-bold text-lg">No events found.</p>
            <p className="text-gray-400 text-sm mt-1">Try changing the filter or check back later.</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {list.map((event, idx) => (
            <article
              key={event.id || idx}
              className="hover-card relative overflow-hidden p-6 rounded-2xl u-card flex flex-col h-full bg-white border border-gray-100 shadow-sm transition-all animate-fade-in-up"
              style={{ animationDelay: `${idx * 50}ms` }}
            >
              <div className="absolute top-0 left-0 right-0 h-[4px] bg-[var(--u-gold)]" />
              
              {/* Header: Title and Type Badge */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <h3 className="font-extrabold text-lg text-brand leading-snug line-clamp-2" title={event.title}>{event.title}</h3>
                <span className="shrink-0 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md bg-blue-50 text-blue-600 border border-blue-100">
                  {event.type || "Event"}
                </span>
              </div>

              <p className="text-xs text-gray-600 mb-5 line-clamp-2 flex-1">{event.description}</p>

              {/* Info Grid */}
              <div className="space-y-2 text-xs text-gray-700 bg-gray-50/50 p-3 rounded-xl border border-gray-100 mb-5">
                <div className="flex items-center gap-2">
                    <span className="text-base">📅</span> 
                    <span className="font-semibold">{formatDateRange(event.startDate, event.endDate)}</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-base">📍</span> 
                    <span className="truncate">{event.location}</span>
                </div>
                
                {/* Mode Badge - Dynamic Colors */}
                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-200">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Mode:</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${
                        event.mode === 'Virtual' ? 'bg-purple-50 text-purple-600 border-purple-100' :
                        event.mode === 'Hybrid' ? 'bg-teal-50 text-teal-600 border-teal-100' :
                        'bg-emerald-50 text-emerald-600 border-emerald-100'
                    }`}>
                        {event.mode || "On-site"}
                    </span>
                </div>
              </div>

              {/* Footer: Tags and Register Button */}
              <div className="mt-auto flex items-center justify-between gap-3">
                 <div className="flex flex-wrap gap-1">
                    {(event.tags || []).slice(0, 2).map((tag) => (
                      <span key={tag} className="px-2 py-0.5 rounded-md border border-gray-200 bg-white text-[9px] font-bold text-gray-500 uppercase tracking-wider">
                        {tag}
                      </span>
                    ))}
                 </div>
                 
                 <button
                  type="button"
                  onClick={() => onRegisterClick(event)}
                  className="px-5 py-2.5 rounded-xl u-btn-gold text-xs font-extrabold transition u-sweep relative overflow-hidden shadow-sm hover:shadow-md"
                >
                  Register
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function Section({ title, subtitle, children }) {
  return (
    <section className="relative section-wash px-4 py-14">
      <div className="max-w-7xl mx-auto">
        <div className="reveal show mb-8 text-center">
          <h2 className="font-display text-2xl md:text-3xl font-extrabold text-brand">{title}</h2>
          {subtitle ? <p className="text-gray-600 text-sm md:text-base mt-2">{subtitle}</p> : null}
          <div className="mx-auto mt-4 h-[3px] w-16 bg-[var(--u-gold)] rounded-full u-pulse" />
        </div>
        {children}
      </div>
    </section>
  );
}

function StepCard({ number, title, text }) {
  return (
    <div className="reveal hover-card relative overflow-hidden p-7 rounded-2xl u-card">
      <div className="absolute top-0 left-0 right-0 h-[3px] bg-[var(--u-blue)]" />
      <div className="absolute -bottom-16 -right-16 w-56 h-56 rounded-full bg-[rgba(245,197,24,.10)] blur-3xl pointer-events-none" />
      <div className="relative z-10 flex items-start gap-4">
        <div className="h-12 w-12 rounded-2xl flex items-center justify-center text-[var(--u-navy)] font-black text-lg bg-[rgba(245,197,24,.90)] shadow">{number}</div>
        <div><h3 className="text-lg font-extrabold text-brand">{title}</h3><p className="mt-2 text-sm text-gray-600 leading-relaxed">{text}</p></div>
      </div>
    </div>
  );
}

function LandingContent({ events, loading, onGoLogin, onGoParticipant, scrollToFaq, onViewSingleEvent }) {
  const [search, setSearch] = useState("");
  const [featuredIndex, setFeaturedIndex] = useState(0);
  const filtered = (events || []).filter((e) => (e.title + " " + e.location + " " + (e.type || "")).toLowerCase().includes(search.toLowerCase()));
  const heroList = (filtered || []).filter((e) => e.featured).length > 0 ? filtered.filter((e) => e.featured) : (filtered.length > 0 ? [filtered[0]] : []);

  useEffect(() => {
    if (heroList.length <= 1) return;
    const interval = setInterval(() => setFeaturedIndex((prev) => (prev + 1) % heroList.length), 5000);
    return () => clearInterval(interval);
  }, [heroList.length]);

  useEffect(() => setFeaturedIndex(0), [search, heroList.length]);

  const activeIndex = heroList.length > 0 ? (featuredIndex + heroList.length) % heroList.length : 0;
  const currentHero = heroList[activeIndex] || null;
  const goPrev = () => { if (heroList.length > 1) setFeaturedIndex((prev) => prev - 1); };
  const goNext = () => { if (heroList.length > 1) setFeaturedIndex((prev) => prev + 1); };

  return (
    <>
      <section className="relative overflow-hidden u-hero">
        <div className="absolute inset-0 u-hero-grid" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[rgba(6,26,49,.98)]" />
        <div className="relative max-w-7xl mx-auto grid md:grid-cols-2 gap-10 px-4 pt-20 pb-14 md:pt-24 md:pb-20 items-center">
          <div className="reveal">
            <div className="inline-flex items-center gap-2"><span className="px-4 py-2 rounded-sm u-hero-badge text-[11px] font-black uppercase shadow-sm">UNIVERSITY EVENT PORTAL</span></div>
            <h1 className="mt-6 font-display text-5xl md:text-6xl font-black leading-[1.02]"><span className="text-white">Excellence in</span><br /><span className="text-[var(--u-gold)]">Event Planning.</span></h1>
            <p className="mt-4 text-white/80 text-sm md:text-base leading-relaxed max-w-xl">A campus-focused system for registration, attendance verification, and certification—built for academic events, symposia, trainings, and conferences.</p>
            <div className="mt-8 max-w-xl">
              <div className="flex items-stretch rounded-xl overflow-hidden u-hero-input backdrop-blur">
                <div className="flex-1 relative"><input value={search} onChange={(e) => setSearch(e.target.value)} className="w-full bg-transparent px-5 py-4 text-sm md:text-base text-white placeholder:text-white/45 outline-none" placeholder="Search events..." /></div>
                <button type="button" onClick={onGoParticipant} className="px-7 font-extrabold text-sm u-btn-gold transition u-sweep relative overflow-hidden">Search</button>
              </div>
              <div className="mt-6 flex flex-wrap items-center gap-3 text-xs">
                <button type="button" onClick={onGoLogin} className="px-4 py-2 rounded-md u-btn-outline font-extrabold transition">I'm an Organizer</button>
                <button type="button" onClick={onGoLogin} className="px-4 py-2 rounded-md u-btn-outline font-extrabold transition">I'm an Attendee</button>
                <button type="button" onClick={scrollToFaq} className="px-3 py-2 text-white/85 font-semibold hover:text-[var(--u-gold)] transition">Read FAQ →</button>
              </div>
            </div>
          </div>
          <div className="reveal show">
            {loading ? <div className="flex items-center justify-center min-h-[320px]"><div className="spinner" /></div> : !currentHero ? <div className="p-6 rounded-2xl border border-white/15 bg-white/5 text-white/70 text-sm">No events match your search yet.</div> : (
              <SimpleCarousel count={heroList.length} index={activeIndex} onPrev={goPrev} onNext={goNext} onSelect={(i) => setFeaturedIndex(i)}>
                <div className="relative rounded-2xl overflow-hidden bg-white u-carousel-frame">
                  <div className="relative bg-[var(--u-blue)] text-white px-7 pt-7 pb-6">
                    <div className="absolute top-0 left-0 right-0 h-[3px] bg-[var(--u-gold)]" />
                    <div className="absolute top-5 right-5"><span className="px-3 py-1 rounded-sm u-hero-badge text-[10px] font-black uppercase">{currentHero.type || "Event"}</span></div>
                    <h3 className="text-2xl md:text-3xl font-extrabold leading-tight pr-20 line-clamp-2">{currentHero.title}</h3>
                    <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-white/90">
                      <span className="inline-flex items-center gap-2">📅 {formatDateRange(currentHero.startDate, currentHero.endDate)}</span>
                      <span className="inline-flex items-center gap-2">📍 {currentHero.location || "TBA"}</span>
                    </div>
                  </div>
                  <div className="px-7 py-6">
                    <p className="text-sm text-gray-600 leading-relaxed line-clamp-3">{currentHero.description || "No description provided."}</p>
                    <div className="mt-6 flex items-center justify-between gap-4 flex-wrap">
                      <button type="button" onClick={() => onViewSingleEvent(currentHero)} className="px-6 py-2.5 rounded-xl grad-btn text-white font-extrabold text-sm u-sweep relative overflow-hidden">View details</button>
                      <div className="text-[11px] text-gray-500 font-semibold">{currentHero.mode || "On-site"} • NFC-ready attendance</div>
                    </div>
                  </div>
                </div>
              </SimpleCarousel>
            )}
          </div>
        </div>
      </section>
      <Section title="How it works" subtitle="Three simple steps for a smooth event experience.">
        <div className="grid md:grid-cols-3 gap-6">
          <StepCard number="1" title="Register / Enroll" text="Create an account and enroll in the event program with one click." />
          <StepCard number="2" title="Attend & Scan" text="Scan NFC or QR at doors. Duplicate scans can be auto-detected and blocked." />
          <StepCard number="3" title="Verify Certificates" text="Get auto-issued certificates with public verification links after attendance is validated." />
        </div>
      </Section>
    </>
  );
}

function Nav({ view, user, onNavigate, onLogout }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={"sticky top-0 z-40 transition-all duration-300 " + (scrolled ? "u-nav u-nav-solid" : "u-nav")}>
      <div className="max-w-7xl mx-auto flex items-center justify-between px-4 h-16">
        <button type="button" onClick={() => onNavigate("landing")} className="u-nav-brand flex items-center gap-3 font-display text-lg md:text-xl font-extrabold hover:opacity-90 transition">
          <span className="u-nav-brand-mark" /><span>Conexus</span>
        </button>
        <nav className="flex items-center gap-4 text-[14px]">
          <button type="button" onClick={() => onNavigate("landing")} className="u-nav-link transition font-semibold">Home</button>
          <button type="button" onClick={() => { if (!user) onNavigate("public-events"); else if (user.role === "presenter") onNavigate("presenter"); else if (user.role === "admin") onNavigate("admin"); else onNavigate("participant"); }} className="u-nav-link transition font-semibold">Events</button>
          <button type="button" onClick={() => onNavigate("landing-faq")} className="u-nav-link transition font-semibold">FAQ</button>
          {!user ? (
            <button type="button" onClick={() => onNavigate("auth")} className="px-4 py-2 rounded-lg u-btn-gold font-extrabold text-sm transition u-sweep relative overflow-hidden">Login / Register</button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline text-xs text-white/80 font-semibold">{user.name}</span>
              <button type="button" onClick={onLogout} className="px-3 py-1.5 rounded-full border border-white/20 text-xs text-white/90 bg-white/5 hover:bg-white/10 transition">Logout</button>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}

function Shell({ view, user, onNavigate, onLogout, children }) {
  useEffect(() => {
    if (typeof window === "undefined" || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => { if (entry.isIntersecting) { entry.target.classList.add("show"); observer.unobserve(entry.target); } });
    }, { threshold: 0.12 });
    document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [view]);

  return (
    <div className="min-h-screen flex flex-col bg-page text-brand relative">
      <div className="orb-1 floating-orb" /><div className="orb-2 floating-orb" /><div className="orb-3 floating-orb" />
      <Nav view={view} user={user} onNavigate={onNavigate} onLogout={onLogout} />
      <main className="flex-1 relative z-10">{children}</main>
      <footer className="border-t py-6 text-center text-xs md:text-sm text-gray-600 bg-white/70 backdrop-blur relative z-10">© {new Date().getFullYear()} Conexus — University Event Management</footer>
    </div>
  );
}

function downloadInvitationPdf(event, user) {
  if (!window.jspdf || !window.jspdf.jsPDF) { alert("PDF generator not loaded."); return; }
  const doc = new window.jspdf.jsPDF();
  const lineHeight = 7; let y = 20;
  const name = (user && user.name) || "Participant";
  const university = (user && user.university) || "your institution";
  const today = new Date().toLocaleDateString();
  doc.setFont("helvetica", "normal"); doc.setFontSize(11);
  doc.text("Conexus — Event Management Portal", 20, y); y += lineHeight;
  doc.text(today, 20, y); y += lineHeight * 2;
  doc.setFont(undefined, "bold"); doc.text('Subject: Invitation to "' + (event.title || "event") + '"', 20, y);
  doc.setFont(undefined, "normal"); y += lineHeight * 2;
  doc.text("To whom it may concern,", 20, y); y += lineHeight * 2;
  const bodyLines = [
    "This is to confirm that " + name + " from " + university + ' is registered to participate in the event "' + (event.title || "event") + '".',
    "",
    "Event details:",
    "• Dates: " + formatDateRange(event.startDate, event.endDate),
    "• Venue / mode: " + (event.location || "TBA"),
    "",
    "This invitation may be used for documentation, office clearance, or other event-related requirements.",
    "",
    "For verification, please contact the organizer through the Conexus portal administrator.",
  ];
  bodyLines.forEach((line) => {
    if (line === "") { y += lineHeight; }
    else { const split = doc.splitTextToSize(line, 170); doc.text(split, 20, y); y += lineHeight * (split.length || 1); }
  });
  y += lineHeight * 2;
  doc.text("Sincerely,", 20, y); y += lineHeight;
  doc.text("Event Secretariat", 20, y); y += lineHeight;
  doc.text("via Conexus — Event Management", 20, y);
  const safeTitle = (event.title || "event").replace(/[^a-z0-9]+/gi, "_").slice(0, 40);
  doc.save("Invitation_" + safeTitle + ".pdf");
}

/* =========================
   NFC DIGITAL BUSINESS CARD COMPONENTS
   ========================= */
function NfcProfileWrapper({ slug }) {
  const [userData, setUserData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/users/nfc/${slug}`);
        const data = await response.json();
        if (data.success) { setUserData(data.user); } else { setUserData(null); }
      } catch (error) { console.error("Failed to fetch user:", error); } finally { setLoading(false); }
    };
    if (slug) fetchUser();
  }, [slug]);

  if (loading) return <div className="flex justify-center py-20"><div className="spinner" /></div>;
  if (!userData) return <div className="text-center py-20 text-gray-600 font-bold">Card not activated or user not found.</div>;
  return <window.DigitalBusinessCard user={userData} />;
}

/* =========================
   MAIN APP
   ========================= */
function App() {
  const queryParams = new URLSearchParams(window.location.search);
  const nfcSlugParam = queryParams.get('nfc');
  const isNfcRoute = !!nfcSlugParam;
  
  const [view, setView] = useState(isNfcRoute ? "nfc-profile" : "landing");
  const [nfcSlug, setNfcSlug] = useState(nfcSlugParam);
  
  const [user, setUser] = useState(null);
  const [events, setEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [registrations, setRegistrations] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [selectedSingleEvent, setSelectedSingleEvent] = useState(null);
  const [regModalOpen, setRegModalOpen] = useState(false);
  const [targetEvent, setTargetEvent] = useState(null);

  // --- 1. DATA FETCHING LOGIC EXTRACTED ---
  async function loadEvents() {
    try {
      setLoadingEvents(true);
      const response = await fetch(`${API_BASE_URL}/events`);
      if (!response.ok) throw new Error("Server response not ok");
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        setEvents(data.map(row => ({
          id: row.id,
          title: row.title,
          description: row.description || "",
          location: row.location || "",
          startDate: row.start_date,
          endDate: row.end_date,
          type: row.type || "Event",
          mode: row.mode || "On-site",
          featured: !!row.featured,
          tags: []
        })));
      } else setEvents(FAKE_EVENTS);
    } catch (err) { setEvents(FAKE_EVENTS); } finally { setLoadingEvents(false); }
  }

  // In App.js
 async function loadRegistrations() {
    if (!user) return;
    try {
      const token = localStorage.getItem('conexus_token'); 
      const response = await fetch(`${API_BASE_URL}/registrations`, {
        headers: { 'Authorization': `Bearer ${token}` } 
      });
      const all = await response.json();
      if (Array.isArray(all)) {
        const mine = user.role === 'admin' ? all : all.filter(r => String(r.user_email).toLowerCase() === String(user.email).toLowerCase());
        setRegistrations(mine.map(r => ({
          id: r.id,
          userEmail: r.user_email,
          fullName: r.full_name,
          eventId: r.event_id,
          eventTitle: r.event_title,
          startDate: r.start_date, 
          endDate: r.end_date,
          status: r.status,
          roomId: r.room_id,
          adminNote: r.admin_note,
          companions: r.companions || [],
          validId: r.valid_id_path 
        })));
      }
    } catch (err) { console.error(err); }
  }

  // Initial Load
  useEffect(() => { loadEvents(); }, []);

  // User-dependent Load
  useEffect(() => { loadRegistrations(); }, [user]);

  const navigate = (nextView) => {
    if (nextView === "landing-faq") {
      setView("landing");
      setTimeout(() => {
        const faq = document.getElementById("conexus-faq-section");
        if (faq) faq.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
      return;
    }
    setView(nextView);
  };

  // SECURE: Destroy token on logout
  const handleLogout = () => { 
    localStorage.removeItem('conexus_token'); 
    setUser(null); 
    setRegistrations([]); 
    setSubmissions([]); 
    setView("landing"); 
  };

  // SECURE: Save token on login
  const handleLogin = async ({ email, password }) => {
    const cleanEmail = (email || "").toLowerCase().trim();
    try {
      const response = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, password })
      });
      const result = await response.json();
      if (result.success) {
        
        localStorage.setItem('conexus_token', result.token); // SECURE: Save Token

        setUser(result.user);
        if (result.user.role === 'admin') setView('admin');
        else if (result.user.role === 'presenter') setView('presenter');
        else setView('participant');
        return { ok: true };
      } else return { ok: false, message: result.message };
    } catch (err) { return { ok: false, message: "Unable to connect to server." }; }
  };

  // SECURE: Auto-login after registration to fetch the token
  const handleRegister = async (form) => {
    const payload = { name: form.name, email: form.email.toLowerCase().trim(), password: form.password, university: form.university || "" };
    try {
      const response = await fetch(`${API_BASE_URL}/register_user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      if (result.success) { 
        // Force a login to get the JWT token
        await handleLogin({ email: payload.email, password: payload.password });
        alert("Account created!"); 
      }
      else alert("Registration Failed: " + result.message);
    } catch (err) { alert("Unable to connect to server."); }
  };

  // --- 2. REGISTRATION HANDLER MODIFIED TO SUPPORT REFRESH ---
  // If event is passed, it opens the LEGACY modal (used by Presenter/Admin or public).
  // If NO event is passed, it assumes it's a DATA REFRESH request from ParticipantDashboard.
  const handleRegisterForEvent = (eventOrRefresh) => { 
    if (!eventOrRefresh) {
        // Just refresh data
        loadRegistrations();
        return; 
    }
    
    // Normal Event Registration (Legacy/Fallback)
    if (!user) { setView("auth"); return; } 
    setTargetEvent(eventOrRefresh); 
    setRegModalOpen(true); 
  };

  // SECURE: Attach token to legacy registration modal
  const handleFinalRegister = async (companionData) => {
    const event = targetEvent;
    setRegModalOpen(false);
    try {
      const token = localStorage.getItem('conexus_token');
      const response = await fetch(`${API_BASE_URL}/register`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}` // SECURE: Attach Token
        },
        body: JSON.stringify({ user_email: user.email, event_id: event.id, companions: companionData })
      });
      const result = await response.json();
      if (result.success) {
        loadRegistrations(); // Refresh data instead of manual state update
        alert("Registration successful!");
      } else alert("Failed: " + (result.message || "Server Error"));
    } catch (err) { alert("Server connection error."); }
  };

  // SECURE: Attach token to update registration status
  const handleUpdateRegistrationStatus = async (regId, newStatus) => {
    setRegistrations(p => p.map(r => (r.id === regId ? { ...r, status: newStatus } : r)));
    const token = localStorage.getItem('conexus_token');
    await fetch(`${API_BASE_URL}/registrations/${regId}`, {
      method: 'PUT',
      headers: {
        'Content-Type':'application/json',
        'Authorization': `Bearer ${token}` // SECURE: Attach Token
      },
      body: JSON.stringify({status: newStatus})
    });
  };

  // SECURE: Attach token to paper submission upload
  const handleCreateSubmission = async ({ title, track, abstract, file, eventId = null }) => {
    if (!user) return alert("Login first.");
    if (!file) return alert("Please attach a PDF file.");
    
    const formData = new FormData();
    formData.append("user_email", user.email);
    formData.append("event_id", eventId || "");
    formData.append("title", title);
    formData.append("abstract", abstract);
    formData.append("file", file); 
    
    try {
      const token = localStorage.getItem('conexus_token'); // SECURE: Get the badge
      const response = await fetch(`${API_BASE_URL}/submissions`, { 
          method: 'POST', 
          headers: {
              'Authorization': `Bearer ${token}` // SECURE: Attach Token (DO NOT ADD CONTENT-TYPE FOR FORMDATA)
          },
          body: formData 
      });
      const res = await response.json();
      if (res.success) {
        setSubmissions(p => [{ id: res.id, userEmail: user.email, eventId, title, track, abstract, fileName: file.name, status: "under_review" }, ...p]);
        return res;
      } else { alert("Submission failed: " + res.message); }
    } catch (err) { alert("Submission error."); }
  };

  // SECURE: Attach token to loading user's previous submissions
  useEffect(() => {
    async function load(u) {
      if (!u) return;
      const token = localStorage.getItem('conexus_token');
      const res = await fetch(`${API_BASE_URL}/submissions?email=${encodeURIComponent(u.email)}`, {
        headers: { 'Authorization': `Bearer ${token}` } // SECURE: Attach Token
      });
      const data = await res.json();
      if (Array.isArray(data)) setSubmissions(data.map(s => ({
        id: s.id,
        userEmail: s.user_email,
        eventId: s.event_id,
        title: s.title,
        abstract: s.abstract,
        fileName: s.file_name,
        status: s.status,
        submittedAt: s.created_at
      })));
    }
    if (user) load(user); else setSubmissions([]);
  }, [user]);

  let inner = null;
  if (view === "nfc-profile") inner = <NfcProfileWrapper slug={nfcSlug} />;
  else if (view === "single-event") inner = <SingleEventPage event={selectedSingleEvent} onBack={() => setView("landing")} onRegisterClick={(evt) => handleRegisterForEvent(evt)}/>;
  else if (view === "landing") inner = <>
    <LandingContent
      events={events}
      loading={loadingEvents}
      onGoLogin={() => setView("auth")}
      onGoParticipant={() => user ? setView(user.role === "presenter" ? "presenter" : "participant") : setView("public-events")}
      scrollToFaq={() => navigate("landing-faq")}
      onViewSingleEvent={(evt) => { setSelectedSingleEvent(evt); setView("single-event"); }}
    />
    <section id="conexus-faq-section" className="relative section-wash px-4 py-12 max-w-7xl mx-auto">
      <div className="reveal mb-4 text-center">
        <h2 className="font-display text-2xl md:text-3xl font-extrabold text-brand">Frequently asked questions</h2>
        <div className="mx-auto mt-4 h-[3px] w-16 bg-[var(--u-gold)] rounded-full u-pulse" />
      </div>
      <FaqAccordion/>
    </section>
  </>;
  else if (view === "public-events") inner = <PublicEventsPage events={events} loading={loadingEvents} onBack={() => setView("landing")} onRegisterClick={() => setView("auth")}/>;
  else if (view === "auth") inner = <AuthPage onBack={() => setView("landing")} onLogin={handleLogin} onRegister={handleRegister}/>;
  // 3. UPDATED: Passing handleRegisterForEvent as the onRegister prop. 
  // Since we modified handleRegisterForEvent to handle empty args as a refresh, this fixes the white screen.
  else if (view === "participant") inner = <ParticipantDashboard user={user} events={events} loading={loadingEvents} registrations={registrations} submissions={submissions} onSubmitPaper={handleCreateSubmission} onRegister={handleRegisterForEvent} onDownloadInvitation={(e) => downloadInvitationPdf(e, user)} onUpdateUser={setUser}/>;
  else if (view === "presenter") inner = <PresenterDashboard user={user} events={events} loading={loadingEvents} registrations={registrations} submissions={submissions} onRegisterForEvent={handleRegisterForEvent} onSubmitPaper={handleCreateSubmission} onDownloadInvitation={(e) => downloadInvitationPdf(e, user)} onLogout={handleLogout}/>;
  else if (view === "admin") inner = <AdminDashboard user={user} events={events} registrations={registrations} loadingEvents={loadingEvents} onUpdateRegistrationStatus={handleUpdateRegistrationStatus} onNavigate={setView}/>;
  else if (view === "admin-certificate-designer") inner = <CertificateDesigner onBack={() => setView("admin")}/>;

  return (
    <Shell view={view} user={user} onNavigate={navigate} onLogout={handleLogout}>
      {inner}
      {/* 4. SAFETY CHECK: Only show legacy modal if targetEvent is set */}
      {regModalOpen && targetEvent && <RegistrationModal event={targetEvent} onClose={() => setRegModalOpen(false)} onConfirm={handleFinalRegister}/>}
    </Shell>
  );
}

ReactDOM.createRoot(document.getElementById("app")).render(<App />);