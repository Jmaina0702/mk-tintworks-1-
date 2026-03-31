window.MKT_CMS_UI.mountModulePage({
  eyebrow: "Billing Documents",
  title: "Invoice Generator",
  description:
    "Prepare branded invoices with clean payment instructions so clients can move from quote to payment without confusion.",
  actions: [
    { label: "Preview PDF", variant: "secondary", toast: "PDF preview will connect when the document worker handlers are added." },
    { label: "Issue invoice", variant: "primary", confirmMessage: "Generate and issue the current invoice draft?", toast: "Invoice generation staged." },
  ],
  metrics: [
    { label: "Payment rails", value: "2", hint: "M-Pesa and Equity bank assets are already in the CMS.", tone: "gold" },
    { label: "Required approvals", value: "3", hint: "Customer, install details, and pricing truth.", tone: "neutral" },
    { label: "Document source", value: "Worker", hint: "PDF generation belongs in the Cloudflare layer, not in the browser.", tone: "success" },
    { label: "Error cost", value: "High", hint: "Invoices must stay trustworthy and internally consistent.", tone: "danger" },
  ],
  primary: {
    eyebrow: "Template Sections",
    title: "Invoice structure",
    description: "The invoice surface should guide the operator through all required commercial details in a predictable order.",
    captionLabel: "Document rule",
    caption: "Pricing, customer identity, and payment instructions should never disagree across systems.",
    searchPlaceholder: "Search by section or requirement",
    columns: ["Section", "Purpose", "Source", "Status"],
    rows: [
      ["Client details", "Identify the bill recipient clearly", "Records system", { type: "status", value: "Live" }],
      ["Vehicle and package", "Tie the bill to the actual work sold", "Products + records", { type: "status", value: "Queued" }],
      ["Line totals", "Show a clean commercial breakdown", "Invoice builder", { type: "status", value: "Draft" }],
      ["Payment instructions", "Tell the client exactly how to pay", "Static branded assets", { type: "status", value: "Live" }],
      ["Signature block", "Lock trust and accountability", "Template", { type: "status", value: "Review" }],
    ],
  },
  secondary: [
    {
      type: "logos",
      eyebrow: "Payment Assets",
      title: "Current payment branding",
      description: "These assets are copied into the CMS now so the later PDF work can reuse them directly.",
      items: [
        { src: "/assets/images/mpesa-logo.png", alt: "M-Pesa logo", label: "M-Pesa", meta: "Mobile payment instructions" },
        { src: "/assets/images/equity-logo.png", alt: "Equity Bank logo", label: "Equity Bank", meta: "Bank payment instructions" },
      ],
    },
    {
      type: "checklist",
      eyebrow: "Before Sending",
      title: "Invoice validation",
      description: "These are the fast checks that prevent embarrassing billing errors.",
      items: [
        "Confirm the package name matches the Products Manager exactly.",
        "Check totals and payment instructions before generating the PDF.",
        "Tie every invoice back to a real client and vehicle record.",
      ],
    },
  ],
});
