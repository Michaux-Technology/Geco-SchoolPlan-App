import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LoginScreen = ({ navigation, route }) => {
  const { school } = route.params;
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    if (!username || !password) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs');
      return;
    }

    setIsLoading(true);
    try {
      console.log('Tentative de connexion à:', `${school.apiUrl}/api/mobile/login`);
      const response = await fetch(`${school.apiUrl}/api/mobile/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username,
          password,
        }),
      });

      const data = await response.json();
      console.log('Réponse du serveur:', {
        status: response.status,
        hasToken: Boolean(data.token),
        hasRefreshToken: Boolean(data.refreshToken),
        tokenPreview: data.token ? `${data.token.substring(0, 10)}...` : 'manquant',
        refreshTokenPreview: data.refreshToken ? `${data.refreshToken.substring(0, 10)}...` : 'manquant'
      });

      if (response.ok) {
        // Sauvegarder les informations de connexion avec le refresh token
        const schoolData = {
          ...school,
          token: data.token,
          refreshToken: data.refreshToken,
          role: data.user.role
        };

        console.log('Données de l\'école à sauvegarder:', {
          name: schoolData.name,
          hasToken: Boolean(schoolData.token),
          hasRefreshToken: Boolean(schoolData.refreshToken),
          tokenPreview: schoolData.token ? `${schoolData.token.substring(0, 10)}...` : 'manquant',
          refreshTokenPreview: schoolData.refreshToken ? `${schoolData.refreshToken.substring(0, 10)}...` : 'manquant'
        });

        // Sauvegarder dans AsyncStorage
        await AsyncStorage.setItem(`school_${school.id}`, JSON.stringify(schoolData));
        
        // Mettre à jour la liste des écoles
        const savedSchools = await AsyncStorage.getItem('schools');
        let schoolsList = [];
        if (savedSchools) {
          schoolsList = JSON.parse(savedSchools);
          // Mettre à jour l'école existante ou ajouter la nouvelle
          const existingSchoolIndex = schoolsList.findIndex(s => s.id === school.id);
          if (existingSchoolIndex !== -1) {
            schoolsList[existingSchoolIndex] = {
              ...schoolsList[existingSchoolIndex],
              token: data.token,
              refreshToken: data.refreshToken,
              role: data.user.role
            };
          } else {
            schoolsList.push(schoolData);
          }
        } else {
          schoolsList = [schoolData];
        }
        await AsyncStorage.setItem('schools', JSON.stringify(schoolsList));

        // Naviguer vers l'écran des types de vue avec le rôle
        navigation.navigate('ViewType', {
          school: schoolData,
          userType: data.user.role,
        });
      } else {
        Alert.alert('Erreur', data.message || 'Identifiants incorrects');
      }
    } catch (error) {
      console.error('Erreur de connexion:', error);
      Alert.alert('Erreur', 'Impossible de se connecter au serveur');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Connexion à {school.name}</Text>
      
      <TextInput
        style={styles.input}
        placeholder="Nom d'utilisateur"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
      />
      
      <TextInput
        style={styles.input}
        placeholder="Mot de passe"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      
      <TouchableOpacity 
        style={[styles.loginButton, isLoading && styles.disabledButton]}
        onPress={handleLogin}
        disabled={isLoading}
      >
        <Text style={styles.loginButtonText}>
          {isLoading ? 'Connexion...' : 'Se connecter'}
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
  loginButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    marginTop: 16,
  },
  disabledButton: {
    backgroundColor: '#cccccc',
  },
  loginButtonText: {
    color: 'white',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default LoginScreen; 