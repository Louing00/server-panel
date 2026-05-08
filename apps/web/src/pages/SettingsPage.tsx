import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Divider, Form, Input, InputNumber, Switch, Typography, message } from 'antd';
import { changePasswordApi } from '../api/auth';
import { useAuthStore } from '../store/authStore';

export default function SettingsPage() {
  const navigate = useNavigate();
  const clear = useAuthStore((state) => state.clear);
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  return (
    <>
      <div className="page-title">
        <Typography.Title level={3}>系统设置</Typography.Title>
      </div>
      <Form
        layout="vertical"
        initialValues={{
          sshTimeout: 10000,
          idleTimeout: 1800000,
          maxUpload: 200,
          allowPassword: true,
        }}
        style={{ maxWidth: 520 }}
      >
        <Form.Item label="SSH 连接超时（毫秒）" name="sshTimeout">
          <InputNumber min={1000} max={60000} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item label="终端空闲超时（毫秒）" name="idleTimeout">
          <InputNumber min={60000} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item label="文件上传大小限制（MB）" name="maxUpload">
          <InputNumber min={1} max={2048} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item label="允许保存服务器密码" name="allowPassword" valuePropName="checked">
          <Switch />
        </Form.Item>
      </Form>
      <Divider />
      <Typography.Title level={4}>修改密码</Typography.Title>
      <Form
        form={form}
        layout="vertical"
        style={{ maxWidth: 520 }}
        onFinish={async (values) => {
          setLoading(true);
          try {
            await changePasswordApi(values);
            message.success('密码已修改，请重新登录');
            clear();
            navigate('/login');
          } catch (error) {
            message.error(error instanceof Error ? error.message : '修改密码失败');
          } finally {
            setLoading(false);
          }
        }}
      >
        <Form.Item name="currentPassword" label="当前密码" rules={[{ required: true }]}>
          <Input.Password autoComplete="current-password" />
        </Form.Item>
        <Form.Item
          name="newPassword"
          label="新密码"
          rules={[
            { required: true },
            { min: 8, message: '新密码至少 8 位' },
          ]}
        >
          <Input.Password autoComplete="new-password" />
        </Form.Item>
        <Form.Item
          name="confirmPassword"
          label="确认新密码"
          dependencies={['newPassword']}
          rules={[
            { required: true },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('newPassword') === value) return Promise.resolve();
                return Promise.reject(new Error('两次输入的新密码不一致'));
              },
            }),
          ]}
        >
          <Input.Password autoComplete="new-password" />
        </Form.Item>
        <Button type="primary" htmlType="submit" loading={loading}>
          修改密码
        </Button>
      </Form>
    </>
  );
}
