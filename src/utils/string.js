/**
 * Utilidades para manipulación de strings
 */

/**
 * Convierte un string a slug en minúsculas con guiones bajos.
 * Ej: "Top Categorias" → "top_categorias"
 * @param {string} str
 * @returns {string}
 */
function slugify(str) {
  return (str || '').toLowerCase().replace(/\s+/g, '_');
}

module.exports = { slugify };
