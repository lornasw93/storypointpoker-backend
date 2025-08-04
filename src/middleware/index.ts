import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../types';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction
): void => {
  console.error('Error:', err);

  const response: ApiResponse = {
    success: false,
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message
  };

  res.status(500).json(response);
};

export const notFound = (req: Request, res: Response<ApiResponse>): void => {
  const response: ApiResponse = {
    success: false,
    error: `Route ${req.originalUrl} not found`
  };
  
  res.status(404).json(response);
};

export const validateRoomId = (
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction
): void => {
  const { roomId } = req.params;
  
  if (!roomId || roomId.length !== 6) {
    const response: ApiResponse = {
      success: false,
      error: 'Invalid room ID format'
    };
    res.status(400).json(response);
    return;
  }
  
  next();
};

export const validateUserId = (
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction
): void => {
  const { userId } = req.params;
  const userIdFromBody = req.body?.userId;
  const userIdToCheck = userId || userIdFromBody;
  
  if (!userIdToCheck) {
    const response: ApiResponse = {
      success: false,
      error: 'User ID is required'
    };
    res.status(400).json(response);
    return;
  }
  
  next();
};
