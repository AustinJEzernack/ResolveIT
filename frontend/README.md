# ResolveIT Frontend

A modern React + TypeScript frontend for the ResolveIT ticket management system with real-time messaging and collaboration features.

## Features

- 🎫 Ticket Management
- 💬 Real-time Messaging (Discord/Slack-like)
- 👥 Team Collaboration
- 📊 Workshops & Training
- 🔐 Secure Authentication (JWT)

## Tech Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Fast build tool
- **React Router** - Client-side routing
- **Axios** - HTTP client
- **CSS3** - Styling (with CSS variables for theming)

## Getting Started

### Prerequisites

- Node.js 16+ and npm/yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Create a `.env.local` file:
```env
VITE_API_URL=http://localhost:8000/api
```

3. Start the development server:
```bash
npm run dev
```

The app will be available at `http://localhost:3000`

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Project Structure

```
src/
├── components/      # Reusable React components
├── pages/          # Page components
├── services/       # API calls and external services
├── styles/         # CSS stylesheets
├── types/          # TypeScript type definitions
├── App.tsx         # Main App component
└── index.tsx       # Entry point
```

## API Configuration

The app is configured to proxy API requests to the backend at `http://localhost:8000`. Make sure the backend is running before using the app.

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## License

MIT
