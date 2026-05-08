import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Table, Tag, Typography, message } from 'antd';
import { FolderOpen, PlugZap, Plus, TerminalSquare, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createServer, deleteServer, listServers, testServer, updateServer } from '../api/servers';
import type { Server, ServerInput } from '../types/server';

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

export default function ServersPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [keyword, setKeyword] = useState('');
  const [editing, setEditing] = useState<Server | null>();
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
            title: '操作',
            render: (_, row) => (
              <Space>
                <Button icon={<PlugZap size={16} />} onClick={() => testMutation.mutate(row.id)} />
                <Button icon={<TerminalSquare size={16} />} onClick={() => navigate(`/terminal?serverId=${row.id}`)} />
                <Button icon={<FolderOpen size={16} />} onClick={() => navigate(`/files?serverId=${row.id}`)} />
                <Popconfirm
                  title="删除服务器"
                  description="删除后无法恢复，凭据关联也会失效。"
                  onConfirm={async () => {
                    await deleteServer(row.id);
                    await queryClient.invalidateQueries({ queryKey: ['servers'] });
                  }}
                >
                  <Button danger icon={<Trash2 size={16} />} />
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
    </>
  );
}
