export type Plan = 'free' | 'pro' | 'enterprise';
export type AppRole = 'admin' | 'manager' | 'technician' | 'viewer';
export type ProductStatus = 'available' | 'in_tour' | 'broken' | 'maintenance';
export type TourStatus = 'draft' | 'active' | 'closed' | 'cancelled';
export type IssueType = 'broken' | 'lost' | 'maintenance';
export type IssueStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export type Organization = {
  id: string;
  name: string;
  plan: Plan;
  created_at: string;
};

export type SaaSUser = {
  id: string;
  email: string;
  role: AppRole;
  organization_id: string;
  created_at: string;
  updated_at: string;
};

export type Product = {
  id: string;
  organization_id: string;
  name: string;
  profile_id?: string | null;
  status: ProductStatus;
  current_location?: string | null;
  assigned_tour_id?: string | null;
  technical_data: Record<string, unknown>;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type Tour = {
  id: string;
  organization_id: string;
  name: string;
  start_date?: string | null;
  end_date?: string | null;
  status: TourStatus;
  current_location?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
};

export type ProductMovement = {
  id: string;
  organization_id: string;
  product_id: string;
  from_location?: string | null;
  to_location?: string | null;
  user_id: string;
  timestamp: string;
  metadata: Record<string, unknown>;
};

export type Issue = {
  id: string;
  organization_id: string;
  product_id: string;
  type: IssueType;
  description?: string | null;
  photo_url?: string | null;
  status: IssueStatus;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
};

export type Billing = {
  organization_id: string;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  plan: Plan;
  status: string;
  current_period_end?: string | null;
  updated_at: string;
};

export type ActivityLog = {
  id: string;
  organization_id: string;
  user_id?: string | null;
  action: string;
  entity: string;
  entity_id?: string | null;
  payload: Record<string, unknown>;
  timestamp: string;
};
