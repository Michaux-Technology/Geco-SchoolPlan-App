# Fonctionnalité QR Code pour Geco-SchoolPlan

## Vue d'ensemble

La fonctionnalité QR code permet d'ajouter automatiquement des écoles à l'application en scannant un QR code contenant les informations de configuration de l'école.

## Comment utiliser

### 1. Accéder au scanner QR

1. Ouvrez l'application Geco-SchoolPlan
2. Allez dans la "Configuration des écoles" (icône engrenage)
3. Appuyez sur le bouton vert "Scanner un QR code"

### 2. Scanner le QR code

1. Autorisez l'accès à la caméra quand demandé
2. Placez le QR code dans le cadre de scan
3. L'application va automatiquement :
   - Lire les données du QR code
   - Tester la connexion à l'API de l'école
   - Ajouter l'école à la liste si la connexion réussit

## Format du QR code

Le QR code doit contenir un JSON avec les informations suivantes :

```json
{
  "name": "Nom de l'école",
  "apiUrl": "http://adresse-ip:port",
  "username": "nom_utilisateur",
  "password": "mot_de_passe"
}
```

### Exemple de données :

```json
{
  "name": "Lycée Jean Moulin",
  "apiUrl": "http://192.168.1.100:3000",
  "username": "admin",
  "password": "password123"
}
```

## Génération de QR codes

### Option 1 : Utilisation d'un générateur en ligne

1. Allez sur un site de génération de QR codes (ex: qr-code-generator.com)
2. Collez le JSON formaté ci-dessus
3. Générez le QR code
4. Imprimez ou affichez le QR code

### Option 2 : Utilisation du script utilitaire

Le fichier `utils/qrGenerator.js` contient des fonctions pour générer les données JSON :

```javascript
import { generateSchoolQRData } from './utils/qrGenerator';

const schoolConfig = {
  name: "Mon École",
  apiUrl: "http://192.168.1.100:3000",
  username: "user",
  password: "pass"
};

const qrData = generateSchoolQRData(schoolConfig);
console.log(qrData);
// Utilisez cette chaîne JSON dans un générateur de QR code
```

## Fonctionnalités de sécurité

- **Validation des données** : L'application vérifie que toutes les données requises sont présentes
- **Test de connexion** : L'API de l'école est testée avant l'ajout
- **Vérification des doublons** : L'application empêche l'ajout d'écoles déjà configurées
- **Gestion des erreurs** : Messages d'erreur clairs en cas de problème

## Messages d'erreur possibles

- **"QR code invalide"** : Le QR code ne contient pas un JSON valide
- **"Données manquantes"** : Il manque des informations requises (name, apiUrl, username, password)
- **"Cette école est déjà configurée"** : L'école existe déjà dans l'application
- **"Erreur de connexion"** : Impossible de se connecter à l'API de l'école
- **"Identifiants invalides"** : Le nom d'utilisateur ou mot de passe est incorrect

## Permissions requises

L'application demande l'autorisation d'accès à la caméra pour scanner les QR codes. Cette permission est nécessaire pour le bon fonctionnement de la fonctionnalité.

## Support multi-langues

La fonctionnalité QR code supporte toutes les langues disponibles dans l'application :
- Français
- Anglais
- Allemand
- Russe
- Arabe

## Dépannage

### Le scanner ne fonctionne pas
1. Vérifiez que l'autorisation caméra est accordée
2. Redémarrez l'application
3. Vérifiez que le QR code est bien lisible

### L'école n'est pas ajoutée
1. Vérifiez que le format JSON est correct
2. Vérifiez que l'URL de l'API est accessible
3. Vérifiez que les identifiants sont corrects
4. Vérifiez que l'école n'est pas déjà configurée

### Erreur de connexion
1. Vérifiez que l'adresse IP et le port sont corrects
2. Vérifiez que le serveur de l'école est en ligne
3. Vérifiez que le pare-feu n'empêche pas la connexion 