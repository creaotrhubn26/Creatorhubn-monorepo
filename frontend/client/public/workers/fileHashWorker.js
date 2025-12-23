// File hashing Web Worker for deduplication
// Handles SHA-256 hashing of files without blocking the main thread

self.onmessage = async function (e) {
  const { file, action } = e.data;

  if (action === 'hash') {
    try {
      const hash = await hashFile(file);
      self.postMessage({ hash });
    } catch (error) {
      self.postMessage({ error: error.message });
    }
  }
};

async function hashFile(file) {
  const chunkSize = 1024 * 1024; // 1MB chunks
  const totalChunks = Math.ceil(file.size / chunkSize);

  const hash = await crypto.subtle.digest('SHA-256', new Uint8Array());
  const hashArray = Array.from(new Uint8Array(hash));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

  // For large files, process in chunks to avoid memory issues
  if (file.size > 10 * 1024 * 1024) {
    // 10MB+
    let combinedHash = '';

    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, file.size);
      const chunk = file.slice(start, end);

      const arrayBuffer = await chunk.arrayBuffer();
      const chunkHash = await crypto.subtle.digest('SHA-256', arrayBuffer);
      const chunkArray = Array.from(new Uint8Array(chunkHash));
      const chunkHex = chunkArray.map((b) => b.toString(16).padStart(2, '0')).join('');

      combinedHash += chunkHex;
    }

    // Hash the combined chunk hashes for final hash
    const finalBuffer = new TextEncoder().encode(combinedHash);
    const finalHash = await crypto.subtle.digest('SHA-256', finalBuffer);
    const finalArray = Array.from(new Uint8Array(finalHash));
    return finalArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  } else {
    // For smaller files, hash directly
    const arrayBuffer = await file.arrayBuffer();
    const hash = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hash));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
}
