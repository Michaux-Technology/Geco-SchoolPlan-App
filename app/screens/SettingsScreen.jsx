import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import { MaterialIcons } from '@expo/vector-icons';

const SettingsScreen = ({ navigation, route }) => {
  const { t } = useTranslation();
  const { schoolToEdit } = route.params || {};
  const [schoolName, setSchoolName] = useState(schoolToEdit?.name || '');
  const [apiUrl, setApiUrl] = useState(schoolToEdit?.apiUrl || '');
  const [username, setUsername] = useState(schoolToEdit?.username || '');
  const [password, setPassword] = useState(schoolToEdit?.password || '');
  const [isLoading, setIsLoading] = useState(false);
  const [isPinging, setIsPinging] = useState(false);

  const saveSchool = async () => {
    if (!schoolName || !apiUrl || !username || !password) {
      Alert.alert(t('common.error'), t('auth.pleaseLogin'));
      return;
    }

    setIsLoading(true);
    try {
      let normalizedApiUrl = apiUrl.trim();
      if (!normalizedApiUrl.startsWith('http://') && !normalizedApiUrl.startsWith('https://')) {
        normalizedApiUrl = 'http://' + normalizedApiUrl;
      }
      normalizedApiUrl = normalizedApiUrl.endsWith('/') ? normalizedApiUrl : `${normalizedApiUrl}/`;
      
      const response = await fetch(`${normalizedApiUrl}api/mobile/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ username, password }),
      });

      const responseText = await response.text();
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        Alert.alert(t('common.error'), t('errors.serverError'));
        return;
      }

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

        const existingSchools = await AsyncStorage.getItem('schools');
        let schools = existingSchools ? JSON.parse(existingSchools) : [];
        
        if (schoolToEdit) {
          schools = schools.map(s => s.id === schoolToEdit.id ? schoolData : s);
        } else {
          schools.push(schoolData);
        }
        
        await AsyncStorage.setItem('schools', JSON.stringify(schools));
        await AsyncStorage.setItem(`school_${schoolData.id}`, JSON.stringify(schoolData));
        
        Alert.alert(t('common.success'), schoolToEdit ? t('messages.courseUpdated') : t('messages.courseAdded'));
        navigation.goBack();
      } else {
        Alert.alert(t('auth.loginError'), data.message || t('auth.invalidCredentials'));
      }
    } catch (error) {
      Alert.alert(t('common.error'), t('errors.networkError'));
    } finally {
      setIsLoading(false);
    }
  };

  const pingHost = async () => {
    if (!apiUrl || !username || !password) {
      Alert.alert(t('common.error'), t('auth.pleaseLogin'));
      return;
    }

    setIsPinging(true);
    try {
      let cleanUrl = apiUrl.trim().replace(/\/$/, '');
      if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
        cleanUrl = 'http://' + cleanUrl;
      }

      const response = await fetch(`${cleanUrl}/api/mobile/login`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();
      
      if (response.status === 200 && data.token) {
        Alert.alert(t('common.success'), t('messages.changesSaved'));
      } else {
        Alert.alert(t('common.error'), data.message || t('errors.networkError'));
      }
    } catch (error) {
      Alert.alert(t('common.error'), t('errors.networkError'));
    } finally {
      setIsPinging(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        {schoolToEdit ? t('common.edit') : t('common.add')} {t('navigation.home')}
      </Text>
      
      <TextInput
        style={styles.input}
        placeholder={t('navigation.home')}
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
            {isPinging ? t('common.loading') : t('common.retry')}
          </Text>
        </TouchableOpacity>
      </View>
      
      <TextInput
        style={styles.input}
        placeholder={t('auth.username')}
        value={username}
        onChangeText={setUsername}
      />
      
      <TextInput
        style={styles.input}
        placeholder={t('auth.password')}
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
          {isLoading ? t('common.loading') : (schoolToEdit ? t('common.edit') : t('common.save'))}
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