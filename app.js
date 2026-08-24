const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const browseButton = document.getElementById('browseButton');
const toast = document.getElementById('toast');
const recentList = document.getElementById('recentList');

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove('show'), 2800);
}

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function analyzeFile(file) {
  if (!file) return;
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  const isImage = file.type.startsWith('image/');
  if (!isPdf && !isImage) {
    showToast('Please choose a PDF or image file.');
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    showToast('That file is over the 10 MB limit.');
    return;
  }

  const panel = document.getElementById('resultPanel');
  const title = document.getElementById('resultTitle');
  const type = document.getElementById('analysisType');
  const extracted = document.getElementById('extractedText');
  panel.classList.add('is-loading');
  title.textContent = `Reading ${file.name}`;
  type.textContent = isPdf ? 'PDF · EXTRACTING TEXT' : 'IMAGE · RUNNING OCR';
  extracted.textContent = 'Signalroom is reading your content and looking for the moments that make people pause...';
  showToast(`${isPdf ? 'Extracting text' : 'Running OCR'} from ${file.name} (${formatBytes(file.size)})`);

  window.setTimeout(() => {
    panel.classList.remove('is-loading');
    title.textContent = file.name.replace(/\.[^/.]+$/, '');
    type.textContent = isPdf ? 'PDF · TEXT EXTRACTED' : 'IMAGE · OCR COMPLETE';
    extracted.textContent = isPdf
      ? 'Your content has been extracted and is ready for a clarity, hook, and call-to-action review.'
      : 'Your image text has been recognized. We found a clear message with room to sharpen the final action.';
    document.getElementById('scoreValue').textContent = isPdf ? '84' : '78';
    showToast('Analysis complete. Your insights are ready.');
    addRecent(file, isPdf ? 'PDF' : 'IMG');
  }, 1600);
}

function addRecent(file, kind) {
  const item = document.createElement('article');
  item.className = 'recent-item';
  item.innerHTML = `<span class="file-icon ${kind === 'PDF' ? 'pdf' : 'image'}">${kind}</span><div><b>${file.name}</b><small>Analyzed just now · new score</small></div><span class="item-arrow">→</span>`;
  recentList.prepend(item);
}

browseButton.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('click', (event) => {
  if (event.target !== browseButton) fileInput.click();
});
dropZone.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') fileInput.click();
});
fileInput.addEventListener('change', () => analyzeFile(fileInput.files[0]));
['dragenter', 'dragover'].forEach((eventName) => dropZone.addEventListener(eventName, (event) => {
  event.preventDefault();
  dropZone.classList.add('dragging');
}));
['dragleave', 'drop'].forEach((eventName) => dropZone.addEventListener(eventName, (event) => {
  event.preventDefault();
  dropZone.classList.remove('dragging');
}));
dropZone.addEventListener('drop', (event) => analyzeFile(event.dataTransfer.files[0]));

document.getElementById('copyText').addEventListener('click', async () => {
  await navigator.clipboard?.writeText(document.getElementById('extractedText').textContent);
  showToast('Extracted text copied.');
});
document.getElementById('clearRecent').addEventListener('click', () => {
  recentList.innerHTML = '<p class="empty-state">No recent analyses yet.</p>';
  showToast('Recent analyses cleared.');
});
document.querySelectorAll('.apply-button').forEach((button) => button.addEventListener('click', () => {
  button.textContent = `${button.dataset.action} ✓`;
  button.disabled = true;
  showToast(`Suggestion ${button.dataset.action.toLowerCase()}.`);
}));
