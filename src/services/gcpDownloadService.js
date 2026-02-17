/**
 * Descarga el archivo Excel más reciente y lo guarda con su nombre original en la carpeta local input
 * @param {string} bucketName
 * @param {string} folder
 * @returns {Promise<{localPath: string, latestFileName: string, bucketFilePath: string}>}
 */
async function getLatestExcelNameAndDownload(bucketName, folder) {
  const [files] = await storage.bucket(bucketName).getFiles({ prefix: folder });
  if (!files || files.length === 0) {
    throw new Error(`No se encontraron archivos en la carpeta ${folder}`);
  }
  // Filtrar solo archivos .xlsx o .xls
  const excelFiles = files.filter(f => f.name.endsWith('.xlsx') || f.name.endsWith('.xls'));
  if (excelFiles.length === 0) {
    throw new Error(`No se encontraron archivos Excel en la carpeta ${folder}`);
  }
  // Ordenar por fecha de actualización (metadata.updated)
  const filesWithMeta = await Promise.all(
    excelFiles.map(async f => {
      const [meta] = await f.getMetadata();
      return { name: f.name, updated: new Date(meta.updated) };
    })
  );
  filesWithMeta.sort((a, b) => b.updated - a.updated);
  const latest = filesWithMeta[0];
  const latestFileName = path.basename(latest.name);
  const localPath = path.resolve(__dirname, '../../data/input/', latestFileName);
  await downloadExcelFromGCP(bucketName, latest.name, localPath);

  // Eliminar archivos Excel antiguos en la carpeta del bucket, excepto el más reciente
  const bucket = storage.bucket(bucketName);
  await Promise.all(
    filesWithMeta.slice(1).map(async fileMeta => {
      try {
        await bucket.file(fileMeta.name).delete();
        console.log(`Archivo antiguo eliminado del bucket: ${fileMeta.name}`);
      } catch (e) {
        console.error(`No se pudo eliminar el archivo ${fileMeta.name}:`, e.message);
      }
    })
  );

  return { localPath, latestFileName, bucketFilePath: latest.name };
}
const { Storage } = require('@google-cloud/storage');
const path = require('path');

// Ruta al archivo de credenciales (ajusta si lo pones en otro lado)
const keyFilename = path.resolve(__dirname, '../../gcp-service-account.json');
// Cargar configuración centralizada de GCP
const { config } = require('../config/env');
const storage = new Storage({ keyFilename, projectId: config.gcp.projectId });

/**
 * Descarga un archivo Excel desde un bucket de GCP
 * @param {string} bucketName - Nombre del bucket
 * @param {string} srcFilename - Ruta del archivo en el bucket
 * @param {string} destPath - Ruta local de destino
 */
async function downloadExcelFromGCP(bucketName, srcFilename, destPath) {
  await storage.bucket(bucketName).file(srcFilename).download({ destination: destPath });
  console.log(`Archivo descargado de GCP a ${destPath}`);
}

/**
 * Obtiene el archivo más reciente de una carpeta en un bucket y lo descarga
 * @param {string} bucketName - Nombre del bucket
 * @param {string} folder - Carpeta dentro del bucket (ej: 'Archivos_sheets/')
 * @param {string} destPath - Ruta local de destino
 * @returns {Promise<string>} - Nombre del archivo descargado
 */
async function downloadLatestExcelFromGCPFolder(bucketName, folder, destPath) {
  const [files] = await storage.bucket(bucketName).getFiles({ prefix: folder });
  if (!files || files.length === 0) {
    throw new Error(`No se encontraron archivos en la carpeta ${folder}`);
  }
  // Filtrar solo archivos .xlsx o .xls
  const excelFiles = files.filter(f => f.name.endsWith('.xlsx') || f.name.endsWith('.xls'));
  if (excelFiles.length === 0) {
    throw new Error(`No se encontraron archivos Excel en la carpeta ${folder}`);
  }
  // Ordenar por fecha de actualización (metadata.updated)
  const filesWithMeta = await Promise.all(
    excelFiles.map(async f => {
      const [meta] = await f.getMetadata();
      return { name: f.name, updated: new Date(meta.updated) };
    })
  );
  filesWithMeta.sort((a, b) => b.updated - a.updated);
  const latest = filesWithMeta[0];
  await downloadExcelFromGCP(bucketName, latest.name, destPath);

  // Eliminar archivos Excel antiguos en la carpeta del bucket, excepto el más reciente
  const bucket = storage.bucket(bucketName);
  await Promise.all(
    filesWithMeta.slice(1).map(async fileMeta => {
      try {
        await bucket.file(fileMeta.name).delete();
        console.log(`Archivo antiguo eliminado del bucket: ${fileMeta.name}`);
      } catch (e) {
        console.error(`No se pudo eliminar el archivo ${fileMeta.name}:`, e.message);
      }
    })
  );

  return latest.name;
}

/**
 * Sube un archivo local a una carpeta en un bucket de GCP
 * @param {string} bucketName - Nombre del bucket
 * @param {string} destFolder - Carpeta destino en el bucket (ej: 'Publicaciones_json_vtex/')
 * @param {string} localFilePath - Ruta local del archivo a subir
 * @param {string} destFileName - Nombre del archivo en el bucket
 */
async function uploadJsonToGCP(bucketName, destFolder, localFilePath, destFileName) {
  const destination = path.posix.join(destFolder, destFileName);
  await storage.bucket(bucketName).upload(localFilePath, { destination });
  console.log(`Archivo JSON subido a GCP: ${destination}`);
}

/**
 * Sube un archivo local a una carpeta en un bucket de GCP
 * @param {string} bucketName - Nombre del bucket
 * @param {string} destFolder - Carpeta destino en el bucket (ej: 'Archivos_sheets/')
 * @param {string} localFilePath - Ruta local del archivo a subir
 * @param {string} destFileName - Nombre del archivo en el bucket
 */
async function uploadFileToGCP(bucketName, destFolder, localFilePath, destFileName) {
  const destination = path.posix.join(destFolder, destFileName);
  await storage.bucket(bucketName).upload(localFilePath, { destination });
  console.log(`Archivo subido a GCP: ${destination}`);
}

/**
 * Mueve un archivo dentro del bucket de GCP (copia y borra el original)
 * @param {string} bucketName - Nombre del bucket
 * @param {string} srcPath - Ruta origen (ej: 'Archivos_sheets/archivo.xlsx')
 * @param {string} destPath - Ruta destino (ej: 'Publicaciones_json_vtex/archivo.xlsx')
 */
async function moveFileInGCP(bucketName, srcPath, destPath) {
  const bucket = storage.bucket(bucketName);
  await bucket.file(srcPath).copy(bucket.file(destPath));
  await bucket.file(srcPath).delete();
  console.log(`Archivo movido en GCP de ${srcPath} a ${destPath}`);
}

module.exports = {
  downloadExcelFromGCP,
  downloadLatestExcelFromGCPFolder,
  uploadJsonToGCP,
  uploadFileToGCP,
  moveFileInGCP,
  getLatestExcelNameAndDownload
};