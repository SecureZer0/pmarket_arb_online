'use client';

import { createContext, useContext, useState, ReactNode, useEffect } from 'react';

export interface FilterSettings {
  hideAiRejectedMarkets: boolean;
  hideAiRejectedCloseConditions: boolean;
  hideUserRejectedMarkets: boolean;
  hideUserRejectedCloseConditions: boolean;
}

interface SettingsContextType {
  editMode: boolean;
  toggleEditMode: () => void;
  setEditMode: (mode: boolean) => void;
  filterSettings: FilterSettings;
  updateFilterSettings: (settings: Partial<FilterSettings>) => void;
  settingsPanelOpen: boolean;
  toggleSettingsPanel: () => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

interface SettingsProviderProps {
  children: ReactNode;
}

export function SettingsProvider({ children }: SettingsProviderProps) {
  const [editMode, setEditMode] = useState(false);
  const [settingsPanelOpen, setSettingsPanelOpen] = useState(false);
  const [filterSettings, setFilterSettings] = useState<FilterSettings>({
    hideAiRejectedMarkets: false,
    hideAiRejectedCloseConditions: false,
    hideUserRejectedMarkets: false,
    hideUserRejectedCloseConditions: false,
  });

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedSettings = localStorage.getItem('filterSettings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setFilterSettings(parsed);
      } catch (error) {
        console.error('Failed to parse saved filter settings:', error);
      }
    }
  }, []);

  // Save settings to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('filterSettings', JSON.stringify(filterSettings));
  }, [filterSettings]);

  const toggleEditMode = () => {
    setEditMode(prev => !prev);
  };

  const updateFilterSettings = (newSettings: Partial<FilterSettings>) => {
    setFilterSettings(prev => ({ ...prev, ...newSettings }));
  };

  const toggleSettingsPanel = () => {
    setSettingsPanelOpen(prev => !prev);
  };

  const value = {
    editMode,
    toggleEditMode,
    setEditMode,
    filterSettings,
    updateFilterSettings,
    settingsPanelOpen,
    toggleSettingsPanel,
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}

