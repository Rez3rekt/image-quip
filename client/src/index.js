import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
// Import global styles if you have them
// import './styles/global.css'; // Styles are linked in HTML already

const container = document.getElementById('root');
const root = createRoot(container); // createRoot(container!) if you use TypeScript

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
