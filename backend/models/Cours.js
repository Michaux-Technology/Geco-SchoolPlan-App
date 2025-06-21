const mongoose = require('mongoose');

const coursSchema = new mongoose.Schema({
  classe: {
    type: String,
    required: true
  },
  enseignants: [{
    nom: {
      type: String,
      required: true
    },
    id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Enseignant',
      required: true
    }
  }],
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
    enum: ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi']
  },
  heure: {
    type: String,
    required: true,
    validate: {
      validator: function(v) {
        // Accepter le format "HH:MM - HH:MM"
        return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9] - ([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
      },
      message: props => `${props.value} n'est pas un format d'heure valide. Utilisez le format "HH:MM - HH:MM"`
    }
  },
  uhr: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Uhr',
    required: true
  },
  semaine: {
    type: Number,
    required: true
  },
  annee: {
    type: Number,
    required: true,
    default: new Date().getFullYear()
  },
  annule: {
    type: Boolean,
    default: false
  },
  remplace: {
    type: Boolean,
    default: false
  },
  remplacementInfo: {
    type: String,
    default: ''
  },
  commentaire: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Cours', coursSchema); 