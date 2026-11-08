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

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (!error || typeof error !== "object") return "";
  const value = error as Record<string, unknown>;
  const message = typeof value.message === "string" ? value.message : "";
  const details = typeof value.details === "string" ? value.details : "";
  const hint = typeof value.hint === "string" ? value.hint : "";
  return [message, details, hint].filter(Boolean).join(" ");
}

function allowedOrigins() {
  return (Deno.env.get("APP_ALLOWED_ORIGINS") || "https://spas1.my.id,https://spas1.pages.dev")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

Deno.serve(async (request) => {
  const originHeader = request.headers.get("Origin") || "";
  const origins = allowedOrigins();
  const origin = origins.includes(originHeader) ? originHeader : origins[0];

  if (request.method === "OPTIONS") {
    if (!origins.includes(originHeader)) return new Response(null, { status: 403 });
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405, origin);
  if (!originHeader || !origins.includes(originHeader)) {
    return jsonResponse({ error: "Origin is not allowed." }, 403, origin);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return jsonResponse({ error: "Server authentication is not configured." }, 500, origin);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let input: Record<string, unknown>;
  try {
    input = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON request." }, 400, origin);
  }

  let adminAuthorized = false;
  try {
    if (input.action === "submit") {
      return await submitRegistration(input, request, adminClient, origin);
    }

    const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return jsonResponse({ error: "Login diperlukan." }, 401, origin);
    const userClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser(token);
    if (userError || !user) return jsonResponse({ error: "Sesi login tidak valid." }, 401, origin);

    if (input.action === "attendance") {
      return await recordAttendance(input, user.id, adminClient, origin);
    }
    if (user.app_metadata?.role !== "admin") {
      return jsonResponse({ error: "Hanya SUPER ADMIN yang dapat mengelola permohonan." }, 403, origin);
    }
    adminAuthorized = true;
    if (input.action === "list") return await listRegistrations(adminClient, origin);
    if (input.action === "review") return await reviewRegistration(input, user.id, adminClient, origin);
    return jsonResponse({ error: "Aksi tidak dikenal." }, 400, origin);
  } catch (error) {
    const message = getErrorMessage(error);
    console.error("Volunteer function failed:", message || "Unknown error");
    return jsonResponse({
      error: adminAuthorized && message ? message : "Permintaan gagal.",
    }, 500, origin);
  }
});

async function submitRegistration(
  input: Record<string, unknown>,
  request: Request,
  adminClient: ReturnType<typeof createClient>,
  origin: string,
) {
  const name = String(input.nama || "").trim();
  const volunteerId = String(input.idRelawan || "").trim();
  const contactEmail = String(input.email || "").trim().toLowerCase();
  const phone = String(input.noHp || "").trim();
  const password = String(input.pin || "");
  const confirmation = String(input.pinConfirm || "");
  if (!name || name.length > 150 || !volunteerId || volunteerId.length > 80 ||
      !/^[A-Za-z0-9._-]+$/.test(volunteerId) ||
      contactEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail) ||
      !phone || phone.length > 40 || password.length < 8 || password.length > 128 ||
      password !== confirmation) {
    return jsonResponse({ error: "Data pendaftaran tidak valid. Periksa ID, email, nomor HP, dan PIN minimal 8 karakter." }, 400, origin);
  }

  const turnstileSecret = Deno.env.get("TURNSTILE_SECRET_KEY");
  const turnstileToken = String(input.turnstileToken || "");
  if (!turnstileSecret) {
    return jsonResponse({ error: "Verifikasi keamanan belum dikonfigurasi. Hubungi pengelola aplikasi." }, 503, origin);
  }
  if (!turnstileToken) {
    return jsonResponse({ error: "Selesaikan verifikasi Cloudflare terlebih dahulu." }, 400, origin);
  }
  const verificationBody = new URLSearchParams({
    secret: turnstileSecret,
    response: turnstileToken,
  });
  const remoteIp = request.headers.get("cf-connecting-ip");
  if (remoteIp) verificationBody.set("remoteip", remoteIp);
  const verificationResponse = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: verificationBody,
  });
  if (!verificationResponse.ok) throw new Error("Verifikasi Cloudflare gagal dijangkau.");
  const verification = await verificationResponse.json();
  const originHostname = new URL(origin).hostname;
  const localHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
  const testMode = Deno.env.get("TURNSTILE_TEST_MODE") === "true";
  if (testMode && !localHosts.has(originHostname)) {
    return jsonResponse({ error: "Mode uji Turnstile hanya boleh dipakai dari aplikasi lokal." }, 403, origin);
  }
  const expectedHostname = testMode ? "example.com" : originHostname;
  if (verification.success !== true || verification.hostname !== expectedHostname) {
    return jsonResponse({ error: "Verifikasi keamanan gagal atau sudah kedaluwarsa. Silakan coba lagi." }, 400, origin);
  }

  const authEmail = `${volunteerId}@relawan.spas1.local`.toLowerCase();
  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email: authEmail,
    password,
    email_confirm: false,
    user_metadata: { id_relawan: volunteerId, contact_email: contactEmail },
  });
  if (createError || !created.user) {
    return jsonResponse({ error: createError?.message || "Akun relawan tidak dapat dibuat." }, 409, origin);
  }

  const { error: metadataError } = await adminClient.auth.admin.updateUserById(created.user.id, {
    app_metadata: { role: "employee", id_relawan: volunteerId },
  });
  if (metadataError) {
    await adminClient.auth.admin.deleteUser(created.user.id);
    throw metadataError;
  }

  const requestId = `REG-${crypto.randomUUID()}`;
  const { error: insertError } = await adminClient.from("MODUL1_PendaftaranRelawan").insert({
    "ID Permohonan": requestId,
    "ID Relawan": volunteerId,
    "Auth User ID": created.user.id,
    "Nama Lengkap": name,
    Email: contactEmail,
    "No HP": phone,
    Status: "Menunggu Persetujuan SUPER ADMIN",
    "Diajukan Pada": new Date().toISOString(),
  });
  if (insertError) {
    await adminClient.auth.admin.deleteUser(created.user.id);
    if (insertError.code === "23505") {
      return jsonResponse({ error: "ID Relawan ini sudah terdaftar atau sedang menunggu persetujuan." }, 409, origin);
    }
    throw insertError;
  }
  return jsonResponse({ status: "success", message: "Pendaftaran terkirim. Akun dapat digunakan setelah disetujui SUPER ADMIN." }, 200, origin);
}

async function listRegistrations(
  adminClient: ReturnType<typeof createClient>,
  origin: string,
) {
  const { data, error } = await adminClient
    .from("MODUL1_PendaftaranRelawan")
    .select('"ID Permohonan","ID Relawan","Nama Lengkap",Email,"No HP",Status,"Diajukan Pada"')
    .order("Diajukan Pada", { ascending: false });
  if (error) throw error;
  const registrations = (data || []).map((row) => ({
    requestId: row["ID Permohonan"],
    idRelawan: row["ID Relawan"],
    nama: row["Nama Lengkap"],
    email: row.Email,
    noHp: row["No HP"],
    status: row.Status,
    submittedAt: row["Diajukan Pada"],
  }));
  return jsonResponse({
    status: "success",
    registrations,
    pendingCount: registrations.filter((item) => item.status === "Menunggu Persetujuan SUPER ADMIN").length,
  }, 200, origin);
}

async function reviewRegistration(
  input: Record<string, unknown>,
  adminId: string,
  adminClient: ReturnType<typeof createClient>,
  origin: string,
) {
  const requestId = String(input.requestId || "");
  const decision = input.decision;
  if (!requestId || !["approve", "reject"].includes(String(decision))) {
    return jsonResponse({ error: "Keputusan atau ID permohonan tidak valid." }, 400, origin);
  }
  const pendingStatus = "Menunggu Persetujuan SUPER ADMIN";
  const processingStatus = "Sedang Diproses";
  const { data: requestRow, error: claimError } = await adminClient
    .from("MODUL1_PendaftaranRelawan")
    .update({ Status: processingStatus })
    .eq("ID Permohonan", requestId)
    .eq("Status", pendingStatus)
    .select('*')
    .maybeSingle();
  if (claimError) throw claimError;
  if (!requestRow) {
    return jsonResponse({ error: "Permohonan tidak ditemukan atau sudah diproses." }, 409, origin);
  }

  const authUserId = requestRow["Auth User ID"];
  const status = decision === "approve" ? "Disetujui" : "Ditolak";
  let profileCreated = false;
  try {
    if (!authUserId) throw new Error("ID akun Auth pada permohonan tidak tersedia.");

    if (decision === "approve") {
      const { error: profileError } = await adminClient.from("MODUL1_DataRelawan").insert({
        "ID Relawan": requestRow["ID Relawan"],
        "Auth User ID": authUserId,
        "Nama Lengkap": requestRow["Nama Lengkap"],
        Divisi: "Relawan",
        Role: "employee",
        "Status Biometrik": "Belum diverifikasi",
        "No HP": requestRow["No HP"],
        "Status Akun": "Aktif",
      });
      if (profileError) throw profileError;
      profileCreated = true;
    }

    const { data: updatedRequest, error: requestError } = await adminClient
      .from("MODUL1_PendaftaranRelawan")
      .update({
        Status: status,
        "Diputuskan Pada": new Date().toISOString(),
        "Diputuskan Oleh": adminId,
      })
      .eq("ID Permohonan", requestId)
      .eq("Status", processingStatus)
      .select('"ID Permohonan"')
      .maybeSingle();
    if (requestError) throw requestError;
    if (!updatedRequest) throw new Error("Permohonan berubah saat sedang diproses.");

    if (decision === "approve") {
      const { error: authError } = await adminClient.auth.admin.updateUserById(authUserId, {
        email_confirm: true,
      });
      if (authError) throw authError;
    } else {
      const { error: deleteError } = await adminClient.auth.admin.deleteUser(authUserId);
      if (deleteError) throw deleteError;
    }
  } catch (error) {
    const { error: rollbackError } = await adminClient
      .from("MODUL1_PendaftaranRelawan")
      .update({
        Status: pendingStatus,
        "Diputuskan Pada": null,
        "Diputuskan Oleh": null,
      })
      .eq("ID Permohonan", requestId);
    let profileRollbackError: Error | null = null;
    if (profileCreated) {
      const { error } = await adminClient
        .from("MODUL1_DataRelawan")
        .delete()
        .eq("Auth User ID", authUserId);
      profileRollbackError = error;
    }
    if (rollbackError || profileRollbackError) {
      throw new Error("Proses gagal dan pemulihan data juga gagal. Periksa permohonan di Supabase sebelum mencoba lagi.");
    }
    throw error;
  }
  return jsonResponse({ status: "success", message: `Permohonan berhasil ${decision === "approve" ? "disetujui" : "ditolak"}.` }, 200, origin);
}

async function recordAttendance(
  input: Record<string, unknown>,
  authUserId: string,
  adminClient: ReturnType<typeof createClient>,
  origin: string,
) {
  const attendanceType = String(input.tipe || "");
  if (!["Masuk", "Pulang"].includes(attendanceType)) {
    return jsonResponse({ error: "Jenis absensi tidak valid." }, 400, origin);
  }
  const { data: volunteer, error: profileError } = await adminClient
    .from("MODUL1_DataRelawan")
    .select('"ID Relawan","Nama Lengkap",Divisi,"Status Akun"')
    .eq("Auth User ID", authUserId)
    .eq("Status Akun", "Aktif")
    .maybeSingle();
  if (profileError) throw profileError;
  if (!volunteer) return jsonResponse({ error: "Akun relawan belum aktif atau tidak memiliki profil." }, 403, origin);

  const location = String(input.lokasi || "").slice(0, 200);
  const { error: insertError } = await adminClient.from("MODUL1_Absensi").insert({
    Timestamp: new Date().toISOString(),
    "ID Karyawan": volunteer["ID Relawan"],
    Nama: volunteer["Nama Lengkap"],
    Divisi: volunteer.Divisi || "Relawan",
    "Tipe Absen": attendanceType,
    Jam: new Date().toLocaleTimeString("id-ID"),
    Lokasi: location || "Lokasi tidak tersedia",
    "Status Face": "Tidak diverifikasi",
  });
  if (insertError) throw insertError;
  return jsonResponse({ status: "success", message: "Absensi berhasil disimpan ke Supabase." }, 200, origin);
}
