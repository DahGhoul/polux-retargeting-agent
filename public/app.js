/**
 * ============================================================================
 * FRONTEND LOGIC: POLUX RETARGETING AI (FASE LEAD -> PAYER)
 * ============================================================================
 */

let state = {
  catalog: [],
  leads: [],
  events: [],
  kpis: {},
  sqlServerConnected: false,
  smtpInfo: {}
};

let selectedLeadId = null;
let selectedProductId = 1;
let currentSeconds = 0;
let timerInterval = null;
let activeEvent = null;
let selectedPayMethod = 'YAPE';
let exitIntentLock = false;

// Formateador de moneda en Soles
function fmtMoney(n) {
  return 'S/ ' + Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Sonidos Web Audio API (sin archivos externos)
function playSound(type) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'whatsapp') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12); // A5
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.38);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } else if (type === 'email') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.15); // E5
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
      osc.start();
      osc.stop(ctx.currentTime + 0.46);
    } else if (type === 'alert') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(740, ctx.currentTime);
      osc.frequency.setValueAtTime(980, ctx.currentTime + 0.18);
      osc.frequency.setValueAtTime(740, ctx.currentTime + 0.36);
      gain.gain.setValueAtTime(0.22, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.65);
      osc.start();
      osc.stop(ctx.currentTime + 0.68);
    } else if (type === 'payment') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime);
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.12);
      osc.frequency.setValueAtTime(1046.5, ctx.currentTime + 0.25);
      gain.gain.setValueAtTime(0.24, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.7);
      osc.start();
      osc.stop(ctx.currentTime + 0.72);
    }
  } catch (_) {}
}

function showToast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => el.classList.add('hidden'), 3800);
}

// Cargar estado desde el backend
async function fetchStatus() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();
    state = data;

    if (!selectedLeadId && state.leads.length > 0) {
      selectedLeadId = state.leads[0].id;
    }
    if (!activeEvent && state.events.length > 0) {
      activeEvent = state.events[0];
    }

    renderStatusHeader();
    renderLeadsSelector();
    renderActiveProduct();
    renderCatalogGrid();
    renderPhoneSimulation();
    renderAdvisorView();
    renderBiView();
  } catch (err) {
    console.error('Error cargando estado:', err);
  }
}

function renderStatusHeader() {
  const pill = document.getElementById('sql-pill-text');
  if (pill) {
    pill.textContent = state.sqlServerConnected
      ? `PoluxImportDB (SQL Server): Conectado · ${state.smtpInfo?.mode === 'ETHEREAL_FREE_SMTP' ? 'SMTP Activo' : 'Email Listo'}`
      : 'Modo Autónomo Local + SMTP Activo';
  }
  const urgentCount = (state.events || []).filter(e => e.tier === 'MAYOR_10_MIN' && e.status !== 'CONVERTIDO_PAYER').length;
  const badge = document.getElementById('advisor-badge');
  if (badge) badge.textContent = String(urgentCount);
}

function renderLeadsSelector() {
  const sel = document.getElementById('lead-select');
  if (!sel) return;
  sel.innerHTML = state.leads
    .map(
      l =>
        `<option value="${l.id}" ${Number(l.id) === Number(selectedLeadId) ? 'selected' : ''}>
          #${l.id} · ${l.firstName} ${l.lastName} (${l.stage} · ${l.district})
        </option>`
    )
    .join('');

  const lead = getSelectedLead();
  const badgesEl = document.getElementById('lead-meta-badges');
  if (lead && badgesEl) {
    badgesEl.innerHTML = `
      <span class="meta-chip ${lead.stage === 'PAYER' ? 'stage-payer' : ''}">Etapa: <b>${lead.stage}</b></span>
      <span class="meta-chip">📱 ${lead.phone}</span>
      <span class="meta-chip">✉️ ${lead.email}</span>
    `;
  }
}

function getSelectedLead() {
  return state.leads.find(l => Number(l.id) === Number(selectedLeadId)) || state.leads[0];
}

function getSelectedProduct() {
  return state.catalog.find(p => Number(p.id) === Number(selectedProductId)) || state.catalog[0];
}

function onSelectLead(id) {
  selectedLeadId = Number(id);
  const lead = getSelectedLead();
  if (lead && lead.preferredProductId) {
    selectedProductId = Number(lead.preferredProductId);
  }
  renderLeadsSelector();
  renderActiveProduct();
  renderCatalogGrid();
}

function selectProduct(id) {
  selectedProductId = Number(id);
  renderActiveProduct();
  renderCatalogGrid();
}

function renderActiveProduct() {
  const prod = getSelectedProduct();
  const el = document.getElementById('active-product-showcase');
  if (!prod || !el) return;

  el.innerHTML = `
    <img class="showcase-img" src="${prod.image}" alt="${prod.name}" />
    <div class="showcase-info">
      <span class="showcase-badge">${prod.badge}</span>
      <h3>${prod.name}</h3>
      <div style="font-size:12.5px;color:#94a3b8;margin-top:2px;">Color: <b>${prod.color}</b> · Capacidad: <b>${prod.capacity}</b> · Stock Trujillo: <b>${prod.stockTrujillo} uds.</b></div>
      <div class="showcase-price">
        ${fmtMoney(prod.price)}
        <s>${fmtMoney(prod.originalPrice)}</s>
      </div>
      <div style="font-size:12.5px;color:#34d399;font-weight:700;">
        💳 3 cuotas sin intereses de ${fmtMoney(prod.installment3)} con PoluxPay / Yape / Tarjeta
      </div>
      <ul class="showcase-specs">
        ${prod.specs.map(s => `<li>✔ ${s}</li>`).join('')}
      </ul>
    </div>
  `;
}

function renderCatalogGrid() {
  const el = document.getElementById('catalog-grid');
  if (!el) return;
  el.innerHTML = state.catalog
    .map(
      p => `
      <div class="catalog-item ${Number(p.id) === Number(selectedProductId) ? 'selected' : ''}" onclick="selectProduct(${p.id})">
        <img src="${p.image}" alt="${p.shortName}" />
        <div>
          <strong>${p.shortName}</strong>
          <span>${fmtMoney(p.price)}</span>
        </div>
      </div>
    `
    )
    .join('');
}

// Cronómetro de permanencia en tiempo real
function startDwellTimer() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    currentSeconds += 1;
    updateTimerUi();
  }, 1000);
}

function setSimulatedSeconds(secs) {
  currentSeconds = Number(secs);
  updateTimerUi();
  const mins = (currentSeconds / 60).toFixed(1);
  showToast(`⏱️ Cronómetro ajustado a ${mins} min (${currentSeconds} seg). Ahora presiona "Salir de la página sin comprar".`);
}

async function jumpAndTrigger(secs) {
  currentSeconds = Number(secs);
  updateTimerUi();
  await triggerAbandonment('PRUEBA_RAPIDA_DE_REGLA');
}

function updateTimerUi() {
  const mm = String(Math.floor(currentSeconds / 60)).padStart(2, '0');
  const ss = String(currentSeconds % 60).padStart(2, '0');
  const clockEl = document.getElementById('timer-clock');
  if (clockEl) clockEl.textContent = `${mm}:${ss}`;

  const badgeEl = document.getElementById('timer-tier-badge');
  const fillEl = document.getElementById('dwell-progress-fill');
  const pct = Math.min(100, Math.max(4, Math.round((currentSeconds / 900) * 100)));
  if (fillEl) fillEl.style.width = `${pct}%`;

  if (!badgeEl) return;
  if (currentSeconds < 300) {
    badgeEl.textContent = 'Nivel 1 (< 5 min): Interés Exploratorio → El Agente enviará Correo HTML';
    badgeEl.style.background = 'rgba(59, 130, 246, 0.22)';
    badgeEl.style.color = '#93c5fd';
  } else if (currentSeconds <= 600) {
    badgeEl.textContent = 'Nivel 2 (5 a 10 min): Compra Posible → El Agente enviará WhatsApp Directo';
    badgeEl.style.background = 'rgba(16, 185, 129, 0.22)';
    badgeEl.style.color = '#6ee7b7';
  } else {
    badgeEl.textContent = 'Nivel 3 (> 10 min): Compra MUY Posible → Alerta a Asesor + Llamada Inmediata';
    badgeEl.style.background = 'rgba(244, 63, 94, 0.25)';
    badgeEl.style.color = '#fda4af';
  }
}

// Disparar abandono de sesión y activar el Agente IA
async function triggerAbandonment(reason = 'SALIDA_DE_PAGINA_SIN_COMPRAR') {
  const lead = getSelectedLead();
  const prod = getSelectedProduct();
  if (!lead || !prod) return;

  const secsToSend = Math.max(15, currentSeconds);

  try {
    const res = await fetch('/api/retargeting/abandon', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        leadId: lead.id,
        productId: prod.id,
        secondsViewed: secsToSend,
        exitReason: reason
      })
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Error evaluando abandono');

    activeEvent = data.event;
    await fetchStatus();

    if (activeEvent.tier === 'MENOR_5_MIN') {
      switchPhoneApp('email');
      playSound('email');
      showToast(`✉️ [< 5 min] Correo "No abandones tu carrito 👀" enviado a ${lead.firstName}`);
    } else if (activeEvent.tier === 'ENTRE_5_Y_10_MIN') {
      switchPhoneApp('whatsapp');
      playSound('whatsapp');
      showToast(`💬 [5–10 min] WhatsApp Business enviado a ${lead.firstName} con botón "Comprar ahora!"`);
    } else {
      switchPhoneApp('call');
      playSound('alert');
      showToast(`🚨 [> 10 min] ¡Compra Muy Posible! Alerta enviada al Asesor para llamar a ${lead.firstName}`);
    }
  } catch (err) {
    showToast('Error: ' + err.message);
  }
}

function switchPhoneApp(appName) {
  document.querySelectorAll('.app-switch-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.phone-screen').forEach(s => s.classList.remove('active'));

  if (appName === 'whatsapp') {
    document.getElementById('btn-app-wa')?.classList.add('active');
    document.getElementById('phone-screen-whatsapp')?.classList.add('active');
  } else if (appName === 'email') {
    document.getElementById('btn-app-mail')?.classList.add('active');
    document.getElementById('phone-screen-email')?.classList.add('active');
  } else {
    document.getElementById('btn-app-call')?.classList.add('active');
    document.getElementById('phone-screen-call')?.classList.add('active');
  }
}

function renderPhoneSimulation() {
  const ev = activeEvent || state.events[0];
  if (!ev) return;

  // Dictamen superior
  const verdictEl = document.getElementById('agent-verdict-banner');
  if (verdictEl) {
    const colorMap = {
      MENOR_5_MIN: '#3b82f6',
      ENTRE_5_Y_10_MIN: '#10b981',
      MAYOR_10_MIN: '#f43f5e'
    };
    verdictEl.style.borderLeftColor = colorMap[ev.tier] || '#10b981';
    verdictEl.innerHTML = `
      <strong>🤖 Dictamen del Agente (${ev.durationLabel} · Probabilidad: ${ev.probability}%)</strong>
      <div>${ev.headline}</div>
      <div style="margin-top:4px;font-size:11.5px;color:#94a3b8;">
        Estado actual del cliente: <b style="color:${ev.status === 'CONVERTIDO_PAYER' ? '#34d399' : '#fbbf24'}">${ev.status === 'CONVERTIDO_PAYER' ? '✅ CONVERTIDO A PAYER (' + ev.paymentInfo?.receiptNumber + ')' : ev.leadStageCurrent}</b>
      </div>
    `;
  }

  // Rellenar WhatsApp
  const firstNameUpper = (ev.leadFirstName || 'RONALDO').toUpperCase();
  const waImg = document.getElementById('wa-prod-img');
  if (waImg) waImg.src = ev.productImage;
  const waText = document.getElementById('wa-prod-text');
  if (waText) {
    waText.textContent =
      ev.whatsappPayload?.bubbleText ||
      `Hola ${firstNameUpper} 🐾🐶 ¿Tuviste alguna duda con la capacidad, el color o los métodos de pago? No te preocupes, estamos aquí para ayudarte.`;
  }

  // Rellenar Correo
  const mailTo = document.getElementById('mail-to-line');
  if (mailTo) mailTo.textContent = `To: ${ev.leadName} <${ev.leadEmail}> ›`;
  const mailClient = document.getElementById('mail-client-name');
  if (mailClient) mailClient.textContent = firstNameUpper;
  const mailProd = document.getElementById('mail-prod-name');
  if (mailProd) mailProd.textContent = ev.productName;
  const mailImg = document.getElementById('mail-prod-img');
  if (mailImg) mailImg.src = ev.productImage;

  const smtpBox = document.getElementById('mail-smtp-box');
  if (smtpBox) {
    if (ev.emailPreviewUrl) {
      smtpBox.innerHTML = `✅ Correo SMTP enviado · <a href="${ev.emailPreviewUrl}" target="_blank">Abrir bandeja real Ethereal ↗</a>`;
    } else {
      smtpBox.innerHTML = `✅ Plantilla HTML generada y enviada a <b>${ev.leadEmail}</b>`;
    }
  }

  // Rellenar Llamada (>10m)
  const callSub = document.getElementById('call-client-sub');
  if (callSub) callSub.textContent = `Llamando a ${ev.leadName} (${ev.leadPhone}) · Permanencia: ${ev.durationLabel}`;
  const callPreview = document.getElementById('call-script-preview');
  if (callPreview) {
    callPreview.textContent =
      ev.advisorScript?.opening ||
      `¡Hola ${ev.leadFirstName}! Notamos que estuviste revisando el ${ev.productName} por más de 10 minutos. Te llamamos de Polux Imports Trujillo para ayudarte a concretar tu pedido en cuotas o vía Yape.`;
  }
}

function openRealWhatsAppLink() {
  const ev = activeEvent || state.events[0];
  if (!ev) return;
  const cleanPhone = (ev.leadPhone || '+51944820915').replace(/[^0-9]/g, '');
  const text = `Hola ${(ev.leadFirstName || 'RONALDO').toUpperCase()} 🐾🐶 ¿Tuviste alguna duda con el calce/capacidad, el color o los métodos de pago para tu ${ev.productName}? No te preocupes, estamos aquí para ayudarte en Polux Imports Trujillo.`;
  window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`, '_blank');
}

// Renderizar Vista 2: Consola de Asesor (>10 min)
function renderAdvisorView() {
  const listEl = document.getElementById('advisor-alerts-list');
  const consoleEl = document.getElementById('telemarketing-console');
  if (!listEl || !consoleEl) return;

  const highIntentEvents = state.events.filter(e => e.tier === 'MAYOR_10_MIN');
  const targetEv = (activeEvent && activeEvent.tier === 'MAYOR_10_MIN') ? activeEvent : (highIntentEvents[0] || state.events[0]);

  if (highIntentEvents.length === 0) {
    listEl.innerHTML = `<p style="color:#94a3b8;font-size:13px;">No hay alertas de >10 min aún. Haz clic en "+ Simular Nuevo Abandono > 10 min".</p>`;
  } else {
    listEl.innerHTML = highIntentEvents
      .map(
        ev => `
        <div class="advisor-alert-card ${targetEv && targetEv.id === ev.id ? 'active' : ''}" onclick="selectEventForInspection(${ev.id})">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span class="badge-urgent">COMPRA MUY POSIBLE · ${ev.probability}% PROB.</span>
            <small style="color:#94a3b8;">⏱️ ${ev.durationLabel}</small>
          </div>
          <h3 style="margin:6px 0 3px;font-size:16px;">${ev.leadName} (${ev.leadDistrict})</h3>
          <div style="font-size:13px;color:#cbd5e1;">Producto: <b>${ev.productName}</b> (${fmtMoney(ev.productPrice)})</div>
          <div style="font-size:12px;color:#60a5fa;margin-top:5px;">📞 Teléfono directo: <b>${ev.leadPhone}</b> · Estado: <b>${ev.status}</b></div>
        </div>
      `
      )
      .join('');
  }

  if (targetEv) {
    const script = targetEv.advisorScript || {
      opening: `¡Hola ${targetEv.leadFirstName}! Te saluda el equipo de especialistas de Polux Imports Trujillo. Vimos que estuviste analizando el ${targetEv.productName} y queríamos brindarte soporte inmediato.`,
      keyArguments: [
        'Equipo 100% sellado de fábrica Apple USA con serie verificable.',
        'Facilidad de 3 cuotas sin intereses o pago inmediato con Yape/Plin.',
        'Entrega garantizada en nuestra sede de Av. Larco 840, Víctor Larco.'
      ],
      closingQuestion: `¿Te genero el QR de PoluxPay ahora mismo para reservar tu ${targetEv.productName}?`
    };

    consoleEl.innerHTML = `
      <div class="panel-header">
        <div>
          <span class="eyebrow">GUION DE TELEMARKETING GENERADO POR IA</span>
          <h2>📞 Llamada Activa con ${targetEv.leadName}</h2>
        </div>
        <span class="status-pill">${targetEv.durationLabel} en página</span>
      </div>

      <div class="script-step-box">
        <h4>1. Apertura Empática (Romper fricción de salida)</h4>
        <p style="font-size:13.5px;">"${script.opening}"</p>
      </div>

      <div class="script-step-box">
        <h4>2. Argumentos de Cierre Personalizados (Polux Imports Trujillo)</h4>
        <ul style="padding-left:18px;font-size:13px;color:#cbd5e1;">
          ${script.keyArguments.map(a => `<li style="margin-bottom:5px;">${a}</li>`).join('')}
        </ul>
      </div>

      <div class="script-step-box">
        <h4>3. Pregunta de Cierre Directo (Conversión LEAD → PAYER)</h4>
        <p style="font-size:13.5px;font-weight:700;color:#34d399;">"${script.closingQuestion}"</p>
      </div>

      <div style="display:flex;gap:10px;margin-top:16px;flex-wrap:wrap;">
        <button class="btn-confirm-pay" onclick="openPoluxPayForEvent(${targetEv.id})">
          💳 Cliente Acepta en Llamada → Registrar Pago (Convertir a PAYER)
        </button>
        <button class="btn-secondary-sm" onclick="openRealWhatsAppLink()">
          💬 Enviar Resumen por WhatsApp
        </button>
      </div>
    `;
  }
}

// Renderizar Vista 3: Tabla BI y KPIs
function renderBiView() {
  const k = state.kpis || {};
  document.getElementById('kpi-total').textContent = String(k.totalAbandonments || 0);
  document.getElementById('kpi-channels').textContent = `${k.byEmail || 0} Email / ${k.byWhatsapp || 0} WA`;
  document.getElementById('kpi-advisor').textContent = String(k.byAdvisor || 0);
  document.getElementById('kpi-converted').textContent = `${k.convertedToPayer || 0} (${k.conversionRate || 0}%)`;
  document.getElementById('kpi-revenue').textContent = `${fmtMoney(k.recoveredRevenuePen || 0)} recaudados con Boleta SUNAT`;

  const tbody = document.getElementById('bi-table-body');
  if (!tbody) return;

  tbody.innerHTML = state.events
    .map(
      ev => `
      <tr>
        <td>#${String(ev.id).slice(-4)}</td>
        <td>
          <strong>${ev.leadName}</strong>
          <div style="font-size:11px;color:#94a3b8;">${ev.leadEmail} · ${ev.leadPhone}</div>
        </td>
        <td>
          <strong>${ev.productName}</strong>
          <div style="font-size:11px;color:#60a5fa;">${fmtMoney(ev.productPrice)}</div>
        </td>
        <td><b>${ev.durationLabel}</b></td>
        <td><span style="font-size:11.5px;font-weight:700;">${ev.tier}</span></td>
        <td><span class="pill-channel ${ev.channel}">${ev.channel}</span></td>
        <td><b>${ev.probability}%</b> (${ev.intentLevel})</td>
        <td>
          ${
            ev.status === 'CONVERTIDO_PAYER'
              ? `<span style="color:#34d399;font-weight:800;">✅ PAYER (${ev.paymentInfo?.receiptNumber || 'B001'})</span>`
              : `<span style="color:#fbbf24;font-weight:700;">⏳ ${ev.status} (LEAD)</span>`
          }
        </td>
        <td>
          <button class="btn-secondary-sm" onclick="selectEventForInspection(${ev.id})">Ver</button>
          ${
            ev.status !== 'CONVERTIDO_PAYER'
              ? `<button class="btn-confirm-pay" style="padding:6px 10px;font-size:11.5px;" onclick="openPoluxPayForEvent(${ev.id})">Pagar → PAYER</button>`
              : ''
          }
        </td>
      </tr>
    `
    )
    .join('');
}

function selectEventForInspection(eventId) {
  const found = state.events.find(e => Number(e.id) === Number(eventId));
  if (!found) return;
  activeEvent = found;
  renderPhoneSimulation();
  renderAdvisorView();

  if (found.tier === 'MENOR_5_MIN') switchPhoneApp('email');
  else if (found.tier === 'ENTRE_5_Y_10_MIN') switchPhoneApp('whatsapp');
  else switchPhoneApp('call');

  showToast(`Mostrando sesión de ${found.leadName} (${found.durationLabel})`);
}

// Navegación entre pestañas principales
function switchMainTab(tabName) {
  document.querySelectorAll('.nav-tab').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-tab') === tabName);
  });
  document.querySelectorAll('.main-view').forEach(v => v.classList.remove('active'));
  document.getElementById(`tab-${tabName}`)?.classList.add('active');
}

// Modal de Pasarela PoluxPay (Conversión LEAD -> PAYER)
function openPoluxPayFromCurrentEvent() {
  const ev = activeEvent || state.events[0];
  if (!ev) return;
  openPoluxPayForEvent(ev.id);
}

function openPoluxPayForEvent(eventId) {
  const ev = state.events.find(e => Number(e.id) === Number(eventId)) || activeEvent;
  if (!ev) return;
  activeEvent = ev;

  const summaryEl = document.getElementById('pay-summary-banner');
  if (summaryEl) {
    summaryEl.innerHTML = `
      <div>👤 <b>Cliente a convertir (LEAD → PAYER):</b> ${ev.leadName}</div>
      <div>🍎 <b>Equipo recuperado:</b> ${ev.productName} (${ev.productColor})</div>
      <div>📡 <b>Canal que logró el retorno:</b> ${ev.channel} (Tiempo en página: ${ev.durationLabel})</div>
      <div style="font-size:18px;font-weight:900;color:#34d399;margin-top:6px;">Importe Total: ${fmtMoney(ev.productPrice)} (Incluye IGV 18%)</div>
    `;
  }

  document.getElementById('poluxpay-modal')?.classList.remove('hidden');
}

function closePoluxPayModal() {
  document.getElementById('poluxpay-modal')?.classList.add('hidden');
}

function selectPayMethod(method) {
  selectedPayMethod = method;
  document.querySelectorAll('.pay-method-btn').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-method') === method);
  });
}

async function confirmConversionPayment() {
  const ev = activeEvent || state.events[0];
  if (!ev) return;

  try {
    const res = await fetch(`/api/retargeting/${ev.id}/convert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentMethod: selectedPayMethod,
        amount: ev.productPrice
      })
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'No se pudo procesar el pago');

    activeEvent = data.event;
    closePoluxPayModal();
    playSound('payment');
    await fetchStatus();
    showToast(`🎉 ¡${ev.leadName} pasó de LEAD a PAYER! Boleta SUNAT ${data.event.paymentInfo?.receiptNumber} emitida.`);
  } catch (err) {
    showToast('Error en pago: ' + err.message);
  }
}

// Modal Nuevo Lead Personalizado
function openNewLeadModal() {
  document.getElementById('new-lead-modal')?.classList.remove('hidden');
}

function closeNewLeadModal() {
  document.getElementById('new-lead-modal')?.classList.add('hidden');
}

async function createCustomLead() {
  const firstName = document.getElementById('nl-first')?.value || 'Ronaldo';
  const lastName = document.getElementById('nl-last')?.value || 'Robles';
  const email = document.getElementById('nl-email')?.value || 'ronaldo.robles@unitru.edu.pe';
  const phone = document.getElementById('nl-phone')?.value || '+51 944 820 915';
  const documentNumber = document.getElementById('nl-dni')?.value || '74892103';
  const district = document.getElementById('nl-district')?.value || 'Víctor Larco Herrera';

  try {
    const res = await fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName,
        lastName,
        email,
        phone,
        documentNumber,
        district,
        preferredProductId: selectedProductId
      })
    });
    const data = await res.json();
    if (data.ok && data.lead) {
      selectedLeadId = data.lead.id;
      closeNewLeadModal();
      await fetchStatus();
      showToast(`👤 Lead ${data.lead.firstName} ${data.lead.lastName} registrado y activo en la tienda.`);
    }
  } catch (err) {
    showToast('Error creando lead: ' + err.message);
  }
}

async function resetDemoData() {
  await fetch('/api/retargeting/reset-demo', { method: 'POST' });
  activeEvent = null;
  await fetchStatus();
  showToast('🔄 Los 3 escenarios demostrativos (<5m, 5-10m, >10m) fueron restaurados.');
}

// Detectar salida real del mouse hacia la barra superior de la pestaña (Exit-Intent)
document.addEventListener('mouseleave', e => {
  const autoExit = document.getElementById('auto-exit-check');
  if (autoExit && autoExit.checked && e.clientY <= 0 && !exitIntentLock) {
    exitIntentLock = true;
    triggerAbandonment('EXIT_INTENT_MOUSE_LEAVE');
    setTimeout(() => {
      exitIntentLock = false;
    }, 4000);
  }
});

// Inicializar aplicación
window.addEventListener('DOMContentLoaded', () => {
  fetchStatus();
  startDwellTimer();
});
