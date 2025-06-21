const mongoose = require('mongoose');

const annotationSchema = new mongoose.Schema({
  jour: {
    type: String,
    required: true,
    enum: ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi']
  },
  annotation: {
    type: String,
    default: ''
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
  date: {
    type: Date,
    required: true
  }
}, {
  timestamps: true
});

// Index composé pour s'assurer qu'il n'y a qu'une seule annotation par jour et par date
annotationSchema.index({ jour: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Annotation', annotationSchema); 