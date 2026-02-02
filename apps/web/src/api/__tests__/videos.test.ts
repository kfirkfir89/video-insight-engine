import { describe, it, expect, beforeEach } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../../test/mocks/server";
import { videosApi } from "../videos";
import { setAccessToken } from "../client";
import { createMockVideo, createMockVideoSummary } from "../../test/mocks/handlers";

const API_URL = "http://localhost:3000/api";

describe("videosApi", () => {
  beforeEach(() => {
    localStorage.clear();
    setAccessToken("test-token");
  });

  describe("list", () => {
    it("should fetch videos without parameters", async () => {
      server.use(
        http.get(`${API_URL}/videos`, () => {
          return HttpResponse.json({
            videos: [
              createMockVideo({ id: "video-1", title: "First Video" }),
              createMockVideo({ id: "video-2", title: "Second Video" }),
            ],
            total: 2,
            hasMore: false,
          });
        })
      );

      const result = await videosApi.list();

      expect(result.videos).toHaveLength(2);
      expect(result.videos[0].title).toBe("First Video");
      expect(result.videos[1].title).toBe("Second Video");
      expect(result.total).toBe(2);
      expect(result.hasMore).toBe(false);
    });

    it("should include folderId in query params when provided", async () => {
      let capturedUrl = "";

      server.use(
        http.get(`${API_URL}/videos`, ({ request }) => {
          capturedUrl = request.url;
          return HttpResponse.json({
            videos: [createMockVideo({ folderId: "folder-123" })],
            total: 1,
            hasMore: false,
          });
        })
      );

      await videosApi.list({ folderId: "folder-123" });

      expect(capturedUrl).toContain("folderId=folder-123");
    });

    it("should include pagination params when provided", async () => {
      let capturedUrl = "";

      server.use(
        http.get(`${API_URL}/videos`, ({ request }) => {
          capturedUrl = request.url;
          return HttpResponse.json({
            videos: [],
            total: 100,
            hasMore: true,
          });
        })
      );

      await videosApi.list({ limit: 10, offset: 20 });

      expect(capturedUrl).toContain("limit=10");
      expect(capturedUrl).toContain("offset=20");
    });

    it("should return empty list when no videos exist", async () => {
      server.use(
        http.get(`${API_URL}/videos`, () => {
          return HttpResponse.json({
            videos: [],
            total: 0,
            hasMore: false,
          });
        })
      );

      const result = await videosApi.list();

      expect(result.videos).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it("should throw on API error", async () => {
      server.use(
        http.get(`${API_URL}/videos`, () => {
          return HttpResponse.json(
            { message: "Server error" },
            { status: 500 }
          );
        })
      );

      await expect(videosApi.list()).rejects.toThrow("Server error");
    });
  });

  describe("get", () => {
    it("should fetch video by id with summary", async () => {
      server.use(
        http.get(`${API_URL}/videos/:id`, ({ params }) => {
          return HttpResponse.json({
            video: createMockVideo({
              id: params.id as string,
              title: "Fetched Video",
            }),
            summary: createMockVideoSummary({
              videoId: params.id as string,
              overview: "Video overview",
            }),
          });
        })
      );

      const result = await videosApi.get("video-abc");

      expect(result.video.id).toBe("video-abc");
      expect(result.video.title).toBe("Fetched Video");
      expect(result.summary?.overview).toBe("Video overview");
    });

    it("should return null summary when video has no summary", async () => {
      server.use(
        http.get(`${API_URL}/videos/:id`, ({ params }) => {
          return HttpResponse.json({
            video: createMockVideo({
              id: params.id as string,
              processingStatus: "pending",
            }),
            summary: null,
          });
        })
      );

      const result = await videosApi.get("video-pending");

      expect(result.video.id).toBe("video-pending");
      expect(result.summary).toBeNull();
    });

    it("should throw on not found", async () => {
      server.use(
        http.get(`${API_URL}/videos/:id`, () => {
          return HttpResponse.json(
            { message: "Video not found", error: "NOT_FOUND" },
            { status: 404 }
          );
        })
      );

      await expect(videosApi.get("nonexistent")).rejects.toThrow(
        "Video not found"
      );
    });
  });

  describe("create", () => {
    it("should create video with URL only", async () => {
      let capturedBody: unknown = null;

      server.use(
        http.post(`${API_URL}/videos`, async ({ request }) => {
          capturedBody = await request.json();
          return HttpResponse.json({
            video: createMockVideo({
              id: "new-video",
              title: "New YouTube Video",
            }),
            cached: false,
          });
        })
      );

      const result = await videosApi.create(
        "https://www.youtube.com/watch?v=abc123"
      );

      expect(capturedBody).toEqual({
        url: "https://www.youtube.com/watch?v=abc123",
        folderId: undefined,
        bypassCache: undefined,
        providers: undefined,
      });
      expect(result.video.id).toBe("new-video");
      expect(result.cached).toBe(false);
    });

    it("should create video with folderId", async () => {
      let capturedBody: unknown = null;

      server.use(
        http.post(`${API_URL}/videos`, async ({ request }) => {
          capturedBody = await request.json();
          return HttpResponse.json({
            video: createMockVideo({ folderId: "folder-456" }),
            cached: false,
          });
        })
      );

      await videosApi.create(
        "https://www.youtube.com/watch?v=xyz789",
        "folder-456"
      );

      expect(capturedBody).toMatchObject({
        url: "https://www.youtube.com/watch?v=xyz789",
        folderId: "folder-456",
      });
    });

    it("should create video with bypassCache option", async () => {
      let capturedBody: unknown = null;

      server.use(
        http.post(`${API_URL}/videos`, async ({ request }) => {
          capturedBody = await request.json();
          return HttpResponse.json({
            video: createMockVideo(),
            cached: false,
          });
        })
      );

      await videosApi.create(
        "https://www.youtube.com/watch?v=test",
        undefined,
        true
      );

      expect(capturedBody).toMatchObject({
        bypassCache: true,
      });
    });

    it("should create video with provider config", async () => {
      let capturedBody: unknown = null;

      server.use(
        http.post(`${API_URL}/videos`, async ({ request }) => {
          capturedBody = await request.json();
          return HttpResponse.json({
            video: createMockVideo(),
            cached: false,
          });
        })
      );

      await videosApi.create(
        "https://www.youtube.com/watch?v=test",
        undefined,
        false,
        {
          default: "anthropic",
          fast: "openai",
          fallback: "gemini",
        }
      );

      expect(capturedBody).toMatchObject({
        providers: {
          default: "anthropic",
          fast: "openai",
          fallback: "gemini",
        },
      });
    });

    it("should return cached flag when video already exists", async () => {
      server.use(
        http.post(`${API_URL}/videos`, () => {
          return HttpResponse.json({
            video: createMockVideo({ id: "existing-video" }),
            cached: true,
          });
        })
      );

      const result = await videosApi.create(
        "https://www.youtube.com/watch?v=existing"
      );

      expect(result.cached).toBe(true);
    });

    it("should throw on invalid URL", async () => {
      server.use(
        http.post(`${API_URL}/videos`, () => {
          return HttpResponse.json(
            { message: "Invalid YouTube URL", error: "INVALID_URL" },
            { status: 400 }
          );
        })
      );

      await expect(videosApi.create("not-a-valid-url")).rejects.toThrow(
        "Invalid YouTube URL"
      );
    });
  });

  describe("delete", () => {
    it("should delete video by id", async () => {
      let deletedId: string | null = null;

      server.use(
        http.delete(`${API_URL}/videos/:id`, ({ params }) => {
          deletedId = params.id as string;
          return new HttpResponse(null, { status: 204 });
        })
      );

      await videosApi.delete("video-to-delete");

      expect(deletedId).toBe("video-to-delete");
    });

    it("should complete without error on success", async () => {
      server.use(
        http.delete(`${API_URL}/videos/:id`, () => {
          return new HttpResponse(null, { status: 204 });
        })
      );

      await expect(videosApi.delete("video-123")).resolves.toBeUndefined();
    });

    it("should throw on not found", async () => {
      server.use(
        http.delete(`${API_URL}/videos/:id`, () => {
          return HttpResponse.json(
            { message: "Video not found", error: "NOT_FOUND" },
            { status: 404 }
          );
        })
      );

      await expect(videosApi.delete("nonexistent")).rejects.toThrow(
        "Video not found"
      );
    });

    it("should throw on forbidden", async () => {
      server.use(
        http.delete(`${API_URL}/videos/:id`, () => {
          return HttpResponse.json(
            { message: "Not authorized to delete this video", error: "FORBIDDEN" },
            { status: 403 }
          );
        })
      );

      await expect(videosApi.delete("other-user-video")).rejects.toThrow(
        "Not authorized to delete this video"
      );
    });
  });

  describe("moveToFolder", () => {
    it("should move video to folder", async () => {
      let capturedBody: unknown = null;
      let capturedId: string | null = null;

      server.use(
        http.patch(`${API_URL}/videos/:id/move`, async ({ request, params }) => {
          capturedBody = await request.json();
          capturedId = params.id as string;
          return HttpResponse.json({ success: true });
        })
      );

      const result = await videosApi.moveToFolder("video-123", "folder-456");

      expect(capturedId).toBe("video-123");
      expect(capturedBody).toEqual({ folderId: "folder-456" });
      expect(result.success).toBe(true);
    });

    it("should move video out of folder (to root)", async () => {
      let capturedBody: unknown = null;

      server.use(
        http.patch(`${API_URL}/videos/:id/move`, async ({ request }) => {
          capturedBody = await request.json();
          return HttpResponse.json({ success: true });
        })
      );

      await videosApi.moveToFolder("video-123", null);

      expect(capturedBody).toEqual({ folderId: null });
    });

    it("should throw on video not found", async () => {
      server.use(
        http.patch(`${API_URL}/videos/:id/move`, () => {
          return HttpResponse.json(
            { message: "Video not found", error: "NOT_FOUND" },
            { status: 404 }
          );
        })
      );

      await expect(
        videosApi.moveToFolder("nonexistent", "folder-123")
      ).rejects.toThrow("Video not found");
    });

    it("should throw on folder not found", async () => {
      server.use(
        http.patch(`${API_URL}/videos/:id/move`, () => {
          return HttpResponse.json(
            { message: "Folder not found", error: "NOT_FOUND" },
            { status: 404 }
          );
        })
      );

      await expect(
        videosApi.moveToFolder("video-123", "nonexistent-folder")
      ).rejects.toThrow("Folder not found");
    });
  });
});
