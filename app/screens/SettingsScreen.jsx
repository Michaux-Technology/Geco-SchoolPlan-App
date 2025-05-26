import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SettingsScreen = ({ navigation, route }) => {
  const { schoolToEdit } = route.params || {};
  const [schoolName, setSchoolName] = useState(schoolToEdit?.name || '');
  const [apiUrl, setApiUrl] = useState(schoolToEdit?.apiUrl || '');
  const [username, setUsername] = useState(schoolToEdit?.username || '');
  const [password, setPassword] = useState(schoolToEdit?.password || '');
  const [isLoading, setIsLoading] = useState(false);
  const [isPinging, setIsPinging] = useState(false);

  const getAdjustedHostname = (hostname) => {
    // Si c'est un émulateur Android et qu'on essaie d'accéder à localhost
    if (Platform.OS === 'android' && 
        (hostname === 'localhost' || hostname === '127.0.0.1')) {
      return '10.0.2.2';
    }
    return hostname;
  };

  const saveSchool = async () => {
    // Vérifier les champs obligatoires
    if (!schoolName || !apiUrl || !username || !password) {
      Alert.alert('Erreur', 'Tous les champs sont obligatoires');
      return;
    }

    setIsLoading(true);
    try {
      // Normaliser l'URL
      let normalizedApiUrl = apiUrl.trim();
      if (!normalizedApiUrl.startsWith('http://') && !normalizedApiUrl.startsWith('https://')) {
        normalizedApiUrl = 'http://' + normalizedApiUrl;
      }
      normalizedApiUrl = normalizedApiUrl.endsWith('/') ? normalizedApiUrl : `${normalizedApiUrl}/`;
      
      console.log('Tentative de connexion à:', `${normalizedApiUrl}api/mobile/login`);
      
      // Tester la connexion avec l'API
      const response = await fetch(`${normalizedApiUrl}api/mobile/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          username,
          password,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        const schoolData = {
          id: schoolToEdit?.id || Date.now().toString(),
          name: schoolName,
          apiUrl: normalizedApiUrl,
          username,
          password,
          role: data.user?.role,
          token: data.token,
          refreshToken: data.refreshToken
        };

        try {
          // Récupérer les écoles existantes
          const existingSchools = await AsyncStorage.getItem('schools');
          let schools = existingSchools ? JSON.parse(existingSchools) : [];
          
          if (schoolToEdit) {
            // Mettre à jour l'école existante
            schools = schools.map(s => s.id === schoolToEdit.id ? schoolData : s);
          } else {
            // Ajouter une nouvelle école
            schools.push(schoolData);
          }
          
          // Sauvegarder la liste des écoles
          await AsyncStorage.setItem('schools', JSON.stringify(schools));
          
          // Sauvegarder les données complètes de l'école
          await AsyncStorage.setItem(`school_${schoolData.id}`, JSON.stringify(schoolData));
          
          Alert.alert('Succès', schoolToEdit ? 'École modifiée avec succès' : 'École ajoutée avec succès');
          navigation.goBack();
        } catch (storageError) {
          console.error('Erreur de stockage:', storageError);
          Alert.alert('Erreur de stockage', 'Impossible de sauvegarder l\'école dans le stockage local');
        }
      } else {
        Alert.alert('Erreur d\'authentification', data.message || 'Identifiants incorrects');
      }
    } catch (error) {
      console.error('Erreur de connexion:', error);
      
      if (error instanceof TypeError && error.message === 'Network request failed') {
        Alert.alert(
          'Erreur de connexion',
          'Impossible de se connecter au serveur. Vérifiez :\n\n' +
          '1. Que l\'URL est correcte\n' +
          '2. Que le serveur est démarré et accessible\n' +
          '3. Que votre appareil est connecté à Internet\n' +
          `URL tentée : ${apiUrl}`
        );
      } else {
        Alert.alert(
          'Erreur',
          'Une erreur s\'est produite lors de la connexion au serveur.\n\n' +
          `Détails : ${error.message}`
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const pingHost = async () => {
    if (!apiUrl) {
      Alert.alert('Erreur', 'Veuillez entrer une URL');
      return;
    }

    if (!username || !password) {
      Alert.alert('Erreur', 'Veuillez remplir les champs utilisateur et mot de passe pour tester la connexion');
      return;
    }

    setIsPinging(true);

    try {
      // Préparation de l'URL
      let cleanUrl = apiUrl.trim().replace(/\/$/, '');
      if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
        cleanUrl = 'http://' + cleanUrl;
      }

      console.log('Test de connexion vers:', cleanUrl);

      // Configuration du timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      // Test du serveur principal
      const startTime = Date.now();
      const statusUrl = `${cleanUrl}/api/mobile/status`;
      const baseResponse = await fetch(statusUrl, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Accept': '*/*',
          'Cache-Control': 'no-cache'
        }
      });

      // Test de l'endpoint login avec POST
      const loginUrl = `${cleanUrl}/api/mobile/login`;
      console.log('Test de l\'endpoint login:', loginUrl);
      
      const loginResponse = await fetch(loginUrl, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username,
          password
        })
      });

      clearTimeout(timeoutId);
      const endTime = Date.now();

      // Préparation du message de résultat
      let message = `✅ Le serveur répond !\n\n`;
      message += `URL principale : ${cleanUrl}\n`;
      message += `Status serveur : ${baseResponse.status}\n`;
      message += `Temps de réponse : ${endTime - startTime}ms\n\n`;
      
      message += `Test endpoint login :\n`;
      message += `URL : ${loginUrl}\n`;
      message += `Status : ${loginResponse.status}\n`;

      // Vérification de la réponse de login
      const loginData = await loginResponse.json();
      if (loginResponse.status === 200 && loginData.token) {
        message += `\n✅ Authentification réussie !\n`;
        message += `Role : ${loginData.user?.role || 'non spécifié'}\n`;
        Alert.alert('Test réussi', message);
      } else {
        message += `\n❌ Échec de l'authentification\n`;
        message += `Message : ${loginData.message || 'Erreur inconnue'}\n`;
        Alert.alert('Échec du test', message);
      }

    } catch (error) {
      console.error('Erreur de connexion:', error);
      let message = '❌ Erreur de connexion\n\n';
      
      if (error.name === 'AbortError') {
        message += 'Le serveur n\'a pas répondu dans les 15 secondes.\n\n';
        message += 'Suggestions:\n';
        message += '• Vérifiez que le serveur est démarré\n';
        message += '• Vérifiez que le port est correct\n';
        message += '• Vérifiez votre connexion réseau';
      }
      else if (error.message.includes('Network request failed')) {
        message += `URL testée: ${cleanUrl}\n\n`;
        message += 'Suggestions:\n';
        message += '1. Vérifiez que le serveur est démarré\n';
        message += '2. Essayez ces alternatives:\n';
        message += `   • ${cleanUrl.replace('http://', 'http://localhost:')}\n`;
        message += `   • ${cleanUrl.replace('http://', 'http://10.0.2.2:')} (émulateur Android)\n`;
        message += '3. Vérifiez l\'adresse IP du serveur avec:\n';
        message += '   • Windows: ipconfig\n';
        message += '   • Mac/Linux: ifconfig';
      }
      else {
        message += `Erreur: ${error.message}\n\n`;
        message += 'Suggestions:\n';
        message += '• Vérifiez que l\'URL est correcte\n';
        message += '• Vérifiez que le serveur est démarré\n';
        message += '• Vérifiez que vous êtes sur le même réseau';
      }

      Alert.alert('Diagnostic', message);
    } finally {
      setIsPinging(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        {schoolToEdit ? 'Modifier une école' : 'Ajouter une école'}
      </Text>
      
      <TextInput
        style={styles.input}
        placeholder="Nom de l'école"
        value={schoolName}
        onChangeText={setSchoolName}
      />
      
      <View style={styles.urlContainer}>
        <TextInput
          style={[styles.input, styles.urlInput]}
          placeholder="URL de l'API"
          value={apiUrl}
          onChangeText={setApiUrl}
          keyboardType="url"
        />
        <TouchableOpacity 
          style={[styles.pingButton, isPinging && styles.disabledButton]}
          onPress={pingHost}
          disabled={isPinging}
        >
          <Text style={styles.pingButtonText}>
            {isPinging ? 'Test...' : 'Tester'}
          </Text>
        </TouchableOpacity>
      </View>
      
      <TextInput
        style={styles.input}
        placeholder="Nom d'utilisateur"
        value={username}
        onChangeText={setUsername}
      />
      
      <TextInput
        style={styles.input}
        placeholder="Mot de passe"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      
      <TouchableOpacity 
        style={[styles.saveButton, isLoading && styles.disabledButton]}
        onPress={saveSchool}
        disabled={isLoading}
      >
        <Text style={styles.saveButtonText}>
          {isLoading ? 'Connexion...' : (schoolToEdit ? 'Modifier' : 'Sauvegarder')}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    fontSize: 16,
  },
  urlContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  urlInput: {
    flex: 1,
    marginBottom: 0,
    marginRight: 8,
  },
  pingButton: {
    backgroundColor: '#34C759',
    padding: 12,
    borderRadius: 8,
    minWidth: 80,
  },
  pingButtonText: {
    color: 'white',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 'bold',
  },
  saveButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    marginTop: 16,
  },
  disabledButton: {
    backgroundColor: '#cccccc',
  },
  saveButtonText: {
    color: 'white',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default SettingsScreen; 