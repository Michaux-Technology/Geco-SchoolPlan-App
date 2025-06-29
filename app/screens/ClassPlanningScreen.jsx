import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, RefreshControl, Platform, TouchableOpacity, Modal } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { io } from 'socket.io-client'; 

const ClassPlanningScreen = ({ route }) => {
  console.log('🚀 ClassPlanningScreen - Paramètres reçus:', route.params);
  const { school, classe } = route.params;
  console.log('🚀 ClassPlanningScreen - school:', school?.apiUrl);
  console.log('🚀 ClassPlanningScreen - classe:', classe);
  
  // Extraire le nom de la classe (peut être un string ou un objet)
  const classeNom = typeof classe === 'string' ? classe : classe.nom;
  console.log('🚀 ClassPlanningScreen - classeNom:', classeNom);
  
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
  const [annotations, setAnnotations] = useState({});

  const days = ['Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.'];

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

    // Vérifier après le setState
    setTimeout(() => {
      console.log('🔍 Vérification des valeurs après initialisation:', {
        currentWeek,
        currentYear,
        requestedWeek,
        requestedYear
      });
    }, 100);
  };

  useEffect(() => {
    console.log('🚀 Montage du composant TeacherPlanningScreen');
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
      
      // Ne charger via API REST que si on n'a pas de données WebSocket
      if (!planning || planning.length === 0) {
        console.log('📡 Aucune donnée WebSocket disponible, chargement via API REST');
        loadPlanning();
      } else {
        console.log('📡 Données WebSocket disponibles, filtrage des données existantes');
        // Vérifier que planning est un tableau avant de le filtrer
        if (Array.isArray(planning)) {
          const filteredPlanning = planning.filter(cours => 
            cours.semaine === requestedWeek && 
            cours.annee === requestedYear
          );
          console.log('📅 Planning filtré depuis les données WebSocket:', {
            semaineDemandee: requestedWeek,
            anneeDemandee: requestedYear,
            nombreCours: filteredPlanning.length
          });
          setPlanning(filteredPlanning);
        } else {
          console.log('⚠️ Planning n\'est pas un tableau, chargement via API REST');
          loadPlanning();
        }
      }
      
      // Charger les annotations pour la semaine demandée
      loadAnnotations();
    } else {
      console.log('❌ Impossible de charger le planning - paramètres manquants:', {
        semaine: requestedWeek,
        annee: requestedYear
      });
    }
  }, [requestedWeek, requestedYear]);

  // Suppression de l'effet de filtrage automatique pour éviter les conflits avec WebSocket

  const connectSocket = () => {
    console.log('🔌 Début de connectSocket()');
    console.log('🔌 school.apiUrl:', school.apiUrl);
    console.log('🔌 classe:', classe);
    console.log('🔌 classeNom:', classeNom);
    
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
        
        // S'abonner aux mises à jour du planning pour cette classe
        console.log('📡 Envoi de l\'abonnement pour la classe:', classeNom);
        newSocket.emit('subscribe', {
          classeId: classeNom
        });
        console.log('✅ Abonnement envoyé');
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
        
        // Mettre à jour les données de planning
        if (data.cours && Array.isArray(data.cours)) {
          console.log('📚 Cours reçus via WebSocket:', data.cours.length);
          
          // Filtrer les cours pour la classe actuelle
          const filteredCours = data.cours.filter(cours => cours.classe === classeNom);
          console.log('📅 Cours filtrés pour la classe:', {
            classe: classeNom,
            nombreCours: filteredCours.length
          });
          
          setPlanning(filteredCours);
        } else if (data.planning && Array.isArray(data.planning)) {
          console.log('📚 Planning reçu via WebSocket:', data.planning.length);
          
          // Filtrer le planning pour la classe actuelle
          const filteredPlanning = data.planning.filter(cours => cours.classe === classeNom);
          console.log('📅 Planning filtré pour la classe:', {
            classe: classeNom,
            nombreCours: filteredPlanning.length
          });
          
          setPlanning(filteredPlanning);
        }

        // Mettre à jour les créneaux horaires
        if (data.uhrs && Array.isArray(data.uhrs)) {
          const formattedTimeSlots = data.uhrs.map(slot => ({
            _id: slot._id,
            debut: slot.start,
            fin: slot.ende
          }));
          console.log('⏰ Créneaux horaires mis à jour via WebSocket:', formattedTimeSlots.length);
          setTimeSlots(formattedTimeSlots);
        } else if (data.zeitslots) {
          const formattedTimeSlots = data.zeitslots.map(slot => ({
            _id: slot._id,
            debut: slot.start,
            fin: slot.ende
          }));
          console.log('⏰ Créneaux horaires mis à jour (zeitslots):', formattedTimeSlots.length);
          setTimeSlots(formattedTimeSlots);
        } else if (data.planning && data.planning.uhrs) {
          const formattedTimeSlots = data.planning.uhrs.map(slot => ({
            _id: slot._id,
            debut: slot.start,
            fin: slot.ende
          }));
          console.log('⏰ Créneaux horaires mis à jour (planning.uhrs):', formattedTimeSlots.length);
          setTimeSlots(formattedTimeSlots);
        } else {
          console.log('⚠️ Aucun créneau horaire trouvé dans les données WebSocket:', {
            hasZeitslots: Boolean(data.zeitslots),
            hasUhrs: Boolean(data.uhrs),
            hasPlanningUhrs: Boolean(data.planning?.uhrs),
            dataKeys: Object.keys(data)
          });
        }

        // Forcer un remontage du composant
        setViewKey(prev => prev + 1);
        console.log('🔄 Composant remonté pour afficher les nouvelles données');
      });

      newSocket.on('coursUpdate', (data) => {
        console.log('🔄 Mise à jour des cours reçue via WebSocket (coursUpdate):', {
          dataLength: data.length,
          timestamp: new Date().toISOString()
        });
        
        setLastUpdate(new Date());
        
        // Traiter les données comme si c'était un planningUpdate
        if (Array.isArray(data)) {
          console.log('📚 Cours reçus via coursUpdate:', data.length);
          
          // Filtrer les cours pour la classe actuelle
          const filteredCours = data.filter(cours => cours.classe === classeNom);
          console.log('📅 Cours filtrés pour la classe (coursUpdate):', {
            classe: classeNom,
            nombreCours: filteredCours.length,
            totalCoursRecus: data.length
          });
          
          // Déterminer la semaine à utiliser pour le filtrage
          // Priorité : requestedWeek/requestedYear > currentWeek/currentYear > semaine actuelle par défaut
          let weekToUse = requestedWeek || currentWeek;
          let yearToUse = requestedYear || currentYear;
          
          // Si aucune semaine n'est définie, utiliser la semaine actuelle
          if (!weekToUse || !yearToUse) {
            const today = new Date();
            weekToUse = getWeekNumber(today);
            yearToUse = today.getFullYear();
            console.log('📅 Utilisation de la semaine actuelle par défaut:', { weekToUse, yearToUse });
          }
          
          // Filtrer les cours pour la semaine demandée
          const filteredPlanning = filteredCours.filter(cours => 
            cours.semaine === weekToUse && 
            cours.annee === yearToUse
          );
          console.log('📅 Planning filtré (coursUpdate):', {
            classe: classeNom,
            semaineDemandee: weekToUse,
            anneeDemandee: yearToUse,
            nombreCours: filteredPlanning.length,
            totalCoursFiltres: filteredCours.length
          });
          
          setPlanning(filteredPlanning);
          
          // Mettre à jour les variables de semaine si elles n'étaient pas définies
          if (!requestedWeek || !requestedYear) {
            setRequestedWeek(weekToUse);
            setRequestedYear(yearToUse);
            setCurrentWeek(weekToUse);
            setCurrentYear(yearToUse);
          }
        }
        
        // Forcer un remontage du composant
        setViewKey(prev => prev + 1);
        console.log('🔄 Composant remonté pour afficher les nouvelles données (coursUpdate)');
      });

      newSocket.on('connect_error', (error) => {
        console.error('❌ Erreur de connexion Socket.IO:', error);
        console.error('❌ Détails de l\'erreur:', {
          message: error.message,
          description: error.description,
          context: error.context,
          type: error.type
        });
        setError('Erreur de connexion en temps réel');
        setWsConnected(false);
      });

      newSocket.on('disconnect', (reason) => {
        console.log('🔌 Déconnecté du serveur Socket.IO:', reason);
        console.log('🔌 Raison de la déconnexion:', reason);
        setWsConnected(false);
      });

      newSocket.on('error', (error) => {
        console.error('❌ Erreur Socket.IO:', error);
        setError('Erreur de connexion en temps réel');
      });

      // Gestionnaires pour les annotations
      newSocket.on('annotationsUpdate', (annotationsMap) => {
        console.log('📝 Annotations mises à jour via WebSocket:', annotationsMap);
        setAnnotations(annotationsMap);
      });

      newSocket.on('annotationError', (error) => {
        console.error('❌ Erreur d\'annotation:', error);
      });

      setSocket(newSocket);
      console.log('🔌 Socket stocké dans l\'état');
    } catch (error) {
      console.error('❌ Erreur lors de la création du socket:', error);
      setError('Erreur lors de la création de la connexion WebSocket');
    }
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
      
      if (Array.isArray(data) && data.length > 0) {
        // Formater les créneaux horaires pour qu'ils aient la même structure
        const formattedTimeSlots = data.map(slot => ({
          _id: slot._id,
          debut: slot.start,
          fin: slot.ende
        }));
        setTimeSlots(formattedTimeSlots);
      } else {
        throw new Error('Aucun horaire disponible');
      }
    } catch (err) {
      setTimeSlotsError(err.message);
    } finally {
      setLoadingTimeSlots(false);
    }
  };

  const loadAnnotations = () => {
    if (socket && (requestedWeek || currentWeek) && (requestedYear || currentYear)) {
      const semaine = requestedWeek || currentWeek;
      const annee = requestedYear || currentYear;
      
      console.log('📝 Demande des annotations pour la semaine', semaine, 'et l\'année', annee);
      socket.emit('getAnnotations', { semaine, annee });
    }
  };

  const loadPlanning = async () => {
    try {
      setError(null);

      if (!school?.token) {
        throw new Error('Token d\'authentification manquant');
      }

      // Vérifier que les paramètres sont définis
      if (!requestedWeek || !requestedYear) {
        return;
      }

      const baseUrl = school.apiUrl.endsWith('/') ? school.apiUrl.slice(0, -1) : school.apiUrl;
      const apiUrl = `${baseUrl}/api/mobile/planning/classe/${classeNom}?semaine=${requestedWeek}&annee=${requestedYear}`;

      console.log('📡 Chargement du planning pour la classe:', {
        classe: classeNom,
        apiUrl: apiUrl,
        semaine: requestedWeek,
        annee: requestedYear
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
        throw new Error(`Erreur ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      
      console.log('📚 Données reçues du serveur:', {
        nombreCours: data.cours?.length || 0,
        nombreUhrs: data.uhrs?.length || 0,
        cours: data.cours,
        uhrs: data.uhrs
      });
      
      if (data.cours && data.cours.length > 0) {
        const firstEntry = data.cours[0];
        
        // Si le serveur renvoie toujours la semaine 18, on garde la semaine demandée
        if (firstEntry.semaine === 18) {
          setCurrentWeek(requestedWeek);
          setCurrentYear(requestedYear);
        } else {
          setCurrentWeek(firstEntry.semaine);
          setCurrentYear(firstEntry.annee);
        }
      }
      
      setPlanning(data.cours || []);
      
      // Mettre à jour les créneaux horaires si disponibles
      if (data.uhrs && Array.isArray(data.uhrs)) {
        const formattedTimeSlots = data.uhrs.map(slot => ({
          _id: slot._id,
          debut: slot.start,
          fin: slot.ende
        }));
        setTimeSlots(formattedTimeSlots);
      }
      
    } catch (err) {
      setError(err.message || 'Erreur lors du chargement du planning');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

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
      cours.heure === hour
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
        <View style={styles.coursHeader}>
          <Text 
            style={[
              styles.coursMatiere,
              coursItem.annule && styles.coursAnnuleText,
              coursItem.remplace && styles.coursRemplacementText
            ]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {abrevierMatiere(coursItem.matiere)}
          </Text>
        </View>
        <Text style={styles.coursClasse}>
          {coursItem.enseignants && coursItem.enseignants.length > 0 
            ? coursItem.enseignants.map(e => e.nom).join(', ')
            : 'Enseignant non défini'
          }
        </Text>
        <View style={styles.classeContainer}>
          <Text style={styles.coursSalle}>
            {coursItem.salle || 'Salle non définie'}
          </Text>
          {coursItem.commentaire && coursItem.commentaire.trim() !== '' && (
            <MaterialIcons 
              name="comment" 
              size={12} 
              color="#666666" 
              style={styles.commentIconInline}
            />
          )}
        </View>
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
  dayCellLast: {
    marginRight: 0,
  },
  planningCell: {
    flex: 1,
    minHeight: 80,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    marginRight: 8,
    padding: 0,
  },
  planningCellLast: {
    marginRight: 0,
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
    numberOfLines: 1,
    ellipsizeMode: 'tail',
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
  commentIconAbsolute: {
    position: 'absolute',
    top: 0,
    right: 0,
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
  classeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  commentIconInline: {
    marginLeft: 5,
  },
});

export default ClassPlanningScreen; 