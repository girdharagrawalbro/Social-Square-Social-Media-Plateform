import React from 'react';
import ReactDOM from 'react-dom/client';
import 'primeicons/primeicons.css';
import './index.css';
import App from './App';
import ErrorBoundary from './pages/components/ui/ErrorBoundary';
import reportWebVitals from './reportWebVitals';
import { QueryClientProvider } from '@tanstack/react-query';
import queryClient from './queryClient';
import { PostHogProvider } from '@posthog/react';

import * as serviceWorkerRegistration from './serviceWorkerRegistration';

const posthogKey = import.meta.env.REACT_APP_POSTHOG_KEY;
const posthogHost = import.meta.env.REACT_APP_POSTHOG_HOST || 'https://us.i.posthog.com';

const renderApp = () => {
    const appContent = (
        <QueryClientProvider client={queryClient}>
            <ErrorBoundary>
                <App />
            </ErrorBoundary>
        </QueryClientProvider>
    );

    if (posthogKey) {
        return (
            <PostHogProvider 
                apiKey={posthogKey} 
                options={{ 
                    api_host: posthogHost,
                    enable_recording_console_log: true
                }}
            >
                {appContent}
            </PostHogProvider>
        );
    }

    return appContent;
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
    <React.StrictMode>
        {renderApp()}
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

// Send web vitals to PostHog
reportWebVitals((metric) => {
    if (window.posthog) {
        window.posthog.capture(metric.name, metric);
    } else {
        console.log(metric);
    }
});
