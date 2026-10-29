const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const required = [
  'www/index.html', 'www/style.css', 'www/app.js', 'package.json',
  'capacitor.config.json', '.github/workflows/build.yml', 'scripts/copy-libs.js'
];
let failed = false;
for (const relative of required) {
  if (!fs.existsSync(path.join(root, relative))) {
    console.error(`FAIL missing ${relative}`); failed = true;
  } else console.log(`PASS found ${relative}`);
}
const app = fs.readFileSync(path.join(root, 'www/app.js'), 'utf8');
for (const feature of ['processMergePdf', 'processSplitPdf', 'processCompressPdf', 'processPdfToWord', 'processWordToPdf', 'processImageToPdf', 'saveEditedPdf', 'renderViewer']) {
  if (!app.includes(feature)) { console.error(`FAIL missing feature handler ${feature}`); failed = true; }
  else console.log(`PASS found handler ${feature}`);
}
console.log('PASS app.js source scan (the esbuild step validates syntax and bundles imports)');
const workflow = fs.readFileSync(path.join(root, '.github/workflows/build.yml'), 'utf8');
if (!workflow.includes('assembleDebug') || !workflow.includes('upload-artifact@v4')) {
  console.error('FAIL APK build or artifact upload step missing'); failed = true;
} else console.log('PASS APK build and artifact upload steps');
if (failed) process.exit(1);
console.log('All PDF Tools project smoke checks passed.');
