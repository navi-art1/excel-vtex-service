/**
 * Manejador centralizado de errores para la aplicación
 * Proporciona funciones para manejar diferentes tipos de errores de manera consistente
 */

const { logOperations } = require('./logger');

/**
 * Tipos de errores personalizados
 */
class AppError extends Error {
  constructor(message, statusCode = 500, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.name = this.constructor.name;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

class ExcelError extends AppError {
  constructor(message, details = {}) {
    super(`Error procesando Excel: ${message}`, 500);
    this.details = details;
    this.type = 'EXCEL_ERROR';
  }
}

class VtexError extends AppError {
  constructor(message, statusCode = 500, response = {}) {
    super(`Error VTEX API: ${message}`, statusCode);
    this.response = response;
    this.type = 'VTEX_ERROR';
  }
}

class ValidationError extends AppError {
  constructor(message, field = null) {
    super(`Error de validación: ${message}`, 400);
    this.field = field;
    this.type = 'VALIDATION_ERROR';
  }
}

/**
 * Middleware de manejo de errores para Express
 */
function errorHandler(err, req, res, next) {
  // Log del error
  logOperations.api.error('Error en la aplicación', err);

  // Si el error ya fue enviado, no hacer nada
  if (res.headersSent) {
    return next(err);
  }

  // Determinar el código de estado
  let statusCode = 500;
  let message = 'Error interno del servidor';
  let details = {};

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    
    if (err.details) {
      details = err.details;
    }
    if (err.response) {
      details.response = err.response;
    }
    if (err.field) {
      details.field = err.field;
    }
  }

  // Respuesta de error estructurada
  const errorResponse = {
    success: false,
    error: {
      message,
      type: err.type || 'INTERNAL_ERROR',
      timestamp: new Date().toISOString(),
      ...(Object.keys(details).length > 0 && { details })
    }
  };

  // En desarrollo, incluir stack trace
  if (process.env.NODE_ENV === 'development') {
    errorResponse.error.stack = err.stack;
  }

  res.status(statusCode).json(errorResponse);
}

/**
 * Maneja errores no capturados de promesas
 */
function handleUnhandledRejection() {
  process.on('unhandledRejection', (reason, promise) => {
    logOperations.api.error('Unhandled Promise Rejection', {
      reason: reason.message || reason,
      stack: reason.stack
    });
    
    // En producción, cerrar la aplicación gracefully
    if (process.env.NODE_ENV === 'production') {
      console.log('🔥 Cerrando la aplicación debido a una promesa rechazada no manejada');
      process.exit(1);
    }
  });
}

/**
 * Maneja excepciones no capturadas
 */
function handleUncaughtException() {
  process.on('uncaughtException', (err) => {
    logOperations.api.error('Uncaught Exception', err);
    console.log('🔥 Cerrando la aplicación debido a una excepción no capturada');
    process.exit(1);
  });
}

/**
 * Función para envolver funciones async y capturar errores automáticamente
 */
function catchAsync(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Funciones de utilidad para crear errores específicos
 */
const createError = {
  excel: (message, details) => new ExcelError(message, details),
  vtex: (message, statusCode, response) => new VtexError(message, statusCode, response),
  validation: (message, field) => new ValidationError(message, field),
  notFound: (resource) => new AppError(`${resource} no encontrado`, 404),
  unauthorized: () => new AppError('No autorizado', 401),
  forbidden: () => new AppError('Acceso prohibido', 403),
  internal: (message) => new AppError(message || 'Error interno del servidor', 500)
};

/**
 * Estado global de errores para tracking
 */
let errorStats = {
  totalErrors: 0,
  lastError: null,
  errorsByType: {},
  lastReset: new Date()
};

/**
 * Función para trackear errores
 */
function trackError(error) {
  errorStats.totalErrors++;
  errorStats.lastError = {
    message: error.message,
    type: error.type || 'UNKNOWN',
    timestamp: new Date()
  };
  
  const errorType = error.type || 'UNKNOWN';
  errorStats.errorsByType[errorType] = (errorStats.errorsByType[errorType] || 0) + 1;
}

/**
 * Función para obtener estadísticas de errores
 */
function getErrorStats() {
  return { ...errorStats };
}

/**
 * Función para resetear estadísticas de errores
 */
function resetErrorStats() {
  errorStats = {
    totalErrors: 0,
    lastError: null,
    errorsByType: {},
    lastReset: new Date()
  };
}

// Configurar manejadores globales
handleUnhandledRejection();
handleUncaughtException();

module.exports = {
  AppError,
  ExcelError,
  VtexError,
  ValidationError,
  errorHandler,
  catchAsync,
  createError,
  trackError,
  getErrorStats,
  resetErrorStats
};