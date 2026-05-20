/**
 * Post-build script: extracts inline script contents from all HTML files in dist,
 * computes SHA-256 hashes, and writes a CSP header to dist/_headers.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DIST_DIR = path.join(__dirname, '..', 'dist');
const HEADERS_FILE = path.join(DIST_DIR, '_headers');

function findHtmlFiles(dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      findHtmlFiles(fullPath, files);
    } else if (entry.name.endsWith('.html')) {
      files.push(fullPath);
    }
  }
  return files;
}

function extractInlineScriptHashes(htmlContent) {
  const hashes = new Set();
  // Match <script> tags that do NOT have a src attribute
  const regex = /<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = regex.exec(htmlContent)) !== null) {
    const content = match[1];
    if (content.trim()) {
      const hash = crypto.createHash('sha256').update(content).digest('base64');
      hashes.add(`'sha256-${hash}'`);
    }
  }
  return hashes;
}

function main() {
  if (!fs.existsSync(DIST_DIR)) {
    console.error('dist/ directory not found. Run `next build` first.');
    process.exit(1);
  }

  const htmlFiles = findHtmlFiles(DIST_DIR);
  const allHashes = new Set();

  for (const file of htmlFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    const hashes = extractInlineScriptHashes(content);
    for (const h of hashes) allHashes.add(h);
  }

  const hashList = Array.from(allHashes).join(' ');

  const headers = `/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Content-Security-Policy: default-src 'self'; script-src 'self' ${hashList} https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; connect-src 'self' https://api.github.com https://cloudflareinsights.com; img-src 'self' https: data:; font-src 'self' https://fonts.gstatic.com;
`;

  fs.writeFileSync(HEADERS_FILE, headers);
  console.log(`Wrote ${HEADERS_FILE} with ${allHashes.size} script hash(es)`);
}

main();
