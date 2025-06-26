const mongoose = require('mongoose');
const Surveillance = require('./models/Surveillance');

// Connexion à MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://192.168.1.104:27017/Geco-SchoolPlan';

async function fixSurveillancePositions() {
  try {
    console.log('🔌 Connexion à MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connecté à MongoDB');

    // Récupérer toutes les surveillances avec position > 1
    const surveillancesToFix = await Surveillance.find({
      position: { $gt: 1 }
    });
    
    console.log(`📋 Trouvé ${surveillancesToFix.length} surveillances avec position > 1`);

    let updatedCount = 0;

    for (const surveillance of surveillancesToFix) {
      try {
        // Mettre la position à 0 pour toutes les surveillances entre les heures
        await Surveillance.findByIdAndUpdate(
          surveillance._id,
          { position: 0 },
          { new: true }
        );
        console.log(`✅ Surveillance ${surveillance._id} corrigée: position ${surveillance.position} -> 0`);
        updatedCount++;
      } catch (error) {
        console.error(`❌ Erreur lors de la correction de la surveillance ${surveillance._id}:`, error);
      }
    }

    console.log('\n📊 Résumé de la correction:');
    console.log(`✅ Surveillances corrigées: ${updatedCount}`);

    // Afficher un résumé des positions actuelles
    const positionStats = await Surveillance.aggregate([
      {
        $group: {
          _id: '$position',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    console.log('\n📈 Statistiques des positions actuelles:');
    positionStats.forEach(stat => {
      console.log(`Position ${stat._id}: ${stat.count} surveillances`);
    });

  } catch (error) {
    console.error('❌ Erreur lors de la correction:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Déconnecté de MongoDB');
  }
}

// Exécuter la correction
fixSurveillancePositions(); 