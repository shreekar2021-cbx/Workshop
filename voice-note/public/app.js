import { transact, openDB, commitTranscript } from './db.js';
import { icon } from './icons.js';
const $ = (id) => document.getElementById(id);
export const escapeHTML = (text) => String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const state = { notes: [], draft: null, view: 'overview', ready: false, saving: false, storageFailed: false };
let draftWrites = Promise.resolve();
let pendingDraft = null, writingDraft = false, noteLimit = 40;
let toastTimer;
export function notify(message, error = false) { $('toast').textContent = message; $('toast').classList.toggle('error', error); $('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').hidden = true, error ? 8000 : 4000); }
export function fillIcons(root = document) { root.querySelectorAll('[data-icon]').forEach(el => el.innerHTML = icon(el.dataset.icon)); }
export function persistDraft() {
  if (!state.ready) return draftWrites;
  // Keep the newest snapshot instead of queuing a disk transaction for every key.
  pendingDraft = structuredClone(state.draft);
  if (writingDraft) return draftWrites;
  writingDraft = true;
  draftWrites = draftWrites.catch(() => {}).then(async () => {
    try {
      while (pendingDraft) {
        const draft = pendingDraft; pendingDraft = null;
        await transact('drafts', 'put', draft);
      }
    } finally { writingDraft = false; }
  });
  draftWrites.catch(error => { state.storageFailed = true; $('save-state').textContent = 'Draft storage failed'; notify(error.message, true); });
  return draftWrites;
}
function newDraft() { return { id: 'current', noteId: crypto.randomUUID(), title: '', content: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }; }
export function getContent() { return $('note-content').value; }
export function changeContent(content) { $('note-content').value = content; changed(); }
export async function appendTranscript(segment,text) {
  // Draft and audio acknowledgement commit atomically, including across reloads.
  await draftWrites.catch(() => {});
  const original = getContent();
  const draft = { ...state.draft, title:$('note-title').value, content:original + (original.trim() && text ? '\n' : '') + text };
  const write = commitTranscript(draft,segment);
  draftWrites = write;
  await write;
  if (getContent() !== original || $('note-title').value !== draft.title) {
    // Preserve any manual edits made while IndexedDB finished committing.
    state.draft = { ...state.draft, title:$('note-title').value, content:getContent() + (getContent().trim() && text ? '\n' : '') + text };
    $('note-content').value = state.draft.content;
    // The segment is already acknowledged atomically. A later draft error must
    // not cause the same audio to be appended again on retry.
    await persistDraft().catch(error => notify(error.message,true));
  } else { state.draft = draft; $('note-content').value = draft.content; }
  $('word-count').textContent = `${draft.content.trim() ? draft.content.trim().split(/\s+/).length : 0} words`;
  $('save-state').textContent = 'Draft kept locally';
  document.dispatchEvent(new CustomEvent('note-edited'));
}
function changed() {
  state.draft.title = $('note-title').value; state.draft.content = getContent();
  $('word-count').textContent = `${getContent().trim() ? getContent().trim().split(/\s+/).length : 0} words`;
  $('save-state').textContent = 'Draft kept locally';
  persistDraft();
  document.dispatchEvent(new CustomEvent('note-edited'));
}
function loadEditor() {
  $('note-title').value = state.draft.title; $('note-content').value = state.draft.content;
  $('editor-label').textContent = state.notes.some(n => n.id === state.draft.noteId) ? 'Your thought' : 'New thought';
  $('delete-note').hidden = !state.notes.some(n => n.id === state.draft.noteId);
  $('word-count').textContent = `${state.draft.content.trim() ? state.draft.content.trim().split(/\s+/).length : 0} words`;
  $('save-state').textContent = 'Ready to write';
  renderNotes(); document.dispatchEvent(new CustomEvent('note-opened'));
}
function formatDate(date) { return new Date(date).toLocaleDateString(undefined, { day:'numeric', month:'short' }); }
export function renderNotes() {
  $('nav-count').textContent = state.notes.length; $('total-notes').textContent = state.notes.length;
  $('week-notes').textContent = state.notes.filter(n => Date.now() - new Date(n.createdAt).getTime() <= 7*86400000).length;
  $('list-count').textContent = state.notes.length;
  const query = $('note-search').value.trim().toLocaleLowerCase();
  const filtered = query ? state.notes.filter(n => n.title.toLocaleLowerCase().includes(query) || n.content.toLocaleLowerCase().includes(query)) : state.notes;
  const limit = query || state.view === 'notes' ? noteLimit : 4;
  const notes = filtered.slice(0, limit);
  $('load-more').hidden = filtered.length <= limit;
  $('notes-list').innerHTML = notes.length ? notes.map(n => `<button class="note-card ${n.id === state.draft.noteId ? 'selected' : ''}" data-note="${n.id}"><span class="card-top"><span class="card-icon">${icon('note',17)}</span><span>Updated ${escapeHTML(formatDate(n.updatedAt))}</span></span><strong>${escapeHTML(n.title)}</strong><p>${escapeHTML(n.content.slice(0, 130))}</p><span class="card-bottom"><span>Created ${escapeHTML(formatDate(n.createdAt))}</span>${icon('arrow',16)}</span></button>`).join('') : `<div class="empty-notes"><span>${icon('book',32)}</span><h3>A blank canvas. Infinite potential.</h3><p>Your next idea belongs here.<br>Capture a thought to start your collection.</p><button class="secondary" id="empty-create">${icon('plus',17)} Capture your first thought</button></div>`;
  if (query && !notes.length) $('notes-list').innerHTML = '<div class="empty-notes"><span>'+icon('search',28)+'</span><h3>No matching thoughts.</h3><p>Try a different word or clear your search.</p></div>';
  $('activity-list').innerHTML = state.notes.length ? state.notes.slice(0,3).map(n => `<div class="activity-row"><span class="activity-dot"></span><div><p>${escapeHTML(n.title)}</p><span>${n.updatedAt === n.createdAt ? 'Created' : 'Updated'} · ${escapeHTML(formatDate(n.updatedAt))}</span></div></div>`).join('') : '<p class="empty-activity">Your next saved thought starts the stream.</p>';
}
export function confirmAction(title, message, label) {
  return new Promise(resolve => {
    const dialog = $('confirm-dialog'); $('dialog-title').textContent = title; $('dialog-message').textContent = message; $('dialog-confirm').textContent = label;
    function finish(result) { dialog.close(); $('dialog-confirm').removeEventListener('click', accept); $('dialog-cancel').removeEventListener('click', cancel); dialog.removeEventListener('cancel', cancel); resolve(result); }
    const accept = () => finish(true), cancel = (e) => { e?.preventDefault(); finish(false); };
    $('dialog-confirm').addEventListener('click', accept); $('dialog-cancel').addEventListener('click', cancel); dialog.addEventListener('cancel', cancel); dialog.showModal();
  });
}
async function canSwitch() {
  if (state.saving) { notify('Wait for this note to finish saving.'); return false; }
  if (document.body.classList.contains('voice-busy')) { notify('Stop recording and finish or retry transcription before opening another note.', true); return false; }
  const saved = state.notes.find(n => n.id === state.draft.noteId);
  if ((state.draft.title.trim() || state.draft.content.trim()) && (!saved || saved.title !== state.draft.title || saved.content !== state.draft.content)) {
    return confirmAction('Save your changes first?', 'Your draft is kept if you cancel. Save it before opening another note, or discard this draft.', 'Discard draft');
  }
  return true;
}
async function createNote() { if (!state.ready || !await canSwitch()) return; await draftWrites.catch(() => {}); state.draft = newDraft(); await persistDraft(); loadEditor(); $('note-title').focus(); }
async function openNote(id) { if(id === state.draft.noteId || !await canSwitch()) return; await draftWrites.catch(() => {}); const n = state.notes.find(n => n.id === id); state.draft = { ...n, id:'current', noteId:n.id }; await persistDraft(); loadEditor(); }
async function saveNote() {
  if (!state.ready || state.saving) return;
  if (!getContent().trim()) { notify('Add a little text before saving your note.', true); $('note-content').focus(); return; }
  state.saving = true; $('save-note').disabled = true; $('save-state').textContent = 'Saving…';
  const snapshot = { ...state.draft };
  try {
    await draftWrites;
    const previous = state.notes.find(n => n.id === snapshot.noteId);
    const note = { id: snapshot.noteId, title: snapshot.title.trim() || 'Untitled note', content:snapshot.content, createdAt:previous?.createdAt || new Date().toISOString(), updatedAt:new Date().toISOString() };
    await transact('notes','put',note);
    state.notes = [note,...state.notes.filter(n => n.id !== note.id)];
    if (state.draft.noteId === snapshot.noteId && state.draft.content === snapshot.content && state.draft.title === snapshot.title) {
      state.draft = { ...note, id:'current', noteId:note.id }; $('note-title').value = note.title; await persistDraft(); $('save-state').textContent = 'Note saved';
    } else $('save-state').textContent = 'New changes in draft';
    state.storageFailed = false; $('editor-label').textContent = 'Your thought'; $('delete-note').hidden = false; renderNotes(); notify('Note saved');
  } catch (error) { $('save-state').textContent = 'Save failed'; notify(error.message,true); }
  finally { state.saving = false; $('save-note').disabled = false; }
}
async function deleteNote() {
  if (document.body.classList.contains('voice-busy')) { notify('Finish or retry transcription before deleting this note.',true); return; }
  if (!await confirmAction('Delete this note?', 'This permanently removes the note and its generated report from this browser.', 'Delete note')) return;
  try { await draftWrites; await transact('notes','delete',state.draft.noteId); await transact('reports','delete',state.draft.noteId); state.notes = state.notes.filter(n => n.id !== state.draft.noteId); state.draft = newDraft(); await persistDraft(); loadEditor(); notify('Note deleted'); }
  catch(error) { notify(error.message,true); }
}
function navigate(view) {
  state.view = view; noteLimit = 40;
  for (const [id, selected] of [['nav-overview', view === 'overview'], ['nav-notes', view === 'notes']]) {
    $(id).classList.toggle('active', selected);
    if (selected) $(id).setAttribute('aria-current', 'page'); else $(id).removeAttribute('aria-current');
  }
  $('overview-panel').hidden = view !== 'overview'; $('activity-panel').hidden = view !== 'overview';
  $('page-title').innerHTML = view === 'overview' ? 'Think at the<br>speed of <em>sound.</em>' : 'Your universe<br>of <em>thoughts.</em>';
  $('page-subtitle').innerHTML = view === 'overview' ? 'A space for your next big idea.<br>Speak it into existence. Let clarity follow.' : 'Every idea, within reach.<br>Search your signals. Pick up where you left off.';
  $('list-title').firstChild.textContent = view === 'overview' ? 'Recent signals ' : 'Note library ';
  $('breadcrumb').innerHTML = `Workspace <span>/</span> ${view === 'overview' ? 'Command center' : 'Note library'}`;
  renderNotes();
}
fillIcons();
$('today').textContent = new Date().toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'});
for(const id of ['sidebar-new','new-note']) $(id).addEventListener('click',createNote);
$('nav-overview').addEventListener('click',() => navigate('overview')); $('nav-notes').addEventListener('click',() => navigate('notes'));
$('note-title').addEventListener('input',changed); $('note-content').addEventListener('input',changed);
$('save-note').addEventListener('click',saveNote); $('delete-note').addEventListener('click',deleteNote);
$('notes-list').addEventListener('click', e => {
  const card = e.target.closest('[data-note]');
  if (card) openNote(card.dataset.note);
  else if (e.target.closest('#empty-create')) createNote();
});
$('note-search').addEventListener('input', () => { noteLimit = 40; renderNotes(); });
$('load-more').addEventListener('click', () => {
  if (state.view === 'overview' && !$('note-search').value.trim()) navigate('notes');
  else { noteLimit += 40; renderNotes(); }
});
$('capture-note').addEventListener('click', () => { document.querySelector('.editor-panel').scrollIntoView({behavior:document.body.classList.contains('motion-paused') || matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',block:'start'}); $('note-content').focus({preventScroll:true}); });
const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
document.querySelector('.shortcut-hint').textContent = isMac ? '⌘ ⇧ N' : 'Ctrl ⇧ N';
document.querySelector('.save-shortcut').textContent = isMac ? '⌘ S' : 'Ctrl S';
document.addEventListener('keydown', e => {
  if ($('confirm-dialog').open) return;
  const key = e.key.toLowerCase(), command = e.metaKey || e.ctrlKey;
  if (command && key === 's') { e.preventDefault(); saveNote(); }
  if (command && e.shiftKey && key === 'n') { e.preventDefault(); createNote(); }
  if (e.key === '/' && !command && !['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)) { e.preventDefault(); $('note-search').focus(); }
});
let motionPaused = false;
try { motionPaused = localStorage.getItem('echo-motion-paused') === 'true'; } catch {}
function updateMotion() {
  document.body.classList.toggle('motion-paused', motionPaused);
  document.documentElement.style.scrollBehavior = motionPaused ? 'auto' : '';
  const button = $('motion-toggle');
  button.setAttribute('aria-pressed', String(motionPaused));
  button.setAttribute('aria-label', motionPaused ? 'Resume animations' : 'Pause animations');
  button.title = motionPaused ? 'Resume animations' : 'Pause animations';
  button.innerHTML = icon(motionPaused ? 'play' : 'pause');
}
updateMotion();
$('motion-toggle').addEventListener('click', () => { motionPaused = !motionPaused; updateMotion(); try { localStorage.setItem('echo-motion-paused', String(motionPaused)); } catch {} });
document.addEventListener('visibilitychange', () => document.body.classList.toggle('tab-hidden', document.hidden));
// Short CSS ripples add feedback without an animation loop or extra dependencies.
document.addEventListener('pointerdown', e => {
  if (document.body.classList.contains('motion-paused') || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const button = e.target.closest('.primary,.secondary,.icon-button,.record-button,.nav-item,.report-action');
  if (!button || button.disabled || e.button !== 0) return;
  const rect = button.getBoundingClientRect(), burst = document.createElement('span');
  burst.className = 'click-burst'; burst.setAttribute('aria-hidden', 'true');
  burst.style.left = `${e.clientX - rect.left}px`; burst.style.top = `${e.clientY - rect.top}px`;
  button.append(burst); setTimeout(() => burst.remove(), 700);
});
window.addEventListener('beforeunload',e => { if(document.body.classList.contains('voice-busy') || state.storageFailed) { e.preventDefault(); e.returnValue = ''; } });
try { await openDB(); state.notes = (await transact('notes','getAll')).sort((a,b) => b.updatedAt.localeCompare(a.updatedAt)); state.draft = await transact('drafts','get','current') || newDraft(); state.ready = true; loadEditor(); document.dispatchEvent(new CustomEvent('notebook-ready')); }
catch(error) { state.draft = newDraft(); state.storageFailed = true; $('save-note').disabled = true; notify(error.message,true); }
if (state.ready) Promise.all([import('./voice.js'), import('./reports.js')]).catch(() => notify('A notebook component could not load. Reload to try again.',true));
