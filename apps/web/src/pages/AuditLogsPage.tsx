import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, Input, Modal, Table, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import { listAuditLogs } from '../api/audit';

export default function AuditLogsPage() {
  const [action, setAction] = useState('');
  const [detail, setDetail] = useState<unknown>();
  const logs = useQuery({ queryKey: ['audit-logs', action], queryFn: () => listAuditLogs(action) });
  return (
    <>
      <div className="page-title">
        <Typography.Title level={3}>审计日志</Typography.Title>
      </div>
      <div className="toolbar">
        <Input.Search placeholder="按操作过滤" allowClear onSearch={setAction} style={{ maxWidth: 320 }} />
      </div>
      <Table
        rowKey="id"
        loading={logs.isLoading}
        dataSource={logs.data?.items ?? []}
        columns={[
          { title: '操作', dataIndex: 'action', render: (value) => <Tag>{value}</Tag> },
          { title: '用户', render: (_, row) => row.user?.username ?? '-' },
          { title: '资源', render: (_, row) => row.resourceId ?? '-' },
          { title: 'IP', dataIndex: 'ip', render: (value) => value || '-' },
          { title: '时间', dataIndex: 'createdAt', render: (value) => dayjs(value).format('YYYY-MM-DD HH:mm:ss') },
          { title: '详情', render: (_, row) => <Button onClick={() => setDetail(row.detail)}>查看</Button> },
        ]}
      />
      <Modal title="审计详情" open={detail !== undefined} onCancel={() => setDetail(undefined)} footer={null}>
        <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(detail, null, 2)}</pre>
      </Modal>
    </>
  );
}
