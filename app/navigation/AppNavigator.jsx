import React from 'react';
import { TouchableOpacity } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { MaterialIcons } from '@expo/vector-icons';
import HomeScreen from '../screens/HomeScreen';
import SettingsScreen from '../screens/SettingsScreen';
import ViewTypeScreen from '../screens/ViewTypeScreen';
import SetupScreen from '../screens/SetupScreen';
import TeacherListScreen from '../screens/TeacherListScreen';
import ClassListScreen from '../screens/ClassListScreen';
import RoomListScreen from '../screens/RoomListScreen';
import TeacherPlanningScreen from '../screens/TeacherPlanningScreen';

const Stack = createStackNavigator();

const AppNavigator = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator 
        initialRouteName="Home"
        screenOptions={{
          headerStyle: {
            backgroundColor: '#FFFFFF',
          },
          headerTintColor: '#000000',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
      >
        <Stack.Screen 
          name="Home" 
          component={HomeScreen} 
          options={({ navigation }) => ({
            title: 'Liste des écoles',
            headerRight: () => (
              <TouchableOpacity
                style={{ marginRight: 16 }}
                onPress={() => navigation.navigate('Setup')}
              >
                <MaterialIcons name="settings" size={24} color="#007AFF" />
              </TouchableOpacity>
            ),
          })}
        />
        <Stack.Screen 
          name="Settings" 
          component={SettingsScreen} 
          options={{ title: 'Paramètres' }}
        />
        <Stack.Screen 
          name="ViewType" 
          component={ViewTypeScreen} 
          options={{ title: 'Types de vues' }}
        />
        <Stack.Screen 
          name="Setup" 
          component={SetupScreen} 
          options={{ title: 'Configuration des écoles' }}
        />
        <Stack.Screen 
          name="TeacherList" 
          component={TeacherListScreen} 
          options={{ 
            title: 'Liste des enseignants',
            headerBackTitle: 'Retour'
          }}
        />
        <Stack.Screen 
          name="ClassList" 
          component={ClassListScreen}
          options={{
            title: 'Liste des classes',
          }}
        />
        <Stack.Screen 
          name="RoomList" 
          component={RoomListScreen}
          options={{
            title: 'Liste des salles',
          }}
        />
        <Stack.Screen 
          name="TeacherPlanning" 
          component={TeacherPlanningScreen}
          options={({ route }) => ({
            title: route.params?.title || 'Planning',
            headerBackTitle: 'Retour'
          })}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator; 