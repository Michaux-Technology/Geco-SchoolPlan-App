import AsyncStorage from '@react-native-async-storage/async-storage';
import OfflineStorage from './offlineStorage';

class ApiService {
  static async makeRequest(school, endpoint, options = {}) {
    try {
      // Vérifier la connectivité réseau
      const isOnline = await this.checkConnectivity(school.apiUrl);
      
      if (!isOnline) {
        console.log('📱 Pas de connectivité - tentative de récupération depuis le cache');
        const cachedData = await this.getFromCache(school, endpoint);
        if (cachedData.success) {
          return cachedData;
        } else {
          throw new Error('Aucune donnée disponible en mode hors ligne');
        }
      }

      // Mode en ligne - Faire la requête au serveur
      console.log('🌐 Tentative de requête en ligne vers:', endpoint);
      const response = await this.makeServerRequest(school, endpoint, options);
      
      // Sauvegarder en cache si la requête réussit
      if (response.success && response.data) {
        await this.saveToCache(school, endpoint, response.data);
        console.log('💾 Données sauvegardées en cache');
      }
      
      return response;
    } catch (error) {
      console.error('❌ Erreur API:', error);
      
      // En cas d'erreur, essayer de récupérer depuis le cache
      console.log('🔄 Tentative de récupération depuis le cache après erreur');
      const cachedData = await this.getFromCache(school, endpoint);
      if (cachedData.success) {
        console.log('✅ Récupération depuis le cache réussie');
        return cachedData;
      }
      
      throw error;
    }
  }

  static async checkConnectivity(apiUrl) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // Augmenté à 8 secondes
      
      // Essayer d'abord l'endpoint status, puis l'endpoint login comme fallback
      const endpoints = [
        `${apiUrl}api/mobile/status`,
        `${apiUrl}api/mobile/login`
      ];
      
      for (const endpoint of endpoints) {
        try {
          console.log('🔍 Test de connectivité vers:', endpoint);
          const response = await fetch(endpoint, {
            method: 'GET',
            signal: controller.signal,
            headers: {
              'Content-Type': 'application/json',
            },
          });
          
          clearTimeout(timeoutId);
          
          if (response.ok || response.status === 400 || response.status === 401) {
            // Le serveur répond (même avec une erreur 400/401, cela signifie qu'il est accessible)
            console.log('✅ Connectivité confirmée vers:', endpoint);
            return true;
          }
        } catch (endpointError) {
          console.log('⚠️ Échec de connectivité vers:', endpoint, endpointError.message);
          continue; // Essayer le prochain endpoint
        }
      }
      
      console.log('❌ Aucun endpoint accessible');
      return false;
    } catch (error) {
      console.log('❌ Erreur de connectivité:', error.message);
      return false;
    }
  }

  static async makeServerRequest(school, endpoint, options = {}) {
    const baseUrl = school.apiUrl.endsWith('/') ? school.apiUrl.slice(0, -1) : school.apiUrl;
    const apiUrl = `${baseUrl}${endpoint}`;
    
    const defaultHeaders = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    };

    if (school.token) {
      defaultHeaders['Authorization'] = `Bearer ${school.token}`;
    }

    const requestOptions = {
      method: options.method || 'GET',
      headers: { ...defaultHeaders, ...options.headers },
      ...options,
    };

    if (options.body) {
      requestOptions.body = JSON.stringify(options.body);
    }

    // Ajouter un timeout pour la requête
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 secondes de timeout
    
    try {
      console.log('🌐 Requête vers:', apiUrl);
      const response = await fetch(apiUrl, {
        ...requestOptions,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.log('❌ Erreur serveur:', response.status, errorText);
        throw new Error(`Erreur ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log('✅ Requête réussie vers:', endpoint);
      return { success: true, data, fromCache: false };
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        console.log('⏰ Timeout de la requête vers:', endpoint);
        throw new Error('Délai d\'attente dépassé. Vérifiez votre connexion internet.');
      }
      console.log('❌ Erreur de requête vers:', endpoint, error.message);
      throw error;
    }
  }

  static async getFromCache(school, endpoint) {
    try {
      const cacheKey = `api_cache_${school.id}_${endpoint.replace(/[^a-zA-Z0-9]/g, '_')}`;
      const cachedData = await AsyncStorage.getItem(cacheKey);
      
      if (!cachedData) {
        return { success: false, error: 'Aucune donnée en cache' };
      }

      const parsedData = JSON.parse(cachedData);
      const now = Date.now();
      const isExpired = (now - parsedData.timestamp) > (24 * 60 * 60 * 1000); // 24 heures

      if (isExpired) {
        await AsyncStorage.removeItem(cacheKey);
        return { success: false, error: 'Données en cache expirées' };
      }

      return { success: true, data: parsedData.data, fromCache: true };
    } catch (error) {
      console.error('❌ Erreur lors de la récupération du cache:', error);
      return { success: false, error: error.message };
    }
  }

  static async saveToCache(school, endpoint, data) {
    try {
      const cacheKey = `api_cache_${school.id}_${endpoint.replace(/[^a-zA-Z0-9]/g, '_')}`;
      const cacheData = {
        data,
        timestamp: Date.now(),
        endpoint,
        schoolId: school.id
      };
      
      await AsyncStorage.setItem(cacheKey, JSON.stringify(cacheData));
    } catch (error) {
      console.error('❌ Erreur lors de la sauvegarde en cache:', error);
    }
  }

  static async refreshToken(school) {
    try {
      if (!school.refreshToken) {
        throw new Error('Refresh token manquant');
      }

      const baseUrl = school.apiUrl.endsWith('/') ? school.apiUrl.slice(0, -1) : school.apiUrl;
      const refreshUrl = `${baseUrl}/api/mobile/refresh-token`;

      const response = await fetch(refreshUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken: school.refreshToken }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Échec du rafraîchissement: ${errorText}`);
      }

      const data = await response.json();
      
      if (!data.token) {
        throw new Error('Token manquant dans la réponse');
      }

      // Mettre à jour le token dans les données de l'école
      const updatedSchool = {
        ...school,
        token: data.token
      };

      // Sauvegarder les nouvelles données
      await AsyncStorage.setItem(`school_${school.id}`, JSON.stringify(updatedSchool));
      console.log('✅ Token rafraîchi avec succès');

      return data.token;
    } catch (error) {
      console.error('❌ Erreur lors du rafraîchissement du token:', error);
      throw error;
    }
  }

  static async clearCache(schoolId = null) {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = schoolId 
        ? keys.filter(key => key.startsWith(`api_cache_${schoolId}`))
        : keys.filter(key => key.startsWith('api_cache_'));
      
      if (cacheKeys.length > 0) {
        await AsyncStorage.multiRemove(cacheKeys);
        console.log(`🧹 ${cacheKeys.length} entrées de cache supprimées`);
      }
    } catch (error) {
      console.error('❌ Erreur lors du nettoyage du cache:', error);
    }
  }

  static async getCacheInfo(schoolId = null) {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = schoolId 
        ? keys.filter(key => key.startsWith(`api_cache_${schoolId}`))
        : keys.filter(key => key.startsWith('api_cache_'));
      
      let totalSize = 0;
      for (const key of cacheKeys) {
        const data = await AsyncStorage.getItem(key);
        if (data) {
          totalSize += data.length;
        }
      }
      
      return {
        entries: cacheKeys.length,
        sizeInBytes: totalSize,
        sizeInMB: (totalSize / (1024 * 1024)).toFixed(2)
      };
    } catch (error) {
      console.error('❌ Erreur lors du calcul de la taille du cache:', error);
      return { entries: 0, sizeInBytes: 0, sizeInMB: '0.00' };
    }
  }
}

export default ApiService; 