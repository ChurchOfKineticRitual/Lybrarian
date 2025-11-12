import React, { useState } from 'react';

/**
 * Three-way segmented toggle control: No / Ish / Yes
 * Mobile-friendly with minimum 44px tap targets
 *
 * @param {string} label - Display name for the control
 * @param {string} value - Current value ('no', 'ish', 'yes')
 * @param {function} onChange - Callback function(newValue)
 * @param {string} description - Tooltip/help text explaining the option
 */
export default function ToggleControl({ label, value, onChange, description }) {
  const [showTooltip, setShowTooltip] = useState(false);

  const options = [
    { value: 'no', label: 'No' },
    { value: 'ish', label: 'Ish' },
    { value: 'yes', label: 'Yes' }
  ];

  return (
    <div className="mb-4">
      {/* Label with info icon */}
      <div className="flex items-center gap-2 mb-2">
        <label className="text-sm font-medium text-gray-700">
          {label}
        </label>
        {description && (
          <button
            type="button"
            className="relative"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            onFocus={() => setShowTooltip(true)}
            onBlur={() => setShowTooltip(false)}
            onClick={() => setShowTooltip(!showTooltip)}
            aria-label={`Information about ${label}`}
          >
            <svg
              className="w-4 h-4 text-gray-400 hover:text-gray-600"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>

            {/* Tooltip */}
            {showTooltip && (
              <div className="absolute z-10 w-64 p-2 mt-2 text-sm text-white bg-gray-800 rounded-lg shadow-lg left-0 top-full">
                {description}
                <div className="absolute w-2 h-2 bg-gray-800 transform rotate-45 -top-1 left-4"></div>
              </div>
            )}
          </button>
        )}
      </div>

      {/* Segmented control buttons */}
      <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden bg-white">
        {options.map((option, index) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`
              px-6 py-3 text-sm font-medium min-w-[80px] min-h-[44px]
              transition-colors duration-150 ease-in-out
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset
              ${index > 0 ? 'border-l border-gray-300' : ''}
              ${value === option.value
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50 active:bg-gray-100'
              }
            `}
            aria-pressed={value === option.value}
            aria-label={`${label}: ${option.label}`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
