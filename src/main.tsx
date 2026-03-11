import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { WingProvider } from './hooks/useWing';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WingProvider>
      <App />
    </WingProvider>
  </React.StrictMode>
);