// Init Lucide Icons
lucide.createIcons();

// Constants & System State
let selectedTheme = 'win95';
let currentTimer = null;
let isPlaying = false;
let trackDuration = 180; 
let currentTime = 0;
let activeLyricsTimeline = [];
let firedTimes = new Set();
let loadTimeout = null;

// --- Mixed Playback Engine ---
let ytPlayer = null;
let ytReady = false;
let isUsingFallbackMode = false;
let trackReady = false;

let engineCommitted = false;

const ytTag = document.createElement('script');
ytTag.src = "https://www.youtube.com/iframe_api";
document.body.appendChild(ytTag);

window.onYouTubeIframeAPIReady = function () {
    ytReady = true;
};

let spotifyIFrameAPI = null;
let spotifyApiReady = false;
let spotifyController = null;
let usingSpotify = false;
let pendingSpotifyTrackId = null;

const spotifyTag = document.createElement('script');
spotifyTag.src = "https://open.spotify.com/embed/iframe-api/v1";
spotifyTag.async = true;
document.body.appendChild(spotifyTag);

window.onSpotifyIframeApiReady = (IFrameAPI) => {
    spotifyApiReady = true;
    spotifyIFrameAPI = IFrameAPI;
    if (pendingSpotifyTrackId) {
        const id = pendingSpotifyTrackId;
        pendingSpotifyTrackId = null;
        createSpotifyController(id);
    }
};

function parseVideoId(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

// Matches both open.spotify.com/track/ID and spotify:track:ID
function parseSpotifyTrackId(url) {
    const m = url.match(/track[/:]([a-zA-Z0-9]{22})/);
    return m ? m[1] : null;
}

function stopAllAudio() {
    clearInterval(currentTimer);
    if (usingSpotify && spotifyController) {
        try { spotifyController.pause(); } catch (e) {}
    }
    
    if (!isUsingFallbackMode && ytPlayer && ytPlayer.pauseVideo) {
        try { ytPlayer.pauseVideo(); } catch(e){}
    }
    isPlaying = false;
    document.getElementById('play-pause-btn').innerHTML = `<i data-lucide="play" class="w-5 h-5"></i>`;
    document.getElementById('status-spinner').className = 'w-3 h-3 rounded-full bg-slate-500';
    lucide.createIcons();
}


function createSpotifyController(trackId) {
    const container = document.getElementById('spotify-embed-container');
    const statusEl = document.getElementById('yt-status');
    const loadingTrack = document.getElementById('loading-pulse-track');
    if (!container) { activatePopupOnlyMode(); return; }

    container.innerHTML = '';
    const options = { uri: `spotify:track:${trackId}`, width: '100%', height: '80' };

    spotifyIFrameAPI.createController(container, options, (controller) => {
        spotifyController = controller;

        controller.addListener('playback_update', (e) => {
            const posSec = (e.data.position || 0) / 1000;
            const durSec = (e.data.duration || 0) / 1000;

            // First real update with a known duration = the track is actually loaded.
            if (!engineCommitted && durSec > 0) {
                engineCommitted = true;
                trackReady = true;
                clearTimeout(loadTimeout);
                if (loadingTrack) loadingTrack.classList.add('hidden');
                statusEl.textContent = '⚡ Connected to Spotify';
                statusEl.className = 'text-[11px] text-emerald-400 mt-0.5';
                trackDuration = Math.floor(durSec);
                document.getElementById('total-duration').innerText = formatSeconds(trackDuration);
                activeLyricsTimeline = parseLyrics();
            }
            if (!engineCommitted) return;

            currentTime = posSec;
            isPlaying = !e.data.isPaused;
            document.getElementById('play-pause-btn').innerHTML = isPlaying
                ? `<i data-lucide="pause" class="w-5 h-5"></i>`
                : `<i data-lucide="play" class="w-5 h-5"></i>`;
            document.getElementById('status-spinner').className = isPlaying
                ? 'w-3 h-3 rounded-full bg-pink-500 animate-ping'
                : 'w-3 h-3 rounded-full bg-slate-500';
            lucide.createIcons();

            updateProgressBar();
            checkLyricTrigger(Math.floor(currentTime));

            if (durSec > 0 && posSec >= durSec - 0.3) {
                currentTime = 0;
                firedTimes.clear();
                updateProgressBar();
                document.getElementById('desktop-canvas').innerHTML = '';
            }
        });

       
        try { controller.resume(); } catch (e) {}
    });
}

function startAudioEngine(videoUrl) {
    const statusEl = document.getElementById('yt-status');
    const loadingTrack = document.getElementById('loading-pulse-track');

    stopAllAudio();
    currentTime = 0;
    firedTimes.clear();
    engineCommitted = false; 
    usingSpotify = false;
    document.getElementById('spotify-embed-container').innerHTML = '';
    updateProgressBar();

    if (loadingTrack) loadingTrack.classList.remove('hidden');
    statusEl.textContent = '🎧 Connecting audio engine...';
    statusEl.className = 'text-[11px] text-slate-400 mt-0.5';

    
    clearTimeout(loadTimeout);
    loadTimeout = setTimeout(() => {
        if (!engineCommitted) activatePopupOnlyMode();
    }, 6000);

    const spotifyId = parseSpotifyTrackId(videoUrl);
    if (spotifyId) {
        usingSpotify = true;
        trackReady = false;
        if (spotifyApiReady) {
            createSpotifyController(spotifyId);
        } else {
            pendingSpotifyTrackId = spotifyId;
        }
        return;
    }

    const targetId = parseVideoId(videoUrl);
    if (!targetId || !ytReady) {
        activatePopupOnlyMode();
        return;
    }

    isUsingFallbackMode = false;
    trackReady = false;

    const onPlayerReady = () => {
        if (ytPlayer.unMute) ytPlayer.unMute();
        if (ytPlayer.setVolume) ytPlayer.setVolume(100);
        if (ytPlayer.playVideo) ytPlayer.playVideo();
    };

    const onPlayerStateChange = (event) => {
        if (event.data === 1) {
            
            if (engineCommitted && !isUsingFallbackMode) {
                return; // already the one driving playback, nothing to do
            }

            engineCommitted = true;
            isUsingFallbackMode = false;
            trackReady = true;
            clearTimeout(loadTimeout);
            if (loadingTrack) loadingTrack.classList.add('hidden');
            statusEl.textContent = '⚡ Connected to Video Feed Stream';
            statusEl.className = 'text-[11px] text-emerald-400 mt-0.5';

            trackDuration = Math.floor(ytPlayer.getDuration()) || 180;
            document.getElementById('total-duration').innerText = formatSeconds(trackDuration);
            startGlobalTimelineLoop();
        }
    };

    if (!ytPlayer) {
        ytPlayer = new YT.Player('yt-player', {
            height: '100%', width: '100%', videoId: targetId,
           
            playerVars: { rel: 0, modestbranding: 1, autoplay: 1, playsinline: 1 },
            events: {
                onReady: onPlayerReady,
                onStateChange: onPlayerStateChange,
                onError: () => activatePopupOnlyMode("⚠️ This video can't be embedded here (owner restricts it, or it's unavailable) — running popups without audio. Try a different YouTube link.")
            }
        });
    } else {
        ytPlayer.loadVideoById({ videoId: targetId });
    }
}

function activatePopupOnlyMode(statusMessage) {
    if (engineCommitted) return; 
    engineCommitted = true;
    clearTimeout(loadTimeout);
    isUsingFallbackMode = true;
    trackReady = true;

    const statusEl = document.getElementById('yt-status');
    const loadingTrack = document.getElementById('loading-pulse-track');
    if (loadingTrack) loadingTrack.classList.add('hidden');


    if (statusMessage) {
        statusEl.textContent = statusMessage;
        statusEl.className = 'text-[11px] text-amber-400 mt-0.5';
    } else {
        statusEl.textContent = `🎬 Standalone Popup Mode Active`;
        statusEl.className = 'text-[11px] text-cyan-400 mt-0.5';
    }

    const parsed = parseLyrics();
    if (parsed.length > 0) {
        trackDuration = Math.max(...parsed.map(o => o.time)) + 8;
    } else {
        trackDuration = 180;
    }
    document.getElementById('total-duration').innerText = formatSeconds(trackDuration);

    startGlobalTimelineLoop();
}

function startGlobalTimelineLoop() {
    clearInterval(currentTimer); 

    isPlaying = true;
    document.getElementById('play-pause-btn').innerHTML = `<i data-lucide="pause" class="w-5 h-5"></i>`;
    document.getElementById('status-spinner').className = 'w-3 h-3 rounded-full bg-pink-500 animate-ping';
    lucide.createIcons();

    activeLyricsTimeline = parseLyrics();

    currentTimer = setInterval(() => {
        if (isUsingFallbackMode) {
            currentTime += 0.25;
        } else if (ytPlayer && ytPlayer.getCurrentTime) {
            currentTime = ytPlayer.getCurrentTime();
        }

        if (currentTime >= trackDuration) {
            stopAllAudio();
            currentTime = 0;
            updateProgressBar();
            return;
        }

        updateProgressBar();
        checkLyricTrigger(Math.floor(currentTime));
    }, 250);
}

function togglePlayback() {
    if (!trackReady) return;

    if (usingSpotify && spotifyController) {
        // Spotify's own playback_update event updates isPlaying/icons/spinner for us,
        // so there's nothing else to do here.
        try { spotifyController.togglePlay(); } catch (e) {}
        return;
    }

    if (isPlaying) {
        clearInterval(currentTimer);
        if (!isUsingFallbackMode && ytPlayer && ytPlayer.pauseVideo) ytPlayer.pauseVideo();
        isPlaying = false;
        document.getElementById('play-pause-btn').innerHTML = `<i data-lucide="play" class="w-5 h-5"></i>`;
        document.getElementById('status-spinner').className = 'w-3 h-3 rounded-full bg-slate-500';
    } else {
        if (!isUsingFallbackMode && ytPlayer && ytPlayer.playVideo) ytPlayer.playVideo();
        startGlobalTimelineLoop();
    }
    lucide.createIcons();
}

function checkLyricTrigger(flooredTime) {
    const matchedEvent = activeLyricsTimeline.find(item => item.time === flooredTime);
    if (matchedEvent && !firedTimes.has(flooredTime)) {
        firedTimes.add(flooredTime);
        triggerPopUp(matchedEvent);
    }
}

function createEmojiParticles(emotion, startX, startY) {
    const canvas = document.getElementById('desktop-canvas');
    let pool = ['✨', '⭐'];
    let animClass = 'float-up';

    if (emotion === 'love') {
        pool = ['❤️', '💖', '💘', '💕', '✨'];
        animClass = 'drift-down';
    } else if (emotion === 'sad') {
        pool = ['💧', '😭', '🌧️', '☔'];
        animClass = 'drift-down';
    } else if (emotion === 'happy') {
        pool = ['✨', '⭐', '🎉', '🌟', '🌈'];
        animClass = 'float-up';
    } else if (emotion === 'beatdrop') {
        pool = ['⚡', '🔥', '💥', '⚠️'];
        animClass = 'jitter-burst';
    }

    // Mobile optimized pool particle intensity count (reduced slightly for smooth render loops)
    for (let i = 0; i < 6; i++) {
        const span = document.createElement('span');
        span.className = `absolute text-sm sm:text-lg select-none pointer-events-none z-50 emoji-particle ${animClass}`;
        span.textContent = pool[Math.floor(Math.random() * pool.length)];
        
        const offsetX = (Math.random() * 80) - 40;
        const offsetY = (Math.random() * 60) - 30;
        span.style.left = `calc(${startX}% + ${offsetX}px)`;
        span.style.top = `calc(${startY}% + ${offsetY}px)`;
        
        span.style.transform = `scale(${Math.random() * 0.5 + 0.6})`;
        span.style.setProperty('--drift-x', `${(Math.random() * 60) - 30}px`);

        canvas.appendChild(span);
        setTimeout(() => span.remove(), 2200);
    }
}

function triggerPopUp(lyricObj) {
    const canvas = document.getElementById('desktop-canvas');
    const idle = document.getElementById('idle-win');
    if (idle) idle.remove(); 

    const popup = document.createElement('div');
    popup.className = `pointer-events-auto absolute p-1 select-none shadow-2xl transition-all duration-300 popup-enter`;
    
    // SAFE POSITION GENERATOR FOR BOTH MOBILE AND WIDESCREENS
    const isMobile = window.innerWidth < 640;
    const randomX = isMobile ? (Math.floor(Math.random() * 15) + 5) : (Math.floor(Math.random() * 40) + 10);
    const randomY = isMobile ? (Math.floor(Math.random() * 30) + 15) : (Math.floor(Math.random() * 40) + 20);
    
    popup.style.left = `${randomX}%`;
    popup.style.top = `${randomY}%`;
    popup.style.zIndex = Math.floor(currentTime) + 10;

    let titleText = "System Notification";
    let emotionClass = "";
    
    if (lyricObj.emotion === 'love') {
        popup.classList.add('heart-theme');
        titleText = "💕 Lovelink.dll";
    } else if (lyricObj.emotion === 'sad') {
        popup.classList.add('fade-out-anim');
        emotionClass = "italic opacity-80";
        titleText = "💧 Melancholy.sys";
    } else if (lyricObj.emotion === 'beatdrop') {
        titleText = "⚡ BEAT_DROP.EXE";
        const screen = document.getElementById('desktop-screen');
        screen.classList.remove('screen-shake-anim');
        void screen.offsetWidth; 
        screen.classList.add('screen-shake-anim');
        setTimeout(() => screen.classList.remove('screen-shake-anim'), 1600);
    } else if (lyricObj.emotion === 'happy') {
        popup.classList.add('bounce-anim');
        titleText = "✨ FunPlay.app";
    }

    const popupWidthClass = isMobile ? "w-[240px]" : "w-72";

    if (selectedTheme === 'win95' && lyricObj.emotion !== 'love') {
        popup.className += ` win95 ${popupWidthClass}`;
        popup.innerHTML = `
            <div class="win95-title px-2 py-0.5 flex justify-between items-center text-xs">
                <span class="flex items-center gap-1 font-sans truncate">${titleText}</span>
                <button onclick="window.closePopupWindow(this.closest('.pointer-events-auto'))" class="win95-btn px-1.5 py-0.5 text-[9px] font-bold">X</button>
            </div>
            <div class="p-3 bg-[#c0c0c0] text-black text-center text-xs border-t border-white">
                <p class="font-mono mb-2 break-words text-[11px] sm:text-xs ${emotionClass}">${lyricObj.text}</p>
                <button onclick="window.closePopupWindow(this.closest('.pointer-events-auto'))" class="win95-btn px-4 py-1 text-[10px] font-bold font-mono">OK</button>
            </div>
        `;
    } else if (selectedTheme === 'winXP' && lyricObj.emotion !== 'love') {
        popup.className += ` winXP ${popupWidthClass}`;
        popup.innerHTML = `
            <div class="winXP-title px-3 py-1 flex justify-between items-center text-xs font-sans font-bold">
                <span class="truncate">${titleText}</span>
                <button onclick="window.closePopupWindow(this.closest('.pointer-events-auto'))" class="bg-red-500 text-white rounded px-1.5 py-0.5 text-[9px]">X</button>
            </div>
            <div class="p-4 text-center text-xs text-slate-900 bg-[#fbfaf0]">
                <p class="mb-3 leading-relaxed font-sans break-words text-[11px] sm:text-xs ${emotionClass}">${lyricObj.text}</p>
                <button onclick="window.closePopupWindow(this.closest('.pointer-events-auto'))" class="bg-amber-400 hover:bg-amber-300 border border-amber-600 rounded px-4 py-1 font-bold text-xs text-amber-950">OK</button>
            </div>
        `;
    } else if (selectedTheme === 'winMac' && lyricObj.emotion !== 'love') {
        popup.className += ` winMac ${popupWidthClass}`;
        popup.innerHTML = `
            <div class="px-3 py-2 flex items-center justify-between border-b border-black/5">
                <div class="flex gap-1.5 shrink-0">
                    <span onclick="window.closePopupWindow(this.closest('.pointer-events-auto'))" class="w-3 h-3 rounded-full bg-[#ff5f56] cursor-pointer"></span>
                    <span class="w-3 h-3 rounded-full bg-[#ffbd2e]"></span>
                    <span class="w-3 h-3 rounded-full bg-[#27c93f]"></span>
                </div>
                <span class="text-[10px] font-semibold text-black/40 truncate pl-2">${titleText}</span>
            </div>
            <div class="p-4 text-center text-xs text-zinc-800">
                <p class="break-words text-[11px] sm:text-xs ${emotionClass}">${lyricObj.text}</p>
            </div>
        `;
    } else if (selectedTheme === 'win10' && lyricObj.emotion !== 'love') {
        popup.className += ` win10 ${popupWidthClass}`;
        popup.innerHTML = `
            <div class="win10-title px-3 py-1.5 flex justify-between items-center text-xs font-sans">
                <span class="truncate">${titleText}</span>
                <button onclick="window.closePopupWindow(this.closest('.pointer-events-auto'))" class="hover:bg-red-600 px-2 py-0.5 transition-colors">✕</button>
            </div>
            <div class="p-4 text-center text-xs text-white">
                <p class="mb-3 tracking-wide font-light break-words text-[11px] sm:text-xs ${emotionClass}">${lyricObj.text}</p>
            </div>
        `;
    } else if (lyricObj.emotion === 'love') {
        popup.className += ` ${popupWidthClass}`;
        popup.innerHTML = `
            <div class="p-3 sm:p-4 text-center">
                <span class="text-lg sm:text-xl">❤️</span>
                <p class="font-bold text-[11px] sm:text-xs mt-1 break-words text-rose-950">${lyricObj.text}</p>
            </div>
        `;
    }

    canvas.appendChild(popup);
    createEmojiParticles(lyricObj.emotion, randomX, randomY);

    if (lyricObj.emotion === 'sad') {
        setTimeout(() => { if (document.body.contains(popup)) popup.remove(); }, 7100);
    } else {
        setTimeout(() => { if (document.body.contains(popup)) closePopupWindow(popup); }, 6000);
    }
}

function closePopupWindow(el) {
    if (!el) return;
    el.classList.add('popup-exit');
    setTimeout(() => { if (document.body.contains(el)) el.remove(); }, 380);
}
window.closePopupWindow = closePopupWindow;

document.getElementById('play-pause-btn').addEventListener('click', togglePlayback);

document.getElementById('reset-btn').addEventListener('click', () => {
    stopAllAudio();
    currentTime = 0;
    firedTimes.clear(); 
    if (usingSpotify && spotifyController) {
        try { spotifyController.seek(0); } catch (e) {}
    } else if (!isUsingFallbackMode && ytPlayer && ytPlayer.seekTo) {
        try { ytPlayer.seekTo(0, true); } catch(e) {}
    }
    updateProgressBar();
    document.getElementById('desktop-canvas').innerHTML = '';
});

document.getElementById('clear-desktop-btn').addEventListener('click', () => {
    document.getElementById('desktop-canvas').innerHTML = '';
});

document.getElementById('start-btn').addEventListener('click', () => {
    const urlInput = document.getElementById('yt-url-input').value.trim();
    document.getElementById('current-track-title').innerText = "Streaming Pop-up Interface Active";
    document.getElementById('desktop-canvas').innerHTML = '';
    startAudioEngine(urlInput);
});


async function fetchLrcLyrics(artist, title) {
    try {
        const res = await fetch(`https://lrclib.net/api/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}`);
        if (res.ok) {
            const data = await res.json();
            if (data && data.syncedLyrics) return { synced: true, lrc: data.syncedLyrics, duration: data.duration || null };
            if (data && data.plainLyrics) return { synced: false, lrc: null, duration: data.duration || null, plain: data.plainLyrics };
        }
    } catch (e) { /* fall through to fuzzy search */ }

    try {
        const res2 = await fetch(`https://lrclib.net/api/search?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}`);
        if (res2.ok) {
            const arr = await res2.json();
            if (Array.isArray(arr) && arr.length > 0) {
                const best = arr.find(x => x.syncedLyrics) || arr[0];
                if (best.syncedLyrics) return { synced: true, lrc: best.syncedLyrics, duration: best.duration || null };
                if (best.plainLyrics) return { synced: false, lrc: null, duration: best.duration || null, plain: best.plainLyrics };
            }
        }
    } catch (e) { /* no match found anywhere */ }

    return null;
}

// Converts raw "[mm:ss.xx]lyric text" LRC lines into {time, text} objects, in whole seconds
// (our [seconds] format is integer-based). Skips blank/symbol-only lines - LRC files often
// mark instrumental breaks with an empty or "♪"-only timestamp, which should stay silent.
function parseLrcToLines(lrcText) {
    const timeTagRegex = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g;
    const items = [];
    lrcText.split('\n').forEach(line => {
        const tags = [...line.matchAll(timeTagRegex)];
        if (tags.length === 0) return;
        const text = line.replace(timeTagRegex, '').trim();
        if (!text || /^[\s♪\-.•]*$/.test(text)) return; // instrumental marker, not a real line
        tags.forEach(tag => {
            const mins = parseInt(tag[1], 10);
            const secs = parseInt(tag[2], 10);
            const ms = tag[3] ? parseInt(tag[3].padEnd(3, '0'), 10) : 0;
            items.push({ time: Math.round(mins * 60 + secs + ms / 1000), text });
        });
    });
    // If two lines round to the same second (fast-sung lyrics), nudge the later one forward
    // by 1s so both still get their own popup instead of one silently overwriting the other.
    items.sort((a, b) => a.time - b.time);
    for (let i = 1; i < items.length; i++) {
        if (items[i].time <= items[i - 1].time) items[i].time = items[i - 1].time + 1;
    }
    return items;
}

// Lightweight keyword-based mood guesser, since LRCLIB has no mood data of its own.
function guessMood(text) {
    const t = text.toLowerCase();
    if (/\b(love|heart|kiss|darling|forever|baby)\b/.test(t)) return 'love';
    if (/\b(cry|tears?|lonely|alone|sorry|pain|hurt|goodbye|miss you)\b/.test(t)) return 'sad';
    if (/\b(hate|angry|mad|rage|damn|liar|leave me)\b/.test(t)) return 'angry';
    if (/\b(dance|party|happy|laugh|celebrate|fun|yeah+)\b/.test(t)) return 'happy';
    if (/\b(whisper|silence|quiet|soft|slow(ly)?)\b/.test(t)) return 'quiet';
    return 'regular';
}

document.getElementById('fetch-lyrics-btn').addEventListener('click', async () => {
    const artist = document.getElementById('fetch-artist').value.trim();
    const title = document.getElementById('fetch-title').value.trim();
    const btn = document.getElementById('fetch-lyrics-btn');
    const startBtn = document.getElementById('start-btn');
    if (!artist || !title) {
        alert("Enter both an artist and a song title first.");
        return;
    }
    btn.innerHTML = `<i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i> Fetching...`;
    lucide.createIcons();

    try {
        const lrc = await fetchLrcLyrics(artist, title);

        if (lrc && lrc.synced && lrc.lrc) {
            // Best case: exact, line-by-line real timestamps from the official recording.
            const items = parseLrcToLines(lrc.lrc);
            if (items.length > 0) {
                const templated = items.map(it => `[${it.time}] ${it.text} | ${guessMood(it.text)}`).join('\n');
                document.getElementById('lyrics-input').value = templated;
                startBtn.disabled = false;
                startBtn.classList.remove('opacity-40', 'cursor-not-allowed');
                alert(`✅ Found exact synced lyrics (${items.length} lines) with real timestamps from the official recording. Instrumental sections have no line, so no popups will fire during them. Note: if you load a different remix/live version on YouTube, its timing may drift slightly from these - nudge [seconds] values if so.`);
            } else {
                alert("Found a synced-lyrics match but couldn't parse any usable lines. Try manual entry.");
            }
        } else {
            // No exact sync available anywhere - fall back to plain text (LRCLIB's own plain
            // lyrics if it had them, otherwise lyrics.ovh) and warn clearly that this is a guess.
            let plainText = (lrc && lrc.plain) ? lrc.plain : null;
            let spanSeconds = (lrc && lrc.duration) ? lrc.duration : 180;

            if (!plainText) {
                const res = await fetch(`https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`);
                const data = await res.json();
                if (data.lyrics) plainText = data.lyrics;
            }

            if (plainText) {
                const lines = plainText.split('\n').filter(l => l.trim().length > 0);
                const gap = Math.max(1, Math.floor(spanSeconds / (lines.length + 1)));
                const templated = lines.map((line, i) => `[${(i + 1) * gap}] ${line.trim()} | regular`).join('\n');
                document.getElementById('lyrics-input').value = templated;
                startBtn.disabled = false;
                startBtn.classList.remove('opacity-40', 'cursor-not-allowed');
                alert("⚠️ No exact synced timestamps exist for this song, so lyrics were spread evenly across the track as a rough guess - this WILL pop up windows during instrumental parts, since it doesn't know where they are. Delete any lines that land in an instrumental section, or manually adjust [seconds] by ear for real sync.");
            } else {
                alert("No lyrics found for that song anywhere. Try a different spelling, or type lyrics in manually.");
            }
        }
    } catch (err) {
        alert("Lyrics services are busy right now. Feel free to type timestamps manually.");
    }

    btn.innerHTML = `<i data-lucide="download" class="w-3.5 h-3.5"></i> Fetch`;
    lucide.createIcons();
});

document.getElementById('progress-bar-container').addEventListener('click', (e) => {
    if (!trackReady) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percent = clickX / rect.width;
    const seekTime = Math.floor(percent * trackDuration);
    currentTime = seekTime;

    
    firedTimes.forEach(t => { if (t >= seekTime) firedTimes.delete(t); });

    if (usingSpotify && spotifyController) {
        try { spotifyController.seek(seekTime); } catch (e) {}
    } else if (!isUsingFallbackMode && ytPlayer && ytPlayer.seekTo) {
        ytPlayer.seekTo(seekTime, true);
    }
    updateProgressBar();
});

function updateProgressBar() {
    const bar = document.getElementById('progress-bar');
    const percent = Math.min(100, (currentTime / trackDuration) * 100);
    bar.style.width = `${percent}%`;
    document.getElementById('current-time').innerText = formatSeconds(currentTime);
}

function parseLyrics() {
    const text = document.getElementById('lyrics-input').value;
    const lines = text.split('\n');
    const items = [];
    
    lines.forEach(line => {
        const match = line.match(/^\[(\d+)\]\s*([^|]+)(?:\|\s*(\w+))?/);
        if (match) {
            items.push({
                time: parseInt(match[1]),
                text: match[2].trim(),
                emotion: match[3] ? match[3].trim().toLowerCase() : 'regular'
            });
        }
    });
    return items.sort((a,b) => a.time - b.time);
}

function formatSeconds(secs) {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = Math.floor(secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

function setTheme(themeName) {
    selectedTheme = themeName;
    document.getElementById('current-theme-lbl').innerText = themeName === 'win95' ? 'Windows 95' :
                                                             themeName === 'winXP' ? 'Windows XP' :
                                                             themeName === 'winMac' ? 'macOS Glass' : 'Windows 10/11';
}

// Tutorial Video

function initTutorialVideo() {
    const tutorialVideo = document.getElementById("tutorial-video");
    const tutorialPlayBtn = document.getElementById("tutorial-play-btn");

    if (!tutorialVideo || !tutorialPlayBtn) {
        console.error("Tutorial video elements not found.");
        return;
    }

    if (tutorialPlayBtn.dataset.bound === "true") return;
    tutorialPlayBtn.dataset.bound = "true";

    tutorialPlayBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();

        tutorialVideo.controls = true;

        try {
            await tutorialVideo.play();
            tutorialPlayBtn.style.display = "none";
        } catch (err) {
            console.error("Tutorial video failed to play:", err);
            alert("Couldn't play the tutorial video. Make sure assets/tutorial.mp4 exists in your repo.");
        }
    });

    tutorialVideo.addEventListener("ended", () => {
        tutorialVideo.currentTime = 0;
        tutorialVideo.controls = false;
        tutorialPlayBtn.style.display = "flex";
    });
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initTutorialVideo);
} else {
    initTutorialVideo();
}

