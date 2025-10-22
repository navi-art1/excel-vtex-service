/**
 * Servicio para trackear el estado de los procesos de sincronización
 * Mantiene un registro del estado actual y el historial de ejecuciones
 */

const { logOperations } = require('../utils/logger');

/**
 * Servicio para manejar el estado de procesos
 */
class ProcessStatusService {
  constructor() {
    this.currentStatus = {
      isRunning: false,
      lastExecution: null,
      executionHistory: []
    };
    
    this.maxHistorySize = 50; // Mantener últimas 50 ejecuciones
  }

  /**
   * Inicia un nuevo proceso
   */
  startProcess(trigger = 'auto') {
    const execution = {
      id: this.generateExecutionId(),
      trigger, // 'auto', 'manual', 'api'
      startedAt: new Date().toISOString(),
      endedAt: null,
      status: 'running',
      recordsProcessed: 0,
      error: null,
      vtexResponse: null,
      duration: null
    };

    this.currentStatus.isRunning = true;
    this.currentStatus.lastExecution = execution;

    logOperations.cron.info(`Proceso iniciado: ${execution.id} (${trigger})`);

    return execution.id;
  }

  /**
   * Completa un proceso
   */
  completeProcess(recordsProcessed = 0, error = null, vtexResponse = null) {
    if (!this.currentStatus.lastExecution) {
      logOperations.cron.warn('Intentando completar proceso pero no hay ejecución activa');
      return;
    }

    const execution = this.currentStatus.lastExecution;
    const endTime = new Date();
    const startTime = new Date(execution.startedAt);

    execution.endedAt = endTime.toISOString();
    execution.status = error ? 'failed' : 'completed';
    execution.recordsProcessed = recordsProcessed;
    execution.error = error ? this.serializeError(error) : null;
    execution.vtexResponse = vtexResponse;
    execution.duration = endTime.getTime() - startTime.getTime(); // milisegundos

    this.currentStatus.isRunning = false;

    // Agregar al historial
    this.addToHistory(execution);

    if (error) {
      logOperations.cron.error(`Proceso ${execution.id} falló`, error);
    } else {
      logOperations.cron.complete(recordsProcessed);
    }
  }

  /**
   * Cancela un proceso en ejecución
   */
  cancelProcess(reason = 'Manual cancellation') {
    if (!this.currentStatus.isRunning) {
      return false;
    }

    const execution = this.currentStatus.lastExecution;
    const endTime = new Date();
    const startTime = new Date(execution.startedAt);

    execution.endedAt = endTime.toISOString();
    execution.status = 'cancelled';
    execution.error = { message: reason, type: 'CANCELLATION' };
    execution.duration = endTime.getTime() - startTime.getTime();

    this.currentStatus.isRunning = false;

    this.addToHistory(execution);

    logOperations.cron.warn(`Proceso ${execution.id} cancelado: ${reason}`);

    return true;
  }

  /**
   * Obtiene el estado actual completo
   */
  getStatus() {
    const now = new Date();
    const recentHistory = this.getRecentHistory(10);
    
    // Estadísticas del historial
    const stats = this.calculateStats();

    return {
      isRunning: this.currentStatus.isRunning,
      lastExecution: this.currentStatus.lastExecution,
      recentHistory,
      stats,
      serverTime: now.toISOString(),
      uptime: process.uptime()
    };
  }

  /**
   * Obtiene el historial completo de ejecuciones
   */
  getHistory() {
    return [...this.currentStatus.executionHistory].reverse(); // Más recientes primero
  }

  /**
   * Obtiene el historial reciente
   */
  getRecentHistory(limit = 10) {
    return this.currentStatus.executionHistory
      .slice(-limit)
      .reverse(); // Más recientes primero
  }

  /**
   * Calcula estadísticas del historial
   */
  calculateStats() {
    const history = this.currentStatus.executionHistory;
    
    if (history.length === 0) {
      return {
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        cancelledExecutions: 0,
        successRate: 0,
        averageDuration: 0,
        totalRecordsProcessed: 0,
        lastSuccessfulExecution: null
      };
    }

    const successful = history.filter(ex => ex.status === 'completed');
    const failed = history.filter(ex => ex.status === 'failed');
    const cancelled = history.filter(ex => ex.status === 'cancelled');

    const totalRecords = history.reduce((sum, ex) => sum + (ex.recordsProcessed || 0), 0);
    const validDurations = history.filter(ex => ex.duration != null).map(ex => ex.duration);
    const avgDuration = validDurations.length > 0 
      ? validDurations.reduce((sum, d) => sum + d, 0) / validDurations.length 
      : 0;

    const lastSuccessful = successful.length > 0 
      ? successful[successful.length - 1] 
      : null;

    return {
      totalExecutions: history.length,
      successfulExecutions: successful.length,
      failedExecutions: failed.length,
      cancelledExecutions: cancelled.length,
      successRate: (successful.length / history.length * 100).toFixed(1) + '%',
      averageDuration: Math.round(avgDuration),
      totalRecordsProcessed: totalRecords,
      lastSuccessfulExecution: lastSuccessful
    };
  }

  /**
   * Agrega una ejecución al historial
   */
  addToHistory(execution) {
    this.currentStatus.executionHistory.push({ ...execution });

    // Mantener solo las últimas N ejecuciones
    if (this.currentStatus.executionHistory.length > this.maxHistorySize) {
      this.currentStatus.executionHistory.shift();
    }
  }

  /**
   * Genera un ID único para la ejecución
   */
  generateExecutionId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `exec_${timestamp}_${random}`;
  }

  /**
   * Serializa un error para el almacenamiento
   */
  serializeError(error) {
    if (!error) return null;

    return {
      message: error.message || 'Error desconocido',
      type: error.type || 'UNKNOWN_ERROR',
      code: error.code || null,
      statusCode: error.statusCode || null,
      stack: error.stack || null,
      details: error.details || null
    };
  }

  /**
   * Verifica si se puede iniciar un nuevo proceso
   */
  canStartNewProcess() {
    return !this.currentStatus.isRunning;
  }

  /**
   * Obtiene información sobre la ejecución actual
   */
  getCurrentExecution() {
    return this.currentStatus.lastExecution;
  }

  /**
   * Limpia el historial de ejecuciones
   */
  clearHistory() {
    this.currentStatus.executionHistory = [];
    logOperations.cron.info('Historial de ejecuciones limpiado');
  }

  /**
   * Obtiene métricas de rendimiento
   */
  getPerformanceMetrics() {
    const history = this.currentStatus.executionHistory;
    const now = new Date();
    
    // Ejecuciones de las últimas 24 horas
    const last24Hours = history.filter(ex => {
      const execTime = new Date(ex.startedAt);
      return (now.getTime() - execTime.getTime()) < (24 * 60 * 60 * 1000);
    });

    // Ejecuciones de la última hora
    const lastHour = history.filter(ex => {
      const execTime = new Date(ex.startedAt);
      return (now.getTime() - execTime.getTime()) < (60 * 60 * 1000);
    });

    return {
      last24Hours: {
        count: last24Hours.length,
        successful: last24Hours.filter(ex => ex.status === 'completed').length,
        failed: last24Hours.filter(ex => ex.status === 'failed').length,
        recordsProcessed: last24Hours.reduce((sum, ex) => sum + (ex.recordsProcessed || 0), 0)
      },
      lastHour: {
        count: lastHour.length,
        successful: lastHour.filter(ex => ex.status === 'completed').length,
        failed: lastHour.filter(ex => ex.status === 'failed').length,
        recordsProcessed: lastHour.reduce((sum, ex) => sum + (ex.recordsProcessed || 0), 0)
      }
    };
  }

  /**
   * Exporta el estado completo para backup/debugging
   */
  exportState() {
    return {
      currentStatus: { ...this.currentStatus },
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    };
  }

  /**
   * Importa un estado previamente exportado
   */
  importState(state) {
    if (state && state.currentStatus) {
      this.currentStatus = { ...state.currentStatus };
      logOperations.cron.info('Estado importado exitosamente');
      return true;
    }
    return false;
  }
}

// Crear instancia singleton
const processStatus = new ProcessStatusService();

module.exports = processStatus;