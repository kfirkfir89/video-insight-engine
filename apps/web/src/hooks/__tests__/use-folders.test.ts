import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { createWrapper } from "../../test/test-utils";
import { server } from "../../test/mocks/server";
import { createMockFolder } from "../../test/mocks/handlers";
import {
  useFolders,
  useFolder,
  useCreateFolder,
  useUpdateFolder,
  useDeleteFolder,
  useMoveFolder,
  useBulkDeleteFolders,
  useBulkMoveFolders,
} from "../use-folders";

const API_URL = "http://localhost:3000/api";

describe("useFolders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("useFolders", () => {
    it("should fetch all folders on mount", async () => {
      const { result } = renderHook(() => useFolders(), {
        wrapper: createWrapper(),
      });

      // Initial loading state
      expect(result.current.isLoading).toBe(true);

      // Wait for data to load
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Verify data
      expect(result.current.data?.folders).toHaveLength(2);
    });

    it("should handle loading state correctly", async () => {
      const { result } = renderHook(() => useFolders(), {
        wrapper: createWrapper(),
      });

      // Should be loading initially
      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // After load, should not be loading
      expect(result.current.isLoading).toBe(false);
    });

    it("should handle error state", async () => {
      server.use(
        http.get(`${API_URL}/folders`, () => {
          return HttpResponse.json(
            { message: "Server error" },
            { status: 500 }
          );
        })
      );

      const { result } = renderHook(() => useFolders(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
    });

    it("should filter folders by type", async () => {
      server.use(
        http.get(`${API_URL}/folders`, ({ request }) => {
          const url = new URL(request.url);
          const type = url.searchParams.get("type");

          if (type === "videos") {
            return HttpResponse.json({
              folders: [createMockFolder({ id: "folder-1", type: "videos" })],
            });
          }

          return HttpResponse.json({ folders: [] });
        })
      );

      const { result } = renderHook(() => useFolders("videos"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.folders).toHaveLength(1);
      expect(result.current.data?.folders[0].type).toBe("videos");
    });

    it("should support refetch functionality", async () => {
      const { result } = renderHook(() => useFolders(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Trigger refetch
      await act(async () => {
        await result.current.refetch();
      });

      await waitFor(() => {
        expect(result.current.isFetching).toBe(false);
      });

      expect(result.current.data?.folders).toHaveLength(2);
    });
  });

  describe("useFolder", () => {
    it("should fetch a single folder by ID", async () => {
      const { result } = renderHook(() => useFolder("folder-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.id).toBe("folder-1");
    });

    it("should not fetch when ID is empty", async () => {
      const { result } = renderHook(() => useFolder(""), {
        wrapper: createWrapper(),
      });

      // Should be disabled and not loading
      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeUndefined();
    });

    it("should handle 404 error", async () => {
      server.use(
        http.get(`${API_URL}/folders/:id`, () => {
          return new HttpResponse(null, { status: 404 });
        })
      );

      const { result } = renderHook(() => useFolder("nonexistent"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });
  });

  describe("useCreateFolder", () => {
    it("should create a new folder", async () => {
      const { result } = renderHook(() => useCreateFolder(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          name: "New Folder",
          type: "videos",
        });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.name).toBe("New Folder");
    });

    it("should create folder with parent ID", async () => {
      server.use(
        http.post(`${API_URL}/folders`, async ({ request }) => {
          const body = (await request.json()) as {
            name: string;
            type: string;
            parentId?: string;
          };
          return HttpResponse.json(
            createMockFolder({
              name: body.name,
              parentId: body.parentId,
            })
          );
        })
      );

      const { result } = renderHook(() => useCreateFolder(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          name: "Nested Folder",
          type: "videos",
          parentId: "folder-1",
        });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.parentId).toBe("folder-1");
    });

    it("should handle mutation error", async () => {
      server.use(
        http.post(`${API_URL}/folders`, () => {
          return HttpResponse.json(
            { message: "Name already exists" },
            { status: 409 }
          );
        })
      );

      const { result } = renderHook(() => useCreateFolder(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        try {
          await result.current.mutateAsync({
            name: "Duplicate",
            type: "videos",
          });
        } catch {
          // Expected error
        }
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });
  });

  describe("useUpdateFolder", () => {
    it("should update a folder", async () => {
      const { result } = renderHook(() => useUpdateFolder(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          id: "folder-1",
          data: { name: "Updated Name" },
        });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.name).toBe("Updated Name");
    });

    it("should update folder color and icon", async () => {
      server.use(
        http.patch(`${API_URL}/folders/:id`, async ({ params, request }) => {
          const body = (await request.json()) as {
            color?: string;
            icon?: string;
          };
          return HttpResponse.json(
            createMockFolder({
              id: params.id as string,
              color: body.color,
              icon: body.icon,
            })
          );
        })
      );

      const { result } = renderHook(() => useUpdateFolder(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          id: "folder-1",
          data: { color: "#ff0000", icon: "star" },
        });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.color).toBe("#ff0000");
      expect(result.current.data?.icon).toBe("star");
    });
  });

  describe("useDeleteFolder", () => {
    it("should delete a folder", async () => {
      const { result } = renderHook(() => useDeleteFolder(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({ id: "folder-1" });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
    });

    it("should delete folder with content", async () => {
      server.use(
        http.delete(`${API_URL}/folders/:id`, ({ request }) => {
          const url = new URL(request.url);
          const deleteContent = url.searchParams.get("deleteContent");
          // Verify deleteContent param is passed
          expect(deleteContent).toBe("true");
          return new HttpResponse(null, { status: 204 });
        })
      );

      const { result } = renderHook(() => useDeleteFolder(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          id: "folder-1",
          deleteContent: true,
        });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
    });

    it("should handle delete error", async () => {
      server.use(
        http.delete(`${API_URL}/folders/:id`, () => {
          return HttpResponse.json(
            { message: "Folder not empty" },
            { status: 400 }
          );
        })
      );

      const { result } = renderHook(() => useDeleteFolder(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        try {
          await result.current.mutateAsync({ id: "folder-1" });
        } catch {
          // Expected error
        }
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });
  });

  describe("useMoveFolder", () => {
    it("should move folder to a new parent", async () => {
      const { result } = renderHook(() => useMoveFolder(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          id: "folder-2",
          parentId: "folder-1",
        });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
    });

    it("should move folder to root (null parent)", async () => {
      const { result } = renderHook(() => useMoveFolder(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          id: "folder-2",
          parentId: null,
        });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
    });
  });

  describe("useBulkDeleteFolders", () => {
    it("should delete multiple folders", async () => {
      const { result } = renderHook(() => useBulkDeleteFolders(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          folderIds: ["folder-1", "folder-2"],
          deleteContent: false,
        });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
    });

    it("should delete multiple folders with content", async () => {
      const { result } = renderHook(() => useBulkDeleteFolders(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          folderIds: ["folder-1", "folder-2"],
          deleteContent: true,
        });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
    });
  });

  describe("useBulkMoveFolders", () => {
    it("should move multiple folders to a new parent", async () => {
      const { result } = renderHook(() => useBulkMoveFolders(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          folderIds: ["folder-2"],
          parentId: "folder-1",
        });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
    });

    it("should move multiple folders to root", async () => {
      const { result } = renderHook(() => useBulkMoveFolders(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          folderIds: ["folder-1", "folder-2"],
          parentId: null,
        });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
    });
  });
});
