import express, { Request, Response } from 'express';
import { roomService } from '../services/roomService';
import { validateRoomId, validateUserId } from '../middleware';
import { ApiResponse, RoomJoinRequest, StoryUpdateRequest, VoteSubmission } from '../types';

const router = express.Router();

// Create a new room
router.post('/', (req: Request, res: Response<ApiResponse>) => {
  console.log('### create new room')
  const { roomName, adminName } = req.body;
  
  if (!roomName || !adminName) {
    return res.status(400).json({
      success: false,
      error: 'Room name and admin name are required'
    });
  }

  try {
    const { roomId, userId } = roomService.createRoom(roomName, adminName);
    
    return res.status(201).json({
      success: true,
      data: { roomId, userId }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to create room'
    });
  }
});

// Get room details
router.get('/:roomId', validateRoomId, (req: Request, res: Response<ApiResponse>) => {
  console.log('### get room details');
  const { roomId } = req.params;
  
  try {
    const roomSummary = roomService.getRoomSummary(roomId);
    
    if (!roomSummary) {
      return res.status(404).json({
        success: false,
        error: 'Room not found'
      });
    }

    return res.json({
      success: true,
      data: roomSummary
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to get room details'
    });
  }
});

// Join a room
router.post('/:roomId/join', validateRoomId, (req: Request, res: Response<ApiResponse>) => {
  console.log('### join room');
  const { roomId } = req.params;
  const { userName, isAdmin }: RoomJoinRequest = req.body;
  
  if (!userName) {
    return res.status(400).json({
      success: false,
      error: 'User name is required'
    });
  }

  try {
    const result = roomService.joinRoom(roomId, userName, isAdmin);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }

    return res.status(201).json({
      success: true,
      data: { userId: result.userId }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to join room'
    });
  }
});

// Leave a room
router.delete('/:roomId/users/:userId', validateRoomId, validateUserId, (req: Request, res: Response<ApiResponse>) => {
  console.log('### leave room');

  const { roomId, userId } = req.params;
  
  try {
    const success = roomService.leaveRoom(roomId, userId);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Room or user not found'
      });
    }

    return res.json({
      success: true,
      data: { message: 'User left room successfully' }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to leave room'
    });
  }
});

// Update room story
router.put('/:roomId/story', validateRoomId, (req: Request, res: Response<ApiResponse>) => {
  console.log('### update room story');

  const { roomId } = req.params;
  const { userId, title, description }: StoryUpdateRequest & { userId: string } = req.body;
  
  if (!userId) {
    return res.status(400).json({
      success: false,
      error: 'User ID is required'
    });
  }

  try {
    const success = roomService.updateStory(roomId, userId, { title, description });
    
    if (!success) {
      return res.status(403).json({
        success: false,
        error: 'Only admin can update story or room not found'
      });
    }

    return res.json({
      success: true,
      data: { message: 'Story updated successfully' }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to update story'
    });
  }
});

// Submit a vote
router.post('/:roomId/vote', validateRoomId, (req: Request, res: Response<ApiResponse>) => {
  console.log('### submit vote');

  const { roomId } = req.params;
  const { userId, estimate }: VoteSubmission = req.body;
  
  if (!userId || !estimate) {
    return res.status(400).json({
      success: false,
      error: 'User ID and estimate are required'
    });
  }

  try {
    const success = roomService.submitVote(roomId, userId, estimate);
    
    if (!success) {
      return res.status(400).json({
        success: false,
        error: 'Failed to submit vote - room not found or voting closed'
      });
    }

    return res.json({
      success: true,
      data: { message: 'Vote submitted successfully' }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to submit vote'
    });
  }
});

// Reveal votes (admin only)
router.post('/:roomId/reveal', validateRoomId, (req: Request, res: Response<ApiResponse>) => {
  console.log('### reveal votes');

  const { roomId } = req.params;
  const { userId } = req.body;
  
  if (!userId) {
    return res.status(400).json({
      success: false,
      error: 'User ID is required'
    });
  }

  try {
    const success = roomService.revealVotes(roomId, userId);
    
    if (!success) {
      return res.status(403).json({
        success: false,
        error: 'Only admin can reveal votes or room not found'
      });
    }

    return res.json({
      success: true,
      data: { message: 'Votes revealed successfully' }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to reveal votes'
    });
  }
});

// Reset voting (admin only)
router.post('/:roomId/reset', validateRoomId, (req: Request, res: Response<ApiResponse>) => {
  console.log('### reset voting');

  const { roomId } = req.params;
  const { userId } = req.body;
  
  if (!userId) {
    return res.status(400).json({
      success: false,
      error: 'User ID is required'
    });
  }

  try {
    const success = roomService.resetVoting(roomId, userId);
    
    if (!success) {
      return res.status(403).json({
        success: false,
        error: 'Only admin can reset voting or room not found'
      });
    }

    return res.json({
      success: true,
      data: { message: 'Voting reset successfully' }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to reset voting'
    });
  }
});

// Get voting results
router.get('/:roomId/results', validateRoomId, (req: Request, res: Response<ApiResponse>) => {
  console.log('### get voting results');

  const { roomId } = req.params;
  
  try {
    const results = roomService.getVotingResults(roomId);
    
    if (!results) {
      return res.status(404).json({
        success: false,
        error: 'Room not found'
      });
    }

    return res.json({
      success: true,
      data: results
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to get voting results'
    });
  }
});

// Get users in room
router.get('/:roomId/users', validateRoomId, (req: Request, res: Response<ApiResponse>) => {
  console.log('### get users in room');
  
  const { roomId } = req.params;
  
  try {
    const users = roomService.getUsersInRoom(roomId);
    
    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get users'
    });
  }
});

export default router;