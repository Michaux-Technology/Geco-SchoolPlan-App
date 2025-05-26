import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

console.log('Enregistrement du composant racine');
AppRegistry.registerComponent(appName, () => App); 