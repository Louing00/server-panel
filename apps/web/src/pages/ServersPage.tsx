import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Alert,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Progress,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd';
import { BarChart3, FolderOpen, PlugZap, Plus, RefreshCw, TerminalSquare, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createServer, deleteServer, getServerMetrics, listServers, refreshServerStatus, testServer, updateServer } from '../api/servers';
import type { Server, ServerInput, ServerMetrics } from '../types/server';

function toTags(value?: string) {
  return value
    ?.split(',')
    .map((tag) => tag.trim())
    .filter(Boolean) ?? [];
}

function ServerModal({
  open,
  current,
  onCancel,
  onSubmit,
}: {
  open: boolean;
  current?: Server | null;
  onCancel: () => void;
  onSubmit: (values: ServerInput) => Promise<void>;
}) {
  const [form] = Form.useForm();
  return (
    <Modal
      title={current ? '编辑服务器' : '新增服务器'}
      open={open}
      onCancel={onCancel}
      onOk={() => form.submit()}
      destroyOnClose
      width={720}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          authType: current?.authType ?? 'password',
          port: current?.port ?? 22,
          name: current?.name,
          host: current?.host,
          username: current?.username,
          tags: current?.tags?.join(', '),
          description: current?.description,
        }}
        onFinish={async (values) => {
          const payload: ServerInput = {
            name: values.name,
            host: values.host,
            port: Number(values.port),
            username: values.username,
            authType: values.authType,
            tags: toTags(values.tags),
            description: values.description,
          };
          const credential = {
            password: values.password,
            privateKey: values.privateKey,
            passphrase: values.passphrase,
          };
          if (credential.password || credential.privateKey || credential.passphrase) {
            payload.credential = credential;
          }
          await onSubmit(payload);
        }}
      >
        <Form.Item name="name" label="名称" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Space.Compact style={{ width: '100%' }}>
          <Form.Item name="host" label="主机地址" rules={[{ required: true }]} style={{ width: '70%' }}>
            <Input />
          </Form.Item>
          <Form.Item name="port" label="端口" rules={[{ required: true }]} style={{ width: '30%' }}>
            <InputNumber min={1} max={65535} style={{ width: '100%' }} />
          </Form.Item>
        </Space.Compact>
        <Form.Item name="username" label="登录用户名" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item name="authType" label="认证方式">
          <Select
            options={[
              { label: '密码', value: 'password' },
              { label: '私钥', value: 'privateKey' },
              { label: '私钥 + passphrase', value: 'privateKeyWithPassphrase' },
            ]}
          />
        </Form.Item>
        <Form.Item noStyle shouldUpdate={(prev, next) => prev.authType !== next.authType}>
          {({ getFieldValue }) =>
            getFieldValue('authType') === 'password' ? (
              <Form.Item name="password" label={current ? '新密码（留空则不变）' : '密码'}>
                <Input.Password />
              </Form.Item>
            ) : (
              <>
                <Form.Item name="privateKey" label={current ? '新私钥（留空则不变）' : '私钥'}>
                  <Input.TextArea rows={5} />
                </Form.Item>
                <Form.Item name="passphrase" label="Passphrase">
                  <Input.Password />
                </Form.Item>
              </>
            )
          }
        </Form.Item>
        <Form.Item name="tags" label="标签">
          <Input placeholder="hk, proxy, prod" />
        </Form.Item>
        <Form.Item name="description" label="备注">
          <Input.TextArea rows={3} />
        </Form.Item>
      </Form>
    </Modal>
  );
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  let size = value;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }
  return `${size >= 10 || index === 0 ? size.toFixed(0) : size.toFixed(1)} ${units[index]}`;
}

function formatUptime(seconds: number) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${days} 天 ${hours} 小时 ${minutes} 分钟`;
}

function MetricProgress({ label, percent }: { label: string; percent: number }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <Typography.Text>{label}</Typography.Text>
      <Progress
        percent={Math.round(percent * 10) / 10}
        status={percent >= 90 ? 'exception' : percent >= 75 ? 'active' : 'normal'}
      />
    </div>
  );
}

function ServerMetricsModal({
  server,
  metrics,
  loading,
  error,
  onCancel,
}: {
  server?: Server | null;
  metrics?: ServerMetrics;
  loading: boolean;
  error?: unknown;
  onCancel: () => void;
}) {
  return (
    <Modal
      title={server ? `${server.name} · 服务器详情` : '服务器详情'}
      open={Boolean(server)}
      onCancel={onCancel}
      footer={null}
      width={760}
    >
      {error ? (
        <Alert
          type="error"
          showIcon
          message="服务器详情获取失败"
          description={error instanceof Error ? error.message : '请检查 SSH 凭据和目标服务器状态'}
        />
      ) : loading || !metrics ? (
        <Typography.Text type="secondary">正在采集服务器指标...</Typography.Text>
      ) : (
        <>
          <Descriptions column={2} size="small" style={{ marginBottom: 18 }}>
            <Descriptions.Item label="主机名">{metrics.hostname || '-'}</Descriptions.Item>
            <Descriptions.Item label="挂载点">{metrics.disk.mount}</Descriptions.Item>
            <Descriptions.Item label="运行时长">{formatUptime(metrics.uptimeSeconds)}</Descriptions.Item>
            <Descriptions.Item label="采集时间">
              {new Date(metrics.collectedAt).toLocaleString()}
            </Descriptions.Item>
          </Descriptions>
          <MetricProgress label="CPU 占用" percent={metrics.cpu.usagePercent} />
          <MetricProgress label="内存占用" percent={metrics.memory.usagePercent} />
          <Typography.Text type="secondary">
            {formatBytes(metrics.memory.usedBytes)} / {formatBytes(metrics.memory.totalBytes)}
          </Typography.Text>
          <MetricProgress label="硬盘占用" percent={metrics.disk.usagePercent} />
          <Typography.Text type="secondary">
            {formatBytes(metrics.disk.usedBytes)} / {formatBytes(metrics.disk.totalBytes)}
          </Typography.Text>
          <Descriptions column={3} size="small" style={{ marginTop: 18 }}>
            <Descriptions.Item label="入站流量">{formatBytes(metrics.network.rxBytes)}</Descriptions.Item>
            <Descriptions.Item label="出站流量">{formatBytes(metrics.network.txBytes)}</Descriptions.Item>
            <Descriptions.Item label="总流量">{formatBytes(metrics.network.totalBytes)}</Descriptions.Item>
          </Descriptions>
        </>
      )}
    </Modal>
  );
}

export default function ServersPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [keyword, setKeyword] = useState('');
  const [editing, setEditing] = useState<Server | null>();
  const [metricsServer, setMetricsServer] = useState<Server | null>(null);
  const servers = useQuery({ queryKey: ['servers', keyword], queryFn: () => listServers(keyword) });

  const saveMutation = useMutation({
    mutationFn: (payload: ServerInput) => (editing ? updateServer(editing.id, payload) : createServer(payload)),
    onSuccess: async () => {
      message.success('已保存');
      setEditing(undefined);
      await queryClient.invalidateQueries({ queryKey: ['servers'] });
    },
  });

  const testMutation = useMutation({
    mutationFn: testServer,
    onSuccess: (data) => message.success(`连接成功：${data.latencyMs}ms`),
    onError: (error) => message.error(error instanceof Error ? error.message : '连接失败'),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['servers'] }),
  });

  const refreshStatusMutation = useMutation({
    mutationFn: () => refreshServerStatus((servers.data?.items ?? []).map((server) => server.id)),
    onSuccess: async (data) => {
      message.success(`状态刷新完成：在线 ${data.online}，离线 ${data.offline}`);
      await queryClient.invalidateQueries({ queryKey: ['servers'] });
    },
    onError: (error) => message.error(error instanceof Error ? error.message : '状态刷新失败'),
  });

  const metricsQuery = useQuery({
    queryKey: ['server-metrics', metricsServer?.id],
    queryFn: () => getServerMetrics(metricsServer!.id),
    enabled: Boolean(metricsServer?.id),
    retry: false,
  });

  return (
    <>
      <div className="page-title">
        <Typography.Title level={3}>服务器</Typography.Title>
        <Button type="primary" icon={<Plus size={16} />} onClick={() => setEditing(null)}>
          新增
        </Button>
      </div>
      <div className="toolbar">
        <Input.Search placeholder="搜索名称、主机、用户" allowClear onSearch={setKeyword} style={{ maxWidth: 360 }} />
        <Button
          icon={<RefreshCw size={16} />}
          loading={refreshStatusMutation.isPending}
          onClick={() => refreshStatusMutation.mutate()}
          disabled={!servers.data?.items.length}
        >
          刷新状态
        </Button>
      </div>
      <Table
        rowKey="id"
        loading={servers.isLoading}
        dataSource={servers.data?.items ?? []}
        columns={[
          { title: '名称', dataIndex: 'name', render: (value, row) => <Button type="link" onClick={() => setEditing(row)}>{value}</Button> },
          { title: '主机', render: (_, row) => `${row.host}:${row.port}` },
          { title: '用户', dataIndex: 'username' },
          {
            title: '标签',
            dataIndex: 'tags',
            render: (tags: string[]) => tags.map((tag) => <Tag key={tag}>{tag}</Tag>),
          },
          {
            title: '状态',
            dataIndex: 'status',
            render: (value, row) => (
              <Tag color={value === 'online' ? 'green' : value === 'offline' ? 'red' : 'default'}>
                {value}
                {row.lastFailureReason ? ` · ${row.lastFailureReason}` : ''}
              </Tag>
            ),
          },
          {
            title: '延迟',
            dataIndex: 'latencyMs',
            render: (value: number | null | undefined) =>
              typeof value === 'number' ? <Tag color={value < 300 ? 'green' : value < 800 ? 'gold' : 'red'}>{value} ms</Tag> : '-',
          },
          {
            title: '操作',
            render: (_, row) => (
              <Space>
                <Tooltip title="测试连接">
                  <Button icon={<PlugZap size={16} />} onClick={() => testMutation.mutate(row.id)} />
                </Tooltip>
                <Tooltip title="打开终端">
                  <Button
                    icon={<TerminalSquare size={16} />}
                    onClick={() => navigate(`/terminal?serverId=${row.id}`)}
                  />
                </Tooltip>
                <Tooltip title="文件管理">
                  <Button
                    icon={<FolderOpen size={16} />}
                    onClick={() => navigate(`/files?serverId=${row.id}`)}
                  />
                </Tooltip>
                <Tooltip title="服务器详情">
                  <Button
                    icon={<BarChart3 size={16} />}
                    onClick={() => {
                      setMetricsServer(row);
                    }}
                  />
                </Tooltip>
                <Popconfirm
                  title="删除服务器"
                  description="删除后无法恢复，凭据关联也会失效。"
                  onConfirm={async () => {
                    await deleteServer(row.id);
                    await queryClient.invalidateQueries({ queryKey: ['servers'] });
                  }}
                >
                  <Tooltip title="删除服务器">
                    <Button danger icon={<Trash2 size={16} />} />
                  </Tooltip>
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />
      <ServerModal
        open={editing !== undefined}
        current={editing}
        onCancel={() => setEditing(undefined)}
        onSubmit={async (values) => {
          await saveMutation.mutateAsync(values);
        }}
      />
      <ServerMetricsModal
        server={metricsServer}
        metrics={metricsQuery.data}
        loading={metricsQuery.isFetching}
        error={metricsQuery.error}
        onCancel={() => setMetricsServer(null)}
      />
    </>
  );
}
