import { useState, useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';

const useNetworkStatus = () => {
  const [isConnected, setIsConnected] = useState(true);
  const [connectionType, setConnectionType] = useState(null);
  const [isInternetReachable, setIsInternetReachable] = useState(true);

  useEffect(() => {
    // Fonction pour mettre à jour l'état de la connexion
    const updateConnectionStatus = (state) => {
      setIsConnected(state.isConnected);
      setConnectionType(state.type);
      setIsInternetReachable(state.isInternetReachable);
      
      console.log('🌐 État de la connexion:', {
        isConnected: state.isConnected,
        type: state.type,
        isInternetReachable: state.isInternetReachable,
        details: state.details
      });
    };

    // Obtenir l'état initial de la connexion
    NetInfo.fetch().then(updateConnectionStatus);

    // Écouter les changements de connexion
    const unsubscribe = NetInfo.addEventListener(updateConnectionStatus);

    // Nettoyer l'écouteur lors du démontage
    return () => {
      unsubscribe();
    };
  }, []);

  // Fonction pour tester la connectivité à un serveur spécifique
  const testServerConnectivity = async (serverUrl) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 secondes de timeout
      
      const response = await fetch(`${serverUrl}/health`, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        console.log('✅ Serveur accessible:', serverUrl);
        return true;
      } else {
        console.log('⚠️ Serveur répond mais avec une erreur:', response.status);
        return false;
      }
    } catch (error) {
      console.log('❌ Serveur inaccessible:', serverUrl, error.message);
      return false;
    }
  };

  // Fonction pour vérifier si on peut accéder à l'API de l'école
  const checkSchoolApiAccess = async (schoolApiUrl) => {
    if (!isConnected || !isInternetReachable) {
      return false;
    }
    
    return await testServerConnectivity(schoolApiUrl);
  };

  return {
    isConnected,
    connectionType,
    isInternetReachable,
    testServerConnectivity,
    checkSchoolApiAccess,
    // État combiné pour faciliter l'utilisation
    // Si isInternetReachable est null, on considère qu'on est en ligne si isConnected est true
    isOnline: isConnected && (isInternetReachable !== false),
  };
};

export default useNetworkStatus; 