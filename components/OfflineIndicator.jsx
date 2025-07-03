import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import useNetworkStatus from '../hooks/useNetworkStatus';
import OfflineStorage from '../utils/offlineStorage';

const OfflineIndicator = ({ schoolId, classeId, onSyncPress, lastSyncTime }) => {
  const { t } = useTranslation();
  const { isOnline, connectionType } = useNetworkStatus();

  const handleSyncPress = async () => {
    if (!isOnline) {
      Alert.alert(
        t('offline.noConnection'),
        t('offline.noConnectionMessage'),
        [{ text: t('common.ok'), style: 'default' }]
      );
      return;
    }

    if (onSyncPress) {
      onSyncPress();
    }
  };

  const formatLastSync = (timestamp) => {
    if (!timestamp) return t('offline.neverSynced');
    
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor((now - date) / (1000 * 60));
    
    if (diffInMinutes < 1) return t('offline.justNow');
    if (diffInMinutes < 60) return t('offline.minutesAgo', { minutes: diffInMinutes });
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return t('offline.hoursAgo', { hours: diffInHours });
    
    const diffInDays = Math.floor(diffInHours / 24);
    return t('offline.daysAgo', { days: diffInDays });
  };

  const getConnectionIcon = () => {
    if (!isOnline) return 'wifi-off';
    if (connectionType === 'wifi') return 'wifi';
    if (connectionType === 'cellular') return 'cell-tower';
    return 'wifi';
  };

  const getConnectionColor = () => {
    if (!isOnline) return '#FF6B6B';
    if (connectionType === 'wifi') return '#4CAF50';
    if (connectionType === 'cellular') return '#2196F3';
    return '#4CAF50';
  };

  return (
    <View style={styles.container}>
      {/* Indicateur de connexion */}
      <View style={styles.connectionIndicator}>
        <MaterialIcons 
          name={getConnectionIcon()} 
          size={16} 
          color={getConnectionColor()} 
        />
        <Text style={[styles.connectionText, { color: getConnectionColor() }]}>
          {isOnline ? t('offline.online') : t('offline.offline')}
        </Text>
      </View>

      {/* Informations de synchronisation */}
      <View style={styles.syncInfo}>
        <Text style={styles.lastSyncText}>
          {t('offline.lastSync')}: {formatLastSync(lastSyncTime)}
        </Text>
        
        <TouchableOpacity 
          style={[styles.syncButton, !isOnline && styles.syncButtonDisabled]} 
          onPress={handleSyncPress}
          disabled={!isOnline}
        >
          <MaterialIcons 
            name="sync" 
            size={16} 
            color={isOnline ? '#007AFF' : '#999999'} 
          />
          <Text style={[styles.syncButtonText, !isOnline && styles.syncButtonTextDisabled]}>
            {t('offline.sync')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Message offline si nécessaire */}
      {!isOnline && (
        <View style={styles.offlineMessage}>
          <MaterialIcons name="info" size={14} color="#FF9800" />
          <Text style={styles.offlineMessageText}>
            {t('offline.offlineMessage')}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F8F9FA',
    borderTopWidth: 1,
    borderTopColor: '#E9ECEF',
    padding: 8,
    paddingBottom: 20, // Réduit pour les APK
  },
  connectionIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  connectionText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  syncInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastSyncText: {
    fontSize: 11,
    color: '#666666',
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: '#F0F8FF',
  },
  syncButtonDisabled: {
    backgroundColor: '#F5F5F5',
  },
  syncButtonText: {
    fontSize: 11,
    color: '#007AFF',
    fontWeight: '600',
    marginLeft: 4,
  },
  syncButtonTextDisabled: {
    color: '#999999',
  },
  offlineMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    padding: 8,
    backgroundColor: '#FFF3E0',
    borderRadius: 4,
  },
  offlineMessageText: {
    fontSize: 11,
    color: '#E65100',
    marginLeft: 4,
    flex: 1,
  },
});

export default OfflineIndicator; 