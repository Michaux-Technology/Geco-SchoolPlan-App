import { encryptData } from './encryption';

// Utilitaire pour générer des QR codes d'écoles
// Ce fichier peut être utilisé pour créer des QR codes de test

export const generateSchoolQRData = (schoolConfig) => {
  const {
    name,
    apiUrl,
    username,
    password
  } = schoolConfig;

  const qrData = {
    name,
    apiUrl,
    username,
    password
  };

  return JSON.stringify(qrData);
};

export const generateEncryptedSchoolQRData = (schoolConfig) => {
  const {
    name,
    apiUrl,
    username,
    password
  } = schoolConfig;

  const qrData = {
    name,
    apiUrl,
    username,
    password
  };

  // Crypter les données avec AES-256
  const encryptedData = encryptData(qrData);
  return encryptedData;
};

// Exemple d'utilisation :
// const schoolData = {
//   name: "École Test",
//   apiUrl: "http://192.168.1.100:3000",
//   username: "testuser",
//   password: "testpass"
// };
// 
// const qrCodeData = generateSchoolQRData(schoolData);
// console.log(qrCodeData);
// 
// Vous pouvez ensuite utiliser cette chaîne JSON dans un générateur de QR code
// en ligne ou dans une application pour créer le QR code physique.

export const exampleSchoolConfig = {
  name: "École Test",
  apiUrl: "http://192.168.1.30:5000",
  username: "eleve",
  password: "1234"
};

export const exampleQRData = generateSchoolQRData(exampleSchoolConfig);
export const exampleEncryptedQRData = generateEncryptedSchoolQRData(exampleSchoolConfig);

// Fonction pour tester le cryptage/décryptage
export const testEncryption = () => {
  const testData = {
    name: "Test School",
    apiUrl: "http://192.168.1.100:3000",
    username: "testuser",
    password: "testpass"
  };
  
  console.log('🔐 Test de cryptage/décryptage:');
  console.log('Données originales:', testData);
  
  const encrypted = encryptData(testData);
  console.log('Données cryptées:', encrypted);
  
  return {
    original: testData,
    encrypted: encrypted
  };
}; 