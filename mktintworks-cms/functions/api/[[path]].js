const WORKER_API_BASE = "https://mktintworks-cms-api.mktintworks.workers.dev";

const buildTargetUrl = (requestUrl) => {
  const source = new URL(requestUrl);
  return new URL(`${source.pathname}${source.search}`, WORKER_API_BASE);
};

const buildProxyRequest = (request, targetUrl) => {
  const headers = new Headers(request.headers);
  headers.set("x-forwarded-host", new URL(request.url).host);
  headers.set("x-forwarded-proto", new URL(request.url).protocol.replace(":", ""));

  const init = {
    method: request.method,
    headers,
    redirect: "manual",
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = request.body;
  }

  return new Request(targetUrl, init);
};

export async function onRequest(context) {
  const targetUrl = buildTargetUrl(context.request.url);
  const upstreamRequest = buildProxyRequest(context.request, targetUrl);
  return fetch(upstreamRequest);
}
