/**
 * Punto de entrada principal de la aplicación
 * Inicializa el servidor y los servicios
 */

const { config, validateConfig, printConfig } = require('./src/config/env');
const { startServer } = require('./src/app');
const { logOperations } = require('./src/utils/logger');
const scheduledService = require('./src/services/scheduledService');

/**
 * Función principal para inicializar la aplicación
 */
async function main() {
  try {
    console.log('🔧 Iniciando Excel-VTEX Service...\n');

    // 1. Validar configuración
    console.log('🔍 Validando configuración...');
    if (!validateConfig()) {
      console.error('❌ Error en la configuración. Abortando inicio.');
      process.exit(1);
    }
    console.log('✅ Configuración válida\n');

    // 2. Mostrar configuración
    printConfig();
    console.log('');

    // 3. Inicializar el servidor Express
    console.log('🌐 Iniciando servidor HTTP...');
    const server = startServer();
    
    // 4. Inicializar el servicio programado (cron job)
    console.log('⏰ Iniciando servicio programado...');
    await scheduledService.start();
    
    console.log('✅ Aplicación iniciada correctamente\n');
    console.log('📋 Endpoints disponibles:');
    console.log(`   GET  /health           - Estado del servidor`);
    console.log(`   GET  /api/status       - Estado del último proceso`);
    console.log(`   POST /api/force-update - Forzar actualización manual`);
    console.log(`   GET  /api/logs         - Ver estadísticas de logs`);
    console.log('');

    logOperations.api.info('Aplicación iniciada correctamente');

    // 5. Manejar señales de cierre
    process.on('SIGTERM', async () => {
      console.log('\n🛑 Recibida señal SIGTERM...');
      await gracefulShutdown(server);
    });

    process.on('SIGINT', async () => {
      console.log('\n🛑 Recibida señal SIGINT...');
      await gracefulShutdown(server);
    });

  } catch (error) {
    console.error('❌ Error al iniciar la aplicación:', error.message);
    logOperations.api.error('Error al iniciar la aplicación', error);
    process.exit(1);
  }
}

/**
 * Función para cerrar la aplicación de manera graceful
 */
async function gracefulShutdown(server) {
  try {
    console.log('🔄 Iniciando cierre graceful...');
    
    // Detener el servicio programado
    await scheduledService.stop();
    console.log('✅ Servicio programado detenido');
    
    // Cerrar el servidor HTTP
    server.close(() => {
      console.log('✅ Servidor HTTP cerrado');
      console.log('👋 Aplicación cerrada correctamente');
      process.exit(0);
    });

    // Timeout de seguridad
    setTimeout(() => {
      console.error('❌ Timeout alcanzado. Forzando cierre...');
      process.exit(1);
    }, 10000);

  } catch (error) {
    console.error('❌ Error durante el cierre:', error.message);
    process.exit(1);
  }
}

// Iniciar la aplicación
if (require.main === module) {
  main();
}

module.exports = { main };