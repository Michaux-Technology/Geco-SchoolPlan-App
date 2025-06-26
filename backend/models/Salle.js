const mongoose = require('mongoose');

const salleSchema = new mongoose.Schema({
  nom: {
    type: String,
    required: true,
    trim: true
  },
  capacite: {
    type: Number,
    required: true,
    min: 1
  },
  description: {
    type: String,
    trim: true
  },
  type: {
    type: String,
    enum: [
      'Bibliothèque',
      'Gymnase',
      'Laboratoire',
      'Salle d\'art',
      'Salle de classe',
      'Salle de langue Etrangère',
      'Salle de musique',
      'Salle de sport',
      'Salle informatique',
      'Autre'
    ],
    default: 'Salle de classe'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Salle', salleSchema); 