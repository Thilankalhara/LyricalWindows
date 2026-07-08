# 🪟 LyricalWindows

A retro-OS, pop-up-style synced lyrics player. Paste a YouTube or Spotify link,
auto-fetch (or type) synced lyrics, hit **Start**, and watch Windows 95 / XP /
macOS / Windows 10-styled windows pop up in sync with the song — each one
themed and animated to match the mood of that line (love, sad, angry, quiet,
beat drop, happy).



<!--
  DEMO VIDEO
  Stored locally at assets/tutorial.mp4. GitHub's README renderer doesn't
  autoplay local video files inline, so this renders as a click-to-open link
  rather than an embedded player. If you later upload it to YouTube instead,
  swap this for a thumbnail-link embed (renders inline on GitHub):

  
-->
## 🎬 Demo Video

📹 [Watch the tutorial](assets/tutorial.mp4)

<!--
  SCREENSHOTS
  Drop your screenshots into assets/screenshots/ and reference them below,
  e.g. assets/screenshots/Capture.PNG
-->
## 📸 Screenshots

| | |
|---|---|
| ![Windows 95 theme](assets/screenshots/win95-theme.png) 

---

## ✨ Features

- **Real background audio** — paste a YouTube or Spotify track link and it plays for real, synced to the lyrics.
- **Auto-fetch synced lyrics** — pulls real per-line timestamps from LRCLIB when available (free, no API key), falling back to plain lyrics spread across the track if not.
- **Four retro window skins** — Windows 95, Windows XP, macOS Glass, Windows 10/11.
- **Mood-reactive animations** — hearts for love lines, fades for sad ones, screen shake for beat drops, bounce for happy lines, and more.
- **Zero backend** — runs entirely in the browser; deployable for free on GitHub Pages.

## 📁 Files

- `index.html` — markup
- `style.css` — all styles/animations
- `script.js` — all logic (YouTube + Spotify playback, lyric sync, popups)
- `assets/screenshots/` — put your screenshots here

Keep `index.html`, `style.css`, and `script.js` in the same folder — the HTML links to the other two by relative path.


## 🛠️ How it works

1. **Type the artist and song title.**
2. **Background track**: paste a `youtube.com/watch?v=...`, `youtu.be/...`, or `open.spotify.com/track/...` link. It streams in a small player card so you get real audio, synced to real playback time.
3. **Lyrics + timing**: use **Fetch Synced Lyrics** to auto-fill from the artist/title, or type lines manually into the sync timeline using `[seconds] lyric text | mood`, where mood is one of `love`, `sad`, `angry`, `quiet`, `beatdrop`, `happy`, or `regular`.
4. **Hit Start** — retro OS-style windows pop up in sync, each themed and animated to match the mood of that line.
5. **Pick a skin** from the Desktop Window Style panel — Windows 95, XP, macOS Glass, or Windows 10/11.

## ⚙️ Customizing

- Social links (LinkedIn / GitHub / email) and the Ko-fi button are in the `<footer>` in `index.html`.
- Window skins are plain CSS classes (`.win95`, `.winXP`, `.winMac`, `.win10`) in `style.css`.
- Mood keyword detection lives in `guessMood()` in `script.js`.

---

Built by **Thilan Kalhara**
[LinkedIn](https://www.linkedin.com/in/thilan-kalhara-06a9b723a) · [GitHub](https://github.com/Thilankalhara) · [thilankalhara@yahoo.com](mailto:thilankalhara@yahoo.com)

☕ [Support this project on Ko-fi](https://ko-fi.com/thilankalhara)
