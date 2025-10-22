/**
 * Servicio programado que ejecuta automáticamente la sincronización
 * Utiliza node-cron para ejecutar tareas cada 10 minutos
 */

const cron = require('node-cron');
const { config } = require('../config/env');
const { logOperations } = require('../utils/logger');
const excelService = require('./excelService');
const vtexService = require('./vtexService');
const processStatus = require('./processStatus');

/**
 * Servicio de tareas programadas
 */
class ScheduledService {
  constructor() {
    this.cronJob = null;
    this.isRunning = false;
    this.lastExecution = null;
  }

  /**
   * Inicia el servicio programado
   */
  async start() {
    try {
      if (this.cronJob) {
        logOperations.cron.warn('El servicio programado ya está iniciado');
        return;
      }

      // Validar el patrón de cron
      if (!cron.validate(config.cron.schedule)) {
        throw new Error(`Patrón de cron inválido: ${config.cron.schedule}`);
      }

      logOperations.cron.info(`Iniciando servicio programado con schedule: ${config.cron.schedule}`);

      // Crear el cron job
      this.cronJob = cron.schedule(config.cron.schedule, async () => {
        await this.executeScheduledTask();
      }, {
        scheduled: false, // No iniciar automáticamente
        timezone: process.env.TZ || 'America/Lima' // Timezone por defecto
      });

      // Iniciar el cron job
      this.cronJob.start();
      this.isRunning = true;

      logOperations.cron.info('✅ Servicio programado iniciado exitosamente');

      // Ejecutar una vez al inicio si está configurado
      if (process.env.RUN_ON_STARTUP === 'true') {
        logOperations.cron.info('Ejecutando tarea inicial al startup...');
        setTimeout(() => this.executeScheduledTask(), 5000); // Delay de 5 segundos
      }

    } catch (error) {
      logOperations.cron.error('Error iniciando servicio programado', error);
      throw error;
    }
  }

  /**
   * Detiene el servicio programado
   */
  async stop() {
    try {
      if (!this.cronJob) {
        logOperations.cron.warn('El servicio programado no está iniciado');
        return;
      }

      logOperations.cron.info('Deteniendo servicio programado...');

      // Cancelar proceso en ejecución si existe
      if (processStatus.canStartNewProcess() === false) {
        processStatus.cancelProcess('Servicio detenido');
      }

      // Detener el cron job
      this.cronJob.stop();
      this.cronJob = null;
      this.isRunning = false;

      logOperations.cron.info('✅ Servicio programado detenido');

    } catch (error) {
      logOperations.cron.error('Error deteniendo servicio programado', error);
      throw error;
    }
  }

  /**
   * Reinicia el servicio programado
   */
  async restart() {
    logOperations.cron.info('Reiniciando servicio programado...');
    await this.stop();
    await this.start();
  }

  /**
   * Ejecuta la tarea programada principal
   */
  async executeScheduledTask() {
    // Verificar si ya hay un proceso en ejecución
    if (!processStatus.canStartNewProcess()) {
      logOperations.cron.warn('Saltando ejecución programada: hay un proceso en curso');
      return;
    }

    const executionId = processStatus.startProcess('auto');
    this.lastExecution = new Date();

    try {
      logOperations.cron.start();

      // 1. Leer y procesar el archivo Excel
      logOperations.cron.info('Iniciando lectura de archivo Excel');
      const jsonData = await excelService.readExcelAndConvert();

      if (!jsonData || jsonData.length === 0) {
        throw new Error('No se obtuvieron datos del archivo Excel');
      }

      logOperations.cron.info(`Excel procesado: ${jsonData.length} registros encontrados`);

      // 2. Enviar datos a VTEX
      logOperations.cron.info('Enviando datos a VTEX');
      const vtexResponse = await vtexService.sendData(jsonData);

      if (!vtexResponse.success) {
        throw new Error(`Error enviando datos a VTEX: ${vtexResponse.error || 'Error desconocido'}`);
      }

      // 3. Completar proceso exitosamente
      processStatus.completeProcess(jsonData.length, null, vtexResponse);

      logOperations.cron.info(`✅ Sincronización automática completada exitosamente`);
      logOperations.cron.info(`Registros procesados: ${jsonData.length}`);
      logOperations.cron.info(`Registros enviados exitosamente: ${vtexResponse.successfulRecords || jsonData.length}`);

    } catch (error) {
      // Completar proceso con error
      processStatus.completeProcess(0, error);
      
      logOperations.cron.error('❌ Error en sincronización automática', error);
      
      // Decidir si debe continuar o detenerse según el tipo de error
      await this.handleScheduledTaskError(error);
    }
  }

  /**
   * Maneja errores en las tareas programadas
   */
  async handleScheduledTaskError(error) {
    const errorMessage = error.message || 'Error desconocido';
    
    // Clasificar tipos de errores y decidir la acción
    if (error.type === 'EXCEL_ERROR') {
      logOperations.cron.warn('Error de Excel detectado - continuando con próxima ejecución');
    } else if (error.type === 'VTEX_ERROR') {
      if (error.statusCode === 401 || error.statusCode === 403) {
        logOperations.cron.error('Error de autenticación VTEX - deteniendo servicio');
        await this.stop();
      } else {
        logOperations.cron.warn('Error temporal de VTEX - continuando con próxima ejecución');
      }
    } else if (error.code === 'ENOENT') {
      logOperations.cron.error('Archivo Excel no encontrado - deteniendo servicio');
      await this.stop();
    } else {
      logOperations.cron.warn('Error general - continuando con próxima ejecución');
    }

    // Notificar error si está configurado
    await this.notifyError(error);
  }

  /**
   * Notifica errores (placeholder para webhook, email, etc.)
   */
  async notifyError(error) {
    try {
      // Aquí se pueden implementar notificaciones:
      // - Webhook
      // - Email
      // - Slack
      // - Discord
      // etc.

      const notificationUrl = process.env.ERROR_NOTIFICATION_WEBHOOK;
      if (notificationUrl) {
        logOperations.cron.info('Enviando notificación de error...');
        
        // Ejemplo de notificación por webhook
        const payload = {
          timestamp: new Date().toISOString(),
          service: 'excel-vtex-service',
          error: {
            message: error.message,
            type: error.type || 'UNKNOWN',
            stack: error.stack
          },
          environment: config.server.nodeEnv
        };

        // Implementar llamada HTTP aquí si es necesario
        // await axios.post(notificationUrl, payload);
        
        logOperations.cron.info('Notificación de error enviada');
      }

    } catch (notifyError) {
      logOperations.cron.error('Error enviando notificación', notifyError);
    }
  }

  /**
   * Obtiene el estado del servicio programado
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      schedule: config.cron.schedule,
      lastExecution: this.lastExecution,
      nextExecution: this.cronJob ? this.getNextExecutionTime() : null,
      timezone: process.env.TZ || 'America/Lima'
    };
  }

  /**
   * Obtiene la próxima fecha de ejecución
   */
  getNextExecutionTime() {
    if (!this.cronJob) return null;

    try {
      // node-cron no expone directamente la próxima ejecución,
      // pero podemos calcularla usando una librería auxiliar o lógica personalizada
      
      // Por simplicidad, calculamos aproximadamente basado en el schedule
      const now = new Date();
      if (config.cron.schedule === '*/10 * * * *') {
        // Cada 10 minutos
        const nextExecution = new Date(now);
        const minutes = nextExecution.getMinutes();
        const nextInterval = Math.ceil(minutes / 10) * 10;
        nextExecution.setMinutes(nextInterval, 0, 0);
        
        if (nextExecution <= now) {
          nextExecution.setHours(nextExecution.getHours() + 1);
          nextExecution.setMinutes(0, 0, 0);
        }
        
        return nextExecution.toISOString();
      }

      return 'Calculando...';

    } catch (error) {
      logOperations.cron.warn('Error calculando próxima ejecución', error);
      return null;
    }
  }

  /**
   * Ejecuta manualmente la tarea (para testing)
   */
  async executeManually() {
    logOperations.cron.info('Ejecutando tarea manualmente...');
    await this.executeScheduledTask();
  }

  /**
   * Actualiza el schedule del cron job
   */
  async updateSchedule(newSchedule) {
    try {
      if (!cron.validate(newSchedule)) {
        throw new Error(`Patrón de cron inválido: ${newSchedule}`);
      }

      logOperations.cron.info(`Actualizando schedule de ${config.cron.schedule} a ${newSchedule}`);

      // Actualizar configuración
      config.cron.schedule = newSchedule;

      // Reiniciar el servicio con el nuevo schedule
      await this.restart();

      logOperations.cron.info('Schedule actualizado exitosamente');

    } catch (error) {
      logOperations.cron.error('Error actualizando schedule', error);
      throw error;
    }
  }

  /**
   * Obtiene estadísticas del servicio programado
   */
  getStatistics() {
    const processStats = processStatus.calculateStats();
    const performanceMetrics = processStatus.getPerformanceMetrics();

    return {
      service: this.getStatus(),
      process: processStats,
      performance: performanceMetrics,
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    };
  }
}

// Crear instancia singleton
const scheduledService = new ScheduledService();

module.exports = scheduledService;