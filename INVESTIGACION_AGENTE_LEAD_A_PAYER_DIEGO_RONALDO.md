# INVESTIGACIÓN APLICADA: DESARROLLO DE UN AGENTE INTELIGENTE DE RETARGETING Y RECUPERACIÓN DE ABANDONO BASADO EN TIEMPO DE PERMANENCIA PARA OPTIMIZAR LA CONVERSIÓN DE LA FASE LEAD A PAYER EN POLUX IMPORTS S.A.C.

---

## 1. Datos Generales para el Registro de Parejas (Examen de Laboratorio U2)

| Campo Solicitado por el Docente | Información Oficial del Subgrupo |
| :--- | :--- |
| **Proyecto General** | **Polux Imports S.A.C.** — Importación y Comercialización de Ecosistema Apple (Miami $\rightarrow$ Trujillo) |
| **Integrantes del Subgrupo (Pareja)** | 1. **Diego Cuba** <br> 2. **Ronaldo Robles Romero** |
| **Fase Seleccionada (Sin repetir)** | **Fase LEAD $\rightarrow$ PAYER** *(Conversión Comercial y Recuperación de Carrito Abandonado)* |
| **Título de la Investigación** | *"Agente Inteligente de Retargeting Omnicanal Basado en Telemetría de Tiempo de Permanencia (Dwell Time) para Incrementar la Tasa de Conversión de Lead a Payer en el Comercio Electrónico de Polux Imports S.A.C."* |
| **Sistema Desarrollado** | **`polux-retargeting-agent`** (Puerto `4000`) — Sistema autónomo con integración transaccional en vivo a `PoluxImportDB` (SQL Server 2022). |

---

## 2. Planteamiento del Problema de Investigación

En el embudo comercial bajo la metodología **IMPULSE** (`BUYER` $\rightarrow$ `LEAD` $\rightarrow$ `PAYER` $\rightarrow$ `CUSTOMER`), uno de los mayores cuellos de botella ocurre en la transición de **LEAD a PAYER**. Los prospectos calificados (`LEADS`) ingresan al catálogo web de **Polux Imports**, revisan las especificaciones de equipos de ticket alto (como el *iPhone 16 Pro Max* de S/ 6,599 o la *MacBook Air M4* de S/ 5,499), evalúan precios y cuotas, pero **abandonan la página antes de completar el pago** por dudas de último minuto (capacidad, color, autenticidad del equipo o modalidades de pago con Yape/Plin/Tarjetas).

Sin un agente que mida la **intensidad de interés según el tiempo de permanencia (Dwell Time)** al momento de salir de la página:
1. Los leads con **interés exploratorio ($< 5\text{ minutos}$)** olvidan el producto al cerrar la pestaña.
2. Los leads con **compra posible ($5\text{ a }10\text{ minutos}$)** no reciben asistencia inmediata en su canal de mensajería preferido (WhatsApp) para despejar dudas puntuales.
3. Los leads con **compra altamente probable ($> 10\text{ minutos}$)** —que ya compararon precios y cuotas pero tuvieron fricción en el último paso— se enfrían porque ningún asesor humano es alertado en tiempo real para llamarlos.

---

## 3. Reglas de Decisión del Agente (`AGT_RETARGETING_LP`)

El agente monitorea en segundo plano el cronómetro de sesión (`segundos_permanencia`) y el evento de salida (`Exit-Intent` / cierre de sesión sin compra), clasificando automáticamente cada abandono en **tres umbrales determinísticos**:

| Regla | Tiempo en Página (Dwell Time) | Nivel de Intención Detectado | Probabilidad de Cierre | Acción Automática del Agente | Canal de Ejecución |
| :---: | :---: | :--- | :---: | :--- | :--- |
| **R1** | **$< 5\text{ minutos}$** <br> *(1 a 299 seg)* | **Interés Exploratorio** | $25\% - 48\%$ | Envío inmediato de **Correo Electrónico HTML** con asunto *"No abandones tu carrito 👀"*, foto del equipo Apple revisado y botón de retorno al checkout. | **Email SMTP** (`Nodemailer` / `Ethereal`) |
| **R2** | **$5\text{ a }10\text{ minutos}$** <br> *(300 a 600 seg)* | **Compra Posible** | $65\% - 84\%$ | Disparo de **Mensaje de WhatsApp Business Directo** con foto del producto, consulta empática (*"¿Tuviste alguna duda con la capacidad, el color o los métodos de pago?"*) y botón **`Comprar ahora!`**. | **WhatsApp Business** + Pasarela `PoluxPay` |
| **R3** | **$> 10\text{ minutos}$** <br> *(> 600 seg)* | **Compra Muy Muy Posible (Urgente)** | $88\% - 98\%$ | Generación de **Alerta Crítica Sonora y Visual al Asesor Comercial**, apertura de discador telefónico y generación de **Guion de Llamada IA** para cierre inmediato en 3 cuotas 0% o Yape. | **Llamada Telefónica de Asesor** + `core.alerta_operativa` |

---

## 4. Arquitectura e Integración con `PoluxImportDB`

Aunque **`polux-retargeting-agent`** opera como un sistema independiente en el puerto `4000`, se conecta directamente al motor **Microsoft SQL Server (`PoluxImportDB`)** del proyecto general:

1. **Lectura de Leads Reales:** Consulta `core.persona` y `leads.lead` para identificar al visitante activo.
2. **Registro de Auditoría de Retargeting:** Inserta cada abandono y decisión en la nueva tabla [`leads.abandono_carrito_retargeting`](file:///c:/Users/Diego/Downloads/UNIDAD%20I-20260917T042929Z-1-001/UNIDAD%20I/bd/10_agente_retargeting_lead_payer.sql) y en `core.accion_agente` bajo el código `AGT_RETARGETING_LP`.
3. **Escalamiento a Humano ($> 10\text{ min}$):** Inserta una alerta prioritaria en `core.alerta_operativa` con código `ABANDONO_ALTA_INTENCION_MAS_10M`.
4. **Conversión Transaccional `LEAD` $\rightarrow$ `PAYER`:** Cuando el cliente completa el pago desde el correo, el botón de WhatsApp o durante la llamada con el asesor:
   - Actualiza `core.persona.etapa_actual = 'PAYER'` y `leads.lead.estado_lead = 'CONVERTIDO'`.
   - Crea la orden formal en `payers.orden_contratacion` y el abono validado en `payers.pago`.
   - Emite la **Boleta Electrónica SUNAT (`B001-XXXXXX`)** en `payers.comprobante_electronico`.
   - Registra la transición inmutable en `core.historial_etapa`.

---

## 5. Indicadores de Gestión (KPIs) para Validar la Investigación

1. **Tasa de Recuperación de Carrito Abandonado (TRCA):**
   $$\text{TRCA} = \left( \frac{\text{Leads Convertidos a Payer vía Retargeting}}{\text{Total de Sesiones Abandonadas Detectadas}} \right) \times 100$$
2. **Efectividad de Conversión por Canal ($\text{ECC}_c$):**
   $$\text{ECC}_{\text{WhatsApp}} = \left( \frac{\text{Pagos Confirmados desde Botón WhatsApp (5–10 min)}}{\text{Total de Mensajes WhatsApp Disparados}} \right) \times 100$$
3. **Tiempo de Respuesta del Asesor en Intención Crítica ($> 10\text{ min}$):** Meta operativa $< 2\text{ minutos}$ desde la alerta hasta la llamada telefónica.
