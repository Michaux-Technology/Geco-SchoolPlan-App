const mongoose = require('mongoose');
const Surveillance = require('./models/Surveillance');
const Enseignant = require('./models/Enseignant');

// Connexion à MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://192.168.1.104:27017/Geco-SchoolPlan';

async function migrateSurveillances() {
  try {
    console.log('🔌 Connexion à MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connecté à MongoDB');

    // Récupérer toutes les surveillances
    const surveillances = await Surveillance.find({});
    console.log(`📋 Trouvé ${surveillances.length} surveillances à migrer`);

    // Récupérer tous les enseignants
    const enseignants = await Enseignant.find({});
    console.log(`👨‍🏫 Trouvé ${enseignants.length} enseignants`);

    // Créer un mapping nom -> ID
    const enseignantMapping = {};
    enseignants.forEach(enseignant => {
      enseignantMapping[enseignant.nom] = enseignant._id;
    });

    console.log('🗺️ Mapping des enseignants:', enseignantMapping);

    let updatedCount = 0;
    let errorCount = 0;

    for (const surveillance of surveillances) {
      try {
        // Vérifier si le champ enseignant est déjà un ObjectId
        if (mongoose.Types.ObjectId.isValid(surveillance.enseignant)) {
          console.log(`⏭️ Surveillance ${surveillance._id} déjà migrée (ObjectId)`);
          continue;
        }

        // Vérifier si c'est un nom d'enseignant
        if (typeof surveillance.enseignant === 'string') {
          const enseignantId = enseignantMapping[surveillance.enseignant];
          
          if (enseignantId) {
            // Mettre à jour la surveillance avec l'ID de l'enseignant
            await Surveillance.findByIdAndUpdate(
              surveillance._id,
              { enseignant: enseignantId },
              { new: true }
            );
            console.log(`✅ Surveillance ${surveillance._id} migrée: "${surveillance.enseignant}" -> ${enseignantId}`);
            updatedCount++;
          } else {
            console.error(`❌ Enseignant non trouvé: "${surveillance.enseignant}" pour la surveillance ${surveillance._id}`);
            errorCount++;
          }
        } else {
          console.error(`❌ Format d'enseignant invalide pour la surveillance ${surveillance._id}:`, surveillance.enseignant);
          errorCount++;
        }
      } catch (error) {
        console.error(`❌ Erreur lors de la migration de la surveillance ${surveillance._id}:`, error);
        errorCount++;
      }
    }

    console.log('\n📊 Résumé de la migration:');
    console.log(`✅ Surveillances migrées: ${updatedCount}`);
    console.log(`❌ Erreurs: ${errorCount}`);
    console.log(`⏭️ Déjà migrées: ${surveillances.length - updatedCount - errorCount}`);

  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Déconnecté de MongoDB');
  }
}

// Exécuter la migration
migrateSurveillances(); 