import { Room, User, Story, RoomSummary, UserSummary, VotingResults } from '../types';
import { v4 as uuidv4 } from 'uuid';

class RoomService {
  private rooms: Map<string, Room> = new Map();
  private userSockets: Map<string, string> = new Map(); // userId -> socketId
  private socketUsers: Map<string, string> = new Map(); // socketId -> userId
  private readonly ROOM_CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
  private readonly INACTIVE_ROOM_TIMEOUT = 4 * 60 * 60 * 1000; // 4 hours

  constructor() {
    // Clean up inactive rooms periodically
    setInterval(() => {
      this.cleanupInactiveRooms();
    }, this.ROOM_CLEANUP_INTERVAL);
  }

  createRoom(name: string, adminName: string): { roomId: string; userId: string } {
    const roomId = this.generateRoomId();
    const userId = uuidv4();
    
    const admin: User = {
      id: userId,
      name: adminName,
      isAdmin: true,
      hasVoted: false,
      joinedAt: new Date(),
      connected: true
    };

    const room: Room = {
      id: roomId,
      name,
      adminId: userId,
      users: new Map([[userId, admin]]),
      story: { title: '', description: '' },
      votingRevealed: false,
      estimationStarted: false,
      createdAt: new Date(),
      lastActivity: new Date()
    };

    this.rooms.set(roomId, room);
    return { roomId, userId };
  }

  joinRoom(roomId: string, userName: string, isAdmin: boolean = false): { success: boolean; userId?: string; error?: string } {
    const room = this.rooms.get(roomId);
    if (!room) {
      return { success: false, error: 'Room not found' };
    }

    // Check if trying to join as admin when admin already exists
    if (isAdmin && room.adminId && room.users.has(room.adminId)) {
      return { success: false, error: 'Admin already exists in this room' };
    }

    const userId = uuidv4();
    const user: User = {
      id: userId,
      name: userName,
      isAdmin,
      hasVoted: false,
      joinedAt: new Date(),
      connected: true
    };

    // If joining as admin and no current admin, make this user the admin
    if (isAdmin) {
      room.adminId = userId;
    }

    room.users.set(userId, user);
    room.lastActivity = new Date();

    return { success: true, userId };
  }

  leaveRoom(roomId: string, userId: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) {
      return false;
    }

    const user = room.users.get(userId);
    if (!user) {
      return false;
    }

    room.users.delete(userId);
    room.lastActivity = new Date();

    // If admin left and there are other users, promote the first non-admin user
    if (user.isAdmin && room.users.size > 0) {
      const newAdmin = Array.from(room.users.values())[0];
      newAdmin.isAdmin = true;
      room.adminId = newAdmin.id;
    }

    // Delete room if empty
    if (room.users.size === 0) {
      this.rooms.delete(roomId);
    }

    return true;
  }

  getRoom(roomId: string): Room | null {
    const room = this.rooms.get(roomId);
    if (room) {
      room.lastActivity = new Date();
    }
    return room || null;
  }

  getRoomSummary(roomId: string): RoomSummary | null {
    const room = this.getRoom(roomId);
    if (!room) {
      return null;
    }

    const admin = room.users.get(room.adminId);
    return {
      id: room.id,
      name: room.name,
      userCount: room.users.size,
      adminName: admin?.name || 'Unknown',
      story: room.story,
      votingRevealed: room.votingRevealed,
      estimationStarted: room.estimationStarted,
      createdAt: room.createdAt,
      lastActivity: room.lastActivity
    };
  }

  updateStory(roomId: string, userId: string, story: Story): boolean {
    const room = this.rooms.get(roomId);
    if (!room) {
      return false;
    }

    const user = room.users.get(userId);
    if (!user || !user.isAdmin) {
      return false;
    }

    room.story = story;
    room.lastActivity = new Date();
    return true;
  }

  submitVote(roomId: string, userId: string, estimate: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) {
      return false;
    }

    const user = room.users.get(userId);
    if (!user) {
      return false;
    }

    // Don't allow voting if results are already revealed
    if (room.votingRevealed) {
      return false;
    }

    // If estimate is empty string, it means the vote is being cleared
    if (estimate === '') {
      user.estimate = undefined;
      user.hasVoted = false;
    } else {
      user.estimate = estimate;
      user.hasVoted = true;
    }
    room.lastActivity = new Date();
    return true;
  }

  revealVotes(roomId: string, userId: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) {
      return false;
    }

    const user = room.users.get(userId);
    if (!user || !user.isAdmin) {
      return false;
    }

    console.log('Revealing votes for room:', roomId);
    console.log('Users before reveal:', Array.from(room.users.values()).map(u => ({ id: u.id, name: u.name, estimate: u.estimate, hasVoted: u.hasVoted })));
    
    room.votingRevealed = true;
    room.lastActivity = new Date();
    
    console.log('Room voting revealed set to:', room.votingRevealed);
    return true;
  }

  resetVoting(roomId: string, userId: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) {
      return false;
    }

    const user = room.users.get(userId);
    if (!user || !user.isAdmin) {
      return false;
    }

    // Reset all user votes
    room.users.forEach(user => {
      user.estimate = undefined;
      user.hasVoted = false;
    });

    room.votingRevealed = false;
    room.estimationStarted = false;
    room.lastActivity = new Date();
    return true;
  }

  getVotingResults(roomId: string): VotingResults | null {
    const room = this.rooms.get(roomId);
    if (!room) {
      return null;
    }

    const votes: UserSummary[] = Array.from(room.users.values()).map(user => ({
      id: user.id,
      name: user.name,
      isAdmin: user.isAdmin,
      hasVoted: user.hasVoted,
      estimate: room.votingRevealed ? user.estimate : undefined,
      connected: user.connected
    }));

    const votedUsers = Array.from(room.users.values()).filter(user => user.hasVoted);
    const estimates = votedUsers.map(user => user.estimate).filter(Boolean) as string[];
    const estimateCounts = estimates.reduce((acc, estimate) => {
      acc[estimate] = (acc[estimate] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const mostCommon = estimates.length > 0 
      ? Object.keys(estimateCounts).reduce((a, b) => 
          estimateCounts[a] > estimateCounts[b] ? a : b
        )
      : undefined;

    return {
      revealed: room.votingRevealed,
      votes,
      summary: {
        totalVotes: votedUsers.length,
        uniqueEstimates: Array.from(new Set(estimates)),
        mostCommon
      }
    };
  }

  getUsersInRoom(roomId: string): UserSummary[] {
    const room = this.rooms.get(roomId);
    if (!room) {
      return [];
    }

    console.log('Getting users for room:', roomId, 'votingRevealed:', room.votingRevealed);
    const users = Array.from(room.users.values()).map(user => ({
      id: user.id,
      name: user.name,
      isAdmin: user.isAdmin,
      hasVoted: user.hasVoted,
      estimate: room.votingRevealed ? user.estimate : undefined,
      connected: user.connected
    }));
    console.log('Returning users:', users);
    
    return users;
  }

  // Socket connection tracking methods
  setUserSocket(userId: string, socketId: string): void {
    console.log(`Setting socket mapping: ${userId} -> ${socketId}`);
    this.userSockets.set(userId, socketId);
    this.socketUsers.set(socketId, userId);
    
    // Mark user as connected
    this.updateUserConnectionStatus(userId, true);
  }

  removeUserSocket(socketId: string): string | null {
    const userId = this.socketUsers.get(socketId);
    console.log(`Removing socket mapping: ${socketId} -> ${userId || 'not found'}`);
    if (userId) {
      this.userSockets.delete(userId);
      this.socketUsers.delete(socketId);
      
      // Mark user as disconnected
      this.updateUserConnectionStatus(userId, false);
    }
    return userId || null;
  }

  private updateUserConnectionStatus(userId: string, connected: boolean): void {
    console.log(`Updating connection status for user ${userId}: ${connected}`);
    for (const room of this.rooms.values()) {
      const user = room.users.get(userId);
      if (user) {
        console.log(`Found user ${userId} in room ${room.id}, updating connected: ${connected}`);
        user.connected = connected;
        room.lastActivity = new Date();
        break;
      }
    }
  }

  getUserBySocketId(socketId: string): string | null {
    return this.socketUsers.get(socketId) || null;
  }

  private generateRoomId(): string {
    // Generate a 6-character room ID
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    // Ensure uniqueness
    if (this.rooms.has(result)) {
      return this.generateRoomId();
    }
    
    return result;
  }

  private cleanupInactiveRooms(): void {
    const now = new Date();
    const roomsToDelete: string[] = [];

    this.rooms.forEach((room, roomId) => {
      const timeSinceLastActivity = now.getTime() - room.lastActivity.getTime();
      if (timeSinceLastActivity > this.INACTIVE_ROOM_TIMEOUT) {
        roomsToDelete.push(roomId);
      }
    });

    roomsToDelete.forEach(roomId => {
      console.log(`Cleaning up inactive room: ${roomId}`);
      this.rooms.delete(roomId);
    });
  }

  // Get all rooms (for debugging/admin purposes)
  getAllRooms(): RoomSummary[] {
    return Array.from(this.rooms.values()).map(room => {
      const admin = room.users.get(room.adminId);
      return {
        id: room.id,
        name: room.name,
        userCount: room.users.size,
        adminName: admin?.name || 'Unknown',
        story: room.story,
        votingRevealed: room.votingRevealed,
        estimationStarted: room.estimationStarted,
        createdAt: room.createdAt,
        lastActivity: room.lastActivity
      };
    });
  }
}

export const roomService = new RoomService();
