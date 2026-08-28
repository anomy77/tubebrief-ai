// TubeBrief - YouTube Video Transcript & Metadata Extractor

async function getYouTubeVideoData() {
  const isShorts = window.location.pathname.startsWith('/shorts/');
  let videoId = '';

  if (isShorts) {
    videoId = window.location.pathname.split('/shorts/')[1].split('/')[0].split('?')[0];
  } else {
    const urlParams = new URLSearchParams(window.location.search);
    videoId = urlParams.get('v');
  }

  // Extract Title & Channel depending on video type
  const meta = isShorts ? getActiveShortsMetadata() : getWatchMetadata();
  const title = meta.title;
  const channel = meta.channel;

  let transcript = '';

  try {
    // 1. Try extracting caption track from watch page HTML (works for Shorts too using watch?v=ID)
    transcript = await fetchTranscript(videoId);
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
    transcript: transcript.slice(0, 25000)
  };
}

function getActiveShortsMetadata() {
  // Look specifically inside the active Shorts container
  const activeReel = document.querySelector('ytd-reel-video-renderer[is-active]') ||
                     document.querySelector('ytd-reel-video-renderer[overlay-state*="VISIBLE"]') ||
                     document.querySelector('ytd-reel-video-renderer');

  let title = '';
  let channel = '';

  if (activeReel) {
    const titleEl = activeReel.querySelector('h2.title') || 
                    activeReel.querySelector('yt-formatted-string.title') ||
                    activeReel.querySelector('.yt-reel-metadatastyle-renderer__title') ||
                    activeReel.querySelector('#headline yt-formatted-string');
    if (titleEl && titleEl.textContent.trim()) {
      title = titleEl.textContent.trim();
    }

    const channelEl = activeReel.querySelector('#channel-name a') ||
                      activeReel.querySelector('ytd-channel-name a') ||
                      activeReel.querySelector('.ytd-channel-name');
    if (channelEl && channelEl.textContent.trim()) {
      channel = channelEl.textContent.trim();
    }
  }

  // Fallback: check active video overlay
  if (!title) {
    const overlayTitle = document.querySelector('.ytd-reel-player-overlay-renderer h2.title');
    if (overlayTitle) title = overlayTitle.textContent.trim();
  }

  if (!title) {
    const rawDocTitle = document.title.replace(' - YouTube', '').trim();
    if (rawDocTitle && rawDocTitle !== 'Shorts' && rawDocTitle !== 'YouTube') {
      title = rawDocTitle;
    }
  }

  return { title: title || 'YouTube Short', channel: channel || 'Creator' };
}

function getWatchMetadata() {
  const titleEl = document.querySelector('ytd-watch-metadata #title h1 yt-formatted-string') ||
                  document.querySelector('h1.style-scope.ytd-watch-metadata') ||
                  document.querySelector('h1 yt-formatted-string');
  const title = titleEl ? titleEl.textContent.trim() : document.title.replace(' - YouTube', '').trim();

  const channelEl = document.querySelector('ytd-watch-metadata #owner #channel-name a') ||
                    document.querySelector('ytd-channel-name a') ||
                    document.querySelector('#owner #channel-name a');
  const channel = channelEl ? channelEl.textContent.trim() : 'YouTube Creator';

  return { title: title || 'YouTube Video', channel: channel || 'Creator' };
}

async function fetchTranscript(videoId) {
  if (!videoId) return '';
  
  // Always query watch URL for consistent caption track parsing
  const targetUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const response = await fetch(targetUrl);
  const html = await response.text();

  const m = html.match(/"captionTracks":\s*(\[.*?\])/);
  if (!m) return '';

  const tracks = JSON.parse(m[1]);
  if (!tracks || tracks.length === 0) return '';

  // Prefer English track or default
  const enTrack = tracks.find(t => t.languageCode === 'en' || t.languageCode === 'en-US') || tracks[0];
  if (!enTrack || !enTrack.baseUrl) return '';

  const capRes = await fetch(enTrack.baseUrl);
  const capXml = await capRes.text();

  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(capXml, 'text/xml');
  const textNodes = xmlDoc.getElementsByTagName('text');

  let textLines = [];
  for (let i = 0; i < textNodes.length; i++) {
    const raw = textNodes[i].textContent.trim();
    if (raw) {
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
