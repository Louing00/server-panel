export type RemoteFile = {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size: number;
  modifyTime: string;
  permissions: string;
};
