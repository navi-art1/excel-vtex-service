const fs = require('fs').promises;
const axios = require('axios');
require('dotenv').config();

async function uploadFileToVtexPortal(filePath, fileName) {
  const { VTEX_ACCOUNT, VTEX_APP_KEY, VTEX_APP_TOKEN, VTEX_ENDPOINT } = process.env;
  const url = `https://${VTEX_ACCOUNT}.myvtex.com/api${VTEX_ENDPOINT}/${fileName}`;

  try {
    // Leer contenido del archivo
    const fileContent = await fs.readFile(filePath, 'utf8');
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
    return false;
  }
}

module.exports = { uploadFileToVtexPortal };