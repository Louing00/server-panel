import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Input, Modal, Typography, Upload, message } from 'antd';
import { FolderPlus, RefreshCw, UploadCloud } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { deleteFile, downloadFile, listFiles, mkdir, rename, uploadFile } from '../api/files';
import { listServers } from '../api/servers';
import FileTable from '../components/FileManager/FileTable';
import PathBreadcrumb from '../components/FileManager/PathBreadcrumb';
import type { RemoteFile } from '../types/file';

function parentPath(current: string) {
  if (current === '.' || current === '/') return '.';
  const next = current.split('/').filter(Boolean).slice(0, -1).join('/');
  return next ? `/${next}` : '/';
}

export default function FileManagerPage() {
  const [search] = useSearchParams();
  const queryClient = useQueryClient();
  const servers = useQuery({ queryKey: ['servers'], queryFn: () => listServers() });
  const [serverId, setServerId] = useState(search.get('serverId') ?? '');
  const [path, setPath] = useState('.');
  const activeServerId = serverId || servers.data?.items[0]?.id || '';
  const files = useQuery({
    queryKey: ['files', activeServerId, path],
    queryFn: () => listFiles(activeServerId, path),
    enabled: Boolean(activeServerId),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['files', activeServerId] });

  const mutate = useMutation({
    mutationFn: async (task: () => Promise<unknown>) => task(),
    onSuccess: () => {
      message.success('操作完成');
      refresh();
    },
    onError: (error) => message.error(error instanceof Error ? error.message : '操作失败'),
  });

  const currentPath = files.data?.path ?? path;
  const selectedName = useMemo(
    () => servers.data?.items.find((server) => server.id === activeServerId)?.name ?? '未选择',
    [activeServerId, servers.data?.items],
  );

  return (
    <>
      <div className="page-title">
        <Typography.Title level={3}>文件管理</Typography.Title>
      </div>
      <div className="split-panel">
        <aside className="side-panel">
          {(servers.data?.items ?? []).map((server) => (
            <div
              key={server.id}
              className={`server-list-item ${activeServerId === server.id ? 'active' : ''}`}
              onClick={() => {
                setServerId(server.id);
                setPath('.');
              }}
            >
              <span>{server.name}</span>
            </div>
          ))}
        </aside>
        <main className="main-panel">
          <PathBreadcrumb path={currentPath} onChange={setPath} />
          <div className="toolbar" style={{ padding: 12 }}>
            <Typography.Text strong>{selectedName}</Typography.Text>
            <Button onClick={() => setPath(parentPath(currentPath))}>上级</Button>
            <Button icon={<RefreshCw size={16} />} onClick={refresh} />
            <Button
              icon={<FolderPlus size={16} />}
              onClick={() => {
                Modal.confirm({
                  title: '新建文件夹',
                  content: <Input id="mkdir-name" placeholder="folder-name" />,
                  onOk: async () => {
                    const input = document.getElementById('mkdir-name') as HTMLInputElement | null;
                    if (input?.value) {
                      await mutate.mutateAsync(() => mkdir(activeServerId, `${currentPath}/${input.value}`));
                    }
                  },
                });
              }}
            />
            <Upload
              showUploadList={false}
              beforeUpload={async (file) => {
                await mutate.mutateAsync(() => uploadFile(activeServerId, currentPath, file));
                return false;
              }}
            >
              <Button icon={<UploadCloud size={16} />}>上传</Button>
            </Upload>
          </div>
          <FileTable
            files={files.data?.items ?? []}
            loading={files.isLoading}
            onEnter={(file) => file.type === 'directory' && setPath(file.path)}
            onDelete={(file) => mutate.mutate(() => deleteFile(activeServerId, file.path))}
            onRename={(file) => {
              Modal.confirm({
                title: '重命名',
                content: <Input id="rename-name" defaultValue={file.name} />,
                onOk: async () => {
                  const input = document.getElementById('rename-name') as HTMLInputElement | null;
                  if (input?.value) {
                    const next = `${parentPath(file.path)}/${input.value}`;
                    await mutate.mutateAsync(() => rename(activeServerId, file.path, next));
                  }
                },
              });
            }}
            onDownload={(file) => {
              void downloadFile(activeServerId, file.path).catch((error) =>
                message.error(error instanceof Error ? error.message : '下载失败'),
              );
            }}
          />
        </main>
      </div>
    </>
  );
}
