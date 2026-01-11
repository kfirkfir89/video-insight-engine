import { request } from "./client";
import type {
  Folder,
  FolderType,
  CreateFolderInput,
  UpdateFolderInput,
} from "@/types";

export interface ListFoldersParams {
  type?: FolderType;
  limit?: number;
  offset?: number;
}

export const foldersApi = {
  async list(params: ListFoldersParams = {}): Promise<{ folders: Folder[] }> {
    const searchParams = new URLSearchParams();
    if (params.type) searchParams.set("type", params.type);
    if (params.limit) searchParams.set("limit", String(params.limit));
    if (params.offset) searchParams.set("offset", String(params.offset));

    const query = searchParams.toString();
    return request(`/folders${query ? `?${query}` : ""}`);
  },

  async get(id: string): Promise<Folder> {
    return request(`/folders/${id}`);
  },

  async create(data: CreateFolderInput): Promise<Folder> {
    return request("/folders", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async update(id: string, data: UpdateFolderInput): Promise<Folder> {
    return request(`/folders/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  async delete(id: string, deleteContent?: boolean): Promise<void> {
    const searchParams = new URLSearchParams();
    if (deleteContent) searchParams.set("deleteContent", "true");

    const query = searchParams.toString();
    await request(`/folders/${id}${query ? `?${query}` : ""}`, {
      method: "DELETE",
    });
  },
};
