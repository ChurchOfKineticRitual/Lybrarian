import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ToggleControl from './ToggleControl';
import { generateVerses } from '../api/client';

/**
 * Input Screen - Main entry point for verse generation
 * Mobile-first design with four-way toggle controls
 */
function InputScreen() {
  const navigate = useNavigate();

  // Verse input state
  const [input, setInput] = useState('');

  // Settings state with defaults: Ish, Yes, Ish, Yes
  const [settings, setSettings] = useState({
    religiosity: 'ish',
    rhythm: 'yes',
    rhyming: 'ish',
    meaning: 'yes',
    theme: '',
    steer: ''
  });

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Character count for verse input
  const charCount = input.length;
  const lineCount = input.split('\n').filter(line => line.trim()).length;

  // Load saved settings from localStorage on mount
  useEffect(() => {
    const savedSettings = localStorage.getItem('lybrarian_settings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setSettings(prev => ({ ...prev, ...parsed }));
      } catch (e) {
        console.error('Failed to load saved settings:', e);
      }
    }
  }, []);

  // Save settings to localStorage when they change
  useEffect(() => {
    localStorage.setItem('lybrarian_settings', JSON.stringify(settings));
  }, [settings]);

  // Update individual setting
  const updateSetting = (key, value) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // Theme options from PRD
  const themes = [
    '',
    'Love',
    'Heartbreak',
    'Joy',
    'Nostalgia',
    'Hope',
    'Anger',
    'Fear',
    'Peace',
    'Adventure',
    'Loss',
    'Growth',
    'Identity',
    'Freedom',
    'Connection'
  ];

  // Handle generate button click
  const handleGenerate = async () => {
    // Validate input
    if (!input.trim()) {
      setError('Please enter a verse to generate variations');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await generateVerses(input, settings);

      // Navigate to review screen with result
      navigate('/review', {
        state: {
          result,
          input,
          settings
        }
      });
    } catch (err) {
      console.error('Generation error:', err);
      setError(err.message || 'Failed to generate verses. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Enter key in textarea (Shift+Enter for new line, Enter alone to generate)
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && input.trim()) {
      e.preventDefault();
      handleGenerate();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto p-4 pb-24">
        {/* Header */}
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Lybrarian</h1>
          <p className="text-sm text-gray-600">
            AI-assisted lyric writing with your fragment library
          </p>
        </header>

        {/* Verse Input */}
        <section className="mb-6">
          <label
            htmlFor="verse-input"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Your Verse
          </label>
          <textarea
            id="verse-input"
            className="w-full p-4 border border-gray-300 rounded-lg shadow-sm
                     focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                     transition-colors resize-none text-base"
            rows="6"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter your verse here...&#10;&#10;Tip: Press Enter to generate, Shift+Enter for new line"
            aria-describedby="verse-help"
          />
          <div className="flex justify-between items-center mt-2">
            <p id="verse-help" className="text-xs text-gray-500">
              {lineCount === 0 ? 'Start typing your verse' : `${lineCount} line${lineCount !== 1 ? 's' : ''}`}
            </p>
            <p className="text-xs text-gray-400">
              {charCount} characters
            </p>
          </div>
        </section>

        {/* Settings Section */}
        <section className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Generation Settings
          </h2>

          {/* Four-Way Toggle Controls */}
          <div className="space-y-1">
            <ToggleControl
              label="Fragment Adherence (Religiosity)"
              value={settings.religiosity}
              onChange={(value) => updateSetting('religiosity', value)}
              description="How closely should generated verses use your fragment library? No = ignore fragments, Ish = flexible inspiration, Yes = strict adherence to fragment language."
            />

            <ToggleControl
              label="Syllable Matching (Rhythm)"
              value={settings.rhythm}
              onChange={(value) => updateSetting('rhythm', value)}
              description="Should verses match the syllable count and stress pattern of your input? No = approximate length, Ish = ±2 syllables tolerance, Yes = exact syllable match per line."
            />

            <ToggleControl
              label="Rhyme Requirement (Rhyming)"
              value={settings.rhyming}
              onChange={(value) => updateSetting('rhyming', value)}
              description="Should verses maintain rhyme scheme? No = no rhyme required, Ish = slant rhymes acceptable, Yes = perfect phonetic rhyme match."
            />

            <ToggleControl
              label="Semantic Interpretation (Meaning)"
              value={settings.meaning}
              onChange={(value) => updateSetting('meaning', value)}
              description="How should the AI interpret your input's meaning? No = focus on structure only, Ish = loose thematic connection, Yes = strong semantic similarity."
            />
          </div>
        </section>

        {/* Optional Controls */}
        <section className="mb-6">
          <h3 className="text-sm font-medium text-gray-700 mb-3">
            Optional Guidance
          </h3>

          {/* Theme Dropdown */}
          <div className="mb-4">
            <label
              htmlFor="theme-select"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Theme
            </label>
            <select
              id="theme-select"
              className="w-full p-3 border border-gray-300 rounded-lg shadow-sm
                       focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                       bg-white text-base min-h-[44px]"
              value={settings.theme}
              onChange={(e) => updateSetting('theme', e.target.value)}
            >
              <option value="">None / Any</option>
              {themes.slice(1).map(theme => (
                <option key={theme} value={theme.toLowerCase()}>
                  {theme}
                </option>
              ))}
            </select>
          </div>

          {/* Steer Text Input */}
          <div>
            <label
              htmlFor="steer-input"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Additional Direction
            </label>
            <input
              id="steer-input"
              type="text"
              className="w-full p-3 border border-gray-300 rounded-lg shadow-sm
                       focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                       text-base min-h-[44px]"
              value={settings.steer}
              onChange={(e) => updateSetting('steer', e.target.value)}
              placeholder="e.g., 'Make it more metaphorical' or 'Focus on nature imagery'"
            />
          </div>
        </section>

        {/* Error Display */}
        {error && (
          <div
            className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg"
            role="alert"
          >
            <div className="flex items-start">
              <svg
                className="w-5 h-5 text-red-600 mt-0.5 mr-3 flex-shrink-0"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              <div>
                <p className="text-sm font-medium text-red-800">Error</p>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Generate Button */}
        <button
          onClick={handleGenerate}
          disabled={!input.trim() || loading}
          className={`
            w-full py-4 px-6 rounded-lg font-semibold text-base
            transition-all duration-150 ease-in-out
            min-h-[56px] shadow-lg
            focus:outline-none focus:ring-4 focus:ring-blue-300
            ${!input.trim() || loading
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
            }
          `}
          aria-label="Generate 10 verse variations"
        >
          {loading ? (
            <span className="flex items-center justify-center">
              <svg
                className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Generating...
            </span>
          ) : (
            'Generate 10 Variations'
          )}
        </button>

        {/* Helper Text */}
        <p className="text-xs text-center text-gray-500 mt-4">
          Your settings are automatically saved for future sessions
        </p>
      </div>

      {/* Bottom Navigation Placeholder */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 shadow-lg">
        <div className="max-w-2xl mx-auto flex justify-around items-center">
          <button
            className="flex flex-col items-center gap-1 text-blue-600 min-h-[44px] justify-center"
            aria-current="page"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
            </svg>
            <span className="text-xs font-medium">Input</span>
          </button>
          <button
            className="flex flex-col items-center gap-1 text-gray-400 min-h-[44px] justify-center"
            onClick={() => navigate('/review')}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <span className="text-xs font-medium">Review</span>
          </button>
          <button
            className="flex flex-col items-center gap-1 text-gray-400 min-h-[44px] justify-center"
            onClick={() => navigate('/workspace')}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
            <span className="text-xs font-medium">Workspace</span>
          </button>
        </div>
      </nav>
    </div>
  );
}

export default InputScreen;
