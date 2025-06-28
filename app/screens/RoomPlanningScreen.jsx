import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, RefreshControl, Platform, TouchableOpacity, Modal } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { io } from 'socket.io-client';

const RoomPlanningScreen = ({ route }) => {
  console.log('🚀 RoomPlanningScreen - Paramètres reçus:', route.params);
  const { school, salle } = route.params;
  console.log('🚀 RoomPlanningScreen - school:', school?.apiUrl);
  console.log('🚀 RoomPlanningScreen - salle:', salle);
  
  // Extraire le nom de la salle (peut être un string ou un objet)
  const salleNom = typeof salle === 'string' ? salle : salle.nom;
  console.log('🚀 RoomPlanningScreen - salleNom:', salleNom);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [planning, setPlanning] = useState([]);
  const [currentWeek, setCurrentWeek] = useState(26); // Valeur par défaut
  const [currentYear, setCurrentYear] = useState(2025); // Valeur par défaut
  const [requestedWeek, setRequestedWeek] = useState(26); // Valeur par défaut
  const [requestedYear, setRequestedYear] = useState(2025); // Valeur par défaut
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
  const [annotations, setAnnotations] = useState({});

  const days = ['Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.'];

  // Fonction pour calculer le numéro de semaine (doit être définie avant les états)
  const getWeekNumber = (date) => {
    try {
      // Créer une copie de la date pour ne pas modifier l'original
      const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
      // Définir le jour de la semaine (0 = dimanche, 1 = lundi, etc.)
      d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
      // Obtenir le premier jour de l'année
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      // Calculer le numéro de semaine
      const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
      
      // S'assurer que le numéro de semaine est valide
      if (isNaN(weekNo) || weekNo < 1 || weekNo > 53) {
        return 1; // Retourner la première semaine par défaut
      }
      
      return weekNo;
    } catch (error) {
      return 1; // Retourner la première semaine en cas d'erreur
    }
  };

  // Fonction pour initialiser la semaine et l'année
  const initializeWeekAndYear = () => {
    const today = new Date();
    const initialWeek = getWeekNumber(today);
    const initialYear = today.getFullYear();
    
    console.log('🔄 Initialisation de la semaine et année:', {
      date: today.toISOString(),
      semaine: initialWeek,
      annee: initialYear
    });
    
    setCurrentWeek(initialWeek);
    setCurrentYear(initialYear);
    setRequestedWeek(initialWeek);
    setRequestedYear(initialYear);
  };

  useEffect(() => {
    console.log('🚀 Montage du composant RoomPlanningScreen');
    initializeWeekAndYear();
    console.log('📅 Chargement des créneaux horaires...');
    loadTimeSlots();
    console.log('🔌 Connexion WebSocket...');
    connectSocket();
    
    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, []);

  // Effet pour charger le planning quand la semaine ou l'année change
  useEffect(() => {
    console.log('📅 Changement de semaine/année détecté:', {
      requestedWeek,
      requestedYear,
      currentWeek,
      currentYear,
      planningType: typeof planning,
      planningLength: planning ? planning.length : 'undefined'
    });

    if (requestedWeek && requestedYear) {
      console.log('✅ Chargement du planning avec:', {
        semaine: requestedWeek,
        annee: requestedYear
      });
      
      // Charger via API REST directement pour les salles
      console.log('📡 Chargement via API REST pour la salle');
      loadPlanning();
      
      // Charger les annotations pour la semaine demandée
      loadAnnotations();
    } else {
      console.log('❌ Impossible de charger le planning - paramètres manquants:', {
        semaine: requestedWeek,
        annee: requestedYear
      });
    }
  }, [requestedWeek, requestedYear]);

  const connectSocket = () => {
    console.log('🔌 Début de connectSocket()');
    console.log('🔌 school.apiUrl:', school.apiUrl);
    console.log('🔌 salle:', salle);
    console.log('🔌 salleNom:', salleNom);
    
    const baseUrl = school.apiUrl.endsWith('/') ? school.apiUrl.slice(0, -1) : school.apiUrl;
    // Corriger l'URL WebSocket
    let socketUrl = baseUrl;
    if (baseUrl.startsWith('http://')) {
      socketUrl = baseUrl.replace('http://', 'ws://');
    } else if (baseUrl.startsWith('https://')) {
      socketUrl = baseUrl.replace('https://', 'wss://');
    }
    
    console.log('🔌 Tentative de connexion WebSocket à:', socketUrl);
    console.log('🔌 URL de base:', baseUrl);
    console.log('🔌 URL WebSocket finale:', socketUrl);
    
    try {
      const newSocket = io(socketUrl, {
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
      });

      console.log('🔌 Socket créé:', newSocket.id);

      newSocket.on('connect', () => {
        console.log('🔌 Connecté au serveur Socket.IO');
        console.log('🔌 Socket ID:', newSocket.id);
        console.log('🔌 Socket URL:', newSocket.io.uri);
        setWsConnected(true);
        setError(null);
        
        // Pour les salles, on ne s'abonne pas aux WebSocket car le serveur ne supporte que enseignantId/classeId
        console.log('📡 Pas d\'abonnement WebSocket pour les salles (non supporté par le serveur)');
      });

      // Log pour tous les événements reçus
      newSocket.onAny((eventName, ...args) => {
        console.log('📡 Événement WebSocket reçu:', eventName, args);
      });

      newSocket.on('planningUpdate', (data) => {
        console.log('🔄 Mise à jour du planning reçue via WebSocket:', {
          hasPlanning: Boolean(data.planning),
          hasCours: Boolean(data.cours),
          hasUhrs: Boolean(data.uhrs),
          planningLength: data.planning?.length,
          coursLength: data.cours?.length,
          uhrsLength: data.uhrs?.length,
          currentWeek: data.currentWeek,
          currentYear: data.currentYear,
          dataKeys: Object.keys(data),
          timestamp: new Date().toISOString()
        });
        
        setLastUpdate(new Date());
        setViewKey(prev => prev + 1);

        if (data.planning && Array.isArray(data.planning)) {
          console.log('📅 Planning reçu via WebSocket:', {
            nombreCours: data.planning.length,
            premierCours: data.planning[0],
            dernierCours: data.planning[data.planning.length - 1]
          });
          
          // Filtrer les cours pour cette salle
          const filteredPlanning = data.planning.filter(cours => 
            cours.salle && cours.salle.nom === salleNom &&
            !cours.annule // Exclure les cours annulés
          );
          
          console.log('📅 Planning filtré pour la salle:', {
            salleNom,
            nombreCoursTotal: data.planning.length,
            nombreCoursFiltre: filteredPlanning.length
          });
          
          setPlanning(filteredPlanning);
          setLoading(false);
          setError(null);
        } else if (data.cours && Array.isArray(data.cours)) {
          console.log('📅 Cours reçus via WebSocket:', {
            nombreCours: data.cours.length,
            premierCours: data.cours[0],
            dernierCours: data.cours[data.cours.length - 1]
          });
          
          // Filtrer les cours pour cette salle
          const filteredCours = data.cours.filter(cours => 
            cours.salle && cours.salle.nom === salleNom &&
            !cours.annule // Exclure les cours annulés
          );
          
          console.log('📅 Cours filtrés pour la salle:', {
            salleNom,
            nombreCoursTotal: data.cours.length,
            nombreCoursFiltre: filteredCours.length
          });
          
          setPlanning(filteredCours);
          setLoading(false);
          setError(null);
        }
      });

      newSocket.on('disconnect', (reason) => {
        console.log('🔌 Déconnecté du serveur Socket.IO:', reason);
        setWsConnected(false);
      });

      newSocket.on('connect_error', (error) => {
        console.error('🔌 Erreur de connexion WebSocket:', error);
        setWsConnected(false);
        setError('Erreur de connexion au serveur en temps réel');
      });

      setSocket(newSocket);
    } catch (error) {
      console.error('🔌 Erreur lors de la création du socket:', error);
      setError('Impossible de se connecter au serveur en temps réel');
    }
  };

  const loadTimeSlots = async () => {
    try {
      setLoadingTimeSlots(true);
      setTimeSlotsError(null);
      
      if (!school?.token) {
        throw new Error('Token d\'authentification manquant');
      }

      const baseUrl = school.apiUrl.endsWith('/') ? school.apiUrl.slice(0, -1) : school.apiUrl;
      const apiUrl = `${baseUrl}/api/mobile/uhrs`;
      
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
        if (response.status === 401) {
          throw new Error('Session expirée ou token invalide');
        }
        throw new Error(`Erreur ${response.status}: ${errorText || 'Erreur lors de la récupération des créneaux horaires'}`);
      }

      const data = await response.json();
      
      if (!Array.isArray(data)) {
        throw new Error('Format de données invalide pour les créneaux horaires');
      }

      // Convertir le format des créneaux horaires pour correspondre à ClassPlanningScreen
      const formattedTimeSlots = data.map(uhr => ({
        debut: uhr.start,
        fin: uhr.ende,
        nummer: uhr.nummer
      }));

      console.log('📅 Créneaux horaires chargés:', {
        nombreCreneaux: formattedTimeSlots.length,
        premierCreneau: formattedTimeSlots[0],
        dernierCreneau: formattedTimeSlots[formattedTimeSlots.length - 1]
      });

      setTimeSlots(formattedTimeSlots);
    } catch (err) {
      console.error('Erreur lors du chargement des créneaux horaires:', err);
      setTimeSlotsError(err.message || 'Erreur lors du chargement des créneaux horaires');
    } finally {
      setLoadingTimeSlots(false);
    }
  };

  const loadAnnotations = () => {
    // Charger les annotations pour la semaine demandée
    // Cette fonction peut être implémentée plus tard si nécessaire
    console.log('📝 Chargement des annotations pour la semaine:', requestedWeek);
  };

  const loadPlanning = async () => {
    try {
      setLoading(true);
      setError(null);
      
      if (!school?.token) {
        throw new Error('Token d\'authentification manquant. Veuillez vous reconnecter.');
      }

      if (!requestedWeek || !requestedYear) {
        throw new Error('Semaine ou année non définie');
      }

      const baseUrl = school.apiUrl.endsWith('/') ? school.apiUrl.slice(0, -1) : school.apiUrl;
      const apiUrl = `${baseUrl}/api/mobile/planning?semaine=${requestedWeek}&annee=${requestedYear}`;
      
      console.log('📡 Chargement du planning via API REST:', {
        url: apiUrl,
        semaine: requestedWeek,
        annee: requestedYear,
        salleNom
      });

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
        if (response.status === 401) {
          throw new Error('Session expirée ou token invalide. Veuillez vous reconnecter.');
        }
        throw new Error(`Erreur ${response.status}: ${errorText || 'Erreur lors de la récupération du planning'}`);
      }

      const data = await response.json();
      
      console.log('📡 Données reçues de l\'API:', {
        type: typeof data,
        isArray: Array.isArray(data),
        keys: data && typeof data === 'object' ? Object.keys(data) : 'N/A',
        length: Array.isArray(data) ? data.length : 'N/A',
        sample: Array.isArray(data) && data.length > 0 ? data[0] : 'Aucune donnée'
      });

      // Vérifier si data est un objet avec une propriété planning
      let planningData = data;
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        if (data.planning && Array.isArray(data.planning)) {
          planningData = data.planning;
          console.log('📡 Planning extrait de l\'objet data:', {
            nombreCours: planningData.length
          });
        } else if (data.cours && Array.isArray(data.cours)) {
          planningData = data.cours;
          console.log('📡 Cours extraits de l\'objet data:', {
            nombreCours: planningData.length
          });
        } else {
          console.log('⚠️ Format de données inattendu, tentative avec data directement');
          planningData = data;
        }
      }

      if (!Array.isArray(planningData)) {
        console.error('❌ Format de données invalide:', {
          type: typeof planningData,
          data: planningData
        });
        throw new Error('Format de données invalide pour le planning');
      }

      // Filtrer les cours pour cette salle
      const filteredPlanning = planningData.filter(cours => {
        const coursSalle = cours.salle?.nom || cours.salle;
        const match = coursSalle === salleNom && !cours.annule; // Exclure les cours annulés
        if (match) {
          console.log('✅ Cours trouvé pour la salle:', {
            salle: coursSalle,
            matiere: cours.matiere?.nom || cours.matiere,
            jour: cours.jour,
            heure: cours.heure
          });
        }
        return match;
      });

      console.log('📅 Planning chargé via API REST:', {
        nombreCoursTotal: planningData.length,
        nombreCoursFiltre: filteredPlanning.length,
        salleNom,
        semaine: requestedWeek,
        annee: requestedYear,
        premierCours: filteredPlanning.length > 0 ? filteredPlanning[0] : 'Aucun cours'
      });

      setPlanning(filteredPlanning);
    } catch (err) {
      console.error('Erreur détaillée lors du chargement du planning:', err);
      setError(err.message || 'Une erreur est survenue lors de la récupération du planning');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
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
    
    // Extraire le tableau de cours de l'objet planning
    let coursArray = [];
    if (Array.isArray(planning)) {
      coursArray = planning;
    } else if (planning && planning.cours && Array.isArray(planning.cours)) {
      coursArray = planning.cours;
    } else {
      return [];
    }
    
    return coursArray.filter(cours => 
      cours.jour === jourComplet && 
      cours.heure === hour &&
      !cours.annule // Exclure les cours annulés
    );
  };

  const formatHours = (timeRange) => {
    const [start, end] = timeRange.split(' - ');
    return {
      start: start,
      end: end
    };
  };

  const renderTimeCell = (timeSlot) => {
    return (
      <View style={[styles.timeCell, { width: 45 }]}>
        <Text style={styles.timeTextStart}>
          {timeSlot.debut}
        </Text>
        <View style={styles.timeSeparator} />
        <Text style={styles.timeTextEnd}>
          {timeSlot.fin}
        </Text>
      </View>
    );
  };

  const abrevierMatiere = (matiere) => {
    if (!matiere) return '';
    return matiere.length > 8 ? matiere.substring(0, 8) + '...' : matiere;
  };

  const renderCours = (cours) => {
    if (!cours || cours.length === 0) return null;

    const coursItem = cours[0]; // Prendre le premier cours s'il y en a plusieurs
    
    return (
      <TouchableOpacity
        style={[
          styles.coursItem,
          coursItem.annule && styles.coursAnnule,
          coursItem.remplace && styles.coursRemplacement
        ]}
        onPress={() => {
          setSelectedCours(coursItem);
          setModalVisible(true);
        }}
      >
        {/* Icône de commentaire positionnée en haut à droite */}
        {coursItem.commentaire && coursItem.commentaire.trim() !== '' && (
          <MaterialIcons 
            name="comment" 
            size={12} 
            color="#666666" 
            style={styles.commentIcon}
          />
        )}
        
        <View style={styles.coursHeader}>
          <Text style={[
            styles.coursMatiere,
            coursItem.annule && styles.coursAnnuleText,
            coursItem.remplace && styles.coursRemplacementText
          ]}>
            {abrevierMatiere(coursItem.matiere)}
          </Text>
        </View>
        <Text style={styles.coursClasse}>
          {coursItem.enseignants && coursItem.enseignants.length > 0 
            ? coursItem.enseignants.map(e => e.nom).join(', ')
            : 'Enseignant non défini'
          }
        </Text>
        <Text style={styles.coursSalle}>
          {coursItem.classe || 'Classe non définie'}
        </Text>
        {coursItem.remplace && coursItem.remplacementInfo && (
          <Text style={styles.remplacementInfo}>
            {coursItem.remplacementInfo}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  const renderAnnotations = () => {
    // Filtrer les annotations qui ont du contenu
    const annotationsAvecContenu = Object.entries(annotations)
      .filter(([jour, annotation]) => annotation && annotation.trim() !== '')
      .map(([jour, annotation]) => ({ jour, annotation }));
    
    if (annotationsAvecContenu.length === 0) return null;

    return (
      <View style={styles.annotationsContainer}>
        <Text style={styles.annotationsTitle}>Annotations de la semaine</Text>
        {annotationsAvecContenu.map((item, index) => (
          <View key={index} style={styles.annotationItem}>
            <Text style={styles.annotationJour}>{item.jour}</Text>
            <Text style={styles.annotationText}>{item.annotation}</Text>
          </View>
        ))}
      </View>
    );
  };

  const renderPlanningCell = (day, timeSlot) => {
    const cours = getCoursByDayAndHour(day, `${timeSlot.debut} - ${timeSlot.fin}`);

    return (
      <View style={styles.planningCell}>
        {renderCours(cours)}
      </View>
    );
  };

  const goToPreviousWeek = () => {
    // Utiliser des valeurs par défaut si requestedWeek/requestedYear sont null
    const currentWeekValue = requestedWeek || currentWeek || 25;
    const currentYearValue = requestedYear || currentYear || 2025;
    
    let newWeek = currentWeekValue - 1;
    let newYear = currentYearValue;

    if (newWeek < 1) {
      newWeek = 52;
      newYear = currentYearValue - 1;
    }

    setRequestedWeek(newWeek);
    setRequestedYear(newYear);
    setCurrentWeek(newWeek);
    setCurrentYear(newYear);
  };

  const goToNextWeek = () => {
    // Utiliser des valeurs par défaut si requestedWeek/requestedYear sont null
    const currentWeekValue = requestedWeek || currentWeek || 25;
    const currentYearValue = requestedYear || currentYear || 2025;
    
    let newWeek = currentWeekValue + 1;
    let newYear = currentYearValue;

    if (newWeek > 52) {
      newWeek = 1;
      newYear = currentYearValue + 1;
    }

    setRequestedWeek(newWeek);
    setRequestedYear(newYear);
    setCurrentWeek(newWeek);
    setCurrentYear(newYear);
  };

  // Initialiser le weekOffset à 0 au chargement
  useEffect(() => {
    setWeekOffset(0);
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

          <View style={styles.headerRow}>
            <View style={[styles.timeCell, { width: 45 }]}>
              <Text style={styles.headerText}></Text>
            </View>
            {days.map((day, index) => (
              <View 
                key={index} 
                style={[
                  styles.dayCell,
                  index === days.length - 1 && styles.dayCellLast
                ]}
              >
                <Text style={styles.headerText}>{day}</Text>
              </View>
            ))}
          </View>

          {/* Grille des cours */}
          {timeSlots && timeSlots.length > 0 ? (
            timeSlots.map((timeSlot, hourIndex) => (
              <View key={hourIndex} style={styles.timeRow}>
                {renderTimeCell(timeSlot)}
                {days.map((day, dayIndex) => (
                  <View 
                    key={dayIndex} 
                    style={[
                      styles.planningCell,
                      dayIndex === days.length - 1 && styles.planningCellLast
                    ]}
                  >
                    {renderPlanningCell(day, timeSlot)}
                  </View>
                ))}
              </View>
            ))
          ) : (
            <View style={styles.centerContainer}>
              <Text style={styles.errorText}>
                Aucun créneau horaire disponible
              </Text>
              <Text style={styles.errorSubtext}>
                Créneaux chargés: {timeSlots ? timeSlots.length : 'null'}
              </Text>
            </View>
          )}
        </View>
        
        {/* Section des annotations */}
        {renderAnnotations()}
        
        {/* Espace en bas pour éviter que le contenu soit caché par les boutons du smartphone */}
        <View style={styles.bottomSpacing} />
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
            <Text style={styles.modalTitle}>
              {selectedCours?.remplace ? 'Détails du remplacement' : 
               selectedCours?.annule ? 'Cours annulé' : 'Détails du cours'}
            </Text>
            {selectedCours && (
              <>
                <Text style={styles.modalText}>
                  <Text style={styles.modalLabel}>Matière :</Text> {selectedCours.matiere}
                </Text>
                <Text style={styles.modalText}>
                  <Text style={styles.modalLabel}>Enseignant :</Text> {selectedCours.enseignants && selectedCours.enseignants.length > 0 
                    ? selectedCours.enseignants.map(e => e.nom).join(', ')
                    : 'Non défini'
                  }
                </Text>
                <Text style={styles.modalText}>
                  <Text style={styles.modalLabel}>Classe :</Text> {selectedCours.classe || 'Non définie'}
                </Text>
                <Text style={styles.modalText}>
                  <Text style={styles.modalLabel}>Salle :</Text> {selectedCours.salle || 'Non définie'}
                </Text>
                <Text style={styles.modalText}>
                  <Text style={styles.modalLabel}>Jour :</Text> {selectedCours.jour}
                </Text>
                <Text style={styles.modalText}>
                  <Text style={styles.modalLabel}>Heure :</Text> {selectedCours.heure}
                </Text>
                {selectedCours.commentaire && selectedCours.commentaire.trim() !== '' && (
                  <Text style={styles.modalText}>
                    <Text style={styles.modalLabel}>Commentaire :</Text> {selectedCours.commentaire}
                  </Text>
                )}
                {selectedCours.remplace && selectedCours.remplacementInfo && (
                  <Text style={styles.modalText}>
                    <Text style={styles.modalLabel}>Information de remplacement :</Text> {selectedCours.remplacementInfo}
                  </Text>
                )}
                {selectedCours.annule && (
                  <Text style={[styles.modalText, { color: '#FF9800', fontStyle: 'italic' }]}>
                    ⚠️ Ce cours a été annulé
                  </Text>
                )}
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
    padding: 6,
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
    width: 45,
    paddingVertical: 4,
    paddingHorizontal: 2,
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
    padding: 0,
  },
  headerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  timeTextStart: {
    fontSize: 10,
    color: '#FFFFFF',
    textAlign: 'center',
    fontWeight: '600',
  },
  timeTextEnd: {
    fontSize: 10,
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
    padding: 0,
    marginBottom: 2,
    overflow: 'visible',
  },
  coursHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  coursMatiere: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1976D2',
    overflow: 'hidden',
    flex: 1
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
  commentIcon: {
    position: 'absolute',
    top: 0,
    right: -5,
    zIndex: 1,
  },
  annotationsContainer: {
    padding: 10,
  },
  annotationsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1976D2',
    marginBottom: 10,
    textAlign: 'center',
  },
  annotationItem: {
    marginBottom: 10,
  },
  annotationJour: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1976D2',
    marginBottom: 5,
  },
  annotationText: {
    fontSize: 16,
    color: '#333',
  },
  bottomSpacing: {
    height: 100,
  },
  planningCellLast: {
    marginRight: 0,
  },
  dayCellLast: {
    marginRight: 0,
  },
});

export default RoomPlanningScreen; 