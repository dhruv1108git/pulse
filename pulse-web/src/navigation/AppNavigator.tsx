import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { MdHome, MdReport, MdList, MdChat, MdPhone } from 'react-icons/md';
import { NEO_COLORS } from '../constants/neoBrutalism';

import HomeScreen from '../screens/HomeScreen';
import ReportScreen from '../screens/ReportScreen';
import IncidentsScreen from '../screens/IncidentsScreen';
import AssistantScreen from '../screens/AssistantScreen';
import HelplinesScreen from '../screens/HelplinesScreen';

type Screen = 'Home' | 'Report' | 'Incidents' | 'Assistant' | 'Helplines';

export default function AppNavigator() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('Home');

  const renderScreen = () => {
    switch (currentScreen) {
      case 'Home':
        return <HomeScreen />;
      case 'Report':
        return <ReportScreen />;
      case 'Incidents':
        return <IncidentsScreen />;
      case 'Assistant':
        return <AssistantScreen />;
      case 'Helplines':
        return <HelplinesScreen />;
      default:
        return <HomeScreen />;
    }
  };

  const TabButton = ({ 
    name, 
    icon: Icon, 
    screen 
  }: { 
    name: string; 
    icon: React.ComponentType<{ size: number; color: string }>; 
    screen: Screen;
  }) => {
    const isActive = currentScreen === screen;
    return (
      <TouchableOpacity
        style={styles.tabButton}
        onPress={() => setCurrentScreen(screen)}
      >
        <Icon 
          size={24} 
          color={isActive ? NEO_COLORS.BLUE : NEO_COLORS.GRAY} 
        />
        <Text
          style={[
            styles.tabLabel,
            isActive && styles.tabLabelActive,
          ]}
        >
          {name}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>{renderScreen()}</View>
      <View style={styles.tabBar}>
        <TabButton name="Home" icon={MdHome} screen="Home" />
        <TabButton name="Report" icon={MdReport} screen="Report" />
        <TabButton name="Incidents" icon={MdList} screen="Incidents" />
        <TabButton name="Assistant" icon={MdChat} screen="Assistant" />
        <TabButton name="Helplines" icon={MdPhone} screen="Helplines" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'column',
    height: '100vh',
  },
  content: {
    flex: 1,
    overflow: 'hidden',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: NEO_COLORS.WHITE,
    borderTopWidth: 3,
    borderTopColor: NEO_COLORS.BLACK,
    height: 70,
    paddingVertical: 8,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 4,
    color: NEO_COLORS.GRAY,
  },
  tabLabelActive: {
    color: NEO_COLORS.BLUE,
  },
});

