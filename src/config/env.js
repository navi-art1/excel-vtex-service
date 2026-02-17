/**
 * Configuración de variables de entorno
 * Centraliza la carga y validación de todas las variables de entorno
 */

require('dotenv').config();

const config = {
  // Configuración del servidor
  server: {
    port: process.env.PORT || 3000,
    nodeEnv: process.env.NODE_ENV || 'development'
  },

  // Configuración de archivos
  files: {
    excelPath: process.env.EXCEL_FILE_PATH || './data/input/archivo.xlsx',
    outputJsonPath: process.env.OUTPUT_JSON_PATH || './data/output.json'
  },

  // Configuración de VTEX API
  vtex: {
    apiUrl: process.env.VTEX_API_URL,
    endpoint: process.env.VTEX_ENDPOINT,
    appKey: process.env.VTEX_APP_KEY,
    appToken: process.env.VTEX_APP_TOKEN,
    account: process.env.VTEX_ACCOUNT
  },

  // Configuración del cron job
  cron: {
    schedule: process.env.CRON_SCHEDULE || '*/10 * * * *' // Cada 10 minutos por defecto
  },

  // Configuración de seguridad
  security: {
    apiSecretToken: process.env.API_SECRET_TOKEN,
    enableAuth: process.env.ENABLE_AUTH === 'true'
  },

  // Configuración de Google Cloud Platform
  gcp: {
    projectId: 'prd-promart-ec-maps-chk-api',
    bucketName: 'bucket-sheetbridge-prd-data',
  },

  // Configuración de logs
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    logDir: process.env.LOG_DIR || './logs'
  }
};

/**
 * Valida que todas las variables de entorno críticas estén configuradas
 */
function validateConfig() {
  const requiredVars = [
    'VTEX_API_URL',
    'VTEX_APP_KEY', 
    'VTEX_APP_TOKEN',
    'VTEX_ACCOUNT'
  ];

  const missing = requiredVars.filter(varName => {
    const value = process.env[varName];
    return !value || value.trim() === '';
  });

  if (missing.length > 0) {
    console.error('❌ Variables de entorno faltantes:', missing);
    console.error('Por favor, configura estas variables en tu archivo .env');
    return false;
  }

  return true;
}

/**
 * Imprime la configuración actual (sin datos sensibles)
 */
function printConfig() {
  console.log('📋 Configuración cargada:');
  console.log(`   Puerto: ${config.server.port}`);
  console.log(`   Entorno: ${config.server.nodeEnv}`);
  console.log(`   Archivo Excel: ${config.files.excelPath}`);
  console.log(`   Cron Schedule: ${config.cron.schedule}`);
  console.log(`   Autenticación: ${config.security.enableAuth ? 'Habilitada' : 'Deshabilitada'}`);
  console.log(`   Nivel de logs: ${config.logging.level}`);
  console.log(`   GCP Project: ${config.gcp.projectId}`);
  console.log(`   GCP Bucket: ${config.gcp.bucketName}`);
}

module.exports = {
  config,
  validateConfig,
  printConfig
};