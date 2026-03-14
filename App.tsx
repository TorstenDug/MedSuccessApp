import * as React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LocationClientsScreen from './screens/LocationClientsScreen';
import AddClientScreen from './screens/AddClientScreen';
import { StockManagementScreen } from './screens/StockManagementScreen';
import MarketingLandingScreen from './screens/MarketingLandingScreen';
import HelpCenterScreen from './screens/HelpCenterScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator 
        initialRouteName="LocationClients"
        screenOptions={{ headerShown: false }}
      >
        <Stack.Screen name="MarketingLanding" component={MarketingLandingScreen} />
        <Stack.Screen name="HelpCenter" component={HelpCenterScreen} />
        <Stack.Screen name="LocationClients" component={LocationClientsScreen} />
        <Stack.Screen name="AddClient" component={AddClientScreen} />
        <Stack.Screen name="StockManagement" component={StockManagementScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
