/**
 * ============================================================================
 * POLUX RETARGETING - TORRE DE CONTROL OPERATIVA (LEAD -> PAYER)
 * ============================================================================
 */

let state = {};
let configInitialized = false;

function fmtMoney(n) {
  return 'S/ ' + Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showToast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => el.classList.add('hidden'), 4500);
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
      document.getElementById('cfg-email-max').value = state.config.emailMaxSeconds || 300;
      document.getElementById('cfg-wa-max').value = state.config.whatsappMaxSeconds || 600;
      document.getElementById('cfg-timeout').value = state.config.abandonTimeoutSeconds || 25;
      document.getElementById('cfg-cooldown').value = state.config.cooldownMinutes ?? 10;
      configInitialized = true;
    }

    renderTopbar();
    renderKpis();
    renderLiveSessions();
    renderWhatsAppBox();
    renderAdvisorQueue();
    renderEventsTable();
    renderAnalyticsSummary();
  } catch (err) {
    console.error('Error sincronizando estado:', err);
  }
}

function renderTopbar() {
  const waPill = document.getElementById('wa-pill');
  const waText = document.getElementById('wa-pill-text');
  if (waPill && waText) {
    if (state.whatsapp?.state === 'CONNECTED') {
      waPill.className = 'status-pill emerald';
      waText.textContent = `WhatsApp: +${state.whatsapp.connectedPhone}`;
    } else if (state.whatsapp?.state === 'QR_READY') {
      waPill.className = 'status-pill amber';
      waText.textContent = 'WhatsApp: Escanear QR';
    } else {
      waPill.className = 'status-pill amber';
      waText.textContent = 'WhatsApp: Conectando...';
    }
  }

  const smtpPill = document.getElementById('smtp-pill');
  const smtpText = document.getElementById('smtp-pill-text');
  if (smtpPill && smtpText) {
    if (state.smtp?.mode === 'GMAIL_REAL_SMTP') {
      smtpPill.className = 'status-pill emerald';
      smtpText.textContent = `Gmail Real: ${state.smtp.user}`;
    } else if (state.smtp?.mode === 'ETHEREAL_SMTP_FALLBACK') {
      smtpPill.className = 'status-pill blue';
      smtpText.textContent = 'SMTP Prueba (Ethereal)';
    } else {
      smtpPill.className = 'status-pill amber';
      smtpText.textContent = 'SMTP: Error';
    }
  }

  const sqlPill = document.getElementById('sql-pill');
  const sqlText = document.getElementById('sql-pill-text');
  if (sqlPill && sqlText) {
    sqlPill.className = state.sqlServerConnected ? 'status-pill emerald' : 'status-pill amber';
    sqlText.textContent = state.sqlServerConnected ? 'PoluxImportDB: Conectado' : 'BD: Respaldo JSON';
  }
}

function renderKpis() {
  const k = state.kpis || {};
  const sessions = state.activeSessions || [];
  document.getElementById('kpi-live').textContent = String(sessions.length);
  document.getElementById('kpi-total').textContent = String(k.totalAbandonments || 0);
  document.getElementById('kpi-channels-foot').textContent = `${k.byEmail || 0} Email · ${k.byWhatsapp || 0} WhatsApp · ${k.byAdvisor || 0} Asesor`;
  document.getElementById('kpi-pending-adv').textContent = String(k.pendingAdvisorCalls || 0);
  document.getElementById('kpi-converted').textContent = `${k.convertedToPayer || 0} (${k.conversionRate || 0}%)`;
  document.getElementById('kpi-revenue').textContent = `${fmtMoney(k.recoveredRevenuePen || 0)} facturados con Boleta SUNAT`;

  const dbTotals = document.getElementById('db-funnel-totals');
  if (dbTotals && state.dbAnalytics) {
    dbTotals.textContent = `BD PoluxImportDB: ${state.dbAnalytics.totalLeadsInDb || 0} Leads · ${state.dbAnalytics.totalPayersInDb || 0} Payers`;
  }
}

function renderLiveSessions() {
  const box = document.getElementById('live-sessions-box');
  const badge = document.getElementById('live-count-badge');
  const sessions = state.activeSessions || [];
  if (badge) badge.textContent = `${sessions.length} en tienda`;
  if (!box) return;

  if (sessions.length === 0) {
    box.innerHTML = `
      <div class="empty-box">
        No hay visitantes activos ahora mismo.<br/>
        Cuando alguien ingrese a <a href="http://localhost:8080/landing" target="_blank" style="color:var(--blue);font-weight:600;">Tienda Polux (/landing)</a>, su sesión aparecerá aquí en vivo y el sweeper autónomo detectará si abandona sin pagar.
      </div>
    `;
    return;
  }

  box.innerHTML = sessions
    .map(s => {
      const secs = Number(s.secondsViewed || 0);
      const mm = String(Math.floor(secs / 60)).padStart(2, '0');
      const ss = String(secs % 60).padStart(2, '0');
      const analysis = s.analysis || {};
      const nextRule =
        analysis.channel === 'CORREO_HTML'
          ? 'Regla < 5m → Correo HTML'
          : analysis.channel === 'WHATSAPP_DIRECTO'
          ? 'Regla 5–10m → WhatsApp Directo'
          : 'Regla > 10m → Alerta Asesor SLA';

      return `
        <div class="session-item">
          <div>
            <strong>${escapeHtml(s.leadName)}</strong>
            <div class="muted-sm">${escapeHtml(s.phone || 'Sin teléfono aún')} · ${escapeHtml(s.email || 'Sin correo aún')}</div>
            <div style="font-size:12px;font-weight:600;color:var(--blue);margin-top:3px;">Evaluando: ${escapeHtml(s.productName)}</div>
            <span class="score-chip">Intención ${analysis.probability || 30}% · ${escapeHtml(nextRule)}</span>
          </div>
          <div style="text-align:right;">
            <div class="session-clock">${mm}:${ss}</div>
            <span class="muted-sm">en tienda</span>
          </div>
        </div>
      `;
    })
    .join('');
}

function renderWhatsAppBox() {
  const box = document.getElementById('wa-connection-box');
  if (!box) return;
  const wa = state.whatsapp || {};

  if (wa.state === 'CONNECTED') {
    box.innerHTML = `
      <div class="wa-connected-bar">
        <div>
          <strong>✓ WhatsApp Bidireccional Activo (+${escapeHtml(wa.connectedPhone)})</strong>
          <span>Envía recuperaciones con foto y responde automáticamente consultas de stock, cuotas y link Yape.</span>
        </div>
      </div>
    `;
  } else if (wa.state === 'QR_READY' && wa.qrDataUrl) {
    box.innerHTML = `
      <div class="wa-qr-panel">
        <img src="${wa.qrDataUrl}" alt="QR WhatsApp" />
        <div>
          <strong style="font-size:13px;">Vincular WhatsApp Oficial (Chip Secundario o Empresa)</strong>
          <ol>
            <li>Abre WhatsApp en el celular → <b>Dispositivos vinculados</b>.</li>
            <li>Toca <b>Vincular un dispositivo</b> y escanea este QR.</li>
            <li>La sesión quedará guardada localmente para envíos y respuestas automáticas.</li>
          </ol>
        </div>
      </div>
    `;
  } else {
    box.innerHTML = `<div class="empty-box" style="padding:12px;">Iniciando sesión de WhatsApp...</div>`;
  }
}

function renderAdvisorQueue() {
  const box = document.getElementById('advisor-queue-box');
  const countBadge = document.getElementById('advisor-queue-count');
  if (!box) return;

  const urgent = (state.events || []).filter(
    e => e.channel === 'ALERTA_ASESOR_LLAMADA' && e.status !== 'CONVERTIDO_PAYER'
  );
  const pendingCount = urgent.filter(e => !e.advisorClaimedAt).length;
  if (countBadge) countBadge.textContent = `${pendingCount} pendiente(s)`;

  if (urgent.length === 0) {
    box.innerHTML = `<div class="empty-box" style="padding:14px;">Sin alertas de llamada pendientes (&gt; 10 min).</div>`;
    return;
  }

  box.innerHTML = urgent
    .slice(0, 4)
    .map(ev => {
      const elapsedSec = ev.advisorClaimedAt
        ? ev.slaSeconds
        : Math.max(0, Math.round((Date.now() - new Date(ev.createdAt).getTime()) / 1000));
      const mm = String(Math.floor(elapsedSec / 60)).padStart(2, '0');
      const ss = String(elapsedSec % 60).padStart(2, '0');
      const slaText = ev.advisorClaimedAt
        ? `Atendido en ${mm}:${ss} ✓`
        : `SLA esperando: ${mm}:${ss} (Meta < 02:00)`;

      return `
        <div class="advisor-alert-item">
          <div class="advisor-alert-top">
            <div>
              <strong>${escapeHtml(ev.leadName)}</strong>
              <span class="muted-sm"> · ${escapeHtml(ev.leadPhone)} · ${escapeHtml(ev.productName)} (${fmtMoney(ev.productPrice)})</span>
            </div>
            <span class="sla-timer">${slaText}</span>
          </div>
          ${
            ev.advisorScript?.opening
              ? `<div class="advisor-script">${escapeHtml(ev.advisorScript.opening)}</div>`
              : ''
          }
          <div class="advisor-actions">
            <a href="${escapeHtml(ev.telCallUrl || '#')}" class="btn-secondary-sm">📞 Discar ${escapeHtml(ev.leadPhone)}</a>
            ${
              !ev.advisorClaimedAt
                ? `<button type="button" class="btn-primary-sm" onclick="claimAdvisorCall(${ev.id})">Marcar Llamada Iniciada</button>`
                : ''
            }
            <button type="button" class="btn-emerald-sm" onclick="markConvertedToPayer(${ev.id})">💳 Cerrar Venta → PAYER</button>
          </div>
        </div>
      `;
    })
    .join('');
}

function renderEventsTable() {
  const tbody = document.getElementById('events-tbody');
  if (!tbody) return;
  const events = state.events || [];

  if (events.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--muted);padding:24px;">Aún no hay abandonos registrados.</td></tr>`;
    return;
  }

  tbody.innerHTML = events
    .map(ev => {
      const deliv = ev.deliveryResult || {};
      const msgCount = Array.isArray(ev.conversation) ? ev.conversation.length : 0;
      const clientReplies = Array.isArray(ev.conversation) ? ev.conversation.filter(m => m.from === 'CLIENT').length : 0;

      let deliveryHtml = '';
      if (ev.channel === 'CORREO_HTML') {
        deliveryHtml = deliv.sent
          ? `✓ Correo enviado (${escapeHtml(deliv.mode === 'GMAIL_REAL_SMTP' ? 'Gmail' : 'Ethereal')})` +
            (ev.emailPreviewUrl ? ` · <a href="${escapeHtml(ev.emailPreviewUrl)}" target="_blank" style="color:var(--blue);font-weight:600;">Ver Inbox ↗</a>` : '')
          : `<span style="color:var(--rose);">Error: ${escapeHtml(deliv.reason || 'SMTP')}</span>`;
      } else if (ev.channel === 'WHATSAPP_DIRECTO') {
        deliveryHtml = deliv.sent
          ? `✓ WhatsApp entregado`
          : `<a href="${escapeHtml(ev.waManualFallbackUrl || '#')}" target="_blank" style="color:var(--emerald);font-weight:600;">Abrir WhatsApp Web ↗</a>`;
        if (msgCount > 0) {
          deliveryHtml += ` <button type="button" class="btn-secondary-sm" style="margin-left:4px;padding:3px 7px;" onclick="openChatModal(${ev.id})">💬 Chat (${msgCount}${clientReplies ? `, ${clientReplies} resp.` : ''})</button>`;
        }
      } else {
        deliveryHtml = deliv.sent
          ? `✓ Alerta WhatsApp al Asesor`
          : `<a href="${escapeHtml(ev.telCallUrl || '#')}" style="color:var(--rose);font-weight:600;">📞 Llamar ${escapeHtml(ev.leadPhone)}</a>`;
      }

      const reasonsHint = Array.isArray(ev.intentReasons) ? ev.intentReasons.join(' · ') : '';

      return `
        <tr>
          <td style="font-family:var(--font-mono);font-size:11px;">#${ev.sqlRetargetingId || String(ev.id).slice(-4)}</td>
          <td>
            <strong>${escapeHtml(ev.leadName)}</strong>
            <div class="muted-sm">${escapeHtml(ev.leadPhone)} · ${escapeHtml(ev.leadEmail)}</div>
          </td>
          <td>
            <strong>${escapeHtml(ev.productName)}</strong>
            <div style="color:var(--blue);font-weight:700;">${fmtMoney(ev.productPrice)}</div>
          </td>
          <td title="${escapeHtml(reasonsHint)}">
            <b>${escapeHtml(ev.durationLabel)}</b>
            <div class="muted-sm">Score: <b>${ev.probability || 0}%</b></div>
          </td>
          <td><span class="channel-pill ${escapeHtml(ev.channel)}">${escapeHtml(ev.channel)}</span></td>
          <td style="font-size:11.5px;">
            ${deliveryHtml}
            ${ev.recoverToken ? `<div class="muted-sm" style="margin-top:3px;">Link: <a href="${escapeHtml(ev.checkoutUrl)}" target="_blank" style="color:var(--blue);">${escapeHtml(ev.recoverToken)} ↗</a></div>` : ''}
          </td>
          <td>
            ${
              ev.status === 'CONVERTIDO_PAYER'
                ? `<span class="stage-pill payer">✓ PAYER (${escapeHtml(ev.paymentInfo?.receiptNumber || 'B001')})</span>`
                : `<span class="stage-pill lead">LEAD</span>`
            }
          </td>
          <td>
            ${
              ev.status !== 'CONVERTIDO_PAYER'
                ? `<button type="button" class="btn-emerald-sm" onclick="markConvertedToPayer(${ev.id})">💳 Pago → PAYER</button>`
                : `<span class="muted-sm" style="color:var(--emerald);font-weight:600;">Vendido</span>`
            }
          </td>
        </tr>
      `;
    })
    .join('');
}

function renderAnalyticsSummary() {
  const box = document.getElementById('sql-channel-summary');
  if (!box) return;
  const rows = state.dbAnalytics?.byChannel || [];
  if (rows.length === 0) {
    box.innerHTML = `<p class="muted-sm">Sin métricas agrupadas en SQL Server todavía.</p>`;
    return;
  }

  box.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>Rango</th>
          <th>Canal</th>
          <th>Abandonos</th>
          <th>Convertidos a PAYER</th>
          <th>Conversión</th>
          <th>Monto Vendido (PEN)</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map(r => {
            const tot = Number(r.totalAbandonments || 0);
            const conv = Number(r.convertedCount || 0);
            const rate = tot > 0 ? Math.round((conv / tot) * 100) : 0;
            return `
              <tr>
                <td><b>${escapeHtml(r.tier)}</b></td>
                <td><span class="channel-pill ${escapeHtml(r.channel)}">${escapeHtml(r.channel)}</span></td>
                <td>${tot}</td>
                <td><b style="color:var(--emerald);">${conv}</b></td>
                <td><b>${rate}%</b></td>
                <td style="font-weight:700;">${fmtMoney(r.totalSoldPen)}</td>
              </tr>
            `;
          })
          .join('')}
      </tbody>
    </table>
  `;
}

// ACCIONES
function openChatModal(eventId) {
  const ev = (state.events || []).find(e => Number(e.id) === Number(eventId));
  if (!ev) return;
  document.getElementById('chat-modal-title').textContent = `${ev.leadName} (${ev.leadPhone})`;
  document.getElementById('chat-modal-meta').textContent = `Producto: ${ev.productName} · Token: ${ev.recoverToken || '-'}`;
  const body = document.getElementById('chat-modal-body');
  const msgs = ev.conversation || [];

  body.innerHTML = msgs.length
    ? msgs
        .map(m => {
          const isClient = m.from === 'CLIENT';
          const timeStr = m.at ? new Date(m.at).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) : '';
          return `
            <div class="chat-msg ${isClient ? 'client' : 'agent'}">
              <strong>${isClient ? escapeHtml(ev.leadFirstName || 'Cliente') : 'Polux Imports Bot'}:</strong><br/>
              ${escapeHtml(m.text)}
              <span class="chat-msg-time">${timeStr}</span>
            </div>
          `;
        })
        .join('')
    : `<div class="empty-box">Sin mensajes registrados todavía.</div>`;

  document.getElementById('chat-modal').classList.remove('hidden');
}

function closeChatModal() {
  document.getElementById('chat-modal').classList.add('hidden');
}

async function claimAdvisorCall(eventId) {
  const res = await fetch(`/api/retargeting/${eventId}/advisor-claim`, { method: 'POST' });
  const data = await res.json();
  if (data.ok) {
    showToast(`📞 Llamada tomada en ${data.event.slaSeconds}s (SLA actualizado en BD).`);
    fetchStatus();
  }
}

async function markConvertedToPayer(eventId) {
  const res = await fetch(`/api/retargeting/${eventId}/convert`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paymentMethod: 'YAPE' })
  });
  const data = await res.json();
  if (data.ok) {
    showToast(`✓ Venta cerrada: ${data.event.leadName} ahora es PAYER (${data.event.paymentInfo?.receiptNumber})`);
    fetchStatus();
  }
}

function toggleAdminDrawer() {
  const body = document.getElementById('admin-drawer-body');
  const lbl = document.getElementById('drawer-toggle-label');
  const hidden = body.classList.toggle('hidden');
  if (lbl) lbl.textContent = hidden ? '▼ Abrir ajustes' : '▲ Ocultar';
}

async function saveAgentConfig(e) {
  e.preventDefault();
  const payload = {
    advisorName: document.getElementById('cfg-advisor-name').value,
    advisorPhone: document.getElementById('cfg-advisor-phone').value,
    smtpUser: document.getElementById('cfg-smtp-user').value,
    smtpPass: document.getElementById('cfg-smtp-pass').value,
    emailMaxSeconds: Number(document.getElementById('cfg-email-max').value),
    whatsappMaxSeconds: Number(document.getElementById('cfg-wa-max').value),
    abandonTimeoutSeconds: Number(document.getElementById('cfg-timeout').value),
    cooldownMinutes: Number(document.getElementById('cfg-cooldown').value)
  };

  const res = await fetch('/api/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (data.ok) {
    showToast(`✓ Parámetros guardados. SMTP activo: ${data.smtp?.mode}`);
    document.getElementById('cfg-smtp-pass').value = '';
    fetchStatus();
  } else {
    showToast('Error: ' + data.error);
  }
}

async function runControlledAudit(secondsViewed) {
  const leadName = document.getElementById('audit-name').value;
  const phone = document.getElementById('audit-phone').value;
  const email = document.getElementById('audit-email').value;
  const productId = Number(document.getElementById('audit-product').value || 1);

  showToast(`⏳ Ejecutando envío real (${Math.floor(secondsViewed / 60)} min)...`);
  const res = await fetch('/api/retargeting/abandon', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      leadName,
      phone,
      email,
      productId,
      secondsViewed,
      bypassCooldown: true,
      exitReason: 'AUDITORIA_CONTROLADA'
    })
  });
  const data = await res.json();
  if (data.ok && data.event) {
    const ev = data.event;
    if (ev.channel === 'CORREO_HTML') {
      showToast(ev.deliveryResult?.sent ? `✉️ Correo real enviado a ${ev.leadEmail}` : `⚠️ Correo no enviado: ${ev.deliveryResult?.reason}`);
      if (ev.emailPreviewUrl) window.open(ev.emailPreviewUrl, '_blank');
    } else if (ev.channel === 'WHATSAPP_DIRECTO') {
      showToast(ev.deliveryResult?.sent ? `💬 WhatsApp real enviado a ${ev.leadPhone}` : `⚠️ ${ev.deliveryResult?.reason}`);
    } else {
      showToast(`📞 Alerta SLA creada y enviada al Asesor (${state.config?.advisorPhone})`);
    }
    fetchStatus();
  }
}

async function resetWhatsAppSession() {
  await fetch('/api/whatsapp/reset', { method: 'POST' });
  showToast('Generando nuevo código QR...');
  setTimeout(fetchStatus, 1500);
}

window.addEventListener('DOMContentLoaded', () => {
  fetchStatus();
  setInterval(fetchStatus, 2500);
});
