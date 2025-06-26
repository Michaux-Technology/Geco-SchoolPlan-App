const mongoose = require('mongoose');

const planningSchema = new mongoose.Schema({
  enseignant: {
    type: String,
    required: true
  },
  matiere: {
    type: String,
    required: true
  },
  salle: {
    type: String,
    required: true
  },
  jour: {
    type: String,
    required: true,
    enum: ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
  },
  uhr: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Uhr',
    required: true
  },
  semaine: {
    type: Number,
    required: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Planning', planningSchema); 