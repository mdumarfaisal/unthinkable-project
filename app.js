const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const browseButton = document.getElementById('browseButton');
const toast = document.getElementById('toast');
const recentList = document.getElementById('recentList');
const progressSteps = document.getElementById('progressSteps');
let analyzedText = document.getElementById('extractedText').textContent;
const analyzeEndpoint = window.location.port === '4173'
  ? 'http://127.0.0.1:5000/analyze'
  : '/analyze';
const recentStorageKey = 'signalroom-recent-analyses';

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

async function analyzeFile(file) {
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
  setProgress('Upload');
  title.textContent = `Reading ${file.name}`;
  type.textContent = isPdf ? 'PDF · EXTRACTING TEXT' : 'IMAGE · RUNNING OCR';
  extracted.textContent = 'Signalroom is reading your content and looking for the moments that make people pause...';
  showToast(`${isPdf ? 'Extracting text' : 'Running OCR'} from ${file.name} (${formatBytes(file.size)})`);

  try {
    setProgress('Extract');
    const response = await fetch(analyzeEndpoint, {
      method: 'POST',
      body: (() => {
        const formData = new FormData();
        formData.append('file', file);
        return formData;
      })(),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Analysis failed.');
    setProgress('Score');
    panel.classList.remove('is-loading');
    title.textContent = result.filename.replace(/\.[^/.]+$/, '');
    type.textContent = result.kind === 'PDF' ? 'PDF · TEXT EXTRACTED' : 'IMAGE · OCR COMPLETE';
    extracted.textContent = result.text;
    analyzedText = result.text;
    document.getElementById('wordCount').textContent = result.summary.words;
    document.getElementById('readingTime').textContent = result.summary.reading_seconds;
    document.getElementById('hashtagCount').textContent = result.summary.hashtags;
    const preview = document.getElementById('uploadedPreview');
    if (isImage) {
      preview.src = URL.createObjectURL(file);
      preview.hidden = false;
    } else {
      preview.hidden = true;
    }
    document.getElementById('scoreValue').textContent = result.score;
    document.querySelector('.score-copy b').textContent = result.score >= 80 ? 'Strong foundation' : 'Room to grow';
    document.querySelector('.score-copy p').textContent = result.score >= 80
      ? 'Your voice is clear and the hook lands. A sharper close could help more people take the next step.'
      : 'The core message is here. A stronger opening and clearer next step can help it travel further.';
    document.querySelectorAll('.metric b')[0].textContent = result.metrics.hook;
    document.querySelectorAll('.metric b')[1].textContent = result.metrics.clarity;
    document.querySelectorAll('.metric b')[2].textContent = result.metrics.cta;
    document.querySelectorAll('.metric-bar i')[0].style.width = `${result.metrics.hook}%`;
    document.querySelectorAll('.metric-bar i')[1].style.width = `${result.metrics.clarity}%`;
    document.querySelectorAll('.metric-bar i')[2].style.width = `${result.metrics.cta}%`;
    updateRecommendations(result.recommendations);
    showToast('Analysis complete. Your insights are ready.');
    setProgress('Ready');
    addRecent(file, result.kind, result.score);
  } catch (error) {
    panel.classList.remove('is-loading');
    type.textContent = 'ANALYSIS UNAVAILABLE';
    showToast(error.message);
  }
}

function setProgress(activeStep) {
  const order = ['Upload', 'Extract', 'Score', 'Ready'];
  progressSteps.querySelectorAll('span').forEach((step) => {
    step.classList.toggle('active', order.indexOf(step.textContent) <= order.indexOf(activeStep));
  });
}

function showSample() {
  const result = {
    filename: 'sample-launch-post', kind: 'PDF', score: 84,
    text: 'We spent six months building the thing we wished existed. Today, Signalroom is live. Less guessing, more knowing. Tell us what you think ↓',
    metrics: { hook: 92, clarity: 88, cta: 61 },
    recommendations: [
      { title: 'Make the next step specific', body: 'Ask readers to share one thing they would use first.', label: 'QUICK WIN' },
      { title: 'Lead with the reader’s payoff', body: 'Move the clearest benefit up front so the value lands sooner.', label: 'MORE CLARITY' },
      { title: 'Try a conversation starter', body: 'Invite a point of view with a focused question to create replies.', label: 'EXPERIMENT' },
    ],
  };
  document.getElementById('resultTitle').textContent = result.filename;
  document.getElementById('analysisType').textContent = 'SAMPLE · TEXT EXTRACTED';
  document.getElementById('extractedText').textContent = result.text;
  analyzedText = result.text;
  const sampleWords = result.text.match(/\b\w+\b/g)?.length || 0;
  document.getElementById('wordCount').textContent = sampleWords;
  document.getElementById('readingTime').textContent = Math.max(1, Math.round(sampleWords / 3.3));
  document.getElementById('hashtagCount').textContent = (result.text.match(/#[A-Za-z0-9_]+/g) || []).length;
  document.getElementById('uploadedPreview').hidden = true;
  document.getElementById('scoreValue').textContent = result.score;
  document.querySelectorAll('.metric b')[0].textContent = result.metrics.hook;
  document.querySelectorAll('.metric b')[1].textContent = result.metrics.clarity;
  document.querySelectorAll('.metric b')[2].textContent = result.metrics.cta;
  document.querySelectorAll('.metric-bar i')[0].style.width = `${result.metrics.hook}%`;
  document.querySelectorAll('.metric-bar i')[1].style.width = `${result.metrics.clarity}%`;
  document.querySelectorAll('.metric-bar i')[2].style.width = `${result.metrics.cta}%`;
  updateRecommendations(result.recommendations);
  setProgress('Ready');
  showToast('Sample analysis loaded.');
}

function updateRecommendations(recommendations) {
  const fallback = [{
    title: 'Keep the conversation moving',
    body: 'Your post is already well-structured. Test a second closing question to invite more replies.',
    label: 'EXPERIMENT',
  }];
  document.querySelectorAll('.recommendation').forEach((card, index) => {
    const recommendation = recommendations[index] || fallback[index] || fallback[0];
    card.querySelector('.priority').textContent = recommendation.label;
    card.querySelector('h3').textContent = recommendation.title;
    card.querySelector('p').textContent = recommendation.body;
  });
}

function addRecent(file, kind, score) {
  const item = document.createElement('article');
  item.className = 'recent-item';
  item.innerHTML = `<span class="file-icon ${kind === 'PDF' ? 'pdf' : 'image'}">${kind}</span><div><b>${file.name}</b><small>Analyzed just now · ${score} score</small></div><span class="item-arrow">→</span>`;
  recentList.prepend(item);
  const recent = JSON.parse(localStorage.getItem(recentStorageKey) || '[]');
  recent.unshift({ name: file.name, kind, score });
  localStorage.setItem(recentStorageKey, JSON.stringify(recent.slice(0, 8)));
}

function restoreRecent() {
  const recent = JSON.parse(localStorage.getItem(recentStorageKey) || '[]');
  recent.forEach((entry) => {
    const item = document.createElement('article');
    item.className = 'recent-item';
    item.innerHTML = `<span class="file-icon ${entry.kind === 'PDF' ? 'pdf' : 'image'}">${entry.kind}</span><div><b>${entry.name}</b><small>Previous analysis · ${entry.score} score</small></div><span class="item-arrow">→</span>`;
    recentList.appendChild(item);
  });
}

browseButton.addEventListener('click', () => fileInput.click());
document.getElementById('sampleButton').addEventListener('click', showSample);
dropZone.addEventListener('click', (event) => {
  if (!event.target.closest('button')) fileInput.click();
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
  localStorage.removeItem(recentStorageKey);
  showToast('Recent analyses cleared.');
});
document.querySelectorAll('.apply-button').forEach((button) => button.addEventListener('click', () => {
  const title = button.closest('.recommendation').querySelector('h3').textContent;
  if (button.dataset.action === 'Applied') {
    const text = analyzedText.replace(/\s+/g, ' ').trim();
    if (title.includes('next step')) {
      analyzedText = `${text.replace(/[.!?]?\s*$/, '')}. Share one thing you would use first.`;
    } else if (title.includes('payoff')) {
      analyzedText = `Less guessing, more knowing. ${text}`;
    } else {
      analyzedText = `${text.replace(/[.!?]?\s*$/, '')}. What would you use first?`;
    }
    document.getElementById('extractedText').textContent = analyzedText;
    document.getElementById('scoreValue').textContent = Math.min(99, Number(document.getElementById('scoreValue').textContent) + 5);
    document.querySelector('.metric-bar.warm i').style.width = '82%';
    document.querySelectorAll('.metric b')[2].textContent = '82';
  }
  button.textContent = `${button.dataset.action} ✓`;
  button.disabled = true;
  showToast(button.dataset.action === 'Applied' ? 'Caption updated with your suggestion.' : 'Suggestion saved.');
}));

restoreRecent();
