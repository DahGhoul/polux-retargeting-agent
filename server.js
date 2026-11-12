/**
 * ============================================================================
 * POLUX RETARGETING AGENT (AGT_RETARGETING_LP) — FASE LEAD -> PAYER
 * Motor Autónomo de Recuperación de Carrito y Conversión Comercial
 * - Detección server-side autónoma por inactividad + sendBeacon inmediato
 * - Correo HTML Real vía Gmail SMTP (App Password) con Ethereal de respaldo
 * - WhatsApp Real Bidireccional (@whiskeysockets/baileys): envía foto+link y
 *   responde consultas entrantes de stock, cuotas, Yape y reserva
 * - Link Mágico de Recuperación (?recover=TOKEN) integrado con PoluxPay
 * - Persistencia transaccional en SQL Server (PoluxImportDB y PoluxImportMart)
 * ============================================================================
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
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

// ----------------------------------------------------------------------------
// 0. CARGA DE VARIABLES DE ENTORNO (.env) SIN DEPENDENCIAS EXTERNAS
// ----------------------------------------------------------------------------
(function loadDotEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) continue;
    const key = line.slice(0, eqIdx).trim();
    let val = line.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = val;
    }
  }
})();

const app = express();
const PORT = Number(process.env.PORT || 4000);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.text({ type: 'text/plain' }));
app.use(express.static(path.join(__dirname, 'public')));

// ----------------------------------------------------------------------------
// 1. CATÁLOGO OFICIAL DE POLUX IMPORTS (SINCRONIZADO CON /proyectobi/storefront/catalog)
// ----------------------------------------------------------------------------
const CATEGORY_IMAGE_MAP = {
  iPhone: 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?auto=format&fit=crop&w=900&q=85',
  MacBook: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=900&q=85',
  Mac: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=900&q=85',
  iPad: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?auto=format&fit=crop&w=900&q=85',
  'Apple Watch': 'https://images.unsplash.com/photo-1546868871-7041f2a55e12?auto=format&fit=crop&w=900&q=85',
  Watch: 'https://images.unsplash.com/photo-1546868871-7041f2a55e12?auto=format&fit=crop&w=900&q=85',
  AirPods: 'https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?auto=format&fit=crop&w=900&q=85',
  Accesorios: 'https://images.unsplash.com/photo-1615526675159-e248c3021d3f?auto=format&fit=crop&w=900&q=85',
};

let CATALOG = [
  {
    id: 1,
    slug: 'iphone-17-pro-max',
    sku: 'APL-IP17PM-256-TI',
    name: 'iPhone 17 Pro Max 256 GB',
    shortName: 'iPhone 17 Pro Max',
    category: 'iPhone',
    condition: 'NUEVO_SELLADO',
    color: 'Titanio Desierto',
    capacity: '256 GB',
    stock: 6,
    price: 7299.00,
    originalPrice: 7899.00,
    installment3: 2433.00,
    specs: 'Chip A19 Pro (3nm), Super Retina XDR 6.9" 120Hz, sellado Apple USA.',
    image: CATEGORY_IMAGE_MAP.iPhone
  },
  {
    id: 2,
    slug: 'iphone-16-pro-max',
    sku: 'APL-IP16PM-256-TN',
    name: 'iPhone 16 Pro Max 256 GB',
    shortName: 'iPhone 16 Pro Max',
    category: 'iPhone',
    condition: 'NUEVO_SELLADO',
    color: 'Titanio Natural',
    capacity: '256 GB',
    stock: 9,
    price: 6299.00,
    originalPrice: 6999.00,
    installment3: 2099.67,
    specs: 'Pantalla 6.9" Super Retina XDR, Chip A18 Pro, Cámara 48MP 5x, sellado Apple USA.',
    image: CATEGORY_IMAGE_MAP.iPhone
  },
  {
    id: 3,
    slug: 'iphone-16',
    sku: 'APL-IP16-128-ULT',
    name: 'iPhone 16 128 GB',
    shortName: 'iPhone 16',
    category: 'iPhone',
    condition: 'NUEVO_SELLADO',
    color: 'Azul Ultramarino',
    capacity: '128 GB',
    stock: 7,
    price: 4299.00,
    originalPrice: 4799.00,
    installment3: 1433.00,
    specs: 'Pantalla OLED 6.1", Chip A18, Botón de Acción, garantía oficial 1 año.',
    image: 'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?auto=format&fit=crop&w=900&q=85'
  },
  {
    id: 12,
    slug: 'macbook-air-m4-13',
    sku: 'APL-MBA-M4-13',
    name: 'MacBook Air 13" Chip M4 16GB / 512GB',
    shortName: 'MacBook Air M4',
    category: 'MacBook',
    condition: 'NUEVO_SELLADO',
    color: 'Medianoche',
    capacity: '16 GB / 512 GB SSD',
    stock: 5,
    price: 5499.00,
    originalPrice: 6199.00,
    installment3: 1833.00,
    specs: 'Liquid Retina 13.6", Chip Apple M4, 16 GB RAM unificada, 18h batería.',
    image: CATEGORY_IMAGE_MAP.MacBook
  },
  {
    id: 17,
    slug: 'ipad-air-m3',
    sku: 'APL-IPADAIR-M3',
    name: 'iPad Air 11" Chip M3 128 GB',
    shortName: 'iPad Air M3',
    category: 'iPad',
    condition: 'NUEVO_SELLADO',
    color: 'Gris Espacial',
    capacity: '128 GB Wi-Fi',
    stock: 5,
    price: 3199.00,
    originalPrice: 3599.00,
    installment3: 1066.33,
    specs: 'Liquid Retina 11", Chip M3, compatible Apple Pencil Pro.',
    image: CATEGORY_IMAGE_MAP.iPad
  },
  {
    id: 20,
    slug: 'apple-watch-s10',
    sku: 'APL-AWS10-46',
    name: 'Apple Watch Series 10 46 mm',
    shortName: 'Apple Watch Series 10',
    category: 'Apple Watch',
    condition: 'NUEVO_SELLADO',
    color: 'Negro Azabache',
    capacity: '46 mm GPS',
    stock: 6,
    price: 2199.00,
    originalPrice: 2499.00,
    installment3: 733.00,
    specs: 'OLED gran angular, ECG y apnea, carga 80% en 30 min.',
    image: CATEGORY_IMAGE_MAP['Apple Watch']
  },
  {
    id: 21,
    slug: 'airpods-pro-2',
    sku: 'APL-APP2-USBC',
    name: 'AirPods Pro 2 (USB-C)',
    shortName: 'AirPods Pro 2',
    category: 'AirPods',
    condition: 'NUEVO_SELLADO',
    color: 'Blanco',
    capacity: 'USB-C MagSafe',
    stock: 11,
    price: 1099.00,
    originalPrice: 1299.00,
    installment3: 366.33,
    specs: 'Chip H2, Cancelación activa 2x, estuche MagSafe con altavoz.',
    image: CATEGORY_IMAGE_MAP.AirPods
  },
  {
    id: 5,
    slug: 'iphone-15-pro-seminuevo',
    sku: 'PLX-CERT-IP15P-256',
    name: 'iPhone 15 Pro 256 GB · Seminuevo Certificado',
    shortName: 'iPhone 15 Pro (Grado A+)',
    category: 'iPhone',
    condition: 'SEMINUEVO_CERTIFICADO',
    color: 'Titanio Azul',
    capacity: '256 GB',
    stock: 2,
    price: 3699.00,
    originalPrice: 4899.00,
    installment3: 1233.00,
    specs: 'Chip A17 Pro · Batería 93% certificada · Garantía Polux Lab 6 meses.',
    image: CATEGORY_IMAGE_MAP.iPhone
  }
];

async function syncCatalogFromStorefront() {
  const url = process.env.STOREFRONT_CATALOG_URL || 'http://localhost:3000/proyectobi/storefront/catalog';
  try {
    const resp = await fetch(url);
    if (!resp.ok) return;
    const remote = await resp.json();
    if (!Array.isArray(remote) || !remote.length) return;
    CATALOG = remote.map((item, idx) => {
      const price = Number(item.pricePen || 4299);
      const localPublicUrl = item.imageUrl && String(item.imageUrl).startsWith('http')
        ? item.imageUrl
        : CATEGORY_IMAGE_MAP[item.category] || CATEGORY_IMAGE_MAP.iPhone;
      return {
        id: Number(item.dbProductId || idx + 1),
        slug: item.slug,
        sku: item.sku || `PLX-${idx + 1}`,
        name: item.name,
        shortName: item.shortName || item.name,
        category: item.category || 'iPhone',
        condition: item.condition || 'NUEVO_SELLADO',
        color: item.color || 'Oficial',
        capacity: item.capacity || '256 GB',
        stock: Number(item.stock ?? 5),
        price,
        originalPrice: Number(item.originalPricePen || Math.round(price * 1.12)),
        installment3: Number((price / 3).toFixed(2)),
        specs: item.tagline || `${item.specs?.chip || 'Apple Silicon'} · ${item.specs?.display || ''}`.trim(),
        image: localPublicUrl,
      };
    });
    console.log(`🔄 Catálogo sincronizado desde Storefront API (${CATALOG.length} modelos).`);
  } catch {
    // Mantiene fallback local si plataforma principal aún no levantó
  }
}

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
// 2. CONFIGURACIÓN PERSISTENTE Y ESTADO EN MEMORIA
// ----------------------------------------------------------------------------
const DATA_FILE = path.join(__dirname, 'retargeting_state.json');

const DEFAULT_CONFIG = {
  advisorName: process.env.ADVISOR_NAME || 'Diego Cuba (Asesor Senior Polux)',
  advisorPhone: process.env.ADVISOR_PHONE || '+51 944 620 118',
  advisorEmail: process.env.ADVISOR_EMAIL || 'diegokids111@gmail.com',
  poluxStoreUrl: process.env.POLUX_STORE_URL || 'http://localhost:8080/landing',
  smtpHost: process.env.SMTP_HOST || 'smtp.gmail.com',
  smtpPort: Number(process.env.SMTP_PORT || 465),
  smtpUser: process.env.SMTP_USER || '',
  emailMaxSeconds: Number(process.env.RULE_EMAIL_MAX_SECONDS || 300),
  whatsappMaxSeconds: Number(process.env.RULE_WHATSAPP_MAX_SECONDS || 600),
  abandonTimeoutSeconds: Number(process.env.SESSION_ABANDON_TIMEOUT_SECONDS || 25),
  cooldownMinutes: Number(process.env.COOLDOWN_MINUTES || 10)
};

// Contraseña SMTP se mantiene únicamente en memoria/.env (nunca se graba en JSON)
let runtimeSmtpPass = process.env.SMTP_PASS || '';

const DEFAULT_LEADS = [
  {
    id: 101,
    firstName: 'Ronaldo',
    lastName: 'Robles Romero',
    documentNumber: '74892103',
    email: 'ronaldo.robles@unitru.edu.pe',
    phone: '+51 963 150 918',
    district: 'Víctor Larco Herrera',
    stage: 'LEAD',
    priority: 'ALTA'
  }
];

function loadState() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      const loadedConfig = { ...(parsed.config || {}) };
      delete loadedConfig.smtpPass;
      return {
        config: {
          ...DEFAULT_CONFIG,
          ...loadedConfig,
          smtpUser: process.env.SMTP_USER || loadedConfig.smtpUser || ''
        },
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
    const safeConfig = { ...appState.config };
    delete safeConfig.smtpPass;
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify({ config: safeConfig, leads: appState.leads, events: appState.events }, null, 2),
      'utf8'
    );
  } catch (e) {
    console.error('Error guardando estado:', e.message);
  }
}

let appState = loadState();
const activeSessions = new Map();
const processedSessionIds = new Set();

function fmtMoney(n) {
  return `S/ ${Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function normalizePhoneDigits(phone) {
  let digits = String(phone || '').replace(/[^0-9]/g, '');
  if (!digits) return '';
  if (digits.length === 9 && digits.startsWith('9')) digits = '51' + digits;
  return digits;
}

// ----------------------------------------------------------------------------
// 3. MOTOR WHATSAPP REAL (@whiskeysockets/baileys) — BIDIRECCIONAL
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
  const digits = normalizePhoneDigits(phone);
  if (!digits) return null;
  return `${digits}@s.whatsapp.net`;
}

function findLatestEventByPhone(senderDigits) {
  if (!senderDigits) return null;
  const tail9 = senderDigits.slice(-9);
  return appState.events.find(ev => {
    const evDigits = normalizePhoneDigits(ev.leadPhone);
    return evDigits === senderDigits || (tail9.length === 9 && evDigits.endsWith(tail9));
  }) || null;
}

function buildConversationalReply(textRaw, ev) {
  const txt = String(textRaw || '').toLowerCase().trim();
  const product = ev ? findProduct(ev.productSlug || ev.productName) : CATALOG[0];
  const priceStr = fmtMoney(product.price);
  const cuotaStr = fmtMoney(product.installment3);
  const checkoutLink = ev?.checkoutUrl || appState.config.poluxStoreUrl || 'http://localhost:8080/landing';
  const greetingName = ev?.leadFirstName ? `*${ev.leadFirstName}*` : '';

  // 1. Opt-out / no desea continuar
  if (/\b(no gracias|no me interesa|ya no|stop|basta|dejar de)\b/.test(txt)) {
    if (ev) ev.clientOptOut = true;
    return {
      action: 'OPT_OUT',
      reply:
        `Entendido${greetingName ? ' ' + greetingName : ''}, gracias por avisarnos 🙏 No volveremos a escribirte por este producto. Si en algún momento deseas retomar tu cotización en Polux Imports Trujillo, aquí estaremos.`
    };
  }

  // 2. Consulta sobre pago, Yape, Plin, link o querer comprar ya
  if (/\b(yape|plin|pagar|pago|link|enlace|cuota|cuotas|tarjeta|comprar|separar|reservar|quiero)\b/.test(txt)) {
    return {
      action: 'SEND_CHECKOUT_LINK',
      reply:
        `¡Excelente decisión${greetingName ? ', ' + greetingName : ''}! 🎉\n\n` +
        `Puedes pagar tu *${product.name}* (${product.color}) por *${priceStr}* o en *3 cuotas sin interés de ${cuotaStr}* usando *Yape, Plin, transferencia BCP/BBVA o tarjeta*.\n\n` +
        `🔒 Tu unidad queda reservada por 15 minutos con emisión inmediata de Boleta/Factura SUNAT en este enlace directo:\n👉 ${checkoutLink}\n\n` +
        `Avísame apenas completes el pago para confirmar tu número de orden. 😊`
    };
  }

  // 3. Consulta de stock, disponibilidad, color, capacidad, garantía o especificaciones
  if (/\b(stock|disponible|hay|tienen|color|colores|capacidad|gb|garant|original|sellado|tienda|donde|trujillo|envio|envío)\b/.test(txt)) {
    return {
      action: 'PRODUCT_INFO',
      reply:
        `¡Sí${greetingName ? ', ' + greetingName : ''}! Tenemos *${product.stock} unidades en stock* de *${product.name}* (${product.color}, ${product.capacity}), nuevos sellados de fábrica Apple USA con *garantía oficial de 1 año* y número de serie verificable en Apple.com ✅\n\n` +
        `📍 Puedes recoger hoy mismo en nuestra tienda de *Av. Larco 840, Víctor Larco - Trujillo* o pedir entrega express.\n` +
        `💰 Precio: *${priceStr}* (o 3 cuotas de *${cuotaStr}*).\n\n` +
        `👉 Finaliza tu reserva aquí: ${checkoutLink}`
    };
  }

  // 4. Pide hablar con un asesor o que lo llamen
  if (/\b(asesor|humano|llamar|llamada|persona|ayuda|duda|consulta)\b/.test(txt)) {
    return {
      action: 'ESCALATE_ADVISOR',
      reply:
        `¡Por supuesto${greetingName ? ', ' + greetingName : ''}! Acabo de notificar con prioridad alta a *${appState.config.advisorName}* (${appState.config.advisorPhone}) para que te atienda personalmente respecto a tu *${product.name}* 📞.\n\n` +
        `Si deseas ir avanzando tu reserva mientras te contacta, aquí tienes tu acceso directo: ${checkoutLink}`
    };
  }

  // 5. Respuesta general contextual
  return {
    action: 'GENERAL_ASSIST',
    reply:
      `¡Hola${greetingName ? ' ' + greetingName : ''}! Soy el asistente comercial de *Polux Imports Perú* 🍎.\n\n` +
      `Veo tu interés en el *${product.name}* (*${priceStr}* · stock disponible: ${product.stock} und.).\n` +
      `Puedes consultarme por *stock, colores, cuotas sin interés, Yape/Plin* o completar tu compra directo aquí:\n👉 ${checkoutLink}`
  };
}

async function handleIncomingWhatsAppMessages(upsert) {
  if (!upsert || upsert.type !== 'notify' || !Array.isArray(upsert.messages)) return;

  for (const msg of upsert.messages) {
    try {
      if (!msg.key || msg.key.fromMe) continue;
      const remoteJid = msg.key.remoteJid || '';
      if (!remoteJid || remoteJid.endsWith('@g.us') || remoteJid === 'status@broadcast') continue;

      const textBody =
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        msg.message?.imageMessage?.caption ||
        '';
      if (!textBody.trim()) continue;

      const senderDigits = remoteJid.split('@')[0].replace(/[^0-9]/g, '');
      const ev = findLatestEventByPhone(senderDigits);

      if (ev) {
        if (!Array.isArray(ev.conversation)) ev.conversation = [];
        ev.conversation.push({
          from: 'CLIENT',
          text: textBody.trim(),
          at: new Date().toISOString()
        });
      }

      const { action, reply } = buildConversationalReply(textBody, ev);
      await waSock.sendMessage(remoteJid, { text: reply });

      if (ev) {
        ev.conversation.push({
          from: 'AGENT',
          action,
          text: reply,
          at: new Date().toISOString()
        });
        if (action === 'ESCALATE_ADVISOR' && waStatus.state === 'CONNECTED' && appState.config.advisorPhone) {
          const advMsg =
            `📲 *CLIENTE PIDIÓ ATENCIÓN POR WHATSAPP*\n` +
            `👤 *Lead:* ${ev.leadName} (${ev.leadPhone})\n` +
            `🍎 *Producto:* ${ev.productName}\n` +
            `💬 *Mensaje del cliente:* "${textBody.trim()}"`;
          await sendRealWhatsAppMessage(appState.config.advisorPhone, null, advMsg).catch(() => {});
        }
        saveState();
      }
      console.log(`💬 Respuesta automática WhatsApp enviada a +${senderDigits} [Acción: ${action}]`);
    } catch (err) {
      console.warn('Error procesando mensaje entrante WhatsApp:', err.message);
    }
  }
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
      browser: ['Polux Imports Suite', 'Chrome', '124.0.0']
    });

    waSock.ev.on('creds.update', saveCreds);
    waSock.ev.on('messages.upsert', handleIncomingWhatsAppMessages);

    waSock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        try {
          waStatus.qrDataUrl = await QRCode.toDataURL(qr, { margin: 1, width: 260 });
          waStatus.state = 'QR_READY';
          console.log('📱 Nuevo código QR de WhatsApp generado. Escanéalo en http://localhost:' + PORT);
        } catch (err) {
          console.error('Error generando QR:', err.message);
        }
      }

      if (connection === 'open') {
        waStatus.state = 'CONNECTED';
        waStatus.qrDataUrl = null;
        waStatus.connectedPhone = waSock.user?.id?.split(':')[0] || 'Conectado';
        waStatus.connectedName = waSock.user?.name || 'Polux Imports Oficial';
        waStatus.lastError = null;
        console.log(`✅ WhatsApp Real Conectado como: +${waStatus.connectedPhone} (${waStatus.connectedName})`);
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        waStatus.state = 'DISCONNECTED';
        waStatus.qrDataUrl = null;
        waStatus.connectedPhone = null;

        if (statusCode === DisconnectReason.loggedOut) {
          console.log('⚠️ Sesión de WhatsApp cerrada. Limpiando credenciales para generar nuevo QR...');
          try { fs.rmSync(WA_AUTH_DIR, { recursive: true, force: true }); } catch (_) {}
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
  let jid = formatPhoneToJid(phone);
  if (!jid) return { sent: false, reason: 'Número de teléfono inválido' };

  if (!waSock || waStatus.state !== 'CONNECTED') {
    return {
      sent: false,
      reason: 'WhatsApp aún no vinculado con QR (Escanea el QR para envío automático)'
    };
  }

  try {
    // Verificar existencia en WhatsApp y resolver JID canónico
    const check = await waSock.onWhatsApp(jid).catch(() => []);
    if (Array.isArray(check) && check.length > 0) {
      if (!check[0].exists) {
        return { sent: false, reason: `El número ${phone} no tiene cuenta activa en WhatsApp.` };
      }
      jid = check[0].jid || jid;
    }

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
  const smtpPass = runtimeSmtpPass || process.env.SMTP_PASS;

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
      console.log(`📧 SMTP Real verificado y activo con Gmail: ${smtpUser}`);
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
    console.log(`📧 SMTP Ethereal de respaldo activo (${testAccount.user}).`);
  } catch (e) {
    mailAccountInfo = { mode: 'SMTP_ERROR', user: e.message };
    console.warn('Error iniciando SMTP:', e.message);
  }
}

function buildRealAbandonedEmailHtml(lead, product, checkoutUrl) {
  const firstNameUpper = (lead.firstName || 'CLIENTE').toUpperCase();
  const formattedPrice = fmtMoney(product.price);
  const formattedInstallment = fmtMoney(product.installment3);

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
        <table width="560" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 8px 28px rgba(0,0,0,0.08);">
          <tr>
            <td style="background-color:#0f172a;padding:18px 28px;color:#ffffff;">
              <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;">Polux Imports Perú · Tienda Oficial Trujillo</div>
              <div style="font-size:20px;font-weight:800;margin-top:4px;">No abandones tu carrito 👀</div>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:32px 28px;text-align:center;">
              <div style="font-size:24px;font-weight:800;color:#0f172a;margin-bottom:12px;">🍎 Polux Imports</div>
              <h2 style="font-size:21px;font-weight:500;color:#111827;margin:8px 0 16px 0;">
                <strong>Hola,</strong> ${firstNameUpper}
              </h2>
              <p style="font-size:15px;line-height:1.5;color:#374151;margin:0 0 12px 0;">
                Vimos que saliste sin finalizar tu reserva 😔
              </p>
              <p style="font-size:15px;line-height:1.5;color:#374151;margin:0 0 18px 0;">
                Guardamos tu <strong>${product.name}</strong> (${product.color}) por <strong>15 minutos</strong> con envío express gratis y garantía oficial Apple de 1 año.
              </p>
              <div style="background:#f8fafc;border-radius:14px;padding:18px;margin-bottom:22px;border:1px solid #e2e8f0;">
                <img src="${product.image}" alt="${product.name}" style="max-width:320px;width:100%;height:200px;object-fit:cover;border-radius:10px;display:block;margin:0 auto 14px auto;" />
                <div style="font-size:17px;font-weight:700;color:#0f172a;">${product.name}</div>
                <div style="font-size:19px;font-weight:800;color:#1d4ed8;margin-top:6px;">
                  ${formattedPrice} <span style="font-size:13px;font-weight:500;color:#475569;">o 3 cuotas sin interés de ${formattedInstallment}</span>
                </div>
              </div>
              <a href="${checkoutUrl}"
                 style="display:inline-block;background-color:#059669;color:#ffffff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 34px;border-radius:999px;">
                Completar mi compra ahora →
              </a>
              <p style="font-size:11.5px;color:#94a3b8;margin-top:20px;">
                Av. Larco 840, Víctor Larco Herrera, Trujillo · Comprobante electrónico SUNAT garantizado.
              </p>
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
        VALUES ('AGT_RETARGETING_LP', N'Agente Autónomo de Retargeting (Lead -> Payer)', N'Monitorea sesiones reales en tienda (/landing) y ejecuta recuperación omnicanal (<5m Correo, 5-10m WhatsApp Bidireccional, >10m Alerta Asesor SLA).', 'LEADS', 0, 1);
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
          comprobante_sunat       VARCHAR(40) NULL,
          id_orden_generada       BIGINT NULL,
          fecha_abandono          DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
          fecha_conversion        DATETIME2 NULL
        );
      END;
    `);
  } catch (err) {
    sqlConnected = false;
    console.warn('⚠️ SQL Server no accesible en este entorno (operando con persistencia local JSON):', err.message);
  }
}

// ----------------------------------------------------------------------------
// 6. MOTOR DE SCORING INTELIGENTE, ANTI-SPAM Y EJECUCIÓN REAL
// ----------------------------------------------------------------------------
function calculateIntentAnalysis(secondsViewed, interactions, product) {
  const emailMax = Number(appState.config.emailMaxSeconds || 300);
  const waMax = Number(appState.config.whatsappMaxSeconds || 600);
  const secs = Math.max(5, Number(secondsViewed || 0));
  const signals = interactions || {};

  let bonus = 0;
  const reasons = [];
  if (signals.openedCheckout) {
    bonus += 16;
    reasons.push('Abrió pasarela de pago sin completar (+16%)');
  }
  if (signals.openedQuote) {
    bonus += 10;
    reasons.push('Inició formulario de cotización (+10%)');
  }
  if (Number(signals.productsViewed || 1) >= 2) {
    bonus += 5;
    reasons.push(`Comparó ${signals.productsViewed} equipos Apple (+5%)`);
  }
  if (Number(signals.cartCount || 0) > 0) {
    bonus += 12;
    reasons.push(`Dejó ${signals.cartCount} producto(s) en Bolsa Polux (+12%)`);
  }
  if (Number(signals.comparedCount || 0) >= 2) {
    bonus += 6;
    reasons.push(`Usó Comparador de modelos (${signals.comparedCount}) (+6%)`);
  }
  if (Number(product?.price || 0) >= 4000) {
    bonus += 4;
    reasons.push('Ticket alto Apple Pro/Mac (+4%)');
  }

  let tier = '';
  let channel = '';
  let intentLevel = '';
  let baseProb = 0;

  if (secs < emailMax) {
    tier = 'MENOR_5_MIN';
    channel = 'CORREO_HTML';
    intentLevel = 'EXPLORATORIA';
    baseProb = Math.round(24 + (secs / emailMax) * 20);
    reasons.unshift(`Permanencia exploratoria (< ${Math.round(emailMax / 60)} min)`);
  } else if (secs <= waMax) {
    tier = 'ENTRE_5_Y_10_MIN';
    channel = 'WHATSAPP_DIRECTO';
    intentLevel = 'COMPRA_POSIBLE';
    baseProb = Math.round(62 + ((secs - emailMax) / Math.max(1, waMax - emailMax)) * 18);
    reasons.unshift(`Permanencia intermedia (${Math.round(emailMax / 60)}–${Math.round(waMax / 60)} min)`);
  } else {
    tier = 'MAYOR_10_MIN';
    channel = 'ALERTA_ASESOR_LLAMADA';
    intentLevel = 'COMPRA_MUY_POSIBLE';
    baseProb = Math.round(85 + Math.min(10, (secs - waMax) / 60));
    reasons.unshift(`Permanencia crítica (> ${Math.round(waMax / 60)} min)`);
  }

  const probability = Math.min(99, Math.max(20, baseProb + bonus));
  return { tier, channel, intentLevel, probability, reasons };
}

function isUnderCooldown(phone, email, productSlug) {
  const cooldownMs = Number(appState.config.cooldownMinutes || 10) * 60 * 1000;
  if (cooldownMs <= 0) return false;
  const cleanPhone = normalizePhoneDigits(phone);
  const cleanEmail = String(email || '').trim().toLowerCase();
  const now = Date.now();

  return appState.events.some(ev => {
    if (ev.status === 'CONVERTIDO_PAYER' || ev.clientOptOut) return true;
    const ageMs = now - new Date(ev.createdAt).getTime();
    if (ageMs > cooldownMs) return false;
    const sameProduct = ev.productSlug === productSlug;
    const samePhone = cleanPhone && normalizePhoneDigits(ev.leadPhone) === cleanPhone;
    const sameEmail = cleanEmail && String(ev.leadEmail || '').trim().toLowerCase() === cleanEmail;
    return sameProduct && (samePhone || sameEmail);
  });
}

async function processRealAbandonment(payload) {
  const targetPhone = (payload.phone || '').trim();
  const targetEmail = (payload.email || '').trim();
  const targetFirstName = (payload.firstName || (payload.leadName || 'Cliente').split(' ')[0] || 'Cliente').trim();
  const targetLastName = (payload.lastName || (payload.leadName || '').split(' ').slice(1).join(' ') || '').trim();
  const fullName = `${targetFirstName} ${targetLastName}`.trim();

  let lead = null;
  if (payload.leadId) {
    lead = appState.leads.find(l => Number(l.id) === Number(payload.leadId));
  }
  if (!lead) {
    lead = {
      id: Number(payload.leadId || 101),
      firstName: targetFirstName,
      lastName: targetLastName || 'Trujillo',
      documentNumber: payload.documentNumber || '74892103',
      email: targetEmail || 'ronaldo.robles@unitru.edu.pe',
      phone: targetPhone || '+51 963 150 918',
      district: payload.district || 'Víctor Larco Herrera',
      stage: 'LEAD'
    };
  }

  const finalPhone = targetPhone || lead.phone;
  const finalEmail = targetEmail || lead.email;
  const cartItems = Array.isArray(payload.cartItems) ? payload.cartItems : [];
  const product = findProduct(payload.productId || payload.productSlug || payload.productName || cartItems[0]?.slug);
  const cartTotal = Number(payload.cartTotal || 0) || (cartItems.length
    ? cartItems.reduce((acc, it) => acc + Number(it.pricePen || product.price) * Number(it.qty || 1), 0)
    : product.price);
  const secs = Math.max(5, Number(payload.secondsViewed || 120));
  const mm = String(Math.floor(secs / 60)).padStart(2, '0');
  const ss = String(secs % 60).padStart(2, '0');
  const durationLabel = `${mm}:${ss} min (${secs} seg)`;

  // Anti-spam check solo para disparos orgánicos automáticos (permite forzar en pruebas manuales si bypassCooldown=true)
  if (!payload.bypassCooldown && isUnderCooldown(finalPhone, finalEmail, product.slug)) {
    return {
      skippedCooldown: true,
      reason: `Cooldown anti-spam activo (${appState.config.cooldownMinutes} min) para ${finalPhone || finalEmail} en ${product.name}`
    };
  }

  const recoverToken = `PLX-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  const reservationExpiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const baseStoreUrl = (appState.config.poluxStoreUrl || 'http://localhost:8080/landing').split('?')[0];
  const storeCheckoutUrl = `${baseStoreUrl}?recover=${recoverToken}&product=${product.slug}`;

  const enrichedInteractions = {
    ...(payload.interactions || {}),
    cartCount: cartItems.length,
    comparedCount: Array.isArray(payload.comparedModels) ? payload.comparedModels.length : 0,
  };
  const analysis = calculateIntentAnalysis(secs, enrichedInteractions, product);
  const { tier, channel, intentLevel, probability, reasons } = analysis;

  const firstNameUpper = targetFirstName.toUpperCase();
  const formattedPrice = fmtMoney(product.price);
  const cuota3 = fmtMoney(product.installment3);

  let headline = '';
  let messageBody = '';
  let deliveryResult = {};
  let emailPreviewUrl = null;
  let advisorScript = null;
  const conversation = [];

  if (channel === 'CORREO_HTML') {
    headline = `Correo de recuperación enviado a ${finalEmail}`;
    messageBody = `No abandones tu carrito 👀 — Hola, ${firstNameUpper}. Reservamos tu ${product.name} (${formattedPrice}) por 15 minutos.`;

    const htmlContent = buildRealAbandonedEmailHtml({ ...lead, firstName: targetFirstName }, product, storeCheckoutUrl);
    if (mailTransporter && finalEmail) {
      try {
        const info = await mailTransporter.sendMail({
          from: `"Polux Imports Perú 🍎" <${process.env.SMTP_USER || appState.config.smtpUser || 'tienda@poluximports.pe'}>`,
          to: finalEmail,
          subject: 'No abandones tu carrito 👀',
          html: htmlContent
        });
        const preview = nodemailer.getTestMessageUrl(info);
        if (preview) emailPreviewUrl = preview;
        deliveryResult = {
          sent: true,
          mode: mailAccountInfo.mode,
          recipient: finalEmail,
          messageId: info.messageId,
          previewUrl: emailPreviewUrl
        };
      } catch (mailErr) {
        deliveryResult = { sent: false, reason: mailErr.message };
      }
    } else {
      deliveryResult = { sent: false, reason: 'Sin correo destino o transporte SMTP no inicializado.' };
    }
  } else if (channel === 'WHATSAPP_DIRECTO') {
    headline = `WhatsApp oficial enviado a ${finalPhone}`;
    const waCaption =
      `*Polux Imports Perú* 🍎✅\n\n` +
      `Hola *${firstNameUpper}* 🐾🐶 ¿Tuviste alguna duda con la capacidad (${product.capacity}), el color (${product.color}) o los métodos de pago? No te preocupes, estamos aquí para ayudarte.\n\n` +
      `📱 *Equipo:* ${product.name}\n` +
      `💰 *Precio:* ${formattedPrice} (o 3 cuotas sin interés de ${cuota3})\n` +
      `⏳ *Reserva exclusiva por 15 min:*\n👉 ${storeCheckoutUrl}\n\n` +
      `_Responde a este mensaje si deseas consultar stock, colores o pagar con Yape/Plin._`;

    messageBody = waCaption;
    deliveryResult = await sendRealWhatsAppMessage(finalPhone, product.image, waCaption);
    conversation.push({ from: 'AGENT', action: 'INITIAL_RECOVERY', text: waCaption, at: new Date().toISOString() });
  } else {
    headline = `Alerta urgente enviada al Asesor (${appState.config.advisorPhone}) para llamar a ${fullName}`;
    const advisorAlertText =
      `🚨 *ALERTA POLUX IMPORTS — COMPRA MUY POSIBLE (>10 MIN)* 🚨\n\n` +
      `👤 *Cliente (Lead):* ${fullName}\n` +
      `⏱️ *Tiempo revisando:* ${durationLabel}\n` +
      `📈 *Score de Intención:* ${probability}%\n` +
      `🍎 *Producto:* ${product.name} (${formattedPrice})\n` +
      `📞 *Llamar ahora mismo al cliente:* ${finalPhone}\n` +
      `🔗 *Link directo de reserva:* ${storeCheckoutUrl}\n\n` +
      `💡 *Guion:* Ofrecer 3 cuotas sin interés de ${cuota3} o envío express hoy.`;

    messageBody = advisorAlertText;
    advisorScript = {
      advisorName: appState.config.advisorName,
      advisorPhone: appState.config.advisorPhone,
      clientPhone: finalPhone,
      opening: `¡Hola ${targetFirstName}! Te saluda ${appState.config.advisorName} de Polux Imports Trujillo. Vimos que estuviste evaluando el ${product.name} y te llamo personalmente para ayudarte a reservar tu unidad.`,
      closingOffer: `Podemos activarte 3 cuotas sin intereses de ${cuota3} o pago directo por Yape/Plin con entrega certificada hoy mismo.`
    };

    deliveryResult = await sendRealWhatsAppMessage(appState.config.advisorPhone, product.image, advisorAlertText);
  }

  let sqlRetargetingId = null;

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
          razones: reasons,
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
          .input('accion', sql.NVarChar(300), `LLAMAR AHORA A ${fullName} (${finalPhone}): Estuvo ${durationLabel} viendo ${product.name} (${probability}% prob.).`)
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

  const cleanClientPhone = normalizePhoneDigits(finalPhone);
  const eventRecord = {
    id: sqlRetargetingId || Date.now(),
    sqlRetargetingId,
    recoverToken,
    reservationExpiresAt,
    leadId: lead.id,
    leadName: fullName,
    leadFirstName: targetFirstName,
    leadEmail: finalEmail,
    leadPhone: finalPhone,
    leadDistrict: lead.district || 'Trujillo',
    productId: product.id,
    productSlug: product.slug,
    productName: product.name,
    productColor: product.color,
    productPrice: product.price,
    productImage: product.image,
    cartItems,
    cartTotal,
    focusedProduct: payload.focusedProduct || null,
    comparedModels: Array.isArray(payload.comparedModels) ? payload.comparedModels : [],
    customerLoggedIn: Boolean(payload.customerLoggedIn),
    secondsViewed: secs,
    durationLabel,
    exitReason: payload.exitReason || 'ABANDONO_DETECTADO',
    tier,
    channel,
    intentLevel,
    probability,
    intentReasons: reasons,
    headline,
    messageBody,
    emailPreviewUrl,
    advisorScript,
    advisorClaimedAt: null,
    slaSeconds: null,
    conversation,
    deliveryResult,
    waManualFallbackUrl: cleanClientPhone ? `https://wa.me/${cleanClientPhone}?text=${encodeURIComponent(messageBody)}` : null,
    telCallUrl: finalPhone ? `tel:${finalPhone}` : null,
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

// Sweeper Autónomo en Segundo Plano: detecta sesiones inactivas/abandonadas cada 10s
function startAbandonmentSweeper() {
  setInterval(async () => {
    const now = Date.now();
    const timeoutMs = Number(appState.config.abandonTimeoutSeconds || 25) * 1000;

    for (const [sessionId, session] of activeSessions.entries()) {
      const idleMs = now - new Date(session.updatedAt).getTime();
      if (idleMs >= timeoutMs) {
        activeSessions.delete(sessionId);

        if (session.purchased || processedSessionIds.has(sessionId)) continue;
        // Solo dispara autónomamente si el visitante ingresó datos reales de contacto o tiene >= 10s
        const hasContact = Boolean((session.phone && session.phone.trim()) || (session.email && session.email.trim()));
        if (!hasContact || Number(session.secondsViewed || 0) < 5) continue;

        processedSessionIds.add(sessionId);
        console.log(`⚡ [Sweeper Autónomo] Abandono detectado tras ${Math.round(idleMs / 1000)}s sin latido: ${session.leadName} (${session.productName})`);
        await processRealAbandonment({
          sessionId,
          leadId: session.leadId,
          firstName: session.leadName.split(' ')[0],
          lastName: session.leadName.split(' ').slice(1).join(' '),
          phone: session.phone,
          email: session.email,
          productSlug: session.productSlug,
          productName: session.productName,
          cartItems: session.cartItems || [],
          cartTotal: session.cartTotal || 0,
          focusedProduct: session.focusedProduct || null,
          comparedModels: session.comparedModels || [],
          customerLoggedIn: Boolean(session.customerLoggedIn),
          secondsViewed: session.secondsViewed,
          interactions: session.interactions,
          exitReason: 'INACTIVIDAD_AUTONOMA_SERVIDOR'
        }).catch(err => console.warn('Error en sweeper:', err.message));
      }
    }
  }, 10000);
}

// ----------------------------------------------------------------------------
// 7. CONVERSIÓN REAL LEAD -> PAYER EN BASE DE DATOS Y DATA MART
// ----------------------------------------------------------------------------
async function convertLeadToPayerInDb(eventOrId, paymentDto) {
  let ev = null;
  if (typeof eventOrId === 'object' && eventOrId !== null) {
    ev = eventOrId;
  } else {
    ev = appState.events.find(e => Number(e.id) === Number(eventOrId) || e.recoverToken === String(eventOrId));
  }
  if (!ev) throw new Error('Registro de abandono no encontrado');

  if (ev.status === 'CONVERTIDO_PAYER') return ev;

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
            (@idPersona, 'LEADS', 'PAYER', CONCAT(N'Conversión LEAD -> PAYER recuperada vía ', @canalRecuperacion), 'PAGO_RETARGETING', @idPago, 'pago', 'AGT_RETARGETING_LP');

          UPDATE leads.abandono_carrito_retargeting
          SET estado_recuperacion = 'CONVERTIDO_PAYER',
              medio_pago_conversion = @medioPago,
              monto_pagado_pen = @monto,
              comprobante_sunat = CONCAT('B001-', @correlativo),
              id_orden_generada = @idOrd,
              fecha_conversion = SYSDATETIME()
          WHERE id_persona = @idPersona AND estado_recuperacion <> 'CONVERTIDO_PAYER';

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

  if (waStatus.state === 'CONNECTED' && ev.leadPhone) {
    const receiptMsg =
      `✅ *PAGO CONFIRMADO — POLUX IMPORTS PERÚ*\n\n` +
      `¡Gracias *${ev.leadFirstName}*! Tu pago por *${fmtMoney(amount)}* (${method}) ha sido validado.\n` +
      `🧾 *Comprobante SUNAT:* ${receiptNumber}\n` +
      `📦 *Orden Activada:* ${orderCode} (${ev.productName})\n` +
      `📍 Tu equipo queda listo para entrega/recojo en Av. Larco 840, Trujillo.`;
    await sendRealWhatsAppMessage(ev.leadPhone, null, receiptMsg);
    if (!Array.isArray(ev.conversation)) ev.conversation = [];
    ev.conversation.push({ from: 'AGENT', action: 'PAYMENT_RECEIPT', text: receiptMsg, at: new Date().toISOString() });
  }

  saveState();
  return ev;
}

// ----------------------------------------------------------------------------
// 8. ENDPOINTS DE API
// ----------------------------------------------------------------------------
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    service: 'polux-retargeting-agent',
    whatsappState: waStatus.state,
    smtpMode: mailAccountInfo.mode,
    sqlServerConnected: sqlConnected,
    activeSessions: activeSessions.size
  });
});

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
          SELECT TOP 25
            r.id_retargeting, r.id_persona, p.nombres, p.apellidos, p.etapa_actual,
            r.nombre_producto, r.precio_producto_pen, r.segundos_permanencia,
            r.rango_detectado, r.canal_accion, r.probabilidad_compra,
            r.estado_recuperacion, r.monto_pagado_pen, r.comprobante_sunat,
            r.fecha_abandono, r.fecha_conversion
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

  const sessionsList = Array.from(activeSessions.values()).map(s => {
    const product = findProduct(s.productSlug || s.productName);
    const analysis = calculateIntentAnalysis(s.secondsViewed, s.interactions, product);
    return { ...s, analysis };
  });

  res.json({
    ok: true,
    whatsapp: waStatus,
    smtp: mailAccountInfo,
    sqlServerConnected: sqlConnected,
    config: {
      ...appState.config,
      smtpPassConfigured: Boolean(runtimeSmtpPass || process.env.SMTP_PASS)
    },
    catalog: CATALOG,
    leads: appState.leads,
    activeSessions: sessionsList,
    events: appState.events,
    dbAnalytics,
    kpis: {
      totalAbandonments: totalEvents,
      convertedToPayer: converted,
      conversionRate: totalEvents > 0 ? Math.round((converted / totalEvents) * 100) : 0,
      recoveredRevenuePen: recoveredRevenue,
      byEmail: appState.events.filter(e => e.channel === 'CORREO_HTML').length,
      byWhatsapp: appState.events.filter(e => e.channel === 'WHATSAPP_DIRECTO').length,
      byAdvisor: appState.events.filter(e => e.channel === 'ALERTA_ASESOR_LLAMADA').length,
      pendingAdvisorCalls: appState.events.filter(e => e.channel === 'ALERTA_ASESOR_LLAMADA' && !e.advisorClaimedAt && e.status !== 'CONVERTIDO_PAYER').length
    }
  });
});

// Telemetría en vivo desde /landing
app.post('/api/telemetry/heartbeat', (req, res) => {
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (_) { body = {}; }
  }
  const sessionId = body.sessionId || `sess-${Date.now()}`;
  const prev = activeSessions.get(sessionId);

  activeSessions.set(sessionId, {
    sessionId,
    leadId: body.leadId || 101,
    leadName: (body.leadName || 'Visitante en tienda').trim(),
    phone: (body.phone || '').trim(),
    email: (body.email || '').trim(),
    productName: body.productName || 'iPhone 17 Pro Max 256 GB',
    productSlug: body.productSlug || 'iphone-17-pro-max',
    secondsViewed: Number(body.secondsViewed || 0),
    cartItems: Array.isArray(body.cartItems) ? body.cartItems : prev?.cartItems || [],
    cartTotal: Number(body.cartTotal || prev?.cartTotal || 0),
    focusedProduct: body.focusedProduct || prev?.focusedProduct || null,
    comparedModels: Array.isArray(body.comparedModels) ? body.comparedModels : prev?.comparedModels || [],
    customerLoggedIn: Boolean(body.customerLoggedIn ?? prev?.customerLoggedIn),
    interactions: {
      ...(body.interactions || prev?.interactions || {}),
      cartCount: Array.isArray(body.cartItems) ? body.cartItems.length : (prev?.cartItems?.length || 0),
      comparedCount: Array.isArray(body.comparedModels) ? body.comparedModels.length : (prev?.comparedModels?.length || 0),
    },
    purchased: Boolean(body.purchased || prev?.purchased),
    updatedAt: new Date().toISOString()
  });

  if (body.purchased) {
    activeSessions.delete(sessionId);
    processedSessionIds.add(sessionId);
  }

  res.json({ ok: true });
});

// Abandono inmediato (sendBeacon o disparo manual)
app.post('/api/retargeting/abandon', async (req, res) => {
  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (_) { body = {}; }
    }
    if (body.sessionId) {
      activeSessions.delete(body.sessionId);
      if (!body.bypassCooldown && processedSessionIds.has(body.sessionId)) {
        return res.json({ ok: true, deduplicated: true });
      }
      processedSessionIds.add(body.sessionId);
    }

    const result = await processRealAbandonment(body || {});
    if (result.skippedCooldown) {
      return res.json({ ok: true, skipped: true, reason: result.reason });
    }
    res.json({ ok: true, event: result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Link Mágico de Recuperación: consultar reserva por token
app.get('/api/retargeting/recover/:token', (req, res) => {
  const token = String(req.params.token || '').trim();
  const ev = appState.events.find(e => e.recoverToken === token || String(e.id) === token);
  if (!ev) return res.status(404).json({ ok: false, error: 'Enlace de reserva no encontrado o expirado.' });
  res.json({ ok: true, recovery: ev });
});

// Link Mágico de Recuperación: completar pago desde PoluxPay -> PAYER
app.post('/api/retargeting/recover/:token/complete', async (req, res) => {
  try {
    const token = String(req.params.token || '').trim();
    const ev = appState.events.find(e => e.recoverToken === token || String(e.id) === token);
    if (!ev) return res.status(404).json({ ok: false, error: 'Token de recuperación no encontrado.' });
    const updated = await convertLeadToPayerInDb(ev, req.body || {});
    res.json({ ok: true, event: updated });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Convertir abandono a PAYER directamente por ID
app.post('/api/retargeting/:id/convert', async (req, res) => {
  try {
    const ev = await convertLeadToPayerInDb(req.params.id, req.body || {});
    res.json({ ok: true, event: ev });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Registrar toma de llamada del Asesor (SLA > 10 min)
app.post('/api/retargeting/:id/advisor-claim', async (req, res) => {
  try {
    const ev = appState.events.find(e => Number(e.id) === Number(req.params.id));
    if (!ev) return res.status(404).json({ ok: false, error: 'Evento no encontrado' });

    const now = new Date();
    ev.advisorClaimedAt = now.toISOString();
    ev.slaSeconds = Math.max(1, Math.round((now.getTime() - new Date(ev.createdAt).getTime()) / 1000));

    if (sqlConnected && sqlPool && ev.leadId) {
      await sqlPool.request()
        .input('idPersona', sql.BigInt, ev.leadId)
        .query(`
          UPDATE core.alerta_operativa
          SET estado_alerta = 'ATENDIDA', fecha_atencion = SYSDATETIME()
          WHERE id_persona = @idPersona AND codigo_tipo_alerta = 'ABANDONO_ALTA_INTENCION_MAS_10M' AND estado_alerta = 'ACTIVA';
        `).catch(() => {});
    }

    saveState();
    res.json({ ok: true, event: ev });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Actualizar configuración de asesor, SMTP y umbrales de reglas
app.post('/api/config', async (req, res) => {
  try {
    const b = req.body || {};
    if (b.advisorName !== undefined) appState.config.advisorName = b.advisorName;
    if (b.advisorPhone !== undefined) appState.config.advisorPhone = b.advisorPhone;
    if (b.advisorEmail !== undefined) appState.config.advisorEmail = b.advisorEmail;
    if (b.poluxStoreUrl !== undefined) appState.config.poluxStoreUrl = b.poluxStoreUrl;
    if (b.smtpUser !== undefined) appState.config.smtpUser = b.smtpUser.trim();
    if (b.smtpPass !== undefined && b.smtpPass.trim() && b.smtpPass !== '********') {
      runtimeSmtpPass = b.smtpPass.trim();
    }
    if (b.emailMaxSeconds !== undefined) appState.config.emailMaxSeconds = Math.max(30, Number(b.emailMaxSeconds));
    if (b.whatsappMaxSeconds !== undefined) appState.config.whatsappMaxSeconds = Math.max(60, Number(b.whatsappMaxSeconds));
    if (b.abandonTimeoutSeconds !== undefined) appState.config.abandonTimeoutSeconds = Math.max(10, Number(b.abandonTimeoutSeconds));
    if (b.cooldownMinutes !== undefined) appState.config.cooldownMinutes = Math.max(0, Number(b.cooldownMinutes));

    saveState();
    await initMailer();
    res.json({ ok: true, smtp: mailAccountInfo, config: appState.config });
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

// Iniciar sistema
(async () => {
  await syncCatalogFromStorefront();
  setInterval(() => { syncCatalogFromStorefront().catch(() => {}); }, 60000);
  await initMailer();
  await initSqlConnection();
  await initWhatsAppClient();
  startAbandonmentSweeper();

  app.listen(PORT, '0.0.0.0', () => {
    console.log('============================================================================');
    console.log(`🚀 POLUX RETARGETING AGENT EN: http://localhost:${PORT}`);
    console.log(`   - Tienda Polux configurada: ${appState.config.poluxStoreUrl}`);
    console.log(`   - SMTP: ${mailAccountInfo.mode} (${mailAccountInfo.user})`);
    console.log(`   - Sweeper autónomo activo (timeout: ${appState.config.abandonTimeoutSeconds}s)`);
    console.log('============================================================================');
  });
})();
