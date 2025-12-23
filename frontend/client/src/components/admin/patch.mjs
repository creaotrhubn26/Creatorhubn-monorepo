import fs from 'node:fs';

const file = process.argv[2];
if (!file || !fs.existsSync(file)) {
  console.error('Usage: node patch.mjs <path-to-Creatorhubnotesnew.tsx>');
  process.exit(1);
}

let src = fs.readFileSync(file, 'utf8');
const before = src;

function insertQuillImportOnce(code) {
  if (code.includes("from './notes/constants'")) return code;
  const lines = code.split('\n');
  let lastImport = -1;
  for (let i = 0; i < lines.length; i++) if (/^\s*import\s/.test(lines[i])) lastImport = i;
  if (lastImport >= 0) {
    lines.splice(lastImport + 1, 0, "import { quillModules, quillFormats, EMPTY_HTML } from './notes/constants';");
    return lines.join('\n');
  }
  return "import { quillModules, quillFormats, EMPTY_HTML } from './notes/constants';\n" + code;
}
function rm(pattern) { src = src.replace(new RegExp(pattern, 'gs'), ''); }
function ensureGuard(funcName, retValue) {
  const re = new RegExp(`function\\s+${funcName}\\s*\\(([^)]*)\\)\\s*{`);
  src = src.replace(re, (m) => {
    const body = src.slice(src.indexOf(m), src.indexOf(m) + 400);
    if (body.includes('typeof document')) return m;
    return `${m}\n  if (typeof document === 'undefined') ${retValue};`;
  });
}

// 1) Import shared Quill constants & remove local duplicates
src = insertQuillImportOnce(src);
rm(String.raw`const\s+quillModules\s*=\s*{[\s\S]*?};\s*`);
rm(String.raw`const\s+quillFormats\s*=\s*\[[\s\S]*?];\s*`);
rm(String.raw`const\s+EMPTY_HTML\s*=\s*['"` + '`' + String.raw`][\s\S]*?['"` + '`' + String.raw`];\s*`);

// 2) SSR guards
ensureGuard('buildTOCFromHTML', 'return []');
ensureGuard('injectHeaderIds', 'return html');
ensureGuard('buildSectionsFromHTML', 'return [{ id: "doc", level: 1, title: "Document", html }]');

// 3) Clear stale doc state on failed PDF upload
src = src.replace(
  /catch\s*\(\s*[^)]*\s*\)\s*{\s*([^}]*)setSnack\(\{[^}]+\}\);/s,
  (m) => m.includes('setDocHTML(')
    ? m
    : m.replace('setSnack({', `setDocHTML('');\n    setDocTOC([]);\n    setDocSections([]);\n    setSnack({`)
);

// 4) Rename destructured `performance` → `perf` and refs
src = src.replace(/(\{\s*[^}]*?)\bperformance\b\s*,/s, (m) => m.replace(/\bperformance\b/, 'performance: perf'));
src = src.replace(/([^A-Za-z0-9_])performance\./g, '$1perf.');

// 5) Clipboard awaits
src = src.replace(/const\s+copyCodeBlocks\s*=\s*\(\)\s*=>\s*{/, 'const copyCodeBlocks = async () => {');
src = src.replace(/navigator\.clipboard\.writeText\(/g, 'await navigator.clipboard.writeText(');

// 6) Preview uses EMPTY_HTML fallback
src = src.replace(
  /dangerouslySetInnerHTML\s*=\s*\{\s*\{\s*__html:\s*DOMPurify\.sanitize\(\s*editorHTML\s*\)\s*\}\s*\}/g,
  'dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(editorHTML || EMPTY_HTML) }}'
);

if (src !== before) {
  fs.writeFileSync(file + '.bak', before);
  fs.writeFileSync(file, src);
  console.log('Patched:', file, '(backup at ' + file + '.bak)');
} else {
  console.log('No changes needed for', file);
}
