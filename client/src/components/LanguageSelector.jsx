import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Check } from 'lucide-react';
import './LanguageSelector.css';

const LanguageSelector = () => {
    const { i18n } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);

    const languages = [
        { code: 'en', label: 'English', flag: '🇺🇸' },
        { code: 'es', label: 'Español', flag: '🇪🇸' }
    ];

    const currentLanguage = languages.find(l => l.code === i18n.language) || languages[0];

    const handleSelect = (code) => {
        i18n.changeLanguage(code);
        localStorage.setItem('app_language', code);
        setIsOpen(false);
    };

    return (
        <div className="language-selector-wrapper">
            <div className="language-label">Language</div>
            <div className="language-selector-container" onClick={() => setIsOpen(!isOpen)}>
                <div className="selected-language">
                    <span className="lang-flag">{currentLanguage.flag}</span>
                    <span className="lang-text">{currentLanguage.label}</span>
                </div>
                <ChevronDown className={`dropdown-arrow ${isOpen ? 'open' : ''}`} />

                {isOpen && (
                    <div className="language-dropdown">
                        {languages.map((lang) => (
                            <div
                                key={lang.code}
                                className={`language - option ${i18n.language === lang.code ? 'active' : ''} `}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleSelect(lang.code);
                                }}
                            >
                                <span className="lang-flag">{lang.flag}</span>
                                <span className="lang-text">{lang.label}</span>
                                {i18n.language === lang.code && <Check className="check-icon" />}
                            </div>
                        ))}
                    </div>
                )}
            </div>
            {/* Overlay to close dropdown when clicking outside */}
            {isOpen && <div className="dropdown-overlay" onClick={() => setIsOpen(false)} />}
        </div>
    );
};

export default LanguageSelector;
