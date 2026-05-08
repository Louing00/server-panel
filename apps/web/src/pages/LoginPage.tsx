import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Form, Input, Typography, message } from 'antd';
import { Lock, User } from 'lucide-react';
import { loginApi } from '../api/auth';
import { useAuthStore } from '../store/authStore';

export default function LoginPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore((state) => state.setSession);
  const [loading, setLoading] = useState(false);

  return (
    <main className="login-page">
      <section className="login-box">
        <Typography.Title level={3}>境外服务器统一管控平台</Typography.Title>
        <Form
          layout="vertical"
          initialValues={{ username: 'admin' }}
          onFinish={async (values) => {
            setLoading(true);
            try {
              const session = await loginApi(values);
              setSession(session);
              navigate('/');
            } catch (error) {
              message.error(error instanceof Error ? error.message : '登录失败');
            } finally {
              setLoading(false);
            }
          }}
        >
          <Form.Item name="username" label="用户名" rules={[{ required: true }]}>
            <Input prefix={<User size={16} />} autoComplete="username" />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true }]}>
            <Input.Password prefix={<Lock size={16} />} autoComplete="current-password" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={loading}>
            登录
          </Button>
        </Form>
      </section>
    </main>
  );
}
