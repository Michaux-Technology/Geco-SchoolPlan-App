const mongoose = require('mongoose');

const surveillanceSchema = new mongoose.Schema({
  enseignant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Enseignant',
    required: true
  },
  lieu: {
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
  type: {
    type: String,
    required: true,
    enum: ['normal', 'entre_creneaux'],
    default: 'normal'
  },
  duree: {
    type: Number,
    required: true,
    default: 1,
    min: 1,
    max: 2
  },
  semaine: {
    type: Number,
    required: true
  },
  annee: {
    type: Number,
    required: true
  },
  position: {
    type: Number,
    required: true,
    default: 0
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Surveillance', surveillanceSchema); 