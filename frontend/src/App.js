
import React from 'react';
import FileUploader from './components/FileUploader';
import './index.css';

function App() {
  return (
    <div className="app">
      <header>
        <h1>Social Media Content Analyzer</h1>
        <p>Upload PDF or image to extract text and get quick suggestions.</p>
      </header>
      <main>
        <FileUploader />
      </main>
      <footer>
        <small>&copy; 2025 Social Media Content Analyzer</small>
      </footer>
    </div>
  );
}

export default App;
