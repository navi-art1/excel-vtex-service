const fs = require('fs').promises;
const axios = require('axios');
require('dotenv').config();

async function uploadFileToVtexPortal(filePath, fileName) {
  const { VTEX_ACCOUNT, VTEX_APP_KEY, VTEX_APP_TOKEN } = process.env;
  const url = `https://${VTEX_ACCOUNT}.myvtex.com/api/portal/pvt/sites/default/files/${fileName}`;

  console.log(`📂 Leyendo archivo desde: ${filePath}`);

  try {
    // Leer contenido del archivo
    const fileContent = await fs.readFile(filePath, 'utf8');
    console.log(`📏 Tamaño leído: ${(Buffer.byteLength(fileContent, 'utf8') / 1024).toFixed(2)} KB`);

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

      console.log(`🚀 Enviando ${fileName} a VTEX...`);
  const res = await axios.put(url, payload, { headers });
      console.log(`✅ Subido correctamente (${res.status})`);
  } catch (err) {
    console.error(`❌ Error al subir ${fileName}:`);
    console.error('Status:', err.response?.status || 'N/A');
    console.error('Detalle:', err.response?.data || err.message);
  }
}

(async () => {
  const filePath = 'D:/Trabajo/excel-vtex-service/data/output.json';
  const fileName = 'googlesheet.json';
  await uploadFileToVtexPortal(filePath, fileName);
})();