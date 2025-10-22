/**
 * Rutas principales de la API
 * Define todos los endpoints disponibles
 */

const express = require('express');
const { catchAsync, createError } = require('../utils/errorHandler');
const { logOperations, getLogStats } = require('../utils/logger');
const { getErrorStats } = require('../utils/errorHandler');
const { config } = require('../config/env');
const router = express.Router();

// Importar servicios (se crearán en los siguientes pasos)
let excelService, vtexService, processStatus;

// Lazy loading de servicios para evitar dependencias circulares
function getServices() {
  if (!excelService) {
    excelService = require('../services/excelService');
    vtexService = require('../services/vtexService');
    processStatus = require('../services/processStatus');
  }
  return { excelService, vtexService, processStatus };
}

// =================================
// MIDDLEWARE DE AUTENTICACIÓN (OPCIONAL)
// =================================
function authMiddleware(req, res, next) {
  if (!config.security.enableAuth) {
    return next();
  }

  const token = req.headers['authorization'] || req.headers['x-api-token'];
  
  if (!token || token !== `Bearer ${config.security.apiSecretToken}`) {
    return next(createError.unauthorized());
  }
  
  next();
}

// =================================
// ENDPOINTS PRINCIPALES
// =================================

/**
 * GET /api/status
 * Retorna el estado del último proceso ejecutado
 */
router.get('/status', catchAsync(async (req, res) => {
  const { processStatus } = getServices();
  const status = processStatus.getStatus();
  
  logOperations.api.info('Estado consultado');
  
  res.json({
    success: true,
    data: {
      ...status,
      server: {
        uptime: Math.floor(process.uptime()),
        memory: process.memoryUsage(),
        nodeVersion: process.version
      }
    }
  });
}));

/**
 * POST /api/force-update
 * Dispara manualmente la lectura del Excel y envío a VTEX
 */
router.post('/force-update', authMiddleware, catchAsync(async (req, res) => {
  const { excelService, vtexService, processStatus } = getServices();
  
  logOperations.api.info('Actualización manual solicitada');
  
  // Verificar si hay un proceso en ejecución
  const currentStatus = processStatus.getStatus();
  if (currentStatus.isRunning) {
    return res.status(409).json({
      success: false,
      error: {
        message: 'Ya hay un proceso en ejecución',
        startedAt: currentStatus.lastExecution.startedAt
      }
    });
  }

  // Iniciar el proceso
  processStatus.startProcess('manual');
  
  try {
    // 1. Leer y procesar el archivo Excel
    logOperations.api.info('Iniciando lectura de archivo Excel');
    const jsonData = await excelService.readExcelAndConvert();
    
    // 2. Enviar datos a VTEX
    logOperations.api.info('Enviando datos a VTEX');
    const vtexResponse = await vtexService.sendData(jsonData);
    
    // 3. Marcar proceso como completado
    processStatus.completeProcess(jsonData.length, null, vtexResponse);
    
    logOperations.api.info(`Actualización manual completada. ${jsonData.length} registros procesados`);
    
    res.json({
      success: true,
      message: 'Actualización completada exitosamente',
      data: {
        recordsProcessed: jsonData.length,
        vtexResponse: vtexResponse,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    processStatus.completeProcess(0, error);
    logOperations.api.error('Error en actualización manual', error);
    throw error;
  }
}));

/**
 * GET /api/logs
 * Retorna estadísticas de logs y errores
 */
router.get('/logs', catchAsync(async (req, res) => {
  const logStats = getLogStats();
  const errorStats = getErrorStats();
  
  res.json({
    success: true,
    data: {
      logs: logStats,
      errors: errorStats,
      timestamp: new Date().toISOString()
    }
  });
}));

/**
 * GET /api/config
 * Retorna configuración actual (sin datos sensibles)
 */
router.get('/config', catchAsync(async (req, res) => {
  res.json({
    success: true,
    data: {
      server: {
        port: config.server.port,
        environment: config.server.nodeEnv
      },
      files: {
        excelPath: config.files.excelPath,
        outputJsonPath: config.files.outputJsonPath
      },
      cron: {
        schedule: config.cron.schedule
      },
      security: {
        authEnabled: config.security.enableAuth
      },
      logging: {
        level: config.logging.level,
        logDir: config.logging.logDir
      }
    }
  });
}));

/**
 * POST /api/test-excel
 * Endpoint para probar solo la lectura del Excel sin enviar a VTEX
 */
router.post('/test-excel', authMiddleware, catchAsync(async (req, res) => {
  const { excelService } = getServices();
  
  logOperations.api.info('Prueba de lectura de Excel solicitada');
  
  try {
    const jsonData = await excelService.readExcelAndConvert();
    
    res.json({
      success: true,
      message: 'Archivo Excel leído exitosamente',
      data: {
        recordsFound: jsonData.length,
        sampleData: jsonData.slice(0, 3), // Mostrar solo los primeros 3 registros como muestra
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logOperations.api.error('Error en prueba de Excel', error);
    throw error;
  }
}));

/**
 * POST /api/test-vtex
 * Endpoint para probar solo la conexión con VTEX (sin datos reales)
 */
router.post('/test-vtex', authMiddleware, catchAsync(async (req, res) => {
  const { vtexService } = getServices();
  
  logOperations.api.info('Prueba de conexión VTEX solicitada');
  
  try {
    const testResult = await vtexService.testConnection();
    
    res.json({
      success: true,
      message: 'Conexión con VTEX probada exitosamente',
      data: {
        connectionTest: testResult,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logOperations.api.error('Error en prueba de VTEX', error);
    throw error;
  }
}));

/**
 * GET /api/process-history
 * Retorna el historial de procesos ejecutados
 */
router.get('/process-history', catchAsync(async (req, res) => {
  const { processStatus } = getServices();
  const history = processStatus.getHistory();
  
  res.json({
    success: true,
    data: {
      history,
      totalExecutions: history.length,
      timestamp: new Date().toISOString()
    }
  });
}));

module.exports = router;