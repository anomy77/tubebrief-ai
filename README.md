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

## Tech Stack

- Vanilla JavaScript (ES6+)
- Chrome Extension API (Manifest V3)
- Google Gemini REST API (1.5 Flash)

## License

MIT
