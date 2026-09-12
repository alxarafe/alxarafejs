export type Contact = {
  id: number;
  name: string;
  notes: string | null;
  isCustomer: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Address = {
  id: number;
  label: string | null;
  street: string;
  city: string;
  state: string | null;
  postalCode: string | null;
  country: string;
};

export type Channel = {
  id: number;
  channelTypeId: number;
  channelTypeName: string;
  value: string;
  label: string | null;
};

export type ContactDetail = Contact & {
  addresses: Address[];
  channels: Channel[];
};