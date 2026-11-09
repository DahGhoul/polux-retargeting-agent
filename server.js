/**
 * ============================================================================
 * POLUX RETARGETING AI — SERVICIO REAL EN SEGUNDO PLANO (FASE LEAD -> PAYER)
 * - Envío REAL de WhatsApp con Imagen del Producto vía @whiskeysockets/baileys
 * - Envío REAL de Correo Electrónico HTML vía Nodemailer (Gmail SMTP / Ethereal)
 * - Alerta REAL al WhatsApp del Asesor Comercial (> 10 min)
 * - Telemetría REAL embebida en la app de Polux Imports (/landing) + SendBeacon
 * - Registro y Análisis de Ventas en SQL Server (PoluxImportDB y PoluxImportMart)
 * ============================================================================
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const sql = require('mssql');
const nodemailer = require('nodemailer');
const QRCode = require('qrcode');
const pino = require('pino');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');

const app = express();
const PORT = Number(process.env.PORT || 4000);

app.use(cors({ origin: true, credentials: true }));
// Permitir JSON y también text/plain para navigator.sendBeacon al cerrar la pestaña
app.use(express.json());
app.use(express.text({ type: 'text/plain' }));
app.use(express.static(path.join(__dirname, 'public')));

// ----------------------------------------------------------------------------
// 1. CATÁLOGO OFICIAL DE POLUX IMPORTS (SINCRONIZADO CON /landing)
// ----------------------------------------------------------------------------
const CATALOG = [
  {
    id: 1,
    slug: 'iphone-16-pro-max',
    sku: 'APL-IP16PM-256-TN',
    name: 'iPhone 16 Pro Max 256 GB',
    shortName: 'iPhone 16 Pro Max',
    category: 'iPhone',
    color: 'Titanio Natural',
    capacity: '256 GB',
    price: 6599.00,
    originalPrice: 7299.00,
    installment3: 2199.67,
    image: 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?auto=format&fit=crop&w=900&q=85'
  },
  {
    id: 2,
    slug: 'iphone-16',
    sku: 'APL-IP16-128-ULT',
    name: 'iPhone 16 128 GB',
    shortName: 'iPhone 16',
    category: 'iPhone',
    color: 'Azul Ultramarino',
    capacity: '128 GB',
    price: 4299.00,
    originalPrice: 4799.00,
    installment3: 1433.00,
    image: 'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?auto=format&fit=crop&w=900&q=85'
  },
  {
    id: 3,
    slug: 'macbook-air-m4',
    sku: 'APL-MBA-M4-13',
    name: 'MacBook Air 13" Chip M4',
    shortName: 'MacBook Air M4',
    category: 'Mac',
    color: 'Medianoche',
    capacity: '512 GB SSD',
    price: 5499.00,
    originalPrice: 6199.00,
    installment3: 1833.00,
    image: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=900&q=85'
  },
  {
    id: 4,
    slug: 'ipad-air-m3',
    sku: 'APL-IPADAIR-M3',
    name: 'iPad Air 11" Chip M3 128 GB',
    shortName: 'iPad Air M3',
    category: 'iPad',
    color: 'Gris Espacial',
    capacity: '128 GB',
    price: 3199.00,
    originalPrice: 3599.00,
    installment3: 1066.33,
    image: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?auto=format&fit=crop&w=900&q=85'
  },
  {
    id: 5,
    slug: 'apple-watch-s10',
    sku: 'APL-AWS10-46',
    name: 'Apple Watch Series 10 46 mm',
    shortName: 'Apple Watch Series 10',
    category: 'Watch',
    color: 'Negro Azabache',
    capacity: '46 mm',
    price: 2199.00,
    originalPrice: 2499.00,
    installment3: 733.00,
    image: 'https://images.unsplash.com/photo-1546868871-7041f2a55e12?auto=format&fit=crop&w=900&q=85'
  },
  {
    id: 6,
    slug: 'airpods-pro-2',
    sku: 'APL-APP2-USBC',
    name: 'AirPods Pro 2 (USB-C)',
    shortName: 'AirPods Pro 2',
    category: 'AirPods',
    color: 'Blanco',
    capacity: 'USB-C MagSafe',
    price: 1099.00,
    originalPrice: 1299.00,
    installment3: 366.33,
    image: 'https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?auto=format&fit=crop&w=900&q=85'
  }
];

function findProduct(idOrSlugOrName) {
  if (!idOrSlugOrName) return CATALOG[0];
  const s = String(idOrSlugOrName).toLowerCase();
  return (
    CATALOG.find(
      p =>
        String(p.id) === s ||
        p.slug === s ||
        p.name.toLowerCase().includes(s) ||
        p.shortName.toLowerCase().includes(s)
    ) || CATALOG[0]
  );
}

// ----------------------------------------------------------------------------
// 2. CONFIGURACIÓN PERSISTENTE (ASESOR, SMTP, LEADS, EVENTOS)
// ----------------------------------------------------------------------------
const DATA_FILE = path.join(__dirname, 'retargeting_state.json');

const DEFAULT_CONFIG = {
  advisorName: 'Diego Cuba (Asesor Senior Polux)',
  advisorPhone: '+51 944 620 118',
  advisorEmail: 'diegokids111@gmail.com',
  poluxStoreUrl: 'http://localhost:8080/landing',
  smtpHost: 'smtp.gmail.com',
  smtpPort: 465,
  smtpUser: '',
  smtpPass: ''
};

const DEFAULT_LEADS = [
  {
    id: 101,
    firstName: 'Ronaldo',
    lastName: 'Robles Romero',
    documentNumber: '74892103',
    email: 'ronaldo.robles@unitru.edu.pe',
    phone: '+51 944 820 915',
    district: 'Víctor Larco Herrera',
    stage: 'LEAD',
    priority: 'ALTA'
  },
  {
    id: 1,
    firstName: 'Diego',
    lastName: 'Ramírez Cuba',
    documentNumber: '72849102',
    email: 'diegokids111@gmail.com',
    phone: '+51 944 620 118',
    district: 'Trujillo Centro',
    stage: 'LEAD',
    priority: 'ALTA'
  }
];

function loadState() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      return {
        config: { ...DEFAULT_CONFIG, ...(parsed.config || {}) },
        leads: Array.isArray(parsed.leads) && parsed.leads.length ? parsed.leads : DEFAULT_LEADS,
        events: Array.isArray(parsed.events) ? parsed.events : []
      };
    }
  } catch (e) {
    console.warn('Iniciando estado limpio:', e.message);
  }
  return { config: { ...DEFAULT_CONFIG }, leads: DEFAULT_LEADS, events: [] };
}

function saveState() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(appState, null, 2), 'utf8');
  } catch (e) {
    console.error('Error guardando estado:', e.message);
  }
}

let appState = loadState();
// Sesiones activas en vivo desde /landing (en memoria)
const activeSessions = new Map();

// ----------------------------------------------------------------------------
// 3. MOTOR WHATSAPP REAL (@whiskeysockets/baileys) — ENVÍO AUTOMÁTICO SIN TOCAR NADA
// ----------------------------------------------------------------------------
const WA_AUTH_DIR = path.join(__dirname, 'wa_auth_session');
let waSock = null;
let waStatus = {
  state: 'DISCONNECTED', // DISCONNECTED, QR_READY, CONNECTED
  qrDataUrl: null,
  connectedPhone: null,
  connectedName: null,
  lastError: null
};

function formatPhoneToJid(phone) {
  let digits = String(phone || '').replace(/[^0-9]/g, '');
  if (!digits) return null;
  if (digits.length === 9 && digits.startsWith('9')) {
    digits = '51' + digits;
  }
  return `${digits}@s.whatsapp.net`;
}

async function initWhatsAppClient() {
  try {
    const { state, saveCreds } = await useMultiFileAuthState(WA_AUTH_DIR);
    const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: [2, 3000, 1015901307] }));

    waSock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      logger: pino({ level: 'silent' }),
      browser: ['Polux Imports AI Agent', 'Chrome', '122.0.0']
    });

    waSock.ev.on('creds.update', saveCreds);

    waSock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        try {
          waStatus.qrDataUrl = await QRCode.toDataURL(qr, { margin: 1, width: 260 });
          waStatus.state = 'QR_READY';
          console.log('📱 Nuevo código QR de WhatsApp generado. Escanéalo en http://localhost:4000');
        } catch (err) {
          console.error('Error generando QR:', err.message);
        }
      }

      if (connection === 'open') {
        waStatus.state = 'CONNECTED';
        waStatus.qrDataUrl = null;
        waStatus.connectedPhone = waSock.user?.id?.split(':')[0] || 'Conectado';
        waStatus.connectedName = waSock.user?.name || 'Polux Imports Bot';
        waStatus.lastError = null;
        console.log(`✅ WhatsApp Real Conectado como: ${waStatus.connectedPhone} (${waStatus.connectedName})`);
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        waStatus.state = 'DISCONNECTED';
        waStatus.qrDataUrl = null;
        waStatus.connectedPhone = null;

        if (statusCode === DisconnectReason.loggedOut) {
          console.log('⚠️ Sesión de WhatsApp cerrada. Limpiando credenciales para generar nuevo QR...');
          try {
            fs.rmSync(WA_AUTH_DIR, { recursive: true, force: true });
          } catch (_) {}
          setTimeout(() => initWhatsAppClient(), 1500);
        } else if (shouldReconnect) {
          setTimeout(() => initWhatsAppClient(), 3000);
        }
      }
    });
  } catch (err) {
    waStatus.lastError = err.message;
    console.warn('Aviso iniciando cliente Baileys WhatsApp:', err.message);
  }
}

async function sendRealWhatsAppMessage(phone, imageUrl, captionText) {
  const jid = formatPhoneToJid(phone);
  if (!jid) return { sent: false, reason: 'Número de teléfono inválido' };

  if (!waSock || waStatus.state !== 'CONNECTED') {
    return {
      sent: false,
      reason: 'WhatsApp aún no vinculado con QR (Escanea el QR en el Panel del Agente para envío directo)'
    };
  }

  try {
    if (imageUrl) {
      await waSock.sendMessage(jid, {
        image: { url: imageUrl },
        caption: captionText
      });
    } else {
      await waSock.sendMessage(jid, { text: captionText });
    }
    return { sent: true, jid, timestamp: new Date().toISOString() };
  } catch (err) {
    console.warn('Error enviando imagen por WhatsApp, reintentando solo texto:', err.message);
    try {
      await waSock.sendMessage(jid, { text: captionText });
      return { sent: true, jid, textOnly: true, timestamp: new Date().toISOString() };
    } catch (err2) {
      return { sent: false, reason: err2.message };
    }
  }
}

// ----------------------------------------------------------------------------
// 4. MOTOR SMTP REAL (GMAIL APP PASSWORD O ETHEREAL DE RESPALDO)
// ----------------------------------------------------------------------------
let mailTransporter = null;
let mailAccountInfo = { mode: 'INITIALIZING', user: '' };

async function initMailer() {
  const cfg = appState.config || {};
  const smtpUser = process.env.SMTP_USER || cfg.smtpUser;
  const smtpPass = process.env.SMTP_PASS || cfg.smtpPass;

  try {
    if (smtpUser && smtpPass) {
      mailTransporter = nodemailer.createTransport({
        host: cfg.smtpHost || 'smtp.gmail.com',
        port: Number(cfg.smtpPort || 465),
        secure: Number(cfg.smtpPort || 465) === 465,
        auth: { user: smtpUser, pass: smtpPass }
      });
      await mailTransporter.verify();
      mailAccountInfo = { mode: 'GMAIL_REAL_SMTP', user: smtpUser };
      console.log(`📧 SMTP Real verificado y activo con cuenta: ${smtpUser}`);
      return;
    }

    const testAccount = await nodemailer.createTestAccount();
    mailTransporter = nodemailer.createTransport({
      host: testAccount.smtp.host,
      port: testAccount.smtp.port,
      secure: testAccount.smtp.secure,
      auth: { user: testAccount.user, pass: testAccount.pass }
    });
    mailAccountInfo = { mode: 'ETHEREAL_SMTP_FALLBACK', user: testAccount.user };
    console.log(`📧 SMTP de respaldo Ethereal activo (${testAccount.user}). Puedes configurar tu Gmail App Password en el panel.`);
  } catch (e) {
    mailAccountInfo = { mode: 'SMTP_ERROR', user: e.message };
    console.warn('Error iniciando SMTP:', e.message);
  }
}

function buildRealAbandonedEmailHtml(lead, product, secondsViewed, checkoutUrl) {
  const firstNameUpper = (lead.firstName || 'CLIENTE').toUpperCase();
  const formattedPrice = `S/ ${Number(product.price).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`;
  const formattedInstallment = `S/ ${Number(product.installment3).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`;

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>No abandones tu carrito 👀 - Polux Imports Perú</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111827;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7;padding:24px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 12px 32px rgba(0,0,0,0.08);">
          <tr>
            <td style="background-color:#0f172a;padding:18px 28px;color:#ffffff;">
              <div style="font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;">Polux Imports Perú · Tienda Oficial Trujillo</div>
              <div style="font-size:20px;font-weight:800;margin-top:4px;">No abandones tu carrito 👀</div>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:36px 32px 28px 32px;text-align:center;">
              <div style="font-size:26px;font-weight:800;color:#0f172a;margin-bottom:14px;">🍎 Polux Imports</div>
              <h2 style="font-size:22px;font-weight:500;color:#111827;margin:8px 0 18px 0;">
                <strong>Hola,</strong> ${firstNameUpper}
              </h2>
              <p style="font-size:16px;line-height:1.5;color:#374151;margin:0 0 14px 0;">
                Vimos que te fuiste sin finalizar tu compra 😔
              </p>
              <p style="font-size:16px;line-height:1.5;color:#374151;margin:0 0 16px 0;">
                No queremos que te quedes sin tu <strong>${product.name}</strong> (${product.color}) favorito.
              </p>
              <p style="font-size:16px;font-weight:700;color:#111827;margin:0 0 24px 0;">
                ¡Tu carrito sigue esperando! No lo abandones 🐾
              </p>
              <div style="background:#f8fafc;border-radius:16px;padding:20px;margin-bottom:24px;border:1px solid #e2e8f0;">
                <img src="${product.image}" alt="${product.name}" style="max-width:340px;width:100%;height:220px;object-fit:cover;border-radius:12px;display:block;margin:0 auto 16px auto;" />
                <div style="font-size:18px;font-weight:700;color:#0f172a;">${product.name}</div>
                <div style="font-size:20px;font-weight:800;color:#2563eb;margin-top:8px;">
                  ${formattedPrice} <span style="font-size:13px;font-weight:500;color:#475569;">o 3 cuotas sin interés de ${formattedInstallment}</span>
                </div>
              </div>
              <a href="${checkoutUrl}"
                 style="display:inline-block;background-color:#10b981;color:#ffffff;font-weight:700;font-size:16px;text-decoration:none;padding:15px 36px;border-radius:999px;">
                Comprar ahora en Polux Imports →
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

// ----------------------------------------------------------------------------
// 5. CONEXIÓN A SQL SERVER (PoluxImportDB & PoluxImportMart)
// ----------------------------------------------------------------------------
const dbConfig = {
  server: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 1433),
  user: process.env.DB_USER || 'polux_app',
  password: process.env.DB_PASSWORD || 'PoluxDemo_2026!',
  database: process.env.DB_NAME || 'PoluxImportDB',
  options: { encrypt: false, trustServerCertificate: true },
  pool: { max: 5, min: 0, idleTimeoutMillis: 15000 }
};

let sqlPool = null;
let sqlConnected = false;

async function initSqlConnection() {
  try {
    sqlPool = await sql.connect(dbConfig);
    sqlConnected = true;
    console.log('✅ Conectado a SQL Server (PoluxImportDB)');

    await sqlPool.request().query(`
      IF NOT EXISTS (SELECT 1 FROM core.agente_ia WHERE codigo_agente = 'AGT_RETARGETING_LP')
      BEGIN
        INSERT INTO core.agente_ia (codigo_agente, nombre_agente, rol_operativo, fase_principal, requiere_aprobacion_humana, es_activo)
        VALUES ('AGT_RETARGETING_LP', N'Agente de Recuperación de Abandono (Lead -> Payer)', N'Monitorea permanencia real en tienda (/landing) y ejecuta retargeting: <5m Correo, 5-10m WhatsApp Real, >10m Alerta Asesor.', 'LEADS', 0, 1);
      END;

      IF OBJECT_ID('leads.abandono_carrito_retargeting', 'U') IS NULL
      BEGIN
        CREATE TABLE leads.abandono_carrito_retargeting (
          id_retargeting          BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
          id_persona              BIGINT NOT NULL,
          id_producto             INT NOT NULL,
          nombre_producto         NVARCHAR(150) NOT NULL,
          precio_producto_pen     DECIMAL(12,2) NOT NULL,
          segundos_permanencia    INT NOT NULL,
          minutos_permanencia     AS CAST(ROUND(segundos_permanencia / 60.0, 2) AS DECIMAL(8,2)) PERSISTED,
          rango_detectado         VARCHAR(30) NOT NULL,
          canal_accion            VARCHAR(40) NOT NULL,
          nivel_intencion         VARCHAR(30) NOT NULL,
          probabilidad_compra     DECIMAL(5,2) NOT NULL,
          asunto_o_titulo         NVARCHAR(200) NOT NULL,
          mensaje_enviado         NVARCHAR(MAX) NOT NULL,
          guion_llamada_asesor    NVARCHAR(MAX) NULL,
          url_vista_previa_email  NVARCHAR(400) NULL,
          estado_recuperacion     VARCHAR(30) NOT NULL DEFAULT 'ENVIADO',
          medio_pago_conversion   VARCHAR(30) NULL,
          monto_pagado_pen        DECIMAL(12,2) NULL,
          comprobante_sunat       VARCHAR(30) NULL,
          id_orden_generada       BIGINT NULL,
          fecha_abandono          DATETIME2(7) NOT NULL DEFAULT SYSDATETIME(),
          fecha_conversion        DATETIME2(7) NULL
        );
      END;
    `);

    await syncLeadsFromSql();
  } catch (err) {
    sqlConnected = false;
    console.warn('⚠️ SQL Server no disponible en este instante:', err.message);
  }
}

async function syncLeadsFromSql() {
  if (!sqlConnected || !sqlPool) return;
  try {
    const res = await sqlPool.request().query(`
      SELECT TOP 25
        p.id_persona,
        p.nombres,
        p.apellidos,
        p.numero_documento,
        p.correo_electronico,
        p.telefono_movil,
        p.ciudad,
        p.etapa_actual,
        ISNULL(l.prioridad_comercial, 'ALTA') AS prioridad_comercial
      FROM core.persona p
      LEFT JOIN leads.lead l ON l.id_persona = p.id_persona
      WHERE p.estado_registro = 'ACTIVO'
        AND (p.nombres LIKE N'%Ronaldo%' OR p.id_persona <= 15 OR p.etapa_actual IN ('LEADS', 'BUYER', 'PAYER'))
      ORDER BY CASE WHEN p.nombres LIKE N'%Ronaldo%' THEN 0 WHEN p.id_persona <= 6 THEN 1 ELSE 2 END, p.id_persona ASC;
    `);

    if (res.recordset && res.recordset.length > 0) {
      appState.leads = res.recordset.map(r => ({
        id: Number(r.id_persona),
        firstName: r.nombres,
        lastName: r.apellidos || 'Trujillo',
        documentNumber: r.numero_documento || '74892103',
        email: r.correo_electronico || 'ronaldo.robles@unitru.edu.pe',
        phone: r.telefono_movil || '+51 944 820 915',
        district: r.ciudad || 'Víctor Larco Herrera',
        stage: r.etapa_actual === 'LEADS' ? 'LEAD' : r.etapa_actual,
        priority: r.prioridad_comercial || 'ALTA'
      }));
      saveState();
    }
  } catch (e) {
    console.warn('Error sincronizando leads desde SQL:', e.message);
  }
}

// ----------------------------------------------------------------------------
// 6. LÓGICA REAL DE RETARGETING AL ABANDONAR LA TIENDA (/landing)
// ----------------------------------------------------------------------------
async function processRealAbandonment(payload) {
  let lead = null;
  if (payload.leadId) {
    lead = appState.leads.find(l => Number(l.id) === Number(payload.leadId));
  }
  if (!lead && (payload.phone || payload.email || payload.firstName)) {
    lead = {
      id: Number(payload.leadId || 101),
      firstName: payload.firstName || 'Ronaldo',
      lastName: payload.lastName || 'Robles Romero',
      documentNumber: payload.documentNumber || '74892103',
      email: payload.email || 'ronaldo.robles@unitru.edu.pe',
      phone: payload.phone || '+51 944 820 915',
      district: payload.district || 'Víctor Larco Herrera',
      stage: 'LEAD'
    };
  }
  if (!lead) lead = appState.leads[0];

  // Si en el payload mandaron teléfono o correo actualizados desde la tienda, usarlos en tiempo real
  const targetPhone = (payload.phone || lead.phone || '+51 944 820 915').trim();
  const targetEmail = (payload.email || lead.email || 'ronaldo.robles@unitru.edu.pe').trim();
  const targetFirstName = (payload.firstName || lead.firstName || 'Ronaldo').trim();
  const targetLastName = (payload.lastName || lead.lastName || 'Robles').trim();

  const product = findProduct(payload.productId || payload.productSlug || payload.productName);
  const secs = Math.max(5, Number(payload.secondsViewed || 120));
  const mm = String(Math.floor(secs / 60)).padStart(2, '0');
  const ss = String(secs % 60).padStart(2, '0');
  const durationLabel = `${mm}:${ss} min (${secs} seg)`;

  const firstNameUpper = targetFirstName.toUpperCase();
  const formattedPrice = `S/ ${Number(product.price).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`;
  const cuota3 = `S/ ${Number(product.installment3).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`;
  const storeCheckoutUrl = `${appState.config.poluxStoreUrl || 'http://localhost:8080/landing'}?recover=1&leadId=${lead.id}&product=${product.slug}`;

  let tier = '';
  let channel = '';
  let intentLevel = '';
  let probability = 0;
  let headline = '';
  let messageBody = '';
  let deliveryResult = {};
  let emailPreviewUrl = null;
  let advisorScript = null;

  // ==========================================================================
  // REGLA 1: MENOS DE 5 MINUTOS (< 300 seg) -> CORREO ELECTRÓNICO REAL
  // ==========================================================================
  if (secs < 300) {
    tier = 'MENOR_5_MIN';
    channel = 'CORREO_HTML';
    intentLevel = 'EXPLORATORIA';
    probability = Math.min(48, Math.max(25, Math.round(22 + (secs / 300) * 25)));
    headline = `Correo enviado a ${targetEmail} (< 5 min en página)`;
    messageBody = `No abandones tu carrito 👀 — Hola, ${firstNameUpper}. Vimos que te fuiste sin finalizar tu compra de ${product.name} (${formattedPrice}). ¡Tu carrito sigue esperando!`;

    const htmlContent = buildRealAbandonedEmailHtml(
      { ...lead, firstName: targetFirstName },
      product,
      secs,
      storeCheckoutUrl
    );

    if (mailTransporter) {
      try {
        const info = await mailTransporter.sendMail({
          from: `"Polux Imports Perú 🍎" <${appState.config.smtpUser || 'tienda@poluximports.pe'}>`,
          to: targetEmail,
          subject: 'No abandones tu carrito👀',
          html: htmlContent
        });
        const preview = nodemailer.getTestMessageUrl(info);
        if (preview) emailPreviewUrl = preview;
        deliveryResult = {
          sent: true,
          mode: mailAccountInfo.mode,
          recipient: targetEmail,
          messageId: info.messageId,
          previewUrl: emailPreviewUrl
        };
      } catch (mailErr) {
        deliveryResult = { sent: false, reason: mailErr.message };
      }
    }
  }
  // ==========================================================================
  // REGLA 2: ENTRE 5 Y 10 MINUTOS (300 a 600 seg) -> WHATSAPP REAL CON FOTO
  // ==========================================================================
  else if (secs >= 300 && secs <= 600) {
    tier = 'ENTRE_5_Y_10_MIN';
    channel = 'WHATSAPP_DIRECTO';
    intentLevel = 'COMPRA_POSIBLE';
    probability = Math.min(84, Math.max(65, Math.round(62 + ((secs - 300) / 300) * 22)));
    headline = `WhatsApp Real enviado a ${targetPhone} (5–10 min en página)`;

    const waCaption =
      `*Polux Imports Perú* 🍎✅\n\n` +
      `Hola *${firstNameUpper}* 🐾🐶 ¿Tuviste alguna duda con la capacidad (${product.capacity}), el color (${product.color}) o los métodos de pago? No te preocupes, estamos aquí para ayudarte.\n\n` +
      `📱 *Equipo:* ${product.name}\n` +
      `💰 *Precio:* ${formattedPrice} (o 3 cuotas sin interés de ${cuota3})\n\n` +
      `👉 *Comprar ahora!* ${storeCheckoutUrl}`;

    messageBody = waCaption;
    deliveryResult = await sendRealWhatsAppMessage(targetPhone, product.image, waCaption);
  }
  // ==========================================================================
  // REGLA 3: MÁS DE 10 MINUTOS (> 600 seg) -> ALERTA REAL AL ASESOR + LLAMADA
  // ==========================================================================
  else {
    tier = 'MAYOR_10_MIN';
    channel = 'ALERTA_ASESOR_LLAMADA';
    intentLevel = 'COMPRA_MUY_POSIBLE';
    probability = Math.min(98, Math.max(88, Math.round(88 + Math.min(10, (secs - 600) / 60))));
    headline = `🚨 Alerta Crítica enviada al Asesor (${appState.config.advisorPhone}) para llamar a ${targetFirstName}`;

    const advisorAlertText =
      `🚨 *ALERTA POLUX IMPORTS — COMPRA MUY POSIBLE (>10 MIN)* 🚨\n\n` +
      `👤 *Cliente (Lead):* ${targetFirstName} ${targetLastName}\n` +
      `⏱️ *Tiempo revisando:* ${durationLabel}\n` +
      `🍎 *Producto:* ${product.name} (${formattedPrice})\n` +
      `📈 *Probabilidad de Cierre:* ${probability}%\n` +
      `📞 *Llamar ahora mismo al cliente:* ${targetPhone}\n\n` +
      `💡 *Guion sugerido:* Ofrecer reserva inmediata con 3 cuotas sin interés de ${cuota3} o pago Yape en PoluxPay.`;

    messageBody = advisorAlertText;

    advisorScript = {
      advisorName: appState.config.advisorName,
      advisorPhone: appState.config.advisorPhone,
      clientPhone: targetPhone,
      opening: `¡Hola ${targetFirstName}! Te saluda ${appState.config.advisorName} de Polux Imports Trujillo. Vimos que estuviste más de 10 minutos evaluando el ${product.name} y te llamo para ayudarte a concretar tu pedido sin fricciones.`,
      closingOffer: `Podemos activarte 3 cuotas sin intereses de ${cuota3} o pago directo por Yape/Plin con entrega certificada en Av. Larco 840.`
    };

    // Enviar la alerta real al WhatsApp del Asesor Comercial
    deliveryResult = await sendRealWhatsAppMessage(
      appState.config.advisorPhone,
      product.image,
      advisorAlertText
    );
  }

  let sqlRetargetingId = null;

  // Guardar en SQL Server (PoluxImportDB)
  if (sqlConnected && sqlPool) {
    try {
      const ins = await sqlPool.request()
        .input('idPersona', sql.BigInt, lead.id)
        .input('idProducto', sql.Int, product.id)
        .input('nombreProducto', sql.NVarChar(150), product.name)
        .input('precioProducto', sql.Decimal(12, 2), product.price)
        .input('segundos', sql.Int, secs)
        .input('rango', sql.VarChar(30), tier)
        .input('canal', sql.VarChar(40), channel)
        .input('nivelIntencion', sql.VarChar(30), intentLevel)
        .input('probabilidad', sql.Decimal(5, 2), probability)
        .input('titulo', sql.NVarChar(200), headline)
        .input('mensaje', sql.NVarChar(sql.MAX), messageBody)
        .input('guion', sql.NVarChar(sql.MAX), advisorScript ? JSON.stringify(advisorScript) : null)
        .input('urlEmail', sql.NVarChar(400), emailPreviewUrl || null)
        .query(`
          INSERT INTO leads.abandono_carrito_retargeting
            (id_persona, id_producto, nombre_producto, precio_producto_pen, segundos_permanencia,
             rango_detectado, canal_accion, nivel_intencion, probabilidad_compra, asunto_o_titulo,
             mensaje_enviado, guion_llamada_asesor, url_vista_previa_email, estado_recuperacion)
          OUTPUT INSERTED.id_retargeting
          VALUES
            (@idPersona, @idProducto, @nombreProducto, @precioProducto, @segundos,
             @rango, @canal, @nivelIntencion, @probabilidad, @titulo,
             @mensaje, @guion, @urlEmail, 'ENVIADO');
        `);

      sqlRetargetingId = ins.recordset?.[0]?.id_retargeting ? Number(ins.recordset[0].id_retargeting) : null;

      await sqlPool.request()
        .input('idPersona', sql.BigInt, lead.id)
        .input('decision', sql.NVarChar(sql.MAX), `[${tier}] ${headline}`)
        .input('sustento', sql.NVarChar(sql.MAX), JSON.stringify({
          segundosPermanencia: secs,
          rango: tier,
          canal: channel,
          entregaReal: deliveryResult
        }))
        .input('confianza', sql.Decimal(5, 2), probability)
        .query(`
          DECLARE @idAg SMALLINT = ISNULL((SELECT TOP 1 id_agente FROM core.agente_ia WHERE codigo_agente = 'AGT_RETARGETING_LP'), 3);
          INSERT INTO core.accion_agente
            (id_agente, id_persona, tipo_accion, entidad_afectada, id_entidad_afectada,
             decision_tomada, datos_sustento_json, nivel_confianza_ia, requirio_aprobacion, resultado_ejecucion)
          VALUES
            (@idAg, @idPersona, 'RETARGETING_ABANDONO', 'abandono_carrito_retargeting', @idPersona,
             @decision, @sustento, @confianza, 0, 'EXITOSO');
        `);

      if (tier === 'MAYOR_10_MIN') {
        await sqlPool.request()
          .input('idPersona', sql.BigInt, lead.id)
          .input('accion', sql.NVarChar(300), `LLAMAR AHORA A ${targetFirstName} ${targetLastName} (${targetPhone}): Estuvo ${durationLabel} viendo ${product.name} (${probability}% prob.).`)
          .query(`
            INSERT INTO core.alerta_operativa
              (fase, codigo_tipo_alerta, id_persona, id_entidad_referencia, tipo_entidad_referencia, accion_recomendada, rol_responsable, estado_alerta)
            VALUES
              ('LEADS', 'ABANDONO_ALTA_INTENCION_MAS_10M', @idPersona, @idPersona, 'persona', @accion, 'COMERCIAL', 'ACTIVA');
          `);
      }
    } catch (sqlErr) {
      console.warn('Error guardando abandono en SQL Server:', sqlErr.message);
    }
  }

  const cleanClientPhone = targetPhone.replace(/[^0-9]/g, '');
  const eventRecord = {
    id: sqlRetargetingId || Date.now(),
    sqlRetargetingId,
    leadId: lead.id,
    leadName: `${targetFirstName} ${targetLastName}`,
    leadFirstName: targetFirstName,
    leadEmail: targetEmail,
    leadPhone: targetPhone,
    leadDistrict: lead.district || 'Trujillo',
    productId: product.id,
    productSlug: product.slug,
    productName: product.name,
    productColor: product.color,
    productPrice: product.price,
    productImage: product.image,
    secondsViewed: secs,
    durationLabel,
    exitReason: payload.exitReason || 'SALIDA_DE_TIENDA_POLUX',
    tier,
    channel,
    intentLevel,
    probability,
    headline,
    messageBody,
    emailPreviewUrl,
    advisorScript,
    deliveryResult,
    waManualFallbackUrl: `https://wa.me/${cleanClientPhone.startsWith('51') ? cleanClientPhone : '51' + cleanClientPhone}?text=${encodeURIComponent(messageBody)}`,
    telCallUrl: `tel:${targetPhone}`,
    checkoutUrl: storeCheckoutUrl,
    status: 'ENVIADO',
    paymentInfo: null,
    createdAt: new Date().toISOString()
  };

  appState.events.unshift(eventRecord);
  appState.events = appState.events.slice(0, 100);
  saveState();

  return eventRecord;
}

// ----------------------------------------------------------------------------
// 7. CONVERSIÓN REAL LEAD -> PAYER EN BASE DE DATOS Y DATA MART
// ----------------------------------------------------------------------------
async function convertLeadToPayerInDb(eventId, paymentDto) {
  const ev = appState.events.find(e => Number(e.id) === Number(eventId)) || appState.events[0];
  if (!ev) throw new Error('Registro de abandono no encontrado');

  const method = (paymentDto.paymentMethod || 'YAPE').toUpperCase();
  const amount = Number(paymentDto.amount || ev.productPrice || 6599);
  const opCode = paymentDto.operationCode || `PLX-${method}-${Date.now().toString().slice(-6)}`;
  const orderCode = `ORD-2026-${String(ev.leadId).padStart(4, '0')}-${Math.floor(10 + Math.random() * 89)}`;
  let receiptNumber = `B001-${String(Math.floor(100000 + Math.random() * 899999))}`;

  if (sqlConnected && sqlPool) {
    try {
      const dbRes = await sqlPool.request()
        .input('idPersona', sql.BigInt, ev.leadId)
        .input('monto', sql.Decimal(12, 2), amount)
        .input('medioPago', sql.VarChar(30), method === 'CARD' ? 'TARJETA' : method)
        .input('opCode', sql.VarChar(60), opCode)
        .input('numOrden', sql.VarChar(30), orderCode)
        .input('canalRecuperacion', sql.VarChar(40), ev.channel)
        .input('nombreCliente', sql.NVarChar(150), ev.leadName)
        .query(`
          UPDATE core.persona SET etapa_actual = 'PAYER', fecha_actualizacion = SYSDATETIME() WHERE id_persona = @idPersona;
          UPDATE leads.lead SET estado_lead = 'CONVERTIDO', fecha_cierre = SYSDATETIME() WHERE id_persona = @idPersona;

          DECLARE @idCot BIGINT = (SELECT TOP 1 id_cotizacion FROM leads.cotizacion WHERE id_persona = @idPersona ORDER BY id_cotizacion DESC);
          IF @idCot IS NULL
          BEGIN
            DECLARE @cotTbl TABLE (id_cotizacion BIGINT);
            INSERT INTO leads.cotizacion
              (id_persona, numero_cotizacion, version_numero, fecha_emision, fecha_vencimiento,
               subtotal_pen, descuento_pen, total_pen, tipo_cambio_referencial, total_usd,
               modalidad_pago, pago_inicial_sugerido_pen, numero_cuotas_sugeridas, estado_cotizacion, fecha_aceptacion)
            OUTPUT INSERTED.id_cotizacion INTO @cotTbl
            VALUES
              (@idPersona, CONCAT('COT-RET-', @idPersona, '-', RIGHT(CAST(SYSDATETIME() AS VARCHAR(30)), 4)), 1,
               SYSDATETIME(), DATEADD(DAY, 7, SYSDATETIME()), @monto, 0.00, @monto, 3.7500, ROUND(@monto/3.75, 2),
               'CONTADO', @monto, 1, 'ACEPTADA', SYSDATETIME());
            SELECT TOP 1 @idCot = id_cotizacion FROM @cotTbl;
          END
          ELSE
          BEGIN
            UPDATE leads.cotizacion SET estado_cotizacion = 'ACEPTADA', fecha_aceptacion = SYSDATETIME() WHERE id_cotizacion = @idCot;
          END;

          IF NOT EXISTS (SELECT 1 FROM payers.payer WHERE id_persona = @idPersona)
            INSERT INTO payers.payer (id_persona, estado_payer, total_ordenes_activas) VALUES (@idPersona, 'AL_DIA', 1);
          ELSE
            UPDATE payers.payer SET estado_payer = 'AL_DIA', total_ordenes_activas = total_ordenes_activas + 1 WHERE id_persona = @idPersona;

          DECLARE @idOrd BIGINT = (SELECT TOP 1 id_orden FROM payers.orden_contratacion WHERE id_cotizacion = @idCot);
          IF @idOrd IS NULL
          BEGIN
            DECLARE @ordTbl TABLE (id_orden BIGINT);
            INSERT INTO payers.orden_contratacion
              (numero_orden, id_persona, id_cotizacion, tipo_suministro, modalidad_pago,
               total_acordado_pen, monto_pago_inicial_pactado_pen, total_cuotas_pactadas,
               total_pagado_validado_pen, saldo_pendiente_pen, estado_orden,
               fecha_formalizacion, fecha_pago_inicial_confirmado, fecha_activacion_pedido)
            OUTPUT INSERTED.id_orden INTO @ordTbl
            VALUES
              (@numOrden, @idPersona, @idCot, 'IMPORTACION_USA', 'CONTADO',
               @monto, @monto, 1, @monto, 0.00, 'ACTIVADO_EN_IMPORTACION',
               SYSDATETIME(), SYSDATETIME(), SYSDATETIME());
            SELECT TOP 1 @idOrd = id_orden FROM @ordTbl;
          END;

          DECLARE @pagoTbl TABLE (id_pago BIGINT);
          INSERT INTO payers.pago
            (id_orden, medio_pago, numero_operacion_transaccion, entidad_bancaria, moneda,
             monto_pagado, tipo_cambio_aplicado, fecha_transaccion, estado_pago,
             validado_por_ia, id_agente, usuario_validador, fecha_validacion)
          OUTPUT INSERTED.id_pago INTO @pagoTbl
          VALUES
            (@idOrd, @medioPago, @opCode, 'PoluxPay Retargeting', 'PEN',
             @monto, 3.7500, SYSDATETIME(), 'VALIDADO', 1, 4, 'AGT_RETARGETING_LP', SYSDATETIME());
          DECLARE @idPago BIGINT = (SELECT TOP 1 id_pago FROM @pagoTbl);

          DECLARE @correlativo INT = CAST(@idPago AS INT) + 50000;
          INSERT INTO payers.comprobante_electronico
            (id_orden, id_pago, tipo_comprobante, serie, numero_correlativo,
             numero_documento_cliente, nombre_razon_social, subtotal_gravado_pen, igv_pen,
             total_comprobante_pen, estado_emision, hash_cpe)
          VALUES
            (@idOrd, @idPago, 'BOLETA', 'B001', @correlativo,
             '74892103', @nombreCliente, ROUND(@monto / 1.18, 2), @monto - ROUND(@monto / 1.18, 2),
             @monto, 'EMITIDO', CONCAT('SHA256-SUNAT-RET-', @idPago));

          INSERT INTO core.historial_etapa
            (id_persona, etapa_anterior, etapa_nueva, motivo_transicion, senal_origen, id_entidad_referencia, tipo_entidad_referencia, registrado_por)
          VALUES
            (@idPersona, 'LEADS', 'PAYER', CONCAT(N'Conversión LEAD -> PAYER recuperada por Agente de Retargeting vía ', @canalRecuperacion), 'PAGO_RETARGETING', @idPago, 'pago', 'AGT_RETARGETING_LP');

          UPDATE leads.abandono_carrito_retargeting
          SET estado_recuperacion = 'CONVERTIDO_PAYER',
              medio_pago_conversion = @medioPago,
              monto_pagado_pen = @monto,
              comprobante_sunat = CONCAT('B001-', @correlativo),
              id_orden_generada = @idOrd,
              fecha_conversion = SYSDATETIME()
          WHERE id_persona = @idPersona AND estado_recuperacion <> 'CONVERTIDO_PAYER';

          -- Actualizar DimPersona en el Data Mart PoluxImportMart si existe
          IF DB_ID('PoluxImportMart') IS NOT NULL
          BEGIN
            UPDATE PoluxImportMart.dbo.DimPersona
            SET EtapaActual = 'PAYER'
            WHERE idPersona = @idPersona;
          END;

          SELECT CONCAT('B001-', @correlativo) AS comprobante;
        `);

      if (dbRes.recordset?.[0]?.comprobante) {
        receiptNumber = dbRes.recordset[0].comprobante;
      }
    } catch (sqlErr) {
      console.warn('Error en SQL al convertir a PAYER:', sqlErr.message);
    }
  }

  ev.status = 'CONVERTIDO_PAYER';
  ev.convertedAt = new Date().toISOString();
  ev.paymentInfo = {
    paymentMethod: method,
    amount,
    operationCode: opCode,
    receiptNumber,
    orderCode,
    paidAt: new Date().toISOString()
  };

  const leadObj = appState.leads.find(l => Number(l.id) === Number(ev.leadId));
  if (leadObj) leadObj.stage = 'PAYER';

  // Si WhatsApp está conectado, enviar confirmación real del comprobante SUNAT al cliente
  if (waStatus.state === 'CONNECTED') {
    await sendRealWhatsAppMessage(
      ev.leadPhone,
      null,
      `✅ *PAGO CONFIRMADO — POLUX IMPORTS PERÚ*\n\n` +
        `¡Gracias *${ev.leadFirstName}*! Tu pago por *S/ ${amount.toLocaleString('es-PE', { minimumFractionDigits: 2 })}* (${method}) ha sido validado.\n` +
        `🧾 *Comprobante SUNAT:* ${receiptNumber}\n` +
        `📦 *Orden Activada:* ${orderCode} (${ev.productName})\n` +
        `📍 Te notificaremos por esta vía el arribo de tu equipo a nuestra sede de Av. Larco 840, Trujillo.`
    );
  }

  saveState();
  return ev;
}

// ----------------------------------------------------------------------------
// 8. ENDPOINTS DE API PARA LA APP DE POLUX (/landing) Y EL PANEL REAL
// ----------------------------------------------------------------------------

// Estado completo + analítica SQL Server en tiempo real
app.get('/api/status', async (req, res) => {
  let dbAnalytics = {
    byChannel: [],
    recentSqlRows: [],
    totalLeadsInDb: 0,
    totalPayersInDb: 0
  };

  if (sqlConnected && sqlPool) {
    try {
      const [aggRes, rowsRes, funnelRes] = await Promise.all([
        sqlPool.request().query(`
          SELECT
            canal_accion AS channel,
            rango_detectado AS tier,
            COUNT(*) AS totalAbandonments,
            SUM(CASE WHEN estado_recuperacion = 'CONVERTIDO_PAYER' THEN 1 ELSE 0 END) AS convertedCount,
            ISNULL(SUM(CASE WHEN estado_recuperacion = 'CONVERTIDO_PAYER' THEN monto_pagado_pen ELSE 0 END), 0) AS totalSoldPen
          FROM leads.abandono_carrito_retargeting
          GROUP BY canal_accion, rango_detectado;
        `),
        sqlPool.request().query(`
          SELECT TOP 30
            r.id_retargeting,
            r.id_persona,
            p.nombres,
            p.apellidos,
            p.telefono_movil,
            p.correo_electronico,
            p.etapa_actual,
            r.nombre_producto,
            r.precio_producto_pen,
            r.segundos_permanencia,
            r.minutos_permanencia,
            r.rango_detectado,
            r.canal_accion,
            r.probabilidad_compra,
            r.estado_recuperacion,
            r.medio_pago_conversion,
            r.monto_pagado_pen,
            r.comprobante_sunat,
            r.url_vista_previa_email,
            r.fecha_abandono,
            r.fecha_conversion
          FROM leads.abandono_carrito_retargeting r
          LEFT JOIN core.persona p ON p.id_persona = r.id_persona
          ORDER BY r.id_retargeting DESC;
        `),
        sqlPool.request().query(`
          SELECT
            SUM(CASE WHEN etapa_actual = 'LEADS' THEN 1 ELSE 0 END) AS totalLeads,
            SUM(CASE WHEN etapa_actual = 'PAYER' THEN 1 ELSE 0 END) AS totalPayers
          FROM core.persona WHERE estado_registro = 'ACTIVO';
        `)
      ]);

      dbAnalytics.byChannel = aggRes.recordset || [];
      dbAnalytics.recentSqlRows = rowsRes.recordset || [];
      dbAnalytics.totalLeadsInDb = funnelRes.recordset?.[0]?.totalLeads || 0;
      dbAnalytics.totalPayersInDb = funnelRes.recordset?.[0]?.totalPayers || 0;
    } catch (e) {
      console.warn('Error consultando analítica SQL:', e.message);
    }
  }

  const totalEvents = appState.events.length;
  const converted = appState.events.filter(e => e.status === 'CONVERTIDO_PAYER').length;
  const recoveredRevenue = appState.events
    .filter(e => e.status === 'CONVERTIDO_PAYER')
    .reduce((acc, e) => acc + Number(e.paymentInfo?.amount || e.productPrice || 0), 0);

  res.json({
    ok: true,
    whatsapp: waStatus,
    smtp: mailAccountInfo,
    sqlServerConnected: sqlConnected,
    config: {
      ...appState.config,
      smtpPass: appState.config.smtpPass ? '********' : ''
    },
    catalog: CATALOG,
    leads: appState.leads,
    activeSessions: Array.from(activeSessions.values()),
    events: appState.events,
    dbAnalytics,
    kpis: {
      totalAbandonments: totalEvents,
      convertedToPayer: converted,
      conversionRate: totalEvents > 0 ? Math.round((converted / totalEvents) * 100) : 0,
      recoveredRevenuePen: recoveredRevenue,
      byEmail: appState.events.filter(e => e.channel === 'CORREO_HTML').length,
      byWhatsapp: appState.events.filter(e => e.channel === 'WHATSAPP_DIRECTO').length,
      byAdvisor: appState.events.filter(e => e.channel === 'ALERTA_ASESOR_LLAMADA').length
    }
  });
});

// Recibir latidos (heartbeats) en tiempo real desde la Tienda Polux (/landing)
app.post('/api/telemetry/heartbeat', (req, res) => {
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (_) { body = {}; }
  }
  const sessionId = body.sessionId || 'anon-session';
  activeSessions.set(sessionId, {
    sessionId,
    leadId: body.leadId || 101,
    leadName: body.leadName || 'Ronaldo Robles Romero',
    phone: body.phone || '+51 944 820 915',
    email: body.email || 'ronaldo.robles@unitru.edu.pe',
    productName: body.productName || 'iPhone 16 Pro Max 256 GB',
    productSlug: body.productSlug || 'iphone-16-pro-max',
    secondsViewed: Number(body.secondsViewed || 0),
    updatedAt: new Date().toISOString()
  });

  // Limpiar sesiones inactivas de hace más de 10 min
  const now = Date.now();
  for (const [k, v] of activeSessions.entries()) {
    if (now - new Date(v.updatedAt).getTime() > 600000) activeSessions.delete(k);
  }

  res.json({ ok: true });
});

// Recibir evento real de abandono desde /landing (compatible con fetch y navigator.sendBeacon)
app.post('/api/retargeting/abandon', async (req, res) => {
  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (_) { body = {}; }
    }
    if (body.sessionId) activeSessions.delete(body.sessionId);

    const event = await processRealAbandonment(body || {});
    res.json({ ok: true, event });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Convertir un abandono en venta real (LEAD -> PAYER)
app.post('/api/retargeting/:id/convert', async (req, res) => {
  try {
    const ev = await convertLeadToPayerInDb(req.params.id, req.body || {});
    res.json({ ok: true, event: ev });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Actualizar configuración real (Teléfono del asesor, correo Gmail SMTP, datos de contacto)
app.post('/api/config', async (req, res) => {
  try {
    const b = req.body || {};
    if (b.advisorName !== undefined) appState.config.advisorName = b.advisorName;
    if (b.advisorPhone !== undefined) appState.config.advisorPhone = b.advisorPhone;
    if (b.advisorEmail !== undefined) appState.config.advisorEmail = b.advisorEmail;
    if (b.smtpUser !== undefined) appState.config.smtpUser = b.smtpUser.trim();
    if (b.smtpPass !== undefined && b.smtpPass !== '********') {
      appState.config.smtpPass = b.smtpPass.trim();
    }
    saveState();
    await initMailer();
    res.json({ ok: true, smtp: mailAccountInfo, config: appState.config });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// Actualizar datos reales de teléfono/correo de un Lead para pruebas en vivo
app.post('/api/leads/update-contact', async (req, res) => {
  try {
    const { id, firstName, lastName, phone, email } = req.body || {};
    let lead = appState.leads.find(l => Number(l.id) === Number(id));
    if (lead) {
      if (firstName) lead.firstName = firstName.trim();
      if (lastName) lead.lastName = lastName.trim();
      if (phone) lead.phone = phone.trim();
      if (email) lead.email = email.trim();
    } else {
      lead = {
        id: Number(id || Date.now() % 100000),
        firstName: (firstName || 'Ronaldo').trim(),
        lastName: (lastName || 'Robles').trim(),
        phone: (phone || '+51 944 820 915').trim(),
        email: (email || 'ronaldo.robles@unitru.edu.pe').trim(),
        district: 'Víctor Larco Herrera',
        stage: 'LEAD'
      };
      appState.leads.unshift(lead);
    }

    if (sqlConnected && sqlPool && lead.id) {
      await sqlPool.request()
        .input('id', sql.BigInt, lead.id)
        .input('nombres', sql.NVarChar(100), lead.firstName)
        .input('apellidos', sql.NVarChar(100), lead.lastName)
        .input('telefono', sql.VarChar(25), lead.phone)
        .input('correo', sql.NVarChar(150), lead.email)
        .query(`
          UPDATE core.persona
          SET nombres = @nombres,
              apellidos = @apellidos,
              telefono_movil = @telefono,
              correo_electronico = @correo,
              fecha_actualizacion = SYSDATETIME()
          WHERE id_persona = @id;
        `).catch(() => {});
    }

    saveState();
    res.json({ ok: true, lead });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// Reiniciar sesión de WhatsApp para generar nuevo QR
app.post('/api/whatsapp/reset', async (req, res) => {
  try {
    if (waSock) {
      try { await waSock.logout(); } catch (_) {}
    }
    fs.rmSync(WA_AUTH_DIR, { recursive: true, force: true });
    waStatus = { state: 'DISCONNECTED', qrDataUrl: null, connectedPhone: null, connectedName: null, lastError: null };
    initWhatsAppClient();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Iniciar todo
(async () => {
  await initMailer();
  await initSqlConnection();
  await initWhatsAppClient();

  app.listen(PORT, '0.0.0.0', () => {
    console.log('============================================================================');
    console.log(`🚀 POLUX RETARGETING AGENT (REAL ENGINE) EN: http://localhost:${PORT}`);
    console.log('   - Conectado a la tienda de Polux: http://localhost:8080/landing');
    console.log('   - Escanea el QR de WhatsApp en http://localhost:4000 para envíos directos');
    console.log('============================================================================');
  });
})();
