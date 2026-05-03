// ══════════════════════════════════
// HUB PERSONAL — hub-resto.js
// Vacaciones, Horas Comité, Ajustes, Dashboard
// ══════════════════════════════════

let vacCalDate = new Date();

// ════════════════════════════
// ── VACACIONES ──
// ════════════════════════════
function addVacPeriod() {
  const start     = document.getElementById('vac-start-input').value;
  const end       = document.getElementById('vac-end-input').value;
  const note      = document.getElementById('vac-note-input').value.trim();
  const manualVal = document.getElementById('vac-days-manual').value;
  if (!start||!end)  { toast('⚠️ Indica fechas'); return; }
  if (end<start)     { toast('⚠️ Fin debe ser posterior al inicio'); return; }
  const autoDays = businessDays(start, end);
  const days     = manualVal ? Math.max(1,parseInt(manualVal)) : autoDays;
  const entryId  = uid();
  state.vac.periods.push({ id:entryId, start, end, days, autoDays, note:note||'' });
  state.vac.periods.sort((a,b)=>a.start.localeCompare(b.start));
  document.getElementById('vac-note-input').value='';
  document.getElementById('vac-days-manual').value='';
  save(); closeModal('modal-vac-add');
  const adj = (manualVal&&days!==autoDays) ? ` (ajustado, calculado: ${autoDays})` : '';
  toast(`✅ ${days} días añadidos${adj}`);
  addActivity({ icon:'🏖️', text:`Vacaciones ${fmtDate(start)}–${fmtDate(end)} (${days}d)`, date:start, refId:entryId });
  renderVac(); renderDash();
}

function openVacEdit(id) {
  const p = state.vac.periods.find(x=>x.id===id);
  if (!p) return;
  document.getElementById('vac-edit-id').value    = p.id;
  document.getElementById('vac-edit-start').value = p.start;
  document.getElementById('vac-edit-end').value   = p.end;
  document.getElementById('vac-edit-days').value  = p.days||'';
  document.getElementById('vac-edit-note').value  = p.note||'';
  openModal('modal-vac-edit');
}

function saveVacEdit() {
  const id  = document.getElementById('vac-edit-id').value;
  const idx = state.vac.periods.findIndex(x=>x.id===id);
  if (idx===-1) return;
  const start = document.getElementById('vac-edit-start').value;
  const end   = document.getElementById('vac-edit-end').value;
  if (!start||!end||end<start) { toast('⚠️ Fechas inválidas'); return; }
  const autoDays  = businessDays(start,end);
  const manualVal = document.getElementById('vac-edit-days').value;
  const days      = manualVal ? Math.max(1,parseInt(manualVal)) : autoDays;
  state.vac.periods[idx] = { ...state.vac.periods[idx], start, end, days, autoDays,
    note: document.getElementById('vac-edit-note').value.trim() };
  state.vac.periods.sort((a,b)=>a.start.localeCompare(b.start));
  save(); closeModal('modal-vac-edit'); toast('✅ Vacaciones actualizadas');
  renderVac(); renderDash();
}

function deleteVacPeriod(id) {
  if (!confirm('¿Eliminar este período?')) return;
  removeActivity(id);
  state.vac.periods = state.vac.periods.filter(x=>x.id!==id);
  save(); toast('🗑️ Período eliminado'); renderVac(); renderDash();
}

function addWorkedDay() {
  const date   = document.getElementById('worked-date-input').value;
  const reason = document.getElementById('worked-reason-input').value.trim();
  if (!date) { toast('⚠️ Indica la fecha'); return; }
  state.vac.workedDays.push({ id:uid(), date, reason:reason||'' });
  state.vac.workedDays.sort((a,b)=>a.date.localeCompare(b.date));
  document.getElementById('worked-reason-input').value='';
  save(); closeModal('modal-worked-add');
  toast('✅ Día trabajado registrado');
  addActivity({ icon:'🛠️', text:`Día trabajado: ${fmtDate(date)}${reason?' — '+reason:''}`, date });
  renderVac(); renderDash();
}

function deleteWorkedDay(id) {
  if (!confirm('¿Eliminar este día?')) return;
  removeActivity(id);
  state.vac.workedDays = state.vac.workedDays.filter(x=>x.id!==id);
  save(); toast('🗑️ Eliminado'); renderVac(); renderDash();
}

function renderVac() {
  const year       = new Date().getFullYear();
  document.getElementById('vac-year-label').textContent = year;
  const yearPeriods = state.vac.periods.filter(p=>p.start.startsWith(year+''));
  const yearWorked  = state.vac.workedDays.filter(w=>w.date.startsWith(year+''));
  const extraDays   = yearWorked.length;
  const usedVac     = yearPeriods.reduce((s,p)=>s+p.days,0);
  const usedExtra   = Math.min(extraDays,usedVac);
  const totalAvail  = state.config.vacDays+extraDays;
  const remaining   = totalAvail-usedVac;

  document.getElementById('vac-total-val').textContent  = Math.max(0,remaining);
  document.getElementById('vac-used-val').textContent   = usedVac;
  document.getElementById('vac-extra-val').textContent  = extraDays;
  document.getElementById('vac-prog-left').textContent  = `Quedan ${Math.max(0,remaining)} días`;
  document.getElementById('vac-prog-total').textContent = `de ${totalAvail} totales`;
  document.getElementById('vac-prog').style.width       = (totalAvail>0?Math.min(100,(usedVac/totalAvail)*100):0)+'%';
  document.getElementById('ov-vac-val').textContent     = Math.max(0,remaining);
  document.getElementById('ov-vac-sub').textContent     = `de ${totalAvail} días`;

  renderVacCalendar();

  const histEl   = document.getElementById('vac-history');
  const allItems = [
    ...state.vac.periods.map(p=>({...p,_k:'vac'})),
    ...state.vac.workedDays.map(w=>({...w,_k:'worked'}))
  ].sort((a,b)=>(b.start||b.date).localeCompare(a.start||a.date));

  if (allItems.length===0) {
    histEl.innerHTML='<div style="color:var(--text3);font-size:13px;text-align:center;padding:18px 0">Sin períodos registrados</div>';
    return;
  }
  let extraUsedCount=0;
  histEl.innerHTML = allItems.map(item=>{
    if (item._k==='vac') {
      return `<div class="hist-item" style="flex-wrap:wrap;gap:6px">
        <div style="flex:1">
          <div class="hist-date">${fmtDate(item.start)} – ${fmtDate(item.end)}</div>
          <div class="hist-desc">${item.note||'Período vacacional'} <span class="badge badge-blue">Vacaciones</span></div>
        </div>
        <div style="text-align:right"><div class="hist-val" style="color:var(--accent2)">${item.days}</div><div class="hist-sub">días lab.</div></div>
        <div style="width:100%;display:flex;gap:6px">
          <button class="btn btn-ghost btn-sm" onclick="openVacEdit('${item.id}')">✏️ Editar</button>
          <button class="btn btn-red-soft btn-sm" onclick="deleteVacPeriod('${item.id}')">🗑️</button>
        </div>
      </div>`;
    } else {
      extraUsedCount++;
      const isUsed = extraUsedCount<=usedExtra;
      return `<div class="hist-item" style="flex-wrap:wrap;gap:6px">
        <div style="flex:1">
          <div class="hist-date">${fmtDate(item.date)}</div>
          <div class="hist-desc">${item.reason||'Día trabajado'} <span class="badge badge-orange">${isUsed?'Recuperado':'Pendiente'}</span></div>
          ${isUsed?'<div style="font-size:11px;color:var(--text2);margin-top:2px">✅ Ya descontado de vacaciones</div>':''}
        </div>
        <div style="text-align:right"><div class="hist-val" style="color:var(--accent3)">+1</div><div class="hist-sub">día extra</div></div>
        <div style="width:100%;display:flex;gap:6px">
          <button class="btn btn-red-soft btn-sm" onclick="deleteWorkedDay('${item.id}')">🗑️ Eliminar</button>
        </div>
      </div>`;
    }
  }).join('');
}

function renderVacCalendar() {
  const y = vacCalDate.getFullYear(), m = vacCalDate.getMonth();
  const months = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  document.getElementById('vac-cal-month-btn').textContent = `${months[m]} ${y}`;
  const today        = new Date();
  const startOffset  = (new Date(y,m,1).getDay()+6)%7;
  const daysInMonth  = new Date(y,m+1,0).getDate();
  const vacDays=new Set(), workedDays=new Set();
  state.vac.periods.forEach(p=>{
    const cur=new Date(p.start),end=new Date(p.end);
    while(cur<=end){ if(cur.getFullYear()===y&&cur.getMonth()===m) vacDays.add(cur.getDate()); cur.setDate(cur.getDate()+1); }
  });
  state.vac.workedDays.forEach(w=>{ const d=new Date(w.date); if(d.getFullYear()===y&&d.getMonth()===m) workedDays.add(d.getDate()); });
  const el = document.getElementById('vac-cal');
  let html = DAY_NAMES.map(h=>`<div class="cal-head">${h}</div>`).join('');
  for(let i=0;i<startOffset;i++) html+='<div></div>';
  for(let d=1;d<=daysInMonth;d++){
    const isToday=today.getDate()===d&&today.getMonth()===m&&today.getFullYear()===y;
    let cls='cal-day';
    if(isToday) cls+=' today';
    if(vacDays.has(d)) cls+=' vac-day';
    if(workedDays.has(d)) cls+=' worked-day';
    html+=`<div class="${cls}">${d}</div>`;
  }
  el.innerHTML=html;
}
function vacCalPrev(){ vacCalDate.setMonth(vacCalDate.getMonth()-1); renderVacCalendar(); }
function vacCalNext(){ vacCalDate.setMonth(vacCalDate.getMonth()+1); renderVacCalendar(); }

// ════════════════════════════
// ── HORAS COMITÉ ──
// ════════════════════════════

// Plantilla por defecto del email de notificación
const EMAIL_TEMPLATE_DEFAULT = `Estimado/a responsable,\n\nPor medio del presente escrito, le comunico el uso de {{horas}} hora(s) del crédito horario sindical correspondiente{{fechas}}.\n\nQuedo a su disposición para cualquier aclaración.\n\nAtentamente,\n{{nombre}}`;

function getEmailTemplate() {
  return state.config.emailTemplate || EMAIL_TEMPLATE_DEFAULT;
}

function buildEmailBody(hours, fechas, name) {
  const template = getEmailTemplate();
  return template
    .replace('{{horas}}', hours || '__')
    .replace('{{fechas}}', fechas ? ' a los días ' + fechas : '')
    .replace('{{nombre}}', name || 'Francisco Núñez');
}

function addHrsEntry() {
  const amount      = parseFloat(document.getElementById('hrs-amount-input').value);
  const date        = document.getElementById('hrs-date-input').value;
  const reason      = document.getElementById('hrs-reason-input').value.trim();
  const meetingDate = document.getElementById('hrs-meeting-date-input').value;
  const meetingTime = document.getElementById('hrs-meeting-time-input').value;
  const sendMail    = document.getElementById('hrs-send-email-toggle').checked;
  if (!amount||!date) { toast('⚠️ Horas y fecha son obligatorios'); return; }
  const monthly = state.config.hrsMonthly||25;
  const mk      = date.slice(0,7);
  const usedNow = state.hrs.entries.filter(e=>e.date.startsWith(mk)).reduce((s,e)=>s+e.amount,0);
  if (usedNow+amount>monthly) { toast(`⚠️ Superarías el límite de ${monthly}h este mes`); return; }
  const newEntry = { id:uid(), date, amount, reason:reason||'', meetingDate:meetingDate||'', meetingTime:meetingTime||'' };
  state.hrs.entries.push(newEntry);
  state.hrs.entries.sort((a,b)=>a.date.localeCompare(b.date));
  document.getElementById('hrs-reason-input').value='';
  document.getElementById('hrs-meeting-date-input').value='';
  document.getElementById('hrs-meeting-time-input').value='';
  save(); closeModal('modal-hrs-add');
  toast(`✅ ${amount}h registradas`);
  const meetingInfo = meetingDate ? ` — reunión ${fmtDate(meetingDate)}${meetingTime?' '+meetingTime:''}` : '';
  addActivity({ icon:'🏛️', text:`${amount}h comité: ${reason||fmtDate(date)}${meetingInfo}`, date, refId:newEntry.id });
  if (sendMail && state.config.email) sendQuickHrsEmail(amount, date, reason, meetingDate, meetingTime);
  renderHrs(); renderDash();
}

function openHrsEdit(id) {
  const e = state.hrs.entries.find(x=>x.id===id);
  if (!e) return;
  document.getElementById('hrs-edit-id').value     = e.id;
  document.getElementById('hrs-edit-amount').value = e.amount;
  document.getElementById('hrs-edit-date').value   = e.date;
  document.getElementById('hrs-edit-reason').value = e.reason||'';
  openModal('modal-hrs-edit');
}

function saveHrsEdit() {
  const id  = document.getElementById('hrs-edit-id').value;
  const idx = state.hrs.entries.findIndex(x=>x.id===id);
  if (idx===-1) return;
  const amount = parseFloat(document.getElementById('hrs-edit-amount').value);
  const date   = document.getElementById('hrs-edit-date').value;
  if (!amount||!date) { toast('⚠️ Horas y fecha son obligatorios'); return; }
  state.hrs.entries[idx] = { ...state.hrs.entries[idx], amount, date,
    reason: document.getElementById('hrs-edit-reason').value.trim() };
  state.hrs.entries.sort((a,b)=>a.date.localeCompare(b.date));
  save(); closeModal('modal-hrs-edit'); toast('✅ Horas actualizadas');
  renderHrs(); renderDash();
}

function deleteHrsEntry(id) {
  if (!confirm('¿Eliminar este registro?')) return;
  removeActivity(id);
  state.hrs.entries = state.hrs.entries.filter(x=>x.id!==id);
  save(); toast('🗑️ Eliminado'); renderHrs(); renderDash();
}

function renderHrs() {
  const mk      = currentMonthKey();
  const monthly = state.config.hrsMonthly||25;
  const entries = state.hrs.entries.filter(e=>e.date.startsWith(mk));
  const used    = entries.reduce((s,e)=>s+e.amount,0);
  const left    = Math.max(0,monthly-used);
  const pct     = Math.min(1,used/monthly);
  const circ    = 339.3;

  document.getElementById('hrs-month-label').textContent = fmtMonth(mk);
  document.getElementById('hrs-ring-used').textContent  = used;
  document.getElementById('hrs-ring-total').textContent = monthly;
  document.getElementById('hrs-ring').style.strokeDashoffset = circ*(1-pct);
  document.getElementById('hrs-used-val').textContent  = used;
  document.getElementById('hrs-left-val').textContent  = left;
  document.getElementById('hrs-total-val').textContent = monthly;
  document.getElementById('ov-hrs-val').textContent    = left;
  document.getElementById('ov-hrs-sub').textContent    = `de ${monthly}h`;
  document.getElementById('ov-hrs-bar').style.width    = (pct*100)+'%';

  const alertsEl = document.getElementById('hrs-alerts');
  if (used>=monthly) {
    alertsEl.innerHTML='<div class="alert-banner alert-danger"><span class="ab-icon">⛔</span><span>Has agotado las horas de comité este mes.</span></div>';
  } else if (used/monthly>=0.8) {
    alertsEl.innerHTML=`<div class="alert-banner alert-warning"><span class="ab-icon">⚠️</span><span>Quedan solo ${left}h de ${monthly}h este mes.</span></div>`;
  } else { alertsEl.innerHTML=''; }

  const logEl = document.getElementById('hrs-log');
  if (entries.length===0) {
    logEl.innerHTML='<div style="color:var(--text3);font-size:13px;text-align:center;padding:18px 0">Sin registros este mes</div>';
  } else {
    logEl.innerHTML = entries.slice().reverse().map(e=>`
      <div class="hora-item">
        <div class="hora-icon" style="background:rgba(249,169,75,.15)">🏛️</div>
        <div class="hora-body">
          <div class="hora-title">${e.reason||'Horas comité'}</div>
          <div class="hora-date">${fmtDate(e.date)}${e.meetingDate?' · 📅 Reunión: '+fmtDate(e.meetingDate)+(e.meetingTime?' '+e.meetingTime:''):''}</div>
        </div>
        <div style="text-align:right">
          <div class="hora-amount" style="color:var(--accent3)">${e.amount}h</div>
          <div class="hora-actions">
            <button class="btn btn-ghost btn-sm btn-icon" onclick="openHrsEdit('${e.id}')">✏️</button>
            <button class="btn btn-red-soft btn-sm btn-icon" onclick="deleteHrsEntry('${e.id}')">🗑️</button>
          </div>
        </div>
      </div>`).join('');
  }

  // Historial mensual
  const histEl  = document.getElementById('hrs-history');
  const allMks  = [...new Set(state.hrs.entries.map(e=>e.date.slice(0,7)))].sort().reverse();
  if (allMks.length===0) {
    histEl.innerHTML='<div style="color:var(--text3);font-size:13px;text-align:center;padding:18px 0">Sin historial</div>';
  } else {
    histEl.innerHTML = allMks.map(m=>{
      const total = state.hrs.entries.filter(e=>e.date.startsWith(m)).reduce((s,e)=>s+e.amount,0);
      return `<div class="hist-item">
        <div><div class="hist-date" style="font-size:13px;font-weight:700">${fmtMonth(m)}</div></div>
        <div><div class="hist-val" style="color:var(--accent3)">${total}h</div><div class="hist-sub">de ${monthly}h</div></div>
      </div>`;
    }).join('');
  }
}

function updateEmailPreview() {
  const hours  = document.getElementById('hrs-email-hours').value;
  const fechas = document.getElementById('hrs-email-fechas').value;
  const name   = state.config.name||'Francisco Núñez';
  document.getElementById('hrs-email-preview').value = buildEmailBody(hours, fechas, name);
}

function sendHrsEmail() {
  const to      = document.getElementById('hrs-email-to').value;
  const body    = document.getElementById('hrs-email-preview').value;
  const subject = encodeURIComponent('Comunicación uso horas comité');
  window.location.href = `mailto:${to}?subject=${subject}&body=${encodeURIComponent(body)}`;
  closeModal('modal-hrs-email');
}

function sendQuickHrsEmail(amount, date, reason, meetingDate, meetingTime) {
  const name    = state.config.name||'Francisco Núñez';
  const to      = state.config.email||'';
  const subject = encodeURIComponent('Comunicación uso horas comité');
  let fechaStr  = fmtDate(date);
  if (meetingDate) fechaStr += ` — reunión: ${fmtDate(meetingDate)}${meetingTime?' a las '+meetingTime:''}`;
  if (reason) fechaStr += ` (${reason})`;
  const body = buildEmailBody(amount, fechaStr, name);
  window.location.href = `mailto:${to}?subject=${subject}&body=${encodeURIComponent(body)}`;
}

// ════════════════════════════
// ── AJUSTES ──
// ════════════════════════════
function renderCfg() {
  document.getElementById('cfg-name-disp').textContent       = state.config.name||'No configurado';
  document.getElementById('cfg-email-disp').textContent      = state.config.email||'No configurado';
  document.getElementById('cfg-city-disp').textContent       = state.config.baseCity||'No configurado';
  document.getElementById('cfg-km-init-disp').textContent    = state.config.kmInit ? state.config.kmInit.toLocaleString()+' km' : 'No configurado';
  document.getElementById('cfg-vac-days-disp').textContent   = (state.config.vacDays||22)+' días';
  document.getElementById('cfg-hrs-monthly-disp').textContent= (state.config.hrsMonthly||25)+' horas';
  document.getElementById('cfg-backup-date').textContent     = state.meta.lastBackup ? new Date(state.meta.lastBackup).toLocaleDateString('es-ES') : 'Nunca';
  const pattern = state.config.routeDays||[2,3,4];
  const dayFull = ['','Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
  document.getElementById('cfg-pattern-disp').textContent    = pattern.length>0 ? pattern.map(d=>dayFull[d]).join(', ')+' (ruta)' : 'Sin patrón';

  // Mostrar resumen de plantilla de email
  const templateDisp = document.getElementById('cfg-email-template-disp');
  if (templateDisp) {
    const tpl = getEmailTemplate();
    templateDisp.textContent = tpl.length > 60 ? tpl.slice(0,60)+'…' : tpl;
  }
}

function openCfgEmailTemplate() {
  const ta = document.getElementById('cfg-email-template-input');
  if (ta) ta.value = getEmailTemplate();
  openModal('modal-cfg-email-template');
}

function saveCfgEmailTemplate() {
  const val = document.getElementById('cfg-email-template-input').value.trim();
  state.config.emailTemplate = val || EMAIL_TEMPLATE_DEFAULT;
  save(); closeModal('modal-cfg-email-template'); renderCfg();
  toast('✅ Plantilla guardada');
}

function resetEmailTemplate() {
  if (!confirm('¿Restaurar la plantilla por defecto?')) return;
  state.config.emailTemplate = EMAIL_TEMPLATE_DEFAULT;
  document.getElementById('cfg-email-template-input').value = EMAIL_TEMPLATE_DEFAULT;
  toast('✅ Plantilla restaurada');
}

function saveCfgName()  { state.config.name=document.getElementById('cfg-name-input').value.trim()||'Francisco Núñez'; save(); closeModal('modal-cfg-name'); renderCfg(); toast('✅ Nombre guardado'); }
function saveCfgEmail() { state.config.email=document.getElementById('cfg-email-input').value.trim(); save(); closeModal('modal-cfg-email'); renderCfg(); toast('✅ Email guardado'); }
function saveCfgCity()  { state.config.baseCity=document.getElementById('cfg-city-input').value.trim()||'Málaga'; save(); closeModal('modal-cfg-city'); renderCfg(); toast('✅ Ciudad guardada'); }
function saveCfgKm()    { state.config.kmInit=parseInt(document.getElementById('cfg-km-init-input').value)||null; save(); closeModal('modal-cfg-km'); renderCfg(); toast('✅ Odómetro guardado'); }
function saveCfgVac()   { state.config.vacDays=parseInt(document.getElementById('cfg-vac-input').value)||22; save(); closeModal('modal-cfg-vac'); renderCfg(); renderVac(); toast('✅ Días guardados'); }
function saveCfgHrs()   { state.config.hrsMonthly=parseInt(document.getElementById('cfg-hrs-input').value)||25; save(); closeModal('modal-cfg-hrs'); renderCfg(); renderHrs(); toast('✅ Horas guardadas'); }

function renderPatternPicker() {
  const el       = document.getElementById('pattern-day-picker');
  const selected = state.config.routeDays||[2,3,4];
  const days     = [{n:1,l:'Lun'},{n:2,l:'Mar'},{n:3,l:'Mié'},{n:4,l:'Jue'},{n:5,l:'Vie'},{n:6,l:'Sáb'},{n:7,l:'Dom'}];
  el.innerHTML   = days.map(d=>`
    <button onclick="togglePatternDay(${d.n},this)"
      style="padding:8px 14px;border-radius:8px;border:1.5px solid ${selected.includes(d.n)?'var(--accent)':'var(--border)'};
             background:${selected.includes(d.n)?'rgba(79,142,247,.15)':'var(--card2)'};
             color:${selected.includes(d.n)?'var(--accent)':'var(--text2)'};font-weight:600;font-size:13px;cursor:pointer"
      data-day="${d.n}">${d.l}</button>`).join('');
}

function togglePatternDay(n, btn) {
  const days = state.config.routeDays||[2,3,4];
  const idx  = days.indexOf(n);
  if (idx>=0) days.splice(idx,1); else days.push(n);
  state.config.routeDays = [...days];
  btn.style.borderColor  = days.includes(n)?'var(--accent)':'var(--border)';
  btn.style.background   = days.includes(n)?'rgba(79,142,247,.15)':'var(--card2)';
  btn.style.color        = days.includes(n)?'var(--accent)':'var(--text2)';
}

function saveCfgPattern() {
  save(); closeModal('modal-cfg-pattern'); renderCfg(); toast('✅ Patrón guardado');
}

function doBackup() {
  state.meta.lastBackup = Date.now();
  save();
  const blob = new Blob([JSON.stringify(state,null,2)], {type:'application/json'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href=url; a.download=`hub_backup_${new Date().toISOString().slice(0,10)}.json`;
  a.click(); URL.revokeObjectURL(url);
  toast('💾 Copia guardada');
  renderCfg();
}

function doImport() { document.getElementById('import-file').click(); }

function handleImport(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const imported = JSON.parse(ev.target.result);
      state = deepMerge(state, imported);
      save(); renderAll();
      toast('✅ Datos importados correctamente');
    } catch(err) { toast('❌ Archivo inválido'); }
  };
  reader.readAsText(file);
  e.target.value='';
}

function confirmReset() {
  if (confirm('¿Borrar TODOS los datos? Esta acción no se puede deshacer.')) {
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  }
}

// ════════════════════════════
// ── DASHBOARD ──
// ════════════════════════════
function renderDash() {
  // Actividad reciente
  const recentEl = document.getElementById('dash-recent');
  const items    = state.meta.recentActivity||[];
  if (items.length===0) {
    recentEl.innerHTML='<div style="color:var(--text3);font-size:13px;text-align:center;padding:18px 0">Sin actividad aún</div>';
  } else {
    recentEl.innerHTML = items.slice(0,8).map(a=>`
      <div class="hist-item">
        <div><div class="hist-desc">${a.icon||''} ${a.text||''}</div><div class="hist-date">${fmtDate(a.date)}</div></div>
      </div>`).join('');
  }

  // Alertas
  const alertsEl = document.getElementById('dash-alerts');
  const alerts   = [];
  const mk       = currentMonthKey();
  const monthly  = state.config.hrsMonthly||25;
  const hrsUsed  = state.hrs.entries.filter(e=>e.date.startsWith(mk)).reduce((s,e)=>s+e.amount,0);
  if (hrsUsed>=monthly) alerts.push({type:'danger', icon:'⛔', msg:'Has agotado las horas de comité este mes.'});
  else if (hrsUsed/monthly>=0.8) alerts.push({type:'warning', icon:'⚠️', msg:`Quedan solo ${monthly-hrsUsed}h de comité este mes.`});

  alertsEl.innerHTML = alerts.map(a=>`
    <div class="alert-banner alert-${a.type}"><span class="ab-icon">${a.icon}</span><span>${a.msg}</span></div>`).join('');
}
