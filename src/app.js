/**
 * Configuración principal de la aplicación Express
 * Define middlewares, rutas y configuración del servidor
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

const { config } = require('./config/env');
const { errorHandler } = require('./utils/errorHandler');
const { logOperations } = require('./utils/logger');
const routes = require('./routes');

// Crear instancia de Express
const app = express();

// =================================
// MIDDLEWARES DE SEGURIDAD
// =================================
app.use(helmet()); // Configuraciones de seguridad básicas
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  credentials: true
}));

// =================================
// MIDDLEWARES DE PARSING
// =================================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// =================================
// MIDDLEWARE DE LOGGING DE REQUESTS
// =================================
app.use((req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  logOperations.api.request(req.method, req.originalUrl, ip);
  next();
});

// =================================
// MIDDLEWARE DE SALUD BÁSICA
// =================================
app.use('/health', (req, res) => {
  res.status(200).json({
    success: true,
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.server.nodeEnv,
    version: process.env.npm_package_version || '1.0.0'
  });
});

// =================================
// RUTAS PRINCIPALES
// =================================
app.use('/api', routes);

// =================================
// MIDDLEWARE PARA RUTAS NO ENCONTRADAS
// =================================
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      message: 'Endpoint no encontrado',
      path: req.originalUrl,
      method: req.method,
      timestamp: new Date().toISOString()
    }
  });
});

// =================================
// MIDDLEWARE DE MANEJO DE ERRORES
// =================================
app.use(errorHandler);

// =================================
// FUNCIONES DE UTILIDAD PARA EL SERVIDOR
// =================================

/**
 * Función para iniciar el servidor de manera graceful
 */
function startServer() {
  const server = app.listen(config.server.port, () => {
    console.log(`🚀 Servidor iniciado en puerto ${config.server.port}`);
    console.log(`🌍 Entorno: ${config.server.nodeEnv}`);
    console.log(`📊 Health check disponible en: http://localhost:${config.server.port}/health`);
    
    logOperations.api.info(`Servidor iniciado en puerto ${config.server.port}`);
  });

  // Manejo graceful de cierre del servidor
  const gracefulShutdown = (signal) => {
    console.log(`\n🛑 Recibida señal ${signal}. Cerrando servidor gracefully...`);
    
    server.close(() => {
      console.log('✅ Servidor HTTP cerrado.');
      logOperations.api.info('Servidor cerrado gracefully');
      process.exit(0);
    });

    // Forzar cierre después de 10 segundos
    setTimeout(() => {
      console.error('❌ Forzando cierre del servidor...');
      process.exit(1);
    }, 10000);
  };

  // Escuchar señales de terminación
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  return server;
}

/**
 * Función para obtener el estado de la aplicación
 */
function getAppStatus() {
  return {
    status: 'running',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: config.server.nodeEnv,
    nodeVersion: process.version,
    timestamp: new Date().toISOString()
  };
}

module.exports = {
  app,
  startServer,
  getAppStatus
};