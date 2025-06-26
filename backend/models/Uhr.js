const mongoose = require('mongoose');

const uhrSchema = new mongoose.Schema({
  nummer: {
    type: Number,
    required: true,
    unique: true
  },
  start: {
    type: String,
    required: true
  },
  ende: {
    type: String,
    required: true
  }
});

// Méthode statique pour initialiser les créneaux horaires
uhrSchema.statics.initializeUhrs = async function() {
  try {
    // Vérifier si des créneaux horaires existent déjà
    const count = await this.countDocuments();
    if (count > 0) {
      console.log('Les créneaux horaires existent déjà, pas besoin d\'initialisation');
      return;
    }

    // Créer les créneaux horaires par défaut
    const defaultUhrs = [
      { nummer: 1, start: '07:40', ende: '08:25' },
      { nummer: 2, start: '08:35', ende: '09:20' },
      { nummer: 3, start: '09:30', ende: '10:15' },
      { nummer: 4, start: '10:40', ende: '11:25' },
      { nummer: 5, start: '11:35', ende: '12:20' },
      { nummer: 6, start: '12:30', ende: '13:15' },
      { nummer: 7, start: '13:40', ende: '14:25' },
      { nummer: 8, start: '14:35', ende: '15:20' }
    ];
    
    return await this.insertMany(defaultUhrs);
  } catch (error) {
    throw error;
  }
};

module.exports = mongoose.model('Uhr', uhrSchema); 