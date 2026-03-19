import React, { createContext, useContext, useState, useEffect } from 'react';

const DarkModeContext = createContext();

export function DarkModeProvider({ children }) {
    const [isDark, setIsDark] = useState(() => {
        return localStorage.getItem('darkMode') === 'true';
    });

    useEffect(() => {
        localStorage.setItem('darkMode', isDark);
        if (isDark) {
            document.documentElement.classList.add('dark');
            document.body.style.background = '#0f172a';
            document.body.style.color = '#f1f5f9';
        } else {
            document.documentElement.classList.remove('dark');
            document.body.style.background = '';
            document.body.style.color = '';
        }
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