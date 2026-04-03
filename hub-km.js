// ══════════════════════════════════
// HUB PERSONAL — hub-km.js
// Kilómetros: registro, OCR, historial navegable, exportación por mes
// ══════════════════════════════════

// Mes activo en la vista KM (permite navegar al pasado)
let kmViewMonth = currentMonthKey();

// ── NAVEGACIÓN DE MES ──
function kmMonthPrev() {
  const [y,m] = kmViewMonth.split('-').map(Number);
  const d = new Date(y, m-2, 1);
  kmViewMonth = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  renderKm();
}
function kmMonthNext() {
  const [y,m] = kmViewMonth.split('-').map(Number);
  const d = new Date(y, m, 1);
  const next = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  if (next <= currentMonthKey()) { kmViewMonth = next; renderKm(); }
}
function kmMonthReset() {
  kmViewMonth = currentMonthKey();
  renderKm();
}

// ── OCR ──
function openCamera()  { document.getElementById('camera-input').click(); }
function openGallery() { document.getElementById('gallery-input').click(); }

function handleOcrImage(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const img = document.getElementById('ocr-preview-img');
    img.src = ev.target.result;
    img.style.display = 'block';
    document.getElementById('ocr-status').textContent = '🔍 Analizando imagen...';
    document.getElementById('ocr-result-box').style.display = 'none';
    runOCR(ev.target.result);
  };
  reader.readAsDataURL(file);
  e.target.value = '';
}

function runOCR(dataUrl) {
  const script = document.getElementById('tesseract-script');
  if (!script) {
    const s = document.createElement('script');
    s.id = 'tesseract-script';
    s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
    s.onload = () => doOCR(dataUrl);
    document.head.appendChild(s);
  } else { doOCR(dataUrl); }
}

async function doOCR(dataUrl) {
  try {
    const { createWorker } = Tesseract;
    const worker = await createWorker('eng');
    const { data: { text } } = await worker.recognize(dataUrl);
    await worker.terminate();
    parseOcrText(text);
  } catch(err) {
    document.getElementById('ocr-status').textContent = '⚠️ No se pudo leer. Rellena manualmente.';
    document.getElementById('ocr-confirm-section').style.display = 'block';
  }
}

function parseOcrText(text) {
  const numbers  = text.replace(/\s/g,' ').match(/\d{4,6}/g)||[];
  const decimals = text.match(/\d+[.,]\d/g)||[];
  const candidates = numbers.map(n=>parseInt(n)).filter(n=>n>1000&&n<999999).sort((a,b)=>b-a);
  const odometer = candidates.length>0 ? candidates[0] : null;
  const partial  = decimals.length>0 ? parseFloat(decimals[0].replace(',','.')) : null;

  const resBox = document.getElementById('ocr-result-box');
  document.getElementById('ocr-odometer-val').textContent = odometer ? odometer.toLocaleString()+' km' : '— (no detectado)';
  document.getElementById('ocr-partial-val').textContent  = partial  ? partial+' km' : '— (no detectado)';
  if (odometer) document.getElementById('ocr-odo-confirm').value = odometer;
  if (partial)  document.getElementById('ocr-partial-confirm').value = partial;
  resBox.style.display = 'block';
  document.getElementById('ocr-status').textContent = odometer ? '✅ Confirma o corrige:' : '⚠️ Rellena manualmente:';
  document.getElementById('ocr-confirm-section').style.display = 'block';
}

function saveOcrEntry() {
  const odo     = parseInt(document.getElementById('ocr-odo-confirm').value);
  const partial = document.getElementById('ocr-partial-confirm').value;
  const date    = document.getElementById('ocr-date-confirm').value;
  const origin  = document.getElementById('ocr-origin-confirm').value.trim();
  const dest    = document.getElementById('ocr-dest-confirm').value.trim();
  const priv    = document.getElementById('ocr-private-toggle').checked;
  if (!odo||!date) { toast('⚠️ Odómetro y fecha son obligatorios'); return; }
  state.km.entries.push({ id:uid(), date, odometer:odo, partial:partial?parseFloat(partial):null,
    origin:origin||state.config.baseCity||'Málaga', dest:dest||'', private:priv });
  state.km.entries.sort((a,b)=>a.date.localeCompare(b.date));
  save(); closeModal('modal-ocr');
  toast('✅ Lectura guardada: '+odo.toLocaleString()+' km');
  addActivity({ icon:'📷', text:`Odómetro: ${odo.toLocaleString()} km${dest?' → '+dest:''}`, date });
  renderKm(); renderDash();
}

// ── CRUD KM ──
function addKmEntry() {
  const odo     = parseInt(document.getElementById('km-odo-input').value);
  const date    = document.getElementById('km-date-input').value;
  const origin  = document.getElementById('km-origin-input').value.trim();
  const dest    = document.getElementById('km-dest-input').value.trim();
  const partial = document.getElementById('km-partial-input').value;
  const priv    = document.getElementById('km-private-toggle').checked;
  if (!odo||!date) { toast('⚠️ Odómetro y fecha son obligatorios'); return; }
  const newEntry = { id:uid(), date, odometer:odo, partial:partial?parseFloat(partial):null,
    origin:origin||state.config.baseCity||'Málaga', dest:dest||'', private:priv };
  state.km.entries.push(newEntry);
  state.km.entries.sort((a,b)=>a.date.localeCompare(b.date));
  save(); closeModal('modal-km-add');
  toast('✅ Registro guardado');
  addActivity({ icon:'🚗', text:`${odo.toLocaleString()} km${dest?' → '+dest:''}${priv?' (privado)':''}`, date, refId:newEntry.id });
  renderKm(); renderDash();
}

function openKmEdit(id) {
  const e = state.km.entries.find(x=>x.id===id);
  if (!e) return;
  document.getElementById('km-edit-id').value      = e.id;
  document.getElementById('km-edit-odo').value     = e.odometer;
  document.getElementById('km-edit-date').value    = e.date;
  document.getElementById('km-edit-origin').value  = e.origin||'';
  document.getElementById('km-edit-dest').value    = e.dest||'';
  document.getElementById('km-edit-partial').value = e.partial||'';
  document.getElementById('km-edit-private').checked = e.private||false;
  openModal('modal-km-edit');
}

function saveKmEdit() {
  const id  = document.getElementById('km-edit-id').value;
  const idx = state.km.entries.findIndex(x=>x.id===id);
  if (idx===-1) return;
  const odo  = parseInt(document.getElementById('km-edit-odo').value);
  const date = document.getElementById('km-edit-date').value;
  if (!odo||!date) { toast('⚠️ Odómetro y fecha son obligatorios'); return; }
  state.km.entries[idx] = { ...state.km.entries[idx], odometer:odo, date,
    origin:  document.getElementById('km-edit-origin').value.trim(),
    dest:    document.getElementById('km-edit-dest').value.trim(),
    partial: document.getElementById('km-edit-partial').value ? parseFloat(document.getElementById('km-edit-partial').value) : null,
    private: document.getElementById('km-edit-private').checked };
  state.km.entries.sort((a,b)=>a.date.localeCompare(b.date));
  save(); closeModal('modal-km-edit'); toast('✅ Registro actualizado');
  renderKm(); renderDash();
}

function deleteKmEntry(id) {
  if (!confirm('¿Eliminar este registro de KM?')) return;
  removeActivity(id);
  state.km.entries = state.km.entries.filter(x=>x.id!==id);
  save(); toast('🗑️ Registro eliminado'); renderKm(); renderDash();
}

// ── CÁLCULO KM DE UN MES ──
function calcMonthKm(mk) {
  const entries    = state.km.entries.filter(e=>e.date.startsWith(mk));
  const allSorted  = state.km.entries;
  let total=0, privKm=0;

  entries.forEach(e => {
    const gIdx = allSorted.indexOf(e);
    if (gIdx===0) return;
    const prev = allSorted[gIdx-1];
    const diff = e.odometer - prev.odometer;
    if (diff>0) { total+=diff; if(e.private) privKm+=diff; }
  });

  // Primer entry del mes: comparar con último del mes anterior
  if (entries.length>0) {
    const firstGIdx = allSorted.indexOf(entries[0]);
    if (firstGIdx>0) {
      const prev = allSorted[firstGIdx-1];
      if (!prev.date.startsWith(mk)) {
        const diff = entries[0].odometer - prev.odometer;
        if (diff>0) { total+=diff; if(entries[0].private) privKm+=diff; }
      }
    }
  }
  return { total, biz:Math.max(0,total-privKm), priv:privKm, entries };
}

// ── RENDER KM ──
function renderKm() {
  const mk  = kmViewMonth;
  const isCurrentMonth = mk === currentMonthKey();
  const { total, biz, priv, entries: monthEntries } = calcMonthKm(mk);
  const pub = state.meta.publicMode;

  // Cabecera con navegación ‹ mes ›
  document.getElementById('km-month-label').innerHTML =
    `<div style="display:flex;align-items:center;justify-content:space-between;width:100%">
      <button class="btn btn-ghost btn-sm" onclick="kmMonthPrev()">‹</button>
      <span style="font-family:'Syne',sans-serif;font-weight:700;font-size:13px;color:var(--text2);text-transform:uppercase;letter-spacing:.6px">
        ${fmtMonth(mk)}${isCurrentMonth?' <span style="font-size:9px;color:var(--accent2);margin-left:4px">HOY</span>':''}
      </span>
      <button class="btn btn-ghost btn-sm" onclick="kmMonthNext()" ${isCurrentMonth?'disabled style="opacity:.3"':''}>›</button>
    </div>`;

  document.getElementById('km-total-val').textContent = pub ? biz.toLocaleString() : total.toLocaleString();
  document.getElementById('km-biz-val').textContent   = biz.toLocaleString();
  document.getElementById('km-priv-val').textContent  = pub ? '—' : priv.toLocaleString();

  const lastAll = state.km.entries[state.km.entries.length-1];
  if (lastAll) {
    document.getElementById('km-odometer-label').textContent = `Odómetro: ${lastAll.odometer.toLocaleString()} km`;
    document.getElementById('km-last-date').textContent = fmtDate(lastAll.date);
    const init = state.config.kmInit||state.km.entries[0]?.odometer||lastAll.odometer;
    document.getElementById('km-prog').style.width = Math.min(100,((lastAll.odometer-init)/Math.max(1,init))*300)+'%';
  }

  document.getElementById('km-private-warn').style.display = (!pub&&priv>0) ? 'flex' : 'none';

  // Aviso días sin registro (solo mes actual)
  if (isCurrentMonth) checkMissingKmDays(mk);
  else document.getElementById('km-missing-warn').style.display = 'none';

  // Botón añadir/OCR solo visible en mes actual
  const addBtns = document.getElementById('km-add-btns');
  if (addBtns) addBtns.style.display = isCurrentMonth ? 'grid' : 'none';

  // Log del mes
  const logEl = document.getElementById('km-log');
  const displayEntries = pub ? monthEntries.filter(e=>!e.private) : monthEntries;
  const allSorted = state.km.entries;

  if (displayEntries.length===0) {
    logEl.innerHTML='<div style="color:var(--text3);font-size:13px;text-align:center;padding:18px 0">Sin registros en '+fmtMonth(mk)+'</div>';
  } else {
    logEl.innerHTML = displayEntries.slice().reverse().map(e => {
      const gIdx = allSorted.indexOf(e);
      const prev = gIdx>0 ? allSorted[gIdx-1] : null;
      const diff = prev ? e.odometer-prev.odometer : 0;
      const label = e.dest ? `${e.origin||'—'} → ${e.dest}` : (e.origin||'Sin destino');
      return `<div class="km-entry">
        <div class="km-entry-top">
          <div>
            <div class="hist-date">${fmtDate(e.date)}${e.private&&!pub?' <span class="badge badge-red">PRIVADO</span>':''}</div>
            <div class="hist-desc">${label}</div>
            ${e.partial?`<div style="font-size:11px;color:var(--text3);margin-top:2px">Parcial: ${e.partial} km</div>`:''}
          </div>
          <div style="text-align:right">
            <div class="hist-val">${e.odometer.toLocaleString()}</div>
            <div class="hist-sub">${diff>0?'+'+diff.toLocaleString()+' km':''}</div>
          </div>
        </div>
        ${!pub&&isCurrentMonth?`<div class="km-entry-actions">
          <button class="btn btn-ghost btn-sm" onclick="openKmEdit('${e.id}')">✏️ Editar</button>
          <button class="btn btn-red-soft btn-sm" onclick="deleteKmEntry('${e.id}')">🗑️</button>
        </div>`:''}
      </div>`;
    }).join('');
  }

  // Historial 14 meses — siempre calculado en vivo desde entries
  renderKmHistory();

  // Dashboard
  if (isCurrentMonth) {
    document.getElementById('ov-km-val').textContent = biz.toLocaleString();
    document.getElementById('ov-km-sub').textContent = fmtMonth(mk);
  }
}

// ── HISTORIAL 14 MESES (calculado en vivo) ──
function renderKmHistory() {
  const histEl = document.getElementById('km-history');
  const now    = new Date();
  const months = [];

  for (let i=0; i<14; i++) {
    const d  = new Date(now.getFullYear(), now.getMonth()-i, 1);
    const mk = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const { total, biz } = calcMonthKm(mk);
    if (total>0 || i===0) months.push({ mk, total, biz });
  }

  if (months.length===0) {
    histEl.innerHTML='<div style="color:var(--text3);font-size:13px;text-align:center;padding:18px 0">Sin historial aún</div>';
    return;
  }

  histEl.innerHTML = months.map(h=>`
    <div class="hist-item" style="cursor:pointer" onclick="kmViewMonth='${h.mk}';renderKm()">
      <div>
        <div class="hist-date" style="font-size:13px;font-weight:700">${fmtMonth(h.mk)}</div>
        <div class="hist-desc" style="font-size:12px;color:var(--text3)">Empresa: ${h.biz.toLocaleString()} km</div>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <div>
          <div class="hist-val">${h.total.toLocaleString()}</div>
          <div class="hist-sub">km totales</div>
        </div>
        <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();exportKmXLS('${h.mk}')">📊</button>
      </div>
    </div>`).join('');
}

// ── AVISOS DÍAS SIN REGISTRO ──
function checkMissingKmDays(mk) {
  const warn      = document.getElementById('km-missing-warn');
  const routeDays = state.config.routeDays||[2,3,4];
  if (routeDays.length===0) { warn.style.display='none'; return; }
  const now   = new Date();
  const [y,m] = mk.split('-').map(Number);
  const missing = [];
  for (let d=1; d<=now.getDate()-1; d++) {
    const date    = new Date(y,m-1,d);
    const dow     = date.getDay();
    const dowMon1 = dow===0?7:dow;
    if (!routeDays.includes(dowMon1)) continue;
    const dateStr = `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    if (!state.km.entries.find(e=>e.date===dateStr)) missing.push(d);
  }
  if (missing.length>0) {
    warn.style.display='flex';
    document.getElementById('km-missing-text').textContent =
      `Sin registro los días: ${missing.slice(0,5).join(', ')}${missing.length>5?'...':''}. ¿Olvidaste alguno?`;
  } else { warn.style.display='none'; }
}

// ── EXPORTAR XLS — acepta mes como parámetro ──
function exportKmXLS(mk) {
  mk = mk || kmViewMonth;
  const [y,m]       = mk.split('-').map(Number);
  const daysInMonth = new Date(y,m,0).getDate();
  const allSorted   = state.km.entries;
  const dayMap      = {};

  state.km.entries.filter(e=>e.date.startsWith(mk)&&!e.private).forEach(e=>{
    const d    = parseInt(e.date.split('-')[2]);
    const gIdx = allSorted.indexOf(e);
    const prev = gIdx>0 ? allSorted[gIdx-1] : null;
    const km   = prev ? e.odometer-prev.odometer : 0;
    dayMap[d]  = { loc:e.dest||e.origin||'', km:km>0?km:0, total:e.odometer };
  });

  let csv = 'Día;Localidad;Kilómetros;Totales\n';
  for (let d=1; d<=daysInMonth; d++) {
    const row = dayMap[d];
    if (row) csv += `${d};${row.loc};${row.km};${row.total}\n`;
    else     csv += `${d};;;\n`;
  }

  const blob = new Blob(['\uFEFF'+csv], {type:'text/csv;charset=utf-8'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href=url; a.download=`${y}_${String(m).padStart(2,'0')}_kilometros.csv`;
  a.click(); URL.revokeObjectURL(url);
  toast('📊 XLS exportado: '+fmtMonth(mk));
}
