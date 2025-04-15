const fs = require('fs');

const deleteFile = (filePath) => {
  fs.unlink(filePath, (err) => {
    if (err && err.code !== 'ENOENT') {
      throw (err);
    }
  });
};

exports.deleteFile = deleteFile;