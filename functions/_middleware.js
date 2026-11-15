const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'self'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdn.jsdelivr.net https://www.googletagmanager.com https://challenges.cloudflare.com https://xss.spas1.my.id",
  "style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdnjs.cloudflare.com https://fonts.googleapis.com",
  "font-src 'self' data: https://cdnjs.cloudflare.com https://fonts.gstatic.com",
  "img-src 'self' data: blob: https://ysvxtbupzhubxkbvtzmo.supabase.co https://blogger.googleusercontent.com https://edge-cdn.trakteer.id https://www.google-analytics.com https://stats.g.doubleclick.net",
  "connect-src 'self' https://ysvxtbupzhubxkbvtzmo.supabase.co https://challenges.cloudflare.com https://xss.spas1.my.id https://www.google-analytics.com https://region1.google-analytics.com https://analytics.google.com https://stats.g.doubleclick.net",
  "frame-src 'self' https://challenges.cloudflare.com",
  "upgrade-insecure-requests"
].join("; ");

const maintenanceAssets = new Set([
  "/assets/maintenance-children.svg",
  "/assets/spas1-mark.png"
]);

function isSpas1Hostname(hostname) {
  return hostname === "spas1.my.id" ||
    hostname === "spas1.pages.dev" ||
    hostname.endsWith(".spas1.pages.dev");
}

function addSecurityHeaders(response) {
  const headers = new Headers(response.headers);
  headers.set("Content-Security-Policy", contentSecurityPolicy);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

export async function onRequest({ request, env, next }) {
  const hostname = new URL(request.url).hostname.toLowerCase();
  if (!isSpas1Hostname(hostname)) return next();

  const maintenanceMode = env?.MAINTENANCE_MODE;
  const maintenanceEnabled = maintenanceMode === undefined ||
    String(maintenanceMode).trim().toLowerCase() !== "false";
  const pathname = new URL(request.url).pathname;
  if (maintenanceEnabled && maintenanceAssets.has(pathname)) {
    return addSecurityHeaders(await next());
  }
  if (!maintenanceEnabled) return addSecurityHeaders(await next());

  const maintenanceRequest = new Request(new URL("/maintenance", request.url));
  const page = await next(maintenanceRequest);
  const headers = new Headers(page.headers);
  headers.set("Content-Type", "text/html; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  return addSecurityHeaders(new Response(page.body, {
    status: 503,
    statusText: "Service Unavailable",
    headers
  }));
}
