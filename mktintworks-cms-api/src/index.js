export default {
  async fetch(request, env, ctx) {
    return new Response(
      JSON.stringify(
        {
          status: "MK Tintworks CMS API is running",
          timestamp: new Date().toISOString(),
          db_bound: !!env.DB,
          media_bound: !!env.MEDIA_BUCKET,
          docs_bound: !!env.DOCUMENTS_BUCKET,
          cache_bound: !!env.CONTENT_CACHE,
          sessions_bound: !!env.SESSIONS,
          ai_bound: !!env.AI,
        },
        null,
        2
      ),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  },

  async scheduled(controller, env, ctx) {
    console.log("discount schedule check tick", controller.cron);
  },
};
