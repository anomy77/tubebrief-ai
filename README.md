# TubeBrief - YouTube AI Summary & Post Generator

A Manifest V3 Chrome extension that turns any YouTube video into concise executive summaries, structured study notes, or ready-to-post Twitter and LinkedIn threads using the Google Gemini Flash API.

## Features

- Multi-Mode Generation:
  - Summary: 3-sentence thesis + 5 actionable bullet takeaways.
  - Study Notes: Comprehensive structured notes with key concepts explained.
  - X (Twitter) Thread: 5-part viral thread with hook and formatting.
  - LinkedIn Post: Professional post formatted for high engagement.
- Fast & Free AI: Connects to Google Gemini 1.5 Flash via your own free API key.
- Direct Caption Extraction: Automatically reads YouTube caption tracks from the video player without third-party proxy servers.
- Resizable Output Box: Drag the bottom-right handle to expand long notes comfortably.
- One-Click Export: Copy formatted text directly to clipboard or download as a `.md` Markdown file.

## Installation

1. Clone or download this repository.
2. Open Google Chrome (or Brave / Edge) and go to `chrome://extensions`.
3. Enable **Developer mode** in the top right.
4. Click **Load unpacked** and select the `YouTube-AI-Brief` directory.

## Setup

1. Get a free Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Open any YouTube video.
3. Click the TubeBrief icon in your browser toolbar.
4. Click the gear icon in the top right, paste your key, and click **Save Key**.

## Customizing the AI Provider (OpenAI, Claude, Mistral, Groq)

By default, TubeBrief uses Google Gemini 1.5 Flash because it is free with generous rate limits. If you prefer to use OpenAI, Mistral, Claude, or Groq, you can modify the `callGeminiAPI` function in `popup.js`.

### 1. OpenAI (GPT-4o-mini / GPT-4o)

Replace `callGeminiAPI` in `popup.js` with:

```javascript
async function callOpenAI(apiKey, prompt) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7
    })
  });
  const data = await response.json();
  return data.choices[0].message.content.trim();
}
```

### 2. Mistral AI (Mistral Small / Large)

```javascript
async function callMistral(apiKey, prompt) {
  const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'mistral-small-latest',
      messages: [{ role: 'user', content: prompt }]
    })
  });
  const data = await response.json();
  return data.choices[0].message.content.trim();
}
```

### 3. Anthropic Claude (Claude 3.5 Sonnet / Haiku)

```javascript
async function callClaude(apiKey, prompt) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'dangerously-allow-browser': 'true'
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20240620',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }]
    })
  });
  const data = await response.json();
  return data.content[0].text.trim();
}
```

### 4. Groq (Blazing Fast Llama 3 8B / 70B)

```javascript
async function callGroq(apiKey, prompt) {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'llama3-8b-8192',
      messages: [{ role: 'user', content: prompt }]
    })
  });
  const data = await response.json();
  return data.choices[0].message.content.trim();
}
```

*Note: If you switch to another provider, make sure to add the provider URL (e.g. `https://api.openai.com/*` or `https://api.anthropic.com/*`) to the `host_permissions` array in `manifest.json`.*

## Tech Stack

- Vanilla JavaScript (ES6+)
- Chrome Extension API (Manifest V3)
- Google Gemini REST API (1.5 Flash)

## License

MIT
