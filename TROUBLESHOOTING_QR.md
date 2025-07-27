# Guide de dépannage - QR Code

## Problème : "Network request failed"

### Causes possibles et solutions :

#### 1. Serveur backend non démarré
**Solution :** Démarrez votre serveur backend
```bash
# Dans le dossier backend
npm start
# ou
node server.js
```

#### 2. Mauvaise adresse IP
**Problème :** `localhost` ne fonctionne pas sur mobile
**Solution :** Utilisez l'adresse IP de votre ordinateur
```bash
# Sur Windows
ipconfig
# Cherchez l'adresse IPv4 (ex: 192.168.1.100)

# Sur Mac/Linux
ifconfig
# ou
ip addr
```

#### 3. Port non accessible
**Vérifiez :**
- Le port 5000 est-il ouvert ?
- Le pare-feu bloque-t-il la connexion ?
- Le serveur écoute-t-il sur toutes les interfaces ?

#### 4. Réseau différent
**Problème :** Mobile et ordinateur sur des réseaux différents
**Solution :** Connectez les deux appareils au même WiFi

### Test de connectivité

#### Étape 1 : Test du parsing JSON
1. Collez votre QR code dans l'application
2. Appuyez sur "Tester le parsing JSON"
3. Vérifiez que le parsing fonctionne

#### Étape 2 : Test de l'URL
1. Ouvrez un navigateur sur votre mobile
2. Essayez d'accéder à : `http://VOTRE_IP:5000`
3. Vérifiez que le serveur répond

#### Étape 3 : Test de l'API
1. Testez l'endpoint : `http://VOTRE_IP:5000/api/mobile/login`
2. Vérifiez que l'API répond

### Format QR code corrigé

Au lieu de :
```json
{"backend":"http://localhost:5000","schoolName":"My School","username":"eleve","password":"1234"}
```

Utilisez :
```json
{"backend":"http://192.168.1.100:5000","schoolName":"My School","username":"eleve","password":"1234"}
```

### Vérification du serveur backend

Assurez-vous que votre serveur backend :

1. **Écoute sur toutes les interfaces :**
```javascript
// Dans server.js
app.listen(5000, '0.0.0.0', () => {
  console.log('Serveur démarré sur http://0.0.0.0:5000');
});
```

2. **A l'endpoint correct :**
```javascript
// Route pour la connexion mobile
app.post('/api/mobile/login', (req, res) => {
  // Votre logique de connexion
});
```

3. **CORS configuré :**
```javascript
const cors = require('cors');
app.use(cors());
```

### Commandes de test

#### Test du serveur :
```bash
# Test local
curl http://localhost:5000/api/mobile/login

# Test avec données
curl -X POST http://localhost:5000/api/mobile/login \
  -H "Content-Type: application/json" \
  -d '{"username":"eleve","password":"1234"}'
```

#### Test depuis le mobile :
1. Ouvrez le navigateur sur votre mobile
2. Allez sur : `http://VOTRE_IP:5000`
3. Vérifiez que la page se charge

### Logs de débogage

L'application affiche maintenant des logs détaillés. Regardez la console pour voir :
- L'URL de connexion tentée
- Les données envoyées
- Les erreurs détaillées

### Solutions alternatives

Si le problème persiste, vous pouvez :

1. **Utiliser un tunnel :**
```bash
# Avec ngrok
ngrok http 5000
# Puis utiliser l'URL ngrok dans le QR code
```

2. **Tester en mode développement :**
- Utilisez l'émulateur Android/iOS
- Configurez le réseau en mode bridge

3. **Vérifier les permissions :**
- Assurez-vous que l'app a les permissions réseau
- Vérifiez les paramètres de sécurité du mobile 