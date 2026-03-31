import { login } from "./routes/auth.js";
import {
  handleAnalyticsRequest,
  submitAnalyticsEvent,
} from "./routes/analytics.js";
import { handleBlogRequest } from "./routes/blog.js";
import {
  checkDiscountTimers,
  handleDiscountsRequest,
} from "./routes/discounts.js";
import { handleGalleryRequest } from "./routes/gallery.js";
import { handleInvoicesRequest } from "./routes/invoices.js";
import { handleMediaRequest } from "./routes/media.js";
import { handlePagesRequest } from "./routes/pages.js";
import { handleProductsRequest } from "./routes/products.js";
import { handlePromotionsRequest } from "./routes/promotions.js";
import { handleRecordsRequest } from "./routes/records.js";
import { handleSeoRequest } from "./routes/seo.js";
import {
  handleTestimonialsRequest,
  submitTestimonial,
} from "./routes/testimonials.js";
import { handleWarrantiesRequest } from "./routes/warranties.js";
import {
  handlePreflight,
  json,
  notFound,
  serverError,
} from "./utils/http.js";

const EXACT_ROUTES = new Map([
  ["/api/auth/login", login],
  ["/api/analytics/event", submitAnalyticsEvent],
  ["/api/testimonials/submit", submitTestimonial],
]);

const PREFIX_ROUTES = [
  ["/api/pages", handlePagesRequest],
  ["/api/products", handleProductsRequest],
  ["/api/discounts", handleDiscountsRequest],
  ["/api/gallery", handleGalleryRequest],
  ["/api/blog", handleBlogRequest],
  ["/api/testimonials", handleTestimonialsRequest],
  ["/api/promotions", handlePromotionsRequest],
  ["/api/media", handleMediaRequest],
  ["/api/seo", handleSeoRequest],
  ["/api/analytics", handleAnalyticsRequest],
  ["/api/invoices", handleInvoicesRequest],
  ["/api/warranties", handleWarrantiesRequest],
  ["/api/records", handleRecordsRequest],
];

const matchHandler = (pathname) => {
  if (EXACT_ROUTES.has(pathname)) {
    return EXACT_ROUTES.get(pathname);
  }

  for (const [prefix, handler] of PREFIX_ROUTES) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      return handler;
    }
  }

  return null;
};

const health = (request, env) =>
  json(
    {
      status: "MK Tintworks CMS API is running",
      timestamp: new Date().toISOString(),
      db_bound: !!env.DB,
      media_bound: !!env.MEDIA_BUCKET,
      docs_bound: !!env.DOCUMENTS_BUCKET,
      cache_bound: !!env.CONTENT_CACHE,
      sessions_bound: !!env.SESSIONS,
      ai_bound: !!env.AI,
      public_endpoints: [
        "POST /api/auth/login",
        "POST /api/analytics/event",
        "GET /api/pages/content?slug=...",
        "GET /api/products/site-data",
        "POST /api/testimonials/submit",
      ],
    },
    { status: 200 },
    request
  );

export default {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return handlePreflight(request);
    }

    const { pathname } = new URL(request.url);

    try {
      if (pathname === "/" || pathname === "/api" || pathname === "/api/health") {
        return health(request, env);
      }

      const handler = matchHandler(pathname);
      if (!handler) {
        return notFound(request);
      }

      return await handler(request, env, ctx);
    } catch (error) {
      console.error("Unhandled request failure", pathname, error?.message);
      return serverError(request);
    }
  },

  async scheduled(controller, env) {
    const result = await checkDiscountTimers(env);
    console.log("discount schedule check tick", controller.cron, result);
  },
};
