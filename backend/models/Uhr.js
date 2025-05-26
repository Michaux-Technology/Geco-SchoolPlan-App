const mongoose = require('mongoose');

const uhrSchema = new mongoose.Schema({
  nummer: {
    type: Number,
    required: true
  },
  start: {
    type: String,
    required: true,
    trim: true
  },
  ende: {
    type: String,
    required: true,
    trim: true
  }
}, {
  collection: 'uhrs',  // Force le nom de la collection
  strict: false  // Permet des champs supplémentaires dans la base de données
});

// Ajouter un hook pre-find pour logger la requête
uhrSchema.pre('find', function() {
  console.log('Requête MongoDB:', this.getFilter(), this.getOptions());
});

const Uhr = mongoose.model('Uhr', uhrSchema);

module.exports = Uhr; 