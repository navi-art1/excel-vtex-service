# Excel-VTEX Service

Servicio backend Node.js que automatiza la lectura de archivos Excel y el envío de datos a la API de VTEX.

## 🚀 Características

- **Lectura automática de Excel**: Procesa archivos .xlsx/.xls y los convierte a JSON estructurado
- **Integración con VTEX**: Envía datos a la API de VTEX de manera segura y confiable
- **Ejecución automática**: Cron job que ejecuta la sincronización cada 10 minutos
- **API REST**: Endpoints para control manual, monitoreo y estado
- **Logging avanzado**: Sistema de logs detallado con Winston
- **Manejo de errores**: Sistema robusto de manejo y recuperación de errores
- **Monitoreo**: Estadísticas detalladas de rendimiento y ejecución

- **Subida automática a VTEX**: Cada vez que se genera y valida correctamente el archivo JSON, este se sube automáticamente al portal de archivos de VTEX, sin intervención manual.

### 🆕 ¿Cuándo se sube el JSON a VTEX?

El archivo JSON generado a partir del Excel se sube automáticamente a VTEX en los siguientes casos:

1. **Al iniciar el servidor** (si la variable de entorno `RUN_ON_STARTUP` está en `true`).
2. **Cada vez que se ejecuta el cron job** (por defecto, cada 10 minutos).
3. **Cuando se fuerza manualmente el procesamiento** (por endpoint o script).

La subida solo ocurre si el JSON fue creado y guardado exitosamente.

## 📋 Requisitos

- Node.js >= 16.0.0
- npm >= 7.0.0
- Archivo Excel (.xlsx o .xls) accesible localmente
- Credenciales válidas de VTEX API

## 🛠️ Instalación

1. **Clonar o descargar el proyecto**
   ```bash
   cd excel-vtex-service
   ```

2. **Instalar dependencias**
   ```bash
   npm install
   ```

3. **Configurar variables de entorno**
   ```bash
   cp .env.example .env
   ```
   
   Editar `.env` con tus configuraciones:
   ```env
   # Configuración del servidor
   PORT=3000
   NODE_ENV=development
   
   # Archivo Excel
   EXCEL_FILE_PATH=./data/input/tu-archivo.xlsx
   
   # VTEX API
   VTEX_API_URL=https://tu-account.vtexcommercestable.com.br/api
   VTEX_APP_KEY=tu_app_key
   VTEX_APP_TOKEN=tu_app_token
   VTEX_ACCOUNT=tu-account-name
   ```

4. **Crear directorio para archivo Excel**
   ```bash
   mkdir -p data/input
   ```
   
   Colocar tu archivo Excel en `data/input/`

5. **(Opcional) Configurar subida automática a VTEX**
   - Asegúrate de tener las variables de entorno VTEX correctamente configuradas en `.env`:
     ```env
     VTEX_ACCOUNT=tu-account-name
     VTEX_APP_KEY=tu_app_key
     VTEX_APP_TOKEN=tu_app_token
     ```
   - El archivo `data/output.json` se subirá automáticamente a VTEX después de cada procesamiento exitoso.

5. **Iniciar el servicio**
   ```bash
   # Producción
   npm start
   
   # Desarrollo (con reinicio automático)
   npm run dev
   ```

## 📡 API Endpoints

### Endpoints Públicos

- **GET `/health`** - Estado del servidor
  ```json
  {
    "success": true,
    "status": "OK",
    "timestamp": "2024-10-21T10:30:00.000Z"
  }
  ```

- **GET `/api/status`** - Estado del último proceso
  ```json
  {
    "success": true,
    "data": {
      "isRunning": false,
      "lastExecution": {
        "id": "exec_1234567890_abc123",
        "status": "completed",
        "recordsProcessed": 150,
        "startedAt": "2024-10-21T10:00:00.000Z",
        "endedAt": "2024-10-21T10:01:30.000Z"
      }
    }
  }
  ```

### Endpoints Protegidos

- **POST `/api/force-update`** - Forzar actualización manual
- **GET `/api/logs`** - Estadísticas de logs
- **POST `/api/test-excel`** - Probar lectura de Excel
- **POST `/api/test-vtex`** - Probar conexión VTEX
- **GET `/api/process-history`** - Historial de procesos

## 🔧 Configuración

### Variables de Entorno

| Variable | Descripción | Valor por defecto |
|----------|-------------|-------------------|
| `PORT` | Puerto del servidor | `3000` |
| `NODE_ENV` | Entorno de ejecución | `development` |
| `EXCEL_FILE_PATH` | Ruta del archivo Excel | `./data/input/archivo.xlsx` |
| `VTEX_API_URL` | URL base de VTEX API | Requerido |
| `VTEX_APP_KEY` | App Key de VTEX | Requerido |
| `VTEX_APP_TOKEN` | App Token de VTEX | Requerido |
| `CRON_SCHEDULE` | Schedule del cron job | `*/10 * * * *` (cada 10 min) |
| `ENABLE_AUTH` | Habilitar autenticación | `false` |
| `LOG_LEVEL` | Nivel de logs | `info` |

### Configuración del Cron Job

El servicio ejecuta automáticamente cada 10 minutos por defecto. Puedes cambiar esto modificando `CRON_SCHEDULE`:

- `*/10 * * * *` - Cada 10 minutos
- `0 * * * *` - Cada hora
- `0 9 * * *` - Todos los días a las 9:00 AM
- `0 9 * * 1-5` - Días laborables a las 9:00 AM

## 📊 Monitoreo y Logs

### Archivos de Log

- `logs/combined.log` - Logs generales
- `logs/error.log` - Solo errores
- `logs/vtex-operations.log` - Operaciones de VTEX

### Endpoints de Monitoreo

```bash
# Estado general
curl http://localhost:3000/api/status

# Estadísticas de logs
curl http://localhost:3000/api/logs

# Historial de procesos
curl http://localhost:3000/api/process-history
```

## 🔒 Seguridad

### Autenticación (Opcional)

Para habilitar autenticación en endpoints sensibles:

1. Configurar en `.env`:
   ```env
   ENABLE_AUTH=true
   API_SECRET_TOKEN=tu_token_secreto_aqui
   ```

2. Incluir token en requests:
   ```bash
   curl -H "Authorization: Bearer tu_token_secreto_aqui" \
        -X POST http://localhost:3000/api/force-update
   ```

## 🚨 Manejo de Errores

El servicio maneja automáticamente:

- **Errores de archivo**: Archivo no encontrado, formato inválido, etc.
- **Errores de VTEX**: Problemas de conectividad, autenticación, límites de rate
- **Errores de red**: Timeouts, conexiones perdidas
- **Errores de validación**: Datos inválidos o faltantes

### Estrategias de Recuperación

- **Errores temporales**: El servicio continúa en la próxima ejecución
- **Errores críticos**: El servicio se detiene automáticamente
- **Notificaciones**: Configurables via webhook (opcional)

## 📈 Rendimiento

### Optimizaciones Incluidas

- **Procesamiento por lotes**: Datos divididos en chunks para APIs grandes
- **Rate limiting**: Respeta límites de la API de VTEX
- **Memoria eficiente**: Streaming para archivos Excel grandes
- **Logs rotativos**: Previene crecimiento excesivo de logs

### Límites Recomendados

- **Tamaño de archivo Excel**: Máximo 50MB
- **Registros por lote**: 100 registros (configurable)
- **Timeout de API**: 30 segundos

## 🛠️ Desarrollo

### Scripts Disponibles

```bash
npm start          # Ejecutar en producción
npm run dev        # Desarrollo con nodemon
npm test           # Ejecutar tests (placeholder)
node src/services/uploadOutputToPortal.js   # Subida manual del JSON a VTEX (ya no es necesario en la mayoría de casos)
```

### Estructura del Proyecto

```
src/
├── config/         # Configuración
├── routes/         # Rutas de la API
├── services/       # Lógica de negocio
├── utils/          # Utilidades (logs, errores)
└── app.js          # Configuración de Express

data/
├── input/          # Archivos Excel de entrada
└── output.json     # JSON generado

logs/               # Archivos de log
```

## 🐛 Troubleshooting

### Problemas Comunes

1. **"Archivo Excel no encontrado"**
   - Verificar que `EXCEL_FILE_PATH` sea correcta
   - Asegurar que el archivo existe y tiene permisos de lectura

2. **"Error de autenticación VTEX"**
   - Verificar `VTEX_APP_KEY` y `VTEX_APP_TOKEN`
   - Confirmar que las credenciales están activas

3. **"No se sube el archivo JSON a VTEX"**
   - Verifica que las variables de entorno de VTEX estén correctas
   - Revisa los logs para ver si hubo errores al subir el archivo
   - El archivo solo se sube si el procesamiento del Excel fue exitoso

3. **"Servicio no inicia"**
   - Verificar que el puerto no esté en uso
   - Revisar logs en `logs/error.log`

### Verificación de Salud

```bash
# Test básico del servidor
curl http://localhost:3000/health

# Test de lectura de Excel
curl -X POST http://localhost:3000/api/test-excel

# Test de conexión VTEX
curl -X POST http://localhost:3000/api/test-vtex
```

## 📝 Changelog

### v1.0.0
- Implementación inicial
- Lectura de archivos Excel
- Integración con VTEX API
- Cron job automático
- Sistema de logs
- API REST para control

## 📄 Licencia

ISC License - Ver archivo LICENSE para detalles.

## 🤝 Soporte

Para soporte técnico o reportar issues:

1. Revisar los logs en `logs/`
2. Verificar la configuración en `.env`
3. Usar endpoints de diagnóstico (`/api/test-*`)
4. Contactar al equipo de desarrollo

---

**Desarrollado por el equipo de Promart** 🚀