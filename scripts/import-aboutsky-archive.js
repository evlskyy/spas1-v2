const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');

const bucketName = 'aboutsky-private-archive';
const maxFileSize = 100 * 1024 * 1024;
const folderIds = ['1', '2', '3', '4', '5', '6', '7'];
const extensions = {
  '.pdf': { type: 'pdf', mime: 'application/pdf' },
  '.doc': { type: 'doc', mime: 'application/msword' },
  '.docx': { type: 'doc', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
  '.odt': { type: 'doc', mime: 'application/vnd.oasis.opendocument.text' },
  '.jpg': { type: 'img', mime: 'image/jpeg' },
  '.jpeg': { type: 'img', mime: 'image/jpeg' },
  '.png': { type: 'img', mime: 'image/png' },
  '.gif': { type: 'img', mime: 'image/gif' },
  '.webp': { type: 'img', mime: 'image/webp' },
  '.zip': { type: 'zip', mime: 'application/zip' },
  '.sql': { type: 'sql', mime: 'application/sql' },
  '.csv': { type: 'csv', mime: 'text/csv' }
};

function getFileMetadata(filePath, size) {
  const extension = path.extname(filePath).toLowerCase();
  const metadata = extensions[extension];
  if (!metadata) {
    throw new Error(`Tipe file tidak didukung: ${path.basename(filePath)}`);
  }
  if (size > maxFileSize) {
    throw new Error(`Ukuran file melebihi 100 MB: ${path.basename(filePath)}`);
  }
  if (Buffer.byteLength(path.basename(filePath), 'utf8') > 255) {
    throw new Error(`Nama file melebihi batas 255 byte: ${path.basename(filePath)}`);
  }
  return metadata;
}

async function collectFiles(directory) {
  const files = [];
  async function visit(currentDirectory) {
    const entries = await fs.readdir(currentDirectory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const entryPath = path.join(currentDirectory, entry.name);
      if (entry.isDirectory()) {
        await visit(entryPath);
      } else if (entry.isFile()) {
        const stats = await fs.stat(entryPath);
        files.push({ path: entryPath, size: stats.size });
      }
    }
  }
  await visit(directory);
  return files;
}

function safeFileName(fileName) {
  return fileName.replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 100) || 'file';
}

function encodedStoragePath(storagePath) {
  return storagePath.split('/').map(encodeURIComponent).join('/');
}

async function main() {
  const sourceDirectory = process.argv[2];
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const configuredUrl = process.env.SUPABASE_URL;
  if (!sourceDirectory || !serviceRoleKey || !configuredUrl) {
    throw new Error(
      'Gunakan: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/import-aboutsky-archive.js <folder-ekspor>'
    );
  }

  const supabaseUrl = new URL(configuredUrl);
  if (supabaseUrl.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(supabaseUrl.hostname)) {
    throw new Error('SUPABASE_URL harus menggunakan HTTPS.');
  }
  const resolvedSource = path.resolve(sourceDirectory);
  const sourceStats = await fs.lstat(resolvedSource);
  if (!sourceStats.isDirectory() || sourceStats.isSymbolicLink()) {
    throw new Error('Folder sumber arsip tidak ditemukan.');
  }

  const folders = [];
  let totalFiles = 0;
  for (const folderId of folderIds) {
    const folderPath = path.join(resolvedSource, folderId);
    let folderStats;
    try {
      folderStats = await fs.lstat(folderPath);
    } catch (error) {
      if (error.code === 'ENOENT') continue;
      throw error;
    }
    if (!folderStats.isDirectory() || folderStats.isSymbolicLink()) {
      throw new Error(`Path ${folderId} harus berupa folder biasa.`);
    }
    const files = await collectFiles(folderPath);
    for (const file of files) getFileMetadata(file.path, file.size);
    totalFiles += files.length;
    folders.push({ folderId, folderPath, files });
  }
  if (!totalFiles) {
    throw new Error('Tidak ditemukan file dalam subfolder bernomor 1 sampai 7.');
  }

  const headers = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`
  };
  async function sendRequest(route, options = {}) {
    const response = await fetch(new URL(route, supabaseUrl), {
      ...options,
      headers: { ...headers, ...options.headers }
    });
    if (!response.ok) {
      const message = (await response.text()).slice(0, 500);
      throw new Error(`Supabase request gagal (${response.status}): ${message}`);
    }
    return response;
  }

  let uploaded = 0;
  let skipped = 0;
  for (const { folderId, folderPath, files } of folders) {
    for (let sortOrder = 0; sortOrder < files.length; sortOrder += 1) {
      const file = files[sortOrder];
      const metadata = getFileMetadata(file.path, file.size);
      const relativePath = path.relative(folderPath, file.path).split(path.sep).join('/');
      const content = await fs.readFile(file.path);
      const contentHash = crypto.createHash('sha256').update(content).digest('hex');
      const pathHash = crypto.createHash('sha256').update(relativePath).digest('hex').slice(0, 12);
      const name = path.basename(file.path);
      const storagePath = `${folderId}/${contentHash}-${pathHash}-${safeFileName(name)}`;

      const existingUrl = new URL('/rest/v1/aboutsky_archive_files', supabaseUrl);
      existingUrl.searchParams.set('select', 'id');
      existingUrl.searchParams.set('storage_path', `eq.${storagePath}`);
      const existingResponse = await sendRequest(existingUrl.href);
      const existingRecords = await existingResponse.json();
      if (existingRecords.length) {
        skipped += 1;
        continue;
      }

      const objectRoute = `/storage/v1/object/${bucketName}/${encodedStoragePath(storagePath)}`;
      await sendRequest(objectRoute, {
        method: 'POST',
        headers: { 'Content-Type': metadata.mime, 'x-upsert': 'true' },
        body: content
      });

      try {
        await sendRequest('/rest/v1/aboutsky_archive_files', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Prefer: 'return=minimal'
          },
          body: JSON.stringify({
            folder_id: Number(folderId),
            name,
            file_type: metadata.type,
            description: '',
            file_size: file.size,
            storage_path: storagePath,
            sort_order: sortOrder
          })
        });
      } catch (error) {
        try {
          await sendRequest(`/storage/v1/object/${bucketName}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prefixes: [storagePath] })
          });
        } catch (cleanupError) {
          console.error(`Pembersihan objek gagal untuk ${storagePath}:`, cleanupError.message);
        }
        throw error;
      }
      uploaded += 1;
      console.log(`Folder ${folderId}: ${name} berhasil diimpor.`);
    }
  }

  console.log(`Selesai. ${uploaded} file diunggah; ${skipped} file sudah ada.`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  });
}

module.exports = { getFileMetadata };
