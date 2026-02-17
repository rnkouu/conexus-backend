// js/uiComponents.js
const { useState } = React;

function Loader({ label = "Loading..." }) {
  return (
    <div className="flex items-center gap-2 text-sm text-slate-200">
      <span className="h-4 w-4 border-2 border-brandAccent border-t-transparent rounded-full animate-spin" />
      <span>{label}</span>
    </div>
  );
}

function Breadcrumbs({ items }) {
  return (
    <nav className="flex items-center text-xs text-slate-300 mb-4">
      {items.map((item, idx) => (
        <span key={idx} className="flex items-center">
          {idx > 0 && <span className="mx-1 text-slate-500">/</span>}
          <span className={item.active ? "font-semibold text-brandAccent" : ""}>
            {item.label}
          </span>
        </span>
      ))}
    </nav>
  );
}

function AccordionItem({ title, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-slate-700 rounded-xl overflow-hidden bg-slate-900/50">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <span className="font-medium text-sm">{title}</span>
        <span className="text-slate-400 text-lg">{open ? "−" : "+"}</span>
      </button>
      {open && <div className="px-4 pb-4 text-sm text-slate-200">{children}</div>}
    </div>
  );
}

function SimpleCarousel({ items }) {
  const [index, setIndex] = useState(0);
  if (!items || items.length === 0) return null;

  const current = items[index];

  const next = () => setIndex((prev) => (prev + 1) % items.length);
  const prev = () => setIndex((prev) => (prev - 1 + items.length) % items.length);

  return (
    <div className="relative rounded-3xl border border-slate-800 bg-gradient-to-r from-indigo-600/30 via-indigo-500/20 to-sky-500/20 p-6 overflow-hidden">
      <div className="absolute inset-0 pointer-events-none opacity-40 bg-[radial-gradient(circle_at_top,_#4f46e5_0,_transparent_45%),_radial-gradient(circle_at_bottom,_#0ea5e9_0,_transparent_45%)]" />
      <div className="relative flex flex-col gap-2">
        <span className="inline-flex items-center gap-2 text-xs uppercase tracking-wide text-indigo-200">
          <span className="h-1 w-6 rounded-full bg-indigo-300" />
          Featured Event
        </span>
        <h3 className="text-xl font-semibold text-white">{current.title}</h3>
        <p className="text-sm text-slate-100/80 max-w-xl">{current.shortDescription}</p>
        <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-100/80">
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-black/30 border border-indigo-400/40">
            📅 {current.date}
          </span>
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-black/30 border border-emerald-400/40">
            📍 {current.location}
          </span>
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-black/30 border border-pink-400/40">
            Track: {current.track}
          </span>
        </div>
      </div>

      <div className="relative mt-6 flex items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={prev}
            className="h-8 w-8 flex items-center justify-center rounded-full border border-slate-500 bg-black/40 text-xs hover:border-white/80 hover:bg-white/10 transition"
          >
            ‹
          </button>
          <button
            onClick={next}
            className="h-8 w-8 flex items-center justify-center rounded-full border border-slate-500 bg-black/40 text-xs hover:border-white/80 hover:bg-white/10 transition"
          >
            ›
          </button>
        </div>
        <div className="flex gap-1">
          {items.map((_, i) => (
            <span
              key={i}
              className={
                "h-1.5 rounded-full transition-all " +
                (i === index ? "w-5 bg-white" : "w-2 bg-white/40")
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function Tabs({ tabs, active, onChange }) {
  return (
    <div className="inline-flex rounded-2xl bg-slate-900/80 border border-slate-700 p-1">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          onClick={() => onChange(tab.value)}
          className={
            "px-4 py-1.5 text-xs rounded-2xl transition " +
            (tab.value === active
              ? "bg-white text-slate-900 font-semibold shadow-sm"
              : "text-slate-300 hover:text-white")
          }
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

// Expose globally
window.Loader = Loader;
window.Breadcrumbs = Breadcrumbs;
window.AccordionItem = AccordionItem;
window.SimpleCarousel = SimpleCarousel;
window.Tabs = Tabs;
