import React from 'react';
import { BleProvider } from './contexts/BleContext';
import { IncidentProvider } from './contexts/IncidentContext';
import { ChatProvider } from './contexts/ChatContext';
import { HelplinesProvider } from './contexts/HelplinesContext';
import AppNavigator from './navigation/AppNavigator';

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

