import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, RefreshControl, Platform, TouchableOpacity, Modal, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import useNetworkStatus from '../../hooks/useNetworkStatus';
import OfflineStorage from '../../utils/offlineStorage';
import OfflineIndicator from '../../components/OfflineIndicator';
import ApiService from '../../utils/apiService';

// Import conditionnel de socket.io-client
let io = null;
try {
  const socketIoClient = require('socket.io-client');
  io = socketIoClient.io;
} catch (error) {
  console.log('⚠️ socket.io-client non disponible:', error.message);
}

const RoomPlanningScreen = ({ route }) => {
  const { t } = useTranslation();
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
  const [currentWeek, setCurrentWeek] = useState(null);
  const [currentYear, setCurrentYear] = useState(null);
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
  
  // Variables pour la gestion offline
  const { isOnline } = useNetworkStatus();
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [syncInProgress, setSyncInProgress] = useState(false);

  // Variables pour le marqueur de temps actuel
  const [currentTime, setCurrentTime] = useState(new Date());
  const [currentTimeSlot, setCurrentTimeSlot] = useState(null);
  const [currentDay, setCurrentDay] = useState(null);
  const [currentWeekMarker, setCurrentWeekMarker] = useState(null);
  const [currentYearMarker, setCurrentYearMarker] = useState(null);

  const days = [t('planning.mon'), t('planning.tue'), t('planning.wed'), t('planning.thu'), t('planning.fri')];

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
    

    
    setCurrentWeek(initialWeek);
    setCurrentYear(initialYear);
    setRequestedWeek(initialWeek);
    setRequestedYear(initialYear);
  };

  useEffect(() => {
    initializeWeekAndYear();
    loadTimeSlots();
  }, []);

  // Effet pour mettre à jour le temps actuel toutes les minutes
  useEffect(() => {
    const updateCurrentTime = () => {
      const now = new Date();
      setCurrentTime(now);
      
      // Déterminer le jour actuel (0 = dimanche, 1 = lundi, etc.)
      const dayOfWeek = now.getDay();
      const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
      setCurrentDay(dayNames[dayOfWeek]);
      
      // Calculer la semaine et l'année actuelles
      const weekNumber = getWeekNumber(now);
      const yearNumber = now.getFullYear();
      setCurrentWeekMarker(weekNumber);
      setCurrentYearMarker(yearNumber);
      
      // Déterminer le créneau horaire actuel
      if (timeSlots && timeSlots.length > 0) {
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const currentTimeInMinutes = currentHour * 60 + currentMinute;
        
        const activeSlot = timeSlots.find(slot => {
          const [startHour, startMinute] = slot.debut.split(':').map(Number);
          const [endHour, endMinute] = slot.fin.split(':').map(Number);
          const startTimeInMinutes = startHour * 60 + startMinute;
          const endTimeInMinutes = endHour * 60 + endMinute;
          
          return currentTimeInMinutes >= startTimeInMinutes && currentTimeInMinutes < endTimeInMinutes;
        });
        
        setCurrentTimeSlot(activeSlot || null);
      }
    };

    // Mettre à jour immédiatement
    updateCurrentTime();
    
    // Mettre à jour toutes les minutes
    const interval = setInterval(updateCurrentTime, 60000);
    
    return () => clearInterval(interval);
  }, [timeSlots]);

  // Effet pour la connexion WebSocket uniquement quand l'écran est visible
  useFocusEffect(
    React.useCallback(() => {
      // Vérifier que l'école a une URL valide avant de tenter la connexion
      if (school && school.apiUrl) {
        connectSocket();
      }
      
      return () => {
        if (socket) {
          // Désactiver la reconnexion automatique avant de déconnecter
          socket.io.opts.reconnection = false;
          socket.disconnect();
          setSocket(null);
          setWsConnected(false);
        }
      };
    }, [school])
  );

  // Effet pour surveiller les changements de connectivité
  useEffect(() => {
    if (isOnline && isOfflineMode) {
      setIsOfflineMode(false);
      // Ne reconnecter que si on a un socket valide (écran visible)
      if (socket) {
        connectSocket();
      }
    } else if (!isOnline && !isOfflineMode) {
      setIsOfflineMode(true);
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setWsConnected(false);
      }
    }
  }, [isOnline]);

  // Effet pour charger le planning quand la semaine ou l'année change
  useEffect(() => {
    if (requestedWeek && requestedYear) {
      // Charger via API REST directement pour les salles
      loadPlanning();
      
      // Charger les annotations pour la semaine demandée
      loadAnnotations();
    }
  }, [requestedWeek, requestedYear]);

  const connectSocket = async () => {
    
    // Vérifications préventives multiples
    if (!isOnline) {
      setIsOfflineMode(true);
      setWsConnected(false);
      return;
    }
    
    if (!school || !school.apiUrl) {
      return;
    }
    
    // Vérifier que socket.io-client est disponible
    if (!io) {
      setIsOfflineMode(true);
      setWsConnected(false);
      return;
    }
    
    // Vérifier la connectivité réseau avant de tenter la connexion WebSocket
    try {
      const isServerAccessible = await ApiService.checkConnectivity(school.apiUrl);
      
      if (!isServerAccessible) {
        setIsOfflineMode(true);
        setWsConnected(false);
        return;
      }
    } catch (error) {
      setIsOfflineMode(true);
      setWsConnected(false);
      return;
    }
    
    const baseUrl = school.apiUrl.endsWith('/') ? school.apiUrl.slice(0, -1) : school.apiUrl;
    // Corriger l'URL WebSocket
    let socketUrl = baseUrl;
    if (baseUrl.startsWith('http://')) {
      socketUrl = baseUrl.replace('http://', 'ws://');
    } else if (baseUrl.startsWith('https://')) {
      socketUrl = baseUrl.replace('https://', 'wss://');
    }
    

    
    try {
      const newSocket = io(socketUrl, {
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
      });

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

      newSocket.on('coursUpdate', (data) => {
        console.log('🔄 Mise à jour des cours reçue via WebSocket (coursUpdate):', {
          dataLength: data.length,
          timestamp: new Date().toISOString()
        });
        
        setLastUpdate(new Date());
        
        // Traiter les données comme si c'était un planningUpdate
        if (Array.isArray(data)) {
          console.log('📚 Cours reçus via coursUpdate:', data.length);
          
          // Filtrer les cours pour cette salle
          const filteredCours = data.filter(cours => 
            cours.salle && cours.salle.nom === salleNom &&
            !cours.annule // Exclure les cours annulés
          );
          console.log('📅 Cours filtrés pour la salle (coursUpdate):', {
            salleNom,
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
            salleNom,
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

      console.log('📡 Chargement des créneaux horaires...');

      // Utiliser le service API centralisé
      const result = await ApiService.makeRequest(school, '/api/mobile/uhrs');
      
      if (result.fromCache) {
        console.log('📱 Mode hors ligne - Créneaux horaires récupérés depuis le cache');
      } else {
        console.log('🌐 Mode en ligne - Créneaux horaires récupérés depuis le serveur');
      }
      
      if (!result.success) {
        if (result.error === 'Aucune donnée disponible en mode hors ligne') {
          throw new Error('Aucun créneau horaire en cache. Veuillez vous connecter à internet pour charger les données.');
        }
        throw new Error(result.error || 'Erreur lors du chargement des créneaux horaires');
      }
      
      const data = result.data;
      
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

      console.log('📡 Chargement du planning pour la salle:', {
        salle: salleNom,
        semaine: requestedWeek,
        annee: requestedYear
      });

      // Utiliser le service API centralisé
      const endpoint = `/api/mobile/planning?semaine=${requestedWeek}&annee=${requestedYear}`;
      const result = await ApiService.makeRequest(school, endpoint);
      
      if (result.fromCache) {
        setIsOfflineMode(true);
        console.log('📱 Mode hors ligne - Données récupérées depuis le cache');
      } else {
        setIsOfflineMode(false);

      }
      
      if (!result.success) {
        if (result.error === 'Aucune donnée disponible en mode hors ligne') {
          throw new Error('Aucune donnée en cache. Veuillez vous connecter à internet pour charger les données.');
        }
        throw new Error(result.error || 'Erreur lors du chargement du planning');
      }
      
      const data = result.data;
      
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
      
      // Mettre à jour le temps de dernière synchronisation
      setLastSyncTime(new Date().toISOString());
      console.log('⏰ Dernière synchronisation mise à jour:', new Date().toISOString());
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
      [t('planning.mon')]: 'Lundi',
      [t('planning.tue')]: 'Mardi',
      [t('planning.wed')]: 'Mercredi',
      [t('planning.thu')]: 'Jeudi',
      [t('planning.fri')]: 'Vendredi'
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
            : t('planning.teacherNotDefined')
          }
        </Text>
        <View style={styles.classeContainer}>
          <Text style={styles.coursSalle}>
            {coursItem.classe || t('planning.classNotDefined')}
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
        <Text style={styles.annotationsTitle}>{t('planning.weekAnnotations')}</Text>
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
      <View>
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

  const handleManualSync = async () => {
    if (!isOnline) {
      Alert.alert(
        t('offline.noConnection'),
        t('offline.noConnectionMessage'),
        [{ text: t('common.ok'), style: 'default' }]
      );
      return;
    }

    setSyncInProgress(true);
    try {
      await loadPlanning();
      Alert.alert(
        t('offline.syncSuccess'),
        t('offline.dataFromServer'),
        [{ text: t('common.ok'), style: 'default' }]
      );
    } catch (error) {
      Alert.alert(
        t('offline.syncError'),
        error.message,
        [{ text: t('common.ok'), style: 'default' }]
      );
    } finally {
      setSyncInProgress(false);
    }
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>{t('planning.loadingPlanning')}</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <MaterialIcons name="error-outline" size={64} color="#F44336" />
        <Text style={styles.errorText}>{error}</Text>
        <Text style={styles.errorSubtext}>{t('planning.pullToRetry')}</Text>
      </View>
    );
  }

  if (loadingTimeSlots && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>{t('planning.loadingTimeSlots')}</Text>
      </View>
    );
  }

  if (timeSlotsError) {
    return (
      <View style={styles.centerContainer}>
        <MaterialIcons name="error-outline" size={64} color="#F44336" />
        <Text style={styles.errorText}>{timeSlotsError}</Text>
        <Text style={styles.errorSubtext}>{t('planning.pullToRetry')}</Text>
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
                {t('planning.week')} {currentWeek} - {currentYear}
              </Text>
              {lastUpdate && (
                <Text style={styles.lastUpdateText}>
                  {t('planning.lastUpdate')} : {lastUpdate.toLocaleTimeString()}
                </Text>
              )}
              {!wsConnected && (
                <Text style={styles.connectionStatus}>
                  {t('planning.reconnecting')}
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
                {days.map((day, dayIndex) => {
                  // Vérifier si c'est le créneau actuel
                  const isCurrentSlot = currentTimeSlot && 
                    currentTimeSlot.debut === timeSlot.debut && 
                    currentTimeSlot.fin === timeSlot.fin;
                  
                  // Vérifier si c'est le jour actuel
                  const dayNames = {
                    [t('planning.mon')]: 'mon',
                    [t('planning.tue')]: 'tue',
                    [t('planning.wed')]: 'wed',
                    [t('planning.thu')]: 'thu',
                    [t('planning.fri')]: 'fri'
                  };
                  const isCurrentDay = currentDay === dayNames[day];
                  
                  // Vérifier si c'est la semaine et l'année actuelles
                  const isCurrentWeek = currentWeekMarker === currentWeek && currentYearMarker === currentYear;
                  
                  const isCurrent = isCurrentSlot && isCurrentDay && isCurrentWeek;

                  return (
                    <View 
                      key={dayIndex} 
                      style={[
                        isCurrent ? styles.planningCellActive : styles.planningCell,
                        dayIndex === days.length - 1 && styles.planningCellLast
                      ]}
                    >
                      {renderPlanningCell(day, timeSlot)}
                    </View>
                  );
                })}
              </View>
            ))
          ) : (
            <View style={styles.centerContainer}>
              <Text style={styles.errorText}>
                {t('planning.noTimeSlots')}
              </Text>
              <Text style={styles.errorSubtext}>
                {t('planning.timeSlotsLoaded')}: {timeSlots ? timeSlots.length : 'null'}
              </Text>
            </View>
          )}
        </View>
        
        {/* Section des annotations */}
        {renderAnnotations()}
        
        {/* Espace en bas pour éviter que le contenu soit caché par les boutons du smartphone */}
        <View style={styles.bottomSpacing} />
      </ScrollView>

      {/* Indicateur offline */}
      <OfflineIndicator
        schoolId={school?.id || school?.name}
        salleId={salleNom}
        onSyncPress={handleManualSync}
        lastSyncTime={lastSyncTime}
      />

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
              {selectedCours?.remplace ? t('planning.replacementDetails') : 
               selectedCours?.annule ? t('planning.cancelledCourse') : t('planning.courseDetails')}
            </Text>
            {selectedCours && (
              <>
                <Text style={styles.modalText}>
                  <Text style={styles.modalLabel}>{t('planning.subject')} :</Text> {selectedCours.matiere}
                </Text>
                <Text style={styles.modalText}>
                  <Text style={styles.modalLabel}>{t('planning.teacher')} :</Text> {selectedCours.enseignants && selectedCours.enseignants.length > 0 
                    ? selectedCours.enseignants.map(e => e.nom).join(', ')
                    : t('planning.teacherNotDefined')
                  }
                </Text>
                <Text style={styles.modalText}>
                  <Text style={styles.modalLabel}>{t('planning.class')} :</Text> {selectedCours.classe || t('planning.classNotDefined')}
                </Text>
                <Text style={styles.modalText}>
                  <Text style={styles.modalLabel}>{t('planning.room')} :</Text> {selectedCours.salle || t('planning.classNotDefined')}
                </Text>
                <Text style={styles.modalText}>
                  <Text style={styles.modalLabel}>{t('planning.day')} :</Text> {selectedCours.jour}
                </Text>
                <Text style={styles.modalText}>
                  <Text style={styles.modalLabel}>{t('planning.time')} :</Text> {selectedCours.heure}
                </Text>
                {selectedCours.commentaire && selectedCours.commentaire.trim() !== '' && (
                  <Text style={styles.modalText}>
                    <Text style={styles.modalLabel}>{t('planning.comment')} :</Text> {selectedCours.commentaire}
                  </Text>
                )}
                {selectedCours.remplace && selectedCours.remplacementInfo && (
                  <Text style={styles.modalText}>
                    <Text style={styles.modalLabel}>{t('planning.replacementInfo')} :</Text> {selectedCours.remplacementInfo}
                  </Text>
                )}
                {selectedCours.annule && (
                  <Text style={[styles.modalText, { color: '#FF9800', fontStyle: 'italic' }]}>
                    ⚠️ {t('planning.courseCancelled')}
                  </Text>
                )}
              </>
            )}
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.modalButtonText}>{t('common.close')}</Text>
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
    padding: 2,
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
    paddingLeft: 2,
    marginLeft: 1,
  },
  coursAnnuleText: {
    color: '#FF9800',
    textDecorationLine: 'line-through',
  },
  coursRemplacement: {
    borderLeftWidth: 3,
    borderLeftColor: '#4CAF50',
    paddingLeft: 2,
    marginLeft: 1,
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
    bottom: 0,
    right: -5,
    zIndex: 1,
  },
  commentIconInline: {
    marginLeft: 5,
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
    height: 200, // Augmenter encore plus l'espace pour éviter que l'OfflineIndicator soit caché par les boutons
  },
  planningCellLast: {
    marginRight: 0,
  },
  dayCellLast: {
    marginRight: 0,
  },
  classeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  // Styles pour le marqueur de temps actuel
  activeTimeCell: {
    backgroundColor: '#2196F3',
  },
  planningCellActive: {
    flex: 1,
    minHeight: 80,
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    marginRight: 8,
    padding: 0,
    borderWidth: 2,
    borderColor: '#2196F3',
  },
});

export default RoomPlanningScreen; 