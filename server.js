/**
 * ============================================================================
 * SISTEMA AUTÓNOMO DE RETARGETING Y RECUPERACIÓN DE ABANDONO (FASE LEAD -> PAYER)
 * Proyecto General: Polux Imports S.A.C. (Integración Dual con PoluxImportDB)
 * Autores de Investigación: Diego & Ronaldo
 * ============================================================================
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const sql = require('mssql');
const nodemailer = require('nodemailer');

const app = express();
const PORT = Number(process.env.PORT || 4000);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ----------------------------------------------------------------------------
// 1. CATÁLOGO OFICIAL DE PRODUCTOS APPLE (CON IMÁGENES DE ALTA CALIDAD)
// ----------------------------------------------------------------------------
const CATALOG = [
  {
    id: 1,
    sku: 'APL-IP16PM-256-TN',
    name: 'iPhone 16 Pro Max 256 GB',
    shortName: 'iPhone 16 Pro Max',
    category: 'iPhone',
    color: 'Titanio Natural',
    capacity: '256 GB',
    price: 6599.00,
    originalPrice: 7299.00,
    installment3: 2199.67,
    stockTrujillo: 4,
    image: 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?auto=format&fit=crop&w=900&q=85',
    badge: 'MÁS BUSCADO EN TRUJILLO',
    specs: ['Chip A18 Pro de 3nm', 'Cámara Fusion 48 MP + Zoom 5x', 'Chasis de Titanio Grado 5', 'Caja sellada Apple USA · Garantía 1 año']
  },
  {
    id: 2,
    sku: 'APL-IP16-128-ULT',
    name: 'iPhone 16 128 GB',
    shortName: 'iPhone 16',
    category: 'iPhone',
    color: 'Azul Ultramarino',
    capacity: '128 GB',
    price: 4299.00,
    originalPrice: 4799.00,
    installment3: 1433.00,
    stockTrujillo: 6,
    image: 'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?auto=format&fit=crop&w=900&q=85',
    badge: 'OFERTA UNIVERSITARIA UNT',
    specs: ['Chip A18 con Apple Intelligence', 'Control de Cámara táctil', 'Pantalla Super Retina XDR 6.1"', 'Importación Directa Miami -> Trujillo']
  },
  {
    id: 3,
    sku: 'APL-MBA-M4-13',
    name: 'MacBook Air 13" Chip M4 (16GB / 512GB)',
    shortName: 'MacBook Air M4',
    category: 'Mac',
    color: 'Medianoche',
    capacity: '512 GB SSD',
    price: 5499.00,
    originalPrice: 6199.00,
    installment3: 1833.00,
    stockTrujillo: 3,
    image: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=900&q=85',
    badge: 'IDEAL INGENIERÍA & ARQUITECTURA',
    specs: ['Nuevo Chip Apple M4 de 10 núcleos', '16 GB de memoria unificada', 'Hasta 18 horas de batería', 'MagSafe 3 + Teclado en Español']
  },
  {
    id: 4,
    sku: 'APL-APP2-USBC',
    name: 'AirPods Pro 2da Generación (USB-C MagSafe)',
    shortName: 'AirPods Pro 2',
    category: 'AirPods',
    color: 'Blanco',
    capacity: 'Estuche MagSafe USB-C',
    price: 1099.00,
    originalPrice: 1299.00,
    installment3: 366.33,
    stockTrujillo: 9,
    image: 'https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?auto=format&fit=crop&w=900&q=85',
    badge: 'ENTREGA INMEDIATA AV. LARCO',
    specs: ['Cancelación Activa de Ruido 2x', 'Audio Espacial Personalizado', 'Chip H2 de alta fidelidad', 'Serie verificable en checkcoverage.apple.com']
  },
  {
    id: 5,
    sku: 'APL-AWS10-46',
    name: 'Apple Watch Series 10 GPS 46mm',
    shortName: 'Apple Watch Series 10',
    category: 'Watch',
    color: 'Negro Azabache',
    capacity: '46 mm',
    price: 2199.00,
    originalPrice: 2499.00,
    installment3: 733.00,
    stockTrujillo: 5,
    image: 'https://images.unsplash.com/photo-1546868871-7041f2a55e12?auto=format&fit=crop&w=900&q=85',
    badge: 'DISEÑO ULTRA DELGADO',
    specs: ['Pantalla OLED gran angular más grande', 'Sensores de ECG y Apnea del sueño', 'Carga rápida 80% en 30 min', 'Póliza Polux Care 365 días']
  },
  {
    id: 6,
    sku: 'APL-IPADAIR-M3',
    name: 'iPad Air 11" Chip M3 256 GB Wi-Fi',
    shortName: 'iPad Air M3',
    category: 'iPad',
    color: 'Gris Espacial',
    capacity: '256 GB',
    price: 3199.00,
    originalPrice: 3599.00,
    installment3: 1066.33,
    stockTrujillo: 4,
    image: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?auto=format&fit=crop&w=900&q=85',
    badge: 'COMPATIBLE APPLE PENCIL PRO',
    specs: ['Chip Apple M3 de alto rendimiento', 'Pantalla Liquid Retina 11"', 'Cámara frontal horizontal 12 MP', 'Garantía Oficial Apple 1 año']
  }
];

// ----------------------------------------------------------------------------
// 2. ESTADO LOCAL & PERSISTENCIA JSON (SINCRONIZADO CON SQL SERVER)
// ----------------------------------------------------------------------------
const DATA_FILE = path.join(__dirname, 'retargeting_state.json');

const DEFAULT_LEADS = [
  {
    id: 101,
    firstName: 'Ronaldo',
    lastName: 'Robles Romero',
    documentNumber: '74892103',
    email: 'ronaldo.robles@unitru.edu.pe',
    phone: '+51 944 820 915',
    district: 'Víctor Larco Herrera',
    university: 'Universidad Nacional de Trujillo (UNT)',
    occupation: 'Ingeniería de Sistemas · 8vo Ciclo',
    company: 'Proyecto BI Polux Imports',
    monthlyIncome: 3800,
    stage: 'LEAD',
    priority: 'ALTA',
    score: 84,
    preferredProductId: 1,
    preferredPayment: 'YAPE'
  },
  {
    id: 1,
    firstName: 'Diego',
    lastName: 'Ramírez Cuba',
    documentNumber: '72849102',
    email: 'diego.ramirez@unitru.edu.pe',
    phone: '+51 944 620 118',
    district: 'Trujillo Centro',
    university: 'Universidad Nacional de Trujillo (UNT)',
    occupation: 'Desarrollador Full-Stack / Sistemas',
    company: 'TechNova SAC',
    monthlyIncome: 4500,
    stage: 'LEAD',
    priority: 'ALTA',
    score: 88,
    preferredProductId: 1,
    preferredPayment: 'YAPE'
  },
  {
    id: 2,
    firstName: 'Valeria',
    lastName: 'Mendoza García',
    documentNumber: '71938421',
    email: 'valeria.mendoza@upao.edu.pe',
    phone: '+51 948 310 552',
    district: 'Urbanización California, Víctor Larco',
    university: 'Universidad Privada Antenor Orrego (UPAO)',
    occupation: 'Arquitecta Junior',
    company: 'Estudio Norte Arquitectos',
    monthlyIncome: 5200,
    stage: 'LEAD',
    priority: 'ALTA',
    score: 81,
    preferredProductId: 3,
    preferredPayment: 'PLIN'
  },
  {
    id: 3,
    firstName: 'Mateo',
    lastName: 'Benites Alcántara',
    documentNumber: '75102938',
    email: 'mateo.benites@gmail.com',
    phone: '+51 951 742 890',
    district: 'Huanchaco',
    university: 'Universidad Nacional de Trujillo (UNT)',
    occupation: 'Médico Residente',
    company: 'Clínica San Pablo Trujillo',
    monthlyIncome: 6100,
    stage: 'LEAD',
    priority: 'MEDIA',
    score: 76,
    preferredProductId: 5,
    preferredPayment: 'TARJETA'
  }
];

function loadState() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      if (raw && Array.isArray(raw.events) && Array.isArray(raw.leads)) {
        return raw;
      }
    }
  } catch (e) {
    console.warn('Iniciando estado limpio:', e.message);
  }
  return { leads: DEFAULT_LEADS, events: [] };
}

function saveState(state) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2), 'utf8');
  } catch (e) {
    console.error('Error guardando estado local:', e.message);
  }
}

let appState = loadState();

// ----------------------------------------------------------------------------
// 3. CONEXIÓN RESILIENTE A SQL SERVER (PoluxImportDB)
// ----------------------------------------------------------------------------
const dbConfig = {
  server: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 1433),
  user: process.env.DB_USER || 'polux_app',
  password: process.env.DB_PASSWORD || 'PoluxDemo_2026!',
  database: process.env.DB_NAME || 'PoluxImportDB',
  options: {
    encrypt: false,
    trustServerCertificate: true
  },
  pool: {
    max: 5,
    min: 0,
    idleTimeoutMillis: 15000
  }
};

let sqlPool = null;
let sqlConnected = false;

async function initSqlConnection() {
  try {
    sqlPool = await sql.connect(dbConfig);
    sqlConnected = true;
    console.log('✅ Conectado exitosamente a SQL Server (PoluxImportDB)');

    // Asegurar que exista el agente y la tabla de retargeting
    await sqlPool.request().query(`
      IF NOT EXISTS (SELECT 1 FROM core.agente_ia WHERE codigo_agente = 'AGT_RETARGETING_LP')
      BEGIN
        INSERT INTO core.agente_ia (codigo_agente, nombre_agente, rol_operativo, fase_principal, requiere_aprobacion_humana, es_activo)
        VALUES ('AGT_RETARGETING_LP', N'Agente de Recuperación de Abandono (Lead -> Payer)', N'Monitorea permanencia en tienda y dispara Correo (<5m), WhatsApp (5-10m) o Alerta Asesor (>10m).', 'LEADS', 0, 1);
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

    // Asegurar que Ronaldo Robles exista en PoluxImportDB
    const ronaldoCheck = await sqlPool.request().query(`
      SELECT TOP 1 id_persona, nombres, apellidos, correo_electronico, telefono_movil, ciudad, etapa_actual
      FROM core.persona WHERE nombres LIKE N'%Ronaldo%' AND apellidos LIKE N'%Robles%';
    `);

    if (ronaldoCheck.recordset.length === 0) {
      await sqlPool.request().query(`
        DECLARE @cod CHAR(6) = RIGHT('000000' + CAST((NEXT VALUE FOR core.seq_codigo_cliente) AS VARCHAR(10)), 6);
        DECLARE @newId TABLE (id_persona BIGINT);
        INSERT INTO core.persona
          (codigo_cliente, tipo_documento, numero_documento, nombres, apellidos, correo_electronico,
           telefono_movil, ciudad, pais, rol_compra_principal, consentimiento_datos, fecha_consentimiento,
           ip_consentimiento, version_politica_privacidad, etapa_actual, estado_registro)
        OUTPUT INSERTED.id_persona INTO @newId
        VALUES
          (@cod, 'DNI', '74892103', N'Ronaldo', N'Robles Romero', N'ronaldo.robles@unitru.edu.pe',
           '+51 944 820 915', N'Víctor Larco Herrera', N'Perú', 'USUARIO_FINAL', 1, SYSDATETIME(),
           '190.236.44.101', 'v1.0', 'LEADS', 'ACTIVO');
        DECLARE @idR BIGINT = (SELECT TOP 1 id_persona FROM @newId);
        INSERT INTO leads.lead (id_persona, estado_lead, canal_conversion, prioridad_comercial, nivel_intencion_actual)
        VALUES (@idR, 'ACTIVO', 'WHATSAPP', 'ALTA', 'ALTA');
      `);
    }

    await syncLeadsFromSql();
  } catch (err) {
    sqlConnected = false;
    console.warn('⚠️ SQL Server local no detectado o en espera. Operando en modo autónomo con sincronización diferida:', err.message);
  }
}

async function syncLeadsFromSql() {
  if (!sqlConnected || !sqlPool) return;
  try {
    const res = await sqlPool.request().query(`
      SELECT TOP 20
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
        AND (p.nombres LIKE N'%Ronaldo%' OR p.id_persona <= 12 OR p.etapa_actual IN ('LEADS', 'BUYER', 'PAYER'))
      ORDER BY CASE WHEN p.nombres LIKE N'%Ronaldo%' THEN 0 WHEN p.id_persona <= 6 THEN 1 ELSE 2 END, p.id_persona ASC;
    `);

    if (res.recordset && res.recordset.length > 0) {
      const dbLeads = res.recordset.map((r, idx) => ({
        id: Number(r.id_persona),
        firstName: r.nombres,
        lastName: r.apellidos || 'Trujillo',
        documentNumber: r.numero_documento || String(72000000 + Number(r.id_persona)),
        email: r.correo_electronico || `cliente.${r.id_persona}@unitru.edu.pe`,
        phone: r.telefono_movil || '+51 944 820 915',
        district: r.ciudad || 'Víctor Larco Herrera',
        university: idx % 2 === 0 ? 'Universidad Nacional de Trujillo (UNT)' : 'Universidad Privada Antenor Orrego (UPAO)',
        occupation: r.nombres.toLowerCase().includes('ronaldo')
          ? 'Ingeniería de Sistemas · UNT'
          : idx % 2 === 0
          ? 'Ingeniero de Sistemas / Ejecutivo'
          : 'Profesional Independiente',
        company: 'Polux Imports / Trujillo',
        monthlyIncome: 3800 + (idx % 4) * 650,
        stage: r.etapa_actual === 'LEADS' ? 'LEAD' : r.etapa_actual,
        priority: r.prioridad_comercial || 'ALTA',
        score: 82 + (idx % 14),
        preferredProductId: (idx % CATALOG.length) + 1,
        preferredPayment: 'YAPE'
      }));

      // Asegurar que Ronaldo esté primero en la lista para la demo
      const hasRonaldo = dbLeads.some(l => l.firstName.toLowerCase().includes('ronaldo'));
      if (!hasRonaldo) {
        dbLeads.unshift(DEFAULT_LEADS[0]);
      }
      appState.leads = dbLeads.slice(0, 12);
      saveState(appState);
    }
  } catch (e) {
    console.warn('Error leyendo leads de SQL Server:', e.message);
  }
}

// ----------------------------------------------------------------------------
// 4. TRANSPORTE DE CORREO REAL Y GRATUITO (NODEMAILER + ETHEREAL / GMAIL)
// ----------------------------------------------------------------------------
let mailTransporter = null;
let mailAccountInfo = { mode: 'INITIALIZING', user: '' };

async function initMailer() {
  try {
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      mailTransporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });
      mailAccountInfo = { mode: 'GMAIL_SMTP', user: process.env.SMTP_USER };
      console.log(`📧 SMTP Real configurado con Gmail (${process.env.SMTP_USER})`);
      return;
    }

    // Crear cuenta SMTP gratuita instantánea en Ethereal Email
    const testAccount = await nodemailer.createTestAccount();
    mailTransporter = nodemailer.createTransport({
      host: testAccount.smtp.host,
      port: testAccount.smtp.port,
      secure: testAccount.smtp.secure,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass
      }
    });
    mailAccountInfo = { mode: 'ETHEREAL_FREE_SMTP', user: testAccount.user };
    console.log(`📧 Servidor SMTP Gratuito Ethereal activo (${testAccount.user})`);
  } catch (e) {
    mailAccountInfo = { mode: 'LOCAL_HTML_ENGINE', user: 'notificaciones@poluximports.pe' };
    console.warn('⚠️ Operando con motor de renderizado de correo HTML local:', e.message);
  }
}

function buildAbandonedCartEmailHtml(lead, product, secondsViewed) {
  const mins = Math.max(1, Math.round(secondsViewed / 60));
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
          <!-- Cabecera oscura estilo captura Hush Puppies -->
          <tr>
            <td style="background-color:#0f172a;padding:18px 28px;color:#ffffff;">
              <div style="font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;">Polux Imports Perú · Tienda Oficial Trujillo</div>
              <div style="font-size:20px;font-weight:800;margin-top:4px;">No abandones tu carrito 👀</div>
            </td>
          </tr>
          <!-- Cuerpo blanco minimalista idéntico a la captura de Ronaldo -->
          <tr>
            <td align="center" style="padding:36px 32px 20px 32px;text-align:center;">
              <div style="display:inline-flex;align-items:center;gap:10px;margin-bottom:18px;">
                <span style="font-size:32px;">🍎</span>
                <span style="font-size:26px;font-weight:800;letter-spacing:-0.5px;color:#0f172a;">Polux Imports</span>
              </div>

              <h2 style="font-size:22px;font-weight:500;color:#111827;margin:10px 0 18px 0;">
                <strong>Hola,</strong> ${firstNameUpper}
              </h2>

              <p style="font-size:16px;line-height:1.5;color:#374151;margin:0 0 14px 0;">
                Vimos que te fuiste sin finalizar tu compra 😔
              </p>

              <p style="font-size:16px;line-height:1.5;color:#374151;margin:0 0 16px 0;">
                No queremos que te quedes sin tu <strong>${product.name}</strong> (${product.color}) favorito.
              </p>

              <p style="font-size:16px;font-weight:600;color:#111827;margin:0 0 24px 0;">
                ¡Tu carrito sigue esperando! No lo abandones 🐾✨
              </p>

              <!-- Imagen grande del producto revisado -->
              <div style="background:#f8fafc;border-radius:16px;padding:20px;margin-bottom:24px;border:1px solid #e2e8f0;">
                <img src="${product.image}" alt="${product.name}" style="max-width:340px;width:100%;height:220px;object-fit:cover;border-radius:12px;display:block;margin:0 auto 16px auto;" />
                <div style="font-size:18px;font-weight:700;color:#0f172a;">${product.name}</div>
                <div style="font-size:13px;color:#64748b;margin-top:4px;">Color: ${product.color} · Garantía Oficial Apple 1 Año en Trujillo</div>
                <div style="font-size:22px;font-weight:800;color:#2563eb;margin-top:10px;">
                  ${formattedPrice} <span style="font-size:13px;font-weight:500;color:#475569;">o 3 cuotas sin interés de ${formattedInstallment}</span>
                </div>
              </div>

              <a href="http://localhost:${PORT}?recover=email&leadId=${lead.id}&productId=${product.id}"
                 style="display:inline-block;background-color:#10b981;color:#ffffff;font-weight:700;font-size:16px;text-decoration:none;padding:15px 36px;border-radius:999px;box-shadow:0 6px 18px rgba(16,185,129,0.35);">
                Finalizar mi compra ahora →
              </a>

              <p style="font-size:12px;color:#94a3b8;margin-top:24px;">
                Tiempo de visita detectado por Agente Polux: ${mins} min (${secondsViewed} seg) · Sede Av. Larco 840, Víctor Larco, Trujillo.
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
// 5. MOTOR DE REGLAS DEL AGENTE DE RETARGETING (POR TIEMPO DE PERMANENCIA)
// ----------------------------------------------------------------------------
async function evaluateAbandonmentSession({ leadId, productId, secondsViewed, exitReason }) {
  const lead = appState.leads.find(l => Number(l.id) === Number(leadId)) || appState.leads[0];
  const product = CATALOG.find(p => Number(p.id) === Number(productId)) || CATALOG[0];
  const secs = Math.max(5, Number(secondsViewed || 120));
  const minsFormatted = (secs / 60).toFixed(1);
  const mm = String(Math.floor(secs / 60)).padStart(2, '0');
  const ss = String(secs % 60).padStart(2, '0');
  const durationLabel = `${mm}:${ss} min (${secs} seg)`;

  const firstNameUpper = (lead.firstName || 'RONALDO').toUpperCase();
  const formattedPrice = `S/ ${Number(product.price).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`;
  const cuota3 = `S/ ${Number(product.installment3).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`;

  let tier = '';
  let channel = '';
  let intentLevel = '';
  let probability = 0;
  let headline = '';
  let messageBody = '';
  let advisorScript = null;
  let emailHtml = null;
  let emailPreviewUrl = null;
  let whatsappPayload = null;
  let advisorAlert = null;

  // ==========================================================================
  // REGLA 1: MENOS DE 5 MINUTOS (< 300 segundos) -> ENVIAR CORREO HTML
  // ==========================================================================
  if (secs < 300) {
    tier = 'MENOR_5_MIN';
    channel = 'CORREO_HTML';
    intentLevel = 'EXPLORATORIA';
    probability = Math.min(48, Math.max(25, Math.round(22 + (secs / 300) * 25)));
    headline = `No abandones tu carrito 👀 — Hola, ${firstNameUpper}`;
    messageBody = `Hola, ${firstNameUpper}. Vimos que te fuiste sin finalizar tu compra 😔 No queremos que te quedes sin tus Polux Apple favoritos (${product.name}). ¡Tu carrito sigue esperando! No lo abandones 🐾`;
    emailHtml = buildAbandonedCartEmailHtml(lead, product, secs);

    // Enviar correo real si el transporter SMTP está listo
    if (mailTransporter) {
      try {
        const info = await mailTransporter.sendMail({
          from: '"Polux Imports Perú 🍎" <tienda@poluximports.pe>',
          to: lead.email || 'ronaldo.robles@unitru.edu.pe',
          subject: 'No abandones tu carrito👀',
          html: emailHtml
        });
        const preview = nodemailer.getTestMessageUrl(info);
        if (preview) emailPreviewUrl = preview;
      } catch (e) {
        console.warn('Aviso envío SMTP:', e.message);
      }
    }
  }
  // ==========================================================================
  // REGLA 2: ENTRE 5 Y 10 MINUTOS (300 a 600 segundos) -> WHATSAPP DIRECTO
  // ==========================================================================
  else if (secs >= 300 && secs <= 600) {
    tier = 'ENTRE_5_Y_10_MIN';
    channel = 'WHATSAPP_DIRECTO';
    intentLevel = 'COMPRA_POSIBLE';
    probability = Math.min(84, Math.max(65, Math.round(62 + ((secs - 300) / 300) * 22)));
    headline = `WhatsApp Business Directo a ${lead.firstName} (${durationLabel})`;
    messageBody = `Hola ${firstNameUpper} 🐾🐶 ¿Tuviste alguna duda con la capacidad (${product.capacity}), el color (${product.color}) o los métodos de pago en cuotas? No te preocupes, estamos aquí para ayudarte. Tu ${product.name} (${formattedPrice} o 3 cuotas sin interés de ${cuota3}) tiene stock reservado en nuestra sede de Av. Larco 840, Trujillo.`;

    const cleanPhone = (lead.phone || '+51944820915').replace(/[^0-9]/g, '');
    const waText = `Hola ${firstNameUpper} 🐾 ¿Tuviste alguna duda con la capacidad (${product.capacity}), el color (${product.color}) o los métodos de pago de tu ${product.name}? No te preocupes, estamos aquí para ayudarte. Sepáralo hoy con Yape/Plin en Polux Imports Trujillo (${formattedPrice}). 👉 Comprar ahora!`;

    whatsappPayload = {
      businessName: 'Polux Imports Perú',
      verified: true,
      recipientName: firstNameUpper,
      recipientPhone: lead.phone,
      productImage: product.image,
      productName: product.name,
      productPrice: formattedPrice,
      shortDomain: 'l.polux.pe/checkout',
      bubbleText: `Hola ${firstNameUpper} 🐾🐶 ¿Tuviste alguna duda con la capacidad, el color o los métodos de pago? No te preocupes, estamos aquí para ayudarte.`,
      ctaButtonText: 'Comprar ahora!',
      quickReplyText: 'No, gracias',
      waMeUrl: `https://wa.me/${cleanPhone}?text=${encodeURIComponent(waText)}`
    };
  }
  // ==========================================================================
  // REGLA 3: MÁS DE 10 MINUTOS (> 600 segundos) -> ALERTA A ASESOR + LLAMADA
  // ==========================================================================
  else {
    tier = 'MAYOR_10_MIN';
    channel = 'ALERTA_ASESOR_LLAMADA';
    intentLevel = 'COMPRA_MUY_POSIBLE';
    probability = Math.min(98, Math.max(88, Math.round(88 + Math.min(10, (secs - 600) / 60))));
    headline = `🚨 ALERTA CRÍTICA A ASESOR: Llamar de inmediato a ${lead.firstName} ${lead.lastName} (>10 min en tienda)`;
    messageBody = `El cliente ${lead.firstName} ${lead.lastName} permaneció ${durationLabel} analizando ${product.name} (${formattedPrice}) y salió sin completar el pago. Compra MUY MUY POSIBLE (${probability}% prob.). Se activó la alerta prioritaria para llamada inmediata del Asesor Comercial.`;

    advisorScript = {
      advisorName: 'Asesor Senior Polux (Sede Av. Larco 840)',
      urgencyBadge: 'LLAMADA OBLIGATORIA EN < 2 MINUTOS',
      opening: `¡Hola ${lead.firstName}! Te saluda Diego del equipo de especialistas de Polux Imports en Trujillo. Notamos que estuviste revisando a detalle el ${product.name} en color ${product.color} y queríamos asegurarnos de que no hayas tenido ningún inconveniente con la pasarela.`,
      keyArguments: [
        `Confirmarle que tenemos ${product.stockTrujillo} unidades selladas de fábrica con serie verificable en Apple.com.`,
        `Ofrecerle fraccionamiento inmediato en 3 cuotas sin intereses de ${cuota3} (1ra cuota hoy por Yape/Plin y saldo al recoger en Av. Larco 840).`,
        `Por haber estado evaluando su compra hoy, activar gratis el Pack de Cortesía (Cargador Original Apple 20W + Mica Spigen 9H + Póliza Polux Care 365 días).`
      ],
      closingQuestion: `¿Te gustaría que te genere el código QR de PoluxPay por WhatsApp ahora mismo para dejar reservado tu ${product.shortName} con tu DNI ${lead.documentNumber}?`
    };

    advisorAlert = {
      alertId: `ALT-${Date.now().toString().slice(-5)}`,
      priority: 'URGENTE',
      soundRequired: true,
      leadName: `${lead.firstName} ${lead.lastName}`,
      leadPhone: lead.phone,
      leadDistrict: lead.district,
      productName: product.name,
      productPrice: formattedPrice,
      dwellTime: durationLabel,
      probability
    };
  }

  const newEvent = {
    id: Date.now(),
    leadId: lead.id,
    leadName: `${lead.firstName} ${lead.lastName}`,
    leadFirstName: lead.firstName,
    leadEmail: lead.email,
    leadPhone: lead.phone,
    leadDistrict: lead.district,
    leadStageBefore: lead.stage || 'LEAD',
    leadStageCurrent: lead.stage || 'LEAD',
    productId: product.id,
    productName: product.name,
    productColor: product.color,
    productImage: product.image,
    productPrice: product.price,
    secondsViewed: secs,
    durationLabel,
    minsFormatted: Number(minsFormatted),
    exitReason: exitReason || 'SALIDA_DE_PAGINA_SIN_COMPRAR',
    tier,
    channel,
    intentLevel,
    probability,
    headline,
    messageBody,
    emailHtml,
    emailPreviewUrl,
    whatsappPayload,
    advisorScript,
    advisorAlert,
    status: tier === 'MAYOR_10_MIN' ? 'ALERTA_ASESOR_ACTIVA' : 'MENSAJE_ENVIADO',
    paymentInfo: null,
    createdAt: new Date().toISOString()
  };

  // Registrar también en SQL Server (PoluxImportDB) si está disponible
  if (sqlConnected && sqlPool) {
    try {
      const insertReq = await sqlPool.request()
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

      if (insertReq.recordset?.[0]?.id_retargeting) {
        newEvent.sqlRetargetingId = Number(insertReq.recordset[0].id_retargeting);
      }

      // Registrar en core.accion_agente para que aparezca también en el ERP Polux
      await sqlPool.request()
        .input('idPersona', sql.BigInt, lead.id)
        .input('decision', sql.NVarChar(sql.MAX), `[RETARGETING ${tier}] ${headline} -> ${messageBody}`)
        .input('sustento', sql.NVarChar(sql.MAX), JSON.stringify({
          segundosPermanencia: secs,
          rango: tier,
          canalDisparado: channel,
          probabilidadCompra: probability,
          producto: product.name
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

      // Si es > 10 min, insertar además en core.alerta_operativa para el asesor
      if (tier === 'MAYOR_10_MIN') {
        await sqlPool.request()
          .input('idPersona', sql.BigInt, lead.id)
          .input('accion', sql.NVarChar(300), `LLAMADA INMEDIATA DE ASESOR: ${lead.firstName} ${lead.lastName} estuvo ${durationLabel} viendo ${product.name} y salió de la página (${probability}% prob. de compra).`)
          .query(`
            INSERT INTO core.alerta_operativa
              (fase, codigo_tipo_alerta, id_persona, id_entidad_referencia, tipo_entidad_referencia, accion_recomendada, rol_responsable, estado_alerta)
            VALUES
              ('LEADS', 'ABANDONO_ALTA_INTENCION_MAS_10M', @idPersona, @idPersona, 'persona', @accion, 'COMERCIAL', 'ACTIVA');
          `);
      }
    } catch (sqlErr) {
      console.warn('Aviso registro SQL en evaluación de abandono:', sqlErr.message);
    }
  }

  appState.events.unshift(newEvent);
  appState.events = appState.events.slice(0, 50);
  saveState(appState);

  return newEvent;
}

// ----------------------------------------------------------------------------
// 6. CONVERSIÓN DE LEAD A PAYER (PASARELA POLUXPAY + BOLETA SUNAT + SQL SERVER)
// ----------------------------------------------------------------------------
async function convertEventToPayer(eventId, paymentDto) {
  const ev = appState.events.find(e => Number(e.id) === Number(eventId)) || appState.events[0];
  if (!ev) throw new Error('Evento de retargeting no encontrado.');

  const lead = appState.leads.find(l => Number(l.id) === Number(ev.leadId)) || appState.leads[0];
  const method = (paymentDto.paymentMethod || 'YAPE').toUpperCase();
  const amount = Number(paymentDto.amount || ev.productPrice || 6599);
  const opCode = paymentDto.operationCode || `PLX-${method}-${Date.now().toString().slice(-6)}`;
  const receiptNumber = `B001-${String(Math.floor(100000 + Math.random() * 899999))}`;
  const orderCode = `ORD-2026-${String(lead.id).padStart(4, '0')}-${Math.floor(10 + Math.random() * 89)}`;

  // Actualizar en memoria / JSON
  lead.stage = 'PAYER';
  ev.leadStageCurrent = 'PAYER';
  ev.status = 'CONVERTIDO_PAYER';
  ev.convertedAt = new Date().toISOString();
  ev.paymentInfo = {
    paymentMethod: method,
    amount,
    operationCode: opCode,
    receiptNumber,
    orderCode,
    convertedViaChannel: ev.channel,
    igv: Number((amount - amount / 1.18).toFixed(2)),
    subtotal: Number((amount / 1.18).toFixed(2)),
    paidAt: new Date().toISOString()
  };

  // Sincronizar la transición LEAD -> PAYER en SQL Server (PoluxImportDB)
  if (sqlConnected && sqlPool) {
    try {
      await sqlPool.request()
        .input('idPersona', sql.BigInt, lead.id)
        .input('monto', sql.Decimal(12, 2), amount)
        .input('medioPago', sql.VarChar(30), method === 'CARD' ? 'TARJETA' : method)
        .input('opCode', sql.VarChar(60), opCode)
        .input('numOrden', sql.VarChar(30), orderCode)
        .input('canalRecuperacion', sql.VarChar(40), ev.channel)
        .input('docCliente', sql.VarChar(20), lead.documentNumber || '74892103')
        .input('nombreCliente', sql.NVarChar(150), `${lead.firstName} ${lead.lastName}`)
        .query(`
          -- 1. Promover persona a PAYER y cerrar Lead como CONVERTIDO
          UPDATE core.persona SET etapa_actual = 'PAYER', fecha_actualizacion = SYSDATETIME() WHERE id_persona = @idPersona;
          UPDATE leads.lead SET estado_lead = 'CONVERTIDO', fecha_cierre = SYSDATETIME() WHERE id_persona = @idPersona;

          -- 2. Asegurar cotización aceptada para cumplir FK de orden_contratacion
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

          -- 3. Asegurar registro en payers.payer
          IF NOT EXISTS (SELECT 1 FROM payers.payer WHERE id_persona = @idPersona)
            INSERT INTO payers.payer (id_persona, estado_payer, total_ordenes_activas) VALUES (@idPersona, 'AL_DIA', 1);
          ELSE
            UPDATE payers.payer SET estado_payer = 'AL_DIA', total_ordenes_activas = total_ordenes_activas + 1 WHERE id_persona = @idPersona;

          -- 4. Crear o actualizar orden en payers.orden_contratacion
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

          -- 5. Registrar pago validado y comprobante SUNAT
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

          INSERT INTO payers.comprobante_electronico
            (id_orden, id_pago, tipo_comprobante, serie, numero_correlativo,
             numero_documento_cliente, nombre_razon_social, subtotal_gravado_pen, igv_pen,
             total_comprobante_pen, estado_emision, hash_cpe)
          VALUES
            (@idOrd, @idPago, 'BOLETA', 'B001', CAST(@idPago AS INT) + 50000,
             @docCliente, @nombreCliente, ROUND(@monto / 1.18, 2), @monto - ROUND(@monto / 1.18, 2),
             @monto, 'EMITIDO', CONCAT('SHA256-SUNAT-RET-', @idPago));

          -- 6. Registrar transición en core.historial_etapa
          INSERT INTO core.historial_etapa
            (id_persona, etapa_anterior, etapa_nueva, motivo_transicion, senal_origen, id_entidad_referencia, tipo_entidad_referencia, registrado_por)
          VALUES
            (@idPersona, 'LEADS', 'PAYER', CONCAT(N'Conversión LEAD -> PAYER recuperada por Agente de Retargeting vía ', @canalRecuperacion), 'PAGO_RETARGETING', @idPago, 'pago', 'AGT_RETARGETING_LP');

          -- 7. Actualizar tabla de retargeting
          UPDATE leads.abandono_carrito_retargeting
          SET estado_recuperacion = 'CONVERTIDO_PAYER',
              medio_pago_conversion = @medioPago,
              monto_pagado_pen = @monto,
              comprobante_sunat = CONCAT('B001-', CAST(@idPago AS INT) + 50000),
              id_orden_generada = @idOrd,
              fecha_conversion = SYSDATETIME()
          WHERE id_persona = @idPersona AND estado_recuperacion <> 'CONVERTIDO_PAYER';
        `);
    } catch (sqlErr) {
      console.warn('Aviso sincronización SQL en conversión a PAYER:', sqlErr.message);
    }
  }

  saveState(appState);
  return { event: ev, lead };
}

// ----------------------------------------------------------------------------
// 7. ENDPOINTS DE LA API REST
// ----------------------------------------------------------------------------
app.get('/api/status', (req, res) => {
  const totalEvents = appState.events.length;
  const converted = appState.events.filter(e => e.status === 'CONVERTIDO_PAYER').length;
  const byEmail = appState.events.filter(e => e.channel === 'CORREO_HTML').length;
  const byWhatsapp = appState.events.filter(e => e.channel === 'WHATSAPP_DIRECTO').length;
  const byAdvisor = appState.events.filter(e => e.channel === 'ALERTA_ASESOR_LLAMADA').length;
  const recoveredRevenue = appState.events
    .filter(e => e.status === 'CONVERTIDO_PAYER')
    .reduce((acc, e) => acc + Number(e.paymentInfo?.amount || e.productPrice || 0), 0);

  res.json({
    ok: true,
    agentCode: 'AGT_RETARGETING_LP',
    agentName: 'Agente de Recuperación de Abandono por Tiempo de Permanencia',
    phase: 'LEAD → PAYER',
    sqlServerConnected: sqlConnected,
    database: dbConfig.database,
    smtpInfo: mailAccountInfo,
    catalog: CATALOG,
    leads: appState.leads,
    events: appState.events,
    kpis: {
      totalAbandonments: totalEvents,
      convertedToPayer: converted,
      conversionRate: totalEvents > 0 ? Math.round((converted / totalEvents) * 100) : 0,
      recoveredRevenuePen: recoveredRevenue,
      byEmail,
      byWhatsapp,
      byAdvisor
    }
  });
});

app.post('/api/leads', async (req, res) => {
  try {
    const b = req.body || {};
    const newLead = {
      id: Date.now() % 100000,
      firstName: (b.firstName || 'Nuevo').trim(),
      lastName: (b.lastName || 'Lead Trujillo').trim(),
      documentNumber: (b.documentNumber || '74892103').trim(),
      email: (b.email || 'cliente@unitru.edu.pe').trim(),
      phone: (b.phone || '+51 944 820 915').trim(),
      district: b.district || 'Víctor Larco Herrera',
      university: b.university || 'Universidad Nacional de Trujillo (UNT)',
      occupation: b.occupation || 'Profesional / Estudiante',
      company: 'Trujillo',
      monthlyIncome: 4200,
      stage: 'LEAD',
      priority: 'ALTA',
      score: 85,
      preferredProductId: Number(b.preferredProductId || 1),
      preferredPayment: 'YAPE'
    };

    if (sqlConnected && sqlPool) {
      try {
        const ins = await sqlPool.request()
          .input('nombres', sql.NVarChar(100), newLead.firstName)
          .input('apellidos', sql.NVarChar(100), newLead.lastName)
          .input('correo', sql.NVarChar(150), newLead.email)
          .input('telefono', sql.VarChar(25), newLead.phone)
          .input('ciudad', sql.NVarChar(80), newLead.district)
          .query(`
            DECLARE @cod CHAR(6) = RIGHT('000000' + CAST((NEXT VALUE FOR core.seq_codigo_cliente) AS VARCHAR(10)), 6);
            DECLARE @t TABLE (id_persona BIGINT);
            INSERT INTO core.persona
              (codigo_cliente, nombres, apellidos, correo_electronico, telefono_movil, ciudad, pais,
               rol_compra_principal, consentimiento_datos, fecha_consentimiento, etapa_actual, estado_registro)
            OUTPUT INSERTED.id_persona INTO @t
            VALUES
              (@cod, @nombres, @apellidos, @correo, @telefono, @ciudad, N'Perú',
               'USUARIO_FINAL', 1, SYSDATETIME(), 'LEADS', 'ACTIVO');
            DECLARE @newId BIGINT = (SELECT TOP 1 id_persona FROM @t);
            INSERT INTO leads.lead (id_persona, estado_lead, canal_conversion, prioridad_comercial, nivel_intencion_actual)
            VALUES (@newId, 'ACTIVO', 'WHATSAPP', 'ALTA', 'ALTA');
            SELECT @newId AS id_persona;
          `);
        if (ins.recordset?.[0]?.id_persona) {
          newLead.id = Number(ins.recordset[0].id_persona);
        }
      } catch (e) {
        console.warn('Aviso creando lead en SQL:', e.message);
      }
    }

    appState.leads.unshift(newLead);
    saveState(appState);
    res.json({ ok: true, lead: newLead });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

app.post('/api/retargeting/abandon', async (req, res) => {
  try {
    const event = await evaluateAbandonmentSession(req.body || {});
    res.json({ ok: true, event });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/retargeting/:id/convert', async (req, res) => {
  try {
    const result = await convertEventToPayer(req.params.id, req.body || {});
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/retargeting/reset-demo', async (req, res) => {
  appState.events = [];
  appState.leads.forEach(l => { l.stage = 'LEAD'; });
  saveState(appState);

  // Generar 3 casos iniciales demostrativos (<5 min, 5-10 min, >10 min) para que el dashboard nunca esté vacío
  await evaluateAbandonmentSession({ leadId: appState.leads[0].id, productId: 1, secondsViewed: 165, exitReason: 'CERRAR_PESTANA' });
  await evaluateAbandonmentSession({ leadId: appState.leads[0].id, productId: 1, secondsViewed: 440, exitReason: 'SALIDA_SIN_FINALIZAR_COMPRA' });
  await evaluateAbandonmentSession({ leadId: appState.leads[1]?.id || appState.leads[0].id, productId: 3, secondsViewed: 685, exitReason: 'DUDA_METODO_PAGO_EN_CHECKOUT' });

  res.json({ ok: true, events: appState.events, leads: appState.leads });
});

// Inicializar servicios y levantar el servidor
(async () => {
  await initMailer();
  await initSqlConnection();

  // Si no hay eventos previos, sembrar los 3 escenarios del mensaje de Ronaldo para demostración inmediata
  if (appState.events.length === 0) {
    await evaluateAbandonmentSession({ leadId: appState.leads[0].id, productId: 1, secondsViewed: 165, exitReason: 'CERRAR_PESTANA' });
    await evaluateAbandonmentSession({ leadId: appState.leads[0].id, productId: 1, secondsViewed: 440, exitReason: 'SALIDA_SIN_FINALIZAR_COMPRA' });
    await evaluateAbandonmentSession({ leadId: appState.leads[1]?.id || appState.leads[0].id, productId: 3, secondsViewed: 685, exitReason: 'DUDA_METODO_PAGO_EN_CHECKOUT' });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log('============================================================================');
    console.log(`🚀 AGENTE DE RETARGETING (LEAD -> PAYER) ACTIVO EN: http://localhost:${PORT}`);
    console.log('   Regla 1 (< 5 min)  -> Correo Electrónico HTML ("No abandones tu carrito 👀")');
    console.log('   Regla 2 (5-10 min) -> WhatsApp Business Directo + Botón "Comprar ahora!"');
    console.log('   Regla 3 (> 10 min) -> Alerta Sonora a Asesor Comercial + Llamada en Vivo');
    console.log('============================================================================');
  });
})();
