export interface User {
  id: string;
  name: string;
  isAdmin: boolean;
  estimate?: string;
  hasVoted: boolean;
  joinedAt: Date;
  connected: boolean;
  socketId?: string;
}

export interface Story {
  title: string;
  description: string;
}

export interface Room {
  id: string;
  name: string;
  adminId: string;
  users: Map<string, User>;
  story: Story;
  votingRevealed: boolean;
  estimationStarted: boolean;
  createdAt: Date;
  lastActivity: Date;
}

export interface VoteSubmission {
  userId: string;
  estimate: string;
}

export interface RoomJoinRequest {
  userName: string;
  isAdmin?: boolean;
}

export interface StoryUpdateRequest {
  title: string;
  description: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface RoomSummary {
  id: string;
  name: string;
  userCount: number;
  adminName: string;
  story: Story;
  votingRevealed: boolean;
  estimationStarted: boolean;
  createdAt: Date;
  lastActivity: Date;
}

export interface UserSummary {
  id: string;
  name: string;
  isAdmin: boolean;
  hasVoted: boolean;
  estimate?: string;
  connected: boolean;
}

export interface VotingResults {
  revealed: boolean;
  votes: UserSummary[];
  summary: {
    totalVotes: number;
    uniqueEstimates: string[];
    mostCommon?: string;
  };
}
