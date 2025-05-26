const mongoose = require('mongoose');

const enseignantSchema = new mongoose.Schema({
  nom: {
    type: String,
    required: true
  },
  prenom: {
    type: String,
    required: true
  },
  matiere: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: false,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Veuillez entrer une adresse email valide']
  },
  telephone: {
    type: String,
    required: false,
    match: [/^(\+33|0)[1-9](\d{2}){4}$/, 'Veuillez entrer un numéro de téléphone valide']
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
enseignantSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const Enseignant = mongoose.model('Enseignant', enseignantSchema);

module.exports = Enseignant; 