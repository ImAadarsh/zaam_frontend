'use client';
import { useEffect } from 'react';

export function ServiceWorkerRegistration() {
    useEffect(() => {
        // Only register service worker in production or when explicitly needed
        if (
            typeof window !== 'undefined' &&
            'serviceWorker' in navigator &&
            process.env.NODE_ENV === 'production'
        ) {
            const registerSW = async () => {
                try {
                    const registration = await navigator.serviceWorker.register('/sw.js', {
                        scope: '/',
                    });
                    
                    console.log('Service Worker registered successfully:', registration.scope);
                    
                    // Check for updates periodically
                    setInterval(() => {
                        registration.update();
                    }, 60 * 60 * 1000); // Check every hour
                    
                    // Handle updates
                    registration.addEventListener('updatefound', () => {
                        const newWorker = registration.installing;
                        if (newWorker) {
                            newWorker.addEventListener('statechange', () => {
                                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                    // New service worker available, prompt user to refresh
                                    console.log('New service worker available');
                                }
                            });
                        }
                    });
                } catch (error) {
                    // Silently fail in development, log in production
                    if (process.env.NODE_ENV === 'production') {
                        console.error('Service Worker registration failed:', error);
                    }
                }
            };

            // Register after page load
            if (document.readyState === 'complete') {
                registerSW();
            } else {
                window.addEventListener('load', registerSW);
            }
        }
    }, []);

    return null;
}
