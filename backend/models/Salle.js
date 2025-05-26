const mongoose = require('mongoose');

const salleSchema = new mongoose.Schema({
  nom: {
    type: String,
    required: true,
    unique: true
  },
  type: {
    type: String,
    required: true
  },
  capacite: {
    type: Number,
    required: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Middleware pour mettre à jour la date de modification
salleSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const Salle = mongoose.model('Salle', salleSchema);

module.exports = Salle; 