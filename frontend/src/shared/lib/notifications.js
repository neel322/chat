// chat-frontend/src/shared/lib/notifications.js

// ─────────────────────────────────────────────────────────────────────────────
// MOBILE AUDIO — WHY HTML5 Audio + explicit priming?
//
// Web Audio API AudioContext.resume() called from a WebSocket event is NOT a
// user gesture on iOS/Android, so it silently fails every time. HTML5 <audio>
// elements, once .play()'d during a REAL gesture, retain their permission for
// subsequent async plays (socket events). The guaranteed moment to prime is
// when the user types in the MessageInput — that's always before a reply can
// arrive. Call primeAudio() from MessageInput.onChange.
//
// We build the chime as a WAV data-URI so there are no Blob/ObjectURL issues.
// ─────────────────────────────────────────────────────────────────────────────

// ── helpers ──────────────────────────────────────────────────────────────────

function int32LE(n) {
  return [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff];
}
function int16LE(n) {
  return [n & 0xff, (n >> 8) & 0xff];
}

/**
 * Synthesise a D5→A5 chime and return it as a WAV data URI (base64).
 * Uses 8-bit unsigned PCM at 8 kHz — simplest possible format, universally
 * supported by every browser Audio element.
 */
function buildChimeDataUri() {
  const sampleRate = 8000;
  const duration   = 0.38; // seconds
  const numSamples = Math.floor(sampleRate * duration);

  // 8-bit unsigned PCM: 128 = silence, 0..255 range
  const pcm = new Uint8Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    const t    = i / sampleRate;
    const freq = t < 0.13 ? 587.33 : 880; // D5 then A5
    const env  = Math.pow(1 - t / duration, 1.8); // smooth decay
    const s    = Math.sin(2 * Math.PI * freq * t) * env * 0.75;
    pcm[i]     = Math.max(0, Math.min(255, Math.round(128 + s * 127)));
  }

  const dataLen = numSamples; // 1 byte per sample (8-bit)

  // Build WAV header as a flat byte array
  const header = [
    // RIFF chunk
    0x52, 0x49, 0x46, 0x46,          // "RIFF"
    ...int32LE(36 + dataLen),        // file size - 8
    0x57, 0x41, 0x56, 0x45,          // "WAVE"
    // fmt sub-chunk
    0x66, 0x6d, 0x74, 0x20,          // "fmt "
    0x10, 0x00, 0x00, 0x00,          // chunk size = 16
    0x01, 0x00,                      // AudioFormat = PCM
    0x01, 0x00,                      // NumChannels = 1 (mono)
    ...int32LE(sampleRate),          // SampleRate
    ...int32LE(sampleRate * 1 * 1),  // ByteRate = SampleRate*Channels*BitsPerSample/8
    ...int16LE(1),                   // BlockAlign = 1
    ...int16LE(8),                   // BitsPerSample = 8
    // data sub-chunk
    0x64, 0x61, 0x74, 0x61,          // "data"
    ...int32LE(dataLen),
  ];

  // Combine into one array
  const wav = new Uint8Array(header.length + dataLen);
  wav.set(header, 0);
  wav.set(pcm, header.length);

  // base64-encode without btoa(String.fromCharCode(...)) which blows the stack
  // for large arrays — use a chunk approach instead.
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < wav.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, wav.subarray(i, i + CHUNK));
  }
  return 'data:audio/wav;base64,' + btoa(bin);
}

// ── singleton audio element ───────────────────────────────────────────────────

let _audio        = null; // the <audio> element
let _primed       = false; // has play() succeeded in a gesture yet?
let _dataUri      = null; // cached data URI

function getDataUri() {
  if (!_dataUri) _dataUri = buildChimeDataUri();
  return _dataUri;
}

function getAudio() {
  if (_audio) return _audio;
  try {
    _audio         = new Audio(getDataUri());
    _audio.preload = 'auto';
    _audio.volume  = 1;
  } catch (e) {
    console.warn('[audio] Could not create Audio element:', e);
  }
  return _audio;
}

// ── public: prime the audio element ─────────────────────────────────────────

/**
 * Call this inside ANY real user-gesture handler (e.g. MessageInput onChange).
 * It plays the element at near-zero volume then immediately pauses, which is
 * the handshake iOS/Android browsers need before allowing async audio play.
 * Safe to call many times — no-ops after the first successful prime.
 */
export const primeAudio = () => {
  if (_primed) return;
  const audio = getAudio();
  if (!audio) return;

  audio.volume = 0.001;
  const p = audio.play();
  if (p && typeof p.then === 'function') {
    p.then(() => {
      audio.pause();
      audio.currentTime = 0;
      audio.volume = 1;
      _primed = true;
    }).catch(() => {
      audio.volume = 1;
    });
  } else {
    // Old browsers: play() is synchronous
    audio.pause();
    audio.currentTime = 0;
    audio.volume = 1;
    _primed = true;
  }
};

// ── public: unlock on first interaction (keep for early-bird case) ───────────

/**
 * Register passive capture-phase listeners that call primeAudio() on the very
 * first gesture. Call once at app start (SocketProvider). This covers the case
 * where the user taps/clicks something other than the message input first.
 */
export const unlockAudioOnFirstInteraction = () => {
  if (_primed) return;
  const EVENTS = ['touchstart', 'pointerdown', 'click', 'keydown'];

  const handler = () => {
    EVENTS.forEach((e) => document.removeEventListener(e, handler, true));
    primeAudio();
  };

  EVENTS.forEach((e) =>
    document.addEventListener(e, handler, { capture: true, passive: true })
  );
};

// ── public: play the chime ────────────────────────────────────────────────────

/**
 * Play the notification chime. Works reliably if primeAudio() has been called
 * at least once during a prior user gesture.
 */
export const playNotificationSound = () => {
  try {
    const audio = getAudio();
    if (!audio) return;
    audio.currentTime = 0;
    audio.volume      = 1;
    const p = audio.play();
    if (p && typeof p.catch === 'function') {
      p.catch((err) => {
        // NotAllowedError = not yet primed; AbortError = rapid replays — both ignorable
        if (err?.name !== 'NotAllowedError' && err?.name !== 'AbortError') {
          console.warn('[audio] play() failed:', err);
        }
      });
    }
  } catch (err) {
    console.warn('[audio] playNotificationSound error:', err);
  }
};

// ── browser notifications ─────────────────────────────────────────────────────

export const requestNotificationPermission = async () => {
  if ('Notification' in window && Notification.permission === 'default') {
    await Notification.requestPermission();
  }
};

export const showBrowserNotification = (title, body, onClick) => {
  if ('Notification' in window && Notification.permission === 'granted') {
    if (document.visibilityState === 'visible') return;
    const n = new Notification(title, { body, icon: '/favicon.ico' });
    if (onClick) {
      n.onclick = () => { window.focus(); onClick(); };
    }
  }
};