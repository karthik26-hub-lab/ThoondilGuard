import { useEffect } from 'react';
import { useLanguage } from './languageState';
export function useUnsaved(dirty: boolean) {
    const { t } = useLanguage();
    useEffect(() => {
        if (!dirty)
            return;
        function unload(e: BeforeUnloadEvent) { e.preventDefault(); e.returnValue = ''; }
        function click(e: MouseEvent) {
            const anchor = (e.target as HTMLElement).closest('a[href]');
            if (anchor && !window.confirm(t('Unsaved changes. Leave without saving?'))) {
                e.preventDefault();
                e.stopPropagation();
            }
        }
        window.addEventListener('beforeunload', unload);
        document.addEventListener('click', click, true);
        return () => { window.removeEventListener('beforeunload', unload); document.removeEventListener('click', click, true); };
    }, [dirty, t]);
}
