const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const authRoutes = require('./routes/auth');
const Planning = require('./models/Planning');
const Uhr = require('./models/Uhr');
const Surveillance = require('./models/Surveillance');
const Enseignant = require('./models/Enseignant');
const Matiere = require('./models/Matiere');
const Classe = require('./models/Classe');
const Salle = require('./models/Salle');
const Cours = require('./models/Cours');
const Annotation = require('./models/Annotation');
require('dotenv').config();

// Configuration JWT et utilisateurs par défaut
const JWT_SECRET = process.env.JWT_SECRET || 'votre_secret_jwt';
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
const MAX_LOGIN_ATTEMPTS = 10;
const BLOCK_DURATION = 15 * 60 * 1000; // 15 minutes

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

// Fonction pour obtenir le numéro de la semaine
function getWeekNumber(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
  const week1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
}

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Initialiser les données
let planning = [];
let surveillances = [];
let zeitslots = [];
let enseignants = [];
let cours = [];
let classes = [];
let matieres = [];
let salles = [];
let uhrs = [];

// Fonction pour charger les données
async function loadData() {
  try {
    planning = await Planning.find();
    surveillances = await Surveillance.find().populate('enseignant');
    zeitslots = await Uhr.find();
    enseignants = await Enseignant.find();
    cours = await Cours.find();
    classes = await Classe.find();
    matieres = await Matiere.find();
    salles = await Salle.find();
    uhrs = await Uhr.find();

    console.log('Données chargées:');
    console.log('- Planning:', planning.length);
    console.log('- Surveillances:', surveillances.length);
    console.log('- Zeitslots:', zeitslots.length);
    console.log('- Enseignants:', enseignants.length);
    console.log('- Cours:', cours.length);
    console.log('- Classes:', classes.length);
    console.log('- Matières:', matieres.length);
    console.log('- Salles:', salles.length);
    console.log('- Heures:', uhrs.length);
  } catch (error) {
    console.error('Erreur lors du chargement des données:', error);
  }
}

// Charger les données au démarrage
loadData();

// Fonction pour initialiser les créneaux horaires
async function initializeUhr() {
  try {
    const count = await Uhr.countDocuments();
    console.log('Vérification de la collection Uhr:', count);
    
    if (count === 0) {
      console.log('Initialisation des créneaux horaires...');
      const zeitslots = [
        { nummer: 1, zeitslot: '7:40 - 8:25' },
        { nummer: 2, zeitslot: '8:35 - 9:20' },
        { nummer: 3, zeitslot: '9:30 - 10:15' },
        { nummer: 4, zeitslot: '10:40 - 11:25' },
        { nummer: 5, zeitslot: '11:35 - 12:20' },
        { nummer: 6, zeitslot: '12:30 - 13:15' },
        { nummer: 7, zeitslot: '13:45 - 14:20' },
        { nummer: 8, zeitslot: '14:35 - 15:20' }
      ];
      
      const result = await Uhr.insertMany(zeitslots);
      console.log('✅ Créneaux horaires initialisés avec succès:', result);
    } else {
      console.log('ℹ️ Les créneaux horaires existent déjà');
    }
  } catch (error) {
    console.error('❌ Erreur lors de l\'initialisation des créneaux horaires:', error);
  }
}

// Connexion à MongoDB avec gestion des erreurs améliorée
const MONGODB_URI = 'mongodb://192.168.1.104:27017/Geco-SchoolPlan';

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connecté à MongoDB');

    // Initialiser les tranches horaires si la collection est vide
    await Uhr.initializeUhrs();
    
    // Charger les données
    await loadData();
  } catch (error) {
    console.error('Erreur de connexion à MongoDB:', error);
    process.exit(1);
  }
};

// Appeler la connexion
connectDB();

// Gestion des événements de déconnexion
mongoose.connection.on('disconnected', () => {
  console.log('⚠️ Déconnecté de MongoDB');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ Erreur MongoDB:', err);
});

// Routes
app.use('/api/auth', authRoutes);

// Routes pour les matières
app.get('/api/matieres', async (req, res) => {
  try {
    const matieres = await Matiere.find().sort({ nom: 1 });
    res.json(matieres);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/matieres', async (req, res) => {
  try {
    const matiere = new Matiere(req.body);
    const newMatiere = await matiere.save();
    res.status(201).json(newMatiere);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.put('/api/matieres/:id', async (req, res) => {
  try {
    const matiere = await Matiere.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.json(matiere);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.delete('/api/matieres/:id', async (req, res) => {
  try {
    await Matiere.findByIdAndDelete(req.params.id);
    res.json({ message: 'Matière supprimée' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Routes pour les classes
app.get('/api/classes', async (req, res) => {
  try {
    const classes = await Classe.find().sort({ niveau: 1, nom: 1 });
    res.json(classes);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/classes', async (req, res) => {
  try {
    const classe = new Classe(req.body);
    const newClasse = await classe.save();
    res.status(201).json(newClasse);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.put('/api/classes/:id', async (req, res) => {
  try {
    const classe = await Classe.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.json(classe);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.delete('/api/classes/:id', async (req, res) => {
  try {
    await Classe.findByIdAndDelete(req.params.id);
    res.json({ message: 'Classe supprimée' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Routes pour les salles
app.get('/api/salles', async (req, res) => {
  try {
    const salles = await Salle.find().sort({ nom: 1 });
    res.json(salles);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/salles', async (req, res) => {
  try {
    const salle = new Salle(req.body);
    const newSalle = await salle.save();
    res.status(201).json(newSalle);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.put('/api/salles/:id', async (req, res) => {
  try {
    const salle = await Salle.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.json(salle);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.delete('/api/salles/:id', async (req, res) => {
  try {
    await Salle.findByIdAndDelete(req.params.id);
    res.json({ message: 'Salle supprimée' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Routes pour les cours
app.get('/api/cours', async (req, res) => {
  try {
    const cours = await Cours.find().sort({ jour: 1, heure: 1 });
    res.json(cours);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/cours', async (req, res) => {
  try {
    const coursData = req.body;
    const newCours = await Cours.create({
      classe: coursData.classe,
      enseignants: coursData.enseignants,
      matiere: coursData.matiere,
      salle: coursData.salle,
      jour: coursData.jour,
      heure: coursData.heure,
      uhr: coursData.uhr,
      semaine: coursData.semaine,
      annee: coursData.annee || new Date().getFullYear(),
      commentaire: coursData.commentaire || ''
    });
    res.status(201).json(newCours);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/cours/:id', async (req, res) => {
  try {
    console.log('✏️ Route PUT /api/cours/:id appelée pour le cours:', req.params.id);
    console.log('📝 Données reçues:', req.body);
    
    // Récupérer le cours avant de le modifier pour avoir les informations des enseignants
    const coursToUpdate = await Cours.findById(req.params.id);
    if (!coursToUpdate) {
      console.log('❌ Cours non trouvé:', req.params.id);
      res.status(404).json({ message: 'Cours non trouvé' });
      return;
    }
    
    // Extraire les IDs des enseignants du cours (avant modification)
    const enseignantsIdsBefore = coursToUpdate.enseignants.map(e => e.id.toString());
    console.log('✏️ Modification du cours pour les enseignants:', enseignantsIdsBefore);
    console.log('📋 Enseignants du cours:', coursToUpdate.enseignants);
    
    const coursData = req.body;
    const updatedCours = await Cours.findByIdAndUpdate(req.params.id, coursData, { new: true });
    
    console.log('✅ Cours mis à jour:', updatedCours._id);
    console.log('📋 Nouveau statut du cours:', {
      annule: updatedCours.annule,
      remplace: updatedCours.remplace
    });
    
    // Envoyer la mise à jour générale
    io.emit('coursUpdate', await Cours.find());
    
    // Envoyer une mise à jour spécifique à tous les enseignants concernés
    console.log('📤 Envoi de mises à jour aux enseignants après modification:', enseignantsIdsBefore);
    console.log('🔌 Sockets connectés:', io.sockets.sockets.size);
    
    // Parcourir tous les sockets connectés et envoyer les mises à jour
    io.sockets.sockets.forEach((clientSocket) => {
      console.log(`🔍 Vérification du socket ${clientSocket.id}:`, {
        subscribedEnseignantId: clientSocket.subscribedEnseignantId,
        enseignantsIds: enseignantsIdsBefore,
        isMatch: clientSocket.subscribedEnseignantId && enseignantsIdsBefore.includes(clientSocket.subscribedEnseignantId)
      });
      
      if (clientSocket.subscribedEnseignantId && enseignantsIdsBefore.includes(clientSocket.subscribedEnseignantId)) {
        console.log(`📤 Envoi de mise à jour à l'enseignant ${clientSocket.subscribedEnseignantId} après modification`);
        try {
          sendTeacherUpdate(clientSocket, clientSocket.subscribedEnseignantId);
          console.log(`✅ Mise à jour envoyée avec succès à l'enseignant ${clientSocket.subscribedEnseignantId}`);
        } catch (error) {
          console.error(`❌ Erreur lors de l'envoi de la mise à jour à l'enseignant ${clientSocket.subscribedEnseignantId}:`, error);
        }
      }
    });
    
    res.json(updatedCours);
  } catch (error) {
    console.error('Erreur lors de la modification du cours:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/cours/:id/annuler', async (req, res) => {
  try {
    console.log('🚫 Route d\'annulation appelée pour le cours:', req.params.id);
    console.log('🚫 Méthode HTTP:', req.method);
    console.log('🚫 URL complète:', req.originalUrl);
    console.log('🚫 Headers:', req.headers);
    console.log('🚫 Body:', req.body);
    
    // Récupérer le cours avant de le modifier pour avoir les informations des enseignants
    const coursToUpdate = await Cours.findById(req.params.id);
    if (!coursToUpdate) {
      console.log('❌ Cours non trouvé:', req.params.id);
      res.status(404).json({ message: 'Cours non trouvé' });
      return;
    }
    
    // Extraire les IDs des enseignants du cours
    const enseignantsIds = coursToUpdate.enseignants.map(e => e.id.toString());
    console.log('🚫 Annulation du cours pour les enseignants:', enseignantsIds);
    
    // Mettre à jour le cours
    const updatedCours = await Cours.findByIdAndUpdate(
      req.params.id,
      { annule: true, remplace: false },
      { new: true }
    );
    
    console.log('✅ Cours mis à jour:', updatedCours._id);
    
    // Envoyer une mise à jour spécifique à tous les enseignants concernés
    console.log('📤 Envoi de mises à jour aux enseignants après annulation:', enseignantsIds);
    console.log('🔌 Sockets connectés:', io.sockets.sockets.size);
    
    // Parcourir tous les sockets connectés et envoyer les mises à jour
    io.sockets.sockets.forEach((clientSocket) => {
      console.log(`🔍 Vérification du socket ${clientSocket.id}:`, {
        subscribedEnseignantId: clientSocket.subscribedEnseignantId,
        enseignantsIds: enseignantsIds,
        isMatch: clientSocket.subscribedEnseignantId && enseignantsIds.includes(clientSocket.subscribedEnseignantId)
      });
      
      if (clientSocket.subscribedEnseignantId && enseignantsIds.includes(clientSocket.subscribedEnseignantId)) {
        console.log(`📤 Envoi de mise à jour à l'enseignant ${clientSocket.subscribedEnseignantId} après annulation`);
        try {
          sendTeacherUpdate(clientSocket, clientSocket.subscribedEnseignantId);
          console.log(`✅ Mise à jour envoyée avec succès à l'enseignant ${clientSocket.subscribedEnseignantId}`);
        } catch (error) {
          console.error(`❌ Erreur lors de l'envoi de la mise à jour à l'enseignant ${clientSocket.subscribedEnseignantId}:`, error);
        }
      }
    });
    
    res.json(updatedCours);
  } catch (error) {
    console.error('Erreur lors de l\'annulation du cours:', error);
    res.status(500).json({ message: error.message });
  }
});

app.put('/api/cours/:id/remplacer', async (req, res) => {
  try {
    // Récupérer le cours avant de le modifier pour avoir les informations des enseignants
    const coursToUpdate = await Cours.findById(req.params.id);
    if (!coursToUpdate) {
      res.status(404).json({ message: 'Cours non trouvé' });
      return;
    }
    
    // Extraire les IDs des enseignants du cours (avant modification)
    const enseignantsIdsBefore = coursToUpdate.enseignants.map(e => e.id.toString());
    console.log('🔄 Remplacement du cours pour les enseignants:', enseignantsIdsBefore);
    
    const { enseignant, matiere, salle } = req.body;
    const updatedCours = await Cours.findByIdAndUpdate(
      req.params.id,
      { 
        enseignant: enseignant || undefined,
        matiere: matiere || undefined,
        salle: salle || undefined,
        remplace: true,
        annule: false
      },
      { new: true }
    );
    
    // Envoyer la mise à jour générale
    io.emit('coursUpdate', await Cours.find());
    
    // Envoyer une mise à jour spécifique à tous les enseignants concernés
    console.log('📤 Envoi de mises à jour aux enseignants après remplacement:', enseignantsIdsBefore);
    console.log('🔌 Sockets connectés:', io.sockets.sockets.size);
    
    // Parcourir tous les sockets connectés et envoyer les mises à jour
    io.sockets.sockets.forEach((clientSocket) => {
      console.log(`🔍 Vérification du socket ${clientSocket.id}:`, {
        subscribedEnseignantId: clientSocket.subscribedEnseignantId,
        enseignantsIds: enseignantsIdsBefore,
        isMatch: clientSocket.subscribedEnseignantId && enseignantsIdsBefore.includes(clientSocket.subscribedEnseignantId)
      });
      
      if (clientSocket.subscribedEnseignantId && enseignantsIdsBefore.includes(clientSocket.subscribedEnseignantId)) {
        console.log(`📤 Envoi de mise à jour à l'enseignant ${clientSocket.subscribedEnseignantId} après remplacement`);
        sendTeacherUpdate(clientSocket, clientSocket.subscribedEnseignantId);
      }
    });
    
    res.json(updatedCours);
  } catch (error) {
    console.error('Erreur lors du remplacement du cours:', error);
    res.status(500).json({ message: error.message });
  }
});

app.delete('/api/cours/:id', async (req, res) => {
  try {
    // Récupérer le cours avant de le supprimer pour avoir les informations des enseignants
    const coursToDelete = await Cours.findById(req.params.id);
    if (!coursToDelete) {
      res.status(404).json({ message: 'Cours non trouvé' });
      return;
    }
    
    // Extraire les IDs des enseignants du cours
    const enseignantsIds = coursToDelete.enseignants.map(e => e.id.toString());
    console.log('🗑️ Suppression du cours pour les enseignants:', enseignantsIds);
    
    // Supprimer le cours
    await Cours.findByIdAndDelete(req.params.id);
    const coursList = await Cours.find({});
    io.emit('coursUpdate', coursList);
    
    // Envoyer une mise à jour spécifique à tous les enseignants concernés
    console.log('📤 Envoi de mises à jour aux enseignants après suppression:', enseignantsIds);
    console.log('🔌 Sockets connectés:', io.sockets.sockets.size);
    
    // Parcourir tous les sockets connectés et envoyer les mises à jour
    io.sockets.sockets.forEach((clientSocket) => {
      console.log(`🔍 Vérification du socket ${clientSocket.id}:`, {
        subscribedEnseignantId: clientSocket.subscribedEnseignantId,
        enseignantsIds: enseignantsIds,
        isMatch: clientSocket.subscribedEnseignantId && enseignantsIds.includes(clientSocket.subscribedEnseignantId)
      });
      
      if (clientSocket.subscribedEnseignantId && enseignantsIds.includes(clientSocket.subscribedEnseignantId)) {
        console.log(`📤 Envoi de mise à jour à l'enseignant ${clientSocket.subscribedEnseignantId} après suppression`);
        sendTeacherUpdate(clientSocket, clientSocket.subscribedEnseignantId);
      }
    });
    
    res.json({ message: 'Cours supprimé' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Modifier la route pour les statistiques des enseignants
app.get('/api/stats/enseignants', async (req, res) => {
  try {
    const stats = await Cours.aggregate([
      { $unwind: '$enseignantsIds' },
      { $group: { 
        _id: '$enseignantsIds',
        count: { $sum: 1 }
      }},
      { $lookup: {
        from: 'enseignants',
        localField: '_id',
        foreignField: '_id',
        as: 'enseignant'
      }},
      { $unwind: '$enseignant' },
      { $project: {
        nom: '$enseignant.nom',
        count: 1
      }}
    ]);
    
    res.json(stats);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Fonction helper pour envoyer les mises à jour spécifiques à l'enseignant
const sendTeacherUpdate = async (socket, enseignantId) => {
  if (!enseignantId) {
    console.log('❌ Aucun enseignant abonné, pas de mise à jour envoyée');
    return;
  }
  
  try {
    console.log(`🔍 Recherche des cours pour l'enseignant ${enseignantId}...`);
    
    // Récupérer la semaine et l'année actuelles
    const today = new Date();
    const currentWeek = getWeekNumber(today);
    const currentYear = today.getFullYear();
    
    console.log(`📅 Filtrage pour la semaine ${currentWeek} de ${currentYear}`);
    
    const enseignantCours = await Cours.find({
      'enseignants.id': enseignantId.toString(),
      semaine: currentWeek,
      annee: currentYear
    });
    
    console.log(`📚 Cours trouvés pour l'enseignant (semaine ${currentWeek}): ${enseignantCours.length}`);
    
    const enseignantSurveillances = await Surveillance.find({
      enseignant: enseignantId.toString(),
      semaine: currentWeek,
      annee: currentYear
    }).populate('enseignant uhr');
    
    console.log(`👁️ Surveillances trouvées pour l'enseignant (semaine ${currentWeek}): ${enseignantSurveillances.length}`);
    
    const updateData = { 
      cours: enseignantCours, 
      surveillances: enseignantSurveillances, 
      uhrs: uhrs,
      currentWeek: currentWeek,
      currentYear: currentYear
    };
    
    console.log('📤 Envoi de la mise à jour:', {
      enseignantId,
      semaine: currentWeek,
      annee: currentYear,
      coursCount: enseignantCours.length,
      surveillancesCount: enseignantSurveillances.length,
      uhrsCount: uhrs.length
    });
    
    socket.emit('planningUpdate', updateData);
    
    console.log(`✅ Mise à jour envoyée à l'enseignant ${enseignantId}`);
  } catch (error) {
    console.error('❌ Erreur lors de l\'envoi de la mise à jour:', error);
  }
};

// Fonction helper pour envoyer les mises à jour spécifiques à une classe
const sendClassUpdate = async (socket, classeNom) => {
  if (!classeNom) {
    console.log('❌ Aucune classe abonnée, pas de mise à jour envoyée');
    return;
  }
  
  try {
    console.log(`🔍 Recherche des cours pour la classe ${classeNom}...`);
    
    // Récupérer la semaine et l'année actuelles
    const today = new Date();
    const currentWeek = getWeekNumber(today);
    const currentYear = today.getFullYear();
    
    console.log(`📅 Filtrage pour la semaine ${currentWeek} de ${currentYear}`);
    
    const classeCours = await Cours.find({
      classe: classeNom,
      semaine: currentWeek,
      annee: currentYear
    });
    
    console.log(`📚 Cours trouvés pour la classe (semaine ${currentWeek}): ${classeCours.length}`);
    
    const updateData = { 
      cours: classeCours, 
      uhrs: uhrs,
      currentWeek: currentWeek,
      currentYear: currentYear
    };
    
    console.log('📤 Envoi de la mise à jour:', {
      classeNom,
      semaine: currentWeek,
      annee: currentYear,
      coursCount: classeCours.length,
      uhrsCount: uhrs.length
    });
    
    socket.emit('planningUpdate', updateData);
    
    console.log(`✅ Mise à jour envoyée à la classe ${classeNom}`);
  } catch (error) {
    console.error('❌ Erreur lors de l\'envoi de la mise à jour:', error);
  }
};

// Gestion des mises à jour en temps réel avec Socket.IO
io.on('connection', (socket) => {
  console.log('Nouvelle connexion Socket.IO');

  // Stocker l'ID de l'enseignant ou le nom de la classe pour ce socket
  let subscribedEnseignantId = null;
  let subscribedClasseNom = null;

  // Gérer l'abonnement d'un enseignant ou d'une classe
  socket.on('subscribe', async (data) => {
    try {
      console.log('📡 Abonnement reçu:', data);
      console.log('🔌 Sockets connectés:', io.sockets.sockets.size);
      console.log('📋 Liste des sockets abonnés:', Array.from(io.sockets.sockets.values()).map(s => ({
        enseignantId: s.subscribedEnseignantId,
        classeNom: s.subscribedClasseNom
      })).filter(s => s.enseignantId || s.classeNom));
      
      // Vérifier si c'est un abonnement d'enseignant ou de classe
      if (data.enseignantId) {
        subscribedEnseignantId = data.enseignantId;
        subscribedClasseNom = null;
        
        // Stocker l'ID de l'enseignant sur le socket
        socket.subscribedEnseignantId = data.enseignantId;
        socket.subscribedClasseNom = null;
        
        // Récupérer la semaine et l'année actuelles
        const today = new Date();
        const currentWeek = getWeekNumber(today);
        const currentYear = today.getFullYear();
        
        console.log(`🔍 Recherche des cours pour l'enseignant ${subscribedEnseignantId} (semaine ${currentWeek})...`);
        const enseignantCours = await Cours.find({
          'enseignants.id': subscribedEnseignantId.toString(),
          semaine: currentWeek,
          annee: currentYear
        });
        
        console.log(`📚 Cours trouvés pour l'enseignant (semaine ${currentWeek}): ${enseignantCours.length}`);
        
        const enseignantSurveillances = await Surveillance.find({
          enseignant: subscribedEnseignantId.toString(),
          semaine: currentWeek,
          annee: currentYear
        }).populate('enseignant uhr');
        
        console.log(`👁️ Surveillances trouvées pour l'enseignant (semaine ${currentWeek}): ${enseignantSurveillances.length}`);
        
        const updateData = { 
          cours: enseignantCours, 
          surveillances: enseignantSurveillances, 
          uhrs: uhrs,
          currentWeek: currentWeek,
          currentYear: currentYear
        };
        
        console.log('📤 Envoi des données initiales:', {
          enseignantId: subscribedEnseignantId,
          semaine: currentWeek,
          annee: currentYear,
          coursCount: enseignantCours.length,
          surveillancesCount: enseignantSurveillances.length,
          uhrsCount: uhrs.length
        });
        
        socket.emit('planningUpdate', updateData);
        
        console.log(`✅ Enseignant ${subscribedEnseignantId} abonné aux mises à jour`);
        
      } else if (data.classeId) {
        subscribedClasseNom = data.classeId;
        subscribedEnseignantId = null;
        
        // Stocker le nom de la classe sur le socket
        socket.subscribedClasseNom = data.classeId;
        socket.subscribedEnseignantId = null;
        
        // Récupérer la semaine et l'année actuelles
        const today = new Date();
        const currentWeek = getWeekNumber(today);
        const currentYear = today.getFullYear();
        
        console.log(`🔍 Recherche des cours pour la classe ${subscribedClasseNom} (semaine ${currentWeek})...`);
        const classeCours = await Cours.find({
          classe: subscribedClasseNom,
          semaine: currentWeek,
          annee: currentYear
        });
        
        console.log(`📚 Cours trouvés pour la classe (semaine ${currentWeek}): ${classeCours.length}`);
        
        const updateData = { 
          cours: classeCours, 
          uhrs: uhrs,
          currentWeek: currentWeek,
          currentYear: currentYear
        };
        
        console.log('📤 Envoi des données initiales:', {
          classeNom: subscribedClasseNom,
          semaine: currentWeek,
          annee: currentYear,
          coursCount: classeCours.length,
          uhrsCount: uhrs.length
        });
        
        socket.emit('planningUpdate', updateData);
        
        console.log(`✅ Classe ${subscribedClasseNom} abonnée aux mises à jour`);
        
      } else {
        throw new Error('Aucun enseignantId ou classeId fourni dans l\'abonnement');
      }
      
    } catch (error) {
      console.error('❌ Erreur lors de l\'abonnement:', error);
      socket.emit('error', error.message);
    }
  });

  // Envoyer les données initiales
  socket.emit('planningUpdate', { planning, surveillances, zeitslots });
  socket.emit('enseignantsUpdate', enseignants);
  socket.emit('coursUpdate', cours);
  socket.emit('classesUpdate', classes);
  socket.emit('matieresUpdate', matieres);
  socket.emit('sallesUpdate', salles);
  socket.emit('uhrsUpdate', uhrs);

  // Gérer la mise à jour d'un créneau
  socket.on('updateSlot', async (updatedSlot) => {
    try {
      const result = await Planning.findByIdAndUpdate(
        updatedSlot._id,
        updatedSlot,
        { new: true }
      );
      io.emit('planningUpdate', { planning: await Planning.find({}) });
    } catch (error) {
      socket.emit('error', error.message);
    }
  });

  // Gérer la suppression d'un créneau
  socket.on('deleteSlot', async (slotId) => {
    try {
      const deleted = await Planning.findByIdAndDelete(slotId);
      io.emit('planningUpdate', { planning: await Planning.find({}) });
    } catch (error) {
      socket.emit('error', error.message);
    }
  });

  // Gérer l'ajout d'une nouvelle tranche horaire
  socket.on('addTimeSlot', async (newTimeSlot) => {
    try {
      const existingSlot = await Uhr.findOne({ nummer: newTimeSlot.nummer });
      if (existingSlot) {
        socket.emit('error', 'Numéro déjà existant');
        return;
      }

      const uhrData = {
        nummer: newTimeSlot.nummer,
        start: newTimeSlot.start,
        ende: newTimeSlot.ende
      };

      const createdUhr = await Uhr.create(uhrData);
      zeitslots = await Uhr.find({});
      io.emit('uhrsUpdate', zeitslots);
    } catch (error) {
      socket.emit('error', error.message);
    }
  });

  // Gérer l'ajout d'un nouveau cours
  socket.on('addCours', async (coursData) => {
    try {
      console.log('Données reçues pour l\'ajout d\'un cours:', coursData);
      
      // Récupérer les informations des enseignants
      const enseignants = await Promise.all(
        coursData.enseignants.map(async (nom) => {
          const enseignant = await Enseignant.findOne({ nom });
          if (!enseignant) {
            throw new Error(`Enseignant non trouvé: ${nom}`);
          }
          return {
            nom: enseignant.nom,
            id: enseignant._id
          };
        })
      );

      const newCours = await Cours.create({
        classe: coursData.classe,
        enseignants,
        matiere: coursData.matiere,
        salle: coursData.salle,
        jour: coursData.jour,
        heure: coursData.heure,
        uhr: coursData.uhr,
        semaine: coursData.semaine,
        annee: coursData.annee || new Date().getFullYear(),
        commentaire: coursData.commentaire || ''
      });

      console.log('Nouveau cours créé:', newCours);
      cours = await Cours.find({});
      
      // Envoyer une mise à jour à tous les clients connectés
      io.emit('coursUpdate', cours);
      
      // Envoyer une mise à jour spécifique à tous les enseignants concernés
      const enseignantsIds = enseignants.map(e => e.id.toString());
      const classesNoms = [coursData.classe];
      console.log('📤 Envoi de mises à jour aux enseignants:', enseignantsIds);
      console.log('🔌 Sockets connectés:', io.sockets.sockets.size);
      console.log('📋 Sockets abonnés:', Array.from(io.sockets.sockets.values()).map(s => ({
        id: s.id,
        subscribedEnseignantId: s.subscribedEnseignantId
      })));
      
      // Parcourir tous les sockets connectés et envoyer les mises à jour
      io.sockets.sockets.forEach((clientSocket) => {
        console.log(`🔍 Vérification du socket ${clientSocket.id}:`, {
          subscribedEnseignantId: clientSocket.subscribedEnseignantId,
          enseignantsIds: enseignantsIds,
          isMatch: clientSocket.subscribedEnseignantId && enseignantsIds.includes(clientSocket.subscribedEnseignantId)
        });
        
        if (clientSocket.subscribedEnseignantId && enseignantsIds.includes(clientSocket.subscribedEnseignantId)) {
          console.log(`📤 Envoi de mise à jour à l'enseignant ${clientSocket.subscribedEnseignantId}`);
          sendTeacherUpdate(clientSocket, clientSocket.subscribedEnseignantId);
        }
        if (clientSocket.subscribedClasseNom && classesNoms.includes(clientSocket.subscribedClasseNom)) {
          sendClassUpdate(clientSocket, clientSocket.subscribedClasseNom);
        }
      });
      
      // Envoyer une confirmation de succès
      socket.emit('success', 'Cours ajouté avec succès');
    } catch (error) {
      console.error('Erreur lors de l\'ajout du cours:', error);
      socket.emit('error', error.message);
    }
  });

  // Gérer la copie et le collage d'une semaine
  socket.on('pasteWeek', async (data) => {
    try {
      console.log('Demande de copie de semaine reçue:', data);
      const { courses, surveillances: surveillancesData, targetWeek, targetYear, sourceWeek, sourceYear } = data;
      
      if ((!courses || !Array.isArray(courses) || courses.length === 0) && 
          (!surveillancesData || !Array.isArray(surveillancesData) || surveillancesData.length === 0)) {
        socket.emit('pasteWeekError', 'Aucun cours ou surveillance à copier');
        return;
      }
      
      // Vérifier si nous essayons de coller dans la même semaine
      if (sourceWeek === targetWeek && sourceYear === targetYear) {
        socket.emit('pasteWeekError', 'Impossible de coller dans la même semaine');
        return;
      }
      
      // Ajouter les nouveaux cours
      let successCount = 0;
      let errorCount = 0;
      let surveillanceSuccessCount = 0;
      let surveillanceErrorCount = 0;
      
      // Traiter les cours
      if (courses && Array.isArray(courses) && courses.length > 0) {
        for (const coursData of courses) {
          try {
            // S'assurer que les champs obligatoires sont présents
            if (!coursData.classe || !coursData.enseignants || !coursData.matiere || 
                !coursData.salle || !coursData.jour || !coursData.heure || !coursData.uhr) {
              console.error('Données de cours invalides:', coursData);
              errorCount++;
              continue;
            }
            
            await Cours.create({
              classe: coursData.classe,
              enseignants: coursData.enseignants,
              matiere: coursData.matiere,
              salle: coursData.salle,
              jour: coursData.jour,
              heure: coursData.heure,
              uhr: coursData.uhr,
              semaine: targetWeek,
              annee: targetYear,
              annule: coursData.annule || false,
              remplace: coursData.remplace || false,
              remplacementInfo: coursData.remplacementInfo || '',
              commentaire: coursData.commentaire || ''
            });
            
            successCount++;
          } catch (error) {
            console.error('Erreur lors de la création d\'un cours:', error);
            errorCount++;
          }
        }
      }
      
      // Traiter les surveillances
      if (surveillancesData && Array.isArray(surveillancesData) && surveillancesData.length > 0) {
        for (const surveillanceData of surveillancesData) {
          try {
            // S'assurer que les champs obligatoires sont présents
            if (!surveillanceData.enseignant || !surveillanceData.uhr || !surveillanceData.jour) {
              console.error('Données de surveillance invalides:', surveillanceData);
              surveillanceErrorCount++;
              continue;
            }
            
            await Surveillance.create({
              enseignant: surveillanceData.enseignant,
              lieu: surveillanceData.lieu || '',
              jour: surveillanceData.jour,
              position: surveillanceData.position || -1,
              uhr: surveillanceData.uhr,
              semaine: targetWeek,
              annee: targetYear,
              ordre: surveillanceData.ordre || 0
            });
            
            surveillanceSuccessCount++;
          } catch (error) {
            console.error('Erreur lors de la création d\'une surveillance:', error);
            surveillanceErrorCount++;
          }
        }
      }
      
      // Actualiser les cours et surveillances après l'ajout
      cours = await Cours.find({});
      surveillances = await Surveillance.find({}).populate('enseignant');
      io.emit('coursUpdate', cours);
      io.emit('planningUpdate', { surveillances });
      
      // Envoyer une mise à jour spécifique à tous les enseignants concernés
      const enseignantsIds = courses ? courses.flatMap(c => c.enseignants.map(e => (e.id || e._id).toString())).filter((id, index, arr) => arr.indexOf(id) === index) : [];
      const classesNoms = courses ? courses.map(c => c.classe) : [];
      console.log('📤 Envoi de mises à jour aux enseignants (pasteWeek):', enseignantsIds);
      
      // Parcourir tous les sockets connectés et envoyer les mises à jour
      io.sockets.sockets.forEach((clientSocket) => {
        if (clientSocket.subscribedEnseignantId && enseignantsIds.includes(clientSocket.subscribedEnseignantId)) {
          console.log(`📤 Envoi de mise à jour à l'enseignant ${clientSocket.subscribedEnseignantId}`);
          sendTeacherUpdate(clientSocket, clientSocket.subscribedEnseignantId);
        }
      });
      
      // Envoyer une réponse
      const totalSuccess = successCount + surveillanceSuccessCount;
      const totalErrors = errorCount + surveillanceErrorCount;
      
      if (totalErrors === 0) {
        let message = '';
        if (successCount > 0 && surveillanceSuccessCount > 0) {
          message = `${successCount} cours et ${surveillanceSuccessCount} surveillances copiés avec succès`;
        } else if (successCount > 0) {
          message = `${successCount} cours copiés avec succès`;
        } else if (surveillanceSuccessCount > 0) {
          message = `${surveillanceSuccessCount} surveillances copiées avec succès`;
        }
        
        socket.emit('pasteWeekSuccess', { 
          message: message,
          copied: totalSuccess,
          coursesCopied: successCount,
          surveillancesCopied: surveillanceSuccessCount
        });
      } else {
        let message = '';
        if (successCount > 0 && surveillanceSuccessCount > 0) {
          message = `${successCount} cours et ${surveillanceSuccessCount} surveillances copiés avec succès, ${totalErrors} erreurs`;
        } else if (successCount > 0) {
          message = `${successCount} cours copiés avec succès, ${totalErrors} erreurs`;
        } else if (surveillanceSuccessCount > 0) {
          message = `${surveillanceSuccessCount} surveillances copiées avec succès, ${totalErrors} erreurs`;
        }
        
        socket.emit('pasteWeekSuccess', { 
          message: message,
          copied: totalSuccess,
          errors: totalErrors,
          coursesCopied: successCount,
          surveillancesCopied: surveillanceSuccessCount
        });
      }
    } catch (error) {
      console.error('Erreur lors de la copie de la semaine:', error);
      socket.emit('pasteWeekError', error.message);
    }
  });

  // Gestion de la suppression d'une tranche horaire
  socket.on('deleteTimeSlot', async (timeSlotId) => {
    try {
      await Uhr.findByIdAndDelete(timeSlotId);
      zeitslots = await Uhr.find({});
      io.emit('uhrsUpdate', zeitslots);
    } catch (error) {
      socket.emit('error', error.message);
    }
  });

  // Gestion des surveillances
  socket.on('addSurveillance', async (surveillanceData) => {
    try {
      console.log('Données reçues pour l\'ajout de surveillance:', JSON.stringify(surveillanceData, null, 2));
      
      // Vérifier que toutes les données requises sont présentes
      if (!surveillanceData.annee) {
        console.error('L\'année est manquante dans les données reçues');
        throw new Error('L\'année est requise pour la surveillance');
      }

      // Vérifier que uhr est présent
      if (!surveillanceData.uhr) {
        console.error('Le créneau horaire est manquant dans les données reçues');
        throw new Error('Le créneau horaire est requis pour la surveillance');
      }

      // Vérifier que enseignant est présent
      if (!surveillanceData.enseignant) {
        console.error('L\'enseignant est manquant dans les données reçues');
        throw new Error('L\'enseignant est requis pour la surveillance');
      }

      console.log('Tentative de création de la surveillance...');
      const newSurveillance = await Surveillance.create(surveillanceData);
      console.log('Nouvelle surveillance créée:', JSON.stringify(newSurveillance, null, 2));
      
      console.log('Récupération de la liste mise à jour des surveillances...');
      surveillances = await Surveillance.find({}).populate('enseignant');
      console.log('Liste mise à jour des surveillances:', JSON.stringify(surveillances, null, 2));
      
      console.log('Envoi de la mise à jour aux clients...');
      io.emit('planningUpdate', { surveillances });
      socket.emit('surveillanceAdded', newSurveillance);
      console.log('Mise à jour envoyée avec succès');
    } catch (error) {
      console.error('Erreur lors de l\'ajout de la surveillance:', error);
      socket.emit('surveillanceError', error.message);
    }
  });

  socket.on('updateSurveillance', async (surveillanceData) => {
    try {
      await Surveillance.findByIdAndUpdate(
        surveillanceData._id,
        surveillanceData,
        { new: true }
      );
      surveillances = await Surveillance.find({}).populate('enseignant');
      io.emit('planningUpdate', { surveillances });
      socket.emit('surveillanceUpdated');
    } catch (error) {
      socket.emit('error', error.message);
    }
  });

  socket.on('deleteSurveillance', async (surveillanceId) => {
    try {
      await Surveillance.findByIdAndDelete(surveillanceId);
      surveillances = await Surveillance.find({}).populate('enseignant');
      io.emit('planningUpdate', { surveillances });
      socket.emit('surveillanceDeleted');
    } catch (error) {
      socket.emit('error', error.message);
    }
  });

  // Gestionnaire pour obtenir les surveillances
  socket.on('getSurveillances', async () => {
    try {
      surveillances = await Surveillance.find({}).populate('enseignant');
      socket.emit('planningUpdate', { surveillances });
    } catch (error) {
      socket.emit('error', error.message);
    }
  });

  // Gestion des enseignants
  socket.on('getEnseignants', async () => {
    try {
      enseignants = await Enseignant.find({});
      socket.emit('enseignantsUpdate', enseignants);
    } catch (error) {
      socket.emit('error', error.message);
    }
  });

  socket.on('addEnseignant', async (enseignantData) => {
    try {
      const enseignant = await Enseignant.create(enseignantData);
      enseignants = await Enseignant.find({});
      io.emit('enseignantsUpdate', enseignants);
    } catch (error) {
      socket.emit('error', error.message);
    }
  });

  socket.on('updateEnseignant', async (enseignantData) => {
    try {
      await Enseignant.findByIdAndUpdate(
        enseignantData._id,
        enseignantData,
        { new: true }
      );
      enseignants = await Enseignant.find({});
      io.emit('enseignantsUpdate', enseignants);
    } catch (error) {
      socket.emit('error', error.message);
    }
  });

  socket.on('deleteEnseignant', async (enseignantId) => {
    try {
      await Enseignant.findByIdAndDelete(enseignantId);
      enseignants = await Enseignant.find({});
      io.emit('enseignantsUpdate', enseignants);
    } catch (error) {
      socket.emit('error', error.message);
    }
  });

  // Socket.IO events pour les matières
  socket.on('getMatieres', async () => {
    try {
      matieres = await Matiere.find({});
      socket.emit('matieresUpdate', matieres);
    } catch (error) {
      socket.emit('error', error.message);
    }
  });

  socket.on('addMatiere', async (matiereData) => {
    try {
      const matiere = await Matiere.create(matiereData);
      matieres = await Matiere.find({});
      io.emit('matieresUpdate', matieres);
    } catch (error) {
      socket.emit('error', error.message);
    }
  });

  socket.on('updateMatiere', async (matiereData) => {
    try {
      await Matiere.findByIdAndUpdate(matiereData._id, matiereData);
      const matieres = await Matiere.find({});
      io.emit('matieresUpdate', matieres);
    } catch (error) {
      socket.emit('error', error.message);
    }
  });

  socket.on('deleteMatiere', async (id) => {
    try {
      await Matiere.findByIdAndDelete(id);
      const matieres = await Matiere.find({});
      io.emit('matieresUpdate', matieres);
    } catch (error) {
      socket.emit('error', error.message);
    }
  });

  // Socket.IO events pour les classes
  socket.on('getClasses', async () => {
    try {
      classes = await Classe.find({});
      socket.emit('classesUpdate', classes);
    } catch (error) {
      socket.emit('error', error.message);
    }
  });

  socket.on('addClasse', async (classeData) => {
    try {
      const classe = await Classe.create(classeData);
      classes = await Classe.find({});
      io.emit('classesUpdate', classes);
    } catch (error) {
      socket.emit('error', error.message);
    }
  });

  socket.on('updateClasse', async (classeData) => {
    try {
      await Classe.findByIdAndUpdate(classeData._id, classeData);
      const classes = await Classe.find({});
      io.emit('classesUpdate', classes);
    } catch (error) {
      socket.emit('error', error.message);
    }
  });

  socket.on('deleteClasse', async (id) => {
    try {
      await Classe.findByIdAndDelete(id);
      const classes = await Classe.find({});
      io.emit('classesUpdate', classes);
    } catch (error) {
      socket.emit('error', error.message);
    }
  });

  // Socket.IO events pour les salles
  socket.on('getSalles', async () => {
    try {
      salles = await Salle.find({});
      socket.emit('sallesUpdate', salles);
    } catch (error) {
      socket.emit('error', error.message);
    }
  });

  socket.on('addSalle', async (salleData) => {
    try {
      const salle = await Salle.create(salleData);
      salles = await Salle.find({});
      io.emit('sallesUpdate', salles);
    } catch (error) {
      socket.emit('error', error.message);
    }
  });

  socket.on('updateSalle', async (salleData) => {
    try {
      await Salle.findByIdAndUpdate(salleData._id, salleData);
      const salles = await Salle.find({});
      io.emit('sallesUpdate', salles);
    } catch (error) {
      socket.emit('error', error.message);
    }
  });

  socket.on('deleteSalle', async (id) => {
    try {
      await Salle.findByIdAndDelete(id);
      const salles = await Salle.find({});
      io.emit('sallesUpdate', salles);
    } catch (error) {
      socket.emit('error', error.message);
    }
  });

  // Gestionnaire pour obtenir les cours
  socket.on('getCours', async () => {
    try {
      cours = await Cours.find({});
      socket.emit('coursUpdate', cours);
    } catch (error) {
      socket.emit('error', error.message);
    }
  });

  socket.on('updateCours', async (coursData) => {
    try {
      console.log('Mise à jour du cours reçue:', coursData);
      
      // Vérifier que l'ID du cours est valide
      if (!coursData._id) {
        throw new Error('ID de cours invalide');
      }
      
      // Trouver le cours existant
      const existingCours = await Cours.findById(coursData._id);
      if (!existingCours) {
        throw new Error('Cours non trouvé');
      }
      
      // Mettre à jour le cours avec les nouvelles données
      Object.keys(coursData).forEach(key => {
        if (key !== '_id') {
          existingCours[key] = coursData[key];
        }
      });
      
      // Sauvegarder les modifications
      await existingCours.save();
      
      console.log('Cours mis à jour avec succès:', existingCours);
      
      // Émettre les données mises à jour
      const cours = await Cours.find();
      socket.emit('coursUpdate', cours);
      socket.broadcast.emit('coursUpdate', cours);
      
      socket.emit('success', 'Cours mis à jour avec succès');
    } catch (error) {
      console.error('Erreur lors de la mise à jour du cours:', error);
      socket.emit('error', error.message);
    }
  });

  socket.on('deleteCours', async (id) => {
    try {
      // Récupérer le cours avant de le supprimer pour avoir les informations des enseignants
      const coursToDelete = await Cours.findById(id);
      if (!coursToDelete) {
        socket.emit('error', 'Cours non trouvé');
        return;
      }
      
      // Extraire les IDs des enseignants du cours
      const enseignantsIds = coursToDelete.enseignants.map(e => e.id.toString());
      console.log('🗑️ Suppression du cours pour les enseignants:', enseignantsIds);
      
      // Supprimer le cours
      await Cours.findByIdAndDelete(id);
      const coursList = await Cours.find({});
      io.emit('coursUpdate', coursList);
      
      // Envoyer une mise à jour spécifique à tous les enseignants concernés
      console.log('📤 Envoi de mises à jour aux enseignants après suppression:', enseignantsIds);
      console.log('🔌 Sockets connectés:', io.sockets.sockets.size);
      
      // Parcourir tous les sockets connectés et envoyer les mises à jour
      io.sockets.sockets.forEach((clientSocket) => {
        console.log(`🔍 Vérification du socket ${clientSocket.id}:`, {
          subscribedEnseignantId: clientSocket.subscribedEnseignantId,
          enseignantsIds: enseignantsIds,
          isMatch: clientSocket.subscribedEnseignantId && enseignantsIds.includes(clientSocket.subscribedEnseignantId)
        });
        
        if (clientSocket.subscribedEnseignantId && enseignantsIds.includes(clientSocket.subscribedEnseignantId)) {
          console.log(`📤 Envoi de mise à jour à l'enseignant ${clientSocket.subscribedEnseignantId} après suppression`);
          sendTeacherUpdate(clientSocket, clientSocket.subscribedEnseignantId);
        }
      });
      
      socket.emit('success', 'Cours supprimé avec succès');
    } catch (error) {
      console.error('Erreur lors de la suppression du cours:', error);
      socket.emit('error', error.message);
    }
  });

  // Gestionnaire pour obtenir les heures
  socket.on('getUhrs', async () => {
    try {
      zeitslots = await Uhr.find({});
      socket.emit('uhrsUpdate', zeitslots);
    } catch (error) {
      socket.emit('error', error.message);
    }
  });

  socket.on('addUhr', async (uhrData) => {
    try {
      console.log('➕ Événement addUhr reçu:', uhrData);
      
      const newUhr = await Uhr.create(uhrData);
      console.log('✅ Nouvelle tranche horaire créée:', newUhr);
      
      zeitslots = await Uhr.find({});
      console.log('📤 Envoi de la mise à jour des tranches horaires:', zeitslots);
      io.emit('uhrsUpdate', zeitslots);
      
      console.log('✅ Ajout de tranche horaire envoyé avec succès');
    } catch (error) {
      console.error('❌ Erreur lors de l\'ajout de la tranche horaire:', error);
      socket.emit('error', error.message);
    }
  });

  socket.on('updateUhr', async (uhrData) => {
    try {
      console.log('🕐 Événement updateUhr reçu:', uhrData);
      
      const updatedUhr = await Uhr.findByIdAndUpdate(uhrData._id, uhrData, { new: true });
      console.log('✅ Tranche horaire mise à jour:', updatedUhr);
      
      zeitslots = await Uhr.find({});
      console.log('📤 Envoi de la mise à jour des tranches horaires:', zeitslots);
      io.emit('uhrsUpdate', zeitslots);
      
      console.log('✅ Mise à jour des tranches horaires envoyée avec succès');
    } catch (error) {
      console.error('❌ Erreur lors de la mise à jour de la tranche horaire:', error);
      socket.emit('error', error.message);
    }
  });

  socket.on('deleteUhr', async (uhrId) => {
    try {
      console.log('🗑️ Événement deleteUhr reçu pour l\'ID:', uhrId);
      
      const deletedUhr = await Uhr.findByIdAndDelete(uhrId);
      console.log('✅ Tranche horaire supprimée:', deletedUhr);
      
      zeitslots = await Uhr.find({});
      console.log('📤 Envoi de la mise à jour des tranches horaires:', zeitslots);
      io.emit('uhrsUpdate', zeitslots);
      
      console.log('✅ Suppression de tranche horaire envoyée avec succès');
    } catch (error) {
      console.error('❌ Erreur lors de la suppression de la tranche horaire:', error);
      socket.emit('error', error.message);
    }
  });

  // Gérer l'annulation d'un cours
  socket.on('cancelCours', async (coursId) => {
    try {
      console.log('🚫 Événement cancelCours reçu pour le cours:', coursId);
      
      // Récupérer le cours avant de le modifier pour avoir les informations des enseignants
      const coursToUpdate = await Cours.findById(coursId);
      if (!coursToUpdate) {
        console.log('❌ Cours non trouvé:', coursId);
        socket.emit('error', 'Cours non trouvé');
        return;
      }
      
      // Extraire les IDs des enseignants du cours
      const enseignantsIds = coursToUpdate.enseignants.map(e => e.id.toString());
      console.log('🚫 Annulation du cours pour les enseignants:', enseignantsIds);
      
      // Marquer le cours comme annulé au lieu de le supprimer
      const updatedCours = await Cours.findByIdAndUpdate(
        coursId,
        { annule: true, remplace: false },
        { new: true }
      );
      
      console.log('✅ Cours marqué comme annulé:', updatedCours._id);
      
      // Envoyer une mise à jour spécifique à tous les enseignants concernés
      console.log('📤 Envoi de mises à jour aux enseignants après annulation:', enseignantsIds);
      console.log('🔌 Sockets connectés:', io.sockets.sockets.size);
      
      // Parcourir tous les sockets connectés et envoyer les mises à jour
      io.sockets.sockets.forEach((clientSocket) => {
        console.log(`🔍 Vérification du socket ${clientSocket.id}:`, {
          subscribedEnseignantId: clientSocket.subscribedEnseignantId,
          enseignantsIds: enseignantsIds,
          isMatch: clientSocket.subscribedEnseignantId && enseignantsIds.includes(clientSocket.subscribedEnseignantId)
        });
        
        if (clientSocket.subscribedEnseignantId && enseignantsIds.includes(clientSocket.subscribedEnseignantId)) {
          console.log(`📤 Envoi de mise à jour à l'enseignant ${clientSocket.subscribedEnseignantId} après annulation`);
          try {
            sendTeacherUpdate(clientSocket, clientSocket.subscribedEnseignantId);
            console.log(`✅ Mise à jour envoyée avec succès à l'enseignant ${clientSocket.subscribedEnseignantId}`);
          } catch (error) {
            console.error(`❌ Erreur lors de l'envoi de la mise à jour à l'enseignant ${clientSocket.subscribedEnseignantId}:`, error);
          }
        }
      });
      
      socket.emit('success', 'Cours annulé avec succès');
    } catch (error) {
      console.error('Erreur lors de l\'annulation du cours:', error);
      socket.emit('error', error.message);
    }
  });

  // Gérer le remplacement d'un cours
  socket.on('replaceCours', async (coursData) => {
    try {
      // Récupérer le cours avant de le modifier pour avoir les informations des enseignants
      const coursToUpdate = await Cours.findById(coursData._id);
      if (!coursToUpdate) {
        socket.emit('error', 'Cours non trouvé');
        return;
      }
      
      // Extraire les IDs des enseignants du cours (avant et après modification)
      const enseignantsIdsBefore = coursToUpdate.enseignants.map(e => e.id.toString());
      const enseignantsIdsAfter = coursData.enseignants.map(e => e.id.toString());
      const allEnseignantsIds = [...new Set([...enseignantsIdsBefore, ...enseignantsIdsAfter])];
      
      console.log('🔄 Remplacement du cours pour les enseignants:', allEnseignantsIds);
      
      // Mettre à jour le cours
      await Cours.findByIdAndUpdate(coursData._id, coursData, { new: true });
      cours = await Cours.find({});
      io.emit('coursUpdate', cours);
      
      // Envoyer une mise à jour spécifique à tous les enseignants concernés
      console.log('📤 Envoi de mises à jour aux enseignants après remplacement:', allEnseignantsIds);
      
      // Parcourir tous les sockets connectés et envoyer les mises à jour
      io.sockets.sockets.forEach((clientSocket) => {
        if (clientSocket.subscribedEnseignantId && allEnseignantsIds.includes(clientSocket.subscribedEnseignantId)) {
          console.log(`📤 Envoi de mise à jour à l'enseignant ${clientSocket.subscribedEnseignantId} après remplacement`);
          sendTeacherUpdate(clientSocket, clientSocket.subscribedEnseignantId);
        }
      });
      
      socket.emit('success', 'Cours remplacé avec succès');
    } catch (error) {
      console.error('Erreur lors du remplacement du cours:', error);
      socket.emit('error', error.message);
    }
  });

  // Routes pour les annotations
  socket.on('saveAnnotation', async (data) => {
    try {
      const { jour, annotation, semaine, date, annee } = data;
      
      if (!jour || !semaine || !date || !annee) {
        throw new Error('Données manquantes pour la sauvegarde de l\'annotation');
      }

      // Normaliser le format du jour
      const normalizedJour = jour.charAt(0).toUpperCase() + jour.slice(1).toLowerCase();
      
      // Rechercher une annotation existante pour ce jour et cette semaine
      let existingAnnotation = await Annotation.findOne({ 
        jour: normalizedJour, 
        semaine: semaine,
        annee: annee
      });

      if (existingAnnotation) {
        // Mettre à jour l'annotation existante
        existingAnnotation.annotation = annotation;
        existingAnnotation.date = new Date(date);
        await existingAnnotation.save();
      } else {
        // Créer une nouvelle annotation
        existingAnnotation = await Annotation.create({ 
          jour: normalizedJour, 
          annotation, 
          semaine,
          annee,
          date: new Date(date)
        });
      }
      
      // Récupérer toutes les annotations pour la semaine actuelle
      const annotations = await Annotation.find({
        semaine: semaine,
        annee: annee
      });
      
      const annotationsMap = {};
      annotations.forEach(ann => {
        annotationsMap[ann.jour] = ann.annotation;
      });
      
      // Envoyer les annotations mises à jour à tous les clients
      io.emit('annotationsUpdate', annotationsMap);
    } catch (error) {
      console.error('Erreur lors de la sauvegarde de l\'annotation:', error);
      socket.emit('annotationError', error.message);
    }
  });

  socket.on('getAnnotations', async (data) => {
    try {
      console.log('Données reçues:', data);
      
      // Vérifier que les données sont valides
      if (!data || typeof data.semaine === 'undefined' || typeof data.annee === 'undefined') {
        console.error('Données invalides:', data);
        throw new Error('Données invalides pour la recherche d\'annotations');
      }

      const semaine = Number(data.semaine);
      const annee = Number(data.annee);
      
      console.log('Recherche d\'annotations pour la semaine', semaine, 'et l\'année', annee);

      const annotations = await Annotation.find({
        semaine: semaine,
        annee: annee
      });
      
      console.log('Annotations trouvées:', annotations);
      
      const annotationsMap = {};
      annotations.forEach(ann => {
        annotationsMap[ann.jour] = ann.annotation;
      });
      
      socket.emit('annotationsUpdate', annotationsMap);
    } catch (error) {
      console.error('Erreur lors de la récupération des annotations:', error);
      socket.emit('annotationError', error.message);
    }
  });

  socket.on('disconnect', () => {
    socket.emit('error', 'Client déconnecté');
  });
});

// Routes de base
app.get('/', (req, res) => {
  res.json({ message: 'Bienvenue sur l\'API Geco-SchoolPlan' });
});

// Gestion des erreurs globales
app.use((err, req, res, next) => {
  console.error('❌ Erreur serveur:', err);
  res.status(500).json({ 
    success: false,
    message: 'Une erreur est survenue sur le serveur',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Port d'écoute
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur le port ${PORT}`);
});

// Intégration des routes mobiles
const mobileApi = require('./mobile-api');
mobileApi(app, { checkLoginAttempts, defaultUsers, JWT_SECRET, loginAttempts });

app.post('/api/update-uhr', async (req, res) => {
  try {
    const { _id, nummer, zeitslot } = req.body;
    const updatedUhr = await Uhr.findByIdAndUpdate(
      _id,
      { nummer, zeitslot },
      { new: true }
    );
    io.emit('uhrsUpdate', await Uhr.find());
    res.json(updatedUhr);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/surveillances', async (req, res) => {
  try {
    const surveillanceData = req.body;
    if (!surveillanceData.annee) {
      res.status(400).json({ error: 'L\'année est manquante' });
      return;
    }
    if (!surveillanceData.uhr) {
      res.status(400).json({ error: 'Le créneau horaire est manquant' });
      return;
    }
    if (!surveillanceData.enseignant) {
      res.status(400).json({ error: 'L\'enseignant est manquant' });
      return;
    }
    const newSurveillance = await Surveillance.create(surveillanceData);
    const surveillances = await Surveillance.find({}).populate('enseignant');
    io.emit('surveillancesUpdate', surveillances);
    res.status(201).json(newSurveillance);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
