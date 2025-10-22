/**
 * Servicio para enviar datos a la API de VTEX
 * Maneja la autenticación y envío de datos procesados
 */

const axios = require('axios');
const { config } = require('../config/env');
const { logOperations } = require('../utils/logger');
const { createError } = require('../utils/errorHandler');

/**
 * Servicio principal para comunicación con VTEX
 */
class VtexService {
  constructor() {
    this.apiClient = null;
    this.lastResponse = null;
    this.requestStats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      lastRequestTime: null
    };
    
    this.initializeApiClient();
  }

  /**
   * Inicializa el cliente HTTP para VTEX
   */
  initializeApiClient() {
    this.apiClient = axios.create({
      baseURL: config.vtex.apiUrl,
      timeout: 30000, // 30 segundos
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-VTEX-API-AppKey': config.vtex.appKey,
        'X-VTEX-API-AppToken': config.vtex.appToken,
        'User-Agent': 'excel-vtex-service/1.0.0'
      }
    });

    // Interceptor para logging de requests
    this.apiClient.interceptors.request.use(
      (config) => {
        logOperations.vtex.info(`Enviando request: ${config.method?.toUpperCase()} ${config.url}`);
        this.requestStats.totalRequests++;
        this.requestStats.lastRequestTime = new Date();
        return config;
      },
      (error) => {
        logOperations.vtex.error('Error en interceptor de request', error);
        return Promise.reject(error);
      }
    );

    // Interceptor para logging de responses
    this.apiClient.interceptors.response.use(
      (response) => {
        logOperations.vtex.success(`Response exitoso: ${response.status} ${response.statusText}`);
        this.requestStats.successfulRequests++;
        return response;
      },
      (error) => {
        this.requestStats.failedRequests++;
        logOperations.vtex.error('Error en response de VTEX', error);
        return Promise.reject(this.handleVtexError(error));
      }
    );
  }

  /**
   * Prueba la conexión con VTEX sin enviar datos reales
   */
  async testConnection() {
    try {
      logOperations.vtex.info('Probando conexión con VTEX');

      // Endpoint de prueba (ajustar según la API de VTEX disponible)
      // Esto podría ser un endpoint de status o un GET básico
      const response = await this.apiClient.get('/status', {
        timeout: 10000
      });

      logOperations.vtex.success('Conexión con VTEX exitosa');

      return {
        status: 'connected',
        statusCode: response.status,
        responseTime: new Date() - this.requestStats.lastRequestTime,
        vtexAccount: config.vtex.account
      };

    } catch (error) {
      logOperations.vtex.error('Error probando conexión con VTEX', error);
      
      return {
        status: 'error',
        error: error.message,
        statusCode: error.response?.status || null,
        vtexAccount: config.vtex.account
      };
    }
  }

  /**
   * Envía datos a VTEX
   */
  async sendData(jsonData) {
    try {
      if (!jsonData || !Array.isArray(jsonData) || jsonData.length === 0) {
        throw createError.validation('No hay datos para enviar a VTEX');
      }

      logOperations.vtex.info(`Iniciando envío de ${jsonData.length} registros a VTEX`);

      // Procesar datos en lotes si es necesario
      const batchSize = this.getBatchSize();
      const batches = this.createBatches(jsonData, batchSize);

      logOperations.vtex.info(`Dividiendo en ${batches.length} lotes de máximo ${batchSize} registros`);

      const results = [];
      let successCount = 0;
      let errorCount = 0;

      // Procesar cada lote
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        logOperations.vtex.info(`Procesando lote ${i + 1}/${batches.length} (${batch.length} registros)`);

        try {
          const batchResult = await this.sendBatch(batch, i + 1);
          results.push(batchResult);
          successCount += batch.length;
          
          // Delay entre lotes para no sobrecargar la API
          if (i < batches.length - 1) {
            await this.delay(1000); // 1 segundo entre lotes
          }

        } catch (batchError) {
          logOperations.vtex.error(`Error en lote ${i + 1}`, batchError);
          errorCount += batch.length;
          results.push({
            batchNumber: i + 1,
            success: false,
            error: batchError.message,
            recordCount: batch.length
          });
        }
      }

      const finalResult = {
        success: errorCount === 0,
        totalRecords: jsonData.length,
        successfulRecords: successCount,
        failedRecords: errorCount,
        batchResults: results,
        timestamp: new Date().toISOString()
      };

      this.lastResponse = finalResult;

      if (errorCount === 0) {
        logOperations.vtex.success(`Todos los datos enviados exitosamente a VTEX (${successCount} registros)`);
      } else {
        logOperations.vtex.warn(`Envío parcialmente exitoso: ${successCount} exitosos, ${errorCount} con errores`);
      }

      return finalResult;

    } catch (error) {
      logOperations.vtex.error('Error general enviando datos a VTEX', error);
      throw error;
    }
  }

  /**
   * Envía un lote específico de datos
   */
  async sendBatch(batchData, batchNumber) {
    try {
      // Preparar payload para VTEX
      const payload = this.prepareVtexPayload(batchData);

      // Realizar la petición
      const response = await this.apiClient.post(config.vtex.endpoint, payload);

      logOperations.vtex.success(`Lote ${batchNumber} enviado exitosamente`);

      return {
        batchNumber,
        success: true,
        recordCount: batchData.length,
        vtexResponse: {
          status: response.status,
          statusText: response.statusText,
          data: response.data
        }
      };

    } catch (error) {
      logOperations.vtex.error(`Error enviando lote ${batchNumber}`, error);
      throw error;
    }
  }

  /**
   * Prepara el payload según el formato esperado por VTEX
   */
  prepareVtexPayload(data) {
    // Este formato debe ajustarse según los requerimientos específicos de VTEX
    // Ejemplo genérico:
    
    return {
      // Metadata del envío
      metadata: {
        source: 'excel-vtex-service',
        timestamp: new Date().toISOString(),
        recordCount: data.length,
        account: config.vtex.account
      },
      
      // Datos principales
      items: data.map(item => {
        // Remover metadata interna antes del envío
        const { _metadata, ...cleanItem } = item;
        
        // Agregar campos requeridos por VTEX si es necesario
        return {
          ...cleanItem,
          // Agregar campos específicos de VTEX aquí
          // Por ejemplo:
          // id: cleanItem.id || generateId(),
          // status: 'active',
          // lastModified: new Date().toISOString()
        };
      })
    };
  }

  /**
   * Crea lotes de datos para procesamiento
   */
  createBatches(data, batchSize) {
    const batches = [];
    for (let i = 0; i < data.length; i += batchSize) {
      batches.push(data.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Obtiene el tamaño de lote óptimo
   */
  getBatchSize() {
    // Tamaño de lote por defecto
    // Puede ser configurado según los límites de VTEX
    return parseInt(process.env.VTEX_BATCH_SIZE) || 100;
  }

  /**
   * Maneja errores específicos de VTEX
   */
  handleVtexError(error) {
    let statusCode = 500;
    let message = 'Error de comunicación con VTEX';
    let details = {};

    if (error.response) {
      // Error de respuesta HTTP
      statusCode = error.response.status;
      details.responseData = error.response.data;
      details.headers = error.response.headers;

      switch (statusCode) {
        case 400:
          message = 'Datos inválidos enviados a VTEX';
          break;
        case 401:
          message = 'Credenciales de VTEX inválidas';
          break;
        case 403:
          message = 'Acceso prohibido a la API de VTEX';
          break;
        case 404:
          message = 'Endpoint de VTEX no encontrado';
          break;
        case 429:
          message = 'Límite de rate de VTEX excedido';
          break;
        case 500:
          message = 'Error interno en el servidor de VTEX';
          break;
        default:
          message = `Error HTTP ${statusCode} de VTEX`;
      }
    } else if (error.request) {
      // Error de red
      message = 'No se pudo conectar con VTEX';
      details.requestError = error.message;
    } else {
      // Error de configuración
      message = 'Error configurando petición a VTEX';
      details.configError = error.message;
    }

    return createError.vtex(message, statusCode, details);
  }

  /**
   * Función de delay/espera
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Obtiene estadísticas de las peticiones
   */
  getRequestStats() {
    return {
      ...this.requestStats,
      successRate: this.requestStats.totalRequests > 0 
        ? (this.requestStats.successfulRequests / this.requestStats.totalRequests * 100).toFixed(2) + '%'
        : '0%'
    };
  }

  /**
   * Obtiene la última respuesta de VTEX
   */
  getLastResponse() {
    return this.lastResponse;
  }

  /**
   * Resetea las estadísticas
   */
  resetStats() {
    this.requestStats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      lastRequestTime: null
    };
    this.lastResponse = null;
  }
}

// Crear instancia singleton
const vtexService = new VtexService();

module.exports = vtexService;