export interface CannedResponse {
  id: number;
  shortcut: string;
  content: string;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
}

export interface CannedResponseRequest {
  shortcut: string;
  content: string;
}
