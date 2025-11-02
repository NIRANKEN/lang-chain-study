import { Response, Request, NextFunction } from "express";
import { ErrorResponse } from "../types";

export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export function handleError(error: Error, res: Response): void {
  console.error("Error:", error);

  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      error: error.message,
    } as ErrorResponse);
    return;
  }

  // Default to 500 server error
  res.status(500).json({
    error: "Internal server error",
    details: error.message,
  } as ErrorResponse);
}

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}