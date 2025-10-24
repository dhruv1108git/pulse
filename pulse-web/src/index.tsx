import React from 'react';
import { createRoot } from 'react-dom/client';
import { AppRegistry } from 'react-native';
import App from './App';

// Register the app with React Native Web
AppRegistry.registerComponent('PulseWeb', () => App);

// Get the root element
const root = document.getElementById('root');

if (root) {
  // Use React 18 createRoot API
  const rootElement = createRoot(root);
  rootElement.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} else {
  console.error('Root element not found!');
}

