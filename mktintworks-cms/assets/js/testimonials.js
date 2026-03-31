window.MKT_CMS_UI.mountModulePage({
  eyebrow: "Social Proof",
  title: "Testimonials Pipeline",
  description:
    "Moderate incoming customer reviews carefully so the website showcases only credible, high-trust proof.",
  actions: [
    { label: "Bulk review queue", variant: "secondary", toast: "Moderation batching will connect after testimonial list endpoints expand." },
    { label: "Approve selected", variant: "primary", confirmMessage: "Approve the currently selected testimonial batch?", toast: "Approval batch staged." },
  ],
  metrics: [
    { label: "Pending count badge", value: "Live", hint: "Sidebar badge is already wired to the worker endpoint.", tone: "gold" },
    { label: "Approved now", value: "0", hint: "Public testimonials are still placeholder-only today.", tone: "danger" },
    { label: "Moderation stages", value: "3", hint: "Pending, approved, rejected.", tone: "neutral" },
    { label: "Bot protection", value: "On", hint: "Honeypot submission handling is already live from Section 4.", tone: "success" },
  ],
  primary: {
    eyebrow: "Queue",
    title: "Moderation pipeline",
    description: "Use this surface to protect the quality of the reviews that appear on the public site.",
    captionLabel: "Moderation rule",
    caption: "Only publish reviews with clear language, believable context, and no obvious spam signals.",
    searchPlaceholder: "Search by customer, channel, or status",
    columns: ["Review", "Source", "Rating", "Status"],
    rows: [
      ["Excellent finish and clean install on my Prado", "WhatsApp follow-up", { type: "html", value: window.renderStars(5) }, { type: "status", value: "Pending" }],
      ["Heat reduction was immediate on my daily car", "Google form", { type: "html", value: window.renderStars(5) }, { type: "status", value: "Pending" }],
      ["Commercial office glare solved in one visit", "Email request", { type: "html", value: window.renderStars(4) }, { type: "status", value: "Review" }],
      ["Great service", "Unknown", { type: "html", value: window.renderStars(3) }, { type: "status", value: "Rejected" }],
      ["Professional team and genuine film", "Direct request", { type: "html", value: window.renderStars(5) }, { type: "status", value: "Approved" }],
    ],
  },
  secondary: [
    {
      type: "checklist",
      eyebrow: "Approval Rules",
      title: "What to confirm before publishing",
      description: "Testimonials should raise trust, not look fabricated or generic.",
      items: [
        "Keep reviews specific enough to sound like a real install experience.",
        "Reject anything that feels copied, vague, or impossible to verify.",
        "Prefer testimonials that mention a real outcome like heat reduction or finish quality.",
      ],
    },
    {
      type: "timeline",
      eyebrow: "Activation Path",
      title: "What happens after approval",
      items: [
        { title: "Review moves to approved", meta: "The testimonial becomes eligible for public rendering." },
        { title: "Homepage and testimonials page update", meta: "Later sections can pull approved rows directly from D1." },
        { title: "Analytics correlation", meta: "The dashboard can compare fresh social proof against booking behavior." },
      ],
    },
  ],
});
