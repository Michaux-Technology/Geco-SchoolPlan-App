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
  const [surveillances, setSurveillances] = useState([]);
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
      
      // Charger les surveillances pour la semaine demandée
      loadSurveillances();
      
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
    console.log('🔌 teacher._id:', teacher._id);
    
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
        
        // S'abonner aux mises à jour du planning
        console.log('📡 Envoi de l\'abonnement pour l\'enseignant:', teacher._id);
        newSocket.emit('subscribe', {
          enseignantId: teacher._id
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
          hasSurveillances: Boolean(data.surveillances),
          hasUhrs: Boolean(data.uhrs),
          planningLength: data.planning?.length,
          coursLength: data.cours?.length,
          surveillancesLength: data.surveillances?.length,
          uhrsLength: data.uhrs?.length,
          currentWeek: data.currentWeek,
          currentYear: data.currentYear,
          dataKeys: Object.keys(data),
          timestamp: new Date().toISOString()
        });
        
        setLastUpdate(new Date());
        
        // Mettre à jour les données de planning
        if (data.cours && Array.isArray(data.cours)) {
          // Données reçues au format {cours: [...], surveillances: [...], uhrs: [...]}
          console.log('📚 Cours reçus via WebSocket:', data.cours.length);
          
          // Si le backend a envoyé la semaine/année, les utiliser
          const weekToUse = data.currentWeek || requestedWeek || currentWeek;
          const yearToUse = data.currentYear || requestedYear || currentYear;
          
          console.log('📅 Utilisation des paramètres:', {
            weekToUse,
            yearToUse,
            dataCurrentWeek: data.currentWeek,
            dataCurrentYear: data.currentYear,
            requestedWeek,
            requestedYear,
            currentWeek,
            currentYear
          });
          
          if (weekToUse && yearToUse) {
            // Filtrer les cours pour la semaine demandée
            const filteredPlanning = data.cours.filter(cours => 
              cours.semaine === weekToUse && 
              cours.annee === yearToUse
            );
            console.log('📅 Planning filtré pour la semaine:', {
              semaineDemandee: weekToUse,
              anneeDemandee: yearToUse,
              nombreCours: filteredPlanning.length,
              totalCoursRecus: data.cours.length
            });
            setPlanning(filteredPlanning);
          } else {
            // Si aucune semaine n'est définie, stocker tous les cours
            console.log('📅 Aucune semaine définie, stockage de tous les cours:', data.cours.length);
            setPlanning(data.cours);
          }
        } else if (data.planning) {
          // Ancien format pour compatibilité
          console.log('📚 Planning reçu au format legacy:', data.planning.length);
          
          // Extraire le tableau de cours selon la structure reçue
          let coursArray = [];
          if (Array.isArray(data.planning)) {
            coursArray = data.planning;
          } else if (data.planning.cours && Array.isArray(data.planning.cours)) {
            coursArray = data.planning.cours;
          }
          
          if (coursArray.length > 0) {
            // Si requestedWeek et requestedYear ne sont pas encore initialisés,
            // utiliser la semaine actuelle par défaut
            const weekToUse = requestedWeek || currentWeek;
            const yearToUse = requestedYear || currentYear;
            
            if (weekToUse && yearToUse) {
              // Filtrer les cours pour la semaine demandée
              const filteredPlanning = coursArray.filter(cours => 
                cours.semaine === weekToUse && 
                cours.annee === yearToUse
              );
              console.log('📅 Planning filtré (legacy):', {
                semaineDemandee: weekToUse,
                anneeDemandee: yearToUse,
                nombreCours: filteredPlanning.length
              });
              setPlanning(filteredPlanning);
            } else {
              // Si aucune semaine n'est définie, stocker tous les cours
              console.log('📅 Aucune semaine définie (legacy), stockage de tous les cours:', coursArray.length);
              setPlanning(coursArray);
            }
          }
        }
        
        // Mettre à jour les surveillances
        if (data.surveillances && Array.isArray(data.surveillances)) {
          console.log('👁️ Surveillances reçues via WebSocket:', data.surveillances.length);
          setSurveillances(data.surveillances);
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
          
          // Si requestedWeek et requestedYear ne sont pas encore initialisés,
          // utiliser la semaine actuelle par défaut
          const weekToUse = requestedWeek || currentWeek;
          const yearToUse = requestedYear || currentYear;
          
          if (weekToUse && yearToUse) {
            // Filtrer les cours pour la semaine demandée
            const filteredPlanning = data.filter(cours => 
              cours.semaine === weekToUse && 
              cours.annee === yearToUse
            );
            console.log('📅 Planning filtré (coursUpdate):', {
              semaineDemandee: weekToUse,
              anneeDemandee: yearToUse,
              nombreCours: filteredPlanning.length,
              totalCoursRecus: data.length
            });
            setPlanning(filteredPlanning);
          } else {
            // Si aucune semaine n'est définie, stocker tous les cours
            console.log('📅 Aucune semaine définie (coursUpdate), stockage de tous les cours:', data.length);
            setPlanning(data);
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

  const loadSurveillances = async () => {
    try {
      console.log('🔍 Début de loadSurveillances');
      console.log('🔍 Token:', school?.token ? 'présent' : 'manquant');
      console.log('🔍 Paramètres:', { requestedWeek, requestedYear, teacherId: teacher._id });

      if (!school?.token) {
        throw new Error('Token d\'authentification manquant');
      }

      // Vérifier que les paramètres sont définis
      if (!requestedWeek || !requestedYear) {
        console.log('❌ Paramètres manquants pour loadSurveillances');
        return;
      }

      const baseUrl = school.apiUrl.endsWith('/') ? school.apiUrl.slice(0, -1) : school.apiUrl;
      // Utiliser l'ID de l'enseignant
      const apiUrl = `${baseUrl}/api/mobile/surveillances/enseignant/${teacher._id}?semaine=${requestedWeek}&annee=${requestedYear}`;
      
      console.log('🔍 URL de l\'API surveillances:', apiUrl);

      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${school.token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });

      console.log('🔍 Réponse du serveur surveillances:', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries())
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Erreur serveur surveillances:', errorText);
        throw new Error(`Erreur ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log('🔍 Données surveillances reçues:', {
        nombreSurveillances: data.length,
        surveillances: data
      });
      
      // Filtrer les surveillances pour la semaine demandée
      const filteredSurveillances = data.filter(surveillance => 
        surveillance.semaine === requestedWeek && 
        surveillance.annee === requestedYear
      );
      
      console.log('🔍 Surveillances filtrées:', {
        nombreSurveillancesFiltrees: filteredSurveillances.length,
        surveillancesFiltrees: filteredSurveillances
      });
      
      setSurveillances(filteredSurveillances);
    } catch (err) {
      console.error('❌ Erreur dans loadSurveillances:', err);
      // On ne met pas d'erreur dans l'état pour ne pas bloquer l'affichage du planning
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
      const apiUrl = `${baseUrl}/api/mobile/cours/enseignant/${teacher._id}?semaine=${requestedWeek}&annee=${requestedYear}`;

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
      
      if (data.length > 0) {
        const firstEntry = data[0];
        
        // Si le serveur renvoie toujours la semaine 18, on garde la semaine demandée
        if (firstEntry.semaine === 18) {
          setCurrentWeek(requestedWeek);
          setCurrentYear(requestedYear);
        } else {
          setCurrentWeek(firstEntry.semaine);
          setCurrentYear(firstEntry.annee);
        }
      }
      
      setPlanning(data);
      
      // Charger les surveillances après le planning
      await loadSurveillances();
      
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
    loadSurveillances();
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

  const getSurveillancesByDayAndHour = (day, hour) => {
    // Convertir le jour abrégé en jour complet
    const joursComplets = {
      'Lun.': 'Lundi',
      'Mar.': 'Mardi',
      'Mer.': 'Mercredi',
      'Jeu.': 'Jeudi',
      'Ven.': 'Vendredi'
    };
    
    const jourComplet = joursComplets[day];
    
    console.log('🔍 getSurveillancesByDayAndHour:', {
      day,
      jourComplet,
      hour,
      surveillancesLength: Array.isArray(surveillances) ? surveillances.length : 'non-array',
      teacherId: teacher._id
    });
    
    // Vérifier que surveillances est un tableau avant d'utiliser filter
    if (!Array.isArray(surveillances)) {
      console.log('❌ surveillances n\'est pas un tableau');
      return [];
    }
    
    // Ne récupérer que les surveillances de type 'normal' (pas 'entre_creneaux') pour cet enseignant
    const result = surveillances.filter(surveillance => {
      const matchJour = surveillance.jour === jourComplet;
      const matchType = surveillance.type === 'normal';
      const matchEnseignant = surveillance.enseignant === teacher._id || 
                              surveillance.enseignant === teacher._id.toString() ||
                              (surveillance.enseignant && surveillance.enseignant._id === teacher._id);
      
      // Vérifier que uhr existe et a les bonnes propriétés
      let matchHeure = false;
      if (surveillance.uhr && surveillance.uhr.start && surveillance.uhr.ende) {
        const surveillanceHeure = `${surveillance.uhr.start} - ${surveillance.uhr.ende}`;
        matchHeure = surveillanceHeure === hour;
      }
      
      console.log('🔍 Filtrage surveillance:', {
        surveillanceId: surveillance._id,
        surveillanceJour: surveillance.jour,
        surveillanceType: surveillance.type,
        surveillanceEnseignant: surveillance.enseignant,
        surveillanceUhr: surveillance.uhr,
        surveillanceHeure: surveillance.uhr ? `${surveillance.uhr.start} - ${surveillance.uhr.ende}` : 'pas d\'heure',
        matchJour,
        matchType,
        matchEnseignant,
        matchHeure,
        match: matchJour && matchType && matchEnseignant && matchHeure
      });
      
      return matchJour && matchType && matchEnseignant && matchHeure;
    });
    
    console.log('🔍 Résultat getSurveillancesByDayAndHour:', {
      nombreResultats: result.length,
      resultats: result
    });
    
    return result;
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
          setSelectedCours(item);
          setModalVisible(true);
        }}
      >
        <View style={styles.coursHeader}>
          <Text style={[
            styles.coursMatiere,
            item.annule && styles.coursAnnuleText,
            item.remplace && styles.coursRemplacementText
          ]} numberOfLines={1}>
            {abrevierMatiere(item.matiere)}
            {item.annule && ' (Annulé)'}
            {item.remplace && ' (Remplacé)'}
          </Text>
          {item.commentaire && item.commentaire.trim() !== '' && (
            <Text style={[styles.commentIcon, { color: '#1976D2', fontSize: 10 }]}>
              ⚠️
            </Text>
          )}
        </View>
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

  const renderSurveillance = (surveillances) => {
    if (!surveillances || surveillances.length === 0) return null;

    return (
      <View style={styles.surveillanceItem}>
        <Text style={styles.surveillanceText}>
          Surveillance
        </Text>
      </View>
    );
  };

  // Nouvelle fonction pour obtenir les surveillances entre créneaux pour un jour donné
  const getSurveillancesEntreCreneaux = (day, timeSlotIndex) => {
    // Convertir le jour abrégé en jour complet
    const joursComplets = {
      'Lun.': 'Lundi',
      'Mar.': 'Mardi',
      'Mer.': 'Mercredi',
      'Jeu.': 'Jeudi',
      'Ven.': 'Vendredi'
    };
    
    const jourComplet = joursComplets[day];
    
    // Vérifier que surveillances est un tableau avant d'utiliser filter
    if (!Array.isArray(surveillances)) {
      return [];
    }
    
    // Filtrer les surveillances pour ce jour, ce type et cet enseignant
    const surveillancesDuJour = surveillances.filter(surveillance => 
      surveillance.jour === jourComplet && 
      surveillance.type === 'entre_creneaux' &&
      (surveillance.enseignant === teacher._id || 
       surveillance.enseignant === teacher._id.toString() ||
       (surveillance.enseignant && surveillance.enseignant._id === teacher._id))
    );
    
    // Utiliser le champ position pour déterminer où afficher la surveillance
    // position = -1 : avant la première heure
    // position = 0, 1, 2, etc. : entre les créneaux correspondants
    // position = timeSlots.length - 1 : après la dernière heure
    const result = surveillancesDuJour.filter(surveillance => {
      const position = surveillance.position || 0;
      return position === timeSlotIndex;
    });
    
    return result;
  };

  // Nouvelle fonction pour rendre une cellule de surveillance entre créneaux
  const renderSurveillanceEntreCreneaux = (day, timeSlotIndex) => {
    const surveillancesEntreCreneaux = getSurveillancesEntreCreneaux(day, timeSlotIndex);
    
    if (!surveillancesEntreCreneaux || surveillancesEntreCreneaux.length === 0) {
      return null;
    }

    return (
      <View style={styles.surveillanceEntreCreneauxCell}>
        {surveillancesEntreCreneaux[0].lieu && (
          <Text style={styles.surveillanceLieuText}>
            {surveillancesEntreCreneaux[0].lieu}
          </Text>
        )}
      </View>
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
    const surveillances = getSurveillancesByDayAndHour(day, `${timeSlot.debut} - ${timeSlot.fin}`);

    return (
      <View style={styles.planningCell}>
        {renderCours(cours)}
        {renderSurveillance(surveillances)}
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
          {timeSlots && timeSlots.length > 0 ? (
            <>
              {/* Ligne des surveillances avant la première heure (position -1) */}
              <View style={styles.surveillanceRow}>
                <View style={styles.surveillanceTimeCell}>
                  <Text style={styles.surveillanceTimeText}>
                    Avant
                  </Text>
                </View>
                {days.map((day, dayIndex) => (
                  <View key={dayIndex} style={styles.surveillanceCell}>
                    {renderSurveillanceEntreCreneaux(day, -1)}
                  </View>
                ))}
              </View>
              
              {timeSlots.map((timeSlot, hourIndex) => (
                <View key={hourIndex}>
                  {/* Ligne des créneaux horaires */}
                  <View style={styles.timeRow}>
                    {renderTimeCell(timeSlot)}
                    {days.map((day, dayIndex) => (
                      <View key={dayIndex} style={styles.planningCell}>
                        {renderPlanningCell(day, timeSlot)}
                      </View>
                    ))}
                  </View>
                  
                  {/* Ligne des surveillances entre créneaux (sauf pour le dernier créneau) */}
                  {hourIndex < timeSlots.length - 1 && (
                    <View style={styles.surveillanceRow}>
                      <View style={styles.surveillanceTimeCell}>
                        <Text style={styles.surveillanceTimeText}>
                          Surveillance
                        </Text>
                      </View>
                      {days.map((day, dayIndex) => (
                        <View key={dayIndex} style={styles.surveillanceCell}>
                          {renderSurveillanceEntreCreneaux(day, hourIndex)}
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              ))}
              
              {/* Ligne des surveillances après la dernière heure */}
              <View style={styles.surveillanceRow}>
                <View style={styles.surveillanceTimeCell}>
                  <Text style={styles.surveillanceTimeText}>
                    Surveillance
                  </Text>
                </View>
                {days.map((day, dayIndex) => (
                  <View key={dayIndex} style={styles.surveillanceCell}>
                    {renderSurveillanceEntreCreneaux(day, timeSlots.length - 1)}
                  </View>
                ))}
              </View>
            </>
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
                  <Text style={styles.modalLabel}>Classe :</Text> {selectedCours.classe}
                </Text>
                <Text style={styles.modalText}>
                  <Text style={styles.modalLabel}>Salle :</Text> {selectedCours.salle}
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
    padding: 1,
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
  surveillanceItem: {
    backgroundColor: '#FFF3E0',
    borderRadius: 4,
    padding: 4,
    marginBottom: 2,
    borderLeftWidth: 3,
    borderLeftColor: '#FF9800'
  },
  surveillanceText: {
    fontSize: 12,
    color: '#E65100',
    fontWeight: '500'
  },
  surveillanceRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  surveillanceTimeCell: {
    width: 60,
    paddingVertical: 4,
    paddingHorizontal: 4,
    backgroundColor: '#FF9800',
    borderRadius: 6,
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  surveillanceTimeText: {
    fontSize: 9,
    color: '#FFFFFF',
    fontWeight: '600',
    textAlign: 'center',
  },
  surveillanceCell: {
    flex: 1,
    minHeight: 40,
    backgroundColor: '#FFF8E1',
    borderRadius: 6,
    marginRight: 8,
    padding: 4,
    borderWidth: 1,
    borderColor: '#FFE0B2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  surveillanceEntreCreneauxCell: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  surveillanceLieuText: {
    fontSize: 11,
    color: '#E65100',
    fontStyle: 'italic',
    marginBottom: 2,
    fontWeight: '500',
    textAlign: 'center'
  },
  commentIcon: {
    marginLeft: 4,
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
});

export default TeacherPlanningScreen; 