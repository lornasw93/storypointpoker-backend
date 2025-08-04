# Story Point Poker Backend

Node.js backend API for the Story Point Poker application.

## Features

- Real-time communication with Socket.IO
- RESTful API endpoints
- TypeScript support
- Room management
- User session handling
- Vote tracking and results
- Story management
- Admin controls

## Technology Stack

- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **Socket.IO** - Real-time bidirectional communication
- **TypeScript** - Type safety and better development experience
- **In-memory storage** - Fast data access (can be extended to use databases)

## API Endpoints

### Rooms
- `POST /api/rooms` - Create a new room
- `GET /api/rooms/:roomId` - Get room details
- `PUT /api/rooms/:roomId/story` - Update room story

### Users
- `POST /api/rooms/:roomId/join` - Join a room
- `DELETE /api/rooms/:roomId/users/:userId` - Leave a room

### Voting
- `POST /api/rooms/:roomId/vote` - Submit a vote
- `POST /api/rooms/:roomId/reveal` - Reveal votes (admin only)
- `POST /api/rooms/:roomId/reset` - Reset voting (admin only)

## Socket Events

### Client → Server
- `join-room` - Join a room
- `submit-vote` - Submit an estimate
- `reveal-votes` - Reveal all votes (admin)
- `reset-voting` - Reset voting session (admin)
- `update-story` - Update story details (admin)

### Server → Client
- `room-updated` - Room state changed
- `user-joined` - New user joined
- `user-left` - User left the room
- `vote-submitted` - Someone voted
- `votes-revealed` - Results revealed
- `voting-reset` - New voting session started
- `story-updated` - Story details changed

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start development server:
   ```bash
   npm run dev
   ```

3. Build for production:
   ```bash
   npm run build
   npm start
   ```

## Environment Variables

Create a `.env` file in the root directory:

```
PORT=3000
NODE_ENV=development
CORS_ORIGIN=http://localhost:4200
```

## Development

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm run lint` - Run ESLint
- `npm test` - Run tests
