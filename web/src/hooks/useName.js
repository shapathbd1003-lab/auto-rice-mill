import { useTranslation } from 'react-i18next';

/**
 * Returns a function that picks name vs name_bn based on current language.
 * Usage: const getName = useName();
 *        getName(row) → row.name_bn (in bn) or row.name (in en)
 *
 * Also returns isBn so callers can conditionally render secondary text.
 */
export function useName() {
  const { i18n } = useTranslation();
  const isBn = i18n.language === 'bn';

  const getName = (obj) => {
    if (!obj) return '';
    return isBn ? (obj.name_bn || obj.name || '') : (obj.name || '');
  };

  const getSecondary = (obj) => {
    if (!obj) return null;
    // In English: show name_bn as secondary only if we have it AND language is bn
    // In Bengali: show English name as secondary
    if (isBn) return obj.name || null;
    return null; // English mode: no secondary Bengali text
  };

  return { getName, getSecondary, isBn };
}
