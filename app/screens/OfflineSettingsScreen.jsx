import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import OfflineStorage from '../../utils/offlineStorage';

const OfflineSettingsScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const [cacheSize, setCacheSize] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isClearing, setIsClearing] = useState(false);

  useEffect(() => {
    loadCacheInfo();
  }, []);

  const loadCacheInfo = async () => {
    try {
      setIsLoading(true);
      const size = await OfflineStorage.getCacheSize();
      setCacheSize(size);
    } catch (error) {
      console.error('Erreur lors du chargement des informations du cache:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearCache = async () => {
    Alert.alert(
      t('offline.clearCacheConfirm'),
      t('offline.clearCacheMessage'),
      [
        {
          text: t('common.cancel'),
          style: 'cancel',
        },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              setIsClearing(true);
              await OfflineStorage.clearAllOfflineData();
              await loadCacheInfo();
              Alert.alert(t('common.success'), t('offline.cacheCleared'));
            } catch (error) {
              console.error('Erreur lors du vidage du cache:', error);
              Alert.alert(t('common.error'), t('errors.unknownError'));
            } finally {
              setIsClearing(false);
            }
          },
        },
      ]
    );
  };

  const handleCleanupExpired = async () => {
    try {
      setIsClearing(true);
      await OfflineStorage.cleanupExpiredData();
      await loadCacheInfo();
      Alert.alert(t('common.success'), 'Données expirées supprimées');
    } catch (error) {
      console.error('Erreur lors du nettoyage:', error);
      Alert.alert(t('common.error'), t('errors.unknownError'));
    } finally {
      setIsClearing(false);
    }
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>{t('common.loading')}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <MaterialIcons name="storage" size={48} color="#2196F3" />
        <Text style={styles.title}>{t('offline.cacheSize')}</Text>
      </View>

      {/* Informations sur le cache */}
      <View style={styles.infoCard}>
        <View style={styles.infoRow}>
          <MaterialIcons name="info" size={20} color="#666666" />
          <Text style={styles.infoText}>
            {cacheSize?.entries || 0} entrées en cache
          </Text>
        </View>
        <View style={styles.infoRow}>
          <MaterialIcons name="storage" size={20} color="#666666" />
          <Text style={styles.infoText}>
            Taille: {formatBytes(cacheSize?.sizeInBytes || 0)}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <MaterialIcons name="schedule" size={20} color="#666666" />
          <Text style={styles.infoText}>
            Expiration: 24 heures
          </Text>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={[styles.actionButton, styles.cleanupButton]}
          onPress={handleCleanupExpired}
          disabled={isClearing}
        >
          <MaterialIcons name="cleaning-services" size={24} color="#FF9800" />
          <Text style={[styles.actionButtonText, styles.cleanupButtonText]}>
            Nettoyer les données expirées
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.clearButton]}
          onPress={handleClearCache}
          disabled={isClearing}
        >
          <MaterialIcons name="delete-forever" size={24} color="#F44336" />
          <Text style={[styles.actionButtonText, styles.clearButtonText]}>
            {t('offline.clearCache')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.refreshButton]}
          onPress={loadCacheInfo}
          disabled={isClearing}
        >
          <MaterialIcons name="refresh" size={24} color="#2196F3" />
          <Text style={[styles.actionButtonText, styles.refreshButtonText]}>
            Actualiser
          </Text>
        </TouchableOpacity>
      </View>

      {/* Informations sur le mode offline */}
      <View style={styles.infoSection}>
        <Text style={styles.sectionTitle}>Mode hors ligne</Text>
        <Text style={styles.sectionText}>
          L'application sauvegarde automatiquement les données de planning pour permettre 
          la consultation même sans connexion internet. Les données sont conservées pendant 
          24 heures et sont automatiquement mises à jour lors de la prochaine connexion.
        </Text>
      </View>

      {isClearing && (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.overlayText}>Traitement en cours...</Text>
        </View>
      )}
    </ScrollView>
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
    backgroundColor: '#F5F5F5',
  },
  loadingText: {
    fontSize: 16,
    color: '#666666',
    marginTop: 16,
  },
  header: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1976D2',
    marginTop: 12,
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 16,
    color: '#333333',
    marginLeft: 12,
  },
  actionsContainer: {
    padding: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cleanupButton: {
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  clearButton: {
    borderLeftWidth: 4,
    borderLeftColor: '#F44336',
  },
  refreshButton: {
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 12,
  },
  cleanupButtonText: {
    color: '#FF9800',
  },
  clearButtonText: {
    color: '#F44336',
  },
  refreshButtonText: {
    color: '#2196F3',
  },
  infoSection: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1976D2',
    marginBottom: 12,
  },
  sectionText: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayText: {
    fontSize: 16,
    color: '#666666',
    marginTop: 12,
  },
});

export default OfflineSettingsScreen; 