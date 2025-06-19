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
        // Formater les créneaux horaires pour qu'ils aient la même structure
        const formattedTimeSlots = data.map(slot => ({
          _id: slot._id,
          debut: slot.start,
          fin: slot.ende
        }));
        console.log('Créneaux horaires formatés:', formattedTimeSlots);
        setTimeSlots(formattedTimeSlots);
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

  const loadSurveillances = async () => {
    try {
      if (!school?.token) {
        throw new Error('Token d\'authentification manquant');
      }

      // Vérifier que les paramètres sont définis
      if (!requestedWeek || !requestedYear) {
        console.log('Paramètres manquants pour les surveillances:', {
          semaine: requestedWeek,
          annee: requestedYear
        });
        return;
      }

      const baseUrl = school.apiUrl.endsWith('/') ? school.apiUrl.slice(0, -1) : school.apiUrl;
      const apiUrl = `${baseUrl}/api/mobile/surveillances/enseignant/${teacher._id}?semaine=${requestedWeek}&annee=${requestedYear}`;

      console.log('Chargement des surveillances depuis:', apiUrl, {
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
      console.log('Surveillances reçues:', data);
      setSurveillances(data);
    } catch (err) {
      console.error('Erreur lors du chargement des surveillances:', err);
      // On ne met pas d'erreur dans l'état pour ne pas bloquer l'affichage du planning
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
        console.log('Paramètres manquants pour le planning:', {
          semaine: requestedWeek,
          annee: requestedYear
        });
        return;
      }

      const baseUrl = school.apiUrl.endsWith('/') ? school.apiUrl.slice(0, -1) : school.apiUrl;
      const apiUrl = `${baseUrl}/api/mobile/cours/enseignant/${teacher._id}?semaine=${requestedWeek}&annee=${requestedYear}`;

      console.log('Chargement du planning depuis:', apiUrl, {
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
      
      // Charger les surveillances après le planning
      await loadSurveillances();
      
    } catch (err) {
      console.error('Erreur lors du chargement du planning:', err);
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
      
      console.log('📅 Calcul de la semaine:', {
        date: d.toISOString(),
        yearStart: yearStart.toISOString(),
        weekNo: weekNo
      });

      // S'assurer que le numéro de semaine est valide
      if (isNaN(weekNo) || weekNo < 1 || weekNo > 53) {
        console.error('❌ Numéro de semaine invalide:', weekNo);
        return 1; // Retourner la première semaine par défaut
      }
      
      return weekNo;
    } catch (error) {
      console.error('❌ Erreur lors du calcul de la semaine:', error);
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
      console.warn('Planning n\'est pas dans le format attendu:', planning);
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
    
    // Vérifier que surveillances est un tableau avant d'utiliser filter
    if (!Array.isArray(surveillances)) {
      console.warn('Surveillances n\'est pas un tableau:', surveillances);
      return [];
    }
    
    return surveillances.filter(surveillance => 
      surveillance.jour === jourComplet && 
      `${surveillance.uhr.start} - ${surveillance.uhr.ende}` === hour
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

  const renderSurveillance = (surveillances) => {
    if (!surveillances || surveillances.length === 0) return null;

    return surveillances.map((item, index) => (
      <View key={index} style={styles.surveillanceItem}>
        <Text style={styles.surveillanceText}>
          {item.type === 'entre_creneaux' ? '⏰ Surveillance' : '🚶 Surveillance'} {item.lieu}
        </Text>
        {item.type === 'entre_creneaux' && (
          <Text style={styles.surveillanceDetail}>
            Entre les créneaux
          </Text>
        )}
      </View>
    ));
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
    console.log('⬅️ Navigation vers la semaine précédente');
    // Utiliser des valeurs par défaut si requestedWeek/requestedYear sont null
    const currentWeekValue = requestedWeek || currentWeek || 25;
    const currentYearValue = requestedYear || currentYear || 2025;
    
    let newWeek = currentWeekValue - 1;
    let newYear = currentYearValue;

    if (newWeek < 1) {
      newWeek = 52;
      newYear = currentYearValue - 1;
    }

    console.log('📅 Nouvelle semaine/année:', {
      semaine: newWeek,
      annee: newYear
    });

    setRequestedWeek(newWeek);
    setRequestedYear(newYear);
    setCurrentWeek(newWeek);
    setCurrentYear(newYear);
  };

  const goToNextWeek = () => {
    console.log('➡️ Navigation vers la semaine suivante');
    // Utiliser des valeurs par défaut si requestedWeek/requestedYear sont null
    const currentWeekValue = requestedWeek || currentWeek || 25;
    const currentYearValue = requestedYear || currentYear || 2025;
    
    let newWeek = currentWeekValue + 1;
    let newYear = currentYearValue;

    if (newWeek > 52) {
      newWeek = 1;
      newYear = currentYearValue + 1;
    }

    console.log('📅 Nouvelle semaine/année:', {
      semaine: newWeek,
      annee: newYear
    });

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
      {console.log('Rendu - État des créneaux horaires:', {
        timeSlotsLength: timeSlots ? timeSlots.length : 'null',
        timeSlots: timeSlots
      })}
      {console.log('Rendu - État de la connexion WebSocket:', {
        wsConnected,
        socketId: socket?.id,
        lastUpdate: lastUpdate?.toISOString(),
        planningLength: planning?.length || 0
      })}
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
          {timeSlots && timeSlots.length > 0 ? (
            timeSlots.map((timeSlot, hourIndex) => (
              <View key={hourIndex} style={styles.timeRow}>
                {renderTimeCell(timeSlot)}
                {days.map((day, dayIndex) => (
                  <View key={dayIndex} style={styles.planningCell}>
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
  surveillanceDetail: {
    fontSize: 10,
    color: '#F57C00',
    fontStyle: 'italic'
  }
});

export default TeacherPlanningScreen; 