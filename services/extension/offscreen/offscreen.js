// Politica Transcription Worker - Offscreen Document
// Runs Whisper (via Transformers.js) locally in the browser.
// No API key required. Supports Hindi + English + auto-detect.

importScripts('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/transformers.min.js')

const { pipeline, env } = Transformers

// Use OPFS for caching so the model is downloaded only once
env.allowLocalModels = false
env.useBrowserCache = true

let transcriber = null
let isLoading = false

async function getTranscriber() {
  if (transcriber) return transcriber
  if (isLoading) {
    // Wait for the ongoing load to finish
    await new Promise(resolve => {
      const check = setInterval(() => {
        if (!isLoading) { clearInterval(check); resolve() }
      }, 200)
    })
    return transcriber
  }

  isLoading = true
  try {
    // whisper-small: ~250 MB download, good Hindi+English accuracy
    // Falls back automatically to WASM if WebGPU is unavailable
    transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-small', {
      chunk_length_s: 30,
      stride_length_s: 5,
      language: null,    // auto-detect
      task: 'transcribe',
    })
  } finally {
    isLoading = false
  }
  return transcriber
}

// Fetch a video/audio URL and convert to a Float32 PCM array at 16 kHz
// (the format Whisper requires)
async function fetchAudioBuffer(url) {
  const response = await fetch(url)
  const arrayBuffer = await response.arrayBuffer()

  // OfflineAudioContext resamples to 16 kHz
  const audioCtx = new OfflineAudioContext({ numberOfChannels: 1, length: 1, sampleRate: 16000 })
  const decoded = await new AudioContext().decodeAudioData(arrayBuffer)
  const source = audioCtx.createBufferSource()

  // Resample by creating a buffer at target rate
  const resampled = new OfflineAudioContext({
    numberOfChannels: 1,
    length: Math.ceil(decoded.duration * 16000),
    sampleRate: 16000,
  })
  const src = resampled.createBufferSource()

  // Copy mono channel from decoded audio
  const monoBuffer = resampled.createBuffer(1, Math.ceil(decoded.duration * 16000), 16000)
  const channelData = decoded.getChannelData(0)
  const target = monoBuffer.getChannelData(0)

  // Simple linear interpolation resample
  const ratio = decoded.sampleRate / 16000
  for (let i = 0; i < target.length; i++) {
    const srcIdx = i * ratio
    const lo = Math.floor(srcIdx)
    const hi = Math.min(lo + 1, channelData.length - 1)
    const frac = srcIdx - lo
    target[i] = channelData[lo] * (1 - frac) + channelData[hi] * frac
  }

  return target
}

// Capture a short audio clip from a MediaStream (used for blob/live video sources)
async function captureStreamAudio(stream, durationMs = 20000) {
  return new Promise((resolve, reject) => {
    const chunks = []
    const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' })
    recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data) }
    recorder.onstop = async () => {
      try {
        const blob = new Blob(chunks, { type: 'audio/webm' })
        const arrayBuffer = await blob.arrayBuffer()
        const audioCtx = new AudioContext()
        const decoded = await audioCtx.decodeAudioData(arrayBuffer)
        // Resample to 16 kHz mono Float32
        const targetRate = 16000
        const monoData = decoded.getChannelData(0)
        const ratio = decoded.sampleRate / targetRate
        const output = new Float32Array(Math.ceil(monoData.length / ratio))
        for (let i = 0; i < output.length; i++) {
          const srcIdx = i * ratio
          const lo = Math.floor(srcIdx)
          const hi = Math.min(lo + 1, monoData.length - 1)
          const frac = srcIdx - lo
          output[i] = monoData[lo] * (1 - frac) + monoData[hi] * frac
        }
        resolve(output)
      } catch (err) {
        reject(err)
      }
    }
    recorder.onerror = reject
    recorder.start()
    setTimeout(() => {
      if (recorder.state !== 'inactive') recorder.stop()
    }, durationMs)
  })
}

// Main message handler — receives from service worker
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== 'TRANSCRIBE_VIDEO') return false

  handleTranscription(message)
    .then(result => sendResponse({ success: true, transcription: result }))
    .catch(err => {
      console.error('[Offscreen] Transcription error:', err)
      sendResponse({ success: false, error: err.message })
    })

  return true // keep channel open for async response
})

async function handleTranscription(message) {
  const { videoSrc, captureStreamId } = message

  console.log('[Offscreen] Starting transcription, source type:', captureStreamId ? 'stream' : 'url')

  const asr = await getTranscriber()
  let audioData

  if (captureStreamId) {
    // Use tab capture stream when direct URL is unavailable (blob: URLs)
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: captureStreamId } })
    audioData = await captureStreamAudio(stream, 25000)
  } else if (videoSrc && !videoSrc.startsWith('blob:')) {
    audioData = await fetchAudioBuffer(videoSrc)
  } else {
    throw new Error('No valid audio source provided')
  }

  const result = await asr(audioData, {
    language: null,       // auto-detect (returns best guess between hi, en, etc.)
    task: 'transcribe',
    return_timestamps: false,
  })

  const text = Array.isArray(result) ? result.map(r => r.text).join(' ') : (result.text || '')
  console.log('[Offscreen] Transcription complete, length:', text.length)
  return text.trim()
}
