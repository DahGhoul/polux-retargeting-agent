# 🍎 Polux Retargeting AI — Agente Autónomo de Conversión LEAD → PAYER

**Proyecto General:** Polux Imports S.A.C. (Metodología IMPULSE · Inteligencia de Negocios UNT)  
**Subgrupo de Investigación (Pareja):** Diego Cuba & Ronaldo Robles Romero  
**Fase Específica:** `LEAD` $\rightarrow$ `PAYER` *(Recuperación de Carrito Abandonado y Retargeting por Tiempo de Permanencia)*

---

## 🎯 ¿Qué hace este Agente?

Cuando un cliente potencial calificado (**Lead**) navega en la tienda de **Polux Imports**, revisa equipos Apple (como el *iPhone 16 Pro Max* o la *MacBook Air M4*) y **sale de la página sin completar la compra**, el agente evalúa automáticamente el **tiempo de permanencia (Dwell Time)** y ejecuta una acción omnicanal escalonada:

1. **⏱️ Menos de 5 minutos (`< 5 min` — Interés Exploratorio):**
   - Dispara automáticamente un **Correo Electrónico HTML** vía SMTP con el asunto `"No abandones tu carrito 👀"`, foto del producto revisado y enlace directo para retomar el pago.
2. **💬 Entre 5 y 10 minutos (`5–10 min` — Compra Posible):**
   - Dispara un **Mensaje de WhatsApp Business Directo** con tarjeta del producto, texto empático (*"Hola [NOMBRE] 🐾🐶 ¿Tuviste alguna duda con la capacidad, el color o los métodos de pago? No te preocupes, estamos aquí para ayudarte"*), enlace `wa.me` real y botón **`Comprar ahora!`** conectado a la pasarela **PoluxPay (Yape/Plin)**.
3. **🚨 Más de 10 minutos (`> 10 min` — Compra Muy Muy Posible):**
   - Activa una **Alerta Sonora y Visual Crítica al Asesor Comercial**, genera el **Guion de Llamada Telefónica con IA** y permite cerrar el pago en vivo durante la llamada.

Al concretarse el pago por cualquiera de las 3 vías, el sistema sincroniza automáticamente con **`PoluxImportDB` (SQL Server 2022)**:
- Cambia `core.persona.etapa_actual` de `'LEADS'` a `'PAYER'`.
- Registra la orden en `payers.orden_contratacion`, el abono en `payers.pago` y emite la **Boleta Electrónica SUNAT (`B001-XXXXXX`)** en `payers.comprobante_electronico`.

---

## 🚀 Cómo Ejecutar el Sistema (2 Opciones)

### Opción A: Ejecución Directa en Windows (1 Clic)
1. Haz doble clic en **`INICIAR_AGENTE_RETARGETING.bat`** (o ejecuta `npm install && npm start`).
2. Abre en tu navegador: **`http://localhost:4000`**

### Opción B: Ejecución con Docker
```bash
docker compose up -d --build
```
El contenedor se levanta en **`http://localhost:4000`** y se conecta automáticamente al SQL Server del host (`host.docker.internal:1433`) o funciona en modo autónomo si SQL Server no está encendido.

---

## 📂 Estructura del Repositorio

- `server.js` — Motor de reglas del Agente IA, servidor SMTP gratuito (Nodemailer/Ethereal) y conector transaccional con `PoluxImportDB`.
- `public/` — Interfaz interactiva Todo-en-Uno (Tienda con sensor de permanencia + Acelerador de tiempo + Mockup de iPhone con WhatsApp y Correo + Central de Llamadas del Asesor + Dashboard BI).
- `sql/10_agente_retargeting_lead_payer.sql` — Script DDL para `PoluxImportDB`.
- `INVESTIGACION_AGENTE_LEAD_A_PAYER_DIEGO_RONALDO.md` — Documento formal de investigación listo para presentar.
- `Dockerfile` & `docker-compose.yml` — Despliegue en contenedores Docker.
