import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import dotenv from 'dotenv';

import roomRoutes from './routes/rooms';
import { errorHandler, notFound } from './middleware';
import { roomService } from './services/roomService';

dotenv.config();

const app = express();
const server = createServer(app);

const corsOptions = {
  //origin: process.env.CORS_ORIGIN || 'http://localhost:4200',
  origin: process.env.CORS_ORIGIN || 'https://storypointpoker.netlify.app',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

const io = new SocketIOServer(server, {
  cors: corsOptions,
  pingTimeout: 120000, // 2 minutes
  pingInterval: 30000, // 30 seconds
  transports: ['websocket', 'polling'],
  allowEIO3: true
});

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again later.'
  }
});

app.use(helmet());
app.use(cors(corsOptions));
app.use(limiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  next();
});

app.get('/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    }
  });
});

app.use('/api/rooms', roomRoutes);

io.on('connection', (socket) => {
  socket.on('join-room', async (data: { roomId: string; userId: string }) => {
    try {
      const { roomId, userId } = data;

      // Verify user exists in room
      const room = roomService.getRoom(roomId);
      if (!room || !room.users.has(userId)) {
        socket.emit('error', { message: 'Invalid room or user' });
        return;
      }

      // Track socket connection and mark user as connected
      roomService.setUserSocket(userId, socket.id);

      // Join socket room
      await socket.join(roomId);

      // Notify room of user join/reconnection
      const roomSummary = roomService.getRoomSummary(roomId);
      const users = roomService.getUsersInRoom(roomId);

      socket.to(roomId).emit('user-joined', {
        user: room.users.get(userId),
        room: roomSummary,
        users
      });

      // Send current room state to joining user
      socket.emit('room-state', {
        room: roomSummary,
        users,
        results: roomService.getVotingResults(roomId)
      });

      // If estimation is already started, send the estimation-started event to the new user
      if (room.estimationStarted) {
        socket.emit('estimation-started', {
          users,
          results: roomService.getVotingResults(roomId)
        });
      }

    } catch (error) {
      console.error('Error joining room:', error);
      socket.emit('error', { message: 'Failed to join room' });
    }
  });

  socket.on('leave-room', async (data: { roomId: string; userId: string }) => {
    try {
      const { roomId, userId } = data;

      await socket.leave(roomId);

      const success = roomService.leaveRoom(roomId, userId);
      if (success) {
        const roomSummary = roomService.getRoomSummary(roomId);
        const users = roomService.getUsersInRoom(roomId);

        socket.to(roomId).emit('user-left', {
          userId,
          room: roomSummary,
          users
        });
      }

    } catch (error) {
      console.error('Error leaving room:', error);
    }
  });

  socket.on('start-estimation', (data: { roomId: string; userId: string }) => {
    try {
      const { roomId, userId } = data;

      const room = roomService.getRoom(roomId);
      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }

      const user = room.users.get(userId);
      if (!user || !user.isAdmin) {
        socket.emit('error', { message: 'Only admin can start estimation' });
        return;
      }

      // Reset all votes when starting new estimation
      room.users.forEach(u => {
        u.hasVoted = false;
        u.estimate = undefined;
      });
      room.votingRevealed = false;
      room.estimationStarted = true;

      const users = roomService.getUsersInRoom(roomId);
      const results = roomService.getVotingResults(roomId);

      // Notify all users in room that estimation has started
      io.to(roomId).emit('estimation-started', {
        users,
        results
      });

    } catch (error) {
      console.error('Error starting estimation:', error);
      socket.emit('error', { message: 'Failed to start estimation' });
    }
  });

  socket.on('submit-vote', (data: { roomId: string; userId: string; estimate: string }) => {
    try {
      const { roomId, userId, estimate } = data;

      const success = roomService.submitVote(roomId, userId, estimate);
      if (success) {
        const users = roomService.getUsersInRoom(roomId);
        const results = roomService.getVotingResults(roomId);

        // Notify all users in room
        io.to(roomId).emit('vote-submitted', {
          userId,
          users,
          results
        });
      } else {
        socket.emit('error', { message: 'Failed to submit vote' });
      }
    } catch (error) {
      console.error('Error submitting vote:', error);
      socket.emit('error', { message: 'Failed to submit vote' });
    }
  });

  socket.on('reveal-votes', (data: { roomId: string; userId: string }) => {
    try {
      const { roomId, userId } = data;

      const success = roomService.revealVotes(roomId, userId);
      if (success) {
        const votingResults = roomService.getVotingResults(roomId);

        if (votingResults) {
          const eventData = {
            revealed: votingResults.revealed,
            votes: votingResults.votes,
            summary: votingResults.summary
          };

          // Notify all users in room
          io.to(roomId).emit('votes-revealed', eventData);
        } else {
          socket.emit('error', { message: 'Failed to get voting results' });
        }
      } else {
        socket.emit('error', { message: 'Only admin can reveal votes' });
      }
    } catch (error) {
      console.error('Error revealing votes:', error);
      socket.emit('error', { message: 'Failed to reveal votes' });
    }
  });

  socket.on('reset-voting', (data: { roomId: string; userId: string }) => {
    try {
      const { roomId, userId } = data;

      const success = roomService.resetVoting(roomId, userId);
      if (success) {
        const users = roomService.getUsersInRoom(roomId);
        const results = roomService.getVotingResults(roomId);

        // Notify all users in room
        io.to(roomId).emit('voting-reset', {
          users,
          results
        });
      } else {
        socket.emit('error', { message: 'Only admin can reset voting' });
      }
    } catch (error) {
      console.error('Error resetting voting:', error);
      socket.emit('error', { message: 'Failed to reset voting' });
    }
  });

  socket.on('update-story', (data: { roomId: string; userId: string; title: string; description: string }) => {
    try {
      const { roomId, userId, title, description } = data;

      const success = roomService.updateStory(roomId, userId, { title, description });
      if (success) {
        const roomSummary = roomService.getRoomSummary(roomId);

        // Notify all users in room
        io.to(roomId).emit('story-updated', {
          story: { title, description },
          room: roomSummary
        });
      } else {
        socket.emit('error', { message: 'Only admin can update story' });
      }
    } catch (error) {
      console.error('Error updating story:', error);
      socket.emit('error', { message: 'Failed to update story' });
    }
  });

  socket.on('disconnect', () => {
    // Find the user associated with this socket and check if they have another active socket
    const userId = roomService.getUserBySocketId(socket.id);
    if (userId) {
      const userRoom = roomService.getRoomByUserId(userId);
      
      // Only remove the socket mapping
      roomService.removeSocketMapping(socket.id);

      // Check if user has any other active sockets before marking as disconnected
      const hasOtherActiveSockets = roomService.hasActiveSocket(userId);
      
      if (!hasOtherActiveSockets) {
        roomService.markUserDisconnected(userId);

        if (userRoom) {
          const users = roomService.getUsersInRoom(userRoom.id);
          io.to(userRoom.id).emit('user-disconnected', { userId, users });
        }
      }
    }
  });

  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });
});

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
});

process.on('SIGTERM', () => {
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  server.close(() => {
    process.exit(0);
  });
});

export default app;