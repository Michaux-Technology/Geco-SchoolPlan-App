const jwt = require('jsonwebtoken');
const Enseignant = require('./models/Enseignant');
const Cours = require('./models/Cours');
const Classe = require('./models/Classe');
const Salle = require('./models/Salle');
const Uhr = require('./models/Uhr');
const Surveillance = require('./models/Surveillance');

module.exports = (app, { checkLoginAttempts, defaultUsers, JWT_SECRET, loginAttempts }) => {
// --- Début du code extrait ---
// (Collé depuis server.js lignes 1175 à 1240)

app.post('/api/mobile/login', checkLoginAttempts, (req, res) => {
  const { username, password } = req.body;

  // Vérifier si l'utilisateur existe
  const user = defaultUsers.find(u => u.username === username);
  
  if (!user) {
    // Incrémenter le compteur de tentatives
    const ip = req.ip;
    const attempts = loginAttempts.get(ip) || { count: 0, lastAttempt: 0 };
    attempts.count += 1;
    attempts.lastAttempt = Date.now();
    loginAttempts.set(ip, attempts);
    
    return res.status(401).json({ message: 'Identifiants invalides' });
  }

  // Vérifier le mot de passe
  if (user.password !== password) {
    // Incrémenter le compteur de tentatives
    const ip = req.ip;
    const attempts = loginAttempts.get(ip) || { count: 0, lastAttempt: 0 };
    attempts.count += 1;
    attempts.lastAttempt = Date.now();
    loginAttempts.set(ip, attempts);
    
    return res.status(401).json({ message: 'Identifiants invalides' });
  }

  // Réinitialiser les tentatives de connexion
  loginAttempts.delete(req.ip);

  // Générer le token JWT
  const tokenPayload = {
    username: user.username,
    role: user.role,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 heures
  };

  try {
    const token = jwt.sign(tokenPayload, JWT_SECRET);
    
    console.log('Token généré avec succès:', {
      username: user.username,
      role: user.role,
      tokenPreview: `${token.substring(0, 20)}...`
    });

    res.json({ 
      token, 
      user: { 
        username: user.username, 
        role: user.role 
      } 
    });
  } catch (error) {
    console.error('Erreur lors de la génération du token:', error);
    res.status(500).json({ message: 'Erreur lors de la génération du token' });
  }
});

app.get('/api/mobile/status', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/mobile/enseignant', async (req, res) => {
  try {
    console.log('Requête reçue pour /api/mobile/enseignant');
    const enseignants = await Enseignant.find().sort({ nom: 1, prenom: 1 });
    console.log(`Retour de ${enseignants.length} enseignants`);
    res.json(enseignants);
  } catch (error) {
    console.error('Erreur lors de la récupération des enseignants:', error);
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/mobile/planning', async (req, res) => {
  try {
    console.log('Requête reçue pour /api/mobile/planning');
    const { semaine, annee } = req.query;
    
    if (!semaine || !annee) {
      return res.status(400).json({ message: 'Les paramètres semaine et annee sont requis' });
    }
    
    console.log(`Recherche du planning pour semaine ${semaine}, année ${annee}`);
    
    // Récupérer les cours
    const cours = await Cours.find({
      semaine: parseInt(semaine),
      annee: parseInt(annee)
    }).populate('uhr');
    
    // Récupérer les créneaux horaires
    const uhrs = await Uhr.find().sort({ nummer: 1 });
    
    console.log(`Retour de ${cours.length} cours et ${uhrs.length} créneaux horaires pour cette semaine`);
    
    // Retourner un objet avec les cours et les créneaux horaires
    res.json({
      cours: cours,
      uhrs: uhrs
    });
  } catch (error) {
    console.error('Erreur lors de la récupération du planning:', error);
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/mobile/classe', async (req, res) => {
  try {
    console.log('Requête reçue pour /api/mobile/classe');
    const classes = await Classe.find().sort({ niveau: 1, nom: 1 });
    console.log(`Retour de ${classes.length} classes`);
    res.json(classes);
  } catch (error) {
    console.error('Erreur lors de la récupération des classes:', error);
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/mobile/salle', async (req, res) => {
  try {
    console.log('Requête reçue pour /api/mobile/salle');
    const salles = await Salle.find().sort({ nom: 1 });
    console.log(`Retour de ${salles.length} salles`);
    res.json(salles);
  } catch (error) {
    console.error('Erreur lors de la récupération des salles:', error);
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/mobile/cours/enseignant', async (req, res) => {
  try {
    console.log('Requête reçue pour /api/mobile/cours/enseignant');
    const { enseignantId, semaine, annee } = req.query;
    
    if (!enseignantId) {
      return res.status(400).json({ message: 'Le paramètre enseignantId est requis' });
    }
    
    if (!semaine || !annee) {
      return res.status(400).json({ message: 'Les paramètres semaine et annee sont requis' });
    }
    
    console.log(`Recherche des cours pour enseignant ${enseignantId}, semaine ${semaine}, année ${annee}`);
    
    // Rechercher les cours où l'enseignant est impliqué
    const cours = await Cours.find({
      'enseignants.id': enseignantId,
      semaine: parseInt(semaine),
      annee: parseInt(annee)
    });
    
    console.log(`Retour de ${cours.length} cours pour cet enseignant`);
    res.json(cours);
  } catch (error) {
    console.error('Erreur lors de la récupération des cours de l\'enseignant:', error);
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/mobile/cours/enseignant/:enseignantId', async (req, res) => {
  try {
    console.log('Requête reçue pour /api/mobile/cours/enseignant/:enseignantId');
    const { enseignantId } = req.params;
    const { semaine, annee } = req.query;
    
    if (!semaine || !annee) {
      return res.status(400).json({ message: 'Les paramètres semaine et annee sont requis' });
    }
    
    console.log(`Recherche des cours pour enseignant ${enseignantId}, semaine ${semaine}, année ${annee}`);
    
    // Rechercher les cours où l'enseignant est impliqué
    const cours = await Cours.find({
      'enseignants.id': enseignantId,
      semaine: parseInt(semaine),
      annee: parseInt(annee)
    }).populate('uhr');
    
    // Récupérer les créneaux horaires
    const uhrs = await Uhr.find().sort({ nummer: 1 });
    
    console.log(`Retour de ${cours.length} cours et ${uhrs.length} créneaux horaires pour cet enseignant`);
    
    // Retourner un objet avec les cours et les créneaux horaires
    res.json({
      cours: cours,
      uhrs: uhrs
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des cours de l\'enseignant:', error);
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/mobile/uhrs', async (req, res) => {
  try {
    console.log('Requête reçue pour /api/mobile/uhrs');
    const uhrs = await Uhr.find().sort({ nummer: 1 });
    console.log(`Retour de ${uhrs.length} créneaux horaires`);
    res.json(uhrs);
  } catch (error) {
    console.error('Erreur lors de la récupération des créneaux horaires:', error);
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/mobile/surveillances/enseignant/:enseignantId', async (req, res) => {
  try {
    console.log('Requête reçue pour /api/mobile/surveillances/enseignant/:enseignantId');
    const { enseignantId } = req.params;
    const { semaine, annee } = req.query;
    
    if (!semaine || !annee) {
      return res.status(400).json({ message: 'Les paramètres semaine et annee sont requis' });
    }
    
    console.log(`Recherche des surveillances pour enseignant ${enseignantId}, semaine ${semaine}, année ${annee}`);
    
    // Rechercher les surveillances de l'enseignant
    // Ne faire le populate que sur les champs qui existent dans le schéma
    const surveillances = await Surveillance.find({
      enseignant: enseignantId,
      semaine: parseInt(semaine),
      annee: parseInt(annee)
    }).populate('uhr enseignant');
    
    console.log(`Retour de ${surveillances.length} surveillances pour cet enseignant`);
    res.json(surveillances);
  } catch (error) {
    console.error('Erreur lors de la récupération des surveillances de l\'enseignant:', error);
    res.status(500).json({ message: error.message });
  }
});

// Route pour récupérer le planning d'une classe spécifique
app.get('/api/mobile/planning/classe/:classeId', async (req, res) => {
  try {
    console.log('Requête reçue pour /api/mobile/planning/classe/:classeId');
    const { classeId } = req.params;
    const { semaine, annee } = req.query;
    
    if (!semaine || !annee) {
      return res.status(400).json({ message: 'Les paramètres semaine et annee sont requis' });
    }
    
    console.log(`Recherche du planning pour classe ${classeId}, semaine ${semaine}, année ${annee}`);
    
    // Récupérer les cours de la classe
    const cours = await Cours.find({
      classe: classeId,
      semaine: parseInt(semaine),
      annee: parseInt(annee)
    }).populate('uhr');
    
    // Récupérer les créneaux horaires
    const uhrs = await Uhr.find().sort({ nummer: 1 });
    
    console.log(`Retour de ${cours.length} cours et ${uhrs.length} créneaux horaires pour cette classe`);
    
    // Retourner un objet avec les cours et les créneaux horaires
    res.json({
      cours: cours,
      uhrs: uhrs
    });
  } catch (error) {
    console.error('Erreur lors de la récupération du planning de la classe:', error);
    res.status(500).json({ message: error.message });
  }
});
// --- Fin du code extrait ---
} 