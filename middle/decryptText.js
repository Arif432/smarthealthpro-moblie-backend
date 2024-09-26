const crypto = require("crypto")
const decryptText = (encryptedData = '', encryptionKey = '') => {
  const [initializationVectorAsHex, encryptedDataAsHex] = encryptedData?.split(':');
  const initializationVector = Buffer.from(initializationVectorAsHex, 'hex');
  const hashedEncryptionKey = crypto.createHash('sha256').update(encryptionKey).digest('hex').substring(0, 32);
  const decipher = crypto.createDecipheriv('aes256', hashedEncryptionKey, initializationVector);
  
  let decryptedText = decipher.update(Buffer.from(encryptedDataAsHex, 'hex'));
  decryptedText = Buffer.concat([decryptedText, decipher.final()]);

  return decryptedText.toString();
};

module.exports = decryptText