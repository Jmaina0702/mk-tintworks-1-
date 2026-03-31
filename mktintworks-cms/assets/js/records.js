window.MKT_CMS_UI.mountModulePage({
  eyebrow: "Client History",
  title: "Records System",
  description:
    "Keep customer, vehicle, install, invoice, and warranty data aligned so the business can answer questions fast and confidently.",
  actions: [
    { label: "Search records", variant: "secondary", toast: "Global search will become useful as soon as live list endpoints land." },
    { label: "Create client card", variant: "primary", toast: "Client creation is reserved for the records CRUD section." },
  ],
  metrics: [
    { label: "Core entities", value: "4", hint: "Clients, vehicles, invoices, and warranties.", tone: "gold" },
    { label: "Lookup need", value: "Fast", hint: "The whole point is to answer operational questions quickly.", tone: "success" },
    { label: "Document tie-ins", value: "2", hint: "Invoices and warranties depend on clean records.", tone: "neutral" },
    { label: "Retention value", value: "High", hint: "Good records make repeat business and support easier.", tone: "warning" },
  ],
  primary: {
    eyebrow: "Record Cards",
    title: "What a searchable record needs",
    description: "Operators should be able to trace a job from customer identity to final documents without switching mental models.",
    captionLabel: "Records rule",
    caption: "If a future follow-up cannot be handled from the record, the record is incomplete.",
    searchPlaceholder: "Search by client, plate, or document",
    columns: ["Record Type", "Key Fields", "Primary Use", "Status"],
    rows: [
      ["Client", "Name, phone, email", "Contact and follow-up", { type: "status", value: "Live" }],
      ["Vehicle", "Plate, make, model", "Install identification", { type: "status", value: "Queued" }],
      ["Install history", "Date, package, technician", "Support and repeat work", { type: "status", value: "Draft" }],
      ["Invoice link", "Invoice number and amount", "Billing traceability", { type: "status", value: "Queued" }],
      ["Warranty link", "Coverage number and terms", "After-sales support", { type: "status", value: "Draft" }],
    ],
  },
  secondary: [
    {
      type: "list",
      eyebrow: "Search Priorities",
      title: "What people will search first",
      description: "These keys should stay visible in the later form design and D1 indexes.",
      items: [
        { title: "Phone number", meta: "Fastest path when a returning client calls." },
        { title: "Vehicle plate", meta: "Critical for support and warranty lookups." },
        { title: "Document number", meta: "Useful when reconciling invoices or warranty papers." },
      ],
    },
    {
      type: "timeline",
      eyebrow: "Downstream Impact",
      title: "Why records matter",
      items: [
        { title: "Invoice accuracy", meta: "Billing can only be clean if the source customer and vehicle data are clean." },
        { title: "Warranty trust", meta: "Coverage documents depend on an authoritative install record." },
        { title: "Sales follow-up", meta: "Repeat work and referrals become easier when history is searchable." },
      ],
    },
  ],
});
