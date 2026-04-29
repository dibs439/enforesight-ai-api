export interface CreateCustomerRequest {
  email: string;
  firstName?: string;
  lastName?: string;
  password: string;
  subscriptionTier?: string;
  active?: boolean;
  phoneNumber?: string;
  occupation?: string;
  isSuspended?: boolean;
}

export interface UpdateCustomerRequest {
  email?: string;
  firstName?: string;
  lastName?: string;
  subscriptionTier?: string;
  active?: boolean;
  imageUrl?: string;
  phoneNumber?: string;
  occupation?: string;
  isSuspended?: boolean;
}
