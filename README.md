# Excel-VTEX Service

Servicio backend Node.js que automatiza la lectura de archivos Excel, procesamiento y subida inteligente de datos a VTEX y GCP.

---

## 🟢 Resumen Ejecutivo

Este servicio automatiza la integración entre archivos Excel y VTEX, permitiendo subir datos al ambiente correcto (RD o producción) según el nombre del archivo fuente, con trazabilidad en GCP y logs avanzados.

---

## ⚙️ ¿Cómo funciona?

1. Descarga el archivo Excel más reciente desde GCP (`Archivos_sheets`).
2. Procesa el Excel y lo convierte a JSON.
3. Detecta el ambiente VTEX según el nombre del archivo fuente (`sourceFile`):
   - `HOME_RD_...` → Ambiente RD (promartrd)
   - `HOME_PRD_...` → Producción (promart)
  
4. Sube el JSON al portal VTEX correspondiente.
5. Guarda copia en GCP (`Publicaciones_json_vtex`) y limpia la carpeta de entrada.
6. Registra logs y métricas de cada paso.

---

## 📄 Ejemplo de nombres y ambientes

| Nombre Excel                | Ambiente VTEX   |
|-----------------------------|-----------------|
| HOME_RD_2025_10_28.xlsx     | RD (promartrd)  |
| HOME_PRD_2025_10_28.xlsx    | Producción      |


---

## 🚀 Quick Start

```bash
npm install
cp .env.example .env # Edita tus credenciales y rutas
npm start
```

---

## 🔑 Variables de entorno principales

- `VTEX_APP_KEY`, `VTEX_APP_TOKEN`, `VTEX_ACCOUNT`, `VTEX_ENDPOINT`
- `EXCEL_FILE_PATH` (si usas local)
- Credenciales GCP para acceso al bucket

---

## 🆕 Lógica de subida automática VTEX

El sistema detecta el ambiente VTEX según el campo `sourceFile` del JSON generado. La subida se realiza automáticamente al portal correspondiente, sin intervención manual.

---

## 🐛 Troubleshooting

- Verifica logs en `logs/` ante cualquier error.
- Revisa variables de entorno y credenciales.
- Usa los endpoints `/health`, `/api/test-excel`, `/api/test-vtex` para diagnóstico.

---

## 🤝 Créditos y soporte

Desarrollado por el equipo Promart. Para soporte, revisa los logs y contacta al equipo técnico.

---

## 🚀 Características

- Lectura automática de Excel (.xlsx/.xls) y conversión a JSON
- Integración con VTEX (ambiente detectado por nombre)
- Ejecución automática por cron job
- API REST para control y monitoreo
- Logging avanzado y manejo de errores
- Subida automática a VTEX y copia en GCP
- Procesamiento y limpieza de archivos en GCP
- Seguridad y manejo de credenciales

---

## 📋 Requisitos

- Node.js >= 16.0.0
- npm >= 7.0.0
- Archivo Excel (.xlsx o .xls) accesible localmente o en GCP
- Credenciales válidas de VTEX API y GCP

---

## 🛠️ Instalación

1. Clona el proyecto y entra al directorio:
   ```bash
   git clone ...
   cd excel-vtex-service
   ```
2. Instala dependencias:
   ```bash
   npm install
   ```
3. Configura variables de entorno:
   ```bash
   cp .env.example .env
   # Edita .env con tus credenciales y rutas
   ```
4. Inicia el servicio:
   ```bash
   npm start
   # o npm run dev
   ```

---

## 📡 API Endpoints principales

- `/health` — Estado del servidor
- `/api/status` — Estado del último proceso
- `/api/force-update` — Forzar procesamiento manual
- `/api/test-excel` — Probar lectura de Excel
- `/api/test-vtex` — Probar conexión VTEX

---

## 🔧 Configuración avanzada

Consulta la tabla de variables de entorno en `.env.example` para detalles y opciones avanzadas (cron, logs, autenticación, etc).

---

## 📊 Monitoreo y Logs

- Archivos en `logs/` para auditoría y debugging
- Endpoints para consultar estado y estadísticas

---

## 🚨 Manejo de Errores y Seguridad

- Manejo automático de errores de archivo, VTEX, red y validación
- Estrategias de recuperación y notificación
- Seguridad en credenciales y archivos sensibles

---

## 📈 Rendimiento y límites

- Procesamiento por lotes y rate limiting
- Memoria eficiente y logs rotativos
- Tamaño recomendado de Excel: máx. 50MB

---

## 📝 Changelog y mejoras recientes

- Integración total con GCP y VTEX
- Lógica automática de ambiente VTEX por nombre de archivo
- Procesamiento y limpieza robusta de archivos en GCP
- Hora de procesamiento siempre en zona horaria Lima (`America/Lima`)

---