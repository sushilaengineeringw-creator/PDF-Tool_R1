import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

if (window.pdfjsLib) {
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = './lib/pdf.worker.min.js';
}

const TOOL_META = {
  viewer: { title: 'PDF Viewer', icon: '▤', tint: 'blue', description: 'Open a PDF and read its pages in the app.' },
  photo: { title: 'Photo to PDF Maker', icon: '▧', tint: 'green', description: 'Combine photographs and images into one PDF document.' },
  merge: { title: 'Merge PDF', icon: '▤+', tint: 'violet', description: 'Join two or more PDF files in the order you select them.' },
  split: { title: 'Split PDF', icon: '✂', tint: 'orange', description: 'Extract selected pages or page ranges into a separate PDF.' },
  compress: { title: 'Compress PDF', icon: '⇣', tint: 'red', description: 'Reduce file size by converting pages into compressed images.' },
  pdf2word: { title: 'PDF to Word', icon: 'W', tint: 'blue', description: 'Extract selectable PDF text into an editable Word document.' },
  word2pdf: { title: 'Word to PDF', icon: 'P', tint: 'cyan', description: 'Convert a DOCX document or plain text into a PDF.' },
  scan: { title: 'Scan to PDF', icon: '▣', tint: 'teal', description: 'Use your phone camera to capture pages and save them as a PDF.' },
  editor: { title: 'PDF Editor & Sign', icon: '✎', tint: 'pink', description: 'Add a text note or your hand-drawn signature to a PDF.' }
};

function byId(id) { return document.getElementById(id); }
function formatBytes(value) {
  if (!Number.isFinite(value) || value < 0) return '';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(2)} MB`;
}
function cleanBaseName(name) {
  return String(name || 'document').replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 65) || 'document';
}
function showStatus(id, message, type = 'info') {
  const el = byId(id);
  if (!el) return;
  el.className = `status show ${type}`;
  el.textContent = message;
}
function setBusy(buttonId, busy, busyLabel = 'Processing…') {
  const button = byId(buttonId);
  if (!button) return;
  if (busy) {
    button.dataset.originalLabel = button.textContent;
    button.textContent = busyLabel;
    button.disabled = true;
  } else {
    button.textContent = button.dataset.originalLabel || button.textContent;
    button.disabled = false;
  }
}
function requirePdfLibraries() {
  if (!window.PDFLib || !window.pdfjsLib || !window.jspdf || !window.JSZip) {
    throw new Error('A PDF component could not be loaded. Close and reopen the app, or rebuild it from the provided GitHub project ZIP.');
  }
}
function showHome() {
  byId('dashboard').classList.remove('hidden');
  byId('tool-screen').classList.add('hidden');
  byId('tool-screen').innerHTML = '';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function openTool(toolId) {
  const meta = TOOL_META[toolId];
  if (!meta) return;
  byId('dashboard').classList.add('hidden');
  const screen = byId('tool-screen');
  screen.classList.remove('hidden');
  screen.innerHTML = `
    <button class="back-btn" onclick="showHome()">← &nbsp; All PDF tools</button>
    <div class="tool-panel">
      <div class="panel-head"><span class="panel-icon ${meta.tint} tool-icon">${meta.icon}</span><div><span class="small-badge">PDF TOOLS</span><h1>${meta.title}</h1><p>${meta.description}</p></div></div>
      ${toolMarkup(toolId)}
    </div>`;
  setupTool(toolId);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function uploadBlock(id, label, help, accept, multiple = false, capture = '') {
  return `<label class="file-drop" for="${id}"><span class="drop-symbol">⇧</span><span class="drop-title">${label}</span><span class="drop-help">${help}</span><input id="${id}" type="file" accept="${accept}" ${multiple ? 'multiple' : ''} ${capture ? `capture="${capture}"` : ''}></label>`;
}
function toolMarkup(id) {
  switch (id) {
    case 'viewer': return `${uploadBlock('viewer-file', 'Choose a PDF document', 'PDF files supported · Select a file to preview it below', '.pdf')}<div id="viewer-status" class="status"></div><div id="viewer-container" class="viewer-container hidden"></div>`;
    case 'photo': return `${uploadBlock('photo-files', 'Choose photos or images', 'JPG, JPEG, PNG and other browser-supported images · Select multiple pages', 'image/*', true)}<p class="helper" id="photo-count">No images selected yet.</p><button id="photo-run" class="action-btn" onclick="processImageToPdf('photo-files','photos-to-pdf.pdf','photo-status','photo-run')">Create PDF from photos</button><div id="photo-status" class="status"></div>`;
    case 'scan': return `${uploadBlock('scan-files', 'Take photos or choose page images', 'On a phone, choose Camera to capture a page. Select multiple photos for a multi-page scan.', 'image/*', true, 'environment')}<p class="helper">Tip: photograph each page in good light and keep the whole page inside the frame.</p><button id="scan-run" class="action-btn" onclick="processImageToPdf('scan-files','scanned-document.pdf','scan-status','scan-run')">Make scanned PDF</button><div id="scan-status" class="status"></div>`;
    case 'merge': return `${uploadBlock('merge-files', 'Select PDF files to merge', 'Select at least two PDF files. Their selected order is used.', '.pdf', true)}<p class="helper" id="merge-count">Choose two or more PDFs to begin.</p><button id="merge-run" class="action-btn" onclick="processMergePdf()">Merge and save PDF</button><div id="merge-status" class="status"></div>`;
    case 'split': return `${uploadBlock('split-file', 'Choose a PDF to split', 'The original file is not changed.', '.pdf')}<label class="field-label" for="split-pages">Pages to extract</label><input id="split-pages" class="field" placeholder="Example: 1-3, 5, 8-10" autocomplete="off"><p class="helper">Use page numbers starting at 1. Example <b>1-3, 5</b> extracts pages 1, 2, 3 and 5 in one new PDF.</p><button id="split-run" class="action-btn" onclick="processSplitPdf()">Extract pages and save PDF</button><div id="split-status" class="status"></div>`;
    case 'compress': return `${uploadBlock('compress-file', 'Choose a PDF to compress', 'For best results, use a PDF containing scanned pages or photographs.', '.pdf')}<label class="field-label" for="compress-level">Compression level</label><select id="compress-level" class="field"><option value="light">Light · Better clarity</option><option value="medium" selected>Recommended · Balanced size and clarity</option><option value="strong">Strong · Smaller file</option></select><div class="notice">To reduce file size reliably, this tool converts each page to a compressed image. The result will look like the original page, but selectable text, links, forms and accessibility structure will not be preserved. Encrypted PDFs may not work.</div><button id="compress-run" class="action-btn" onclick="processCompressPdf()">Compress and save PDF</button><div id="compress-status" class="status"></div>`;
    case 'pdf2word': return `${uploadBlock('pdf2word-file', 'Choose a PDF document', 'Selectable text is required. Scanned PDFs may need OCR, which this app does not provide.', '.pdf')}<div class="notice">PDF-to-Word extracts text and page breaks; it does not reproduce exact fonts, columns, tables or page layout. Scanned images are not OCR-converted.</div><button id="pdf2word-run" class="action-btn" onclick="processPdfToWord()">Convert to Word (.docx)</button><div id="pdf2word-status" class="status"></div>`;
    case 'word2pdf': return `${uploadBlock('word2pdf-file', 'Choose a Word file or text file', 'Supported: .docx and .txt · DOCX formatting is simplified to readable text.', '.docx,.txt')}<p class="helper">A plain-text PDF will be produced. Complex Word formatting, embedded pictures and tables are not retained.</p><button id="word2pdf-run" class="action-btn" onclick="processWordToPdf()">Convert and save PDF</button><div id="word2pdf-status" class="status"></div>`;
    case 'editor': return `${uploadBlock('editor-file', 'Choose the PDF to edit', 'A new copy will be created; your original stays unchanged.', '.pdf')}<label class="field-label" for="editor-page">Page number</label><input id="editor-page" class="field" type="number" min="1" value="1" inputmode="numeric"><label class="field-label" for="editor-text">Text to add (optional)</label><textarea id="editor-text" class="field" placeholder="Type a note, reference number or label…"></textarea><label class="field-label">Draw signature (optional)</label><canvas id="signature-pad" class="signature-pad" width="720" height="300" aria-label="Draw your signature here"></canvas><div class="signature-actions"><button class="secondary-btn" onclick="clearSignature()">Clear signature</button></div><p class="helper">The text and signature are placed near the bottom of the selected page. This is a basic annotation tool, not a full layout editor.</p><button id="editor-run" class="action-btn" onclick="saveEditedPdf()">Apply and save edited PDF</button><div id="editor-status" class="status"></div>`;
    default: return '<p>Tool not found.</p>';
  }
}
function setupTool(id) {
  if (id === 'viewer') byId('viewer-file').addEventListener('change', renderViewer);
  if (id === 'merge') byId('merge-files').addEventListener('change', () => {
    const n = byId('merge-files').files.length;
    byId('merge-count').textContent = n ? `${n} PDF file(s) selected.` : 'Choose two or more PDFs to begin.';
  });
  if (id === 'photo') byId('photo-files').addEventListener('change', () => updatePhotoCount('photo-files', 'photo-count'));
  if (id === 'scan') byId('scan-files').addEventListener('change', () => updatePhotoCount('scan-files', null));
  if (id === 'editor') setupSignaturePad();
}
function updatePhotoCount(inputId, countId) {
  const files = byId(inputId).files;
  if (countId) byId(countId).textContent = files.length ? `${files.length} image(s) selected · ${formatBytes(Array.from(files).reduce((n, file) => n + file.size, 0))}` : 'No images selected yet.';
}

async function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error(`Could not read ${file.name || 'the selected file'}.`));
    reader.readAsDataURL(file);
  });
}
async function saveOutput(blob, fileName, title = 'Your file is ready') {
  if (Capacitor.isNativePlatform()) {
    try {
      const dataUrl = await readAsDataUrl(blob);
      const base64 = String(dataUrl).split(',')[1];
      const path = `pdf-tools-${Date.now()}-${cleanBaseName(fileName)}.${(fileName.split('.').pop() || 'bin').toLowerCase()}`;
      const saved = await Filesystem.writeFile({ path, data: base64, directory: Directory.Cache, recursive: true });
      const uri = saved.uri || (await Filesystem.getUri({ path, directory: Directory.Cache })).uri;
      await Share.share({ title, text: fileName, url: uri, dialogTitle: 'Save or share your file' });
      return;
    } catch (err) {
      console.error('Native file sharing failed:', err);
      throw new Error('Could not open the Android save/share panel. Please try again or rebuild the APK.');
    }
  }
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
function xmlEscape(text) {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}
function parsePageRanges(spec, pageCount) {
  const text = String(spec || '').trim();
  if (!text) throw new Error('Enter page numbers or a page range, for example 1-3, 5.');
  const selected = new Set();
  for (const raw of text.split(',')) {
    const part = raw.trim();
    if (!part) continue;
    const match = part.match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!match) throw new Error(`Invalid page range: “${part}”. Use values like 1-3, 5.`);
    const first = Number(match[1]);
    const last = Number(match[2] || match[1]);
    if (first < 1 || last < first || last > pageCount) throw new Error(`Page range “${part}” is outside this PDF. It has ${pageCount} page(s).`);
    for (let n = first; n <= last; n++) selected.add(n - 1);
  }
  return Array.from(selected).sort((a, b) => a - b);
}
function pdfTextContent(items) {
  return items.map(item => typeof item.str === 'string' ? item.str : '').filter(Boolean).join(' ').replace(/[ \t]+/g, ' ').trim();
}

async function renderViewer() {
  const file = byId('viewer-file').files[0];
  if (!file) return;
  const container = byId('viewer-container');
  container.classList.remove('hidden');
  container.innerHTML = '<p class="helper">Loading PDF pages…</p>';
  showStatus('viewer-status', `Opening ${file.name} (${formatBytes(file.size)})…`);
  try {
    requirePdfLibraries();
    const pdf = await window.pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    container.innerHTML = '';
    for (let number = 1; number <= pdf.numPages; number++) {
      const page = await pdf.getPage(number);
      const scale = Math.min(1.25, 900 / page.getViewport({ scale: 1 }).width);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const heading = document.createElement('div');
      heading.className = 'helper';
      heading.textContent = `Page ${number} of ${pdf.numPages}`;
      container.appendChild(heading);
      container.appendChild(canvas);
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    }
    showStatus('viewer-status', `Ready · ${pdf.numPages} page(s) rendered.`, 'ok');
  } catch (error) {
    console.error(error);
    showStatus('viewer-status', error.message || 'Could not open this PDF.', 'error');
    container.innerHTML = '';
  }
}

async function processImageToPdf(inputId = 'photo-files', fileName = 'photos-to-pdf.pdf', statusId = 'photo-status', buttonId = 'photo-run') {
  const files = Array.from(byId(inputId)?.files || []);
  if (!files.length) return showStatus(statusId, 'Choose at least one image first.', 'error');
  setBusy(buttonId, true, 'Creating PDF…');
  try {
    requirePdfLibraries();
    let pdf = null;
    const { jsPDF } = window.jspdf;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) continue;
      const data = await readAsDataUrl(file);
      const image = await new Promise((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error(`Could not open image ${file.name}.`));
        el.src = data;
      });
      const landscape = image.naturalWidth > image.naturalHeight;
      const pageW = landscape ? 841.89 : 595.28;
      const pageH = landscape ? 595.28 : 841.89;
      if (!pdf) pdf = new jsPDF({ unit: 'pt', format: [pageW, pageH], compress: true });
      else pdf.addPage([pageW, pageH]);
      const margin = 22;
      const fit = Math.min((pageW - margin * 2) / image.naturalWidth, (pageH - margin * 2) / image.naturalHeight);
      const width = image.naturalWidth * fit;
      const height = image.naturalHeight * fit;
      const mime = file.type === 'image/png' ? 'PNG' : 'JPEG';
      pdf.addImage(data, mime, (pageW - width) / 2, (pageH - height) / 2, width, height, undefined, 'FAST');
    }
    if (!pdf) throw new Error('No supported image files were selected.');
    const blob = pdf.output('blob');
    await saveOutput(blob, fileName, 'PDF created');
    showStatus(statusId, `Done · ${files.length} image(s) added. Output size: ${formatBytes(blob.size)}.`, 'ok');
  } catch (error) {
    console.error(error);
    showStatus(statusId, error.message || 'Could not create the PDF.', 'error');
  } finally { setBusy(buttonId, false); }
}

async function processMergePdf() {
  const files = Array.from(byId('merge-files').files || []);
  if (files.length < 2) return showStatus('merge-status', 'Select at least two PDF files.', 'error');
  setBusy('merge-run', true, 'Merging PDFs…');
  try {
    requirePdfLibraries();
    const merged = await window.PDFLib.PDFDocument.create();
    for (const file of files) {
      const source = await window.PDFLib.PDFDocument.load(await file.arrayBuffer());
      const pages = await merged.copyPages(source, source.getPageIndices());
      pages.forEach(page => merged.addPage(page));
    }
    const bytes = await merged.save({ useObjectStreams: true });
    const blob = new Blob([bytes], { type: 'application/pdf' });
    await saveOutput(blob, 'merged-document.pdf', 'Merged PDF created');
    showStatus('merge-status', `Done · ${files.length} files combined into ${merged.getPageCount()} page(s) · ${formatBytes(blob.size)}.`, 'ok');
  } catch (error) {
    console.error(error);
    showStatus('merge-status', error.message || 'Could not merge these PDFs. Encrypted or damaged files may not be supported.', 'error');
  } finally { setBusy('merge-run', false); }
}

async function processSplitPdf() {
  const file = byId('split-file').files[0];
  if (!file) return showStatus('split-status', 'Choose a PDF first.', 'error');
  setBusy('split-run', true, 'Extracting pages…');
  try {
    requirePdfLibraries();
    const source = await window.PDFLib.PDFDocument.load(await file.arrayBuffer());
    const indices = parsePageRanges(byId('split-pages').value, source.getPageCount());
    const result = await window.PDFLib.PDFDocument.create();
    (await result.copyPages(source, indices)).forEach(page => result.addPage(page));
    const bytes = await result.save({ useObjectStreams: true });
    const blob = new Blob([bytes], { type: 'application/pdf' });
    await saveOutput(blob, `${cleanBaseName(file.name)}-pages.pdf`, 'Extracted PDF created');
    showStatus('split-status', `Done · ${indices.length} page(s) extracted · ${formatBytes(blob.size)}.`, 'ok');
  } catch (error) {
    console.error(error);
    showStatus('split-status', error.message || 'Could not split this PDF.', 'error');
  } finally { setBusy('split-run', false); }
}

async function processCompressPdf() {
  const file = byId('compress-file').files[0];
  if (!file) return showStatus('compress-status', 'Choose a PDF first.', 'error');
  setBusy('compress-run', true, 'Compressing pages…');
  try {
    requirePdfLibraries();
    const settings = {
      light: { scale: 1.55, quality: 0.78 },
      medium: { scale: 1.2, quality: 0.62 },
      strong: { scale: 0.92, quality: 0.44 }
    }[byId('compress-level').value] || { scale: 1.2, quality: 0.62 };
    const source = await window.pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const result = await window.PDFLib.PDFDocument.create();
    for (let n = 1; n <= source.numPages; n++) {
      showStatus('compress-status', `Compressing page ${n} of ${source.numPages}…`);
      const page = await source.getPage(n);
      const natural = page.getViewport({ scale: 1 });
      const scale = Math.min(settings.scale, 2200 / Math.max(natural.width, natural.height));
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.ceil(viewport.width));
      canvas.height = Math.max(1, Math.ceil(viewport.height));
      const context = canvas.getContext('2d', { alpha: false });
      context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: context, viewport }).promise;
      const imageBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', settings.quality));
      if (!imageBlob) throw new Error(`Could not compress page ${n}.`);
      const jpg = await result.embedJpg(await imageBlob.arrayBuffer());
      const outPage = result.addPage([natural.width, natural.height]);
      outPage.drawImage(jpg, { x: 0, y: 0, width: natural.width, height: natural.height });
      canvas.width = 1; canvas.height = 1;
    }
    const bytes = await result.save({ useObjectStreams: true });
    const blob = new Blob([bytes], { type: 'application/pdf' });
    await saveOutput(blob, `${cleanBaseName(file.name)}-compressed.pdf`, 'Compressed PDF created');
    const delta = file.size ? Math.round((1 - blob.size / file.size) * 100) : 0;
    const resultText = delta > 0 ? `File size reduced by about ${delta}%` : `New file is ${Math.abs(delta)}% ${delta < 0 ? 'larger' : 'the same size'}; try Strong compression if appropriate`;
    showStatus('compress-status', `Done · ${formatBytes(file.size)} → ${formatBytes(blob.size)}. ${resultText}. Pages are flattened to images.`, 'ok');
  } catch (error) {
    console.error(error);
    showStatus('compress-status', error.message || 'Could not compress this PDF.', 'error');
  } finally { setBusy('compress-run', false); }
}

async function makeDocx(paragraphs) {
  const zip = new window.JSZip();
  const contentTypes = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>';
  const relationships = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>';
  const body = paragraphs.map(line => `<w:p><w:r><w:t xml:space="preserve">${xmlEscape(line || ' ')}</w:t></w:r></w:p>`).join('');
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>`;
  zip.file('[Content_Types].xml', contentTypes);
  zip.folder('_rels').file('.rels', relationships);
  zip.folder('word').file('document.xml', documentXml);
  return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}
async function processPdfToWord() {
  const file = byId('pdf2word-file').files[0];
  if (!file) return showStatus('pdf2word-status', 'Choose a PDF first.', 'error');
  setBusy('pdf2word-run', true, 'Extracting text…');
  try {
    requirePdfLibraries();
    const pdf = await window.pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const paragraphs = [];
    for (let n = 1; n <= pdf.numPages; n++) {
      showStatus('pdf2word-status', `Extracting text from page ${n} of ${pdf.numPages}…`);
      const page = await pdf.getPage(n);
      const content = await page.getTextContent();
      paragraphs.push(`Page ${n}`);
      const text = pdfTextContent(content.items);
      paragraphs.push(text || '[No selectable text found on this page]');
      paragraphs.push('');
    }
    const blob = await makeDocx(paragraphs);
    await saveOutput(blob, `${cleanBaseName(file.name)}.docx`, 'Word document created');
    showStatus('pdf2word-status', `Done · Text extracted from ${pdf.numPages} page(s) · ${formatBytes(blob.size)}. Layout may differ from the original PDF.`, 'ok');
  } catch (error) {
    console.error(error);
    showStatus('pdf2word-status', error.message || 'Could not convert this PDF to Word.', 'error');
  } finally { setBusy('pdf2word-run', false); }
}
function wrapTextForPdf(pdf, text, maxWidth) {
  const out = [];
  String(text).split(/\r?\n/).forEach(line => {
    if (!line.trim()) { out.push(''); return; }
    out.push(...pdf.splitTextToSize(line, maxWidth));
  });
  return out;
}
async function readDocxText(file) {
  const zip = await window.JSZip.loadAsync(file);
  const entry = zip.file('word/document.xml');
  if (!entry) throw new Error('This does not look like a valid .docx file.');
  const xml = await entry.async('text');
  const xmlDoc = new DOMParser().parseFromString(xml, 'application/xml');
  if (xmlDoc.querySelector('parsererror')) throw new Error('Could not read the Word document XML.');
  const wordNs = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  return Array.from(xmlDoc.getElementsByTagNameNS(wordNs, 'p')).map(paragraph =>
    Array.from(paragraph.getElementsByTagNameNS(wordNs, 't')).map(node => node.textContent || '').join('')
  ).join('\n');
}
async function processWordToPdf() {
  const file = byId('word2pdf-file').files[0];
  if (!file) return showStatus('word2pdf-status', 'Choose a DOCX or TXT file first.', 'error');
  setBusy('word2pdf-run', true, 'Converting document…');
  try {
    requirePdfLibraries();
    let text;
    if (/\.txt$/i.test(file.name) || file.type === 'text/plain') text = await file.text();
    else if (/\.docx$/i.test(file.name) || file.type.includes('wordprocessingml')) text = await readDocxText(file);
    else throw new Error('Please select a .docx or .txt file. Legacy .doc files are not supported.');
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const lines = wrapTextForPdf(pdf, text, pageWidth - 84);
    let y = 46;
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(10.5);
    for (const line of lines) {
      const height = line ? 15 : 8;
      if (y + height > pageHeight - 42) { pdf.addPage(); y = 46; }
      if (line) pdf.text(line, 42, y);
      y += height;
    }
    const blob = pdf.output('blob');
    await saveOutput(blob, `${cleanBaseName(file.name)}.pdf`, 'PDF created');
    showStatus('word2pdf-status', `Done · Converted ${file.name} · ${formatBytes(blob.size)}. Complex formatting and images may not be preserved.`, 'ok');
  } catch (error) {
    console.error(error);
    showStatus('word2pdf-status', error.message || 'Could not convert this file.', 'error');
  } finally { setBusy('word2pdf-run', false); }
}

let signatureDrawing = false;
let signatureHasMarks = false;
function setupSignaturePad() {
  const canvas = byId('signature-pad');
  const ctx = canvas.getContext('2d');
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#17213b'; ctx.lineWidth = 5;
  const point = event => {
    const rect = canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * canvas.width / rect.width, y: (event.clientY - rect.top) * canvas.height / rect.height };
  };
  canvas.onpointerdown = event => { signatureDrawing = true; signatureHasMarks = true; canvas.setPointerCapture(event.pointerId); const p = point(event); ctx.beginPath(); ctx.moveTo(p.x, p.y); event.preventDefault(); };
  canvas.onpointermove = event => { if (!signatureDrawing) return; const p = point(event); ctx.lineTo(p.x, p.y); ctx.stroke(); event.preventDefault(); };
  canvas.onpointerup = canvas.onpointercancel = () => { signatureDrawing = false; };
}
function clearSignature() {
  const canvas = byId('signature-pad');
  if (!canvas) return;
  const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, canvas.width, canvas.height); signatureHasMarks = false; signatureDrawing = false;
}
async function saveEditedPdf() {
  const file = byId('editor-file').files[0];
  if (!file) return showStatus('editor-status', 'Choose a PDF first.', 'error');
  const note = byId('editor-text').value.trim();
  if (!note && !signatureHasMarks) return showStatus('editor-status', 'Enter a note, draw a signature, or do both before saving.', 'error');
  setBusy('editor-run', true, 'Applying changes…');
  try {
    requirePdfLibraries();
    const pdf = await window.PDFLib.PDFDocument.load(await file.arrayBuffer());
    const pageNumber = Number(byId('editor-page').value || 1);
    if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > pdf.getPageCount()) throw new Error(`Enter a page number between 1 and ${pdf.getPageCount()}.`);
    const page = pdf.getPage(pageNumber - 1);
    const size = page.getSize();
    if (note) {
      const text = note.slice(0, 500);
      const lines = text.split(/\r?\n/).slice(0, 8);
      let y = 58;
      for (const line of lines.reverse()) {
        page.drawText(line.slice(0, 100), { x: 38, y, size: 11, color: window.PDFLib.rgb(0.12, 0.18, 0.38), maxWidth: Math.max(90, size.width - 76) });
        y += 14;
      }
    }
    if (signatureHasMarks) {
      const canvas = byId('signature-pad');
      const png = await pdf.embedPng(await (await new Promise(resolve => canvas.toBlob(resolve, 'image/png'))).arrayBuffer());
      const width = Math.min(150, size.width * 0.32);
      const height = width * (canvas.height / canvas.width);
      page.drawImage(png, { x: 38, y: 26, width, height });
    }
    const bytes = await pdf.save({ useObjectStreams: true });
    const blob = new Blob([bytes], { type: 'application/pdf' });
    await saveOutput(blob, `${cleanBaseName(file.name)}-edited.pdf`, 'Edited PDF created');
    showStatus('editor-status', `Done · Notes/signature applied to page ${pageNumber} · ${formatBytes(blob.size)}.`, 'ok');
  } catch (error) {
    console.error(error);
    showStatus('editor-status', error.message || 'Could not edit this PDF.', 'error');
  } finally { setBusy('editor-run', false); }
}

Object.assign(window, {
  showHome,
  openTool,
  processImageToPdf,
  processMergePdf,
  processSplitPdf,
  processCompressPdf,
  processPdfToWord,
  processWordToPdf,
  saveEditedPdf,
  clearSignature
});
