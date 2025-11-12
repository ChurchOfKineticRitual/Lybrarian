import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { generateVerses, updateRating, addKeeper } from '../api/client';

/**
 * Review Screen - Display and rate generated verse variations
 * Allows users to rate verses (Best/Fine/Not the vibe), add keepers,
 * and iterate with feedback for improved results
 */
function ReviewScreen() {
  const location = useLocation();
  const navigate = useNavigate();

  // Extract state from navigation
  const { result, input, settings } = location.state || {};

  // Verse and rating state
  const [verses, setVerses] = useState(result?.verses || []);
  const [ratings, setRatings] = useState({});
  const [keeperStatus, setKeeperStatus] = useState({});

  // UI state
  const [loading, setLoading] = useState(false);
  const [iterating, setIterating] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Session info
  const sessionId = result?.sessionId;
  const iteration = result?.metadata?.iteration || 1;

  // Redirect if no verses data available
  useEffect(() => {
    if (!verses || verses.length === 0) {
      const timer = setTimeout(() => {
        navigate('/');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [verses, navigate]);

  // Clear success message after 4 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  /**
   * Handle rating a verse (Best/Fine/Not the vibe)
   */
  const handleRating = async (verseId, ratingValue) => {
    setRatings(prev => ({
      ...prev,
      [verseId]: ratingValue
    }));

    // Call updateRating API if implemented
    try {
      await updateRating(sessionId, verseId, ratingValue);
    } catch (err) {
      console.warn('Rating update not yet implemented:', err);
      // Silently continue - ratings stored locally in state
    }
  };

  /**
   * Handle adding a verse to keepers
   */
  const handleAddKeeper = async (verseId, verseText) => {
    setLoading(true);
    setError(null);

    try {
      const response = await addKeeper(verseId);

      if (response.success) {
        setKeeperStatus(prev => ({
          ...prev,
          [verseId]: true
        }));
        setSuccessMessage('Verse added to keepers!');
      } else {
        throw new Error(response.error || 'Failed to add keeper');
      }
    } catch (err) {
      console.error('Add keeper error:', err);
      setError('Failed to save verse. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle iteration - generate new verses with feedback from ratings
   */
  const handleIterate = async () => {
    // Collect feedback from ratings
    const best = verses
      .filter(v => ratings[v.id] === 'best')
      .map(v => ({
        verse_text: v.verse_text,
        explanation: `User rated as "Best"`
      }));

    const notTheVibe = verses
      .filter(v => ratings[v.id] === 'not_the_vibe')
      .map(v => ({
        verse_text: v.verse_text,
        explanation: `User rated as "Not the vibe"`
      }));

    // Must have feedback to iterate
    if (best.length === 0 && notTheVibe.length === 0) {
      setError('Rate at least one verse as "Best" or "Not the vibe" to iterate');
      return;
    }

    setIterating(true);
    setError(null);
    setSuccessMessage(null);

    try {
      // Call generate API with iteration 2+ and feedback
      const feedback = {
        best,
        notTheVibe
      };

      const newResult = await generateVerses(
        input,
        settings,
        iteration + 1,
        feedback
      );

      if (!newResult.success) {
        throw new Error(newResult.error || 'Failed to generate new verses');
      }

      // Update verses and clear ratings for new generation
      setVerses(newResult.verses);
      setRatings({});
      setSuccessMessage(`Iteration ${iteration + 1} complete! Showing new variations...`);

      // Scroll to top
      window.scrollTo(0, 0);
    } catch (err) {
      console.error('Iteration error:', err);
      setError(err.message || 'Failed to generate new verses. Please try again.');
    } finally {
      setIterating(false);
    }
  };

  /**
   * Handle "Start Over" - return to input screen
   */
  const handleStartOver = () => {
    navigate('/');
  };

  // Show loading/redirect state if no verses
  if (!verses || verses.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-gray-600 mb-4">No verses to display</p>
          <p className="text-sm text-gray-500">Redirecting to input screen...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto p-4 pb-24">
        {/* Header */}
        <header className="mb-6">
          <div className="flex items-baseline gap-2 mb-2">
            <h1 className="text-3xl font-bold text-gray-900">Review Verses</h1>
            <span className="text-sm font-medium text-gray-500 bg-gray-200 px-2 py-1 rounded">
              Iteration {iteration}
            </span>
          </div>
          <p className="text-sm text-gray-600">
            Rate each verse: Best, Fine, or Not the vibe. Then iterate with your feedback.
          </p>
        </header>

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

        {/* Success Display */}
        {successMessage && (
          <div
            className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg"
            role="status"
          >
            <div className="flex items-start">
              <svg
                className="w-5 h-5 text-green-600 mt-0.5 mr-3 flex-shrink-0"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <div>
                <p className="text-sm font-medium text-green-800">{successMessage}</p>
              </div>
            </div>
          </div>
        )}

        {/* Verses List */}
        <div className="space-y-4 mb-6">
          {verses.map((verse, index) => (
            <div
              key={verse.id || index}
              className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
            >
              {/* Verse Card Header */}
              <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                <span className="inline-block text-base font-semibold text-gray-900">
                  Verse {index + 1}
                </span>
                {keeperStatus[verse.id] && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-100 px-2 py-1 rounded">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Saved
                  </span>
                )}
              </div>

              {/* Verse Text */}
              <div className="px-4 py-4">
                <p className="text-base text-gray-900 whitespace-pre-wrap leading-relaxed">
                  {verse.verse_text}
                </p>
              </div>

              {/* Rating Buttons */}
              <div className="px-4 py-3 border-t border-gray-100 bg-gray-50">
                <div className="flex gap-2 mb-3">
                  <button
                    onClick={() => handleRating(verse.id, 'best')}
                    className={`flex-1 py-2 px-3 text-sm font-medium rounded-md border transition-colors min-h-[44px] flex items-center justify-center ${
                      ratings[verse.id] === 'best'
                        ? 'bg-green-100 border-green-300 text-green-900 font-semibold'
                        : 'bg-white border-gray-300 text-gray-700 hover:bg-green-50 hover:border-green-300'
                    }`}
                    aria-pressed={ratings[verse.id] === 'best'}
                  >
                    <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M2 10.5a1.5 1.5 0 113 0v-7a1.5 1.5 0 01-3 0v7zM14 4a1 1 0 011 1v4h4a1 1 0 010 2h-4v4a1 1 0 11-2 0v-4h-4a1 1 0 110-2h4V5a1 1 0 011-1z" />
                    </svg>
                    Best
                  </button>

                  <button
                    onClick={() => handleRating(verse.id, 'fine')}
                    className={`flex-1 py-2 px-3 text-sm font-medium rounded-md border transition-colors min-h-[44px] flex items-center justify-center ${
                      ratings[verse.id] === 'fine'
                        ? 'bg-blue-100 border-blue-300 text-blue-900 font-semibold'
                        : 'bg-white border-gray-300 text-gray-700 hover:bg-blue-50 hover:border-blue-300'
                    }`}
                    aria-pressed={ratings[verse.id] === 'fine'}
                  >
                    <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Fine
                  </button>

                  <button
                    onClick={() => handleRating(verse.id, 'not_the_vibe')}
                    className={`flex-1 py-2 px-3 text-sm font-medium rounded-md border transition-colors min-h-[44px] flex items-center justify-center ${
                      ratings[verse.id] === 'not_the_vibe'
                        ? 'bg-red-100 border-red-300 text-red-900 font-semibold'
                        : 'bg-white border-gray-300 text-gray-700 hover:bg-red-50 hover:border-red-300'
                    }`}
                    aria-pressed={ratings[verse.id] === 'not_the_vibe'}
                  >
                    <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M13.586 3.414a2 2 0 004 0l.828-.828a4 4 0 00-5.656 0l-.828.828m2.828 9.172a4 4 0 015.656 0l.828-.828a2 2 0 00-2.828-2.828l-.828.828m2.828 2.828a2 2 0 002.828 0M5.172 5.172a4 4 0 015.656 0l.828-.828a2 2 0 00-2.828-2.828l-.828.828M9 17a2 2 0 100-4 2 2 0 000 4z" />
                    </svg>
                    Not Vibe
                  </button>
                </div>

                {/* Add to Keepers Button */}
                <button
                  onClick={() => handleAddKeeper(verse.id, verse.verse_text)}
                  disabled={loading || keeperStatus[verse.id]}
                  className={`w-full py-2 px-3 text-sm font-medium rounded-md border transition-colors min-h-[44px] ${
                    keeperStatus[verse.id]
                      ? 'bg-gray-100 border-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-white border-blue-300 text-blue-700 hover:bg-blue-50'
                  }`}
                >
                  {keeperStatus[verse.id] ? 'Already Saved' : 'Add to Keepers'}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="space-y-3 mb-6">
          {/* Iterate Button */}
          <button
            onClick={handleIterate}
            disabled={iterating || loading}
            className={`
              w-full py-4 px-6 rounded-lg font-semibold text-base
              transition-all duration-150 ease-in-out
              min-h-[56px] shadow-md
              focus:outline-none focus:ring-4 focus:ring-blue-300
              ${iterating || loading
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
              }
            `}
            aria-label="Generate new verses with feedback"
          >
            {iterating ? (
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
                Iterating...
              </span>
            ) : (
              <span className="flex items-center justify-center">
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.947.486A5.002 5.002 0 005.991 6.1H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.009 13.9H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                </svg>
                Iterate with Feedback
              </span>
            )}
          </button>

          {/* Start Over Button */}
          <button
            onClick={handleStartOver}
            disabled={iterating || loading}
            className={`
              w-full py-3 px-6 rounded-lg font-semibold text-base
              border-2 border-gray-300 text-gray-700
              transition-all duration-150 ease-in-out
              min-h-[56px]
              focus:outline-none focus:ring-4 focus:ring-gray-300
              ${iterating || loading
                ? 'opacity-50 cursor-not-allowed'
                : 'hover:bg-gray-50 active:bg-gray-100'
              }
            `}
            aria-label="Return to input screen"
          >
            Start Over
          </button>
        </div>

        {/* Rating Summary */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-900">
            <span className="font-semibold">Ratings:</span>{' '}
            {Object.values(ratings).length === 0 ? (
              'Rate verses to iterate with feedback'
            ) : (
              <>
                {Object.values(ratings).filter(r => r === 'best').length} Best,{' '}
                {Object.values(ratings).filter(r => r === 'fine').length} Fine,{' '}
                {Object.values(ratings).filter(r => r === 'not_the_vibe').length} Not Vibe
              </>
            )}
          </p>
        </div>
      </div>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 shadow-lg">
        <div className="max-w-2xl mx-auto flex justify-around items-center">
          <button
            className="flex flex-col items-center gap-1 text-gray-400 min-h-[44px] justify-center"
            onClick={() => navigate('/')}
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
            </svg>
            <span className="text-xs font-medium">Input</span>
          </button>
          <button
            className="flex flex-col items-center gap-1 text-blue-600 min-h-[44px] justify-center"
            aria-current="page"
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

export default ReviewScreen;
