import CryptoJS from 'react-native-crypto-js';

// Clé secrète pour le cryptage AES-256
// Cette clé doit correspondre à celle utilisée côté serveur (QRCodePage.jsx)
const SECRET_KEY = 'geco-school-plan-2024-secure-key';

/**
 * Crypte les données avec AES-256 (compatible avec QRCodePage.jsx)
 * @param {Object} data - Les données à crypter
 * @returns {string} - Les données cryptées
 */
export const encryptData = (data) => {
  try {
    // Convertir les données en JSON string
    const jsonData = JSON.stringify(data);
    
    // Utiliser AES-256-CBC avec une clé dérivée (comme dans QRCodePage.jsx)
    const key = CryptoJS.enc.Utf8.parse(SECRET_KEY.padEnd(32, '0').substring(0, 32));
    const iv = CryptoJS.enc.Utf8.parse('0000000000000000');
    
    const encrypted = CryptoJS.AES.encrypt(jsonData, key, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });
    
    console.log('🔐 Données cryptées avec succès');
    return encrypted.toString();
  } catch (error) {
    console.error('❌ Erreur lors du cryptage:', error);
    throw new Error('Erreur lors du cryptage des données');
  }
};

/**
 * Décrypte les données avec AES-256 (compatible avec QRCodePage.jsx)
 * @param {string} encryptedData - Les données cryptées
 * @returns {Object} - Les données décryptées
 */
export const decryptData = (encryptedData) => {
  try {
    // Utiliser AES-256-CBC avec une clé dérivée (comme dans QRCodePage.jsx)
    const key = CryptoJS.enc.Utf8.parse(SECRET_KEY.padEnd(32, '0').substring(0, 32));
    const iv = CryptoJS.enc.Utf8.parse('0000000000000000');
    
    const decrypted = CryptoJS.AES.decrypt(encryptedData, key, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });
    
    const decryptedString = decrypted.toString(CryptoJS.enc.Utf8);
    
    // Parser le JSON
    const data = JSON.parse(decryptedString);
    
    console.log('🔓 Données décryptées avec succès');
    return data;
  } catch (error) {
    console.error('❌ Erreur lors du décryptage:', error);
    throw new Error('Erreur lors du décryptage des données');
  }
};

/**
 * Vérifie si les données sont cryptées
 * @param {string} data - Les données à vérifier
 * @returns {boolean} - True si les données semblent cryptées
 */
export const isEncrypted = (data) => {
  try {
    // Vérifier si c'est du JSON valide (non crypté)
    JSON.parse(data);
    return false;
  } catch (error) {
    // Si ce n'est pas du JSON valide, essayer de décrypter
    try {
      const key = CryptoJS.enc.Utf8.parse(SECRET_KEY.padEnd(32, '0').substring(0, 32));
      const iv = CryptoJS.enc.Utf8.parse('0000000000000000');
      
      const decrypted = CryptoJS.AES.decrypt(data, key, {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
      });
      
      const decryptedString = decrypted.toString(CryptoJS.enc.Utf8);
      JSON.parse(decryptedString);
      return true;
    } catch (decryptError) {
      return false;
    }
  }
};

/**
 * Génère une clé secrète sécurisée
 * @returns {string} - Une clé secrète de 32 caractères
 */
export const generateSecretKey = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

export default {
  encryptData,
  decryptData,
  isEncrypted,
  generateSecretKey
}; 