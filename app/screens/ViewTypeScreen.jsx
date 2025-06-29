import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

const ViewTypeScreen = ({ route, navigation }) => {
  const { t } = useTranslation();
  const { school, userType } = route.params;

  const handleOptionPress = (option) => {
    switch (option) {
      case 'teachers':
        console.log('Données de l\'école transmises:', {
          name: school.name,
          apiUrl: school.apiUrl,
          token: school.token ? `${school.token.substring(0, 10)}...` : 'manquant',
          refreshToken: school.refreshToken ? `${school.refreshToken.substring(0, 10)}...` : 'manquant'
        });
        navigation.navigate('TeacherList', { 
          school: {
            ...school,
            token: school.token,
            refreshToken: school.refreshToken
          }
        });
        break;
      case 'classes':
        navigation.navigate('ClassList', {
          school: {
            ...school,
            token: school.token,
            refreshToken: school.refreshToken
          }
        });
        break;
      case 'rooms':
        navigation.navigate('RoomList', {
          school: {
            ...school,
            token: school.token,
            refreshToken: school.refreshToken
          }
        });
        break;
      default:
        console.log('Option non gérée:', option);
    }
  };

  const renderTeacherOptions = () => (
    <View style={styles.optionsContainer}>
      <TouchableOpacity 
        style={styles.optionCard}
        onPress={() => handleOptionPress('teachers')}
      >
        <MaterialIcons name="people" size={32} color="#1976D2" />
        <Text style={styles.optionTitle}>{t('viewTypes.teachers')}</Text>
        <Text style={styles.optionDescription}>{t('viewTypes.teachersDescription')}</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.optionCard}
        onPress={() => handleOptionPress('classes')}
      >
        <MaterialIcons name="class" size={32} color="#2E7D32" />
        <Text style={styles.optionTitle}>{t('viewTypes.classes')}</Text>
        <Text style={styles.optionDescription}>{t('viewTypes.classesDescription')}</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.optionCard}
        onPress={() => handleOptionPress('rooms')}
      >
        <MaterialIcons name="meeting-room" size={32} color="#C2185B" />
        <Text style={styles.optionTitle}>{t('viewTypes.rooms')}</Text>
        <Text style={styles.optionDescription}>{t('viewTypes.roomsDescription')}</Text>
      </TouchableOpacity>
    </View>
  );

  const renderStudentView = () => (
    <View style={styles.optionsContainer}>
      <TouchableOpacity 
        style={[styles.optionCard, styles.studentCard]}
        onPress={() => handleOptionPress('classes')}
      >
        <MaterialIcons name="class" size={48} color="#2E7D32" />
        <Text style={styles.optionTitle}>{t('viewTypes.studentViewTitle')}</Text>
        <Text style={styles.optionDescription}>{t('viewTypes.studentViewDescription')}</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.schoolName}>{school.name}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>{userType}</Text>
        </View>
      </View>

      {userType === 'enseignant' ? renderTeacherOptions() : renderStudentView()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  schoolName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A1A1A',
    flex: 1,
  },
  roleBadge: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginLeft: 8,
  },
  roleText: {
    color: '#1976D2',
    fontSize: 14,
    fontWeight: '600',
  },
  optionsContainer: {
    padding: 16,
  },
  optionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  studentCard: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  optionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginTop: 12,
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 14,
    color: '#666666',
  },
});

export default ViewTypeScreen; 