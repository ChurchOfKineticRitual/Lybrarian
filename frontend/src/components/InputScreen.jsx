import React, { useState } from 'react';

function InputScreen() {
  const [input, setInput] = useState('');
  const [settings, setSettings] = useState({
    religiosity: 'ish',
    rhythm: 'yes',
    rhyming: 'ish',
    meaning: 'yes'
  });

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Lybrarian</h1>

      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">Input Verse</label>
        <textarea
          className="w-full p-3 border rounded-lg"
          rows="4"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Enter your verse or rhythmic pattern..."
        />
      </div>

      {/* Settings toggles will go here */}
      <div className="mb-6">
        <p className="text-sm text-gray-600">Settings controls coming soon...</p>
      </div>

      <button
        className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold"
        onClick={() => alert('Generation API coming soon!')}
      >
        Generate Verses
      </button>
    </div>
  );
}

export default InputScreen;
