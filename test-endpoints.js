/**
 * Script de prueba para todos los endpoints de la API
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

// Configurar axios para mostrar errores más claros
axios.defaults.timeout = 10000;

/**
 * Función auxiliar para hacer requests con manejo de errores
 */
async function makeRequest(method, endpoint, data = null, headers = {}) {
  try {
    console.log(`\n🔄 ${method.toUpperCase()} ${endpoint}`);
    
    const config = {
      method,
      url: `${BASE_URL}${endpoint}`,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    if (data) {
      config.data = data;
    }

    const response = await axios(config);
    
    console.log(`✅ Status: ${response.status} ${response.statusText}`);
    console.log(`📊 Response:`);
    console.log(JSON.stringify(response.data, null, 2));
    
    return response.data;

  } catch (error) {
    console.log(`❌ Error: ${error.response?.status || 'Network Error'}`);
    if (error.response?.data) {
      console.log(`📋 Error Details:`);
      console.log(JSON.stringify(error.response.data, null, 2));
    } else {
      console.log(`📋 Error Message: ${error.message}`);
    }
    return null;
  }
}

/**
 * Función principal de pruebas
 */
async function runTests() {
  console.log('🚀 Iniciando pruebas de endpoints del Excel-VTEX Service\n');
  console.log('=' .repeat(60));

  // Test 1: Health Check
  console.log('\n🏥 TEST 1: Health Check');
  console.log('-'.repeat(30));
  await makeRequest('GET', '/health');

  // Test 2: Status del sistema
  console.log('\n📊 TEST 2: Status del Sistema');
  console.log('-'.repeat(30));
  await makeRequest('GET', '/api/status');

  // Test 3: Configuración del sistema
  console.log('\n⚙️ TEST 3: Configuración del Sistema');
  console.log('-'.repeat(30));
  await makeRequest('GET', '/api/config');

  // Test 4: Estadísticas de logs
  console.log('\n📝 TEST 4: Estadísticas de Logs');
  console.log('-'.repeat(30));
  await makeRequest('GET', '/api/logs');

  // Test 5: Historial de procesos
  console.log('\n📈 TEST 5: Historial de Procesos');
  console.log('-'.repeat(30));
  await makeRequest('GET', '/api/process-history');

  // Test 6: Prueba de lectura de Excel (sin autenticación si está deshabilitada)
  console.log('\n📊 TEST 6: Prueba de Lectura de Excel');
  console.log('-'.repeat(30));
  await makeRequest('POST', '/api/test-excel');

  // Test 7: Prueba de conexión VTEX (se espera que falle porque no tenemos credenciales reales)
  console.log('\n🔗 TEST 7: Prueba de Conexión VTEX');
  console.log('-'.repeat(30));
  await makeRequest('POST', '/api/test-vtex');

  // Test 8: Force Update (el más importante)
  console.log('\n🔄 TEST 8: Forzar Actualización (Force Update)');
  console.log('-'.repeat(30));
  console.log('⚠️  Nota: Este test procesará el Excel y intentará enviar a VTEX');
  console.log('    Se espera que falle en el envío a VTEX por credenciales no configuradas');
  await makeRequest('POST', '/api/force-update');

  console.log('\n' + '='.repeat(60));
  console.log('✅ Pruebas completadas!');
  console.log('\n💡 Notas importantes:');
  console.log('   - Los endpoints básicos deberían funcionar correctamente');
  console.log('   - Los tests de VTEX fallarán hasta configurar credenciales reales');
  console.log('   - El procesamiento de Excel debería ser exitoso');
}

// Ejecutar las pruebas
runTests().catch(error => {
  console.error('❌ Error ejecutando pruebas:', error.message);
});