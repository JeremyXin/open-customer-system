export type UserRole = 'ADMIN' | 'AGENT';
export type UserStatus = 'ONLINE' | 'OFFLINE';

export interface User {
  id: number;
  email: string;
  displayName: string;
  role: UserRole;
  status: UserStatus;
}

export interface Agent extends User {
  role: 'AGENT';
}
