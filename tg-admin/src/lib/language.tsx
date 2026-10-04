import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Context, tamil } from './languageState';
export function LanguageProvider({ children }: {
    children: ReactNode;
}) {
    const [language, setLanguage] = useState<'en' | 'ta'>(() => {
        try {
            return localStorage.getItem('thg-admin-language') === 'ta' ? 'ta' : 'en';
        }
        catch {
            return 'en';
        }
    });
    useEffect(() => {
        document.documentElement.lang = language;
        try {
            localStorage.setItem('thg-admin-language', language);
        }
        catch { }
    }, [language]);
    return <Context.Provider value={{ language, t: x => language === 'ta' ? (tamil[x] || x) : x, toggle: () => setLanguage(x => x === 'en' ? 'ta' : 'en') }}>{children}</Context.Provider>;
}
