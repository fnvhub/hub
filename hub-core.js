// ══════════════════════════════════
// HUB PERSONAL — hub-core.js
// Estado global, utilidades, navegación, modales, toast
// ══════════════════════════════════

const STORAGE_KEY = 'hub_personal_v130';
const DAY_NAMES   = ['L','M','X','J','V','S','D'];
const MONTH_NAMES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

let state = {
  config: {
    name: 'Francisco Núñez',
    email: '',
    kmInit: null,
    vacDays: 22,
    hrsMonthly: 25,
    baseCity: 'Málaga',
    routeDays: [2,3,4]
  },
  km:  { entries: [], history: [] },
  vac: { periods: [], workedDays: [] },
  hrs: { entries: [] },
  meta: { lastBackup: null, publicMode: false, recentActivity: [] }
};

// ── PERSIST ──
function save() {
  try {
    const ts = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (typeof window.setLastLocalSave === 'function') window.setLastLocalSave(ts);
    if (typeof window.syncToCloud     === 'function') window.syncToCloud(state);
  } catch(e) {}
}

window.mergeRemoteState = function(remote) {
  try {
    state = deepMerge(state, remote);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    renderAll();
  } catch(e) {}
};

function load() {
  try {
    const d = localStorage.getItem(STORAGE_KEY);
    if (d) state = deepMerge(state, JSON.parse(d));
  } catch(e) {}
}

function deepMerge(t, s) {
  const o = Object.assign({}, t);
  for (const k of Object.keys(s)) {
    if (s[k] && typeof s[k] === 'object' && !Array.isArray(s[k]))
      o[k] = deepMerge(t[k] || {}, s[k]);
    else o[k] = s[k];
  }
  return o;
}

// ── UTILS ──
function todayStr()       { return new Date().toISOString().slice(0,10); }
function fmtDate(s)       { if(!s) return '—'; const [y,m,d]=s.split('-'); return `${d}/${m}/${y}`; }
function fmtMonth(s)      { const [y,m]=s.split('-'); return `${MONTH_NAMES[parseInt(m)-1]} ${y}`; }
function currentMonthKey(){ const n=new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`; }
function uid()            { return Date.now().toString(36)+Math.random().toString(36).slice(2,6); }
function businessDays(start, end) {
  let c=0; const cur=new Date(start); const e=new Date(end);
  while(cur<=e){ const d=cur.getDay(); if(d!==0&&d!==6) c++; cur.setDate(cur.getDate()+1); }
  return c;
}

// ── TABS ──
function switchTab(tab) {
  document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('tab-'+tab).classList.add('active');
  document.getElementById('tbtn-'+tab).classList.add('active');
  if (tab==='km')   renderKm();
  if (tab==='vac')  renderVac();
  if (tab==='hrs')  renderHrs();
  if (tab==='dash') renderDash();
}

// ── MODALS ──
function openModal(id) {
  const today = todayStr();
  document.querySelectorAll(`#${id} input[type=date]`).forEach(i=>{ if(!i.value) i.value=today; });
  if (id==='modal-vac-add') {
    document.getElementById('vac-days-manual').value='';
    document.getElementById('vac-add-preview').style.display='none';
  }
  if (id==='modal-hrs-email') {
    document.getElementById('hrs-email-to').value=state.config.email||'';
    document.getElementById('hrs-email-fechas').value='';
    document.getElementById('hrs-email-hours').value='';
    updateEmailPreview();
  }
  if (id==='modal-km-add') {
    document.getElementById('km-origin-input').value = state.config.baseCity||'Málaga';
    document.getElementById('km-odo-input').value='';
    document.getElementById('km-dest-input').value='';
    document.getElementById('km-partial-input').value='';
    document.getElementById('km-private-toggle').checked=false;
  }
  if (id==='modal-ocr') {
    document.getElementById('ocr-status').textContent='Toca "Abrir cámara" para hacer la foto';
    document.getElementById('ocr-preview-img').style.display='none';
    document.getElementById('ocr-result-box').style.display='none';
    document.getElementById('ocr-confirm-section').style.display='none';
    document.getElementById('ocr-origin-confirm').value=state.config.baseCity||'Málaga';
    document.getElementById('ocr-date-confirm').value=today;
    document.getElementById('ocr-private-toggle').checked=false;
  }
  if (id==='modal-cfg-pattern') renderPatternPicker();
  document.getElementById(id).classList.add('open');
}

function closeModal(id) { document.getElementById(id).classList.remove('open'); }
document.querySelectorAll('.modal-overlay').forEach(m=>m.addEventListener('click',e=>{ if(e.target===m) m.classList.remove('open'); }));

// ── TOAST ──
function toast(msg, dur=2500) {
  const t=document.getElementById('toast');
  t.textContent=msg; t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'), dur);
}

// ── PUBLIC MODE ──
function togglePublicMode(on) {
  state.meta.publicMode = on;
  save();
  const sw = document.getElementById('pub-mode-sw');
  if (sw) sw.checked = on;
  renderKm(); renderDash();
}

// ── ACTIVITY ──
function addActivity(item) {
  state.meta.recentActivity = state.meta.recentActivity||[];
  if (!item.refId) item.refId = item.id || uid();
  state.meta.recentActivity.unshift(item);
  state.meta.recentActivity = state.meta.recentActivity.slice(0,20);
  save();
}
function removeActivity(refId) {
  if (!refId) return;
  state.meta.recentActivity = (state.meta.recentActivity||[]).filter(a=>a.refId!==refId);
}

// ── RENDER ALL (usado tras sync remoto) ──
function renderAll() {
  renderDash();
  renderKm();
  renderVac();
  renderHrs();
  renderCfg();
}

// ── INIT ──
function initApp() {
  load();

  // Header fecha
  const now = new Date();
  const dias = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
  document.getElementById('header-date').textContent =
    `${dias[now.getDay()]} ${now.getDate()} de ${MONTH_NAMES[now.getMonth()]} de ${now.getFullYear()}`;

  // Saludo dashboard
  const h = now.getHours();
  const saludo = h<13?'Buenos días':'h<20'?'Buenas tardes':'Buenas noches';
  document.getElementById('dash-greeting').textContent =
    `${h<13?'Buenos días':h<20?'Buenas tardes':'Buenas noches'}, ${state.config.name.split(' ')[0]}`;

  renderAll();

  // PWA install
  let deferredPrompt;
  window.addEventListener('beforeinstallprompt', e=>{
    e.preventDefault(); deferredPrompt=e;
    const btn=document.getElementById('btn-install-pwa');
    if(btn) btn.style.display='flex';
  });
  window.installPWA = function() {
    if(deferredPrompt){ deferredPrompt.prompt(); deferredPrompt=null; }
  };

  // Sync toggle
  document.getElementById('sync-toggle').addEventListener('change', e=>{
    if(typeof window.setSyncEnabled==='function') window.setSyncEnabled(e.target.checked);
    document.getElementById('sync-status-cfg').textContent =
      e.target.checked ? 'Activa — cambios en tiempo real' : 'Desactivada';
  });

  // Public mode sync
  const sw = document.getElementById('pub-mode-sw');
  if(sw) sw.checked = state.meta.publicMode||false;

  // Cambio de fechas en modal vacaciones
  document.addEventListener('change', e=>{
    if(e.target.id==='vac-start-input'||e.target.id==='vac-end-input'){
      const s=document.getElementById('vac-start-input').value;
      const en=document.getElementById('vac-end-input').value;
      const preview=document.getElementById('vac-add-preview');
      if(s&&en&&en>=s){
        document.getElementById('vac-add-preview-text').textContent=
          `${businessDays(s,en)} días laborables (${fmtDate(s)} → ${fmtDate(en)})`;
        preview.style.display='flex';
      } else { preview.style.display='none'; }
    }
  });
}

document.addEventListener('DOMContentLoaded', initApp);
