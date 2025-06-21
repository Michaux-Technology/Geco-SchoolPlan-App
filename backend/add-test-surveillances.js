const mongoose = require('mongoose');
const Surveillance = require('./models/Surveillance');
const Uhr = require('./models/Uhr');
const Enseignant = require('./models/Enseignant');

// Configuration de la base de données
const MONGODB_URI = 'mongodb://localhost:27017/schoolplan';

async function addTestSurveillances() {
  try {
    // Connexion à MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connecté à MongoDB');

    // Récupérer les créneaux horaires existants
    const timeSlots = await Uhr.find().sort({ start: 1 });
    console.log(`📅 Créneaux horaires trouvés: ${timeSlots.length}`);

    if (timeSlots.length === 0) {
      console.log('❌ Aucun créneau horaire trouvé. Veuillez d\'abord ajouter des créneaux horaires.');
      return;
    }

    // Récupérer le premier enseignant existant
    const enseignants = await Enseignant.find().limit(1);
    if (enseignants.length === 0) {
      console.log('❌ Aucun enseignant trouvé. Veuillez d\'abord ajouter des enseignants.');
      return;
    }

    const enseignant = enseignants[0];
    console.log(`👨‍🏫 Utilisation de l'enseignant: ${enseignant.nom} ${enseignant.prenom} (ID: ${enseignant._id})`);

    // Créer des surveillances de test simples
    const testSurveillances = [
      // Surveillance avant la première heure (Lundi)
      {
        enseignant: enseignant._id,
        jour: 'Lundi',
        uhr: timeSlots[0]._id,
        lieu: 'Entrée principale',
        type: 'entre_creneaux',
        semaine: 24,
        annee: 2025,
        position: -1
      },
      // Surveillance entre créneaux (Mardi)
      {
        enseignant: enseignant._id,
        jour: 'Mardi',
        uhr: timeSlots[1]._id,
        lieu: 'Couloir 1er étage',
        type: 'entre_creneaux',
        semaine: 24,
        annee: 2025,
        position: 0
      },
      // Surveillance entre créneaux (Mercredi)
      {
        enseignant: enseignant._id,
        jour: 'Mercredi',
        uhr: timeSlots[2]._id,
        lieu: 'Cantine',
        type: 'entre_creneaux',
        semaine: 24,
        annee: 2025,
        position: 1
      }
    ];

    // Supprimer les anciennes surveillances de test
    await Surveillance.deleteMany({ enseignant: enseignant._id, semaine: 24, annee: 2025 });
    console.log('🗑️ Anciennes surveillances de test supprimées');

    // Ajouter les nouvelles surveillances
    const createdSurveillances = await Surveillance.insertMany(testSurveillances);
    console.log(`✅ ${createdSurveillances.length} surveillances de test ajoutées`);

    // Afficher les surveillances créées
    console.log('\n📋 Surveillances créées:');
    createdSurveillances.forEach((surveillance, index) => {
      console.log(`${index + 1}. ${surveillance.jour} - ${surveillance.lieu} (position: ${surveillance.position})`);
    });

    console.log('\n🎉 Script terminé avec succès!');
    console.log(`\n💡 Pour tester, utilisez l'ID de l'enseignant: ${enseignant._id}`);
    console.log(`📅 Semaine: 24, Année: 2025`);
  } catch (error) {
    console.error('❌ Erreur lors de l\'ajout des surveillances de test:', error);
  } finally {
    // Fermer la connexion
    await mongoose.disconnect();
    console.log('🔌 Déconnecté de MongoDB');
  }
}

// Exécuter le script
addTestSurveillances(); 