const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const http = require('http');
const WebSocket = require('ws');
const Enseignant = require('./models/Enseignant');
const Classe = require('./models/Classe');
const Salle = require('./models/Salle');
const Cours = require('./models/Cours');
const Uhr = require('./models/Uhr');
const Planning = require('./models/Planning');

// Charger les variables d'environnement
dotenv.config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Configuration
const PORT = process.env.MOBILE_PORT || 5001;
const JWT_SECRET = process.env.JWT_SECRET;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/geco-schoolplan';
const MAX_LOGIN_ATTEMPTS = 10;
const BLOCK_DURATION = 15 * 60 * 1000; // 15 minutes en millisecondes

// Connexion à MongoDB
mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connecté à MongoDB'))
  .catch(err => console.error('Erreur de connexion à MongoDB:', err));

// Liste des utilisateurs par défaut
const defaultUsers = [
  {
    username: 'enseignant',
    password: '1234',
    role: 'enseignant'
  },
  {
    username: 'eleve',
    password: '1234',
    role: 'eleve'
  }
];

// Stockage des tentatives de connexion
const loginAttempts = new Map();

// Stockage des connexions WebSocket par enseignant
const teacherConnections = new Map();

// Middleware
app.use(cors());
app.use(express.json());

// Middleware de vérification des tentatives de connexion
const checkLoginAttempts = (req, res, next) => {
  const ip = req.ip;
  const attempts = loginAttempts.get(ip) || { count: 0, lastAttempt: 0 };
  if (attempts.count >= MAX_LOGIN_ATTEMPTS) {
    const timeSinceLastAttempt = Date.now() - attempts.lastAttempt;
    if (timeSinceLastAttempt < BLOCK_DURATION) {
      const remainingTime = Math.ceil((BLOCK_DURATION - timeSinceLastAttempt) / 1000 / 60);
      return res.status(429).json({
        message: `Trop de tentatives de connexion. Veuillez réessayer dans ${remainingTime} minutes.`
      });
    } else {
      loginAttempts.delete(ip);
    }
  }
  next();
};

// Route de connexion
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

  // Générer le token JWT avec plus d'informations
  const tokenPayload = {
    username: user.username,
    role: user.role,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 heures
  };

  try {
    const token = jwt.sign(tokenPayload, JWT_SECRET);
    
    // Vérifier que le token est valide immédiatement
    jwt.verify(token, JWT_SECRET);
    
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

// Route pour vérifier l'état du serveur
app.get('/api/mobile/status', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Route pour récupérer la liste des enseignants
app.get('/api/mobile/enseignant', async (req, res) => {
  // Vérifier le token JWT
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Token manquant ou invalide' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    // Récupérer les enseignants depuis MongoDB
    const enseignants = await Enseignant.find({})
      .select('nom prenom matiere email telephone')
      .sort({ nom: 1, prenom: 1 });
    
    res.json(enseignants);
  } catch (error) {
    console.error('Erreur lors de la récupération des enseignants:', error);
    if (error.name === 'JsonWebTokenError') {
      res.status(401).json({ message: 'Token invalide' });
    } else {
      res.status(500).json({ message: 'Erreur serveur lors de la récupération des enseignants' });
    }
  }
});

// Route pour récupérer la liste des classes
app.get('/api/mobile/classe', async (req, res) => {
  // Vérifier le token JWT
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Token manquant ou invalide' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    // Récupérer les classes depuis MongoDB
    const classes = await Classe.find({})
      .select('nom niveau')
      .sort({ nom: 1 });
    
    res.json(classes);
  } catch (error) {
    console.error('Erreur lors de la récupération des classes:', error);
    if (error.name === 'JsonWebTokenError') {
      res.status(401).json({ message: 'Token invalide' });
    } else {
      res.status(500).json({ message: 'Erreur serveur lors de la récupération des classes' });
    }
  }
});

// Route pour récupérer la liste des salles
app.get('/api/mobile/salle', async (req, res) => {
  // Vérifier le token JWT
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Token manquant ou invalide' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    // Récupérer les salles depuis MongoDB
    const salles = await Salle.find({})
      .select('nom type capacite')
      .sort({ nom: 1 });
    
    res.json(salles);
  } catch (error) {
    console.error('Erreur lors de la récupération des salles:', error);
    if (error.name === 'JsonWebTokenError') {
      res.status(401).json({ message: 'Token invalide' });
    } else {
      res.status(500).json({ message: 'Erreur serveur lors de la récupération des salles' });
    }
  }
});

// Route pour réinitialiser les tentatives de connexion
app.get('/api/mobile/reset-attempts', (req, res) => {
  const ip = req.ip;
  loginAttempts.delete(ip);
  res.json({ message: 'Tentatives réinitialisées' });
});

// Route pour récupérer le planning d'un enseignant
app.get('/api/mobile/cours/enseignant/:id', async (req, res) => {
  // Vérifier le token JWT
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Token manquant ou invalide' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const enseignantId = req.params.id;
    const weekOffset = parseInt(req.query.weekOffset) || 0;

    // Vérifier si l'enseignant existe
    const enseignant = await Enseignant.findById(enseignantId);
    if (!enseignant) {
      return res.status(404).json({ message: 'Enseignant non trouvé' });
    }

    // Calculer la date pour la semaine demandée
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + (weekOffset * 7));
    const targetWeek = getWeekNumber(targetDate);
    const targetYear = targetDate.getFullYear();

    console.log('Recherche des cours pour:', {
      enseignantId,
      semaine: targetWeek,
      annee: targetYear,
      weekOffset
    });

    // Vérifier tous les cours de l'enseignant
    const allCours = await Cours.find({ 'enseignants.id': enseignantId }).lean();
    console.log('Tous les cours de l\'enseignant:', JSON.stringify(allCours, null, 2));

    // Vérifier la structure d'un cours type
    if (allCours.length > 0) {
      console.log('Structure d\'un cours:', Object.keys(allCours[0]));
    }

    // Récupérer les cours de l'enseignant pour la semaine demandée
    const cours = await Cours.find({
      'enseignants.id': enseignantId,
      semaine: targetWeek,
      annee: targetYear
    })
    .populate('uhr', 'start ende')
    .sort({ jour: 1, heure: 1 });

    console.log('Cours trouvés pour la semaine:', JSON.stringify(cours, null, 2));

    // Formater les données pour le client
    const planningData = cours.map(cours => ({
      _id: cours._id,
      jour: cours.jour,
      heure: cours.heure,
      matiere: cours.matiere,
      classe: cours.classe,
      salle: cours.salle,
      annule: cours.annule || false,
      remplace: cours.remplace || false,
      remplacementInfo: cours.remplacementInfo,
      semaine: targetWeek,
      annee: targetYear
    }));

    res.json(planningData);
  } catch (error) {
    console.error('Erreur lors de la récupération du planning:', error);
    if (error.name === 'JsonWebTokenError') {
      res.status(401).json({ message: 'Token invalide' });
    } else {
      res.status(500).json({ message: 'Erreur serveur lors de la récupération du planning' });
    }
  }
});

// Route pour récupérer les horaires (uhrs)
app.get('/api/mobile/uhrs', async (req, res) => {
  console.log('Requête reçue pour les horaires');
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('Token manquant ou invalide');
    return res.status(401).json({ message: 'Token manquant ou invalide' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log('Token vérifié avec succès');
    
    // Récupérer les horaires depuis MongoDB
    const uhrs = await Uhr.find()
      .select('nummer start ende')
      .sort({ nummer: 1 })
      .lean();
    
    console.log('Horaires trouvés:', JSON.stringify(uhrs, null, 2));
    
    if (!uhrs || uhrs.length === 0) {
      console.log('Aucun horaire trouvé dans la base de données');
      return res.status(404).json({ message: 'Aucun horaire disponible' });
    }

    // Transformer les données pour le frontend
    const formattedUhrs = uhrs.map(uhr => ({
      _id: uhr._id,
      debut: uhr.start,
      fin: uhr.ende
    }));
    
    console.log('Horaires formatés:', JSON.stringify(formattedUhrs, null, 2));
    res.json(formattedUhrs);
  } catch (error) {
    console.error('Erreur détaillée lors de la récupération des horaires:', error);
    if (error.name === 'JsonWebTokenError') {
      res.status(401).json({ message: 'Token invalide' });
    } else {
      res.status(500).json({ message: 'Erreur serveur lors de la récupération des horaires' });
    }
  }
});

// Gestion des connexions WebSocket
wss.on('connection', (ws) => {
  console.log('Nouvelle connexion WebSocket établie');

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      if (data.type === 'subscribe' && data.enseignantId) {
        // Stocker la connexion pour cet enseignant
        teacherConnections.set(data.enseignantId, ws);
        console.log(`Enseignant ${data.enseignantId} abonné aux mises à jour`);
      }
    } catch (error) {
      console.error('Erreur lors du traitement du message WebSocket:', error);
    }
  });

  ws.on('close', () => {
    // Supprimer la connexion de tous les enseignants
    for (const [enseignantId, connection] of teacherConnections.entries()) {
      if (connection === ws) {
        teacherConnections.delete(enseignantId);
        console.log(`Connexion WebSocket fermée pour l'enseignant ${enseignantId}`);
      }
    }
  });
});

// Fonction pour émettre les mises à jour du planning
const emitPlanningUpdate = (enseignantId, planning) => {
  const ws = teacherConnections.get(enseignantId);
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'planningUpdate',
      planning: planning
    }));
  }
};

// Modifier la route de mise à jour du planning pour émettre les mises à jour
app.put('/api/planning/:id', async (req, res) => {
  try {
    const updatedPlanning = await Planning.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    
    // Émettre la mise à jour via WebSocket
    emitPlanningUpdate(updatedPlanning.enseignant, updatedPlanning);
    
    res.json(updatedPlanning);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Fonction utilitaire pour obtenir le numéro de la semaine
function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

// Démarrer le serveur
server.listen(PORT, () => {
  console.log(`API mobile démarrée sur le port ${PORT}`);
});

// Gestion propre de l'arrêt
process.on('SIGTERM', () => {
  console.log('Arrêt de l\'API mobile...');
  server.close(() => {
    console.log('API mobile arrêtée');
    process.exit(0);
  });
});

module.exports = server; 