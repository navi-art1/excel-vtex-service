# Script de pruebas para endpoints usando PowerShell nativo
Write-Host "🚀 Probando endpoints del Excel-VTEX Service" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
Write-Host ""

function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Method = "GET",
        [string]$Url
    )
    
    Write-Host "🧪 $Name" -ForegroundColor Yellow
    Write-Host ("-" * 40) -ForegroundColor Gray
    
    try {
        if ($Method -eq "GET") {
            $response = Invoke-RestMethod -Uri $Url -Method GET -TimeoutSec 5
        } else {
            $response = Invoke-RestMethod -Uri $Url -Method POST -TimeoutSec 5 -ContentType "application/json"
        }
        
        Write-Host "✅ Status: OK" -ForegroundColor Green
        Write-Host "📊 Response:" -ForegroundColor Cyan
        Write-Host ($response | ConvertTo-Json -Depth 3)
        Write-Host ""
        
    } catch {
        Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
        if ($_.Exception.Response) {
            Write-Host "Status Code: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
        }
        Write-Host ""
    }
}

# Verificar que el servidor esté corriendo
try {
    Test-Connection -ComputerName "localhost" -Port 3000 -Count 1 -Quiet
    Write-Host "✅ Servidor detectado en puerto 3000" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "❌ No se puede conectar al servidor en puerto 3000" -ForegroundColor Red
    Write-Host "   Asegúrate de que el servidor esté corriendo con: npm start" -ForegroundColor Yellow
    exit 1
}

# Ejecutar pruebas
Test-Endpoint -Name "Health Check" -Url "http://localhost:3000/health"
Test-Endpoint -Name "Status del Sistema" -Url "http://localhost:3000/api/status"  
Test-Endpoint -Name "Configuración" -Url "http://localhost:3000/api/config"
Test-Endpoint -Name "Estadísticas de Logs" -Url "http://localhost:3000/api/logs"
Test-Endpoint -Name "Historial de Procesos" -Url "http://localhost:3000/api/process-history"
Test-Endpoint -Name "Prueba de Excel" -Method "POST" -Url "http://localhost:3000/api/test-excel"
Test-Endpoint -Name "Prueba de VTEX" -Method "POST" -Url "http://localhost:3000/api/test-vtex"

Write-Host "🎉 Pruebas completadas!" -ForegroundColor Green
Write-Host ""
Write-Host "💡 Notas importantes:" -ForegroundColor Cyan
Write-Host "   - Los endpoints básicos deberían funcionar correctamente" -ForegroundColor White
Write-Host "   - Los tests de VTEX fallarán hasta configurar credenciales reales" -ForegroundColor White
Write-Host "   - El procesamiento de Excel debería ser exitoso" -ForegroundColor White