export type Role = 'master_admin' | 'admin' | 'support' | 'viewer';

export interface Staff {
  id: number;
  username: string;
  email: string;
  full_name: string;
  role: Role;
  avatar: string | null;
  mfa_enabled: boolean;
  last_login_at: string | null;
  last_login_ip: string | null;
  last_login_location: string | null;
  permissions: Record<string, boolean>;
}

export type UserStatus = 'active' | 'cold' | 'locked' | 'blocked' | 'pending';

export interface User {
  id: number;
  username: string;
  email: string;
  full_name: string;
  status: UserStatus;
  phone: string | null;
  device: string | null;
  browser: string | null;
  ip: string | null;
  location: string | null;
  country: string | null;
  balance: number;
  limits: Record<string, number>;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface Lead {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  source: string;
  interest: string | null;
  region: string | null;
  tags: string[];
  stage: string;
  assigned_to: number | null;
  assignee_name?: string | null;
  value: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Campaign {
  id: number;
  name: string;
  type: string;
  status: string;
  budget: number;
  spent: number;
  impressions: number;
  clicks: number;
  conversions: number;
  roi: number;
  creator?: string | null;
}

export interface Order {
  id: number;
  user_id: number;
  username?: string;
  user_name?: string;
  asset: string;
  amount: number;
  side: string;
  result: string;
  live: number;
  created_at: string;
  updated_at: string;
}
