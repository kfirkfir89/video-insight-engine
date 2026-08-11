import { request } from "./client";
import type {
  Folder,
  CreateFolderInput,
  UpdateFolderInput,
} from "@/types";

export const foldersApi = {
  async list(): Promise<{ folders: Folder[] }> {
    return request("/folders");
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
