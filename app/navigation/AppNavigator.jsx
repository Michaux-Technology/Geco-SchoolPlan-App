import React from 'react';
import { TouchableOpacity } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import HomeScreen from '../screens/HomeScreen';
import SettingsScreen from '../screens/SettingsScreen';
import ViewTypeScreen from '../screens/ViewTypeScreen';
import SetupScreen from '../screens/SetupScreen';
import TeacherListScreen from '../screens/TeacherListScreen';
import ClassListScreen from '../screens/ClassListScreen';
import ClassPlanningScreen from '../screens/ClassPlanningScreen';
import RoomListScreen from '../screens/RoomListScreen';
import RoomPlanningScreen from '../screens/RoomPlanningScreen';
import TeacherPlanningScreen from '../screens/TeacherPlanningScreen';

const Stack = createStackNavigator();

const AppNavigator = () => {
  const { t } = useTranslation();

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
            title: t('navigation.home'),
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
          options={{ title: t('settings.title') }}
        />
        <Stack.Screen 
          name="ViewType" 
          component={ViewTypeScreen} 
          options={{ title: t('navigation.viewType') }}
        />
        <Stack.Screen 
          name="Setup" 
          component={SetupScreen} 
          options={{ title: t('navigation.setup') }}
        />
        <Stack.Screen 
          name="TeacherList" 
          component={TeacherListScreen} 
          options={{ 
            title: t('navigation.teachers'),
            headerBackTitle: t('common.back')
          }}
        />
        <Stack.Screen 
          name="ClassList" 
          component={ClassListScreen}
          options={{
            title: t('navigation.classes'),
          }}
        />
        <Stack.Screen 
          name="RoomList" 
          component={RoomListScreen}
          options={{
            title: t('navigation.rooms'),
          }}
        />
        <Stack.Screen 
          name="TeacherPlanning" 
          component={TeacherPlanningScreen}
          options={({ route }) => ({
            title: route.params?.title || t('navigation.planning'),
            headerBackTitle: t('common.back')
          })}
          listeners={{
            focus: () => {
              console.log('🔍 TeacherPlanning screen focused');
            },
            blur: () => {
              console.log('🔍 TeacherPlanning screen blurred');
            }
          }}
        />
        <Stack.Screen 
          name="ClassPlanning" 
          component={ClassPlanningScreen}
          options={({ route }) => ({
            title: `${t('navigation.planning')} - ${route.params?.classe?.nom || t('navigation.class')}`,
            headerBackTitle: t('common.back')
          })}
          listeners={{
            focus: () => {
              console.log('🔍 ClassPlanning screen focused');
            },
            blur: () => {
              console.log('🔍 ClassPlanning screen blurred');
            }
          }}
        />
        <Stack.Screen 
          name="RoomPlanning" 
          component={RoomPlanningScreen}
          options={({ route }) => ({
            title: `${t('navigation.planning')} - ${route.params?.salle?.nom || t('navigation.room')}`,
            headerBackTitle: t('common.back')
          })}
          listeners={{
            focus: () => {
              console.log('🔍 RoomPlanning screen focused');
            },
            blur: () => {
              console.log('🔍 RoomPlanning screen blurred');
            }
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator; 