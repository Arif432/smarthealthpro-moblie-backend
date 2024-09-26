const crypto = require("crypto");

const decryptText = (encryptedData = '', encryptionKey = '') => {
  const [ivHex, encryptedHex] = encryptedData.split(':'); // Split the IV and encrypted data
  const initializationVector = Buffer.from(ivHex, 'hex');
  const encryptedText = Buffer.from(encryptedHex, 'hex');

  const hashedEncryptionKey = crypto
    .createHash('sha256')
    .update(encryptionKey)
    .digest('hex')
    .substring(0, 32);

  const decipher = crypto.createDecipheriv('aes256', hashedEncryptionKey, initializationVector);

  let decryptedData = decipher.update(encryptedText);
  decryptedData = Buffer.concat([decryptedData, decipher.final()]);

  return decryptedData.toString('utf-8');
};

module.exports = decryptText;
