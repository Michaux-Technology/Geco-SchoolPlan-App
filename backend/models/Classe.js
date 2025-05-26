const mongoose = require('mongoose');

const classeSchema = new mongoose.Schema({
  nom: {
    type: String,
    required: true,
    unique: true
  },
  niveau: {
    type: String,
    required: true
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
classeSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const Classe = mongoose.model('Classe', classeSchema);

module.exports = Classe; 