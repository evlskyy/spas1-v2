const maintenancePage = `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#0b132b">
  <title>503 · SPAS1 Sedang Dalam Perbaikan</title>
  <style>
    * { box-sizing: border-box; }
    body {
      display: grid;
      min-height: 100vh;
      margin: 0;
      padding: 24px;
      place-items: center;
      background: radial-gradient(ellipse at top, #172b45, #0b132b 65%);
      color: #f5f7fb;
      font: 16px/1.6 system-ui, -apple-system, "Segoe UI", sans-serif;
    }
    main {
      width: min(100%, 560px);
      padding: clamp(24px, 6vw, 44px);
      border: 1px solid #3a506b;
      border-radius: 22px;
      background: rgb(20 32 58 / 92%);
      text-align: center;
      box-shadow: 0 24px 70px rgb(0 0 0 / 32%);
    }
    .status {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 5px 12px;
      border: 1px solid rgb(251 191 36 / 40%);
      border-radius: 999px;
      background: rgb(251 191 36 / 10%);
      color: #fde68a;
      font-size: 13px;
      font-weight: 750;
    }
    h1 { margin: 20px 0 10px; font-size: clamp(26px, 7vw, 38px); line-height: 1.2; }
    p { margin: 0; color: #c5d0df; }
    .unavailable {
      display: inline-flex;
      justify-content: center;
      margin-top: 24px;
      padding: 11px 18px;
      border: 1px solid #64748b;
      border-radius: 12px;
      background: rgb(100 116 139 / 12%);
      color: #94a3b8;
      font-weight: 750;
      cursor: not-allowed;
    }
  </style>
</head>
<body>
  <main>
    <span class="status">SPAS1 · 503</span>
    <h1>Situs sedang dalam perbaikan</h1>
    <p>Maaf, domain spas1.my.id sementara tidak tersedia. Silakan coba kembali nanti.</p>
    <span class="unavailable" aria-disabled="true">Aplikasi sementara tidak tersedia</span>
  </main>
</body>
</html>`;

export async function onRequest({ request, env, next }) {
  const hostname = new URL(request.url).hostname.toLowerCase();
  const maintenanceMode = env?.MAINTENANCE_MODE;
  const maintenanceEnabled = maintenanceMode === undefined ||
    String(maintenanceMode).trim().toLowerCase() !== "false";
  if (hostname !== "spas1.my.id" || !maintenanceEnabled) return next();

  return new Response(maintenancePage, {
    status: 503,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}
