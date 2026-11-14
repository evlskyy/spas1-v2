import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const bucketName = "aboutsky-private-archive";
const signedUrlLifetimeSeconds = 600;

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
  const origins = configured.split(",").map((origin) => origin.trim()).filter(Boolean);
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

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (!error || typeof error !== "object") return "";
  const value = error as Record<string, unknown>;
  return typeof value.message === "string" ? value.message : "";
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function logArchiveAccess(
  adminClient: ReturnType<typeof createClient>,
  userId: string | null,
  folderId: number | null,
  result: "granted" | "denied",
) {
  const { error } = await adminClient.from("aboutsky_archive_access_logs").insert({
    auth_user_id: userId,
    folder_id: folderId,
    result,
  });
  if (error) throw error;
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
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return jsonResponse({ error: "Server authentication is not configured." }, 500, responseOrigin);
  }

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 4000) {
    return jsonResponse({ error: "Request terlalu besar." }, 413, responseOrigin);
  }

  let input: Record<string, unknown>;
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).length > 4000) {
      return jsonResponse({ error: "Request terlalu besar." }, 413, responseOrigin);
    }
    const parsed: unknown = JSON.parse(rawBody);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return jsonResponse({ error: "Format request tidak valid." }, 400, responseOrigin);
    }
    input = parsed as Record<string, unknown>;
  } catch {
    return jsonResponse({ error: "Format JSON tidak valid." }, 400, responseOrigin);
  }

  const folderId = Number(input.folderId);
  if (!Number.isInteger(folderId) || folderId < 1 || folderId > 7) {
    return jsonResponse({ error: "Folder arsip tidak valid." }, 400, responseOrigin);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!token) {
    try {
      await logArchiveAccess(adminClient, null, folderId, "denied");
    } catch (error) {
      console.error("AboutSky denied-access log failed:", getErrorMessage(error) || "Unknown error");
    }
    return jsonResponse({ error: "Login SUPER ADMIN diperlukan." }, 401, responseOrigin);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: { user }, error: userError } = await userClient.auth.getUser(token);
  if (userError || !user) {
    try {
      await logArchiveAccess(adminClient, null, folderId, "denied");
    } catch (error) {
      console.error("AboutSky denied-access log failed:", getErrorMessage(error) || "Unknown error");
    }
    return jsonResponse({ error: "Sesi login tidak valid. Masuk kembali dengan akun SUPER ADMIN SPAS1." }, 401, responseOrigin);
  }
  if (user.app_metadata?.role !== "admin") {
    try {
      await logArchiveAccess(adminClient, user.id, folderId, "denied");
    } catch (error) {
      console.error("AboutSky denied-access log failed:", getErrorMessage(error) || "Unknown error");
    }
    return jsonResponse({ error: "Arsip hanya dapat dibuka oleh SUPER ADMIN SPAS1." }, 403, responseOrigin);
  }

  try {
    const { data: folder, error: folderError } = await adminClient
      .from("aboutsky_archive_folders")
      .select("id,title,icon")
      .eq("id", folderId)
      .maybeSingle();
    if (folderError) throw folderError;
    if (!folder) {
      await logArchiveAccess(adminClient, user.id, folderId, "denied");
      return jsonResponse({ error: "Folder arsip tidak ditemukan." }, 404, responseOrigin);
    }

    const { data: records, error: filesError } = await adminClient
      .from("aboutsky_archive_files")
      .select("name,file_type,description,file_size,storage_path")
      .eq("folder_id", folderId)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true })
      .limit(100);
    if (filesError) throw filesError;

    const files = await Promise.all((records || []).map(async (record) => {
      const { data: signedFile, error: signError } = await adminClient.storage
        .from(bucketName)
        .createSignedUrl(record.storage_path, signedUrlLifetimeSeconds);
      if (signError || !signedFile?.signedUrl) {
        throw signError || new Error("Tautan file privat tidak dapat dibuat.");
      }
      const { data: downloadableFile, error: downloadError } = await adminClient.storage
        .from(bucketName)
        .createSignedUrl(record.storage_path, signedUrlLifetimeSeconds, { download: true });
      if (downloadError || !downloadableFile?.signedUrl) {
        throw downloadError || new Error("Tautan unduhan file privat tidak dapat dibuat.");
      }
      return {
        name: record.name,
        type: record.file_type,
        desc: record.description,
        size: formatFileSize(Number(record.file_size)),
        link: new URL(signedFile.signedUrl, supabaseUrl).href,
        downloadLink: new URL(downloadableFile.signedUrl, supabaseUrl).href,
      };
    }));

    await logArchiveAccess(adminClient, user.id, folderId, "granted");
    return jsonResponse({
      success: true,
      folder,
      files,
      message: files.length
        ? "Akses arsip diberikan. Tautan file berlaku selama 10 menit."
        : "Login berhasil, tetapi file folder ini belum dipindahkan ke Supabase Storage.",
    }, 200, responseOrigin);
  } catch (error) {
    console.error("AboutSky archive request failed:", getErrorMessage(error) || "Unknown error");
    return jsonResponse({ error: "Arsip belum dapat dimuat. Silakan coba lagi nanti." }, 500, responseOrigin);
  }
});
