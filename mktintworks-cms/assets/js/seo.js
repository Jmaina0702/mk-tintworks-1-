window.MKT_CMS_UI.mountModulePage({
  eyebrow: "Search Metadata",
  title: "SEO Manager",
  description:
    "Keep the editable page set covered with clean titles, descriptions, and structured metadata before more content goes live.",
  actions: [
    { label: "Audit snippets", variant: "secondary", toast: "Snippet preview tooling will layer into this page when SEO save forms arrive." },
    { label: "Push metadata", variant: "primary", toast: "Metadata publishing is reserved for the dedicated CRUD section." },
  ],
  metrics: [
    { label: "Migrated SEO rows", value: "6", hint: "The current database already contains preserved metadata.", tone: "gold" },
    { label: "Controlled pages", value: "7", hint: "Every editable public page group is represented.", tone: "success" },
    { label: "Snippet surfaces", value: "3", hint: "Title, description, and supporting schema.", tone: "neutral" },
    { label: "Broken reference risk", value: "Medium", hint: "Blog gaps can weaken internal search coverage if ignored.", tone: "warning" },
  ],
  primary: {
    eyebrow: "Coverage",
    title: "Page metadata status",
    description: "This table keeps search-facing details visible instead of hidden in scattered files.",
    captionLabel: "SEO rule",
    caption: "Readable language wins first. Search optimization should never make the site sound robotic.",
    searchPlaceholder: "Search by page or status",
    columns: ["Page", "Focus", "Next Action", "Status"],
    rows: [
      ["Home", "Brand + automotive tint", "Refine hero snippet", { type: "status", value: "Live" }],
      ["Services", "Tint package discovery", "Check package keyword mapping", { type: "status", value: "Live" }],
      ["Gallery", "Proof and trust", "Add stronger visual description", { type: "status", value: "Draft" }],
      ["Testimonials", "Customer trust", "Prepare dynamic review schema", { type: "status", value: "Queued" }],
      ["Blog", "Education + long-tail search", "Repair missing post references", { type: "status", value: "Review" }],
    ],
  },
  secondary: [
    {
      type: "checklist",
      eyebrow: "Snippet Quality",
      title: "What to verify on each page",
      description: "The SEO layer should support the brand voice instead of flattening it.",
      items: [
        "Keep titles direct, premium, and under control for mobile results.",
        "Write descriptions that invite the click without sounding generic.",
        "Match the public page promise to the real visible content.",
      ],
    },
    {
      type: "timeline",
      eyebrow: "Integration Path",
      title: "Where this connects next",
      items: [
        { title: "Visual editor warnings", meta: "Content changes can trigger SEO checks before publish." },
        { title: "Blog editor previews", meta: "Article metadata can render alongside headline and intro blocks." },
        { title: "Analytics correlation", meta: "Search-facing improvements can be compared against lead generation later." },
      ],
    },
  ],
});
