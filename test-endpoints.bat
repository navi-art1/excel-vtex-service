@echo off
echo 🚀 Probando endpoints del Excel-VTEX Service
echo ===========================================
echo.

echo 🏥 Test 1: Health Check
echo ------------------------
curl -s http://localhost:3000/health | jq .
echo.

echo 📊 Test 2: Status del Sistema  
echo -----------------------------
curl -s http://localhost:3000/api/status | jq .
echo.

echo ⚙️ Test 3: Configuración
echo -------------------------
curl -s http://localhost:3000/api/config | jq .
echo.

echo 📝 Test 4: Logs
echo ----------------
curl -s http://localhost:3000/api/logs | jq .
echo.

echo 📈 Test 5: Historial de Procesos
echo ----------------------------------
curl -s http://localhost:3000/api/process-history | jq .
echo.

echo 📊 Test 6: Prueba de Excel
echo ---------------------------
curl -s -X POST http://localhost:3000/api/test-excel | jq .
echo.

echo 🔗 Test 7: Prueba de VTEX
echo --------------------------
curl -s -X POST http://localhost:3000/api/test-vtex | jq .
echo.

echo ✅ Pruebas completadas!
pause