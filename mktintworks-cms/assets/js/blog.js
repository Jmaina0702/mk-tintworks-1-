window.MKT_CMS_UI.mountModulePage({
  eyebrow: "Editorial Inventory",
  title: "Blog Manager",
  description:
    "Keep the article library organized by status, category, and SEO readiness so publishing never depends on memory alone.",
  actions: [
    { label: "Review drafts", variant: "secondary", toast: "Draft triage board will pull from live rows after the blog CRUD section." },
    { label: "New article", variant: "primary", toast: "The article creation form is reserved for the next editorial section." },
  ],
  metrics: [
    { label: "Migrated posts", value: "2", hint: "Legacy blog rows were preserved during the D1 migration.", tone: "gold" },
    { label: "Tracked categories", value: "4", hint: "Enough structure for strong editorial organization.", tone: "neutral" },
    { label: "Known missing files", value: "2", hint: "Broken references still need cleanup on the public site.", tone: "danger" },
    { label: "SEO tie-in", value: "6 rows", hint: "Metadata management already exists in the database.", tone: "success" },
  ],
  primary: {
    eyebrow: "Post Table",
    title: "Article pipeline",
    description: "Use this list to see what is live, what is waiting, and what still needs cleanup from the current website.",
    captionLabel: "Editorial rule",
    caption: "Every live post should have a matching public file path or future render target.",
    searchPlaceholder: "Search by title, category, or status",
    columns: ["Article", "Category", "Next Action", "Status"],
    rows: [
      ["Tint laws and best practices", "Education", "Confirm live file path", { type: "status", value: "Published" }],
      ["3M versus Llumar guide", "Comparison", "Expand internal links", { type: "status", value: "Published" }],
      ["Residential tint FAQ", "Residential", "Draft structure in editor", { type: "status", value: "Draft" }],
      ["Commercial energy savings", "Commercial", "Assign visual assets", { type: "status", value: "Queued" }],
      ["Chameleon tint explainer", "Automotive", "Legal review wording", { type: "status", value: "Review" }],
    ],
  },
  secondary: [
    {
      type: "list",
      eyebrow: "Editorial Standards",
      title: "What makes a post ready",
      description: "The blog should feel premium, useful, and search-aware before anything goes live.",
      items: [
        { title: "Strong opening angle", meta: "Lead with a customer problem or misconception, not filler." },
        { title: "Internal path clarity", meta: "Link naturally into services, gallery, or booking pages." },
        { title: "Search snippet discipline", meta: "Titles and descriptions must stay readable on mobile search results." },
      ],
    },
    {
      type: "timeline",
      eyebrow: "Cleanup Track",
      title: "Known blog work",
      items: [
        { title: "Repair missing article references", meta: "The current blog index still points at files that do not exist." },
        { title: "Move authorship into CMS", meta: "Structured author and category controls belong in the editor layer." },
        { title: "Connect SEO previews", meta: "The SEO module can warn on weak snippets before publish." },
      ],
    },
  ],
});
