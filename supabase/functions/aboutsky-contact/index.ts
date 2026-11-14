import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = (origin: string) => ({
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
});

const jsonResponse = (body: unknown, status: number, origin: string) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json; charset=utf-8" },
  });

function allowedOrigins() {
  const configured = Deno.env.get("ABOUTSKY_ALLOWED_ORIGINS") || "https://spas1.my.id,https://spas1.pages.dev";
  const origins = configured
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  return origins.length ? origins : ["https://spas1.my.id"];
}

function isLocalDevelopmentOrigin(origin: string) {
  try {
    const url = new URL(origin);
    return url.origin === origin &&
      ["http:", "https:"].includes(url.protocol) &&
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  } catch {
    return false;
  }
}

function textField(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getClientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return request.headers.get("cf-connecting-ip")?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    forwarded ||
    "";
}

async function hashIp(ip: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(ip)),
  );
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (request) => {
  const originHeader = request.headers.get("Origin") || "";
  const origins = allowedOrigins();
  const originAllowed = origins.includes(originHeader) || isLocalDevelopmentOrigin(originHeader);
  const responseOrigin = originAllowed ? originHeader : origins[0];

  if (request.method === "OPTIONS") {
    if (!originAllowed) return new Response(null, { status: 403 });
    return new Response(null, { status: 204, headers: corsHeaders(responseOrigin) });
  }
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405, responseOrigin);
  }
  if (!originHeader || !originAllowed) {
    return jsonResponse({ error: "Origin is not allowed." }, 403, responseOrigin);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Server authentication is not configured." }, 500, responseOrigin);
  }

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 12000) {
    return jsonResponse({ error: "Pesan terlalu besar." }, 413, responseOrigin);
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return jsonResponse({ error: "Request tidak dapat dibaca." }, 400, responseOrigin);
  }
  if (new TextEncoder().encode(rawBody).length > 12000) {
    return jsonResponse({ error: "Pesan terlalu besar." }, 413, responseOrigin);
  }

  let input: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(rawBody);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return jsonResponse({ error: "Format request tidak valid." }, 400, responseOrigin);
    }
    input = parsed as Record<string, unknown>;
  } catch {
    return jsonResponse({ error: "Format JSON tidak valid." }, 400, responseOrigin);
  }

  const name = textField(input.name);
  const email = textField(input.email).toLowerCase();
  const subject = textField(input.subject);
  const message = textField(input.message);
  if (
    name.length < 1 || name.length > 150 ||
    email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    subject.length < 1 || subject.length > 200 ||
    message.length < 1 || message.length > 5000
  ) {
    return jsonResponse({ error: "Data kontak tidak valid. Periksa nama, email, subjek, dan pesan." }, 400, responseOrigin);
  }
  if (textField(input.website)) {
    return jsonResponse({ error: "Permintaan ditolak." }, 400, responseOrigin);
  }

  const clientIp = getClientIp(request);
  if (!clientIp) {
    return jsonResponse({ error: "Layanan pembatasan pesan belum tersedia. Silakan coba lagi nanti." }, 503, responseOrigin);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const ipHash = await hashIp(clientIp, serviceRoleKey);
    const { data: allowed, error: rateLimitError } = await adminClient.rpc(
      "aboutsky_allow_contact",
      { p_ip_hash: ipHash },
    );
    if (rateLimitError) {
      console.error("AboutSky rate-limit check failed:", rateLimitError.message);
      return jsonResponse({ error: "Layanan kontak belum siap. Silakan coba lagi nanti." }, 503, responseOrigin);
    }
    if (allowed !== true) {
      return jsonResponse({ error: "Batas pengiriman tercapai. Coba lagi dalam satu jam." }, 429, responseOrigin);
    }

    const { error: insertError } = await adminClient
      .from("aboutsky_contact_messages")
      .insert({ name, email, subject, message });
    if (insertError) {
      console.error("AboutSky contact insert failed:", insertError.message);
      return jsonResponse({ error: "Pesan gagal disimpan. Silakan coba lagi nanti." }, 500, responseOrigin);
    }
  } catch (error) {
    console.error("AboutSky contact request failed:", error instanceof Error ? error.message : "Unknown error");
    return jsonResponse({ error: "Pesan gagal diproses. Silakan coba lagi nanti." }, 500, responseOrigin);
  }

  return jsonResponse({
    status: "success",
    message: "Pesan berhasil dikirim! Saya akan membalas dalam 1x24 jam.",
  }, 200, responseOrigin);
});
