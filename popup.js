let activeVideoData = null;
let currentMode = 'summary';
let generatedText = '';

const notYtView = document.getElementById('not-yt-view');
const settingsView = document.getElementById('settings-view');
const mainWorkspace = document.getElementById('main-workspace');

const videoTitleEl = document.getElementById('video-title');
const btnSettings = document.getElementById('btn-settings');
const apiKeyInput = document.getElementById('api-key-input');
const btnSaveKey = document.getElementById('btn-save-key');
const btnCloseSettings = document.getElementById('btn-close-settings');

const modeTabs = document.querySelectorAll('.mode-tab');
const btnGenerate = document.getElementById('btn-generate');
const generateBtnText = document.getElementById('generate-btn-text');
const outputBox = document.getElementById('output-box');
const btnCopyOutput = document.getElementById('btn-copy-output');
const btnDlOutput = document.getElementById('btn-dl-output');

document.addEventListener('DOMContentLoaded', async () => {
  await loadApiKey();
  await initTab();
  setupEventListeners();
});

async function loadApiKey() {
  const result = await chrome.storage.local.get(['gemini_api_key']);
  if (result.gemini_api_key) {
    apiKeyInput.value = result.gemini_api_key;
  }
}

async function initTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url || (!tab.url.includes('youtube.com/watch') && !tab.url.includes('youtube.com/shorts/'))) {
    notYtView.style.display = 'flex';
    mainWorkspace.style.display = 'none';
    return;
  }

  notYtView.style.display = 'none';
  mainWorkspace.style.display = 'flex';

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    });

    const data = await chrome.tabs.sendMessage(tab.id, { action: 'get_video_data' });
    if (data) {
      activeVideoData = data;
      videoTitleEl.textContent = data.title || 'YouTube Video';
    }
  } catch (err) {
    console.error("Error loading video data:", err);
  }
}

function setupEventListeners() {
  // Settings toggle
  btnSettings.addEventListener('click', () => {
    settingsView.style.display = settingsView.style.display === 'none' ? 'flex' : 'none';
    mainWorkspace.style.display = settingsView.style.display === 'flex' ? 'none' : 'flex';
  });

  btnSaveKey.addEventListener('click', async () => {
    const key = apiKeyInput.value.trim();
    await chrome.storage.local.set({ gemini_api_key: key });
    settingsView.style.display = 'none';
    mainWorkspace.style.display = 'flex';
  });

  btnCloseSettings.addEventListener('click', () => {
    settingsView.style.display = 'none';
    mainWorkspace.style.display = 'flex';
  });

  // Mode Tabs
  modeTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      modeTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentMode = tab.getAttribute('data-mode');
    });
  });

  // Generate Button
  btnGenerate.addEventListener('click', async () => {
    const result = await chrome.storage.local.get(['gemini_api_key']);
    const apiKey = result.gemini_api_key;

    if (!apiKey) {
      alert('Please set your free Gemini API Key in settings (gear icon) first.');
      settingsView.style.display = 'flex';
      mainWorkspace.style.display = 'none';
      return;
    }

    if (!activeVideoData || !activeVideoData.transcript) {
      alert('No video data or transcript found on this page.');
      return;
    }

    btnGenerate.disabled = true;
    generateBtnText.textContent = 'Analyzing Video with Gemini...';
    outputBox.textContent = 'Generating brief...';

    try {
      const prompt = buildPrompt(currentMode, activeVideoData);
      const text = await callGeminiAPI(apiKey, prompt);
      generatedText = text;
      outputBox.textContent = text;
      btnCopyOutput.disabled = false;
      btnDlOutput.disabled = false;
    } catch (err) {
      outputBox.textContent = `Error: ${err.message || 'Failed to generate brief. Check your API key.'}`;
    }

    btnGenerate.disabled = false;
    generateBtnText.textContent = 'Generate AI Brief';
  });

  // Copy & Download
  btnCopyOutput.addEventListener('click', () => {
    if (!generatedText) return;
    navigator.clipboard.writeText(generatedText);
    const orig = btnCopyOutput.innerHTML;
    btnCopyOutput.textContent = '✓ Copied';
    setTimeout(() => {
      btnCopyOutput.innerHTML = orig;
    }, 1200);
  });

  btnDlOutput.addEventListener('click', () => {
    if (!generatedText) return;
    const title = (activeVideoData ? activeVideoData.title : 'video').replace(/[/\\?%*:|"<>]/g, '-').slice(0, 40);
    downloadFile(`${title}-${currentMode}.md`, generatedText);
  });
}

function buildPrompt(mode, data) {
  const baseContext = `Video Title: "${data.title}"\nChannel: ${data.channel}\nURL: ${data.url}\n\nTranscript Content:\n${data.transcript}\n\n`;

  switch (mode) {
    case 'summary':
      return `${baseContext}You are an expert analyst. Provide a clear Markdown summary of this video:
1. **Core Thesis / Executive Summary** (2-3 punchy sentences).
2. **5 Key Actionable Takeaways** (bullet points with bold headers).
3. **Standout Quote or Insight**.`;

    case 'notes':
      return `${baseContext}You are an academic researcher. Convert this video into comprehensive, structured Markdown study notes with clear headings, bullet points, and key concepts explained simply.`;

    case 'twitter':
      return `${baseContext}You are a viral tech/business Twitter writer. Write an engaging 5-tweet thread summarizing the highest-value insights from this video:
- Tweet 1: Hook that makes people want to read.
- Tweets 2-4: Key insights (1 per tweet).
- Tweet 5: Conclusion + CTA linking back to the video. Format as 1/5, 2/5, etc.`;

    case 'linkedin':
      return `${baseContext}You are a thought leader. Write a high-engagement, professional LinkedIn post based on this video's key insights. Use punchy 1-2 sentence paragraphs, clean whitespace, and 3 relevant hashtags at the bottom.`;

    default:
      return `${baseContext}Summarize this video in clear Markdown.`;
  }
}

async function getBestGeminiModel(apiKey) {
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    if (res.ok) {
      const data = await res.json();
      const models = data.models || [];
      const contentModels = models.filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'));
      
      const preferred = contentModels.find(m => m.name.includes('gemini-2.0-flash')) ||
                        contentModels.find(m => m.name.includes('gemini-2.5-flash')) ||
                        contentModels.find(m => m.name.includes('gemini-1.5-flash-latest')) ||
                        contentModels.find(m => m.name.includes('gemini-1.5-flash')) ||
                        contentModels.find(m => m.name.includes('flash')) ||
                        contentModels.find(m => m.name.includes('gemini-pro')) ||
                        contentModels[0];

      if (preferred) {
        return preferred.name.replace('models/', '');
      }
    } else {
      const err = await res.json();
      throw new Error(err.error ? err.error.message : 'Invalid API Key');
    }
  } catch (e) {
    if (e.message.includes('API Key') || e.message.includes('API_KEY_INVALID')) {
      throw e;
    }
    console.log("Model discovery fallback:", e);
  }
  return 'gemini-1.5-flash-latest';
}

async function callGeminiAPI(apiKey, prompt) {
  const modelName = await getBestGeminiModel(apiKey);

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048
      }
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error ? errorData.error.message : `API request failed with status ${response.status}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('No content returned from Gemini.');
  return text.trim();
}

function downloadFile(filename, content) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
