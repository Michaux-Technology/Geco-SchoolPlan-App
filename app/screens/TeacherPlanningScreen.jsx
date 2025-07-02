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

const TeacherPlanningScreen = ({ route }) => {
  const { t } = useTranslation();
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
  
  // Variables pour la gestion offline
  const { isOnline } = useNetworkStatus();
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [syncInProgress, setSyncInProgress] = useState(false);
  
  // Variables pour l'indicateur de cours actuel
  const [currentTime, setCurrentTime] = useState(new Date());
  const [currentTimeSlot, setCurrentTimeSlot] = useState(null);
  const [currentSurveillanceIndex, setCurrentSurveillanceIndex] = useState(null);

  const days = [t('planning.mon'), t('planning.tue'), t('planning.wed'), t('planning.thu'), t('planning.fri')];

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

  // Effet pour mettre à jour l'heure actuelle et déterminer le créneau horaire actuel
  useEffect(() => {
    const updateCurrentTime = () => {
      const now = new Date();
      setCurrentTime(now);
      
      // Déterminer le créneau horaire actuel
      if (timeSlots && timeSlots.length > 0) {
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const currentTimeString = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;
        

        
        // Trouver le créneau horaire actuel
        const foundTimeSlot = timeSlots.find(slot => {
          const [startHour, startMinute] = slot.debut.split(':').map(Number);
          const [endHour, endMinute] = slot.fin.split(':').map(Number);
          
          const startTime = startHour * 60 + startMinute;
          const endTime = endHour * 60 + endMinute;
          const currentTime = currentHour * 60 + currentMinute;
          
          const isInSlot = currentTime >= startTime && currentTime < endTime;
          

          

          
          return isInSlot;
        });
        

        setCurrentTimeSlot(foundTimeSlot || null);
        

        
        // Si aucun créneau horaire trouvé, vérifier les surveillances entre créneaux
        if (!foundTimeSlot && timeSlots.length > 0) {
          const currentHour = now.getHours();
          const currentMinute = now.getMinutes();
          const currentTimeMinutes = currentHour * 60 + currentMinute;
          
          // Vérifier si c'est le jour actuel
          const currentDay = now.toLocaleDateString('fr-FR', { weekday: 'long' });
          const currentDayAbbr = {
            'lundi': t('planning.mon'),
            'mardi': t('planning.tue'),
            'mercredi': t('planning.wed'),
            'jeudi': t('planning.thu'),
            'vendredi': t('planning.fri')
          }[currentDay.toLowerCase()];
          
          // Vérifier si c'est la semaine actuelle
          const currentWeekNumber = getWeekNumber(now);
          const currentYearNumber = now.getFullYear();
          const isCurrentWeek = currentWeek === currentWeekNumber && currentYear === currentYearNumber;
          
          if (isCurrentWeek) {
            // Vérifier la surveillance avant la première heure (position -1)
            const [firstHour, firstMinute] = timeSlots[0].debut.split(':').map(Number);
            const firstTime = firstHour * 60 + firstMinute;
                         if (currentTimeMinutes < firstTime) {
               setCurrentSurveillanceIndex(-1);
               return;
             }
            
                         // Vérifier les surveillances entre créneaux
             for (let i = 0; i < timeSlots.length - 1; i++) {
               const [prevHour, prevMinute] = timeSlots[i].fin.split(':').map(Number);
               const [nextHour, nextMinute] = timeSlots[i + 1].debut.split(':').map(Number);
               const startTime = prevHour * 60 + prevMinute;
               const endTime = nextHour * 60 + nextMinute;
               

               
               if (currentTimeMinutes >= startTime && currentTimeMinutes < endTime) {
                 console.log(`🎯 Surveillance actuelle détectée - Index: ${i}, Heure: ${currentHour}:${currentMinute}, Période: ${startTime}-${endTime}`);
                 setCurrentSurveillanceIndex(i);
                 return;
               }
             }
            
            // Vérifier la surveillance après la dernière heure
            const [lastHour, lastMinute] = timeSlots[timeSlots.length - 1].fin.split(':').map(Number);
            const lastTime = lastHour * 60 + lastMinute;
                         if (currentTimeMinutes >= lastTime) {
               setCurrentSurveillanceIndex(timeSlots.length - 1);
               return;
             }
          }
          
          // Aucune surveillance trouvée
          setCurrentSurveillanceIndex(null);
        } else {
          setCurrentSurveillanceIndex(null);
        }
      } else {
        setCurrentSurveillanceIndex(null);
      }
    };
    
    // Mettre à jour immédiatement
    updateCurrentTime();
    
    // Mettre à jour toutes les minutes
    const interval = setInterval(updateCurrentTime, 60000);
    
    return () => clearInterval(interval);
  }, [timeSlots]);

  // Effet séparé pour mettre à jour l'heure immédiatement au montage
  useEffect(() => {
    const now = new Date();
    setCurrentTime(now);
  }, []);

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
      
      // Ne charger via API REST que si on n'a pas de données WebSocket
      if (!planning || planning.length === 0) {
        loadPlanning();
      } else {
        // Vérifier que planning est un tableau avant de le filtrer
        if (Array.isArray(planning)) {
          const filteredPlanning = planning.filter(cours => 
            cours.semaine === requestedWeek && 
            cours.annee === requestedYear
          );
          setPlanning(filteredPlanning);
        } else {
          loadPlanning();
        }
      }
      
      // Charger les surveillances pour la semaine demandée
      loadSurveillances();
      
      // Charger les annotations pour la semaine demandée
      loadAnnotations();
    }
  }, [requestedWeek, requestedYear]);

  // Suppression de l'effet de filtrage automatique pour éviter les conflits avec WebSocket

      const connectSocket = async () => {
    
    // Vérifications préventives multiples
    if (!isOnline) {
      console.log('📱 Mode hors ligne détecté - WebSocket désactivé');
      setIsOfflineMode(true);
      setWsConnected(false);
      return;
    }
    
    if (!school || !school.apiUrl) {
      console.log('⚠️ Pas d\'URL d\'école valide - WebSocket désactivé');
      return;
    }
    
    // Vérifier que socket.io-client est disponible
    if (!io) {
      console.log('⚠️ socket.io-client non disponible - WebSocket désactivé');
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
        setWsConnected(true);
        setError(null);
        
        // S'abonner aux mises à jour du planning
        newSocket.emit('subscribe', {
          enseignantId: teacher._id
        });
      });



      newSocket.on('planningUpdate', (data) => {
        
        setLastUpdate(new Date());
        
        // Mettre à jour les données de planning
        if (data.cours && Array.isArray(data.cours)) {
          // Données reçues au format {cours: [...], surveillances: [...], uhrs: [...]}
          
          // Si le backend a envoyé la semaine/année, les utiliser
          const weekToUse = data.currentWeek || requestedWeek || currentWeek;
          const yearToUse = data.currentYear || requestedYear || currentYear;
          
                      if (weekToUse && yearToUse) {
              // Filtrer les cours pour la semaine demandée
              const filteredPlanning = data.cours.filter(cours => 
                cours.semaine === weekToUse && 
                cours.annee === yearToUse
              );
              setPlanning(filteredPlanning);
            } else {
              // Si aucune semaine n'est définie, stocker tous les cours
              setPlanning(data.cours);
            }
        } else if (data.planning) {
          // Ancien format pour compatibilité
          
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
                setPlanning(filteredPlanning);
              } else {
                // Si aucune semaine n'est définie, stocker tous les cours
                setPlanning(coursArray);
              }
          }
        }
        
        // Mettre à jour les surveillances
        if (data.surveillances && Array.isArray(data.surveillances)) {
          setSurveillances(data.surveillances);
        }
        
        // Mettre à jour les créneaux horaires
        if (data.uhrs && Array.isArray(data.uhrs)) {
          const formattedTimeSlots = data.uhrs.map(slot => ({
            _id: slot._id,
            debut: slot.start,
            fin: slot.ende
          }));
          setTimeSlots(formattedTimeSlots);
        } else if (data.zeitslots) {
          const formattedTimeSlots = data.zeitslots.map(slot => ({
            _id: slot._id,
            debut: slot.start,
            fin: slot.ende
          }));
          setTimeSlots(formattedTimeSlots);
        } else if (data.planning && data.planning.uhrs) {
          const formattedTimeSlots = data.planning.uhrs.map(slot => ({
            _id: slot._id,
            debut: slot.start,
            fin: slot.ende
          }));
          setTimeSlots(formattedTimeSlots);
        }

        // Forcer un remontage du composant
        setViewKey(prev => prev + 1);
      });

      newSocket.on('coursUpdate', (data) => {
        
        setLastUpdate(new Date());
        
        // Traiter les données comme si c'était un planningUpdate
        if (Array.isArray(data)) {
          
          // Déterminer la semaine à utiliser pour le filtrage
          // Priorité : requestedWeek/requestedYear > currentWeek/currentYear > semaine actuelle par défaut
          let weekToUse = requestedWeek || currentWeek;
          let yearToUse = requestedYear || currentYear;
          
          // Si aucune semaine n'est définie, utiliser la semaine actuelle
          if (!weekToUse || !yearToUse) {
            const today = new Date();
            weekToUse = getWeekNumber(today);
            yearToUse = today.getFullYear();
          }
          
          // Filtrer les cours pour la semaine demandée
          const filteredPlanning = data.filter(cours => 
            cours.semaine === weekToUse && 
            cours.annee === yearToUse
          );
          
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
      });

      newSocket.on('connect_error', (error) => {
        setError('Erreur de connexion en temps réel');
        setWsConnected(false);
      });

      newSocket.on('disconnect', (reason) => {
        setWsConnected(false);
      });

      newSocket.on('error', (error) => {
        setError('Erreur de connexion en temps réel');
      });

      // Gestionnaires pour les annotations
      newSocket.on('annotationsUpdate', (annotationsMap) => {
        setAnnotations(annotationsMap);
      });

      newSocket.on('annotationError', (error) => {
        // Erreur silencieuse
      });

      setSocket(newSocket);
    } catch (error) {
      setError('Erreur lors de la création de la connexion WebSocket');
    }
  };

  const loadTimeSlots = async () => {
    try {
      setLoadingTimeSlots(true);
      setTimeSlotsError(null);
      
      if (!school?.token) {
        throw new Error('Token d\'authentification manquant');
      }

      // Utiliser le service API centralisé
      const result = await ApiService.makeRequest(school, '/api/mobile/uhrs');
      
      if (!result.success) {
        if (result.error === 'Aucune donnée disponible en mode hors ligne') {
          throw new Error('Aucun créneau horaire en cache. Veuillez vous connecter à internet pour charger les données.');
        }
        throw new Error(result.error || 'Erreur lors du chargement des créneaux horaires');
      }
      
      const data = result.data;
      
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
      setTimeSlotsError(err.message || 'Erreur lors du chargement des créneaux horaires');
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
        return;
      }

      // Utiliser le service API centralisé
      const endpoint = `/api/mobile/surveillances/enseignant/${teacher._id}?semaine=${requestedWeek}&annee=${requestedYear}`;
      const result = await ApiService.makeRequest(school, endpoint);
      

      
      if (!result.success) {
        if (result.error === 'Aucune donnée disponible en mode hors ligne') {
          setSurveillances([]);
          return;
        }
        setSurveillances([]);
        return;
      }
      
      const data = result.data;
      
      // Filtrer les surveillances pour la semaine demandée
      const filteredSurveillances = data.filter(surveillance => 
        surveillance.semaine === requestedWeek && 
        surveillance.annee === requestedYear
      );
      
      setSurveillances(filteredSurveillances);
    } catch (err) {
      // On ne met pas d'erreur dans l'état pour ne pas bloquer l'affichage du planning
      setSurveillances([]);
    }
  };

  const loadAnnotations = () => {
    if (socket && (requestedWeek || currentWeek) && (requestedYear || currentYear)) {
      const semaine = requestedWeek || currentWeek;
      const annee = requestedYear || currentYear;
      
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



      // Utiliser le service API centralisé
      const endpoint = `/api/mobile/cours/enseignant/${teacher._id}?semaine=${requestedWeek}&annee=${requestedYear}`;
      const result = await ApiService.makeRequest(school, endpoint);
      
      if (result.fromCache) {
        setIsOfflineMode(true);
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
      
      // Mettre à jour le timestamp de synchronisation
      const syncTime = Date.now();
      setLastSyncTime(syncTime);
      
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
      cours.heure === hour
    );
  };

  const getSurveillancesByDayAndHour = (day, hour) => {
    // Convertir le jour abrégé en jour complet
    const joursComplets = {
      [t('planning.mon')]: 'Lundi',
      [t('planning.tue')]: 'Mardi',
      [t('planning.wed')]: 'Mercredi',
      [t('planning.thu')]: 'Jeudi',
      [t('planning.fri')]: 'Vendredi'
    };
    
    const jourComplet = joursComplets[day];
    

    
    // Vérifier que surveillances est un tableau avant d'utiliser filter
    if (!Array.isArray(surveillances)) {
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
      

      
      return matchJour && matchType && matchEnseignant && matchHeure;
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
      <View style={[styles.timeCellSlot, { width: 45 }]}>
        <Text style={styles.timeTextStart}>{timeSlot.debut}</Text>
        <View style={styles.timeSeparator} />
        <Text style={styles.timeTextEnd}>{timeSlot.fin}</Text>
      </View>
    );
  };

  const renderCours = (cours) => {
    if (!cours || cours.length === 0) return null;

    return cours.map((item, index) => (
      <View key={index}>
        <TouchableOpacity 
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
            <Text 
              style={[
                styles.coursMatiere,
                item.annule && styles.coursAnnuleText,
                item.remplace && styles.coursRemplacementText
              ]} 
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {item.matiere}
              {item.annule && ` (${t('planning.cancelled')})`}
              {item.remplace && ` (${t('planning.replaced')})`}
            </Text>
          </View>
          <Text style={[
            styles.coursClasse,
            item.annule && styles.coursAnnuleText,
            item.remplace && styles.coursRemplacementText
          ]} numberOfLines={1}>
            {item.classe}
          </Text>
          <View style={styles.salleContainer}>
            <Text style={[
              styles.coursSalle,
              item.annule && styles.coursAnnuleText,
              item.remplace && styles.coursRemplacementText
            ]} numberOfLines={1}>
              {item.salle}
            </Text>
            {item.commentaire && item.commentaire.trim() !== '' && (
              <MaterialIcons 
                name="comment" 
                size={12} 
                color="#666666" 
                style={styles.commentIconInline}
              />
            )}
          </View>
          {item.remplace && item.remplacementInfo && (
            <Text style={styles.remplacementInfo} numberOfLines={1}>
              {item.remplacementInfo}
            </Text>
          )}
        </TouchableOpacity>
        {index < cours.length - 1 && <View style={styles.coursSeparator} />}
      </View>
    ));
  };

  const renderSurveillance = (surveillances) => {
    if (!surveillances || surveillances.length === 0) return null;

    return (
      <View style={styles.surveillanceItem}>
        <Text style={styles.surveillanceText}>
          {t('planning.surveillance')}
        </Text>
      </View>
    );
  };

  // Nouvelle fonction pour obtenir les surveillances entre créneaux pour un jour donné
  const getSurveillancesEntreCreneaux = (day, timeSlotIndex) => {
    // Convertir le jour abrégé en jour complet
    const joursComplets = {
      [t('planning.mon')]: 'Lundi',
      [t('planning.tue')]: 'Mardi',
      [t('planning.wed')]: 'Mercredi',
      [t('planning.thu')]: 'Jeudi',
      [t('planning.fri')]: 'Vendredi'
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
    
    // Vérifier si c'est le moment actuel pour une surveillance entre créneaux
    const isCurrentSurveillanceTime = () => {
      if (!currentTime || !timeSlots || timeSlots.length === 0) return false;
      
      // Vérifier si c'est le jour actuel
      const currentDay = currentTime.toLocaleDateString('fr-FR', { weekday: 'long' });
      const currentDayAbbr = {
        'lundi': t('planning.mon'),
        'mardi': t('planning.tue'),
        'mercredi': t('planning.wed'),
        'jeudi': t('planning.thu'),
        'vendredi': t('planning.fri')
      }[currentDay.toLowerCase()];
      
      const isCurrentDay = day === currentDayAbbr;
      
      // Vérifier si c'est la semaine actuelle
      const currentWeekNumber = getWeekNumber(currentTime);
      const currentYearNumber = currentTime.getFullYear();
      const isCurrentWeek = currentWeek === currentWeekNumber && currentYear === currentYearNumber;
      
      // Vérifier si c'est la surveillance actuelle
      const isCurrentSurveillance = currentSurveillanceIndex === timeSlotIndex;
      
      return isCurrentSurveillance && isCurrentDay && isCurrentWeek;
    };

    const isCurrent = isCurrentSurveillanceTime();

    // Si il y a une surveillance programmée, l'afficher
    if (surveillancesEntreCreneaux && surveillancesEntreCreneaux.length > 0) {
      return (
        <Text style={styles.surveillanceLieuText}>
          {surveillancesEntreCreneaux[0].lieu}
        </Text>
      );
    }
    
    // Sinon, ne rien afficher
    return null;
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
    const surveillances = getSurveillancesByDayAndHour(day, `${timeSlot.debut} - ${timeSlot.fin}`);

    return (
      <View>
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
            <>
              {/* Ligne des surveillances avant la première heure (position -1) */}
              <View style={styles.surveillanceRow}>
                <View style={styles.surveillanceTimeCell}>
                  <Text style={styles.surveillanceTimeText}>
                    {t('planning.surveillance')}
                  </Text>
                </View>
                {days.map((day, dayIndex) => (
                  <View 
                    key={dayIndex} 
                    style={[
                      styles.surveillanceEntreCreneauxCell,
                      dayIndex === days.length - 1 && styles.surveillanceEntreCreneauxCellLast
                    ]}
                  >
                    {renderSurveillanceEntreCreneaux(day, -1)}
                  </View>
                ))}
              </View>
              
              {timeSlots.map((timeSlot, hourIndex) => (
                <View key={hourIndex}>
                  {/* Ligne des créneaux horaires */}
                  <View style={styles.timeRow}>
                    {renderTimeCell(timeSlot)}
                    {days.map((day, dayIndex) => {
                      // Vérifier si c'est le créneau horaire actuel ET le jour actuel ET la semaine actuelle
                      const isCurrentTimeSlot = currentTimeSlot && 
                        currentTimeSlot.debut === timeSlot.debut && 
                        currentTimeSlot.fin === timeSlot.fin;

                      const currentDay = currentTime.toLocaleDateString('fr-FR', { weekday: 'long' });
                      const currentDayAbbr = {
                        'lundi': t('planning.mon'),
                        'mardi': t('planning.tue'),
                        'mercredi': t('planning.wed'),
                        'jeudi': t('planning.thu'),
                        'vendredi': t('planning.fri')
                      }[currentDay.toLowerCase()];
                      
                      const isCurrentDay = day === currentDayAbbr;
                      
                      // Vérifier si c'est la semaine actuelle
                      const currentWeekNumber = getWeekNumber(currentTime);
                      const currentYearNumber = currentTime.getFullYear();
                      const isCurrentWeek = currentWeek === currentWeekNumber && currentYear === currentYearNumber;
                      
                      const isCurrent = isCurrentTimeSlot && isCurrentDay && isCurrentWeek;



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
                  
                  {/* Ligne des surveillances entre créneaux (sauf pour le dernier créneau) */}
                  {hourIndex < timeSlots.length - 1 && (
                    <View style={styles.surveillanceRow}>
                      <View style={styles.surveillanceTimeCell}>
                        <Text style={styles.surveillanceTimeText}>
                          {t('planning.surveillance')}
                        </Text>
                      </View>
                      {days.map((day, dayIndex) => {
                        // Vérifier si c'est le moment actuel pour une surveillance entre créneaux
                        const isCurrentSurveillanceTime = () => {
                          if (!currentTime || !timeSlots || timeSlots.length === 0) return false;
                          
                          // Vérifier si c'est le jour actuel
                          const currentDay = currentTime.toLocaleDateString('fr-FR', { weekday: 'long' });
                          const currentDayAbbr = {
                            'lundi': t('planning.mon'),
                            'mardi': t('planning.tue'),
                            'mercredi': t('planning.wed'),
                            'jeudi': t('planning.thu'),
                            'vendredi': t('planning.fri')
                          }[currentDay.toLowerCase()];
                          
                          const isCurrentDay = day === currentDayAbbr;
                          
                          // Vérifier si c'est la semaine actuelle
                          const currentWeekNumber = getWeekNumber(currentTime);
                          const currentYearNumber = currentTime.getFullYear();
                          const isCurrentWeek = currentWeek === currentWeekNumber && currentYear === currentYearNumber;
                          
                          // Vérifier si c'est la surveillance actuelle
                          const isCurrentSurveillance = currentSurveillanceIndex === hourIndex;
                          
                          return isCurrentSurveillance && isCurrentDay && isCurrentWeek;
                        };

                        const isCurrent = isCurrentSurveillanceTime();

                        return (
                          <View 
                            key={dayIndex} 
                            style={[
                              isCurrent ? styles.currentTimeSlotCell : styles.surveillanceEntreCreneauxCell,
                              dayIndex === days.length - 1 && styles.surveillanceEntreCreneauxCellLast
                            ]}
                          >
                            {renderSurveillanceEntreCreneaux(day, hourIndex)}
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              ))}
              
              {/* Ligne des surveillances après la dernière heure */}
              <View style={styles.surveillanceRow}>
                <View style={styles.surveillanceTimeCell}>
                  <Text style={styles.surveillanceTimeText}>
                    {t('planning.surveillance')}
                  </Text>
                </View>
                {days.map((day, dayIndex) => {
                  // Vérifier si c'est le moment actuel pour une surveillance entre créneaux
                  const isCurrentSurveillanceTime = () => {
                    if (!currentTime || !timeSlots || timeSlots.length === 0) return false;
                    
                    // Vérifier si c'est le jour actuel
                    const currentDay = currentTime.toLocaleDateString('fr-FR', { weekday: 'long' });
                    const currentDayAbbr = {
                      'lundi': t('planning.mon'),
                      'mardi': t('planning.tue'),
                      'mercredi': t('planning.wed'),
                      'jeudi': t('planning.thu'),
                      'vendredi': t('planning.fri')
                    }[currentDay.toLowerCase()];
                    
                    const isCurrentDay = day === currentDayAbbr;
                    
                    // Vérifier si c'est la semaine actuelle
                    const currentWeekNumber = getWeekNumber(currentTime);
                    const currentYearNumber = currentTime.getFullYear();
                    const isCurrentWeek = currentWeek === currentWeekNumber && currentYear === currentYearNumber;
                    
                    // Vérifier si c'est la surveillance actuelle
                    const isCurrentSurveillance = currentSurveillanceIndex === timeSlots.length - 1;
                    
                    return isCurrentSurveillance && isCurrentDay && isCurrentWeek;
                  };

                  const isCurrent = isCurrentSurveillanceTime();

                  return (
                    <View 
                      key={dayIndex} 
                      style={[
                        isCurrent ? styles.currentTimeSlotCell : styles.surveillanceEntreCreneauxCell,
                        dayIndex === days.length - 1 && styles.surveillanceEntreCreneauxCellLast
                      ]}
                    >
                      {renderSurveillanceEntreCreneaux(day, timeSlots.length - 1)}
                    </View>
                  );
                })}
              </View>
            </>
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
        teacherId={teacher._id}
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
                  <Text style={styles.modalLabel}>{t('planning.class')} :</Text> {selectedCours.classe}
                </Text>
                <Text style={styles.modalText}>
                  <Text style={styles.modalLabel}>{t('planning.room')} :</Text> {selectedCours.salle}
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
  timeCellSlot: {
    width: 45,
    minHeight: 80,
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
    alignItems: 'flex-start',
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
    textAlign: 'left',
    overflow: 'hidden'
  },
  coursSalle: {
    fontSize: 11,
    color: '#666666',
    fontStyle: 'italic',
    textAlign: 'left',
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
    width: 45,
    paddingVertical: 4,
    paddingHorizontal: 2,
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
  surveillanceLieuText: {
    fontSize: 11,
    color: '#E65100',
    fontStyle: 'italic',
    marginBottom: 2,
    fontWeight: '500',
    textAlign: 'center'
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
    height: 200, // Augmenter encore plus l'espace pour éviter que l'OfflineIndicator soit caché par les boutons
  },
  dayCellLast: {
    marginRight: 0,
  },
  planningCellLast: {
    marginRight: 0,
  },
  surveillanceCellLast: {
    marginRight: 0,
  },
  surveillanceEntreCreneauxCellLast: {
    marginRight: 0,
  },
  commentIconInline: {
    marginLeft: 5,
  },
  salleContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  coursSeparator: {
    height: 1,
    backgroundColor: '#E0E0E0',
  },
  currentTimeSlotCell: {
    flex: 1,
    minHeight: 40,
    backgroundColor: '#E3F2FD',
    borderRadius: 6,
    marginRight: 8,
    padding: 4,
    borderWidth: 1,
    borderColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default TeacherPlanningScreen; 