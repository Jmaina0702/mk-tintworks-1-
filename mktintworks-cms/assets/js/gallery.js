window.MKT_CMS_UI.mountModulePage({
  eyebrow: "Showcase Media",
  title: "Gallery Manager",
  description:
    "Curate before-and-after proof with a layout that keeps the strongest transformations near the top and mobile-friendly.",
  actions: [
    { label: "Plan upload batch", variant: "secondary", toast: "R2 upload actions will attach to this shell once the media endpoints are finalized." },
    { label: "Feature collection", variant: "primary", toast: "Collection prioritization staged." },
  ],
  metrics: [
    { label: "Showcase streams", value: "3", hint: "Automotive, residential, and commercial proof.", tone: "gold" },
    { label: "Featured slots", value: "12", hint: "Hero and first-scroll visibility should stay intentional.", tone: "neutral" },
    { label: "Upload rules", value: "4", hint: "Consistent framing, compression, and naming.", tone: "success" },
    { label: "Mobile fit", value: "100%", hint: "The gallery shell keeps curation decisions obvious on small screens.", tone: "neutral" },
  ],
  primary: {
    eyebrow: "Collections",
    title: "Gallery groupings",
    description: "Structure the gallery around story-driven sets instead of random uploads.",
    captionLabel: "Curation rule",
    caption: "Lead with proof that sells heat rejection, finish quality, and brand trust immediately.",
    searchPlaceholder: "Search by collection or use case",
    columns: ["Collection", "Focus", "Last refresh", "Status"],
    rows: [
      ["SUV transformations", "Premium automotive tint installs", "Today", { type: "status", value: "Live" }],
      ["Daily saloon builds", "Value and mid-tier packages", "Yesterday", { type: "status", value: "Queued" }],
      ["Commercial frontage", "Office and retail glare control", "2 days ago", { type: "status", value: "Draft" }],
      ["Residential privacy", "Heat control and UV protection", "3 days ago", { type: "status", value: "Live" }],
      ["Chameleon highlights", "Statement installs and NTSA context", "Last week", { type: "status", value: "Review" }],
    ],
  },
  secondary: [
    {
      type: "checklist",
      eyebrow: "Shoot Checklist",
      title: "What every upload should prove",
      description: "The gallery should sell confidence, not just fill space.",
      items: [
        "Capture the vehicle angle that makes the tint line and finish obvious.",
        "Use at least one close crop that shows installation quality cleanly.",
        "Pair dramatic hero shots with practical everyday examples.",
      ],
    },
    {
      type: "timeline",
      eyebrow: "Publishing Rhythm",
      title: "Recommended sequence",
      items: [
        { title: "Upload raw batch", meta: "Media library handles files and public URLs first." },
        { title: "Assign collection", meta: "Place each item into the proof story it best supports." },
        { title: "Feature strongest pair", meta: "Promote the best before-and-after set into the first slots." },
      ],
    },
  ],
});
