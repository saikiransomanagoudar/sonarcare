# SonarCare Frontend

This is the frontend for the SonarCare medical chatbot, built with Next.js, TypeScript, and Tailwind CSS.

## Features

- **Reliable Medical Information**: Powered by Perplexity Sonar's web search and reasoning capabilities
- **User Authentication**: Secure login/signup with email/password or Google authentication
- **Real-time Chat**: WebSocket-based chat for immediate AI responses
- **Chat History**: Save and access previous conversations
- **Medical Disclaimers**: Clear disclaimers about the informational nature of the content

## Technical Stack

- **Next.js**: React framework with App Router for frontend
- **TypeScript**: For type safety
- **Tailwind CSS**: For styling
- **Firebase Authentication**: For user authentication
- **Firebase Firestore**: For storing chat history
- **Socket.IO Client**: For real-time communication

## Getting Started

### Prerequisites
- Node.js 16+ and npm
- Firebase project with Authentication and Firestore enabled

### Installation

1. Navigate to the frontend directory
```
cd frontend
```

2. Install dependencies
```
npm install
```

3. Create a `.env.local` file in the frontend directory with your Firebase configuration:
```
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-auth-domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-storage-bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_SOCKET_URL=http://localhost:8000
```

4. Run the development server
```
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Project Structure

```
/frontend
  /src
    /app - Next.js App Router pages
      /(auth) - Authentication routes
      /(app) - Protected application routes
    /components - React components
      /auth - Authentication components
      /chat - Chat interface components
      /layout - Layout components like Navbar
      /ui - Reusable UI components
    /context - React context providers
    /hooks - Custom React hooks
    /lib - Utility functions
      /firebase - Firebase configuration and helper functions
    /types - TypeScript type definitions
  /public - Static assets
```

## Disclaimer

This application is for educational and informational purposes only. It is not intended to be a substitute for professional medical advice, diagnosis, or treatment. Always seek the advice of your physician or other qualified health provider with any questions you may have regarding a medical condition.

## License

MIT
