window.MKT_CMS_UI.mountModulePage({
  eyebrow: "R2 Assets",
  title: "Media Library",
  description:
    "Organize gallery images, reusable brand assets, and payment logos so every module can pull clean media from one place.",
  actions: [
    { label: "Copy public base URL", variant: "secondary", toast: "Public R2 base URL is recorded in the Section 2 status data." },
    { label: "Upload asset", variant: "primary", toast: "Upload handling connects once the R2 worker routes are finalized." },
  ],
  metrics: [
    { label: "R2 buckets", value: "2", hint: "Media and documents are already provisioned.", tone: "gold" },
    { label: "Public media URL", value: "Live", hint: "The public bucket URL is already known and stored.", tone: "success" },
    { label: "Core logos", value: "3", hint: "MK Tintworks, M-Pesa, and Equity are copied into the CMS app.", tone: "neutral" },
    { label: "Naming pressure", value: "High", hint: "Good filenames matter once the library scales.", tone: "danger" },
  ],
  primary: {
    eyebrow: "Asset Groups",
    title: "Media organization plan",
    description: "Keep storage readable so editors do not need to guess where files belong.",
    captionLabel: "Storage rule",
    caption: "If someone cannot predict where a file lives, the library is already too messy.",
    searchPlaceholder: "Search by folder, asset, or usage",
    columns: ["Asset Group", "Primary Use", "Format", "Status"],
    rows: [
      ["Brand logos", "CMS and website identity", "PNG/SVG", { type: "status", value: "Live" }],
      ["Gallery originals", "Before-and-after source shots", "PNG/JPG", { type: "status", value: "Queued" }],
      ["Optimized web assets", "Public site delivery", "WEBP", { type: "status", value: "Live" }],
      ["Document stamps", "Invoices and warranty PDFs", "PNG", { type: "status", value: "Draft" }],
      ["Campaign creatives", "Promotion banners and social tie-ins", "PNG/JPG", { type: "status", value: "Review" }],
    ],
  },
  secondary: [
    {
      type: "logos",
      eyebrow: "Reusable Assets",
      title: "Copied into the CMS app",
      description: "These files are already available locally for later invoice and payment workflows.",
      items: [
        { src: "/assets/images/cms-logo-dark.png", alt: "MK Tintworks logo", label: "MK Tintworks", meta: "Official website logo variant" },
        { src: "/assets/images/mpesa-logo.png", alt: "M-Pesa logo", label: "M-Pesa", meta: "Copied from tint pictures folder" },
        { src: "/assets/images/equity-logo.png", alt: "Equity Bank logo", label: "Equity Bank", meta: "Copied from tint pictures folder" },
      ],
    },
    {
      type: "checklist",
      eyebrow: "Upload Hygiene",
      title: "Before assets go live",
      description: "The library should protect quality, not just store files.",
      items: [
        "Compress aggressively for web-facing assets without harming premium presentation.",
        "Use human-readable filenames tied to the real use case.",
        "Keep public URLs predictable so future modules can generate them safely.",
      ],
    },
  ],
});
