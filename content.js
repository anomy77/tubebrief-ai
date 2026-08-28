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

  // 1. Resolve Title and Channel
  let title = '';
  let channel = '';
  const domMeta = isShorts ? getActiveShortsMetadata() : getWatchMetadata();
  if (domMeta.title && domMeta.title !== 'YouTube Short') title = domMeta.title;
  if (domMeta.channel && domMeta.channel !== 'Creator') channel = domMeta.channel;

  // 2. Fetch REAL Spoken Transcript (Captions) for this specific video
  const fetchedData = await fetchRealTranscript(videoId);

  title = title || fetchedData.title || document.title.replace(' - YouTube', '');
  channel = channel || fetchedData.channel || 'YouTube Creator';

  let transcript = fetchedData.transcript;

  // 3. Fallback: try active DOM transcript panel if open
  if (!transcript || transcript.length < 30) {
    transcript = getTranscriptFromDOM();
  }

  // 4. Fallback: only if video is 100% silent/no captions, use video description
  if (!transcript || transcript.length < 30) {
    const desc = fetchedData.description || getActiveDescription(isShorts);
    transcript = `[Video Title: ${title}]\n[Channel: ${channel}]\n[Note: No spoken audio captions found. Video description below]:\n\n${desc.slice(0, 4000)}`;
  }

  return {
    videoId,
    title,
    channel,
    url: window.location.href,
    transcript: transcript.slice(0, 30000)
  };
}

// Bulletproof Spoken Captions Extractor
async function fetchRealTranscript(videoId) {
  const result = { transcript: '', description: '', title: '', channel: '' };
  if (!videoId) return result;

  let captionTracks = [];

  // A. Check live page scripts in the DOM first
  try {
    for (const script of document.querySelectorAll('script')) {
      const text = script.textContent || '';
      if (text.includes('captionTracks')) {
        const m = text.match(/"captionTracks":\s*(\[.*?\])/);
        if (m) {
          captionTracks = JSON.parse(m[1]);
          if (captionTracks && captionTracks.length > 0) break;
        }
      }
    }
  } catch (e) {
    console.log("DOM caption search error:", e);
  }

  // B. If not in DOM, fetch the video's watch page HTML and parse captionTracks directly
  if (!captionTracks || captionTracks.length === 0) {
    try {
      const targetUrl = `https://www.youtube.com/watch?v=${videoId}`;
      const response = await fetch(targetUrl);
      const html = await response.text();

      // Extract title & author
      const titleM = html.match(/"title":"(.*?)"/);
      if (titleM) result.title = titleM[1];

      const authorM = html.match(/"author":"(.*?)"/);
      if (authorM) result.channel = authorM[1];

      const descM = html.match(/"shortDescription":"(.*?)"/);
      if (descM) {
        try {
          result.description = JSON.parse(`"${descM[1]}"`);
        } catch {
          result.description = descM[1];
        }
      }

      // Extract caption tracks array directly (no regex nesting errors)
      const trackMatch = html.match(/"captionTracks":\s*(\[.*?\])/);
      if (trackMatch) {
        captionTracks = JSON.parse(trackMatch[1]);
      }
    } catch (e) {
      console.log("HTML caption fetch error:", e);
    }
  }

  // C. Download and parse the caption track
  if (captionTracks && captionTracks.length > 0) {
    try {
      // Find English or default track
      const track = captionTracks.find(t => t.languageCode === 'en' || t.languageCode === 'en-US' || t.languageCode === 'en-GB') || captionTracks[0];
      if (track && track.baseUrl) {
        // Fetch XML or JSON captions
        const capRes = await fetch(track.baseUrl);
        const capText = await capRes.text();

        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(capText, 'text/xml');
        const textNodes = xmlDoc.getElementsByTagName('text');

        let textLines = [];
        for (let i = 0; i < textNodes.length; i++) {
          const raw = textNodes[i].textContent.trim();
          if (raw) {
            const decoded = raw
              .replace(/&amp;/g, '&')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&#39;/g, "'")
              .replace(/&quot;/g, '"')
              .replace(/\n/g, ' ');
            textLines.push(decoded);
          }
        }

        if (textLines.length > 0) {
          result.transcript = textLines.join(' ');
          return result;
        }
      }
    } catch (e) {
      console.log("Error parsing caption XML:", e);
    }
  }

  // D. Fallback to direct timedtext endpoints with auto-generated speech recognition (ASR)
  const candidateUrls = [
    `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en`,
    `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en&kind=asr`,
    `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en-US`,
    `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en-US&kind=asr`
  ];

  for (const url of candidateUrls) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const text = await res.text();
        if (text && text.includes('<text')) {
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(text, 'text/xml');
          const textNodes = xmlDoc.getElementsByTagName('text');
          let textLines = [];
          for (let i = 0; i < textNodes.length; i++) {
            const raw = textNodes[i].textContent.trim();
            if (raw) {
              textLines.push(raw.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"'));
            }
          }
          if (textLines.length > 0) {
            result.transcript = textLines.join(' ');
            return result;
          }
        }
      }
    } catch (e) {}
  }

  return result;
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
