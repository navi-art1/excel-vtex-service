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
  /**
   * Valida el archivo Excel por ruta directa
   */
  async validateExcelFileByPath(filePath) {
    try {
      await fs.access(filePath);
      const stats = await fs.stat(filePath);
      if (!stats.isFile()) {
        throw createError.excel('La ruta especificada no es un archivo');
      }
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
        throw createError.excel(`Archivo no encontrado: ${filePath}`);
      }
      if (error.code === 'EACCES') {
        throw createError.excel(`Sin permisos para acceder al archivo: ${filePath}`);
      }
      throw error;
    }
  }
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
   * Detecta el tipo de archivo según el nombre del archivo fuente
   * @param {string} fileName - Nombre del archivo Excel
   * @returns {'home'|'locations'|'sellers'|'unknown'}
   */
  detectFileType(fileName) {
    const upper = (fileName || '').toUpperCase();
    if (upper.startsWith('HOME_')) return 'home';
    if (upper.startsWith('LOCATIONS_')) return 'locations';
    if (upper.startsWith('SELLERS_')) return 'sellers';
    return 'unknown';
  }

  /**
   * Lee el archivo Excel y lo convierte a JSON
   */
  async readExcelAndConvert() {
    try {

  logOperations.excel.info('Buscando y descargando el archivo Excel más reciente de GCP (carpeta Archivos_sheets/) antes de procesar...');
  const { downloadLatestExcelFromGCPFolder } = require('./gcpDownloadService');
  const bucketName = config.gcp.bucketName;
  const folder = 'Archivos_sheets/';
  // Obtener el nombre del archivo más reciente en el bucket
  const { getLatestExcelNameAndDownload } = require('./gcpDownloadService');
  const { localPath, latestFileName, bucketFilePath } = await getLatestExcelNameAndDownload(bucketName, folder);
  this._latestGcpExcelFile = bucketFilePath;
  logOperations.excel.info(`Archivo Excel más reciente (${latestFileName}) descargado de GCP. Iniciando lectura...`);

  // Detectar tipo de archivo (home, locations, unknown)
  const fileType = this.detectFileType(latestFileName);
  this._currentFileType = fileType;
  logOperations.excel.info(`Tipo de archivo detectado: ${fileType} (archivo: ${latestFileName})`);

  // Validar archivo usando el nombre real descargado
  const fileInfo = await this.validateExcelFileByPath(localPath);

  // Leer el archivo Excel
  const workbook = XLSX.readFile(localPath);

      // Verificar que el archivo tenga hojas
      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        throw createError.excel('El archivo Excel no contiene hojas válidas');
      }

      logOperations.excel.info(`Archivo contiene ${workbook.SheetNames.length} hoja(s): ${workbook.SheetNames.join(', ')}`);

      // Procesar solo las hojas permitidas
      // Según el tipo de archivo
      const ALLOWED_SHEETS_BY_TYPE = {
        home: ["RD", "skus", "PROD", "Skus","Cintillos"],
        locations: ["DESPACHO"],
        sellers: ["Sheet1"],
      };
      const allowedSheets = ALLOWED_SHEETS_BY_TYPE[fileType] || ALLOWED_SHEETS_BY_TYPE.home;
      logOperations.excel.info(`Hojas permitidas para tipo '${fileType}': ${allowedSheets.join(', ')}`);

      let finalData;
      // === SELLERS: array de objetos ===
      if (fileType === 'sellers') {
        const sellersData = this.processSellersData(workbook, allowedSheets);
        const totalRecords = sellersData.length;
        
        finalData = {
          metadata: {
            processedAt: new Date().toLocaleString('sv-SE', { timeZone: 'America/Lima' }).replace(' ', 'T')+':00',
            totalSheets: 1,
            totalRecords: totalRecords,
            sourceFile: latestFileName,
            sheetNames: allowedSheets.filter(s => workbook.SheetNames.includes(s)),
            version: "1.0"
          },
          sheets: sellersData
        };
        await this.saveProcessedData(finalData, fileType);
        
        this.lastProcessedData = finalData;
        this.lastProcessedTime = new Date();
        logOperations.excel.info(`Sellers procesado exitosamente. ${totalRecords} registros extraídos`);

      // === LOCATIONS: array de arrays ===
      } else if (fileType === 'locations') {
        const locationsData = this.processLocationsData(workbook, allowedSheets);
        const totalRecords = locationsData.length > 0 ? locationsData.length - 1 : 0; // -1 por headers
        
        finalData = {
          metadata: {
            processedAt: new Date().toLocaleString('sv-SE', { timeZone: 'America/Lima' }).replace(' ', 'T')+':00',
            totalSheets: 1,
            totalRecords: totalRecords,
            sourceFile: latestFileName,
            sheetNames: allowedSheets.filter(s => workbook.SheetNames.includes(s)),
            version: "1.0"
          },
          sheets: locationsData
        };
        await this.saveProcessedData(finalData, fileType);
        
        this.lastProcessedData = finalData;
        this.lastProcessedTime = new Date();
        logOperations.excel.info(`Locations procesado exitosamente. ${totalRecords} registros extraídos`);

      // === HOME (y otros): estructura con metadata + sheets ===
      } else {
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
        finalData = {
          metadata: {
            processedAt: new Date().toLocaleString('sv-SE', { timeZone: 'America/Lima' }).replace(' ', 'T')+':00',
            totalSheets: Object.keys(allSheetsData).length,
            totalRecords: totalRecords,
            sourceFile: latestFileName,
            sheetNames: Object.keys(allSheetsData),
            version: "1.0"
          },
          sheets: allSheetsData
        };
        // Guardar los datos procesados
        await this.saveProcessedData(finalData, fileType);
        this.lastProcessedData = finalData;
        this.lastProcessedTime = new Date();
        logOperations.excel.info(`Excel procesado exitosamente. ${totalRecords} registros extraídos de ${Object.keys(allSheetsData).length} hojas`);
      }
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
        //.filter(row => row.visible === true); // Solo incluir filas con visible === true

      logOperations.excel.info(`Hoja ${sheetName} - Datos procesados: ${processedData.length} registros válidos de ${dataRows.length} filas`);

      return processedData;

    } catch (error) {
      logOperations.excel.error(`Error estructurando datos de la hoja ${sheetName}`, error);
      throw createError.excel(`Error al procesar la estructura de datos de la hoja ${sheetName}`, { error: error.message });
    }
  }

  /**
   * Procesa datos del Excel para Locations: devuelve array de arrays.
   * Formato: [ [headers...], [fila1...], [fila2...], ... ]
   * Valores como strings, trailing empty strings eliminados.
   */
  processLocationsData(workbook, allowedSheets) {
    const result = [];

    for (const sheetName of workbook.SheetNames) {
      if (!allowedSheets.includes(sheetName)) {
        logOperations.excel.info(`Saltando hoja no permitida: ${sheetName}`);
        continue;
      }

      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet) {
        logOperations.excel.warn(`No se pudo leer la hoja: ${sheetName}`);
        continue;
      }

      // raw: false para preservar formatos (ej: "010201" no pierde el cero)
      const rawData = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: '',
        blankrows: false,
        raw: false,
      });

      if (rawData.length < 2) {
        logOperations.excel.warn(`La hoja ${sheetName} está vacía o sin datos`);
        continue;
      }

      // Primera fila = headers (nombres originales)
      const headers = rawData[0].map(h => String(h).trim());
      result.push(headers);

      // Filas de datos
      const dataRows = rawData.slice(1).filter(row => this.isValidRow(row));

      for (const row of dataRows) {
        const stringRow = headers.map((_, colIndex) => {
          const val = row[colIndex];
          if (val === null || val === undefined || val === '') return '';
          if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
          return String(val);
        });
        // Eliminar strings vacíos del final del array
        while (stringRow.length > 0 && stringRow[stringRow.length - 1] === '') {
          stringRow.pop();
        }
        result.push(stringRow);
      }

      logOperations.excel.info(`Hoja ${sheetName} (Locations) procesada: ${dataRows.length} registros`);
    }

    logOperations.excel.info(`Locations procesado: ${result.length - 1} filas de datos + 1 fila de headers`);
    return result;
  }

  /**
   * Procesa datos del Excel para Sellers: devuelve array de objetos.
   * Mapea headers específicos de sellers al formato JSON requerido.
   * @param {object} workbook - Workbook de XLSX
   * @param {Array} allowedSheets - Lista de hojas permitidas
   * @returns {Array} Array de objetos con formato sellers
   */
  processSellersData(workbook, allowedSheets) {
    const result = [];

    for (const sheetName of workbook.SheetNames) {
      if (!allowedSheets.includes(sheetName)) {
        logOperations.excel.info(`Saltando hoja no permitida: ${sheetName}`);
        continue;
      }

      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet) {
        logOperations.excel.warn(`No se pudo leer la hoja: ${sheetName}`);
        continue;
      }

      // Leer como array de arrays para procesar manualmente
      const rawData = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: '',
        blankrows: false,
        raw: false, // Mantener formatos como texto
      });

      if (rawData.length < 2) {
        logOperations.excel.warn(`La hoja ${sheetName} está vacía o sin datos`);
        continue;
      }

      // Mapeo de headers del Excel a campos JSON
      const HEADER_MAPPING = {
        'Seller': 'sellerId',
        'Abierto desde': 'openDate',
        'Nro Ventas': 'sales',
        '% entregas a tiempo': 'delivery',
        'Calificacion estrellas': 'stars',
        'url de "más productos del vendedor"': 'link',
        'Nuevo seller': 'isNew'
      };

      // Obtener headers de la primera fila
      const excelHeaders = rawData[0].map(h => String(h).trim());
      
      // Crear mapeo de índice a campo JSON
      const indexToField = {};
      excelHeaders.forEach((header, index) => {
        const mappedField = HEADER_MAPPING[header];
        if (mappedField) {
          indexToField[index] = mappedField;
        }
      });

      logOperations.excel.info(`Sellers - Headers mapeados: ${Object.keys(indexToField).length} campos`);

      // Procesar filas de datos
      const dataRows = rawData.slice(1).filter(row => this.isValidRow(row));

      for (const row of dataRows) {
        const sellerObj = {};
        
        // Mapear cada columna según el índice
        Object.entries(indexToField).forEach(([index, fieldName]) => {
          let value = row[index];
          
          // Procesar según el tipo de campo
          if (value === null || value === undefined || value === '') {
            // Valores vacíos: 0 para numéricos, "" para strings
            if (fieldName === 'sales' || fieldName === 'stars' || fieldName === 'delivery' || fieldName === 'isNew') {
              value = 0;
            } else {
              value = '';
            }
          } else {
            // Convertir a string y hacer trim
            value = String(value).trim();
            
            // sales, stars: números
            if (fieldName === 'sales' || fieldName === 'stars') {
              const num = parseFloat(value);
              value = isNaN(num) ? 0 : num;
            }
            // delivery: extraer número de porcentaje "95%" -> 95
            else if (fieldName === 'delivery') {
              // Remover el símbolo % y convertir a número
              const cleanValue = value.replace('%', '').trim();
              const num = parseFloat(cleanValue);
              value = isNaN(num) ? 0 : num;
            }
            // isNew: 0 o 1
            else if (fieldName === 'isNew') {
              const num = parseInt(value);
              value = (isNaN(num) || num === 0) ? 0 : 1;
            }
          }
          
          sellerObj[fieldName] = value;
        });

        // Solo agregar si tiene al menos sellerId
        if (sellerObj.sellerId && sellerObj.sellerId !== '') {
          result.push(sellerObj);
        }
      }

      logOperations.excel.info(`Hoja ${sheetName} (Sellers) procesada: ${result.length} registros`);
    }

    logOperations.excel.info(`Sellers procesado: ${result.length} registros totales`);
    return result;
  }

  /**
   * Procesa una fila individual del Excel
   */
  processRow(headers, row, rowNumber, sheetName = 'Unknown') {
    const processedRow = {
      _metadata: {
        sourceSheet: sheetName,
        sourceRow: rowNumber,
        processedAt: new Date().toLocaleString('sv-SE', { timeZone: 'America/Lima' }).replace(' ', 'T')+':00'
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

    // Si el header es 'inicio' o 'fin', devolver el valor como string tal cual
    if (header && (header.toLowerCase().includes('inicio') || header.toLowerCase().includes('fin'))) {
      // Si viene como número (fecha Excel), convertir a string dd/mm/yyyy HH:MM:SS
      if (typeof value === 'number') {
        // Excel almacena fechas como días desde 1899-12-30
        const excelEpoch = new Date(Date.UTC(1899, 11, 30));
        const ms = value * 24 * 60 * 60 * 1000;
        const dateObj = new Date(excelEpoch.getTime() + ms);
        const pad = n => String(n).padStart(2, '0');
        const formatted = `${pad(dateObj.getDate())}/${pad(dateObj.getMonth()+1)}/${dateObj.getFullYear()} ${pad(dateObj.getHours())}:${pad(dateObj.getMinutes())}:${pad(dateObj.getSeconds())}`;
        return formatted;
      }
      // Si viene como string, devolver tal cual
      return String(value);
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
   * @param {object} data - Datos procesados del Excel con estructura { metadata,sheets }
   * @param {string} fileType - Tipo de archivo: 'home', 'locations', 'sellers', 'unknown'
   */
  async saveProcessedData(data, fileType = 'home') {
    try {
      const outputPath = path.resolve(config.files.outputJsonPath);
      const outputDir = path.dirname(outputPath);

      // Crear directorio si no existe
      await fs.mkdir(outputDir, { recursive: true });

      // Crear objeto con metadata y envolver los datos
      const sourceFileName = data?.metadata?.sourceFile || '';
      const outputData = {
        metadata: {
          processedAt: new Date().toLocaleString('sv-SE', { timeZone: 'America/Lima' }).replace(' ', 'T')+':00',
          recordCount: data.length,
          sourceFile: sourceFileName,
          version: '1.0'
        },
        data: data
      };

      // Guardar como JSON
      await fs.writeFile(outputPath, JSON.stringify(outputData, null, 2), 'utf8');
      logOperations.excel.info(`Datos guardados en: ${outputPath}`);

      // Nombre del archivo de salida según el tipo de archivo
      const OUTPUT_FILE_NAMES = {
        home: 'googlesheet.json',
        locations: 'locations.json',
        sellers: 'sellers.json',
      };

      // Subir a VTEX después de guardar exitosamente
      try {
        const { uploadFileToVtexPortal } = require('./uploadOutputToPortalModule');
        const fileName = OUTPUT_FILE_NAMES[fileType] || 'output.json';
        logOperations.excel.info(`Subiendo a VTEX como '${fileName}' (tipo: ${fileType})`);
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
        const { Storage } = require('@google-cloud/storage');
        const bucketName = config.gcp.bucketName;
        const destFolder = 'Publicaciones_json_vtex';
        // Prefijo del nombre según tipo de archivo
        let filePrefix = 'googleSheet';
        if (fileType === 'locations') filePrefix = 'locations';
        else if (fileType === 'sellers') filePrefix = 'sellers';
        // Usar nombre con fecha/hora para evitar sobrescribir
        const now = new Date();
        const destFileName = `${filePrefix}_${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}${String(now.getSeconds()).padStart(2,'0')}.json`;
        await uploadJsonToGCP(bucketName, destFolder, outputPath, destFileName);
        logOperations.excel.info(`Archivo JSON subido a GCP en Publicaciones_json_vtex/${destFileName}`);

        // Mover el Excel procesado a la carpeta Publicaciones_json_vtex (evita reprocesos)
        if (this._latestGcpExcelFile) {
          const srcPath = this._latestGcpExcelFile;
          const destPath = `Publicaciones_json_vtex/${path.basename(srcPath)}`;
          await moveFileInGCP(bucketName, srcPath, destPath);
          logOperations.excel.info(`Archivo Excel procesado movido en GCP de ${srcPath} a ${destPath}`);

          // Limpiar la carpeta Archivos_sheets/ en el bucket de GCP
          try {
            const storage = new Storage({ keyFilename: path.resolve(__dirname, '../../gcp-service-account.json'), projectId: config.gcp.projectId  });
            const [files] = await storage.bucket(bucketName).getFiles({ prefix: 'Archivos_sheets/' });
            await Promise.all(
              files.map(async file => {
                if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
                  await file.delete();
                  logOperations.excel.info(`Archivo Excel eliminado de Archivos_sheets/: ${file.name}`);
                }
              })
            );
            logOperations.excel.info('Carpeta Archivos_sheets/ limpiada en GCP.');
          } catch (cleanErr) {
            logOperations.excel.error('Error al limpiar la carpeta Archivos_sheets/ en GCP', cleanErr);
          }
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