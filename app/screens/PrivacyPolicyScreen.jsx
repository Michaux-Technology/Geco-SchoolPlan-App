import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Share } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';

const PrivacyPolicyScreen = () => {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const [loading, setLoading] = useState(false);

  const handleExportData = async () => {
    setLoading(true);
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const allData = await AsyncStorage.multiGet(allKeys);
      
      const exportData = {
        exportDate: new Date().toISOString(),
        data: allData.reduce((acc, [key, value]) => {
          acc[key] = value;
          return acc;
        }, {})
      };

      const dataString = JSON.stringify(exportData, null, 2);
      
      await Share.share({
        message: `Export de mes données locales - ${new Date().toLocaleDateString()}\n\n${dataString}`,
        title: 'Export de données locales RGPD'
      });

      Alert.alert(t('common.success'), t('gdpr.exportDataSuccess'));
    } catch (error) {
      console.error('Erreur lors de l\'export:', error);
      Alert.alert(t('common.error'), 'Erreur lors de l\'export des données');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteData = async () => {
    Alert.alert(
      t('common.delete'),
      'Êtes-vous sûr de vouloir supprimer toutes vos données locales ? Cette action est irréversible.',
      [
        {
          text: t('common.cancel'),
          style: 'cancel',
        },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await AsyncStorage.clear();
              Alert.alert(t('common.success'), t('gdpr.deleteDataSuccess'));
              navigation.navigate('Home');
            } catch (error) {
              console.error('Erreur lors de la suppression:', error);
              Alert.alert(t('common.error'), 'Erreur lors de la suppression des données');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleDeleteAccount = async () => {
    Alert.alert(
      t('common.delete'),
      t('gdpr.deleteAccountConfirm'),
      [
        {
          text: t('common.cancel'),
          style: 'cancel',
        },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await AsyncStorage.clear();
              Alert.alert(t('common.success'), t('gdpr.deleteAccountSuccess'));
              navigation.navigate('Home');
            } catch (error) {
              console.error('Erreur lors de la suppression du compte:', error);
              Alert.alert(t('common.error'), 'Erreur lors de la suppression du compte');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const renderSection = (title, content, icon = null) => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        {icon && <MaterialIcons name={icon} size={20} color="#1976D2" style={styles.sectionIcon} />}
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <Text style={styles.sectionContent}>{content}</Text>
    </View>
  );

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <MaterialIcons name="privacy-tip" size={32} color="#1976D2" />
        <Text style={styles.headerTitle}>{t('gdpr.privacyPolicy')}</Text>
      </View>

      {renderSection(
        t('gdpr.dataCollected'),
        t('gdpr.dataCollectedList'),
        'data-usage'
      )}

      {renderSection(
        t('gdpr.dataPurpose'),
        t('gdpr.dataPurposeList'),
        'purpose'
      )}

      {renderSection(
        t('gdpr.dataRetentionPeriod'),
        t('gdpr.dataRetentionList'),
        'schedule'
      )}

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <MaterialIcons name="security" size={20} color="#1976D2" style={styles.sectionIcon} />
          <Text style={styles.sectionTitle}>{t('gdpr.userRights')}</Text>
        </View>
        
        <View style={styles.rightsList}>
          <Text style={styles.rightItem}>• {t('gdpr.rightAccess')}</Text>
          <Text style={styles.rightItem}>• {t('gdpr.rightRectification')}</Text>
          <Text style={styles.rightItem}>• {t('gdpr.rightErasure')}</Text>
          <Text style={styles.rightItem}>• {t('gdpr.rightPortability')}</Text>
        </View>
      </View>

      <View style={styles.actionsContainer}>
        <TouchableOpacity 
          style={[styles.actionButton, styles.exportButton]} 
          onPress={handleExportData}
          disabled={loading}
        >
          <MaterialIcons name="file-download" size={20} color="#FFFFFF" />
          <Text style={styles.actionButtonText}>{t('gdpr.exportData')}</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.actionButton, styles.deleteDataButton]} 
          onPress={handleDeleteData}
          disabled={loading}
        >
          <MaterialIcons name="delete-sweep" size={20} color="#FFFFFF" />
          <Text style={styles.actionButtonText}>{t('gdpr.deleteData')}</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.actionButton, styles.deleteAccountButton]} 
          onPress={handleDeleteAccount}
          disabled={loading}
        >
          <MaterialIcons name="person-remove" size={20} color="#FFFFFF" />
          <Text style={styles.actionButtonText}>{t('gdpr.deleteAccount')}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Pour toute question concernant vos données, contactez-nous à l'adresse suivante :
        </Text>
        <Text style={styles.contactEmail}>valery-jerome.michaux@michaux.link</Text>
        
        <View style={styles.noteContainer}>
          <MaterialIcons name="info" size={16} color="#FF9800" />
          <Text style={styles.noteText}>{t('gdpr.sharedCredentialsNote')}</Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1976D2',
    marginTop: 8,
  },
  section: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    padding: 16,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionIcon: {
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1976D2',
  },
  sectionContent: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
  },
  rightsList: {
    marginTop: 8,
  },
  rightItem: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 4,
  },
  actionsContainer: {
    padding: 16,
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    gap: 8,
  },
  exportButton: {
    backgroundColor: '#4CAF50',
  },
  deleteDataButton: {
    backgroundColor: '#FF9800',
  },
  deleteAccountButton: {
    backgroundColor: '#F44336',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 8,
  },
  contactEmail: {
    fontSize: 14,
    color: '#1976D2',
    fontWeight: '600',
  },
  noteContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 16,
    padding: 12,
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  noteText: {
    fontSize: 12,
    color: '#E65100',
    marginLeft: 8,
    flex: 1,
    lineHeight: 16,
  },
});

export default PrivacyPolicyScreen; 