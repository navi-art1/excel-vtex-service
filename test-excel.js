/**
 * Script de prueba para validar la lectura del archivo Excel
 */

require('dotenv').config();

const excelService = require('./src/services/excelService');
const { logOperations } = require('./src/utils/logger');

async function testExcel() {
  try {
    console.log('🧪 Iniciando prueba de lectura de Excel...\n');

    // Intentar leer y convertir el Excel directamente
    console.log('📊 Procesando archivo Excel...');
    const jsonData = await excelService.readExcelAndConvert();

    console.log(`✅ Excel procesado exitosamente!`);
    console.log(`📈 Registros encontrados: ${jsonData.length}`);

    if (jsonData.length > 0) {
      console.log('\n📋 Muestra de los primeros 3 registros:');
      jsonData.slice(0, 3).forEach((record, index) => {
        console.log(`\n   Registro ${index + 1}:`);
        Object.keys(record).forEach(key => {
          if (key !== '_metadata') {
            const value = record[key];
            const displayValue = typeof value === 'string' && value.length > 50 
              ? value.substring(0, 50) + '...' 
              : value;
            console.log(`     ${key}: ${displayValue}`);
          }
        });
      });
    }

    // Mostrar estadísticas
    const stats = excelService.getLastProcessingStats();
    console.log('\n📊 Estadísticas de procesamiento:');
    console.log(`   Registros procesados: ${stats.recordCount}`);
    console.log(`   Última ejecución: ${stats.lastProcessedTime}`);
    console.log(`   Tiene datos: ${stats.hasData}`);

    // Mostrar muestra de datos
    const sampleData = excelService.getSampleData(2);
    if (sampleData) {
      console.log('\n📝 Muestra adicional de datos:');
      console.log(JSON.stringify(sampleData, null, 2));
    }

    console.log('\n✅ Prueba completada exitosamente!');

  } catch (error) {
    console.error('❌ Error en la prueba:', error.message);
    if (error.details) {
      console.error('Detalles:', error.details);
    }
    console.error('Stack:', error.stack);
  }
}

// Ejecutar la prueba
testExcel();