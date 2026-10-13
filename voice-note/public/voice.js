import { state, notify, appendTranscript, persistDraft, escapeHTML } from './app.js';
import { transact } from './db.js';
import { icon } from './icons.js';
import { SegmentQueue } from './segment-queue.js';
const root = document.getElementById('recording-controls');
root.innerHTML = `<div class="recording-language"><label for="voice-language">Spoken language</label><select id="voice-language"><option value="en">English</option><option value="te">Telugu · తెలుగు</option></select></div><div class="recording-bar"><span class="voice-mark">${icon('mic',20)}</span><div class="voice-status"><strong id="voice-state">Ready</strong><span id="voice-detail">Speak naturally. We’ll take it from here.</span></div><span class="voice-wave" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span><button id="record-button" class="record-button">${icon('mic',15)} Start recording</button></div><div id="voice-error" class="inline-error" role="alert" hidden></div>`;
const languageSelect = document.getElementById('voice-language');
try { const saved = localStorage.getItem('voice-note-language'); if (['en','te'].includes(saved)) languageSelect.value = saved; } catch {}
languageSelect.onchange = () => { try { localStorage.setItem('voice-note-language',languageSelect.value); } catch {} };
document.getElementById('note-content').placeholder = 'Every great idea starts with a thought.\n\nType yours here, or let your voice do the work.';
let stream, recorder, segmentTimer, elapsedTimer, recording = false, starting = false, finalizing = 0, sequence = 0, startedAt;
let pendingWrites = Promise.resolve();
let sessionLanguage = languageSelect.value;
const queue = new SegmentQueue({send:sendSegment,commit:async(segment,text) => { await appendTranscript(segment,text); if(!text) notify('No speech detected in this segment. Try speaking closer to the microphone.'); },onState:render});
function render() {
  const busy = recording || starting || finalizing > 0 || queue.items.length > 0;
  document.body.classList.toggle('voice-busy',busy);
  document.body.classList.toggle('recording-live',recording);
  languageSelect.disabled = busy;
  const label = queue.failed || document.getElementById('voice-error').dataset.microphone ? 'Error' : starting ? 'Requesting microphone…' : recording ? 'Recording…' : queue.running || queue.items.length || finalizing ? 'Transcribing…' : startedAt ? 'Stopped' : 'Ready';
  document.getElementById('voice-state').textContent = label;
  document.getElementById('voice-detail').textContent = recording ? `${Math.floor((Date.now()-startedAt)/1000)}s · ${queue.items.length ? 'Transcribing audio segments' : 'Listening to your microphone'}` : queue.running ? 'Sending recorded audio to Groq…' : startedAt ? 'Keep writing, or record another thought.' : 'Speak naturally. We’ll take it from here.';
  const button = document.getElementById('record-button');
  button.innerHTML = recording ? `${icon('stop',14)} Stop recording` : `${icon('mic',15)} Start recording`;
  button.disabled = starting || (!recording && (!!queue.items.length || !!finalizing));
  button.classList.toggle('is-recording',recording);
  const error = document.getElementById('voice-error');
  if(queue.failed) { error.hidden = false; error.innerHTML = `<span>${escapeHTML(queue.failed.message)} Audio is kept in this browser for retry.</span><button id="retry-voice" class="secondary">${icon('refresh',15)} Retry transcription</button>`; document.getElementById('retry-voice').onclick = () => { error.hidden = true; queue.retry(); }; }
  else if (!error.dataset.microphone) error.hidden = true;
}
async function sendSegment(segment) {
  const form = new FormData(); const extension = segment.blob.type.includes('mp4') ? 'mp4' : segment.blob.type.includes('ogg') ? 'ogg' : 'webm';
  form.append('audio',segment.blob,`recording.${extension}`); form.append('segmentId',segment.id); form.append('language',segment.language || 'en');
  let response; try { response = await fetch('/api/transcribe',{method:'POST',body:form,signal:AbortSignal.timeout(70000)}); } catch { throw new Error(navigator.onLine ? 'The transcription request timed out or could not connect.' : 'You are offline. Reconnect and retry.'); }
  let data; try { data = await response.json(); } catch { throw new Error('The transcription response could not be read. Please retry.'); }
  if(!response.ok) throw new Error(data.error || 'Voice transcription failed. Please retry.');
  if(data.segmentId !== segment.id || typeof data.text !== 'string') throw new Error('The transcription response did not match this audio segment. Please retry.');
  return data.text;
}
function microphoneError(error) {
  const messages = { NotAllowedError:'Microphone access was denied. Allow microphone access in your browser, then try again.', NotFoundError:'No microphone was found. Connect a microphone and try again.', NotReadableError:'Your microphone is in use or unavailable. Close other recording apps and try again.', SecurityError:'Microphone recording requires HTTPS or localhost.' };
  return messages[error.name] || error.message || 'Recording failed. Please try again. You can still type your note.';
}
function showError(message) { const el = document.getElementById('voice-error'); el.dataset.microphone = 'true'; el.hidden = false; el.textContent = message; notify(message,true); render(); }
function startSegment(mimeType) {
  // Every stop/start produces a complete decodable file, unlike slicing WebM blobs.
  const parts = []; const id = crypto.randomUUID(); const nextSequence = sequence++; const noteId = state.draft.noteId;
  const instance = new MediaRecorder(stream,mimeType ? {mimeType} : undefined); recorder = instance;
  instance.ondataavailable = e => { if(e.data.size) parts.push(e.data); };
  instance.onerror = () => { showError('Recording failed. Previously captured audio and your note are kept.'); stop(); };
  instance.onstop = () => {
    finalizing++;
    if(recording) { try { startSegment(mimeType); } catch(error) { showError(microphoneError(error)); stop(); } }
    const blob = new Blob(parts,{type:instance.mimeType || mimeType || 'audio/webm'});
    if (blob.size < 100) { finalizing--; if(!recording) showError('The recording was empty. Speak for a few seconds and try again.'); render(); return; }
    const segment = { id, sequence:nextSequence, noteId, blob, language:sessionLanguage };
    pendingWrites = pendingWrites.then(async () => { await transact('recordings','put',segment); queue.add(segment); }).catch(error => { showError(error.message); // Keep unsaved audio in memory too.
      queue.add(segment);
    }).finally(() => { finalizing--; render(); });
    render();
  };
  instance.start();
  clearTimeout(segmentTimer); segmentTimer = setTimeout(() => { if(instance.state === 'recording') instance.stop(); },8000);
}
function stop() { recording = false; clearTimeout(segmentTimer); clearInterval(elapsedTimer); if(recorder?.state === 'recording') { finalizing++; recorder.addEventListener('stop',() => { finalizing--; render(); },{once:true}); recorder.stop(); } stream?.getTracks().forEach(track => track.stop()); stream = null; render(); }
async function start() {
  if(recording) { stop(); return; }
  if(starting || queue.items.length) return;
  if (!navigator.mediaDevices?.getUserMedia) { showError('This browser cannot access the microphone. Use HTTPS or localhost in a supported browser. You can still type notes.'); return; }
  if (!window.MediaRecorder) { showError('This browser does not support audio recording. Try a current version of Chrome, Firefox, or Safari. You can still type notes.'); return; }
  sessionLanguage = languageSelect.value;
  starting = true; delete document.getElementById('voice-error').dataset.microphone; document.getElementById('voice-error').hidden = true; render();
  try {
    await persistDraft(); stream = await navigator.mediaDevices.getUserMedia({ audio:{ echoCancellation:true, noiseSuppression:true }, video:false });
    const mimeType = ['audio/webm;codecs=opus','audio/webm','audio/mp4','audio/ogg;codecs=opus'].find(type => MediaRecorder.isTypeSupported(type));
    recording = true; startedAt = Date.now(); startSegment(mimeType); elapsedTimer = setInterval(render,1000);
    stream.getAudioTracks().forEach(track => track.onended = () => { if(recording) { showError('The microphone was disconnected. Captured segments are kept.'); stop(); } });
  } catch(error) { stop(); showError(microphoneError(error)); }
  finally { starting = false; render(); }
}
document.getElementById('record-button').onclick = start;
document.addEventListener('visibilitychange',() => { if(document.hidden && recording) stop(); });
window.addEventListener('pagehide',stop);
const recovered = (await transact('recordings','getAll')).filter(s => s.noteId === state.draft.noteId).sort((a,b) => a.sequence-b.sequence);
if(recovered.length) { queue.failed = new Error('An unfinished recording was recovered.'); recovered.forEach(s => queue.add(s)); sequence = Math.max(...recovered.map(s=>s.sequence))+1; render(); }
