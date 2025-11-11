import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import InputScreen from './components/InputScreen';
import ReviewScreen from './components/ReviewScreen';
import WorkspaceScreen from './components/WorkspaceScreen';

function App() {
  return (
    <Router>
      <div className="App min-h-screen bg-gray-50">
        <Routes>
          <Route path="/" element={<InputScreen />} />
          <Route path="/review" element={<ReviewScreen />} />
          <Route path="/workspace" element={<WorkspaceScreen />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
