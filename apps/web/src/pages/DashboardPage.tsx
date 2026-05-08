import { useQuery } from '@tanstack/react-query';
import { Table, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import { listAuditLogs } from '../api/audit';
import { listServers } from '../api/servers';

export default function DashboardPage() {
  const servers = useQuery({ queryKey: ['servers'], queryFn: () => listServers() });
  const audits = useQuery({ queryKey: ['audit-logs', 'recent'], queryFn: () => listAuditLogs() });
  const serverItems = servers.data?.items ?? [];
  const failed = serverItems.filter((server) => server.status === 'offline').length;

  return (
    <>
      <div className="page-title">
        <Typography.Title level={3}>仪表盘</Typography.Title>
      </div>
      <div className="metric-grid">
        <div className="metric">
          <Typography.Text type="secondary">服务器总数</Typography.Text>
          <span className="metric-value">{servers.data?.total ?? 0}</span>
        </div>
        <div className="metric">
          <Typography.Text type="secondary">最近失败</Typography.Text>
          <span className="metric-value">{failed}</span>
        </div>
        <div className="metric">
          <Typography.Text type="secondary">审计事件</Typography.Text>
          <span className="metric-value">{audits.data?.total ?? 0}</span>
        </div>
        <div className="metric">
          <Typography.Text type="secondary">在线节点</Typography.Text>
          <span className="metric-value">
            {serverItems.filter((server) => server.status === 'online').length}
          </span>
        </div>
      </div>
      <Typography.Title level={4} style={{ marginTop: 24 }}>
        最近审计
      </Typography.Title>
      <Table
        rowKey="id"
        loading={audits.isLoading}
        dataSource={audits.data?.items ?? []}
        pagination={false}
        columns={[
          { title: '操作', dataIndex: 'action' },
          { title: '用户', render: (_, row) => row.user?.username ?? '-' },
          { title: '资源', render: (_, row) => row.resourceType ?? '-' },
          { title: 'IP', dataIndex: 'ip', render: (value) => value || '-' },
          {
            title: '时间',
            dataIndex: 'createdAt',
            render: (value) => <Tag>{dayjs(value).format('YYYY-MM-DD HH:mm:ss')}</Tag>,
          },
        ]}
      />
    </>
  );
}
