import { describe, it, expect, beforeEach } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../../test/mocks/server";
import { foldersApi } from "../folders";
import { setAccessToken } from "../client";
import { createMockFolder } from "../../test/mocks/handlers";

const API_URL = "http://localhost:3000/api";

describe("foldersApi", () => {
  beforeEach(() => {
    localStorage.clear();
    setAccessToken("test-token");
  });

  describe("list", () => {
    it("should fetch folders without parameters", async () => {
      server.use(
        http.get(`${API_URL}/folders`, () => {
          return HttpResponse.json({
            folders: [
              createMockFolder({ id: "folder-1", name: "Folder 1" }),
              createMockFolder({ id: "folder-2", name: "Folder 2" }),
            ],
          });
        })
      );

      const result = await foldersApi.list();

      expect(result.folders).toHaveLength(2);
      expect(result.folders[0].name).toBe("Folder 1");
      expect(result.folders[1].name).toBe("Folder 2");
    });

    it("should filter by type when provided", async () => {
      let capturedUrl = "";

      server.use(
        http.get(`${API_URL}/folders`, ({ request }) => {
          capturedUrl = request.url;
          return HttpResponse.json({
            folders: [createMockFolder({ type: "videos" })],
          });
        })
      );

      await foldersApi.list({ type: "videos" });

      expect(capturedUrl).toContain("type=videos");
    });

    it("should include pagination params when provided", async () => {
      let capturedUrl = "";

      server.use(
        http.get(`${API_URL}/folders`, ({ request }) => {
          capturedUrl = request.url;
          return HttpResponse.json({ folders: [] });
        })
      );

      await foldersApi.list({ limit: 5, offset: 10 });

      expect(capturedUrl).toContain("limit=5");
      expect(capturedUrl).toContain("offset=10");
    });

    it("should return empty list when no folders exist", async () => {
      server.use(
        http.get(`${API_URL}/folders`, () => {
          return HttpResponse.json({ folders: [] });
        })
      );

      const result = await foldersApi.list();

      expect(result.folders).toHaveLength(0);
    });

    it("should filter by memorized type", async () => {
      let capturedUrl = "";

      server.use(
        http.get(`${API_URL}/folders`, ({ request }) => {
          capturedUrl = request.url;
          return HttpResponse.json({
            folders: [createMockFolder({ type: "memorized" })],
          });
        })
      );

      await foldersApi.list({ type: "memorized" });

      expect(capturedUrl).toContain("type=memorized");
    });

    it("should throw on API error", async () => {
      server.use(
        http.get(`${API_URL}/folders`, () => {
          return HttpResponse.json(
            { message: "Server error" },
            { status: 500 }
          );
        })
      );

      await expect(foldersApi.list()).rejects.toThrow("Server error");
    });
  });

  describe("get", () => {
    it("should fetch folder by id", async () => {
      server.use(
        http.get(`${API_URL}/folders/:id`, ({ params }) => {
          return HttpResponse.json(
            createMockFolder({
              id: params.id as string,
              name: "Fetched Folder",
              type: "videos",
            })
          );
        })
      );

      const folder = await foldersApi.get("folder-abc");

      expect(folder.id).toBe("folder-abc");
      expect(folder.name).toBe("Fetched Folder");
      expect(folder.type).toBe("videos");
    });

    it("should throw on not found", async () => {
      server.use(
        http.get(`${API_URL}/folders/:id`, () => {
          return HttpResponse.json(
            { message: "Folder not found", error: "NOT_FOUND" },
            { status: 404 }
          );
        })
      );

      await expect(foldersApi.get("nonexistent")).rejects.toThrow(
        "Folder not found"
      );
    });

    it("should return folder with all properties", async () => {
      server.use(
        http.get(`${API_URL}/folders/:id`, () => {
          return HttpResponse.json(
            createMockFolder({
              id: "folder-full",
              name: "Full Folder",
              type: "videos",
              parentId: "parent-folder",
              color: "#ff0000",
              icon: "folder-icon",
            })
          );
        })
      );

      const folder = await foldersApi.get("folder-full");

      expect(folder.parentId).toBe("parent-folder");
      expect(folder.color).toBe("#ff0000");
      expect(folder.icon).toBe("folder-icon");
    });
  });

  describe("create", () => {
    it("should create folder with name and type", async () => {
      let capturedBody: unknown = null;

      server.use(
        http.post(`${API_URL}/folders`, async ({ request }) => {
          capturedBody = await request.json();
          return HttpResponse.json(
            createMockFolder({
              id: "new-folder",
              name: "New Folder",
              type: "videos",
            })
          );
        })
      );

      const folder = await foldersApi.create({
        name: "New Folder",
        type: "videos",
      });

      expect(capturedBody).toEqual({
        name: "New Folder",
        type: "videos",
      });
      expect(folder.id).toBe("new-folder");
      expect(folder.name).toBe("New Folder");
      expect(folder.type).toBe("videos");
    });

    it("should create folder with optional parentId", async () => {
      let capturedBody: unknown = null;

      server.use(
        http.post(`${API_URL}/folders`, async ({ request }) => {
          capturedBody = await request.json();
          return HttpResponse.json(
            createMockFolder({
              parentId: "parent-123",
            })
          );
        })
      );

      await foldersApi.create({
        name: "Child Folder",
        type: "videos",
        parentId: "parent-123",
      });

      expect(capturedBody).toMatchObject({
        parentId: "parent-123",
      });
    });

    it("should create folder with color and icon", async () => {
      let capturedBody: unknown = null;

      server.use(
        http.post(`${API_URL}/folders`, async ({ request }) => {
          capturedBody = await request.json();
          return HttpResponse.json(
            createMockFolder({
              color: "#00ff00",
              icon: "star",
            })
          );
        })
      );

      await foldersApi.create({
        name: "Styled Folder",
        type: "memorized",
        color: "#00ff00",
        icon: "star",
      });

      expect(capturedBody).toMatchObject({
        color: "#00ff00",
        icon: "star",
      });
    });

    it("should throw on validation error", async () => {
      server.use(
        http.post(`${API_URL}/folders`, () => {
          return HttpResponse.json(
            { message: "Name is required", error: "VALIDATION_ERROR" },
            { status: 400 }
          );
        })
      );

      await expect(
        foldersApi.create({ name: "", type: "videos" })
      ).rejects.toThrow("Name is required");
    });

    it("should throw on duplicate name", async () => {
      server.use(
        http.post(`${API_URL}/folders`, () => {
          return HttpResponse.json(
            { message: "Folder with this name already exists", error: "DUPLICATE" },
            { status: 409 }
          );
        })
      );

      await expect(
        foldersApi.create({ name: "Existing Folder", type: "videos" })
      ).rejects.toThrow("Folder with this name already exists");
    });
  });

  describe("update", () => {
    it("should update folder name", async () => {
      let capturedBody: unknown = null;
      let capturedId: string | null = null;

      server.use(
        http.patch(`${API_URL}/folders/:id`, async ({ request, params }) => {
          capturedBody = await request.json();
          capturedId = params.id as string;
          return HttpResponse.json(
            createMockFolder({
              id: params.id as string,
              name: "Updated Name",
            })
          );
        })
      );

      const folder = await foldersApi.update("folder-123", {
        name: "Updated Name",
      });

      expect(capturedId).toBe("folder-123");
      expect(capturedBody).toEqual({ name: "Updated Name" });
      expect(folder.name).toBe("Updated Name");
    });

    it("should update folder parentId", async () => {
      let capturedBody: unknown = null;

      server.use(
        http.patch(`${API_URL}/folders/:id`, async ({ request }) => {
          capturedBody = await request.json();
          return HttpResponse.json(
            createMockFolder({ parentId: "new-parent" })
          );
        })
      );

      await foldersApi.update("folder-123", { parentId: "new-parent" });

      expect(capturedBody).toEqual({ parentId: "new-parent" });
    });

    it("should move folder to root (null parentId)", async () => {
      let capturedBody: unknown = null;

      server.use(
        http.patch(`${API_URL}/folders/:id`, async ({ request }) => {
          capturedBody = await request.json();
          return HttpResponse.json(createMockFolder({ parentId: null }));
        })
      );

      await foldersApi.update("folder-123", { parentId: null });

      expect(capturedBody).toEqual({ parentId: null });
    });

    it("should update color and icon", async () => {
      let capturedBody: unknown = null;

      server.use(
        http.patch(`${API_URL}/folders/:id`, async ({ request }) => {
          capturedBody = await request.json();
          return HttpResponse.json(
            createMockFolder({
              color: "#0000ff",
              icon: "heart",
            })
          );
        })
      );

      await foldersApi.update("folder-123", {
        color: "#0000ff",
        icon: "heart",
      });

      expect(capturedBody).toEqual({
        color: "#0000ff",
        icon: "heart",
      });
    });

    it("should throw on not found", async () => {
      server.use(
        http.patch(`${API_URL}/folders/:id`, () => {
          return HttpResponse.json(
            { message: "Folder not found", error: "NOT_FOUND" },
            { status: 404 }
          );
        })
      );

      await expect(
        foldersApi.update("nonexistent", { name: "New Name" })
      ).rejects.toThrow("Folder not found");
    });

    it("should throw on forbidden", async () => {
      server.use(
        http.patch(`${API_URL}/folders/:id`, () => {
          return HttpResponse.json(
            { message: "Not authorized to update this folder", error: "FORBIDDEN" },
            { status: 403 }
          );
        })
      );

      await expect(
        foldersApi.update("other-user-folder", { name: "Hacked" })
      ).rejects.toThrow("Not authorized to update this folder");
    });
  });

  describe("delete", () => {
    it("should delete folder by id", async () => {
      let deletedId: string | null = null;

      server.use(
        http.delete(`${API_URL}/folders/:id`, ({ params }) => {
          deletedId = params.id as string;
          return new HttpResponse(null, { status: 204 });
        })
      );

      await foldersApi.delete("folder-to-delete");

      expect(deletedId).toBe("folder-to-delete");
    });

    it("should complete without error on success", async () => {
      server.use(
        http.delete(`${API_URL}/folders/:id`, () => {
          return new HttpResponse(null, { status: 204 });
        })
      );

      await expect(foldersApi.delete("folder-123")).resolves.toBeUndefined();
    });

    it("should include deleteContent param when true", async () => {
      let capturedUrl = "";

      server.use(
        http.delete(`${API_URL}/folders/:id`, ({ request }) => {
          capturedUrl = request.url;
          return new HttpResponse(null, { status: 204 });
        })
      );

      await foldersApi.delete("folder-123", true);

      expect(capturedUrl).toContain("deleteContent=true");
    });

    it("should not include deleteContent param when false/undefined", async () => {
      let capturedUrl = "";

      server.use(
        http.delete(`${API_URL}/folders/:id`, ({ request }) => {
          capturedUrl = request.url;
          return new HttpResponse(null, { status: 204 });
        })
      );

      await foldersApi.delete("folder-123");

      expect(capturedUrl).not.toContain("deleteContent");
    });

    it("should throw on not found", async () => {
      server.use(
        http.delete(`${API_URL}/folders/:id`, () => {
          return HttpResponse.json(
            { message: "Folder not found", error: "NOT_FOUND" },
            { status: 404 }
          );
        })
      );

      await expect(foldersApi.delete("nonexistent")).rejects.toThrow(
        "Folder not found"
      );
    });

    it("should throw on folder not empty", async () => {
      server.use(
        http.delete(`${API_URL}/folders/:id`, () => {
          return HttpResponse.json(
            {
              message: "Folder is not empty. Use deleteContent=true to delete contents.",
              error: "FOLDER_NOT_EMPTY",
            },
            { status: 400 }
          );
        })
      );

      await expect(foldersApi.delete("folder-with-content")).rejects.toThrow(
        "Folder is not empty"
      );
    });

    it("should throw on forbidden", async () => {
      server.use(
        http.delete(`${API_URL}/folders/:id`, () => {
          return HttpResponse.json(
            { message: "Not authorized to delete this folder", error: "FORBIDDEN" },
            { status: 403 }
          );
        })
      );

      await expect(foldersApi.delete("other-user-folder")).rejects.toThrow(
        "Not authorized to delete this folder"
      );
    });
  });
});
