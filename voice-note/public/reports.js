import { state, getContent, notify, escapeHTML } from './app.js';
import { transact } from './db.js';
import { icon } from './icons.js';
const actions = {summary:{title:'Summary',icon:'lines',description:'The big picture, in fewer words.',verb:'summary'},insights:{title:'Important insights',icon:'insight',description:'The points worth coming back to.',verb:'insights'},recommendation:{title:'Recommendations',icon:'recommend',description:'A useful next step, grounded in your note.',verb:'recommendations'}};
const panel = document.getElementById('report-panel');
panel.innerHTML = `<div class="report-heading"><div><h2><span class="panel-number">03</span>Find the signal.</h2><p>Turn raw thoughts into a clearer next move.</p></div><span class="provider-label">POWERED BY GROQ</span></div><div class="report-grid">${Object.entries(actions).map(([key,action]) => `<section class="report-card" aria-labelledby="label-${key}"><div class="report-card-heading"><span>${icon(action.icon,18)}</span><h3 id="label-${key}">${action.title}</h3></div><div class="report-result" id="result-${key}"><p class="report-placeholder">${action.description}</p></div><p class="report-error" id="error-${key}" role="alert" hidden></p><button class="report-action" id="generate-${key}">Generate ${action.verb}${icon('arrow',15)}</button></section>`).join('')}</div><div class="export-bar"><div><span class="export-icon">${icon('download',20)}</span><div><strong>Ideas without boundaries.</strong><p>Export your note, or save a clean PDF.</p></div></div><div class="export-actions"><label><input type="checkbox" id="include-report">Include generated information</label><button id="export-txt" class="secondary">${icon('download',16)} TXT</button><button id="export-print" class="secondary">${icon('print',16)} Print / PDF</button></div></div>`;
let report = null, busy = null, generation = 0;
const rendered = new Map();
function render() {
  const current = report?.sourceContent === getContent();
  for (const [key,action] of Object.entries(actions)) {
    const result = current && report?.results?.[key];
    if (rendered.get(key) !== (result || '')) {
      document.getElementById(`result-${key}`).innerHTML = result ? `<p class="generated-text">${escapeHTML(result)}</p>` : `<p class="report-placeholder">${action.description}</p>`;
      rendered.set(key, result || '');
    }
    const button = document.getElementById(`generate-${key}`);
    const buttonHTML = busy === key ? `Generating ${action.verb}…${icon('refresh',15)}` : `${result ? 'Regenerate' : 'Generate'} ${action.verb}${icon('arrow',15)}`;
    if (rendered.get(`button-${key}`) !== buttonHTML) { button.innerHTML = buttonHTML; rendered.set(`button-${key}`,buttonHTML); }
    button.setAttribute('aria-busy', String(busy === key));
    button.disabled = !!busy || !getContent().trim();
  }
  const include = document.getElementById('include-report');
  include.disabled = !current || !Object.keys(report?.results || {}).length;
  if(include.disabled) include.checked = false;
  document.getElementById('export-txt').disabled = !getContent().trim();
  document.getElementById('export-print').disabled = !getContent().trim();
}
async function load() {
  const version = ++generation; const id = state.draft.noteId;
  report = null; render();
  try { const saved = await transact('reports','get',id); if (version === generation && id === state.draft.noteId) { report = saved || null; render(); } }
  catch(error) { notify(error.message,true); }
  panel.querySelectorAll('.report-error').forEach(el => el.hidden = true);
}
async function generate(action) {
  if(busy || !getContent().trim()) return;
  const content = getContent(), noteId = state.draft.noteId, actionLabel = actions[action].verb;
  busy = action; document.getElementById(`error-${action}`).hidden = true; render();
  try {
    let response; try { response = await fetch('/api/note-ai',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,noteContent:content}),signal:AbortSignal.timeout(70000)}); } catch { throw new Error(navigator.onLine ? 'The Groq request timed out or could not connect. Please retry.' : 'You are offline. Reconnect and try again.'); }
    let data; try { data = await response.json(); } catch { throw new Error('The Groq response could not be read. Please retry.'); }
    if(!response.ok) throw new Error(data.error || 'Groq could not generate this result. Please retry.');
    if(typeof data.text !== 'string' || !data.text.trim()) throw new Error('Groq returned an empty result. Please retry.');
    if(noteId !== state.draft.noteId || content !== getContent()) { notify('The note changed during generation. Generate again for the current text.'); return; }
    const next = { id:noteId, sourceContent:content, results:{ ...(report?.sourceContent === content ? report.results : {}), [action]:data.text } };
    await transact('reports','put',next); report = next; render(); notify(`${actions[action].title} generated`);
  } catch(error) {
    if(noteId === state.draft.noteId) { const el=document.getElementById(`error-${action}`); el.textContent=error.message; el.hidden=false; }
    notify(error.message,true);
  } finally { busy = null; render(); }
}
function exportData() {
  const note = state.notes.find(n => n.id === state.draft.noteId);
  const sections = [{title:'Original note',content:getContent()}];
  if(document.getElementById('include-report').checked && report?.sourceContent === getContent()) for(const [key,action] of Object.entries(actions)) { if(report.results[key]) sections.push({title:action.title,content:report.results[key]}); }
  return {title:document.getElementById('note-title').value.trim() || 'Untitled note',created:note?.createdAt || state.draft.createdAt,updated:note?.updatedAt,sections};
}
const date = value => new Date(value).toLocaleString();
function exportText() {
  const data = exportData();
  const text = `${data.title}\n${'='.repeat(Math.min(data.title.length,60))}\nCreated: ${date(data.created)}${data.updated ? '\nLast saved: '+date(data.updated) : ''}\n\n${data.sections.map(s => `${s.title.toUpperCase()}\n\n${s.content}`).join('\n\n---\n\n')}\n`;
  const url = URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));
  const a = document.createElement('a'); a.href=url; a.download=`${data.title.replace(/[^a-zA-Z0-9 _-]/g,'').trim().slice(0,80) || 'note'}.txt`; document.body.append(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),1000); notify('TXT export complete');
}
function preparePrint() {
  let element = document.getElementById('print-document'); if(!element) { element=document.createElement('article'); element.id='print-document'; document.body.append(element); }
  const data = exportData(); element.innerHTML = `<header><p>ECHO / THOUGHT INTERFACE</p><h1>${escapeHTML(data.title)}</h1><p>Created: ${escapeHTML(date(data.created))}${data.updated ? '<br>Last saved: '+escapeHTML(date(data.updated)) : ''}</p></header>${data.sections.map(s => `<section><h2>${escapeHTML(s.title)}</h2><p>${escapeHTML(s.content)}</p></section>`).join('')}`;
}
for(const key of Object.keys(actions)) document.getElementById(`generate-${key}`).onclick = () => generate(key);
document.getElementById('export-txt').onclick = exportText;
document.getElementById('export-print').onclick = () => { preparePrint(); window.print(); };
document.addEventListener('note-opened',load); document.addEventListener('note-edited',render); window.addEventListener('beforeprint',preparePrint);
await load();
