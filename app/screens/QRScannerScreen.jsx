import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Dimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { CameraView, Camera } from 'expo-camera';
import NetInfo from '@react-native-community/netinfo';

export default function QRScannerScreen() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasPermission, setHasPermission] = useState(null);
  const [scanned, setScanned] = useState(false);
  const navigation = useNavigation();

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
      // Normaliser les données QR (accepter différents formats)
      let parsedData;
                      try {
          parsedData = JSON.parse(data);
          console.log('QR code parsé avec succès:', parsedData);
          
          // Normaliser les clés (accepter name/apiUrl ou schoolName/backend)
          const normalizedData = {
            name: parsedData.name || parsedData.schoolName,
            apiUrl: parsedData.apiUrl || parsedData.backend,
            username: parsedData.username,
            password: parsedData.password
          };
          
          console.log('Données normalisées:', normalizedData);
          
          // Comparer avec l'ajout manuel
          console.log('=== COMPARAISON ===');
          console.log('QR Code URL:', normalizedData.apiUrl);
          console.log('QR Code Username:', normalizedData.username);
          console.log('QR Code Password:', normalizedData.password);
          
          // Vérifier que toutes les données requises sont présentes
          if (!normalizedData.name || !normalizedData.apiUrl || !normalizedData.username || !normalizedData.password) {
            Alert.alert('Erreur', 'Données manquantes dans le QR code');
            setIsProcessing(false);
            setScanned(false);
            return;
          }

          // Tenter de se connecter à l'API
          try {
            // Vérifier la connectivité réseau
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
          username: normalizedData.username, // Utiliser le même format que l'ajout manuel
          password: normalizedData.password,
        };
        
        console.log('Données envoyées:', requestBody);
        console.log('URL complète:', loginUrl);
            console.log('Headers:', {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'User-Agent': 'GecoSchoolPlan/1.0',
            });

            // Créer un AbortController pour le timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);

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
            
            // Vérifier si on a un token (succès) ou un message d'erreur
            if (loginData.token) {
              // Sauvegarder l'école
              const newSchool = {
                id: Date.now().toString(),
                name: normalizedData.name,
                apiUrl: normalizedData.apiUrl,
                username: normalizedData.username,
                password: normalizedData.password,
                role: loginData.user?.role || 'user',
                token: loginData.token,
                refreshToken: loginData.refreshToken
              };

              // Récupérer les écoles existantes
              const existingSchools = await AsyncStorage.getItem('schools');
              const schools = existingSchools ? JSON.parse(existingSchools) : [];
              
              // Vérifier si l'école existe déjà
              const schoolExists = schools.some(school => 
                school.name === newSchool.name && school.apiUrl === newSchool.apiUrl
              );

              if (schoolExists) {
                Alert.alert('Erreur', 'Cette école existe déjà');
                setIsProcessing(false);
                setScanned(false);
                return;
              }

              // Ajouter la nouvelle école
              schools.push(newSchool);
              await AsyncStorage.setItem('schools', JSON.stringify(schools));
              
              // Sauvegarder aussi dans le format complet comme l'ajout manuel
              await AsyncStorage.setItem(`school_${newSchool.id}`, JSON.stringify(newSchool));

              Alert.alert(
                'Succès', 
                `École "${normalizedData.name}" ajoutée avec succès !`,
                [
                  {
                    text: 'OK',
                    onPress: () => {
                      // Retourner à l'écran précédent
                      navigation.goBack();
                    }
                  }
                ]
              );
            } else {
              Alert.alert('Erreur', loginData.message || 'Identifiants incorrects');
              setScanned(false);
            }
          } catch (error) {
            console.error('Erreur lors de l\'ajout de l\'école:', error);
            console.error('Message d\'erreur complet:', error.message);
            
            let errorMessage = 'Impossible de se connecter au serveur.';
            
            if (error.name === 'AbortError') {
              errorMessage = 'Timeout: Le serveur ne répond pas après 10 secondes.\n\nVérifiez que le serveur est démarré et accessible.';
            } else if (error.message.includes('Network request failed')) {
              errorMessage = 'Erreur réseau: Impossible d\'accéder au serveur.\n\nSolutions possibles:\n• Vérifiez que le serveur est démarré\n• Vérifiez l\'adresse IP (192.168.1.30)\n• Vérifiez le port (5000)\n• Vérifiez que le téléphone et le serveur sont sur le même réseau WiFi';
            } else if (error.message.includes('timeout')) {
              errorMessage = 'Timeout: Le serveur ne répond pas.\n\nVérifiez que le serveur est démarré et accessible.';
            } else if (error.message.includes('HTTP')) {
              errorMessage = `Erreur HTTP: ${error.message}\n\nVérifiez les identifiants et l\'URL de l\'API.`;
            }
            
            Alert.alert(
              'Erreur réseau', 
              errorMessage
            );
            setScanned(false);
          }
        } catch (e) {
          console.error('Erreur parsing QR code:', e);
          console.log('Données brutes du QR code:', data);
          Alert.alert('Erreur', 'Format QR code invalide');
          setIsProcessing(false);
          setScanned(false);
          return;
        }
    } catch (error) {
      console.error('Erreur lors du traitement:', error);
      Alert.alert('Erreur', 'Erreur lors du traitement des données');
      setScanned(false);
    } finally {
      setIsProcessing(false);
    }
  };

  if (hasPermission === null) {
    return (
      <View style={styles.center}>
        <Text style={styles.permissionText}>Demande de permission caméra...</Text>
        <TouchableOpacity 
          style={styles.retryButton} 
          onPress={() => {
            setHasPermission(null);
            requestCameraPermission();
          }}
        >
          <Text style={styles.retryButtonText}>Réessayer</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.center}>
        <Text style={styles.permissionText}>Pas d'accès à la caméra</Text>
        <Text style={styles.permissionSubtext}>
          Allez dans Paramètres {'>'} Applications {'>'} Geco SchoolPlan {'>'} Permissions {'>'} Caméra
        </Text>
        <TouchableOpacity 
          style={styles.retryButton} 
          onPress={() => {
            setHasPermission(null);
            requestCameraPermission();
          }}
        >
          <Text style={styles.retryButtonText}>Réessayer</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.retryButton, { marginTop: 10, backgroundColor: '#666' }]} 
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.retryButtonText}>Retour</Text>
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
            <Text style={styles.title}>Scanner QR Code</Text>
            <Text style={styles.subtitle}>Pointez la caméra vers un QR code</Text>
          </View>
          
          {isProcessing && (
            <View style={styles.processingContainer}>
              <Text style={styles.processingText}>Traitement en cours...</Text>
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