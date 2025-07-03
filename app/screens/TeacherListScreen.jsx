import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl, Platform, TouchableOpacity, Linking, Alert, Clipboard } from 'react-native';
import { MaterialIcons, FontAwesome } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import ApiService from '../../utils/apiService';
import useNetworkStatus from '../../hooks/useNetworkStatus';

const TeacherListScreen = ({ route }) => {
  const { school } = route.params;
  const navigation = useNavigation();
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [favorites, setFavorites] = useState(new Set());
  
  // Variables pour la gestion offline
  const { isOnline } = useNetworkStatus();
  const [isOfflineMode, setIsOfflineMode] = useState(false);

  const sortTeachersByFavorites = (teachersList, favoritesSet) => {
    return [...teachersList].sort((a, b) => {
      const aIsFav = favoritesSet.has(a._id || a.id);
      const bIsFav = favoritesSet.has(b._id || b.id);
      
      // Si l'un est favori et l'autre non
      if (aIsFav && !bIsFav) return -1;
      if (!aIsFav && bIsFav) return 1;
      
      // Si les deux sont favoris ou les deux ne sont pas favoris,
      // trier par ordre alphabétique
      const aName = `${a.nom} ${a.prenom}`.toLowerCase();
      const bName = `${b.nom} ${b.prenom}`.toLowerCase();
      return aName.localeCompare(bName);
    });
  };

  const loadFavorites = async () => {
    try {
      const storedFavorites = await AsyncStorage.getItem(`favorites_${school.id}`);
      if (storedFavorites) {
        const favoritesSet = new Set(JSON.parse(storedFavorites));
        setFavorites(favoritesSet);
        return favoritesSet;
      }
      return new Set();
    } catch (error) {
      console.error('Erreur lors du chargement des favoris:', error);
      return new Set();
    }
  };

  const toggleFavorite = async (teacherId) => {
    try {
      const newFavorites = new Set(favorites);
      if (newFavorites.has(teacherId)) {
        newFavorites.delete(teacherId);
      } else {
        newFavorites.add(teacherId);
      }

      // Mettre à jour l'état des favoris
      setFavorites(newFavorites);

      // Sauvegarder les favoris dans AsyncStorage
      await AsyncStorage.setItem(
        `favorites_${school.id}`,
        JSON.stringify(Array.from(newFavorites))
      );

      // Créer une nouvelle liste triée avec l'ordre alphabétique pour les non-favoris
      const updatedTeachers = [...teachers];
      const sortedTeachers = sortTeachersByFavorites(updatedTeachers, newFavorites);
      
      // Mettre à jour la liste des enseignants avec le nouveau tri
      setTeachers(sortedTeachers);
    } catch (error) {
      console.error('Erreur lors de la mise à jour des favoris:', error);
    }
  };

  const refreshToken = async () => {
    try {
      console.log('Tentative de rafraîchissement du token...');
      console.log('Refresh token disponible:', Boolean(school.refreshToken));
      console.log('Refresh token preview:', school.refreshToken ? `${school.refreshToken.substring(0, 10)}...` : 'manquant');

      const baseUrl = school.apiUrl.endsWith('/') ? school.apiUrl.slice(0, -1) : school.apiUrl;
      const refreshUrl = `${baseUrl}/api/mobile/refresh-token`;
      console.log('URL de rafraîchissement:', refreshUrl);

      const refreshResponse = await fetch(refreshUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken: school.refreshToken }),
      });

      console.log('Statut de la réponse:', refreshResponse.status);
      const responseText = await refreshResponse.text();
      console.log('Réponse brute du serveur:', responseText);

      let responseData;
      try {
        responseData = JSON.parse(responseText);
        console.log('Données parsées:', {
          hasToken: Boolean(responseData.token),
          hasUser: Boolean(responseData.user),
          tokenPreview: responseData.token ? `${responseData.token.substring(0, 10)}...` : 'manquant'
        });
      } catch (parseError) {
        console.error('Erreur lors du parsing de la réponse:', parseError);
        throw new Error('Réponse invalide du serveur');
      }

      if (!refreshResponse.ok) {
        throw new Error(`Échec du rafraîchissement du token: ${responseData.message || responseText}`);
      }

      if (!responseData.token) {
        throw new Error('Token manquant dans la réponse');
      }

      // Mettre à jour le token dans les données de l'école
      const updatedSchool = {
        ...school,
        token: responseData.token
      };

      // Sauvegarder les nouvelles données dans AsyncStorage
      await AsyncStorage.setItem(`school_${school.id}`, JSON.stringify(updatedSchool));
      console.log('Nouveau token sauvegardé avec succès');

      return responseData.token;
    } catch (error) {
      console.error('Erreur lors du rafraîchissement du token:', error);
      throw error;
    }
  };

  const loadTeachers = async (currentFavorites) => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('🔄 Chargement des enseignants...');

      if (!school?.token) {
        throw new Error('Token d\'authentification manquant. Veuillez vous reconnecter.');
      }

      // Utiliser le service API centralisé
      const result = await ApiService.makeRequest(school, '/api/mobile/enseignant');

      if (result.fromCache) {
        console.log('📱 Mode hors ligne activé - données depuis le cache');
        setIsOfflineMode(true);
      } else {
        console.log('🌐 Mode en ligne - données depuis le serveur');
        setIsOfflineMode(false);
      }
      
      if (!result.success) {
        if (result.error === 'Aucune donnée disponible en mode hors ligne') {
          throw new Error('Aucune donnée en cache. Veuillez vous connecter à internet pour charger les données.');
        }
        throw new Error(result.error || 'Erreur lors du chargement des enseignants');
      }

      const data = result.data;
      
      if (!Array.isArray(data)) {
        throw new Error('Format de données invalide');
      }

      const favsToUse = currentFavorites || favorites;
      const sortedTeachers = sortTeachersByFavorites(data, favsToUse);
      setTeachers(sortedTeachers);
      
      console.log(`✅ ${sortedTeachers.length} enseignants chargés avec succès`);
    } catch (err) {
      console.error('❌ Erreur détaillée:', err);
      
      // Si c'est une erreur de timeout ou de réseau, essayer de récupérer depuis le cache
      if (err.message.includes('Délai d\'attente') || err.message.includes('réseau')) {
        console.log('🔄 Tentative de récupération depuis le cache...');
        try {
          const cachedResult = await ApiService.getFromCache(school, '/api/mobile/enseignant');
          if (cachedResult.success) {
            console.log('📱 Récupération depuis le cache réussie');
            setIsOfflineMode(true);
            const favsToUse = currentFavorites || favorites;
            const sortedTeachers = sortTeachersByFavorites(cachedResult.data, favsToUse);
            setTeachers(sortedTeachers);
            return;
          }
        } catch (cacheError) {
          console.log('❌ Échec de récupération depuis le cache:', cacheError.message);
        }
      }
      
      setError(err.message || 'Une erreur est survenue lors de la récupération des données');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initialize = async () => {
      const loadedFavorites = await loadFavorites();
      await loadTeachers(loadedFavorites);
    };
    initialize();
  }, []);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    const currentFavs = await loadFavorites();
    await loadTeachers(currentFavs);
  }, []);

  const handlePhonePress = async (phoneNumber) => {
    try {
      // Nettoyer le numéro de téléphone
      let formattedNumber = phoneNumber.replace(/\s+/g, '');
      
      // Ajouter le préfixe international si nécessaire
      if (formattedNumber.startsWith('0')) {
        formattedNumber = '+33' + formattedNumber.substring(1);
      }

      // Différents formats d'URL à essayer
      const urlSchemes = [
        `tel:${formattedNumber}`,
        `telprompt:${formattedNumber}`,
        `tel://${formattedNumber}`,
        `voicemail:${formattedNumber}`
      ];

      // Essayer chaque schéma d'URL jusqu'à ce qu'un fonctionne
      for (const scheme of urlSchemes) {
        try {
          const canOpen = await Linking.canOpenURL(scheme);
          if (canOpen) {
            console.log('Ouverture avec le schéma:', scheme);
            await Linking.openURL(scheme);
            return; // Sortir de la fonction si l'ouverture réussit
          }
        } catch (error) {
          console.log('Échec avec le schéma:', scheme);
          continue; // Essayer le prochain schéma
        }
      }

      // Si aucun schéma n'a fonctionné, essayer une dernière approche
      const fallbackUrl = Platform.select({
        android: `intent://dial/${formattedNumber}#Intent;scheme=tel;package=com.android.phone;end`,
        ios: `tel:${formattedNumber}`,
        default: `tel:${formattedNumber}`
      });

      const canOpenFallback = await Linking.canOpenURL(fallbackUrl);
      if (canOpenFallback) {
        await Linking.openURL(fallbackUrl);
      } else {
        // Si vraiment rien ne fonctionne, afficher une alerte
        Alert.alert(
          'Appeler',
          phoneNumber,
          [
            {
              text: 'Annuler',
              style: 'cancel'
            },
            {
              text: 'Appeler',
              onPress: async () => {
                // Dernière tentative avec le numéro brut
                try {
                  await Linking.openURL(`tel:${phoneNumber}`);
                } catch (error) {
                  console.error('Erreur finale:', error);
                  Alert.alert('Erreur', 'Impossible d\'ouvrir l\'application téléphone');
                }
              }
            }
          ]
        );
      }
    } catch (error) {
      console.error('Erreur lors de l\'appel:', error);
      Alert.alert(
        'Erreur',
        'Impossible d\'ouvrir l\'application téléphone',
        [{ text: 'OK' }]
      );
    }
  };

  const handleWhatsAppPress = async (phoneNumber, teacherName) => {
    try {
      // Nettoyer le numéro de téléphone
      let formattedNumber = phoneNumber.replace(/\s+/g, '');
      
      // Ajouter le préfixe international si nécessaire
      if (formattedNumber.startsWith('0')) {
        formattedNumber = '33' + formattedNumber.substring(1);
      }

      // Construire l'URL WhatsApp
      const whatsappUrl = `whatsapp://send?phone=${formattedNumber}`;
      
      const canOpen = await Linking.canOpenURL(whatsappUrl);
      
      if (canOpen) {
        await Linking.openURL(whatsappUrl);
      } else {
        // Si WhatsApp n'est pas installé ou le contact n'existe pas
        Alert.alert(
          'Contact WhatsApp',
          'Que souhaitez-vous faire ?',
          [
            {
              text: 'Créer le contact',
              onPress: async () => {
                try {
                  // Préparer les données du contact
                  const contact = {
                    phoneNumbers: [{
                      number: phoneNumber,
                      label: 'mobile'
                    }],
                    displayName: teacherName
                  };

                  // Construire l'URL pour créer un contact
                  const contactUrl = Platform.select({
                    ios: `contacts://add?name=${encodeURIComponent(teacherName)}&phone=${encodeURIComponent(phoneNumber)}`,
                    android: 'content://contacts/people',
                    default: `https://wa.me/${formattedNumber}`
                  });

                  const canOpenContacts = await Linking.canOpenURL(contactUrl);
                  if (canOpenContacts) {
                    await Linking.openURL(contactUrl);
                  } else {
                    // Si on ne peut pas ouvrir les contacts, ouvrir WhatsApp Web
                    const webWhatsappUrl = `https://wa.me/${formattedNumber}`;
                    await Linking.openURL(webWhatsappUrl);
                  }
                } catch (error) {
                  console.error('Erreur lors de la création du contact:', error);
                  Alert.alert(
                    'Erreur',
                    'Impossible de créer le contact. Veuillez réessayer.',
                    [{ text: 'OK' }]
                  );
                }
              }
            },
            {
              text: 'Ouvrir WhatsApp Web',
              onPress: async () => {
                const webWhatsappUrl = `https://wa.me/${formattedNumber}`;
                await Linking.openURL(webWhatsappUrl);
              }
            },
            {
              text: 'Annuler',
              style: 'cancel'
            }
          ]
        );
      }
    } catch (error) {
      console.error('Erreur lors de l\'ouverture de WhatsApp:', error);
      Alert.alert(
        'Erreur',
        'Impossible d\'ouvrir WhatsApp',
        [{ text: 'OK' }]
      );
    }
  };

  const handleEmailPress = async (email, teacherName) => {
    try {
      // Construire l'URL mailto avec des paramètres
      const mailtoUrl = encodeURI(`mailto:${email}?subject=Contact - ${teacherName}&body=Bonjour ${teacherName},\n\n`);
      
      console.log('Tentative d\'ouverture de l\'email:', mailtoUrl);

      const canOpen = await Linking.canOpenURL(mailtoUrl);
      console.log('Peut ouvrir l\'URL?', canOpen);

      if (canOpen) {
        await Linking.openURL(mailtoUrl);
      } else {
        Alert.alert(
          'Information',
          `Adresse email : ${email}`,
          [
            { 
              text: 'Copier',
              onPress: () => {
                if (Platform.OS === 'web') {
                  navigator.clipboard.writeText(email);
                } else {
                  Alert.alert('Email copié', email);
                }
              }
            },
            { text: 'OK' }
          ]
        );
      }
    } catch (error) {
      console.error('Erreur lors de l\'ouverture de l\'email:', error);
      Alert.alert(
        'Information',
        `Adresse email : ${email}`,
        [{ text: 'OK' }]
      );
    }
  };

  const handleTelegramPress = async (phoneNumber, teacherName) => {
    try {
      if (!phoneNumber) {
        console.error('Numéro de téléphone manquant');
        Alert.alert(
          'Erreur',
          'Numéro de téléphone non disponible',
          [{ text: 'OK' }]
        );
        return;
      }

      console.log('Numéro de téléphone original:', phoneNumber);

      // Nettoyer le numéro de téléphone
      let formattedNumber = phoneNumber.replace(/\s+/g, '');
      console.log('Numéro sans espaces:', formattedNumber);
      
      // Ajouter le préfixe international si nécessaire
      if (formattedNumber.startsWith('0')) {
        formattedNumber = '33' + formattedNumber.substring(1);
        console.log('Numéro avec préfixe international:', formattedNumber);
      }

      // Préparer le message
      const message = encodeURIComponent(`Bonjour ${teacherName},\nJe vous contacte au sujet de...`);
      console.log('Message encodé:', message);

      // Construire l'URL Telegram avec le message
      const telegramUrl = `tg://msg?text=${message}`;
      console.log('URL Telegram:', telegramUrl);
      
      const canOpen = await Linking.canOpenURL(telegramUrl);
      console.log('Peut ouvrir Telegram?', canOpen);
      
      if (canOpen) {
        console.log('Tentative d\'ouverture de Telegram...');
        await Linking.openURL(telegramUrl);
      } else {
        console.log('Telegram non installé, tentative d\'ouverture dans le navigateur...');
        // Si Telegram n'est pas installé, ouvrir dans le navigateur
        const webTelegramUrl = `https://t.me/share/url?text=${message}`;
        console.log('URL Telegram Web:', webTelegramUrl);
        await Linking.openURL(webTelegramUrl);
      }
    } catch (error) {
      console.error('Erreur détaillée lors de l\'ouverture de Telegram:', error);
      console.error('Type d\'erreur:', error.name);
      console.error('Message d\'erreur:', error.message);
      console.error('Stack trace:', error.stack);
      
      Alert.alert(
        'Erreur',
        'Impossible d\'ouvrir Telegram. Erreur: ' + error.message,
        [{ text: 'OK' }]
      );
    }
  };

  const handleCreateContact = async (phoneNumber, teacherName) => {
    try {
      if (Platform.OS === 'android') {
        try {
          // URL pour ouvrir directement le formulaire de création de contact
          const url = `tel:${phoneNumber}`;
          await Linking.openURL(url);
          
          // Petit délai pour laisser l'application téléphone s'ouvrir
          setTimeout(() => {
            Alert.alert(
              'Créer un contact',
              'Appuyez sur l\'icône "Créer un nouveau contact" dans l\'application téléphone',
              [
                {
                  text: 'Copier le nom',
                  onPress: async () => {
                    await Clipboard.setString(teacherName);
                    Alert.alert('Copié', 'Le nom a été copié dans le presse-papiers');
                  }
                },
                {
                  text: 'Annuler',
                  style: 'cancel'
                }
              ]
            );
          }, 1000);
        } catch (error) {
          console.error('Erreur lors de l\'ouverture de l\'application téléphone:', error);
          Alert.alert(
            'Information',
            `Pour créer le contact manuellement:\n\nNom: ${teacherName}\nTéléphone: ${phoneNumber}`,
            [{ text: 'OK' }]
          );
        }
      } else if (Platform.OS === 'ios') {
        const contactUrl = `contacts://add?name=${encodeURIComponent(teacherName)}&phone=${encodeURIComponent(phoneNumber)}`;
        const canOpenContacts = await Linking.canOpenURL(contactUrl);
        if (canOpenContacts) {
          await Linking.openURL(contactUrl);
        } else {
          Alert.alert('Erreur', 'Impossible d\'ouvrir les contacts');
        }
      } else {
        Alert.alert(
          'Information',
          `Créez un contact pour:\n\nNom: ${teacherName}\nTéléphone: ${phoneNumber}`,
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Erreur lors de la création du contact:', error);
      Alert.alert(
        'Erreur',
        'Impossible de créer le contact. Veuillez réessayer.',
        [{ text: 'OK' }]
      );
    }
  };

  const handleTeacherPress = (teacher) => {
    navigation.navigate('TeacherPlanning', {
      school,
      teacher,
      title: `Planning de ${teacher.prenom} ${teacher.nom}`
    });
  };

  const renderTeacherItem = ({ item }) => {
    const isFavorite = favorites.has(item._id || item.id);
    const teacherName = `${item.prenom} ${item.nom}`;
    
    return (
      <View style={styles.teacherItem}>
        <View style={styles.teacherInfo}>
          <View style={styles.teacherHeader}>
            <TouchableOpacity 
              onPress={() => handleTeacherPress(item)}
              style={styles.teacherNameContainer}
            >
              <Text style={styles.teacherName}>
                {teacherName}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => toggleFavorite(item._id || item.id)}
              style={styles.favoriteButton}
            >
              <MaterialIcons
                name={isFavorite ? "star" : "star-border"}
                size={24}
                color={isFavorite ? "#FFD700" : "#666666"}
              />
            </TouchableOpacity>
          </View>
          <View style={styles.teacherDetails}>
            {item.matiere && (
              <View style={styles.detailRow}>
                <MaterialIcons name="school" size={16} color="#666666" />
                <Text style={styles.teacherSubject}>
                  {item.matiere}
                </Text>
              </View>
            )}
            {item.email && (
              <TouchableOpacity 
                style={[styles.detailRow, styles.emailContainer]}
                onPress={() => handleEmailPress(item.email, teacherName)}
              >
                <MaterialIcons name="email" size={16} color="#2196F3" />
                <Text style={[styles.teacherContact, styles.emailText]}>
                  {item.email}
                </Text>
              </TouchableOpacity>
            )}
            {item.telephone && (
              <View style={styles.contactContainer}>
                <View style={styles.phoneContainer}>
                  <MaterialIcons name="phone" size={16} color="#2196F3" />
                  <Text style={[styles.teacherContact, styles.phoneNumber]}>
                    {item.telephone}
                  </Text>
                </View>
                <View style={styles.socialButtons}>
                  <TouchableOpacity
                    style={styles.socialButton}
                    onPress={() => handleCreateContact(item.telephone, `${item.prenom} ${item.nom}`)}
                  >
                    <MaterialIcons name="person-add" size={28} color="#666666" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.socialButton}
                    onPress={() => handleWhatsAppPress(item.telephone, `${item.prenom} ${item.nom}`)}
                  >
                    <FontAwesome name="whatsapp" size={32} color="#25D366" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.socialButton}
                    onPress={() => handleTelegramPress(item.telephone, `${item.prenom} ${item.nom}`)}
                  >
                    <FontAwesome name="telegram" size={32} color="#0088cc" />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </View>
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Chargement des enseignants...</Text>
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

  return (
    <View style={styles.container}>
      {/* Indicateur offline */}
      {isOfflineMode && (
        <View style={styles.offlineIndicator}>
          <MaterialIcons name="wifi-off" size={16} color="#FF6B6B" />
          <Text style={styles.offlineText}>Mode hors ligne - Données en cache</Text>
        </View>
      )}
      
      <FlatList
        data={teachers}
        renderItem={renderTeacherItem}
        keyExtractor={(item) => item._id || item.id || `${item.nom}-${item.prenom}`}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialIcons name="person-outline" size={64} color="#CCCCCC" />
            <Text style={styles.emptyText}>Aucun enseignant trouvé</Text>
            <Text style={styles.emptySubtext}>Tirez vers le bas pour actualiser</Text>
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#2196F3']}
            tintColor="#2196F3"
          />
        }
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  offlineIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF3E0',
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#FFCC02',
  },
  offlineText: {
    fontSize: 12,
    color: '#E65100',
    marginLeft: 4,
    fontWeight: '600',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  listContent: {
    padding: 12,
  },
  teacherItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  teacherInfo: {
    flex: 1,
  },
  teacherHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
    paddingBottom: 8,
  },
  favoriteButton: {
    padding: 8,
    marginRight: -8,
  },
  teacherNameContainer: {
    flex: 1,
    marginRight: 8,
  },
  teacherName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1A1A1A',
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  teacherDetails: {
    marginTop: 0
  },
  contactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  phoneContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingVertical: 2,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  emailContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: -8 // Réduit l'espace sous l'email
  },
  teacherSubject: {
    fontSize: 15,
    color: '#666666',
    marginLeft: 8,
    flex: 1,
  },
  teacherContact: {
    fontSize: 15,
    color: '#2196F3',
    marginLeft: 8,
    flex: 1,
    marginBottom: 0,
    marginTop: 0,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    margin: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  emptyText: {
    fontSize: 18,
    color: '#666666',
    marginTop: 16,
    textAlign: 'center',
    fontWeight: '500',
  },
  emptySubtext: {
    fontSize: 15,
    color: '#999999',
    marginTop: 8,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 18,
    color: '#F44336',
    marginTop: 16,
    textAlign: 'center',
    fontWeight: '500',
  },
  errorSubtext: {
    fontSize: 15,
    color: '#666666',
    marginTop: 8,
    textAlign: 'center',
  },
  loadingText: {
    fontSize: 18,
    color: '#666666',
    marginTop: 16,
    textAlign: 'center',
    fontWeight: '500',
  },
  phoneNumber: {
    color: '#2196F3',
    fontWeight: '500',
    fontSize: 15,
    marginLeft: 8,
  },
  emailText: {
    color: '#2196F3',
    fontWeight: '500',
    fontSize: 15,
  },
  socialButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  socialButton: {
    borderRadius: 12,
    padding: 6,
    marginLeft: 8,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default TeacherListScreen; 