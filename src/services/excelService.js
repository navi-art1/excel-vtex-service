/**
 * Servicio para leer y procesar archivos Excel
 * Convierte los datos del Excel en JSON estructurado
 */

const XLSX = require('xlsx');
const fs = require('fs').promises;
const path = require('path');
const { config } = require('../config/env');
const { logOperations } = require('../utils/logger');
const { createError } = require('../utils/errorHandler');

/**
 * Servicio principal para manejo de archivos Excel
 */
class ExcelService {
  constructor() {
    this.lastProcessedData = null;
    this.lastProcessedTime = null;
  }

  /**
   * Verifica si el archivo Excel existe y es accesible
   */
  async validateExcelFile() {
    try {
      const filePath = path.resolve(config.files.excelPath);
      
      // Verificar si el archivo existe
      await fs.access(filePath);
      
      // Obtener información del archivo
      const stats = await fs.stat(filePath);
      
      if (!stats.isFile()) {
        throw createError.excel('La ruta especificada no es un archivo');
      }

      // Verificar extensión
      const ext = path.extname(filePath).toLowerCase();
      if (!['.xlsx', '.xls'].includes(ext)) {
        throw createError.excel('El archivo debe ser .xlsx o .xls');
      }

      logOperations.excel.info(`Archivo Excel validado: ${filePath}`, {
        size: stats.size,
        modified: stats.mtime
      });

      return {
        path: filePath,
        size: stats.size,
        modified: stats.mtime,
        extension: ext
      };

    } catch (error) {
      if (error.code === 'ENOENT') {
        throw createError.excel(`Archivo no encontrado: ${config.files.excelPath}`);
      }
      if (error.code === 'EACCES') {
        throw createError.excel(`Sin permisos para acceder al archivo: ${config.files.excelPath}`);
      }
      throw error;
    }
  }

  /**
   * Lee el archivo Excel y lo convierte a JSON
   */
  async readExcelAndConvert() {
    try {

  logOperations.excel.info('Buscando y descargando el archivo Excel más reciente de GCP (carpeta Archivos_sheets/) antes de procesar...');
  const { downloadLatestExcelFromGCPFolder } = require('./gcpDownloadService');
  const bucketName = 'bucket-sheetbridge-prd-data';
  const folder = 'Archivos_sheets/';
  const destPath = path.resolve(config.files.excelPath);
  const latestFile = await downloadLatestExcelFromGCPFolder(bucketName, folder, destPath);
  this._latestGcpExcelFile = latestFile;
  logOperations.excel.info(`Archivo Excel más reciente (${latestFile}) descargado de GCP. Iniciando lectura...`);

      // Validar archivo
      const fileInfo = await this.validateExcelFile();

      // Leer el archivo Excel
      const workbook = XLSX.readFile(fileInfo.path);

      // Verificar que el archivo tenga hojas
      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        throw createError.excel('El archivo Excel no contiene hojas válidas');
      }

      logOperations.excel.info(`Archivo contiene ${workbook.SheetNames.length} hoja(s): ${workbook.SheetNames.join(', ')}`);

      // Procesar solo las hojas permitidas
      const allowedSheets = ["RD", "skus", "PROD", "Skus","Cintillos"];
      const allSheetsData = {};
      let totalRecords = 0;

      for (const sheetName of workbook.SheetNames) {
        if (!allowedSheets.includes(sheetName)) {
          logOperations.excel.info(`Saltando hoja no permitida: ${sheetName}`);
          continue;
        }
        try {
          logOperations.excel.info(`Procesando hoja: ${sheetName}`);
          const worksheet = workbook.Sheets[sheetName];
          if (!worksheet) {
            logOperations.excel.warn(`No se pudo leer la hoja: ${sheetName}`);
            continue;
          }
          // Convertir a JSON
          const rawData = XLSX.utils.sheet_to_json(worksheet, {
            header: 1, // Usar índices numéricos como headers
            defval: '', // Valor por defecto para celdas vacías
            blankrows: false // Omitir filas completamente vacías
          });
          if (rawData.length === 0) {
            logOperations.excel.warn(`La hoja ${sheetName} está vacía`);
            allSheetsData[sheetName] = [];
            continue;
          }
          // Procesar y estructurar los datos de esta hoja
          const processedData = this.processRawData(rawData, sheetName);
          allSheetsData[sheetName] = processedData;
          totalRecords += processedData.length;
          logOperations.excel.info(`Hoja ${sheetName} procesada: ${processedData.length} registros`);
        } catch (error) {
          logOperations.excel.error(`Error procesando hoja ${sheetName}`, error);
          allSheetsData[sheetName] = [];
        }
      }
      // Crear estructura final solo con las hojas permitidas
      const finalData = {
        metadata: {
          processedAt: new Date().toISOString(),
          totalSheets: Object.keys(allSheetsData).length,
          totalRecords: totalRecords,
          sourceFile: fileInfo.path,
          sheetNames: Object.keys(allSheetsData),
          version: "1.0"
        },
        sheets: allSheetsData
      };
      // Guardar los datos procesados
      await this.saveProcessedData(finalData);
      this.lastProcessedData = finalData;
      this.lastProcessedTime = new Date();
      logOperations.excel.info(`Excel procesado exitosamente. ${totalRecords} registros extraídos de ${Object.keys(allSheetsData).length} hojas`);
      return finalData;

    } catch (error) {
      logOperations.excel.error('Error procesando archivo Excel', error);
      throw error;
    }
  }

  /**
   * Procesa los datos raw del Excel y los estructura
   */
  processRawData(rawData, sheetName = 'Unknown') {
    try {
      if (rawData.length < 2) {
        logOperations.excel.warn(`La hoja ${sheetName} no tiene suficientes datos (debe tener al menos headers y una fila de datos)`);
        return [];
      }

      // La primera fila contiene los headers
      const headers = rawData[0];
      const dataRows = rawData.slice(1);

      logOperations.excel.info(`Hoja ${sheetName} - Headers encontrados: ${headers.length}`, { headers });

      // Procesar cada fila de datos
      const processedData = dataRows
        .filter(row => this.isValidRow(row)) // Filtrar filas vacías o inválidas
        .map((row, index) => {
          try {
            return this.processRow(headers, row, index + 2, sheetName); // +2 porque Excel empieza en 1 y saltamos header
          } catch (error) {
            logOperations.excel.warn(`Error procesando fila ${index + 2} en hoja ${sheetName}: ${error.message}`);
            return null;
          }
        })
        .filter(row => row !== null)
        .filter(row => row.visible === true); // Solo incluir filas con visible === true

      logOperations.excel.info(`Hoja ${sheetName} - Datos procesados: ${processedData.length} registros válidos de ${dataRows.length} filas`);

      return processedData;

    } catch (error) {
      logOperations.excel.error(`Error estructurando datos de la hoja ${sheetName}`, error);
      throw createError.excel(`Error al procesar la estructura de datos de la hoja ${sheetName}`, { error: error.message });
    }
  }

  /**
   * Procesa una fila individual del Excel
   */
  processRow(headers, row, rowNumber, sheetName = 'Unknown') {
    const processedRow = {
      _metadata: {
        sourceSheet: sheetName,
        sourceRow: rowNumber,
        processedAt: new Date().toISOString()
      }
    };

    headers.forEach((header, index) => {
      if (header && header.trim()) {
        const cellValue = row[index];
        const cleanHeader = this.cleanHeaderName(header);
        processedRow[cleanHeader] = this.processCellValue(cellValue, header);
      }
    });

    // Validaciones específicas (personalizable según tus necesidades)
    this.validateRowData(processedRow, rowNumber, sheetName);

    return processedRow;
  }

  /**
   * Limpia y normaliza los nombres de los headers
   */
  cleanHeaderName(header) {
    return header
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_') // Espacios por underscore
      .replace(/[^\w\s]/gi, '') // Remover caracteres especiales
      .replace(/_{2,}/g, '_') // Múltiples underscores por uno solo
      .replace(/^_|_$/g, ''); // Remover underscores al inicio/final
  }

  /**
   * Procesa el valor de una celda individual
   */
  processCellValue(value, header) {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    // Si es un número en Excel, ya viene como número
    if (typeof value === 'number') {
      return value;
    }

    // Si es string, intentar conversiones inteligentes
    if (typeof value === 'string') {
      const trimmed = value.trim();
      
      // Intentar convertir números
      if (/^\d+\.?\d*$/.test(trimmed)) {
        const num = parseFloat(trimmed);
        return !isNaN(num) ? num : trimmed;
      }

      // Intentar convertir fechas (si el header sugiere que es fecha)
      if (header.toLowerCase().includes('fecha') || header.toLowerCase().includes('date')) {
        const date = new Date(trimmed);
        if (!isNaN(date.getTime())) {
          return date.toISOString();
        }
      }

      return trimmed;
    }

    return value;
  }

  /**
   * Valida si una fila tiene datos útiles
   */
  isValidRow(row) {
    if (!row || !Array.isArray(row)) {
      return false;
    }

    // Verificar si la fila tiene al menos un valor no vacío
    return row.some(cell => 
      cell !== null && 
      cell !== undefined && 
      cell !== '' && 
      String(cell).trim() !== ''
    );
  }

  /**
   * Valida los datos de una fila procesada
   */
  validateRowData(rowData, rowNumber, sheetName = 'Unknown') {
    // Validaciones personalizables según tus necesidades
    // Por ejemplo, verificar campos obligatorios
    
    const requiredFields = []; // Agregar campos obligatorios aquí
    
    for (const field of requiredFields) {
      if (!rowData[field] || rowData[field] === null) {
        logOperations.excel.warn(`Campo requerido '${field}' faltante en fila ${rowNumber} de hoja ${sheetName}`);
      }
    }
  }

  /**
   * Guarda los datos procesados en un archivo JSON
   */
  async saveProcessedData(data) {
    try {
      const outputPath = path.resolve(config.files.outputJsonPath);
      const outputDir = path.dirname(outputPath);

      // Crear directorio si no existe
      await fs.mkdir(outputDir, { recursive: true });

      // Crear objeto con metadata
      const outputData = {
        metadata: {
          processedAt: new Date().toISOString(),
          recordCount: data.length,
          sourceFile: config.files.excelPath,
          version: '1.0'
        },
        data: data
      };

      // Guardar como JSON
      await fs.writeFile(outputPath, JSON.stringify(outputData, null, 2), 'utf8');
      logOperations.excel.info(`Datos guardados en: ${outputPath}`);

      // Subir a VTEX después de guardar exitosamente
      try {
        const { uploadFileToVtexPortal } = require('./uploadOutputToPortalModule');
        const fileName = 'googlesheet.json';
        const uploadResult = await uploadFileToVtexPortal(outputPath, fileName);
        if (uploadResult) {
          logOperations.excel.info('Archivo JSON subido exitosamente a VTEX');
        } else {
          logOperations.excel.error('Error al subir el archivo JSON a VTEX');
        }
      } catch (uploadErr) {
        logOperations.excel.error('Error inesperado al intentar subir el archivo JSON a VTEX', uploadErr);
      }

      // Subir el JSON a GCP como log para el usuario
      try {
        const { uploadJsonToGCP, moveFileInGCP } = require('./gcpDownloadService');
        const bucketName = 'bucket-sheetbridge-prd-data';
        const destFolder = 'Publicaciones_json_vtex';
        // Usar nombre con fecha/hora para evitar sobrescribir
        const now = new Date();
        const destFileName = `googleSheet_${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}${String(now.getSeconds()).padStart(2,'0')}.json`;
        await uploadJsonToGCP(bucketName, destFolder, outputPath, destFileName);
        logOperations.excel.info(`Archivo JSON subido a GCP en Publicaciones_json_vtex/${destFileName}`);

        // Mover el Excel procesado a la carpeta Publicaciones_json_vtex (evita reprocesos)
        if (this._latestGcpExcelFile) {
          const srcPath = this._latestGcpExcelFile;
          const destPath = `Publicaciones_json_vtex/${path.basename(srcPath)}`;
          await moveFileInGCP(bucketName, srcPath, destPath);
          logOperations.excel.info(`Archivo Excel procesado movido en GCP de ${srcPath} a ${destPath}`);
        }
      } catch (gcpErr) {
        logOperations.excel.error('Error al subir el archivo JSON o mover el Excel en GCP (Publicaciones_json_vtex)', gcpErr);
      }

    } catch (error) {
      logOperations.excel.error('Error guardando datos procesados', error);
      throw createError.excel('Error al guardar el archivo JSON', { error: error.message });
    }
  }
}

module.exports = new ExcelService();