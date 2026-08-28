// TubeBrief - YouTube Video Transcript & Metadata Extractor

async function getYouTubeVideoData() {
  let videoId = '';
  if (window.location.pathname.startsWith('/shorts/')) {
    videoId = window.location.pathname.split('/shorts/')[1].split('/')[0].split('?')[0];
  } else {
    const urlParams = new URLSearchParams(window.location.search);
    videoId = urlParams.get('v');
  }

  const titleEl = document.querySelector('h1.style-scope.ytd-watch-metadata') || 
                  document.querySelector('h2.title.style-scope.ytd-reel-player-header-renderer') ||
                  document.querySelector('#shorts-container yt-formatted-string.title') ||
                  document.querySelector('h1 yt-formatted-string');
  const title = titleEl ? titleEl.textContent.trim() : document.title.replace(' - YouTube', '');
  
  const channelEl = document.querySelector('ytd-channel-name a') || 
                    document.querySelector('#owner #channel-name a') ||
                    document.querySelector('ytd-reel-player-header-renderer #channel-name a');
  const channel = channelEl ? channelEl.textContent.trim() : 'YouTube Creator';

  let transcript = '';

  try {
    // 1. Try extracting caption track from page source
    transcript = await fetchTranscriptFromPageSource();
  } catch (e) {
    console.log("Direct caption fetch failed, attempting DOM fallback...", e);
  }

  // 2. If direct fetch didn't return text, try reading open transcript DOM
  if (!transcript || transcript.length < 50) {
    transcript = getTranscriptFromDOM();
  }

  // 3. Fallback to description + chapter timestamps if no captions available
  if (!transcript || transcript.length < 50) {
    const descEl = document.querySelector('#description-inline-expander') || document.querySelector('#description');
    const desc = descEl ? descEl.textContent.trim() : '';
    transcript = `[Video Title: ${title}]\n[Channel: ${channel}]\n[Description & Outline]:\n${desc.slice(0, 4000)}`;
  }

  return {
    videoId,
    title,
    channel,
    url: window.location.href,
    transcript: transcript.slice(0, 25000) // Keep within token budget
  };
}

async function fetchTranscriptFromPageSource() {
  // Fetch current page HTML to get caption tracks from ytInitialPlayerResponse
  const response = await fetch(window.location.href);
  const html = await response.text();

  const m = html.match(/"captionTracks":\s*(\[.*?\])/);
  if (!m) return '';

  const tracks = JSON.parse(m[1]);
  if (!tracks || tracks.length === 0) return '';

  // Prefer English track or default
  const enTrack = tracks.find(t => t.languageCode === 'en' || t.languageCode === 'en-US') || tracks[0];
  if (!enTrack || !enTrack.baseUrl) return '';

  // Fetch XML caption text
  const capRes = await fetch(enTrack.baseUrl);
  const capXml = await capRes.text();

  // Parse XML text tags
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(capXml, 'text/xml');
  const textNodes = xmlDoc.getElementsByTagName('text');

  let textLines = [];
  for (let i = 0; i < textNodes.length; i++) {
    const raw = textNodes[i].textContent.trim();
    if (raw) {
      // Decode HTML entities
      const decoded = raw.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"');
      textLines.push(decoded);
    }
  }

  return textLines.join(' ');
}

function getTranscriptFromDOM() {
  const segments = document.querySelectorAll('ytd-transcript-segment-renderer');
  if (segments.length === 0) return '';

  let lines = [];
  segments.forEach(seg => {
    const timeEl = seg.querySelector('.segment-timestamp');
    const textEl = seg.querySelector('.segment-text');
    if (textEl) {
      const time = timeEl ? timeEl.textContent.trim() : '';
      lines.push(`${time} ${textEl.textContent.trim()}`);
    }
  });

  return lines.join('\n');
}

// Message listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'get_video_data') {
    getYouTubeVideoData().then(data => sendResponse(data));
    return true;
  }
  return true;
});
