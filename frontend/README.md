# Lybrarian Frontend

Mobile-first Progressive Web App for AI-assisted lyric writing.

## Development

```bash
# Install dependencies
npm install

# Start development server
npm start

# Build for production
npm run build

# Run tests
npm test
```

## Tech Stack

- React 18
- React Router for navigation
- Tailwind CSS for styling
- Mobile-first responsive design

## Project Structure

```
src/
├── components/       # React components
│   ├── InputScreen.jsx
│   ├── ReviewScreen.jsx
│   └── WorkspaceScreen.jsx
├── api/             # API client utilities
├── App.jsx          # Main app component
├── index.js         # Entry point
└── index.css        # Global styles with Tailwind
```

## Mobile Optimization

- Minimum 44px tap targets for all interactive elements
- Bottom navigation for thumb-friendly access
- Swipe gestures for verse navigation
- Optimized for portrait orientation
