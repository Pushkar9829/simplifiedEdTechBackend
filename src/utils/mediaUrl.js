/** Public URL stored in Mongo for a multer file after persistUploads. */
function storedFileUrl(file) {
  if (!file) return '';
  if (file.location) return file.location;
  if (file.filename) return `/uploads/${file.filename}`;
  return '';
}

module.exports = { storedFileUrl };
