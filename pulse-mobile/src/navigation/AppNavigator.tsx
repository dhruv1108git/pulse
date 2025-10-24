import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/MaterialIcons';

import HomeScreen from '../screens/HomeScreen';
import ReportScreen from '../screens/ReportScreen';
import IncidentsScreen from '../screens/IncidentsScreen';
import MeshScreen from '../screens/MeshScreen';
import AssistantScreen from '../screens/AssistantScreen';
import HelplinesScreen from '../screens/HelplinesScreen';
import InsightsScreen from '../screens/InsightsScreen';

const Tab = createBottomTabNavigator();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{
          tabBarActiveTintColor: '#007AFF',
          tabBarInactiveTintColor: '#6B7280',
          tabBarStyle: {
            backgroundColor: '#FFFFFF',
            borderTopWidth: 3,
            borderTopColor: '#1A1A1A',
            paddingTop: 8,
            height: 70,
            paddingBottom: 8,
          },
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: 1,
            marginTop: 4,
          },
          headerShown: false,
        }}>
        <Tab.Screen
          name="Home"
          component={HomeScreen}
          options={{
            tabBarIcon: ({ color, size }) => (
              <Icon name="home" size={size} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="Report"
          component={ReportScreen}
          options={{
            tabBarIcon: ({ color, size }) => (
              <Icon name="report" size={size} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="Incidents"
          component={IncidentsScreen}
          options={{
            tabBarIcon: ({ color, size }) => (
              <Icon name="list" size={size} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="Assistant"
          component={AssistantScreen}
          options={{
            tabBarIcon: ({ color, size }) => (
              <Icon name="chat" size={size} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="Helplines"
          component={HelplinesScreen}
          options={{
            tabBarIcon: ({ color, size }) => (
              <Icon name="phone" size={size} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="Mesh"
          component={MeshScreen}
          options={{
            tabBarIcon: ({ color, size }) => (
              <Icon name="device-hub" size={size} color={color} />
            ),
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

