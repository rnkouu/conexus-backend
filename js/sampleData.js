// js/sampleData.js
// Optional demo events seeded into window.FAKE_EVENTS so App.js can use them
// as a fallback when Supabase / local DB are empty.

window.FAKE_EVENTS = [
  {
    id: 1,
    title: "National Research Congress 2025",
    description:
      "Flagship multi-track conference on AI, education, and health research.",
    type: "Conference",
    mode: "Hybrid",
    startDate: "2025-11-07",
    endDate: "2025-11-09",
    location: "Manila • Hybrid",
    featured: true,
    tags: ["AI", "Education", "Health"],
    track: "General",
    date: "Nov 7–9, 2025",
    shortDescription: "3-day congress with paper tracks, workshops and a demo day.",
  },
  {
    id: 2,
    title: "Undergraduate Research Colloquium",
    description: "Student-led symposium with fast-track feedback from panelists.",
    type: "Colloquium",
    mode: "On-site",
    startDate: "2025-09-21",
    endDate: "2025-09-21",
    location: "Laguna Campus",
    featured: false,
    tags: ["Undergraduate", "Capstone"],
    track: "Education",
    date: "Sep 21, 2025",
    shortDescription:
      "A one-day showcase of thesis, capstone and action research projects.",
  },
  {
    id: 3,
    title: "AI in Health & Life Sciences Summit",
    description:
      "Focused track on AI for diagnostics, hospital operations and bioinformatics.",
    type: "Summit",
    mode: "Virtual",
    startDate: "2025-10-12",
    endDate: "2025-10-12",
    location: "Online",
    featured: true,
    tags: ["AI", "Health"],
    track: "Health & Life Sciences",
    date: "Oct 12, 2025",
    shortDescription:
      "Keynotes + panels featuring clinicians, data scientists and regulators.",
  },
  {
    id: 4,
    title: "Faculty Research Writing Bootcamp",
    description:
      "Hands-on workshop for faculty who want to turn data into publishable papers.",
    type: "Workshop",
    mode: "On-site",
    startDate: "2025-08-03",
    endDate: "2025-08-04",
    location: "Quezon City",
    featured: false,
    tags: ["Faculty", "Workshop"],
    track: "Capacity Building",
    date: "Aug 3–4, 2025",
    shortDescription: "2-day intensive with templates, peer review and coaching.",
  },
];
