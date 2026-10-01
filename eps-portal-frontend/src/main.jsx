import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './auth.jsx';
import { FlashProvider } from './flash.jsx';
import './index.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <FlashProvider>
          <App />
        </FlashProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
