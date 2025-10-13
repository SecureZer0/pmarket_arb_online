'use client';

import { useSettings } from '../contexts/SettingsContext';
import { VscSettings } from 'react-icons/vsc';
import { BiEdit } from 'react-icons/bi';
import { MdRefresh } from 'react-icons/md';
import { useState } from 'react';

interface FloatingBottomBarProps {
  onRefresh?: () => void;
}

export default function FloatingBottomBar({ onRefresh }: FloatingBottomBarProps) {
  const { 
    editMode, 
    toggleEditMode, 
    filterSettings, 
    updateFilterSettings, 
    settingsPanelOpen, 
    toggleSettingsPanel 
  } = useSettings();

  return (
    <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-50">
      <div className="bg-[#1a1a1a] border border-gray-700 rounded-lg shadow-2xl backdrop-blur-sm">
        {/* Main bar */}
        <div className="flex items-center gap-2 px-4 py-3">
          

          {/* Edit Mode Button */}
          <button
            onClick={toggleEditMode}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
              editMode
                ? 'bg-green-600 text-white hover:bg-green-700 shadow-lg'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-600'
            }`}
          >
            <BiEdit size={16} />
            {editMode ? 'Exit Edit' : 'Edit Mode'}
          </button>

          {/* Settings Button */}
          <button
            onClick={toggleSettingsPanel}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
              settingsPanelOpen
                ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-600'
            }`}
          >
            <VscSettings size={16} />
            Settings
          </button>
          
          {/* Refresh Button */}
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="flex items-center justify-center px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-600 hover:border-gray-500"
              title="Refresh data"
            >
              <MdRefresh size={16} />
            </button>
          )}
        </div>

        {/* Settings Panel */}
        {settingsPanelOpen && (
          <div className="border-t border-gray-700 px-4 py-4 bg-[#0f0f0f] rounded-b-lg">
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-300 mb-3">Filter Options</h3>
              
              <div className="space-y-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filterSettings.hideAiRejectedMarkets}
                    onChange={(e) => updateFilterSettings({ hideAiRejectedMarkets: e.target.checked })}
                    className="w-4 h-4 text-blue-600 bg-gray-800 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
                  />
                  <span className="text-sm text-gray-300">Hide AI Rejected Markets</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filterSettings.hideAiRejectedCloseConditions}
                    onChange={(e) => updateFilterSettings({ hideAiRejectedCloseConditions: e.target.checked })}
                    className="w-4 h-4 text-blue-600 bg-gray-800 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
                  />
                  <span className="text-sm text-gray-300">Hide AI Rejected Close Conditions</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filterSettings.hideUserRejectedMarkets}
                    onChange={(e) => updateFilterSettings({ hideUserRejectedMarkets: e.target.checked })}
                    className="w-4 h-4 text-blue-600 bg-gray-800 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
                  />
                  <span className="text-sm text-gray-300">Hide User Rejected Markets</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filterSettings.hideUserRejectedCloseConditions}
                    onChange={(e) => updateFilterSettings({ hideUserRejectedCloseConditions: e.target.checked })}
                    className="w-4 h-4 text-blue-600 bg-gray-800 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
                  />
                  <span className="text-sm text-gray-300">Hide User Rejected Close Conditions</span>
                </label>
              </div>

              <div className="pt-2 border-t border-gray-700">
                <p className="text-xs text-gray-500">
                  Settings are automatically saved and will be applied to future API calls.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
