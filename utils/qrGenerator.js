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
  apiUrl: "http://192.168.1.100:3000",
  username: "testuser",
  password: "testpass"
};

export const exampleQRData = generateSchoolQRData(exampleSchoolConfig); 