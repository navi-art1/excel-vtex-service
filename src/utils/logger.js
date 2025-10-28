/**
 * Sistema de logging centralizado usando Winston
 * Maneja logs de diferentes niveles y los guarda en archivos
 */

const winston = require('winston');
const path = require('path');
const fs = require('fs');
const { config } = require('../config/env');

// Asegurar que el directorio de logs existe
const logDir = config.logging.logDir;
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Configuración de formatos para los logs
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, stack }) => {
    return `${timestamp} [${level.toUpperCase()}]: ${stack || message}`;
  })
);

// Configuración del logger principal
const logger = winston.createLogger({
  level: config.logging.level,
  format: logFormat,
  defaultMeta: { service: 'excel-vtex-service' },
  transports: [
    // Log de errores en archivo separado
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    
    // Log general de toda la aplicación
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),

    // Log específico para operaciones de VTEX
    new winston.transports.File({
      filename: path.join(logDir, 'vtex-operations.log'),
      level: 'info',
      maxsize: 5242880, // 5MB
      maxFiles: 3
    })
  ]
});

// En desarrollo, también mostrar logs en consola
if (config.server.nodeEnv !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

/**
 * Funciones de logging específicas para diferentes operaciones
 */
const logOperations = {
  /**
   * Log para operaciones de Excel
   */
  excel: {
    info: (message, metadata = {}) => {
      logger.info(`[EXCEL] ${message}`, metadata);
    },
    error: (message, error = {}) => {
      logger.error(`[EXCEL] ${message}`, { error: error.message, stack: error.stack });
    },
    warn: (message, metadata = {}) => {
      logger.warn(`[EXCEL] ${message}`, metadata);
    }
  },

  /**
   * Log para operaciones de VTEX
   */
  vtex: {
    info: (message, metadata = {}) => {
      logger.info(`[VTEX] ${message}`, metadata);
    },
    error: (message, error = {}) => {
      logger.error(`[VTEX] ${message}`, { error: error.message, stack: error.stack });
    },
    warn: (message, metadata = {}) => {
      logger.warn(`[VTEX] ${message}`, metadata);
    },
    success: (message, metadata = {}) => {
      logger.info(`[VTEX] ✅ ${message}`, metadata);
    }
  },

  /**
   * Log para operaciones del cron job
   */
  cron: {
    info: (message, metadata = {}) => {
      logger.info(`[CRON] ${message}`, metadata);
    },
    error: (message, error = {}) => {
      logger.error(`[CRON] ${message}`, { error: error.message, stack: error.stack });
    },
    warn: (message, metadata = {}) => {
      logger.warn(`[CRON] ${message}`, metadata);
    },
    start: () => {
      logger.info('[CRON] 🚀 Iniciando proceso automático de sincronización');
    },
    complete: (recordsProcessed) => {
      logger.info(`[CRON] ✅ Proceso completado. Registros procesados: ${recordsProcessed}`);
    }
  },

  /**
   * Log para operaciones de la API/servidor
   */
  api: {
    info: (message, metadata = {}) => {
      logger.info(`[API] ${message}`, metadata);
    },
    error: (message, error = {}) => {
      logger.error(`[API] ${message}`, { error: error.message, stack: error.stack });
    },
    request: (method, endpoint, ip) => {
      logger.info(`[API] ${method} ${endpoint} - IP: ${ip}`);
    }
  }
};

/**
 * Función para obtener estadísticas de logs
 */
function getLogStats() {
  const stats = {};
  const logFiles = ['error.log', 'combined.log', 'vtex-operations.log'];
  
  logFiles.forEach(file => {
    const filePath = path.join(logDir, file);
    if (fs.existsSync(filePath)) {
      const stat = fs.statSync(filePath);
      stats[file] = {
        size: stat.size,
        modified: stat.mtime
      };
    }
  });
  
  return stats;
}

module.exports = {
  logger,
  logOperations,
  getLogStats
};