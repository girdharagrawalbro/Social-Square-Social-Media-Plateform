import React, { createContext, useContext, useState, useEffect } from 'react';

const DarkModeContext = createContext();
const DARK_MODE_STORAGE_KEY = 'darkMode';

const getInitialDarkMode = () => {
    if (typeof window === 'undefined') return false;

    const storedMode = window.localStorage.getItem(DARK_MODE_STORAGE_KEY);
    if (storedMode !== null) {
        return storedMode === 'true';
    }

    return window.matchMedia('(prefers-color-scheme: dark)').matches;
};

export function DarkModeProvider({ children }) {
    const [isDark, setIsDark] = useState(getInitialDarkMode);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        window.localStorage.setItem(DARK_MODE_STORAGE_KEY, String(isDark));

        const root = document.documentElement;
        root.classList.toggle('dark', isDark);
        root.setAttribute('data-theme', isDark ? 'dark' : 'light');
        root.style.colorScheme = isDark ? 'dark' : 'light';
    }, [isDark]);

    const toggle = () => setIsDark(v => !v);

    return (
        <DarkModeContext.Provider value={{ isDark, toggle }}>
            {children}
        </DarkModeContext.Provider>
    );
}

export function useDarkMode() {
    return useContext(DarkModeContext);
}