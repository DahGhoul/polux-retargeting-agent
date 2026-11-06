-- ============================================================================
-- BASE DE DATOS: PoluxImportDB
-- MOTOR: Microsoft SQL Server 2019 / 2022
-- SCRIPT 10: AGENTE DE RECUPERACIÓN DE ABANDONO Y RETARGETING (LEAD -> PAYER)
-- RESPONSABLES: Diego & Ronaldo
-- ============================================================================

SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

USE PoluxImportDB;
GO

-- 1. Registrar el Agente Especializado en core.agente_ia si no existe
IF NOT EXISTS (SELECT 1 FROM core.agente_ia WHERE codigo_agente = 'AGT_RETARGETING_LP')
BEGIN
    INSERT INTO core.agente_ia (codigo_agente, nombre_agente, rol_operativo, fase_principal, requiere_aprobacion_humana, es_activo)
    VALUES (
        'AGT_RETARGETING_LP',
        N'Agente de Recuperación de Abandono (Lead -> Payer)',
        N'Monitorea el tiempo de permanencia en página (Dwell Time) ante abandono de sesión y ejecuta retargeting escalonado: <5 min Correo HTML, 5-10 min WhatsApp Directo, >10 min Alerta Asesor + Llamada.',
        'LEADS',
        0,
        1
    );
END
GO

-- 2. Configurar parámetros de umbrales de permanencia en core.configuracion_parametro
IF NOT EXISTS (SELECT 1 FROM core.configuracion_parametro WHERE codigo_parametro = 'UMBRAL_RETARGETING_CORREO_MAX_MIN')
BEGIN
    INSERT INTO core.configuracion_parametro (codigo_parametro, descripcion, valor_numerico, unidad_medida)
    VALUES ('UMBRAL_RETARGETING_CORREO_MAX_MIN', N'Tiempo máximo en minutos para disparar Correo de Carrito Abandonado (< 5 min)', 5.00, 'MINUTOS');
END

IF NOT EXISTS (SELECT 1 FROM core.configuracion_parametro WHERE codigo_parametro = 'UMBRAL_RETARGETING_WHATSAPP_MAX_MIN')
BEGIN
    INSERT INTO core.configuracion_parametro (codigo_parametro, descripcion, valor_numerico, unidad_medida)
    VALUES ('UMBRAL_RETARGETING_WHATSAPP_MAX_MIN', N'Tiempo máximo en minutos para disparar WhatsApp Directo (5 a 10 min); superior dispara Alerta Asesor + Llamada', 10.00, 'MINUTOS');
END
GO

-- 3. Crear tabla transaccional leads.abandono_carrito_retargeting
IF OBJECT_ID('leads.abandono_carrito_retargeting', 'U') IS NULL
BEGIN
    CREATE TABLE leads.abandono_carrito_retargeting (
        id_retargeting          BIGINT IDENTITY(1,1) NOT NULL,
        id_persona              BIGINT NOT NULL,
        id_producto             INT NOT NULL,
        nombre_producto         NVARCHAR(150) NOT NULL,
        precio_producto_pen     DECIMAL(12,2) NOT NULL,
        segundos_permanencia    INT NOT NULL,
        minutos_permanencia     AS CAST(ROUND(segundos_permanencia / 60.0, 2) AS DECIMAL(8,2)) PERSISTED,
        rango_detectado         VARCHAR(30) NOT NULL,   -- MENOR_5_MIN, ENTRE_5_Y_10_MIN, MAYOR_10_MIN
        canal_accion            VARCHAR(40) NOT NULL,   -- CORREO_HTML, WHATSAPP_DIRECTO, ALERTA_ASESOR_LLAMADA
        nivel_intencion         VARCHAR(30) NOT NULL,   -- EXPLORATORIA, COMPRA_POSIBLE, COMPRA_MUY_POSIBLE
        probabilidad_compra     DECIMAL(5,2) NOT NULL,  -- 0.00 a 100.00
        asunto_o_titulo         NVARCHAR(200) NOT NULL,
        mensaje_enviado         NVARCHAR(MAX) NOT NULL,
        guion_llamada_asesor    NVARCHAR(MAX) NULL,
        url_vista_previa_email  NVARCHAR(400) NULL,
        estado_recuperacion     VARCHAR(30) NOT NULL DEFAULT 'ENVIADO', -- ENVIADO, EN_LLAMADA_ASESOR, CONVERTIDO_PAYER
        medio_pago_conversion   VARCHAR(30) NULL,
        monto_pagado_pen        DECIMAL(12,2) NULL,
        comprobante_sunat       VARCHAR(30) NULL,
        id_orden_generada       BIGINT NULL,
        fecha_abandono          DATETIME2(7) NOT NULL DEFAULT SYSDATETIME(),
        fecha_conversion        DATETIME2(7) NULL,
        CONSTRAINT PK_leads_abandono_retargeting PRIMARY KEY CLUSTERED (id_retargeting),
        CONSTRAINT FK_retargeting_persona FOREIGN KEY (id_persona)
            REFERENCES core.persona (id_persona) ON DELETE NO ACTION,
        CONSTRAINT CK_retargeting_rango CHECK (rango_detectado IN ('MENOR_5_MIN', 'ENTRE_5_Y_10_MIN', 'MAYOR_10_MIN')),
        CONSTRAINT CK_retargeting_canal CHECK (canal_accion IN ('CORREO_HTML', 'WHATSAPP_DIRECTO', 'ALERTA_ASESOR_LLAMADA'))
    );

    CREATE NONCLUSTERED INDEX IX_retargeting_persona_fecha
    ON leads.abandono_carrito_retargeting (id_persona, fecha_abandono DESC);
END
GO
