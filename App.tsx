import * as React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, Text, Button, StyleSheet } from 'react-native';
import LocationClientsScreen from './screens/LocationClientsScreen';
import AddClientScreen from './screens/AddClientScreen';
import { StockManagementScreen } from './screens/StockManagementScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator 
        initialRouteName="LocationClients"
        screenOptions={{ headerShown: false }}
      >
        <Stack.Screen name="LocationClients" component={LocationClientsScreen} />
        <Stack.Screen name="AddClient" component={AddClientScreen} />
        <Stack.Screen name="StockManagement" component={StockManagementScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, marginBottom: 20 },
});
