window.MKT_CMS_UI.mountModulePage({
  eyebrow: "Timed Offers",
  title: "Promotions Banner",
  description:
    "Handle urgency and discount messaging carefully so campaigns feel premium instead of desperate or noisy.",
  actions: [
    { label: "Review calendar", variant: "secondary", toast: "Campaign scheduling board arrives with live promotion rows." },
    { label: "Launch banner", variant: "primary", confirmMessage: "Launch the highlighted banner across eligible public pages?", toast: "Banner launch queued." },
  ],
  metrics: [
    { label: "Offer windows", value: "4", hint: "Enough structure for flash, monthly, seasonal, and evergreen campaigns.", tone: "gold" },
    { label: "Current discount rows", value: "1", hint: "The legacy discount survived migration and can seed this workflow.", tone: "success" },
    { label: "Display surfaces", value: "3", hint: "Homepage, services, and booking entry points.", tone: "neutral" },
    { label: "Trust risk", value: "High", hint: "Promotion copy should stay sparse and believable.", tone: "danger" },
  ],
  primary: {
    eyebrow: "Campaign Table",
    title: "Promotion schedule",
    description: "Treat campaigns as controlled objects with dates and scope, not scattered edits in page copy.",
    captionLabel: "Campaign rule",
    caption: "Urgency should be earned by date logic and clear value, never by shouting.",
    searchPlaceholder: "Search by campaign, page, or status",
    columns: ["Campaign", "Placement", "Window", "Status"],
    rows: [
      ["Weekend ceramic offer", "Homepage hero band", "Fri-Sun", { type: "status", value: "Live" }],
      ["Month-end fleet push", "Services page", "3 days", { type: "status", value: "Queued" }],
      ["Residential heat season", "Booking CTA", "Next month", { type: "status", value: "Draft" }],
      ["Chameleon awareness", "Gallery highlight", "2 weeks", { type: "status", value: "Review" }],
      ["Year-start relaunch", "Sitewide ribbon", "Expired", { type: "status", value: "Expired" }],
    ],
  },
  secondary: [
    {
      type: "list",
      eyebrow: "Guardrails",
      title: "Promotion quality checks",
      description: "Premium brands lose trust fast when banners get messy.",
      items: [
        { title: "One promise per banner", meta: "Keep the message clear and specific." },
        { title: "Real deadline logic", meta: "Every countdown or end date should come from the campaign object." },
        { title: "Scope discipline", meta: "Do not spill urgent messaging onto pages that do not need it." },
      ],
    },
    {
      type: "timeline",
      eyebrow: "Rollout",
      title: "How this module will integrate later",
      items: [
        { title: "Read from discounts and promotions tables", meta: "Campaign truth should live in D1 rather than raw markup." },
        { title: "Push to visual editor surfaces", meta: "Banner blocks can reuse controlled wording and dates." },
        { title: "Trigger analytics events", meta: "Clicks and views can be measured against booking outcomes." },
      ],
    },
  ],
});
