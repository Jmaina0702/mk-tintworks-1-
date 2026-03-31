window.MKT_CMS_UI.mountModulePage({
  eyebrow: "Coverage Documents",
  title: "Warranty Generator",
  description:
    "Issue clean warranty records that stay traceable to the customer, vehicle, package, and installation date.",
  actions: [
    { label: "Check coverage rules", variant: "secondary", toast: "Coverage matrices will become editable when warranty business rules are defined." },
    { label: "Generate warranty", variant: "primary", confirmMessage: "Generate the warranty document for the active install record?", toast: "Warranty generation staged." },
  ],
  metrics: [
    { label: "Coverage layers", value: "3", hint: "Film, workmanship, and exclusions must stay explicit.", tone: "gold" },
    { label: "Traceable anchors", value: "4", hint: "Client, vehicle, package, install date.", tone: "success" },
    { label: "Document source", value: "Worker", hint: "Warranty PDFs should be generated in the backend layer.", tone: "neutral" },
    { label: "Trust sensitivity", value: "Very high", hint: "Warranty clarity directly affects brand credibility.", tone: "danger" },
  ],
  primary: {
    eyebrow: "Warranty Fields",
    title: "Coverage blueprint",
    description: "The generator should assemble every warranty from controlled fields instead of free-form text.",
    captionLabel: "Coverage rule",
    caption: "If the terms cannot be traced to a package and install record, the warranty should not be issued.",
    searchPlaceholder: "Search by field or requirement",
    columns: ["Field", "Purpose", "Validation", "Status"],
    rows: [
      ["Customer identity", "Tie coverage to the right owner", "Required", { type: "status", value: "Live" }],
      ["Vehicle details", "Prevent cross-vehicle confusion", "Required", { type: "status", value: "Live" }],
      ["Film package", "Set the coverage basis", "Required", { type: "status", value: "Queued" }],
      ["Exclusions", "Set clear boundaries up front", "Template controlled", { type: "status", value: "Draft" }],
      ["Issue signature", "Confirm the record is official", "Template controlled", { type: "status", value: "Review" }],
    ],
  },
  secondary: [
    {
      type: "checklist",
      eyebrow: "Validation",
      title: "Before a warranty is issued",
      description: "A short checklist prevents weak documents from reaching customers.",
      items: [
        "Match the warranty package to the actual installed film.",
        "Check the client and vehicle identifiers against the records module.",
        "Keep exclusions readable and visible instead of burying them.",
      ],
    },
    {
      type: "timeline",
      eyebrow: "Record Flow",
      title: "How this will work later",
      items: [
        { title: "Pull install details", meta: "Use records and products as the factual source." },
        { title: "Generate branded PDF", meta: "The Worker returns a document the CMS can store or resend." },
        { title: "Link back to history", meta: "Every warranty should appear inside the client record timeline." },
      ],
    },
  ],
});
