import { Form, InputNumber, Switch, Typography } from 'antd';

export default function SettingsPage() {
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
    </>
  );
}
