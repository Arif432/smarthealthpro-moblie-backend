const CryptoJS = require("crypto-js"); // Using crypto-js which is the same as crypto-es

// Make sure this matches your frontend secret key EXACTLY
const secretKey = "your-secret-key"; // Store this in environment variables in production

const encrypt = (text) => {
  try {
    const ciphertext = CryptoJS.AES.encrypt(text, secretKey).toString();
    return Buffer.from(ciphertext).toString("base64"); // This is equivalent to btoa
  } catch (error) {
    console.error("Encryption failed:", error);
    return null;
  }
};

const decrypt = (encryptedText) => {
  try {
    const ciphertext = Buffer.from(encryptedText, "base64").toString(); // This is equivalent to atob
    const bytes = CryptoJS.AES.decrypt(ciphertext, secretKey);
    const originalText = bytes.toString(CryptoJS.enc.Utf8);
    if (!originalText) {
      throw new Error("Decryption resulted in empty string");
    }
    return originalText;
  } catch (error) {
    console.error("Decryption failed:", error);
    return null;
  }
};

module.exports = { encrypt, decrypt };
