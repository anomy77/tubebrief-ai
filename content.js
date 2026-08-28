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

  if (!videoId) {
    return { title: 'No Video Found', transcript: '', url: window.location.href };
  }

  // 1. Fetch exact player payload and captions for this specific video ID (prevents SPA stale DOM bugs)
  const fetchedData = await fetchTranscriptAndDetails(videoId);

  // 2. Resolve Title and Channel (prefer DOM active reel or fetched payload)
  let title = fetchedData.title;
  let channel = fetchedData.channel;

  if (!title || isShorts) {
    const domMeta = isShorts ? getActiveShortsMetadata() : getWatchMetadata();
    if (domMeta.title && domMeta.title !== 'YouTube Short') title = domMeta.title;
    if (domMeta.channel && domMeta.channel !== 'Creator') channel = domMeta.channel;
  }

  title = title || fetchedData.title || document.title.replace(' - YouTube', '');
  channel = channel || fetchedData.channel || 'YouTube Creator';

  let transcript = fetchedData.transcript;

  // 3. Fallback: try active DOM transcript if direct caption fetch didn't return text
  if (!transcript || transcript.length < 30) {
    transcript = getTranscriptFromDOM();
  }

  // 4. Fallback: use the video's actual description extracted from its player response
  if (!transcript || transcript.length < 30) {
    const desc = fetchedData.description || getActiveDescription(isShorts);
    transcript = `[Video Title: ${title}]\n[Channel: ${channel}]\n[Description & Details]:\n${desc.slice(0, 4000)}`;
  }

  return {
    videoId,
    title,
    channel,
    url: window.location.href,
    transcript: transcript.slice(0, 25000)
  };
}

async function fetchTranscriptAndDetails(videoId) {
  const empty = { transcript: '', description: '', title: '', channel: '' };
  if (!videoId) return empty;

  try {
    const targetUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const response = await fetch(targetUrl);
    const html = await response.text();

    let title = '';
    let channel = '';
    let description = '';
    let transcript = '';

    // Extract ytInitialPlayerResponse JSON payload for THIS video
    const m = html.match(/ytInitialPlayerResponse\s*=\s*({.+?});(?:var|\s*<\/script>)/) ||
              html.match(/ytInitialPlayerResponse\s*=\s*({.+?});/);

    if (m) {
      try {
        const playerObj = JSON.parse(m[1]);
        const details = playerObj.videoDetails || {};
        title = details.title || '';
        channel = details.author || '';
        description = details.shortDescription || '';

        const tracks = playerObj.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
        if (tracks.length > 0) {
          const enTrack = tracks.find(t => t.languageCode === 'en' || t.languageCode === 'en-US' || t.languageCode === 'en-GB') || tracks[0];
          if (enTrack && enTrack.baseUrl) {
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
            transcript = textLines.join(' ');
          }
        }
      } catch (err) {
        console.log("Error parsing player response:", err);
      }
    }

    // Direct timedtext API fallback if transcript still empty
    if (!transcript) {
      try {
        const ttRes = await fetch(`https://www.youtube.com/api/timedtext?lang=en&v=${videoId}`);
        if (ttRes.ok) {
          const ttXml = await ttRes.text();
          if (ttXml && ttXml.includes('<text')) {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(ttXml, 'text/xml');
            const textNodes = xmlDoc.getElementsByTagName('text');
            let textLines = [];
            for (let i = 0; i < textNodes.length; i++) {
              const raw = textNodes[i].textContent.trim();
              if (raw) textLines.push(raw);
            }
            transcript = textLines.join(' ');
          }
        }
      } catch (e) {}
    }

    return { transcript, description, title, channel };
  } catch (err) {
    console.error("fetchTranscriptAndDetails error:", err);
    return empty;
  }
}

function getActiveShortsMetadata() {
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

  return { title, channel };
}

function getWatchMetadata() {
  const titleEl = document.querySelector('ytd-watch-metadata #title h1 yt-formatted-string') ||
                  document.querySelector('h1.style-scope.ytd-watch-metadata') ||
                  document.querySelector('h1 yt-formatted-string');
  const title = titleEl ? titleEl.textContent.trim() : '';

  const channelEl = document.querySelector('ytd-watch-metadata #owner #channel-name a') ||
                    document.querySelector('ytd-channel-name a') ||
                    document.querySelector('#owner #channel-name a');
  const channel = channelEl ? channelEl.textContent.trim() : '';

  return { title, channel };
}

function getActiveDescription(isShorts) {
  if (isShorts) {
    const activeReel = document.querySelector('ytd-reel-video-renderer[is-active]');
    if (activeReel) {
      const descEl = activeReel.querySelector('#description') || activeReel.querySelector('.description');
      if (descEl) return descEl.textContent.trim();
    }
    return '';
  }
  const descEl = document.querySelector('ytd-watch-metadata #description') || document.querySelector('#description');
  return descEl ? descEl.textContent.trim() : '';
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
