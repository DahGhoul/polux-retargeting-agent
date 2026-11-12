/**
 * ============================================================================
 * POLUX RETARGETING SUITE - FASE LEAD -> PAYER (LÓGICA DEL CLIENTE)
 * Control interactivo, vistas previas reactivas, WhatsApp real y conversión a PAYER.
 * ============================================================================
 */

let state = {};
let configInitialized = false;
let selectedSeconds = 450; // Preset inicial: 07:30 min (Regla 2 WhatsApp)
let currentPreviewTab = 'WHATSAPP';

const PRODUCTS = {
  1: {
    id: 1,
    name: 'iPhone 16 Pro Max 256 GB',
    color: 'Titanio Natural',
    capacity: '256 GB',
    price: 6599.00,
    installment3: 2199.67,
    image: 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?auto=format&fit=crop&w=900&q=85'
  },
  2: {
    id: 2,
    name: 'iPhone 16 128 GB',
    color: 'Ultramarino',
    capacity: '128 GB',
    price: 4299.00,
    installment3: 1433.00,
    image: 'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?auto=format&fit=crop&w=900&q=85'
  },
  3: {
    id: 3,
    name: 'MacBook Air 13" Chip M4',
    color: 'Medianoche',
    capacity: '16GB / 512GB',
    price: 5499.00,
    installment3: 1833.00,
    image: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=900&q=85'
  },
  4: {
    id: 4,
    name: 'iPad Air 11" Chip M3',
    color: 'Azul Cielo',
    capacity: '128 GB Wi-Fi',
    price: 3199.00,
    installment3: 1066.33,
    image: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?auto=format&fit=crop&w=900&q=85'
  },
  5: {
    id: 5,
    name: 'Apple Watch Series 10',
    color: 'Negro Azabache',
    capacity: '46mm GPS',
    price: 2199.00,
    installment3: 733.00,
    image: 'https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?auto=format&fit=crop&w=900&q=85'
  },
  6: {
    id: 6,
    name: 'AirPods Pro 2 USB-C',
    color: 'Blanco',
    capacity: 'USB-C MagSafe',
    price: 1099.00,
    installment3: 366.33,
    image: 'https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?auto=format&fit=crop&w=900&q=85'
  }
};

function fmtMoney(n) {
  return 'S/ ' + Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function showToast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => el.classList.add('hidden'), 4800);
}

// ----------------------------------------------------------------------------
// 1. SELECTOR DE TIEMPO Y VISTAS PREVIAS REACTIVAS
// ----------------------------------------------------------------------------
function selectTimePreset(seconds) {
  selectedSeconds = seconds;
  document.getElementById('btn-preset-1')?.classList.toggle('active', seconds < 300);
  document.getElementById('btn-preset-2')?.classList.toggle('active', seconds >= 300 && seconds <= 600);
  document.getElementById('btn-preset-3')?.classList.toggle('active', seconds > 600);

  // Auto-cambiar la pestaña de previsualización al canal recomendado
  if (seconds < 300) {
    switchPreviewTab('EMAIL');
  } else if (seconds <= 600) {
    switchPreviewTab('WHATSAPP');
  } else {
    switchPreviewTab('ADVISOR');
  }

  updateLivePreview();
}

function switchPreviewTab(tab) {
  currentPreviewTab = tab;
  document.getElementById('tab-email')?.classList.toggle('active', tab === 'EMAIL');
  document.getElementById('tab-whatsapp')?.classList.toggle('active', tab === 'WHATSAPP');
  document.getElementById('tab-advisor')?.classList.toggle('active', tab === 'ADVISOR');

  document.getElementById('preview-email-view')?.classList.toggle('hidden', tab !== 'EMAIL');
  document.getElementById('preview-whatsapp-view')?.classList.toggle('hidden', tab !== 'WHATSAPP');
  document.getElementById('preview-advisor-view')?.classList.toggle('hidden', tab !== 'ADVISOR');
}

function updateLivePreview() {
  const leadName = document.getElementById('test-name')?.value || 'Ronaldo Robles Romero';
  const firstName = leadName.trim().split(' ')[0] || 'Ronaldo';
  const firstNameUpper = firstName.toUpperCase();
  const phone = document.getElementById('test-phone')?.value || '+51 944 820 915';
  const email = document.getElementById('test-email')?.value || 'ronaldo.robles@unitru.edu.pe';
  const prodId = Number(document.getElementById('test-product')?.value || 1);
  const product = PRODUCTS[prodId] || PRODUCTS[1];

  const mm = String(Math.floor(selectedSeconds / 60)).padStart(2, '0');
  const ss = String(selectedSeconds % 60).padStart(2, '0');
  const timeBadge = document.getElementById('current-time-badge');
  if (timeBadge) timeBadge.textContent = `${mm}m ${ss}s (${selectedSeconds} seg)`;

  // Diagnóstico del agente
  const diagIntent = document.getElementById('diag-intent');
  const diagTitle = document.getElementById('diag-action-title');
  const diagRationale = document.getElementById('diag-rationale');
  const btnLabel = document.getElementById('btn-execute-label');

  if (selectedSeconds < 300) {
    // REGLA 1: < 5 MIN
    if (diagIntent) diagIntent.textContent = '36% (Interés Exploratorio)';
    if (diagTitle) diagTitle.textContent = '✉️ Canal: Correo Transaccional de Recuperación';
    if (diagRationale) {
      diagRationale.textContent =
        `El cliente revisó el catálogo por menos de 5 minutos (${mm}:${ss} min). Es un visitante en etapa inicial que aún compara alternativas. La mejor estrategia es un recordatorio visual no invasivo por correo con la ficha del equipo y acceso directo al checkout.`;
    }
    if (btnLabel) btnLabel.textContent = `🚀 Ejecutar Recuperación (Enviar Correo Real a ${email})`;
  } else if (selectedSeconds <= 600) {
    // REGLA 2: 5-10 MIN
    if (diagIntent) diagIntent.textContent = '74% (Compra Posible · Alta Intención)';
    if (diagTitle) diagTitle.textContent = '💬 Canal: WhatsApp Business Directo con Foto';
    if (diagRationale) {
      diagRationale.textContent =
        `El cliente permaneció ${mm}:${ss} minutos analizando detalladamente especificaciones, colores y precios. Superó la curiosidad y estuvo a punto de comprar. Requiere contacto directo y personalizado vía WhatsApp para resolver dudas de pago o cuotas.`;
    }
    if (btnLabel) btnLabel.textContent = `🚀 Ejecutar Recuperación (Enviar WhatsApp Real a ${phone})`;
  } else {
    // REGLA 3: > 10 MIN
    if (diagIntent) diagIntent.textContent = '92% (Probabilidad Crítica de Cierre)';
    if (diagTitle) diagTitle.textContent = '🚨 Canal: Asignación a Asesor Comercial + Llamada';
    if (diagRationale) {
      diagRationale.textContent =
        `El cliente superó los 10 minutos (${mm}:${ss} min) revisando el producto y salió en la fase final de decisión. Es un abandono crítico. El agente alerta al WhatsApp del asesor y prepara el guion de llamada inmediata para cerrar la venta por teléfono.`;
    }
    if (btnLabel) btnLabel.textContent = `🚨 Ejecutar Recuperación (Alertar al Asesor para Llamar a ${firstName})`;
  }

  // Previews dinámicas
  // 1. WhatsApp Preview
  const waImg = document.getElementById('wa-preview-img');
  if (waImg) waImg.src = product.image;
  const waText = document.getElementById('wa-preview-text');
  if (waText) {
    waText.textContent =
      `¡Hola ${firstNameUpper}! 🐾🐶 ¿Tuviste alguna duda con la capacidad (${product.capacity}), el color (${product.color}) o los métodos de pago?\n\n` +
      `📱 *Equipo:* ${product.name}\n` +
      `💰 *Precio Especial:* ${fmtMoney(product.price)} (o 3 cuotas sin interés de ${fmtMoney(product.installment3)})\n\n` +
      `Estamos aquí en Polux Imports Trujillo para ayudarte a concretar tu pedido con garantía oficial Apple.`;
  }

  // 2. Email Preview
  const emailTo = document.getElementById('email-preview-to');
  if (emailTo) emailTo.textContent = email;
  const emailGreeting = document.getElementById('email-preview-greeting');
  if (emailGreeting) emailGreeting.textContent = `Hola, ${firstNameUpper}`;
  const emailImg = document.getElementById('email-preview-img');
  if (emailImg) emailImg.src = product.image;
  const emailProdTitle = document.getElementById('email-preview-prod-title');
  if (emailProdTitle) emailProdTitle.textContent = `${product.name} (${product.color})`;
  const emailPrice = document.getElementById('email-preview-prod-price');
  if (emailPrice) emailPrice.textContent = fmtMoney(product.price);
  const emailInst = document.getElementById('email-preview-installments');
  if (emailInst) emailInst.textContent = `o 3 cuotas sin interés de ${fmtMoney(product.installment3)}`;

  // 3. Advisor Preview
  const advName = document.getElementById('adv-client-name');
  if (advName) advName.textContent = leadName;
  const advPhone = document.getElementById('adv-client-phone');
  if (advPhone) advPhone.textContent = phone;
  const advProd = document.getElementById('adv-client-product');
  if (advProd) advProd.textContent = `${product.name} (${fmtMoney(product.price)})`;
  const advCall = document.getElementById('adv-call-link');
  if (advCall) {
    advCall.href = `tel:${phone.replace(/\s+/g, '')}`;
    advCall.textContent = `📞 Iniciar Llamada Directa a ${firstName} (${phone})`;
  }
  const advScript = document.getElementById('adv-script-text');
  if (advScript) {
    advScript.textContent =
      `"¡Hola ${firstName}! Te saluda ${state.config?.advisorName || 'Diego Cuba'} de Polux Imports Trujillo. Vimos que estuviste más de 10 minutos evaluando el ${product.name} en nuestra web. Te llamo personalmente para ayudarte con la reserva y activarte las 3 cuotas sin intereses o entrega express garantizada hoy mismo."`;
  }
}

// ----------------------------------------------------------------------------
// 2. DISPARO REAL DEL AGENTE (EJECUTAR RECUPERACIÓN)
// ----------------------------------------------------------------------------
async function executeCurrentRecovery() {
  const leadName = document.getElementById('test-name')?.value || 'Ronaldo Robles Romero';
  const phone = document.getElementById('test-phone')?.value || '+51 944 820 915';
  const email = document.getElementById('test-email')?.value || 'ronaldo.robles@unitru.edu.pe';
  const productId = Number(document.getElementById('test-product')?.value || 1);

  showToast(`⏳ Procesando retargeting autónomo (${Math.floor(selectedSeconds / 60)} min)...`);

  try {
    const res = await fetch('/api/retargeting/abandon', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        leadName,
        phone,
        email,
        productId,
        secondsViewed: selectedSeconds,
        exitReason: 'SIMULACION_CENTRO_CONTROL'
      })
    });
    const data = await res.json();
    if (data.ok && data.event) {
      const ev = data.event;
      if (ev.channel === 'CORREO_HTML') {
        showToast(`✉️ Correo de recuperación enviado a ${ev.leadEmail}. ¡Abriendo bandeja en vivo!`);
        if (ev.emailPreviewUrl) {
          window.open(ev.emailPreviewUrl, '_blank');
        }
      } else if (ev.channel === 'WHATSAPP_DIRECTO') {
        if (ev.deliveryResult?.sent) {
          showToast(`💬 ¡WhatsApp oficial con foto enviado con éxito al celular ${ev.leadPhone}!`);
        } else {
          showToast(`💬 Mensaje preparado para ${ev.leadPhone}. Abriendo enlace WhatsApp directo...`);
          if (ev.waManualFallbackUrl) window.open(ev.waManualFallbackUrl, '_blank');
        }
      } else {
        if (ev.deliveryResult?.sent) {
          showToast(`🚨 Alerta crítica entregada al WhatsApp del Asesor (${state.config?.advisorPhone})`);
        } else {
          showToast(`🚨 Alerta de llamada prioritaria registrada en SQL Server para ${ev.leadPhone}`);
        }
      }
      fetchStatus();
    }
  } catch (err) {
    showToast('Error al ejecutar retargeting: ' + err.message);
  }
}

// ----------------------------------------------------------------------------
// 3. CONSULTA DE ESTADO Y SINCRONIZACIÓN EN TIEMPO REAL
// ----------------------------------------------------------------------------
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
      updateLivePreview();
    }

    renderTopbar();
    renderWhatsAppStatus();
    renderLiveVisitors();
    renderKpis();
    renderAnalyticsSummary();
    renderEventsTable();
  } catch (err) {
    console.error('Error sincronizando estado del agente:', err);
  }
}

function renderTopbar() {
  const waPill = document.getElementById('wa-pill');
  const waText = document.getElementById('wa-pill-text');
  if (waPill && waText) {
    if (state.whatsapp?.state === 'CONNECTED') {
      waPill.className = 'pill pill-emerald';
      waText.textContent = `WhatsApp: Conectado (+${state.whatsapp.connectedPhone})`;
    } else if (state.whatsapp?.state === 'QR_READY') {
      waPill.className = 'pill pill-amber';
      waText.textContent = 'WhatsApp: Escanear QR para activar';
    } else {
      waPill.className = 'pill pill-amber';
      waText.textContent = 'WhatsApp: Iniciando...';
    }
  }

  const sqlPill = document.getElementById('sql-pill');
  const sqlText = document.getElementById('sql-pill-text');
  if (sqlPill && sqlText) {
    sqlPill.className = state.sqlServerConnected ? 'pill pill-emerald' : 'pill pill-amber';
    sqlText.textContent = state.sqlServerConnected
      ? 'PoluxImportDB: Conectado'
      : 'SQL Server: Modo Respaldo Local';
  }
}

function renderWhatsAppStatus() {
  const box = document.getElementById('wa-connection-box');
  if (!box) return;

  const wa = state.whatsapp || {};
  if (wa.state === 'CONNECTED') {
    box.innerHTML = `
      <div class="wa-connected-box">
        <div class="wa-check-icon">✓</div>
        <div class="wa-connected-details">
          <h3>Línea Oficial WhatsApp Conectada</h3>
          <p>Número vinculado: <b>+${wa.connectedPhone}</b> (${wa.connectedName || 'Polux Imports Bot'})</p>
          <small style="color:#047857;font-size:11px;margin-top:4px;display:block;">
            Los mensajes de retargeting con foto de producto y cuotas se envían de forma automática y silenciosa.
          </small>
        </div>
      </div>
    `;
  } else if (wa.state === 'QR_READY' && wa.qrDataUrl) {
    box.innerHTML = `
      <div class="wa-qr-box">
        <img src="${wa.qrDataUrl}" alt="Código QR WhatsApp" class="qr-code-img" />
        <div class="qr-instructions">
          <h3>Vincular WhatsApp Oficial para Envíos Automáticos</h3>
          <ol>
            <li>Abre WhatsApp en tu celular (o el de Ronaldo).</li>
            <li>Entra a <b>Dispositivos vinculados → Vincular un dispositivo</b>.</li>
            <li>Escanea este código QR para conectar la línea oficial.</li>
          </ol>
        </div>
      </div>
    `;
  } else {
    box.innerHTML = `
      <div style="padding:16px;background:#f8fafc;border-radius:10px;color:#64748b;font-size:12px;">
        Generando sesión segura con WhatsApp... Si tarda más de 5 segundos, presiona "Generar Nuevo QR".
      </div>
    `;
  }
}

function renderLiveVisitors() {
  const box = document.getElementById('live-sessions-box');
  const countBadge = document.getElementById('live-sessions-count');
  if (!box) return;

  const sessions = state.activeSessions || [];
  if (countBadge) countBadge.textContent = `${sessions.length} activo(s)`;

  if (sessions.length === 0) {
    box.innerHTML = `
      <div class="visitor-empty-state">
        No hay visitantes activos en este segundo.<br/>
        Abre <a href="http://localhost:8080/landing" target="_blank" style="color:#1d4ed8;font-weight:700;"><b>http://localhost:8080/landing</b></a> en otra pestaña para ver el sensor en vivo.
      </div>
    `;
    return;
  }

  box.innerHTML = sessions
    .map(s => {
      const secs = Number(s.secondsViewed || 0);
      const mm = String(Math.floor(secs / 60)).padStart(2, '0');
      const ss = String(secs % 60).padStart(2, '0');
      const channelLabel =
        secs < 300
          ? '✉️ Correo al salir'
          : secs <= 600
          ? '💬 WhatsApp con foto al salir'
          : '🚨 Alerta Asesor al salir';

      return `
        <div class="visitor-item">
          <div>
            <strong>👤 ${s.leadName}</strong>
            <div style="font-size:11.5px;color:#64748b;">${s.phone} · ${s.email}</div>
            <div style="margin-top:3px;color:#1d4ed8;font-weight:700;font-size:12px;">🍎 Evaluando: ${s.productName}</div>
          </div>
          <div style="text-align:right;">
            <div class="visitor-clock">${mm}:${ss}</div>
            <span style="font-size:11px;font-weight:600;color:#059669;">${channelLabel}</span>
          </div>
        </div>
      `;
    })
    .join('');
}

function renderKpis() {
  const k = state.kpis || {};
  const total = k.totalAbandonments || 0;
  const converted = k.convertedToPayer || 0;
  const rate = total > 0 ? Math.round((converted / total) * 100) : 0;

  document.getElementById('kpi-total').textContent = String(total);
  document.getElementById('kpi-channels').textContent = `${k.byEmail || 0} Email / ${k.byWhatsapp || 0} WhatsApp`;
  document.getElementById('kpi-advisor').textContent = String(k.byAdvisor || 0);
  document.getElementById('kpi-converted').textContent = `${converted} (${rate}%)`;
  document.getElementById('kpi-revenue').textContent = `${fmtMoney(k.recoveredRevenuePen || 0)} recuperados y facturados con SUNAT`;
}

function renderAnalyticsSummary() {
  const summaryBox = document.getElementById('sql-channel-summary');
  if (!summaryBox) return;

  const byChannel = state.dbAnalytics?.byChannel || [];
  if (byChannel.length === 0) {
    summaryBox.innerHTML = `<p style="color:#64748b;font-size:12px;padding:8px 0;">Aún no hay agrupaciones en SQL Server.</p>`;
    return;
  }

  summaryBox.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>Regla de Tiempo</th>
          <th>Canal Asignado</th>
          <th>Abandonos Interceptados</th>
          <th>Convertidos a PAYER (Ventas)</th>
          <th>Tasa de Éxito</th>
          <th>Monto Recuperado (PEN)</th>
        </tr>
      </thead>
      <tbody>
        ${byChannel
          .map(row => {
            const tot = Number(row.totalAbandonments || 0);
            const conv = Number(row.convertedCount || 0);
            const r = tot > 0 ? Math.round((conv / tot) * 100) : 0;
            return `
              <tr>
                <td><b>${row.tier}</b></td>
                <td><span class="badge-channel ${row.channel}">${row.channel}</span></td>
                <td>${tot}</td>
                <td><b style="color:#059669;">${conv}</b></td>
                <td><b>${r}%</b></td>
                <td style="font-weight:700;color:#1d4ed8;">${fmtMoney(row.totalSoldPen)}</td>
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
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:#94a3b8;padding:24px;">No hay eventos registrados aún.</td></tr>`;
    return;
  }

  tbody.innerHTML = events
    .map(ev => {
      const deliv = ev.deliveryResult || {};
      let delivText = '';

      if (ev.channel === 'CORREO_HTML') {
        delivText = deliv.sent
          ? `✓ Correo enviado ${ev.emailPreviewUrl ? `· <a href="${ev.emailPreviewUrl}" target="_blank" style="color:#1d4ed8;font-weight:600;">Ver correo ↗</a>` : ''}`
          : `⚠️ Pendiente SMTP`;
      } else if (ev.channel === 'WHATSAPP_DIRECTO') {
        delivText = deliv.sent
          ? `✓ WhatsApp directo entregado`
          : `<a href="${ev.waManualFallbackUrl}" target="_blank" style="color:#059669;font-weight:600;">📲 Abrir WhatsApp Web ↗</a>`;
      } else {
        delivText = deliv.sent
          ? `✓ Alerta enviada al Asesor`
          : `<a href="${ev.telCallUrl}" style="color:#e11d48;font-weight:600;">📞 Llamar a ${ev.leadPhone}</a>`;
      }

      return `
        <tr>
          <td style="font-family:var(--font-mono);font-size:11px;">#${ev.sqlRetargetingId || String(ev.id).slice(-4)}</td>
          <td>
            <strong>${ev.leadName}</strong>
            <div class="lead-contact-sub">${ev.leadPhone} · ${ev.leadEmail}</div>
          </td>
          <td>
            <strong>${ev.productName}</strong>
            <div class="product-price-cell">${fmtMoney(ev.productPrice)}</div>
          </td>
          <td><b>${ev.durationLabel}</b></td>
          <td><span class="badge-channel ${ev.channel}">${ev.channel}</span></td>
          <td style="font-size:11.5px;">${delivText}</td>
          <td>
            ${
              ev.status === 'CONVERTIDO_PAYER'
                ? `<span class="status-badge payer">✓ PAYER (${ev.paymentInfo?.receiptNumber || 'B001'})</span>`
                : `<span class="status-badge lead">⏳ LEAD (En Seguimiento)</span>`
            }
          </td>
          <td>
            ${
              ev.status !== 'CONVERTIDO_PAYER'
                ? `<button class="btn-convert-payer" onclick="markConvertedToPayer(${ev.id})">💳 Registrar Pago → PAYER</button>`
                : `<span class="sold-check">✓ Venta Concretada</span>`
            }
          </td>
        </tr>
      `;
    })
    .join('');
}

// ----------------------------------------------------------------------------
// 4. CONVERSIÓN A PAYER (CIERRE DE VENTA)
// ----------------------------------------------------------------------------
async function markConvertedToPayer(eventId) {
  try {
    const res = await fetch(`/api/retargeting/${eventId}/convert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentMethod: 'YAPE' })
    });
    const data = await res.json();
    if (data.ok) {
      showToast(`🎉 ¡Venta Concretada! ${data.event.leadName} es ahora PAYER (Boleta SUNAT ${data.event.paymentInfo?.receiptNumber})`);
      fetchStatus();
    }
  } catch (err) {
    showToast('Error al registrar pago: ' + err.message);
  }
}

// ----------------------------------------------------------------------------
// 5. AJUSTES DEL ASESOR Y WHATSAPP
// ----------------------------------------------------------------------------
function toggleConfigForm() {
  const form = document.getElementById('agent-config-form');
  const arrow = document.getElementById('cfg-toggle-arrow');
  if (!form) return;
  const isHidden = form.classList.toggle('hidden');
  if (arrow) arrow.textContent = isHidden ? '▼ Ver ajustes' : '▲ Ocultar';
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
    showToast('✓ Ajustes guardados correctamente.');
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

// Inicialización
window.addEventListener('DOMContentLoaded', () => {
  updateLivePreview();
  fetchStatus();
  setInterval(fetchStatus, 2500);
});
