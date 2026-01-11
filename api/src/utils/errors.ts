export class AppError extends Error {
  constructor(
    public code: string,
    public status: number,
    message?: string
  ) {
    super(message || code);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super('VALIDATION_ERROR', 400, message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super('NOT_FOUND', 404, `${resource} not found`);
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super('UNAUTHORIZED', 401, message);
    this.name = 'UnauthorizedError';
  }
}

export class ConflictError extends AppError {
  constructor(code: string, message: string) {
    super(code, 409, message);
    this.name = 'ConflictError';
  }
}

// Video-specific errors
export class InvalidYouTubeUrlError extends AppError {
  constructor() {
    super('INVALID_YOUTUBE_URL', 400, 'Invalid YouTube URL');
    this.name = 'InvalidYouTubeUrlError';
  }
}

export class VideoNotFoundError extends AppError {
  constructor() {
    super('VIDEO_NOT_FOUND', 404, 'Video not found');
    this.name = 'VideoNotFoundError';
  }
}

// Auth-specific errors
export class EmailExistsError extends AppError {
  constructor() {
    super('EMAIL_EXISTS', 409, 'Email already exists');
    this.name = 'EmailExistsError';
  }
}

export class InvalidCredentialsError extends AppError {
  constructor() {
    super('INVALID_CREDENTIALS', 401, 'Invalid email or password');
    this.name = 'InvalidCredentialsError';
  }
}

export class UserNotFoundError extends AppError {
  constructor() {
    super('USER_NOT_FOUND', 404, 'User not found');
    this.name = 'UserNotFoundError';
  }
}

// Folder-specific errors
export class FolderNotFoundError extends AppError {
  constructor() {
    super('FOLDER_NOT_FOUND', 404, 'Folder not found');
    this.name = 'FolderNotFoundError';
  }
}

// Memorize-specific errors
export class MemorizedItemNotFoundError extends AppError {
  constructor() {
    super('MEMORIZED_ITEM_NOT_FOUND', 404, 'Memorized item not found');
    this.name = 'MemorizedItemNotFoundError';
  }
}

export class ParentFolderNotFoundError extends AppError {
  constructor() {
    super('PARENT_FOLDER_NOT_FOUND', 400, 'Parent folder not found');
    this.name = 'ParentFolderNotFoundError';
  }
}

// External service errors
export class ServiceTimeoutError extends AppError {
  constructor(service: string) {
    super('SERVICE_TIMEOUT', 504, `${service} service timed out`);
    this.name = 'ServiceTimeoutError';
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(service: string) {
    super('SERVICE_UNAVAILABLE', 503, `${service} service unavailable`);
    this.name = 'ServiceUnavailableError';
  }
}
