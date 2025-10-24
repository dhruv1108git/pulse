import React from 'react';
import { BleProvider } from './src/contexts/BleContext';
import { IncidentProvider } from './src/contexts/IncidentContext';
import { ChatProvider } from './src/contexts/ChatContext';
import { HelplinesProvider } from './src/contexts/HelplinesContext';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  return (
    <BleProvider>
      <IncidentProvider>
        <ChatProvider>
          <HelplinesProvider>
            <AppNavigator />
          </HelplinesProvider>
        </ChatProvider>
      </IncidentProvider>
    </BleProvider>
  );
}
