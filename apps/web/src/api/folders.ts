import { request } from "./client";
import type { Folder, FolderType } from "@/types";

export interface CreateFolderInput {
  name: string;
  type: FolderType;
  parentId?: string | null;
  color?: string | null;
  icon?: string | null;
}

export interface UpdateFolderInput {
  name?: string;
  parentId?: string | null;
  color?: string | null;
  icon?: string | null;
}

export const foldersApi = {
  async list(type?: FolderType): Promise<{ folders: Folder[] }> {
    const params = type ? `?type=${type}` : "";
    return request(`/folders${params}`);
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
    const params = deleteContent ? '?deleteContent=true' : '';
    await request(`/folders/${id}${params}`, { method: "DELETE" });
  },
};
