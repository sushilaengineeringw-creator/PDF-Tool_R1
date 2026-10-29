const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'www', 'lib');
fs.mkdirSync(out, { recursive: true });

const files = [
  ['pdf-lib/dist/pdf-lib.min.js', 'pdf-lib.min.js'],
  ['pdfjs-dist/build/pdf.min.js', 'pdf.min.js'],
  ['pdfjs-dist/build/pdf.worker.min.js', 'pdf.worker.min.js'],
  ['jspdf/dist/jspdf.umd.min.js', 'jspdf.umd.min.js'],
  ['jszip/dist/jszip.min.js', 'jszip.min.js']
];

for (const [source, target] of files) {
  const sourcePath = path.join(root, 'node_modules', source);
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Required browser library was not found: ${sourcePath}`);
  }
  fs.copyFileSync(sourcePath, path.join(out, target));
  console.log(`Bundled ${target}`);
}
