import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExplainerClient } from '../explainer-client.js';
import { ServiceTimeoutError, ServiceUnavailableError } from '../../utils/errors.js';

// Mock MCP SDK
const mockCallTool = vi.fn();
const mockConnect = vi.fn();

vi.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: vi.fn().mockImplementation(() => ({
    connect: mockConnect,
    callTool: mockCallTool,
  })),
}));

vi.mock('@modelcontextprotocol/sdk/client/streamableHttp.js', () => ({
  StreamableHTTPClientTransport: vi.fn(),
}));

const mockLogger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
  fatal: vi.fn(),
  trace: vi.fn(),
  child: vi.fn().mockReturnThis(),
  level: 'info',
  silent: vi.fn(),
} as any;

describe('ExplainerClient', () => {
  let client: ExplainerClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new ExplainerClient(mockLogger);
    mockConnect.mockResolvedValue(undefined);
  });

  describe('explainAuto', () => {
    it('should call explain_auto MCP tool with correct args', async () => {
      mockCallTool.mockResolvedValue({
        content: [{ type: 'text', text: 'Explanation content' }],
      });

      const result = await client.explainAuto('video123', 'section', 'section456');

      expect(mockCallTool).toHaveBeenCalledWith({
        name: 'explain_auto',
        arguments: {
          video_summary_id: 'video123',
          target_type: 'section',
          target_id: 'section456',
        },
      });
      expect(result).toEqual({ expansion: 'Explanation content' });
    });

    it('should handle concept target type', async () => {
      mockCallTool.mockResolvedValue({
        content: [{ type: 'text', text: 'Concept explanation' }],
      });

      const result = await client.explainAuto('video123', 'concept', 'concept789');

      expect(mockCallTool).toHaveBeenCalledWith({
        name: 'explain_auto',
        arguments: {
          video_summary_id: 'video123',
          target_type: 'concept',
          target_id: 'concept789',
        },
      });
      expect(result).toEqual({ expansion: 'Concept explanation' });
    });

    it('should throw ServiceUnavailableError on empty response', async () => {
      mockCallTool.mockResolvedValue({ content: [] });

      await expect(client.explainAuto('v', 'section', 's'))
        .rejects.toThrow(ServiceUnavailableError);
    });

    it('should throw ServiceUnavailableError on unexpected errors and reset client', async () => {
      mockCallTool.mockRejectedValue(new Error('Connection failed'));

      await expect(client.explainAuto('v', 'section', 's'))
        .rejects.toThrow(ServiceUnavailableError);
    });

    it('should rethrow ServiceTimeoutError directly', async () => {
      mockCallTool.mockRejectedValue(new ServiceTimeoutError('Explainer'));

      await expect(client.explainAuto('v', 'section', 's'))
        .rejects.toThrow(ServiceTimeoutError);
    });
  });

  describe('videoChat', () => {
    it('should call video_chat MCP tool with correct args', async () => {
      mockCallTool.mockResolvedValue({
        content: [{ type: 'text', text: 'Chat response' }],
      });

      const result = await client.videoChat('video123', 'What is this about?');

      expect(mockCallTool).toHaveBeenCalledWith({
        name: 'video_chat',
        arguments: {
          video_summary_id: 'video123',
          user_message: 'What is this about?',
          chat_history: null,
        },
      });
      expect(result).toEqual({ response: 'Chat response' });
    });

    it('should pass serialized chat history when provided', async () => {
      const chatHistory = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi!' },
      ];
      mockCallTool.mockResolvedValue({
        content: [{ type: 'text', text: 'Follow-up response' }],
      });

      await client.videoChat('video123', 'Follow up', chatHistory);

      expect(mockCallTool).toHaveBeenCalledWith({
        name: 'video_chat',
        arguments: {
          video_summary_id: 'video123',
          user_message: 'Follow up',
          chat_history: chatHistory,
        },
      });
    });

    it('should throw ServiceUnavailableError on empty response', async () => {
      mockCallTool.mockResolvedValue({ content: [] });

      await expect(client.videoChat('v', 'msg'))
        .rejects.toThrow(ServiceUnavailableError);
    });

    it('should throw ServiceUnavailableError on unexpected errors and reset client', async () => {
      mockCallTool.mockRejectedValue(new Error('Connection lost'));

      await expect(client.videoChat('v', 'msg'))
        .rejects.toThrow(ServiceUnavailableError);
    });

    it('should rethrow ServiceTimeoutError directly', async () => {
      mockCallTool.mockRejectedValue(new ServiceTimeoutError('Explainer'));

      await expect(client.videoChat('v', 'msg'))
        .rejects.toThrow(ServiceTimeoutError);
    });
  });

  describe('connection management', () => {
    it('should connect on first call and reuse client', async () => {
      mockCallTool.mockResolvedValue({
        content: [{ type: 'text', text: 'Response' }],
      });

      await client.explainAuto('v', 'section', 's');
      await client.explainAuto('v2', 'concept', 'c');

      // connect should only be called once
      expect(mockConnect).toHaveBeenCalledTimes(1);
    });

    it('should throw ServiceUnavailableError when connection fails', async () => {
      mockConnect.mockRejectedValue(new Error('Connection refused'));

      await expect(client.explainAuto('v', 'section', 's'))
        .rejects.toThrow(ServiceUnavailableError);
    });
  });
});
