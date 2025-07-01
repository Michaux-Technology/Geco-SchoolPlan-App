import AsyncStorage from '@react-native-async-storage/async-storage';

// Clés de stockage pour les données offline
const OFFLINE_KEYS = {
  PLANNING: 'offline_planning_',
  TIMESLOTS: 'offline_timeslots_',
  ANNOTATIONS: 'offline_annotations_',
  LAST_SYNC: 'offline_last_sync_',
  SCHOOL_DATA: 'offline_school_data_',
  CACHE_EXPIRY: 24 * 60 * 60 * 1000, // 24 heures en millisecondes
};

class OfflineStorage {
  // Sauvegarder les données de planning pour une école et une classe
  static async savePlanningData(schoolId, classeId, planningData, week, year) {
    try {
      const key = `${OFFLINE_KEYS.PLANNING}${schoolId}_${classeId}_${week}_${year}`;
      const data = {
        planning: planningData,
        timestamp: Date.now(),
        week,
        year,
        schoolId,
        classeId
      };
      
      await AsyncStorage.setItem(key, JSON.stringify(data));
      console.log(`✅ Données de planning sauvegardées offline: ${key}`);
      
      // Mettre à jour le timestamp de dernière synchronisation
      await this.updateLastSync(schoolId, classeId);
      
      return true;
    } catch (error) {
      console.error('❌ Erreur lors de la sauvegarde offline:', error);
      return false;
    }
  }

  // Récupérer les données de planning depuis le cache offline
  static async getPlanningData(schoolId, classeId, week, year) {
    try {
      const key = `${OFFLINE_KEYS.PLANNING}${schoolId}_${classeId}_${week}_${year}`;
      const data = await AsyncStorage.getItem(key);
      
      if (!data) {
        console.log(`📭 Aucune donnée offline trouvée pour: ${key}`);
        return null;
      }
      
      const parsedData = JSON.parse(data);
      const now = Date.now();
      const isExpired = (now - parsedData.timestamp) > OFFLINE_KEYS.CACHE_EXPIRY;
      
      if (isExpired) {
        console.log(`⏰ Données offline expirées pour: ${key}`);
        await AsyncStorage.removeItem(key);
        return null;
      }
      
      console.log(`📱 Données offline récupérées: ${key}`);
      return parsedData.planning;
    } catch (error) {
      console.error('❌ Erreur lors de la récupération offline:', error);
      return null;
    }
  }

  // Sauvegarder les créneaux horaires
  static async saveTimeSlots(schoolId, timeSlots) {
    try {
      const key = `${OFFLINE_KEYS.TIMESLOTS}${schoolId}`;
      const data = {
        timeSlots,
        timestamp: Date.now(),
        schoolId
      };
      
      await AsyncStorage.setItem(key, JSON.stringify(data));
      console.log(`✅ Créneaux horaires sauvegardés offline: ${key}`);
      return true;
    } catch (error) {
      console.error('❌ Erreur lors de la sauvegarde des créneaux horaires:', error);
      return false;
    }
  }

  // Récupérer les créneaux horaires depuis le cache
  static async getTimeSlots(schoolId) {
    try {
      const key = `${OFFLINE_KEYS.TIMESLOTS}${schoolId}`;
      const data = await AsyncStorage.getItem(key);
      
      if (!data) {
        return null;
      }
      
      const parsedData = JSON.parse(data);
      const now = Date.now();
      const isExpired = (now - parsedData.timestamp) > OFFLINE_KEYS.CACHE_EXPIRY;
      
      if (isExpired) {
        await AsyncStorage.removeItem(key);
        return null;
      }
      
      return parsedData.timeSlots;
    } catch (error) {
      console.error('❌ Erreur lors de la récupération des créneaux horaires:', error);
      return null;
    }
  }

  // Sauvegarder les annotations
  static async saveAnnotations(schoolId, classeId, week, year, annotations) {
    try {
      const key = `${OFFLINE_KEYS.ANNOTATIONS}${schoolId}_${classeId}_${week}_${year}`;
      const data = {
        annotations,
        timestamp: Date.now(),
        week,
        year,
        schoolId,
        classeId
      };
      
      await AsyncStorage.setItem(key, JSON.stringify(data));
      console.log(`✅ Annotations sauvegardées offline: ${key}`);
      return true;
    } catch (error) {
      console.error('❌ Erreur lors de la sauvegarde des annotations:', error);
      return false;
    }
  }

  // Récupérer les annotations depuis le cache
  static async getAnnotations(schoolId, classeId, week, year) {
    try {
      const key = `${OFFLINE_KEYS.ANNOTATIONS}${schoolId}_${classeId}_${week}_${year}`;
      const data = await AsyncStorage.getItem(key);
      
      if (!data) {
        return null;
      }
      
      const parsedData = JSON.parse(data);
      const now = Date.now();
      const isExpired = (now - parsedData.timestamp) > OFFLINE_KEYS.CACHE_EXPIRY;
      
      if (isExpired) {
        await AsyncStorage.removeItem(key);
        return null;
      }
      
      return parsedData.annotations;
    } catch (error) {
      console.error('❌ Erreur lors de la récupération des annotations:', error);
      return null;
    }
  }

  // Mettre à jour le timestamp de dernière synchronisation
  static async updateLastSync(schoolId, classeId) {
    try {
      const key = `${OFFLINE_KEYS.LAST_SYNC}${schoolId}_${classeId}`;
      await AsyncStorage.setItem(key, Date.now().toString());
    } catch (error) {
      console.error('❌ Erreur lors de la mise à jour du timestamp:', error);
    }
  }

  // Vérifier si des données offline sont disponibles
  static async hasOfflineData(schoolId, classeId, week, year) {
    try {
      const planningKey = `${OFFLINE_KEYS.PLANNING}${schoolId}_${classeId}_${week}_${year}`;
      const planningData = await AsyncStorage.getItem(planningKey);
      
      if (!planningData) {
        return false;
      }
      
      const parsedData = JSON.parse(planningData);
      const now = Date.now();
      const isExpired = (now - parsedData.timestamp) > OFFLINE_KEYS.CACHE_EXPIRY;
      
      return !isExpired;
    } catch (error) {
      console.error('❌ Erreur lors de la vérification des données offline:', error);
      return false;
    }
  }

  // Nettoyer les données expirées
  static async cleanupExpiredData() {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const offlineKeys = keys.filter(key => 
        key.startsWith(OFFLINE_KEYS.PLANNING) ||
        key.startsWith(OFFLINE_KEYS.TIMESLOTS) ||
        key.startsWith(OFFLINE_KEYS.ANNOTATIONS)
      );
      
      const now = Date.now();
      const keysToRemove = [];
      
      for (const key of offlineKeys) {
        try {
          const data = await AsyncStorage.getItem(key);
          if (data) {
            const parsedData = JSON.parse(data);
            if ((now - parsedData.timestamp) > OFFLINE_KEYS.CACHE_EXPIRY) {
              keysToRemove.push(key);
            }
          }
        } catch (error) {
          // Si les données sont corrompues, les supprimer
          keysToRemove.push(key);
        }
      }
      
      if (keysToRemove.length > 0) {
        await AsyncStorage.multiRemove(keysToRemove);
        console.log(`🧹 ${keysToRemove.length} entrées expirées supprimées`);
      }
    } catch (error) {
      console.error('❌ Erreur lors du nettoyage des données expirées:', error);
    }
  }

  // Obtenir la taille du cache offline
  static async getCacheSize() {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const offlineKeys = keys.filter(key => 
        key.startsWith(OFFLINE_KEYS.PLANNING) ||
        key.startsWith(OFFLINE_KEYS.TIMESLOTS) ||
        key.startsWith(OFFLINE_KEYS.ANNOTATIONS)
      );
      
      let totalSize = 0;
      for (const key of offlineKeys) {
        const data = await AsyncStorage.getItem(key);
        if (data) {
          totalSize += data.length;
        }
      }
      
      return {
        entries: offlineKeys.length,
        sizeInBytes: totalSize,
        sizeInMB: (totalSize / (1024 * 1024)).toFixed(2)
      };
    } catch (error) {
      console.error('❌ Erreur lors du calcul de la taille du cache:', error);
      return { entries: 0, sizeInBytes: 0, sizeInMB: '0.00' };
    }
  }

  // Vider complètement le cache offline
  static async clearAllOfflineData() {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const offlineKeys = keys.filter(key => 
        key.startsWith(OFFLINE_KEYS.PLANNING) ||
        key.startsWith(OFFLINE_KEYS.TIMESLOTS) ||
        key.startsWith(OFFLINE_KEYS.ANNOTATIONS) ||
        key.startsWith(OFFLINE_KEYS.LAST_SYNC)
      );
      
      if (offlineKeys.length > 0) {
        await AsyncStorage.multiRemove(offlineKeys);
        console.log(`🗑️ ${offlineKeys.length} entrées offline supprimées`);
      }
      
      return true;
    } catch (error) {
      console.error('❌ Erreur lors de la suppression des données offline:', error);
      return false;
    }
  }
}

export default OfflineStorage; 