import { Button, Popconfirm, Space, Table, Tag } from 'antd';
import dayjs from 'dayjs';
import { Download, Folder, File as FileIcon, Trash2 } from 'lucide-react';
import type { RemoteFile } from '../../types/file';

export default function FileTable({
  files,
  loading,
  onEnter,
  onDelete,
  onRename,
  onDownload,
}: {
  files: RemoteFile[];
  loading: boolean;
  onEnter: (file: RemoteFile) => void;
  onDelete: (file: RemoteFile) => void;
  onRename: (file: RemoteFile) => void;
  onDownload: (file: RemoteFile) => void;
}) {
  return (
    <Table
      rowKey="path"
      loading={loading}
      dataSource={files}
      pagination={false}
      columns={[
        {
          title: '名称',
          dataIndex: 'name',
          render: (value, row) => (
            <Button
              type="link"
              icon={row.type === 'directory' ? <Folder size={16} /> : <FileIcon size={16} />}
              onDoubleClick={() => onEnter(row)}
              onClick={() => row.type === 'directory' && onEnter(row)}
            >
              {value}
            </Button>
          ),
        },
        { title: '类型', dataIndex: 'type', render: (value) => <Tag>{value}</Tag> },
        { title: '大小', dataIndex: 'size' },
        { title: '权限', dataIndex: 'permissions' },
        { title: '修改时间', dataIndex: 'modifyTime', render: (value) => dayjs(value).format('YYYY-MM-DD HH:mm:ss') },
        {
          title: '操作',
          render: (_, row) => (
            <Space>
              <Button onClick={() => onRename(row)}>重命名</Button>
              {row.type === 'file' && <Button icon={<Download size={16} />} onClick={() => onDownload(row)} />}
              <Popconfirm title="删除文件" description={row.path} onConfirm={() => onDelete(row)}>
                <Button danger icon={<Trash2 size={16} />} />
              </Popconfirm>
            </Space>
          ),
        },
      ]}
    />
  );
}
