window.MKT_CMS_UI.mountModulePage({
  eyebrow: "Pipeline View",
  title: "Sales Dashboard",
  description:
    "Track deal movement from inquiry to close so the business can focus energy where revenue is actually building or stalling.",
  actions: [
    { label: "Review hot leads", variant: "secondary", toast: "Lead scoring arrives when records and analytics get deeper integration." },
    { label: "Update pipeline", variant: "primary", toast: "Pipeline editing will connect once the sales data model is defined." },
  ],
  metrics: [
    { label: "Pipeline stages", value: "5", hint: "Inquiry to closed keeps movement obvious.", tone: "gold" },
    { label: "Key sources", value: "3", hint: "Website, referrals, and walk-ins dominate the mix.", tone: "neutral" },
    { label: "Decision pace", value: "Daily", hint: "Sales flow should be checked more often than analytics.", tone: "success" },
    { label: "Attention risk", value: "High", hint: "Leads go cold fast when follow-up is invisible.", tone: "danger" },
  ],
  primary: {
    eyebrow: "Pipeline Table",
    title: "Opportunity tracking",
    description: "A compact, clear pipeline matters more than a complicated CRM nobody wants to touch.",
    captionLabel: "Sales rule",
    caption: "The system should help the team act faster, not capture trivia.",
    searchPlaceholder: "Search by lead, source, or stage",
    columns: ["Lead", "Source", "Next Move", "Status"],
    rows: [
      ["Prado full ceramic install", "Website booking", "Confirm appointment slot", { type: "status", value: "Queued" }],
      ["Fleet office tint proposal", "Referral", "Send revised quote", { type: "status", value: "Review" }],
      ["Saloon entry package", "Walk-in", "Close same-day", { type: "status", value: "Live" }],
      ["Residential privacy consult", "Instagram DM", "Schedule site call", { type: "status", value: "Pending" }],
      ["Chameleon tint inquiry", "Website form", "Clarify legality context", { type: "status", value: "Draft" }],
    ],
  },
  secondary: [
    {
      type: "checklist",
      eyebrow: "Healthy Pipeline",
      title: "What the team should see fast",
      description: "If the operator cannot spot urgency immediately, the dashboard is failing.",
      items: [
        "Which leads are closest to booking right now.",
        "Which quotes are waiting too long without follow-up.",
        "Which source channels are producing serious buyers.",
      ],
    },
    {
      type: "timeline",
      eyebrow: "Later Integration",
      title: "How this page will grow",
      items: [
        { title: "Records tie-in", meta: "Closed deals can become customer and vehicle records automatically." },
        { title: "Invoice handoff", meta: "Won deals can generate clean billing flows without duplicate entry." },
        { title: "Analytics feedback", meta: "Source performance can be compared against real close quality." },
      ],
    },
  ],
});
