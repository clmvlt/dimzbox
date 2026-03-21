// Patch fs.readlink/readlinkSync pour contourner le bug Windows EISDIR
// Sur certaines configs Windows, readlink retourne EISDIR au lieu de EINVAL sur des fichiers normaux
const fs = require("fs");
const origReadlinkSync = fs.readlinkSync;
const origReadlink = fs.readlink;

fs.readlinkSync = function patchedReadlinkSync(path, options) {
  try {
    return origReadlinkSync.call(fs, path, options);
  } catch (err) {
    if (err.code === "EISDIR") {
      // Convertir EISDIR en EINVAL (comportement normal pour un non-symlink)
      const newErr = new Error(`EINVAL: invalid argument, readlink '${path}'`);
      newErr.code = "EINVAL";
      newErr.errno = -22;
      newErr.syscall = "readlink";
      newErr.path = path;
      throw newErr;
    }
    throw err;
  }
};

fs.readlink = function patchedReadlink(path, options, callback) {
  if (typeof options === "function") {
    callback = options;
    options = undefined;
  }
  origReadlink.call(fs, path, options, (err, result) => {
    if (err && err.code === "EISDIR") {
      const newErr = new Error(`EINVAL: invalid argument, readlink '${path}'`);
      newErr.code = "EINVAL";
      newErr.errno = -22;
      newErr.syscall = "readlink";
      newErr.path = path;
      return callback(newErr);
    }
    callback(err, result);
  });
};

// Patcher aussi fs.promises.readlink (utilisé par le code moderne / Next.js workers)
const origPromisesReadlink = fs.promises.readlink;
fs.promises.readlink = async function patchedPromisesReadlink(path, options) {
  try {
    return await origPromisesReadlink.call(fs.promises, path, options);
  } catch (err) {
    if (err.code === "EISDIR") {
      const newErr = new Error(`EINVAL: invalid argument, readlink '${path}'`);
      newErr.code = "EINVAL";
      newErr.errno = -22;
      newErr.syscall = "readlink";
      newErr.path = path;
      throw newErr;
    }
    throw err;
  }
};

