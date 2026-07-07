import React from 'react';
import ReactDOM from 'react-dom/client';
import 'primeicons/primeicons.css';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { QueryClientProvider } from '@tanstack/react-query';
import queryClient from './queryClient';

import * as serviceWorkerRegistration from './serviceWorkerRegistration';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
    <React.StrictMode>
        <QueryClientProvider client={queryClient}>
            <App />
        </QueryClientProvider>
    </React.StrictMode >
);

serviceWorkerRegistration.register();

// Clear existing caches to fix the 404 errors on old JS bundles
if ('caches' in window) {
    caches.keys().then((names) => {
        for (let name of names) {
            caches.delete(name);
        }
    });
}

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
