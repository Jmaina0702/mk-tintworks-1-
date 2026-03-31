window.MKT_CMS_UI.mountModulePage({
  eyebrow: "Business Signals",
  title: "Analytics Dashboard",
  description:
    "Use Cloudflare-friendly analytics data to understand traffic, intent, and conversion signals without paying for another SaaS layer.",
  actions: [
    { label: "Refresh events", variant: "secondary", toast: "Live event pulls will replace the placeholder view once analytics endpoints expand." },
    { label: "Export summary", variant: "primary", toast: "Analytics export is queued for the reporting section." },
  ],
  metrics: [
    { label: "Migrated events", value: "31", hint: "Historical analytics survived the Section 3 migration.", tone: "gold" },
    { label: "Tracked funnels", value: "4", hint: "Home to services, gallery to booking, blog to booking, testimonials to booking.", tone: "success" },
    { label: "Public endpoint", value: "Live", hint: "Event capture endpoint already exists from Section 4.", tone: "neutral" },
    { label: "Decision horizon", value: "Weekly", hint: "Use analytics to steer priorities, not to create dashboard noise.", tone: "warning" },
  ],
  primary: {
    eyebrow: "Questions Table",
    title: "What the numbers should answer",
    description: "Analytics should guide decisions on content, offers, and conversion friction rather than just report page views.",
    captionLabel: "Analytics rule",
    caption: "Track only signals that can change a real business decision.",
    searchPlaceholder: "Search by funnel or event",
    columns: ["Question", "Signal", "Frequency", "Status"],
    rows: [
      ["Which page starts the most bookings?", "CTA click to booking flow", "Daily", { type: "status", value: "Live" }],
      ["Which service angle wins?", "Services card engagement", "Weekly", { type: "status", value: "Live" }],
      ["Do promotions help or distract?", "Banner click vs booking completion", "Campaign", { type: "status", value: "Queued" }],
      ["Do testimonials reduce hesitation?", "Testimonials page to booking path", "Weekly", { type: "status", value: "Review" }],
      ["Which blog topics lead to action?", "Article clickthrough to booking", "Monthly", { type: "status", value: "Draft" }],
    ],
  },
  secondary: [
    {
      type: "list",
      eyebrow: "Good Questions",
      title: "How to keep this useful",
      description: "A tight analytics surface is more valuable than a noisy one.",
      items: [
        { title: "Focus on booking movement", meta: "Views matter only when they explain or improve conversion." },
        { title: "Watch changes after content edits", meta: "Pair analytics shifts with the editor and promotion timelines." },
        { title: "Keep source naming stable", meta: "Events should stay comparable from month to month." },
      ],
    },
    {
      type: "timeline",
      eyebrow: "Already Ready",
      title: "What this page can build on",
      items: [
        { title: "Public analytics endpoint", meta: "Website events can already be accepted without opening the protected API." },
        { title: "Preserved event rows", meta: "Legacy history prevents the dashboard from starting blind." },
        { title: "Promotion tie-in", meta: "Campaign measurement can live in one place instead of scattered notes." },
      ],
    },
  ],
});
