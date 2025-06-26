const mongoose = require('mongoose');

const classeSchema = new mongoose.Schema({
  nom: {
    type: String,
    required: true,
    trim: true
  },
  niveau: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  nombreEleves: {
    type: Number,
    required: true,
    min: 0
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Classe', classeSchema); 