window.MKT_CMS_UI.mountModulePage({
  eyebrow: "Structured Writing",
  title: "Blog Editor",
  description:
    "Give article writing a simple, guided flow so long-form content stays clear, premium, and easy to publish safely.",
  actions: [
    { label: "Open preview", variant: "secondary", toast: "Live preview wiring arrives with the real editor payload in a later section." },
    { label: "Save draft", variant: "primary", toast: "Draft saving will connect once the blog write endpoints are active." },
  ],
  metrics: [
    { label: "Template blocks", value: "6", hint: "Headline, intro, body, FAQ, CTA, SEO summary.", tone: "gold" },
    { label: "Ideal reading time", value: "4-6 min", hint: "Long enough to help, short enough to finish.", tone: "neutral" },
    { label: "Internal links", value: "3+", hint: "Each article should connect back into conversion pages.", tone: "success" },
    { label: "Preview states", value: "2", hint: "Desktop and mobile remain equally important.", tone: "neutral" },
  ],
  primary: {
    eyebrow: "Editor Blueprint",
    title: "Article composition blocks",
    description: "Keep the writing flow modular so editorial work remains consistent across different topics.",
    captionLabel: "Writing rule",
    caption: "Clarity beats word count. Every block should earn its place in the article.",
    searchPlaceholder: "Search by block or goal",
    columns: ["Block", "Purpose", "SEO Role", "Status"],
    rows: [
      ["Headline", "Hook the main search intent immediately", "Primary keyword placement", { type: "status", value: "Live" }],
      ["Intro", "Frame the customer problem fast", "Snippet support", { type: "status", value: "Live" }],
      ["Main body", "Explain the answer with authority", "Depth and relevance", { type: "status", value: "Queued" }],
      ["FAQ", "Handle objections cleanly", "Long-tail query capture", { type: "status", value: "Draft" }],
      ["CTA band", "Route the reader into booking or services", "Conversion support", { type: "status", value: "Queued" }],
    ],
  },
  secondary: [
    {
      type: "checklist",
      eyebrow: "Before Publish",
      title: "Editor checklist",
      description: "The writer should be able to work through this without developer help.",
      items: [
        "Confirm the headline says exactly what the article helps with.",
        "Check that the CTA language matches the correct destination page.",
        "Review the mobile reading flow before any publish action is allowed.",
      ],
    },
    {
      type: "timeline",
      eyebrow: "Future Hooks",
      title: "Features already anticipated by this shell",
      items: [
        { title: "Slug control", meta: "The public path should stay readable and durable." },
        { title: "SEO preview", meta: "Meta title and description can render inline inside this page later." },
        { title: "Image inserts", meta: "Media library selection can slot into block-level content." },
      ],
    },
  ],
});
