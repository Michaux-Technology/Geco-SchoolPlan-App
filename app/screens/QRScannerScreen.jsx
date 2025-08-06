import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Dimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { CameraView, Camera } from 'expo-camera';
import NetInfo from '@react-native-community/netinfo';
import { decryptData, isEncrypted } from '../../utils/encryption';
import { useTranslation } from 'react-i18next';

export default function QRScannerScreen() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasPermission, setHasPermission] = useState(null);
  const [scanned, setScanned] = useState(false);
  const navigation = useNavigation();
  const { t } = useTranslation();

  const requestCameraPermission = async () => {
    try {
      // Essayer d'abord avec Camera (ancienne API)
      const { status } = await Camera.requestCameraPermissionsAsync();
      console.log('Status permission (Camera):', status);
      setHasPermission(status === 'granted');
    } catch (error) {
      console.error('Erreur permission caméra (Camera):', error);
      try {
        // Essayer avec CameraView (nouvelle API)
        const { status } = await CameraView.requestCameraPermissionsAsync();
        console.log('Status permission (CameraView):', status);
        setHasPermission(status === 'granted');
      } catch (error2) {
        console.error('Erreur permission caméra (CameraView):', error2);
        setHasPermission(false);
      }
    }
  };

  useEffect(() => {
    requestCameraPermission();
  }, []);

  const handleBarCodeScanned = async ({ type, data }) => {
    if (isProcessing || scanned) return;
    
    setScanned(true);
    setIsProcessing(true);
    
    try {
      console.log('🔍 QR code détecté:', data);
      
      // Vérifier si les données sont cryptées
      let parsedData;
      let isDataEncrypted = false;
      
      // Essayer de détecter si les données sont cryptées
      if (isEncrypted(data)) {
        console.log('🔐 Données cryptées détectées, tentative de décryptage...');
        parsedData = decryptData(data);
        isDataEncrypted = true;
        console.log('🔓 QR code décrypté avec succès:', parsedData);
      } else {
        // Données non cryptées, parser directement
        try {
          parsedData = JSON.parse(data);
          console.log('📄 QR code parsé avec succès (non crypté):', parsedData);
        } catch (parseError) {
          console.error('❌ Erreur parsing JSON:', parseError);
          // Essayer le décryptage même si isEncrypted a retourné false
          try {
            console.log('🔄 Tentative de décryptage après erreur JSON...');
            parsedData = decryptData(data);
            isDataEncrypted = true;
            console.log('🔓 QR code décrypté avec succès après retry:', parsedData);
          } catch (decryptError) {
            console.error('❌ Échec du décryptage:', decryptError);
            Alert.alert(t('common.error'), t('qr.invalidQRCode'));
            setIsProcessing(false);
            setScanned(false);
            return;
          }
        }
      }

      // Normaliser les clés (accepter name/apiUrl ou schoolName/backend)
      const normalizedData = {
        name: parsedData.name || parsedData.schoolName,
        apiUrl: parsedData.apiUrl || parsedData.backend,
        username: parsedData.username,
        password: parsedData.password
      };
      
      console.log('Données normalisées:', normalizedData);
      console.log('🔐 Données cryptées:', isDataEncrypted ? 'Oui' : 'Non');
      
      // Vérifier que toutes les données requises sont présentes
      if (!normalizedData.name || !normalizedData.apiUrl || !normalizedData.username || !normalizedData.password) {
        Alert.alert(t('common.error'), t('qr.missingData'));
        setIsProcessing(false);
        setScanned(false);
        return;
      }

      // Tenter de se connecter à l'API
      const netInfo = await NetInfo.fetch();
      console.log('État réseau:', netInfo);
      
      if (!netInfo.isConnected) {
        throw new Error('Pas de connexion réseau');
      }

      // S'assurer que l'URL se termine par un slash
      const baseUrl = normalizedData.apiUrl.endsWith('/') ? normalizedData.apiUrl : `${normalizedData.apiUrl}/`;
      const loginUrl = `${baseUrl}api/mobile/login`;
      
      console.log('Tentative de connexion à:', loginUrl);
      const requestBody = {
        username: normalizedData.username,
        password: normalizedData.password,
      };
      
      console.log('Données envoyées:', requestBody);

      // Créer un AbortController pour le timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 secondes

      const response = await fetch(loginUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'GecoSchoolPlan/1.0',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      console.log('Réponse reçue:', response.status, response.statusText);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const loginData = await response.json();
      console.log('Données de login reçues:', loginData);
      
      // Vérifier si on a un token (succès)
      if (loginData.token) {
        // Sauvegarder l'école avec l'URL normalisée (avec slash final)
        const newSchool = {
          id: Date.now().toString(),
          name: normalizedData.name,
          apiUrl: baseUrl,
          username: normalizedData.username,
          password: normalizedData.password,
          role: loginData.user?.role || 'user',
          token: loginData.token,
          refreshToken: loginData.refreshToken,
          createdViaQR: true // Marqueur pour identifier les écoles créées via QR
        };

        console.log('🔍 École créée via QR scanner:', {
          id: newSchool.id,
          name: newSchool.name,
          apiUrl: newSchool.apiUrl,
          username: newSchool.username,
          role: newSchool.role,
          hasToken: !!newSchool.token,
          hasRefreshToken: !!newSchool.refreshToken
        });

        // Récupérer les écoles existantes
        const existingSchools = await AsyncStorage.getItem('schools');
        const schools = existingSchools ? JSON.parse(existingSchools) : [];
        
        // Vérifier si l'école existe déjà
        const schoolExists = schools.some(school => 
          school.name === newSchool.name && school.apiUrl === newSchool.apiUrl
        );

        if (schoolExists) {
          Alert.alert(t('common.error'), t('qr.schoolAlreadyExists'));
          setIsProcessing(false);
          setScanned(false);
          return;
        }

        // Ajouter la nouvelle école
        schools.push(newSchool);
        await AsyncStorage.setItem('schools', JSON.stringify(schools));
        await AsyncStorage.setItem(`school_${newSchool.id}`, JSON.stringify(newSchool));

        Alert.alert(
          t('common.success'), 
          t('qr.schoolAddedSuccessfully', { name: normalizedData.name }),
          [
            {
              text: t('common.ok'),
              onPress: () => navigation.goBack()
            }
          ]
        );
      } else {
        Alert.alert(t('common.error'), loginData.message || t('qr.invalidCredentials'));
        setScanned(false);
      }
    } catch (error) {
      console.error('Erreur lors de l\'ajout de l\'école:', error);
      
      let errorMessage = t('qr.networkError');
      
      if (error.name === 'AbortError') {
        errorMessage = t('qr.timeoutError');
      } else if (error.message.includes('Network request failed')) {
        errorMessage = t('qr.connectionError');
      } else if (error.message.includes('HTTP')) {
        errorMessage = t('qr.httpError', { message: error.message });
      }
      
      Alert.alert(t('qr.networkErrorTitle'), errorMessage);
      setScanned(false);
    } finally {
      setIsProcessing(false);
    }
  };

  if (hasPermission === null) {
    return (
      <View style={styles.center}>
        <Text style={styles.permissionText}>{t('qr.requestingPermission')}</Text>
        <TouchableOpacity 
          style={styles.retryButton} 
          onPress={() => {
            setHasPermission(null);
            requestCameraPermission();
          }}
        >
          <Text style={styles.retryButtonText}>{t('qr.retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.center}>
        <Text style={styles.permissionText}>{t('qr.noCameraPermission')}</Text>
        <Text style={styles.permissionSubtext}>
          {t('qr.cameraPermissionInstructions')}
        </Text>
        <TouchableOpacity 
          style={styles.retryButton} 
          onPress={() => {
            setHasPermission(null);
            requestCameraPermission();
          }}
        >
          <Text style={styles.retryButtonText}>{t('qr.retry')}</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.retryButton, { marginTop: 10, backgroundColor: '#666' }]} 
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.retryButtonText}>{t('qr.back')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        facing="back"
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
      >
        <View style={styles.overlay}>
          <View style={styles.header}>
            <Text style={styles.title}>{t('qr.scanQRCode')}</Text>
            <Text style={styles.subtitle}>{t('qr.scanInstructions')}</Text>
          </View>
          
          {isProcessing && (
            <View style={styles.processingContainer}>
              <Text style={styles.processingText}>{t('qr.processing')}</Text>
            </View>
          )}
        </View>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  permissionText: {
    fontSize: 18,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 20,
  },
  permissionSubtext: {
    fontSize: 14,
    color: '#999999',
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  retryButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  header: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 20,
    borderRadius: 10,
    margin: 20,
    marginTop: 60,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  processingContainer: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.8)',
    padding: 15,
    borderRadius: 8,
  },
  processingText: {
    color: '#FFFFFF',
    fontSize: 16,
    textAlign: 'center',
    fontWeight: '600',
  },
  camera: {
    flex: 1,
  },
}); 