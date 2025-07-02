import AsyncStorage from '@react-native-async-storage/async-storage';
import OfflineStorage from './offlineStorage';

class ApiService {
  static async makeRequest(school, endpoint, options = {}) {
    try {
      // Vérifier la connectivité réseau
      const isOnline = await this.checkConnectivity(school.apiUrl);
      
      if (!isOnline) {
        const cachedData = await this.getFromCache(school, endpoint);
        if (cachedData.success) {
          return cachedData;
        } else {
          throw new Error('Aucune donnée disponible en mode hors ligne');
        }
      }

      // Mode en ligne - Faire la requête au serveur
      const response = await this.makeServerRequest(school, endpoint, options);
      
      // Sauvegarder en cache si la requête réussit
      if (response.success && response.data) {
        await this.saveToCache(school, endpoint, response.data);
      }
      
      return response;
    } catch (error) {
      console.error('❌ Erreur API:', error);
      
      // En cas d'erreur, essayer de récupérer depuis le cache
      const cachedData = await this.getFromCache(school, endpoint);
      if (cachedData.success) {
        return cachedData;
      }
      
      throw error;
    }
  }

  static async checkConnectivity(apiUrl) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      
      // Essayer d'abord l'endpoint status, puis l'endpoint login comme fallback
      const endpoints = [
        `${apiUrl}api/mobile/status`,
        `${apiUrl}api/mobile/login`
      ];
      
      for (const endpoint of endpoints) {
        try {
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
            return true;
          }
        } catch (endpointError) {
          continue; // Essayer le prochain endpoint
        }
      }
      
      return false;
    } catch (error) {
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



    const response = await fetch(apiUrl, requestOptions);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erreur ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    return { success: true, data, fromCache: false };
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