/**
 * ============================================================================
 * PANEL OPERACIONAL REAL DEL AGENTE (SIN SIMULADORES FALSOS)
 * ============================================================================
 */

let state = {};
let configInitialized = false;

function fmtMoney(n) {
  return 'S/ ' + Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function showToast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => el.classList.add('hidden'), 4000);
}

async function fetchStatus() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();
    state = data;

    if (!configInitialized && state.config) {
      document.getElementById('cfg-advisor-name').value = state.config.advisorName || '';
      document.getElementById('cfg-advisor-phone').value = state.config.advisorPhone || '';
      document.getElementById('cfg-smtp-user').value = state.config.smtpUser || '';
      configInitialized = true;
    }

    renderTopbar();
    renderWhatsAppBox();
    renderLiveSessions();
    renderKpisAndAnalytics();
    renderEventsTable();
  } catch (err) {
    console.error('Error consultando estado del agente:', err);
  }
}

function renderTopbar() {
  const waPill = document.getElementById('wa-pill');
  const waText = document.getElementById('wa-pill-text');
  if (waPill && waText) {
    if (state.whatsapp?.state === 'CONNECTED') {
      waPill.className = 'status-pill online';
      waText.textContent = `WhatsApp Bot: Conectado (${state.whatsapp.connectedPhone})`;
    } else if (state.whatsapp?.state === 'QR_READY') {
      waPill.className = 'status-pill warn';
      waText.textContent = 'WhatsApp Bot: Esperando escaneo de QR';
    } else {
      waPill.className = 'status-pill warn';
      waText.textContent = 'WhatsApp Bot: Inicializando...';
    }
  }

  const sqlText = document.getElementById('sql-pill-text');
  if (sqlText) {
    sqlText.textContent = state.sqlServerConnected
      ? 'PoluxImportDB (SQL Server): Conectado'
      : 'SQL Server: Desconectado';
  }

  const smtpBadge = document.getElementById('smtp-badge');
  if (smtpBadge) {
    smtpBadge.textContent =
      state.smtp?.mode === 'GMAIL_REAL_SMTP'
        ? `Gmail Real (${state.smtp.user})`
        : `SMTP Activo (${state.smtp?.user || 'Ethereal'})`;
  }
}

function renderWhatsAppBox() {
  const box = document.getElementById('wa-connection-box');
  if (!box) return;

  const wa = state.whatsapp || {};
  if (wa.state === 'CONNECTED') {
    box.innerHTML = `
      <div class="wa-connected-card">
        <div class="wa-ok-icon">✅</div>
        <div>
          <h3>WhatsApp Real Vinculado y Listo para Enviar Mensajes Automáticos</h3>
          <p>Número vinculado: <b>+${wa.connectedPhone}</b> (${wa.connectedName})</p>
          <small>
            Cuando un Lead esté entre <b>5 y 10 minutos</b> en <code>/landing</code> y salga sin comprar, este número le enviará automáticamente por WhatsApp la foto del producto y el link de compra sin intervención humana. Si supera los <b>10 minutos</b>, enviará la alerta al WhatsApp del Asesor.
          </small>
        </div>
      </div>
    `;
  } else if (wa.state === 'QR_READY' && wa.qrDataUrl) {
    box.innerHTML = `
      <div class="wa-qr-card">
        <img src="${wa.qrDataUrl}" alt="Código QR WhatsApp" class="qr-img" />
        <div>
          <h3>Escanea este QR con tu WhatsApp para activar el envío 100% automático</h3>
          <ol class="qr-steps">
            <li>Abre WhatsApp en tu celular (o el de Ronaldo).</li>
            <li>Ve a <b>Dispositivos vinculados → Vincular un dispositivo</b>.</li>
            <li>Escanea este código QR. Una vez vinculado, el agente enviará los mensajes reales con foto directo al WhatsApp del cliente cuando abandone la tienda de Polux.</li>
          </ol>
        </div>
      </div>
    `;
  } else {
    box.innerHTML = `
      <div class="wa-loading">
        Generando sesión con servidores de WhatsApp... (Si tarda más de 10 segundos, haz clic en "Generar Nuevo QR").
      </div>
    `;
  }
}

function renderLiveSessions() {
  const box = document.getElementById('live-sessions-box');
  const countBadge = document.getElementById('live-sessions-count');
  if (!box) return;

  const sessions = state.activeSessions || [];
  if (countBadge) countBadge.textContent = `${sessions.length} cliente(s) en tienda ahora`;

  if (sessions.length === 0) {
    box.innerHTML = `
      <div class="empty-sessions">
        No hay ningún cliente navegando en este segundo. Abre <a href="http://localhost:8080/landing" target="_blank"><b>http://localhost:8080/landing</b></a> para ver cómo el sensor detecta en tiempo real al cliente, el producto que mira y los segundos exactos.
      </div>
    `;
    return;
  }

  box.innerHTML = sessions
    .map(s => {
      const secs = Number(s.secondsViewed || 0);
      const mm = String(Math.floor(secs / 60)).padStart(2, '0');
      const ss = String(secs % 60).padStart(2, '0');
      const ruleText =
        secs < 300
          ? 'Regla < 5 min (Se enviará Correo HTML al salir)'
          : secs <= 600
          ? 'Regla 5–10 min (Se enviará WhatsApp Real al salir)'
          : 'Regla > 10 min (Se enviará Alerta Crítica al Asesor al salir)';

      return `
        <div class="live-session-item">
          <div>
            <strong>👤 ${s.leadName}</strong>
            <div class="muted">📱 ${s.phone} · ✉️ ${s.email}</div>
            <div style="margin-top:4px;color:#60a5fa;font-weight:700;">🍎 Viendo ahora: ${s.productName}</div>
          </div>
          <div style="text-align:right;">
            <div class="live-clock">${mm}:${ss}</div>
            <span class="badge-tag">${ruleText}</span>
          </div>
        </div>
      `;
    })
    .join('');
}

function renderKpisAndAnalytics() {
  const k = state.kpis || {};
  document.getElementById('kpi-total').textContent = String(k.totalAbandonments || 0);
  document.getElementById('kpi-channels').textContent = `${k.byEmail || 0} Email / ${k.byWhatsapp || 0} WhatsApp`;
  document.getElementById('kpi-advisor').textContent = String(k.byAdvisor || 0);
  document.getElementById('kpi-converted').textContent = `${k.convertedToPayer || 0} (${k.conversionRate || 0}%)`;
  document.getElementById('kpi-revenue').textContent = `${fmtMoney(k.recoveredRevenuePen || 0)} vendidos y registrados en BD`;

  const summaryBox = document.getElementById('sql-channel-summary');
  if (!summaryBox) return;

  const byChannel = state.dbAnalytics?.byChannel || [];
  if (byChannel.length === 0) {
    summaryBox.innerHTML = `<p class="muted">Aún no hay agrupaciones en SQL Server.</p>`;
    return;
  }

  summaryBox.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>Rango de Permanencia</th>
          <th>Canal Disparado</th>
          <th>Total Abandonos</th>
          <th>Convertidos a PAYER (Vendidos)</th>
          <th>Tasa Conversión</th>
          <th>Monto Vendido (PEN)</th>
        </tr>
      </thead>
      <tbody>
        ${byChannel
          .map(row => {
            const total = Number(row.totalAbandonments || 0);
            const conv = Number(row.convertedCount || 0);
            const rate = total > 0 ? Math.round((conv / total) * 100) : 0;
            return `
              <tr>
                <td><b>${row.tier}</b></td>
                <td><span class="pill-channel ${row.channel}">${row.channel}</span></td>
                <td>${total}</td>
                <td><b style="color:#34d399;">${conv}</b></td>
                <td><b>${rate}%</b></td>
                <td><b>${fmtMoney(row.totalSoldPen)}</b></td>
              </tr>
            `;
          })
          .join('')}
      </tbody>
    </table>
  `;
}

function renderEventsTable() {
  const tbody = document.getElementById('events-tbody');
  if (!tbody) return;

  const events = state.events || [];
  if (events.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="muted">Sin eventos registrados.</td></tr>`;
    return;
  }

  tbody.innerHTML = events
    .map(ev => {
      const deliv = ev.deliveryResult || {};
      let deliveryBadge = '';
      if (ev.channel === 'CORREO_HTML') {
        deliveryBadge = deliv.sent
          ? `✅ Correo Enviado ${ev.emailPreviewUrl ? `(<a href="${ev.emailPreviewUrl}" target="_blank" style="color:#60a5fa;">Ver Inbox Real ↗</a>)` : ''}`
          : `⚠️ Error SMTP: ${deliv.reason || ''}`;
      } else if (ev.channel === 'WHATSAPP_DIRECTO') {
        deliveryBadge = deliv.sent
          ? `✅ WhatsApp Enviado Directo al Celular`
          : `<a href="${ev.waManualFallbackUrl}" target="_blank" class="link-wa">📲 Enviar por WhatsApp Web ↗</a>`;
      } else {
        deliveryBadge = deliv.sent
          ? `✅ Alerta Enviada al WhatsApp del Asesor · <a href="${ev.telCallUrl}" class="link-call">📞 Llamar ${ev.leadPhone}</a>`
          : `<a href="${ev.telCallUrl}" class="link-call">📞 Llamar ahora a ${ev.leadPhone}</a>`;
      }

      return `
        <tr>
          <td>#${ev.sqlRetargetingId || String(ev.id).slice(-4)}</td>
          <td>
            <strong>${ev.leadName}</strong>
            <div class="muted">${ev.leadPhone} · ${ev.leadEmail}</div>
          </td>
          <td>
            <strong>${ev.productName}</strong>
            <div style="color:#60a5fa;font-weight:700;">${fmtMoney(ev.productPrice)}</div>
          </td>
          <td><b>${ev.durationLabel}</b></td>
          <td>
            <span class="pill-channel ${ev.channel}">${ev.channel}</span>
            <div class="muted" style="font-size:11px;margin-top:2px;">${ev.tier} (${ev.probability}% prob.)</div>
          </td>
          <td>${deliveryBadge}</td>
          <td>
            ${
              ev.status === 'CONVERTIDO_PAYER'
                ? `<span class="status-payer">✅ PAYER (${ev.paymentInfo?.receiptNumber || 'B001'})</span>`
                : `<span class="status-lead">⏳ LEAD (En seguimiento)</span>`
            }
          </td>
          <td>
            ${
              ev.status !== 'CONVERTIDO_PAYER'
                ? `<button class="btn-convert-sm" onclick="markConvertedToPayer(${ev.id})">💳 Registrar Pago → PAYER</button>`
                : `<span class="muted">Vendido ✔</span>`
            }
          </td>
        </tr>
      `;
    })
    .join('');
}

async function saveAgentConfig(e) {
  e.preventDefault();
  const advisorName = document.getElementById('cfg-advisor-name').value;
  const advisorPhone = document.getElementById('cfg-advisor-phone').value;
  const smtpUser = document.getElementById('cfg-smtp-user').value;
  const smtpPass = document.getElementById('cfg-smtp-pass').value;

  const res = await fetch('/api/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ advisorName, advisorPhone, smtpUser, smtpPass })
  });
  const data = await res.json();
  if (data.ok) {
    showToast('✅ Configuración real guardada correctamente.');
    fetchStatus();
  } else {
    showToast('Error: ' + data.error);
  }
}

async function resetWhatsAppSession() {
  await fetch('/api/whatsapp/reset', { method: 'POST' });
  showToast('Generando nuevo código QR de WhatsApp...');
  setTimeout(fetchStatus, 1500);
}

async function markConvertedToPayer(eventId) {
  const res = await fetch(`/api/retargeting/${eventId}/convert`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paymentMethod: 'YAPE' })
  });
  const data = await res.json();
  if (data.ok) {
    showToast(`🎉 Venta registrada en PoluxImportDB: ${data.event.leadName} ahora es PAYER (${data.event.paymentInfo?.receiptNumber})`);
    fetchStatus();
  }
}

window.addEventListener('DOMContentLoaded', () => {
  fetchStatus();
  setInterval(fetchStatus, 2500);
});
