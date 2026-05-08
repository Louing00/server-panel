import { Navigate, NavLink, Route, BrowserRouter as Router, Routes, useNavigate } from 'react-router-dom';
import { Button, Layout, Typography } from 'antd';
import { Activity, Files, LogOut, Server, Settings, ShieldCheck, TerminalSquare } from 'lucide-react';
import { useAuthStore } from './store/authStore';
import AuditLogsPage from './pages/AuditLogsPage';
import DashboardPage from './pages/DashboardPage';
import FileManagerPage from './pages/FileManagerPage';
import LoginPage from './pages/LoginPage';
import ServersPage from './pages/ServersPage';
import SettingsPage from './pages/SettingsPage';
import TerminalPage from './pages/TerminalPage';

const nav = [
  { to: '/', label: '仪表盘', icon: Activity },
  { to: '/servers', label: '服务器', icon: Server },
  { to: '/terminal', label: '终端', icon: TerminalSquare },
  { to: '/files', label: '文件', icon: Files },
  { to: '/audit', label: '审计', icon: ShieldCheck },
  { to: '/settings', label: '设置', icon: Settings },
];

function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((state) => state.accessToken);
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

function Shell() {
  const user = useAuthStore((state) => state.user);
  const clear = useAuthStore((state) => state.clear);
  const navigate = useNavigate();
  return (
    <Layout className="app-shell">
      <Layout.Sider width={244} className="sidebar">
        <div className="brand">
          <div className="brand-mark">YS</div>
          <div>
            <Typography.Text strong>云枢控制台</Typography.Text>
            <Typography.Text type="secondary">Web SSH / SFTP</Typography.Text>
          </div>
        </div>
        <nav className="nav-list">
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink key={item.to} to={item.to} end={item.to === '/'} className="nav-item">
                <Icon size={18} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </Layout.Sider>
      <Layout>
        <Layout.Header className="topbar">
          <div />
          <div className="user-actions">
            <Typography.Text>
              {user?.username} · {user?.role}
            </Typography.Text>
            <Button
              icon={<LogOut size={16} />}
              onClick={() => {
                clear();
                navigate('/login');
              }}
            />
          </div>
        </Layout.Header>
        <Layout.Content className="content">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/servers" element={<ServersPage />} />
            <Route path="/terminal" element={<TerminalPage />} />
            <Route path="/files" element={<FileManagerPage />} />
            <Route path="/audit" element={<AuditLogsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </Layout.Content>
      </Layout>
    </Layout>
  );
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/*"
          element={
            <RequireAuth>
              <Shell />
            </RequireAuth>
          }
        />
      </Routes>
    </Router>
  );
}
