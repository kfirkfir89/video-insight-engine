import { describe, it, expect } from 'vitest';
import {
  AppError,
  ValidationError,
  NotFoundError,
  FolderMoveError,
  VideoSummaryNotFoundError,
  SectionNotFoundError,
  ConceptNotFoundError,
  ExpansionNotFoundError,
} from './errors.js';

describe('AppError classes', () => {
  describe('FolderMoveError', () => {
    it('should have correct status and code', () => {
      const error = new FolderMoveError('Cannot move folder into itself');
      expect(error.status).toBe(400);
      expect(error.code).toBe('FOLDER_MOVE_ERROR');
      expect(error.message).toBe('Cannot move folder into itself');
    });
  });

  describe('VideoSummaryNotFoundError', () => {
    it('should have correct status and code', () => {
      const error = new VideoSummaryNotFoundError();
      expect(error.status).toBe(404);
      expect(error.code).toBe('VIDEO_SUMMARY_NOT_FOUND');
    });
  });

  describe('SectionNotFoundError', () => {
    it('should have correct status and code', () => {
      const error = new SectionNotFoundError();
      expect(error.status).toBe(404);
      expect(error.code).toBe('SECTION_NOT_FOUND');
    });
  });

  describe('ConceptNotFoundError', () => {
    it('should have correct status and code', () => {
      const error = new ConceptNotFoundError();
      expect(error.status).toBe(404);
      expect(error.code).toBe('CONCEPT_NOT_FOUND');
    });
  });

  describe('ExpansionNotFoundError', () => {
    it('should have correct status and code', () => {
      const error = new ExpansionNotFoundError();
      expect(error.status).toBe(404);
      expect(error.code).toBe('EXPANSION_NOT_FOUND');
    });
  });

  describe('inheritance', () => {
    it('all errors should extend AppError', () => {
      expect(new FolderMoveError()).toBeInstanceOf(AppError);
      expect(new VideoSummaryNotFoundError()).toBeInstanceOf(AppError);
      expect(new SectionNotFoundError()).toBeInstanceOf(AppError);
      expect(new ConceptNotFoundError()).toBeInstanceOf(AppError);
      expect(new ExpansionNotFoundError()).toBeInstanceOf(AppError);
    });
  });
});
