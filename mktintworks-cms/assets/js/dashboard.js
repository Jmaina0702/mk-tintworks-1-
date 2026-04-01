window.MKT_CMS_UI.mountDashboardPage({
  eyebrow: "Control Room",
  title: "Run the entire MK Tintworks operation from one dark-mode command center.",
  description:
    "The dashboard keeps content, promotions, documents, and sales surfaces one click away while the deeper sections wire in live data and save flows.",
  actions: [
    {
      label: "Open publish board",
      variant: "gold",
      toast: "Publish workflows will connect to live save endpoints in later sections.",
    },
    {
      label: "Run content sync",
      variant: "secondary",
      toast: "Content sync is staged for the first CRUD-backed worker endpoints.",
    },
  ],
  metrics: [
    { label: "Phase 1 modules", value: "14", hint: "Every PRD module is linked from this shell.", tone: "gold" },
    { label: "Seed products", value: "10", hint: "Authoritative pricing preserved from Section 1.", tone: "success" },
    { label: "SEO rows", value: "6", hint: "Migrated metadata already sits in D1.", tone: "neutral" },
    { label: "Analytics events", value: "31", hint: "Historical event rows survived the schema migration.", tone: "neutral" },
  ],
  modules: [
    { href: "/pages/visual-editor.html", label: "Visual Editor", summary: "Page sections and homepage storytelling.", status: "Live" },
    { href: "/pages/products.html", label: "Products", summary: "Packages, brands, and price tiers.", status: "Live" },
    { href: "/pages/gallery.html", label: "Gallery", summary: "Showcase sequencing and media curation.", status: "Live" },
    { href: "/pages/blog.html", label: "Blog", summary: "Post inventory, statuses, and categories.", status: "Live" },
    { href: "/pages/blog-editor.html", label: "Blog Editor", summary: "Article assembly and preview workflow.", status: "Live" },
    { href: "/pages/testimonials.html", label: "Testimonials", summary: "Moderation queue and approvals.", status: "Live" },
    { href: "/pages/promotions.html", label: "Promotions", summary: "Urgency banners and timed offers.", status: "Live" },
    { href: "/pages/media.html", label: "Media Library", summary: "R2-backed brand and gallery assets.", status: "Live" },
    { href: "/pages/seo.html", label: "SEO", summary: "Metadata coverage and snippet quality.", status: "Live" },
    { href: "/pages/analytics.html", label: "Analytics", summary: "Traffic and conversion questions.", status: "Live" },
    { href: "/pages/invoices.html", label: "Invoices", summary: "Commercial billing document flow.", status: "Live" },
    { href: "/pages/warranty.html", label: "Warranty", summary: "Certificate issuance with invoice prefill and PDF output.", status: "Live" },
    { href: "/pages/records.html", label: "Records", summary: "Client, vehicle, and install history.", status: "Queued" },
    { href: "/pages/sales.html", label: "Sales", summary: "Lead pipeline and close momentum.", status: "Queued" },
  ],
  spotlights: [
    {
      type: "checklist",
      eyebrow: "Launch Focus",
      title: "What this shell already guarantees",
      description: "Section 5 locks the experience layer before any dangerous write behavior is introduced.",
      items: [
        "Responsive sidebar and topbar across all module routes.",
        "Shared tokens, buttons, forms, tables, badges, toasts, and modals.",
        "Noindex CMS templates so admin surfaces stay out of search results.",
      ],
    },
    {
      type: "timeline",
      eyebrow: "Next Layers",
      title: "What later sections will plug into this UI",
      items: [
        { title: "Live list endpoints", meta: "Swap the placeholder rows for protected D1-backed tables." },
        { title: "True save flows", meta: "Buttons start hitting the Worker once CRUD routes are defined." },
        { title: "Media uploads and documents", meta: "R2 and PDF flows slot into the views that already exist." },
      ],
    },
  ],
  timeline: [
    { title: "Section 2 infra remains live", meta: "Worker, D1, KV, R2, and secrets are already in place." },
    { title: "Section 3 migration preserved data", meta: "Products, blog rows, media, and analytics were kept intact." },
    { title: "Section 4 auth stays active", meta: "Cloudflare Access plus worker JWT exchange gate the CMS routes." },
    { title: "Section 16 warranty generator landed", meta: "Certificate numbering, invoice prefill, and branded PDF generation are now live in the CMS." },
  ],
  quickLinks: [
    { href: "/pages/products.html", label: "Review pricing", summary: "Start with the 10 seed products and their tier positioning." },
    { href: "/pages/testimonials.html", label: "Moderate reviews", summary: "Keep only verified, high-trust customer proof on the site." },
    { href: "/pages/invoices.html", label: "Prepare billing", summary: "Use the invoice shell as the document workflow anchor." },
    { href: "/pages/media.html", label: "Audit assets", summary: "Confirm logos, gallery items, and public URLs stay organized." },
  ],
});
