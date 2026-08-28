import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { useActivityStore } from './store/activityStore';

const originalFetch = window.fetch;
window.fetch = async (...args) => {
  const input = args[0];
  const init = args[1];
  const method = (init?.method || (typeof input === 'string' ? 'GET' : 'GET')).toUpperCase();
  let url = '';
  try {
    url = typeof input === 'string' ? input : input instanceof Request ? input.url : input.toString();
  } catch {
    url = String(input);
  }
  const add = useActivityStore.getState().addActivity;
  try {
    const response = await originalFetch(...args);
    add({ method, url, status: response.status });
    return response;
  } catch (err) {
    add({ method, url, status: 0 });
    throw err;
  }
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
