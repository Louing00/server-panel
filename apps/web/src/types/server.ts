export type Server = {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authType: 'password' | 'privateKey' | 'privateKeyWithPassphrase';
  tags: string[];
  groupId?: string | null;
  description?: string | null;
  status: 'unknown' | 'online' | 'offline';
  lastSuccessAt?: string | null;
  lastFailureAt?: string | null;
  lastFailureReason?: string | null;
  hasCredential: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ServerInput = {
  name: string;
  host: string;
  port: number;
  username: string;
  authType: Server['authType'];
  credential?: {
    password?: string;
    privateKey?: string;
    passphrase?: string;
  };
  tags: string[];
  description?: string | null;
};
