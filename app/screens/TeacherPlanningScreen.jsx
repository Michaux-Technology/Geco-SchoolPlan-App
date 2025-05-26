import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, RefreshControl, Platform, TouchableOpacity, Modal } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { io } from 'socket.io-client';

const TeacherPlanningScreen = ({ route }) => {
  const { school, teacher } = route.params;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [planning, setPlanning] = useState([]);
  const [currentWeek, setCurrentWeek] = useState(null);
  const [currentYear, setCurrentYear] = useState(null);
  const [requestedWeek, setRequestedWeek] = useState(null);
  const [requestedYear, setRequestedYear] = useState(null);
  const [shouldLoadPlanning, setShouldLoadPlanning] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const [timeSlots, setTimeSlots] = useState([]);
  const [loadingTimeSlots, setLoadingTimeSlots] = useState(true);
  const [timeSlotsError, setTimeSlotsError] = useState(null);
  const [socket, setSocket] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [viewKey, setViewKey] = useState(0);
  const [selectedCours, setSelectedCours] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  const days = ['Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.'];

  useEffect(() => {
    // Initialiser la connexion Socket.IO
    connectSocket();

    // Charger les données initiales
    loadTimeSlots();
    
    // Initialiser les états de la semaine avec la date actuelle
    const today = new Date();
    const initialWeek = getWeekNumber(today);
    const initialYear = today.getFullYear();
    
    console.log('Initialisation de la semaine:', {
      date: today,
      semaine: initialWeek,
      annee: initialYear
    });
    
    setCurrentWeek(initialWeek);
    setCurrentYear(initialYear);
    setRequestedWeek(initialWeek);
    setRequestedYear(initialYear);
    
    loadPlanning();

    // Nettoyer la connexion lors du démontage du composant
    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [teacher._id, school.apiUrl]);

  useEffect(() => {
    // Recharger les données lorsque forceRefresh change
    loadTimeSlots();
    loadPlanning();
  }, [viewKey]);

  useEffect(() => {
    if (shouldLoadPlanning) {
      loadPlanning();
      setShouldLoadPlanning(false);
    }
  }, [shouldLoadPlanning]);

  const connectSocket = () => {
    const baseUrl = school.apiUrl.endsWith('/') ? school.apiUrl.slice(0, -1) : school.apiUrl;
    const socketUrl = baseUrl.replace('http', 'ws');
    const newSocket = io(socketUrl, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    newSocket.on('connect', () => {
      console.log('Connecté au serveur Socket.IO');
      setWsConnected(true);
      setError(null);
      // S'abonner aux mises à jour du planning
      newSocket.emit('subscribe', {
        enseignantId: teacher._id
      });
    });

    newSocket.on('planningUpdate', (data) => {
      console.log('Mise à jour du planning reçue:', {
        hasPlanning: Boolean(data.planning),
        hasRemplacements: Boolean(data.planning?.some(cours => cours.remplacement)),
        planningLength: data.planning?.length,
        remplacements: data.planning?.filter(cours => cours.remplacement).map(cours => ({
          matiere: cours.matiere,
          enseignant: cours.remplacement?.enseignant
        }))
      });
      
      setLastUpdate(new Date());
      
      // Mettre à jour les données de planning
      if (data.planning) {
        // Filtrer les cours pour la semaine actuelle
        const filteredPlanning = data.planning.filter(cours => 
          cours.semaine === currentWeek && 
          cours.annee === currentYear
        );
        console.log('Planning filtré avec remplacements:', filteredPlanning.map(cours => ({
          matiere: cours.matiere,
          hasRemplacement: Boolean(cours.remplacement),
          remplacement: cours.remplacement
        })));
        setPlanning(filteredPlanning);
      }
      
      // Mettre à jour les créneaux horaires
      if (data.zeitslots) {
        const formattedTimeSlots = data.zeitslots.map(slot => ({
          _id: slot._id,
          debut: slot.start,
          fin: slot.ende
        }));
        console.log('Créneaux horaires mis à jour:', formattedTimeSlots);
        setTimeSlots(formattedTimeSlots);
      }
      
      // Mettre à jour les surveillances
      if (data.surveillances) {
        console.log('Surveillances reçues:', data.surveillances);
      }

      // Forcer un remontage du composant
      setViewKey(prev => prev + 1);
    });

    newSocket.on('connect_error', (error) => {
      console.error('Erreur de connexion Socket.IO:', error);
      setError('Erreur de connexion en temps réel');
      setWsConnected(false);
    });

    newSocket.on('disconnect', () => {
      console.log('Déconnecté du serveur Socket.IO');
      setWsConnected(false);
    });

    setSocket(newSocket);
  };

  const loadTimeSlots = async () => {
    try {
      setLoadingTimeSlots(true);
      setTimeSlotsError(null);
      
      let baseUrl = school.apiUrl.endsWith('/') ? school.apiUrl.slice(0, -1) : school.apiUrl;
      
      // Si on est sur Android et que l'URL est locale, utiliser l'adresse spéciale pour l'émulateur
      if (Platform.OS === 'android') {
        if (baseUrl.includes('192.168.1.124')) {
          baseUrl = baseUrl.replace('192.168.1.124', '10.0.2.2');
        } else if (baseUrl.includes('192.168.1.108')) {
          baseUrl = baseUrl.replace('192.168.1.108', '10.0.2.2');
        }
      }
      
      const apiUrl = `${baseUrl}/api/mobile/uhrs`;
      
      console.log('Tentative de connexion à:', apiUrl);
      console.log('Token utilisé:', school.token ? 'Présent' : 'Manquant');

      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${school.token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });

      console.log('Statut de la réponse:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.log('Erreur reçue:', errorText);
        throw new Error(`Erreur ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log('Données des horaires reçues:', data);
      
      if (Array.isArray(data) && data.length > 0) {
        console.log('Nombre d\'horaires reçus:', data.length);
        setTimeSlots(data);
      } else {
        console.log('Aucun horaire reçu dans les données');
        throw new Error('Aucun horaire disponible');
      }
    } catch (err) {
      console.error('Erreur complète lors du chargement des horaires:', err);
      setTimeSlotsError(err.message);
    } finally {
      setLoadingTimeSlots(false);
    }
  };

  const loadPlanning = async () => {
    try {
      setError(null);

      if (!school?.token) {
        throw new Error('Token d\'authentification manquant');
      }

      const baseUrl = school.apiUrl.endsWith('/') ? school.apiUrl.slice(0, -1) : school.apiUrl;
      const apiUrl = `${baseUrl}/api/mobile/cours/enseignant/${teacher._id}?semaine=${requestedWeek}&annee=${requestedYear}`;

      console.log('Chargement du planning depuis:', apiUrl);
      console.log('Semaine demandée:', requestedWeek);
      console.log('Année demandée:', requestedYear);

      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${school.token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erreur ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log('Planning reçu:', data);
      
      if (data.length > 0) {
        const firstEntry = data[0];
        console.log('Données de la première entrée:', {
          semaine: firstEntry.semaine,
          annee: firstEntry.annee,
          jour: firstEntry.jour
        });
        
        // Si le serveur renvoie toujours la semaine 18, on garde la semaine demandée
        if (firstEntry.semaine === 18) {
          console.log('Le serveur renvoie toujours la semaine 18');
          // On garde la semaine demandée
          setCurrentWeek(requestedWeek);
          setCurrentYear(requestedYear);
        } else {
          setCurrentWeek(firstEntry.semaine);
          setCurrentYear(firstEntry.annee);
        }
      }
      
      setPlanning(data);
    } catch (err) {
      console.error('Erreur lors du chargement du planning:', err);
      setError(err.message || 'Erreur lors du chargement du planning');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getWeekNumber = (date) => {
    // Créer une copie de la date pour ne pas modifier l'original
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    // Définir le jour de la semaine (0 = dimanche, 1 = lundi, etc.)
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    // Obtenir le premier jour de l'année
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    // Calculer le numéro de semaine
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    
    console.log('Calcul de la semaine:', {
      date: d,
      yearStart: yearStart,
      weekNo: weekNo
    });
    
    return weekNo;
  };

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    loadPlanning();
  }, []);

  const getCoursByDayAndHour = (day, hour) => {
    // Convertir le jour abrégé en jour complet
    const joursComplets = {
      'Lun.': 'Lundi',
      'Mar.': 'Mardi',
      'Mer.': 'Mercredi',
      'Jeu.': 'Jeudi',
      'Ven.': 'Vendredi'
    };
    
    const jourComplet = joursComplets[day];
    return planning.filter(cours => 
      cours.jour === jourComplet && 
      cours.heure === hour
    );
  };

  const formatHours = (timeRange) => {
    const [start, end] = timeRange.split(' - ');
    return {
      start,
      end
    };
  };

  const renderTimeCell = (timeSlot) => {
    return (
      <View style={[styles.timeCell, { width: 60 }]}>
        <Text style={styles.timeTextStart}>{timeSlot.debut}</Text>
        <View style={styles.timeSeparator} />
        <Text style={styles.timeTextEnd}>{timeSlot.fin}</Text>
      </View>
    );
  };

  const abrevierMatiere = (matiere) => {
    return matiere.length > 5 ? matiere.substring(0, 5) + '.' : matiere;
  };

  const renderCours = (cours) => {
    if (!cours || cours.length === 0) return null;

    return cours.map((item, index) => (
      <TouchableOpacity 
        key={index} 
        style={[
          styles.coursItem,
          item.annule && styles.coursAnnule,
          item.remplace && styles.coursRemplacement
        ]}
        onPress={() => {
          if (item.remplace) {
            setSelectedCours(item);
            setModalVisible(true);
          }
        }}
      >
        <Text style={[
          styles.coursMatiere,
          item.annule && styles.coursAnnuleText,
          item.remplace && styles.coursRemplacementText
        ]} numberOfLines={1}>
          {abrevierMatiere(item.matiere)}
          {item.annule && ' (Annulé)'}
          {item.remplace && ' (Remplacé)'}
        </Text>
        <Text style={[
          styles.coursClasse,
          item.annule && styles.coursAnnuleText,
          item.remplace && styles.coursRemplacementText
        ]} numberOfLines={1}>
          {item.classe}
        </Text>
        <Text style={[
          styles.coursSalle,
          item.annule && styles.coursAnnuleText,
          item.remplace && styles.coursRemplacementText
        ]} numberOfLines={1}>
          {item.salle}
        </Text>
        {item.remplace && item.remplacementInfo && (
          <Text style={styles.remplacementInfo} numberOfLines={1}>
            {item.remplacementInfo}
          </Text>
        )}
      </TouchableOpacity>
    ));
  };

  const goToPreviousWeek = () => {
    console.log('Navigation vers la semaine précédente');
    if (currentWeek !== null) {
      const newWeek = currentWeek - 1;
      console.log('Nouvelle semaine:', newWeek);
      
      // Mettre à jour les états immédiatement
      setCurrentWeek(newWeek);
      setCurrentYear(currentYear);
      setRequestedWeek(newWeek);
      setRequestedYear(currentYear);
      setLoading(true);
      
      // Déclencher le chargement du planning
      setShouldLoadPlanning(true);
    }
  };

  const goToNextWeek = () => {
    console.log('Navigation vers la semaine suivante');
    if (currentWeek !== null) {
      const newWeek = currentWeek + 1;
      console.log('Nouvelle semaine:', newWeek);
      
      // Mettre à jour les états immédiatement
      setCurrentWeek(newWeek);
      setCurrentYear(currentYear);
      setRequestedWeek(newWeek);
      setRequestedYear(currentYear);
      setLoading(true);
      
      // Déclencher le chargement du planning
      setShouldLoadPlanning(true);
    }
  };

  // Initialiser le weekOffset à 0 au chargement
  useEffect(() => {
    setWeekOffset(0);
    loadPlanning();
  }, []);

  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Chargement du planning...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <MaterialIcons name="error-outline" size={64} color="#F44336" />
        <Text style={styles.errorText}>{error}</Text>
        <Text style={styles.errorSubtext}>Tirez vers le bas pour réessayer</Text>
      </View>
    );
  }

  if (loadingTimeSlots && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Chargement des horaires...</Text>
      </View>
    );
  }

  if (timeSlotsError) {
    return (
      <View style={styles.centerContainer}>
        <MaterialIcons name="error-outline" size={64} color="#F44336" />
        <Text style={styles.errorText}>{timeSlotsError}</Text>
        <Text style={styles.errorSubtext}>Tirez vers le bas pour réessayer</Text>
      </View>
    );
  }

  return (
    <>
      <ScrollView
        key={viewKey}
        style={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#2196F3']}
            tintColor="#2196F3"
          />
        }
      >
        <View style={styles.planningGrid}>
          {/* Navigation des semaines */}
          <View style={styles.weekNavigation}>
            <TouchableOpacity 
              style={styles.navigationButton} 
              onPress={goToPreviousWeek}
            >
              <MaterialIcons name="chevron-left" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            
            <View style={styles.weekYearContainer}>
              <Text style={styles.weekYearText}>
                Semaine {currentWeek} - {currentYear}
              </Text>
              {lastUpdate && (
                <Text style={styles.lastUpdateText}>
                  Dernière mise à jour : {lastUpdate.toLocaleTimeString()}
                </Text>
              )}
              {!wsConnected && (
                <Text style={styles.connectionStatus}>
                  Reconnexion en cours...
                </Text>
              )}
            </View>
            
            <TouchableOpacity 
              style={styles.navigationButton} 
              onPress={goToNextWeek}
            >
              <MaterialIcons name="chevron-right" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* En-tête des jours */}
          <View style={styles.headerRow}>
            <View style={styles.timeCell}>
              <Text style={styles.headerText}></Text>
            </View>
            {days.map((day, index) => (
              <View key={index} style={styles.dayCell}>
                <Text style={styles.headerText}>{day}</Text>
              </View>
            ))}
          </View>

          {/* Grille des cours */}
          {timeSlots.map((timeSlot, hourIndex) => (
            <View key={hourIndex} style={styles.timeRow}>
              {renderTimeCell(timeSlot)}
              {days.map((day, dayIndex) => (
                <View key={dayIndex} style={styles.planningCell}>
                  {renderCours(getCoursByDayAndHour(day, `${timeSlot.debut} - ${timeSlot.fin}`))}
                </View>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => {
          setModalVisible(false);
        }}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Détails du remplacement</Text>
            {selectedCours && (
              <>
                <Text style={styles.modalText}>
                  <Text style={styles.modalLabel}>Matière :</Text> {selectedCours.matiere}
                </Text>
                <Text style={styles.modalText}>
                  <Text style={styles.modalLabel}>Classe :</Text> {selectedCours.classe}
                </Text>
                <Text style={styles.modalText}>
                  <Text style={styles.modalLabel}>Salle :</Text> {selectedCours.salle}
                </Text>
                <Text style={styles.modalText}>
                  <Text style={styles.modalLabel}>Information :</Text> {selectedCours.remplacementInfo}
                </Text>
              </>
            )}
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.modalButtonText}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  planningGrid: {
    padding: 8,
  },
  headerRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  timeRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  timeCell: {
    width: 60,
    paddingVertical: 6,
    paddingHorizontal: 4,
    backgroundColor: '#1976D2',
    borderRadius: 8,
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayCell: {
    flex: 1,
    padding: 8,
    backgroundColor: '#1976D2',
    borderRadius: 8,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planningCell: {
    flex: 1,
    minHeight: 80,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    marginRight: 8,
    padding: 4,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  headerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  timeTextStart: {
    fontSize: 11,
    color: '#FFFFFF',
    textAlign: 'center',
    fontWeight: '600',
  },
  timeTextEnd: {
    fontSize: 11,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  timeSeparator: {
    height: 1,
    width: '80%',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginVertical: 3,
  },
  coursItem: {
    backgroundColor: 'transparent',
    borderRadius: 4,
    padding: 4,
    marginBottom: 2,
    overflow: 'hidden',
  },
  coursMatiere: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1976D2',
    overflow: 'hidden'
  },
  coursClasse: {
    fontSize: 11,
    color: '#666666',
    overflow: 'hidden'
  },
  coursSalle: {
    fontSize: 11,
    color: '#666666',
    fontStyle: 'italic',
    overflow: 'hidden'
  },
  loadingText: {
    fontSize: 16,
    color: '#666666',
    marginTop: 16,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#F44336',
    marginTop: 16,
    textAlign: 'center',
  },
  errorSubtext: {
    fontSize: 14,
    color: '#666666',
    marginTop: 8,
    textAlign: 'center',
  },
  weekNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  navigationButton: {
    padding: 8,
    backgroundColor: '#1976D2',
    borderRadius: 8,
    marginHorizontal: 4,
  },
  weekYearContainer: {
    flex: 1,
    backgroundColor: '#1976D2',
    padding: 8,
    borderRadius: 8,
    marginHorizontal: 8,
    alignItems: 'center',
  },
  weekYearText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  lastUpdateText: {
    fontSize: 12,
    color: '#FFFFFF',
    marginTop: 4,
  },
  connectionStatus: {
    fontSize: 12,
    color: '#FF9800',
    marginTop: 4,
  },
  coursAnnule: {
    borderLeftWidth: 3,
    borderLeftColor: '#FF9800',
  },
  coursAnnuleText: {
    color: '#FF9800',
    textDecorationLine: 'line-through',
  },
  coursRemplacement: {
    borderLeftWidth: 3,
    borderLeftColor: '#4CAF50',
  },
  coursRemplacementText: {
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  remplacementInfo: {
    fontSize: 10,
    color: '#4CAF50',
    fontStyle: 'italic',
    marginTop: 2,
    fontWeight: 'bold',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    width: '80%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1976D2',
    marginBottom: 15,
    textAlign: 'center',
  },
  modalText: {
    fontSize: 16,
    marginBottom: 10,
    color: '#333',
  },
  modalLabel: {
    fontWeight: 'bold',
    color: '#1976D2',
  },
  modalButton: {
    backgroundColor: '#1976D2',
    padding: 10,
    borderRadius: 5,
    marginTop: 15,
  },
  modalButtonText: {
    color: 'white',
    textAlign: 'center',
    fontSize: 16,
  },
});

export default TeacherPlanningScreen; 