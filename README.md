# 🍎 Polux Retargeting Agent (`AGT_RETARGETING_LP`) — Fase LEAD $\rightarrow$ PAYER

Agente autónomo y **100% funcional** de recuperación de carritos abandonados basado en **Tiempo de Permanencia (*Dwell Time*)**, integrado directamente con la tienda **Polux Imports** (`/landing`) y con **SQL Server (`PoluxImportDB`)**.

**Autores (Subgrupo Fase LEAD $\rightarrow$ PAYER):**
- **Diego Cuba**
- **Ronaldo Robles Romero**

---

## 🧠 Reglas de Negocio Reales del Agente

Cuando un potencial cliente (**LEAD**) entra a la tienda de Polux (`http://localhost:8080/landing`), revisa un producto Apple que podría comprar y **sale de la página por X razones sin completar la compra**, el agente evalúa los segundos exactos de permanencia y actúa automáticamente:

| Regla de Permanencia | Nivel de Intención | Probabilidad | Acción Real Ejecutada por el Agente |
| :--- | :--- | :---: | :--- |
| **Regla 1: `< 5 min`** (`0–299 seg`) | Interés Exploratorio | `25% – 48%` | ✉️ **Envía un Correo HTML Real** (*"No abandones tu carrito 👀"*) vía **Nodemailer** (Gmail SMTP o bandeja Ethereal en vivo) con la foto del equipo y botón de retorno al checkout. |
| **Regla 2: `5 – 10 min`** (`300–600 seg`) | Compra Posible | `65% – 84%` | 💬 **Envía un WhatsApp Real con Foto directo al celular del cliente** vía `@whiskeysockets/baileys`: *"Hola RONALDO 🐾 ¿Tuviste alguna duda con la capacidad, el color o los métodos de pago?..."* + link de compra. |
| **Regla 3: `> 10 min`** (`> 600 seg`) | Compra Muy Muy Posible | `88% – 98%` | 🚨 **Envía Alerta Urgente al WhatsApp del Asesor Comercial** y registra una orden de **Llamada Telefónica Inmediata** en `core.alerta_operativa` para cerrar la venta por teléfono. |

Además, cuando el cliente completa el pago, el agente ejecuta la transacción completa **`LEAD` $\rightarrow$ `PAYER`** en SQL Server (`leads.abandono_carrito_retargeting`, `core.persona`, `payers.orden_contratacion`, `payers.pago`, `payers.comprobante_electronico` y `PoluxImportMart.dbo.DimPersona`).

---

## 💻 Cómo correrlo en Windows (PC) o en Mac

### Opción A: En Windows (PC)
1. **Con doble clic:** Ejecuta `iniciar_windows.bat` (dentro de `polux-retargeting-agent`) o `INICIAR_AGENTE_RETARGETING.bat` en la raíz del proyecto.
2. **O por terminal (PowerShell / CMD):**
   ```powershell
   cd polux-retargeting-agent
   npm install
   npm start
   ```
3. Abre **`http://localhost:4000`** (Centro de Control del Agente) y **`http://localhost:8080/landing`** (Tienda Polux con el sensor embebido).

### Opción B: En Mac (macOS)
En Mac no se usan archivos `.bat` y SQL Server corre mediante Docker (o el agente usa automáticamente su persistencia híbrida si no hay SQL Server local):
1. **Ejecución directa con el script para Mac:**
   ```bash
   git clone https://github.com/DahGhoul/polux-retargeting-agent.git
   cd polux-retargeting-agent
   chmod +x iniciar_mac_linux.sh
   ./iniciar_mac_linux.sh
   ```
2. **O usando Docker Desktop en Mac / Windows:**
   ```bash
   docker compose up -d --build
   ```
3. Abre **`http://localhost:4000`** en Safari o Chrome.

---

## 📱 Cómo vincular el WhatsApp Real antes de exponer

1. Abre **`http://localhost:4000`**.
2. En la tarjeta **"Vincular WhatsApp del Agente"**, aparecerá un **Código QR real**.
3. Abre WhatsApp en tu celular $\rightarrow$ **Dispositivos vinculados** $\rightarrow$ **Vincular un dispositivo** y escanea el QR.
4. ¡Listo! Cada vez que un usuario esté entre **5 y 10 minutos** en la tienda y salga sin comprar, tu WhatsApp le enviará automáticamente la foto del producto y el mensaje personalizado al número del cliente.
