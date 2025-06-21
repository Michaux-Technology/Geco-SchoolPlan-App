const mongoose = require('mongoose');
const Surveillance = require('./models/Surveillance');
const Uhr = require('./models/Uhr');
const Enseignant = require('./models/Enseignant');

// Configuration de la base de données
const MONGODB_URI = 'mongodb://localhost:27017/schoolplan';

async function testSurveillances() {
  try {
    // Connexion à MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connecté à MongoDB');

    // Récupérer les créneaux horaires existants
    const timeSlots = await Uhr.find().sort({ start: 1 });
    console.log(`📅 Créneaux horaires trouvés: ${timeSlots.length}`);

    if (timeSlots.length === 0) {
      console.log('❌ Aucun créneau horaire trouvé.');
      return;
    }

    // Récupérer le premier enseignant existant
    const enseignants = await Enseignant.find().limit(1);
    if (enseignants.length === 0) {
      console.log('❌ Aucun enseignant trouvé.');
      return;
    }

    const enseignant = enseignants[0];
    console.log(`👨‍🏫 Enseignant: ${enseignant.nom} ${enseignant.prenom} (ID: ${enseignant._id})`);

    // Créer une surveillance de test simple
    const testSurveillance = {
      enseignant: enseignant._id,
      jour: 'Lundi',
      uhr: timeSlots[0]._id,
      lieu: 'Entrée principale',
      type: 'entre_creneaux',
      semaine: 24,
      annee: 2025,
      position: -1
    };

    // Supprimer les anciennes surveillances de test
    await Surveillance.deleteMany({ enseignant: enseignant._id, semaine: 24, annee: 2025 });
    console.log('🗑️ Anciennes surveillances supprimées');

    // Ajouter la nouvelle surveillance
    const createdSurveillance = await Surveillance.create(testSurveillance);
    console.log('✅ Surveillance créée:', createdSurveillance);

    // Vérifier que la surveillance existe
    const allSurveillances = await Surveillance.find({ enseignant: enseignant._id });
    console.log('📋 Toutes les surveillances de cet enseignant:', allSurveillances.length);

    console.log('\n🎉 Test terminé!');
    console.log(`💡 ID enseignant: ${enseignant._id}`);
    console.log(`📅 Semaine: 24, Année: 2025`);
  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Déconnecté de MongoDB');
  }
}

testSurveillances(); 