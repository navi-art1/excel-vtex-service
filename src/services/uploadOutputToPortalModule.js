const fs = require('fs').promises;
const axios = require('axios');
require('dotenv').config();

async function uploadFileToVtexPortal(filePath, fileName) {
  // Leer el contenido del archivo JSON para obtener el nombre real del archivo fuente
  let sourceFileName = fileName;
  try {
    const fileContent = await fs.readFile(filePath, 'utf8');
    let json;
    try {
      json = JSON.parse(fileContent);
    } catch (parseErr) {
      console.error('[ERROR] No se pudo parsear el JSON para obtener sourceFile:', parseErr);
      json = null;
    }
    if (json && json.metadata && json.metadata.sourceFile) {
      sourceFileName = json.metadata.sourceFile;
      console.log('[DEBUG] sourceFile extraído del JSON:', sourceFileName);
    } else if (json && json.data && json.data.metadata && json.data.metadata.sourceFile) {
      sourceFileName = json.data.metadata.sourceFile;
      console.log('[DEBUG] sourceFile extraído del JSON (data.metadata):', sourceFileName);
    } else {
      console.log('[DEBUG] No se encontró sourceFile en el JSON, usando fileName:', fileName);
    }

    // Detectar el endpoint y account según el prefijo del archivo fuente
    const upperSourceFile = sourceFileName.toUpperCase();
    let endpoint = '';
    let account = '';
    if (upperSourceFile.startsWith('HOME_RD_')) {
      endpoint = '/portal/pvt/sites/promartrd/files';
      account = 'promartrd';
    } else if (upperSourceFile.startsWith('HOME_PRD_')) {
      endpoint = '/portal/pvt/sites/promart/files';
      account = 'promart';
    } else if (upperSourceFile.startsWith('LOCATIONS_RD_')) {
      endpoint = '/portal/pvt/sites/promartrd/files';
      account = 'promartrd';
    } else if (upperSourceFile.startsWith('LOCATIONS_PRD_')) {
      endpoint = '/portal/pvt/sites/promart/files';
      account = 'promart';
    } else {
      endpoint = process.env.VTEX_ENDPOINT || '/portal/pvt/sites/promartrd/files';
      account = process.env.VTEX_ACCOUNT || 'promartrd';
    }
    const { VTEX_APP_KEY, VTEX_APP_TOKEN } = process.env;
    const url = `https://${account}.myvtex.com/api${endpoint}/${fileName}`;
    console.log(`[VTEX UPLOAD] Subiendo archivo '${fileName}' al portal: ${url}`);

    // El payload debe tener la estructura requerida
    const payload = {
      path: fileName,
      text: fileContent
    };
    const headers = {
      'Content-Type': 'application/json',
      'X-VTEX-API-AppKey': VTEX_APP_KEY,
      'X-VTEX-API-AppToken': VTEX_APP_TOKEN
    };
    await axios.put(url, payload, { headers });
    return true;
  } catch (err) {
    console.error('[ERROR] Error al subir el archivo a VTEX:', err);
    return false;
  }
}

module.exports = { uploadFileToVtexPortal };