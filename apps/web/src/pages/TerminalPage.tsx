import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, Tabs, Typography } from 'antd';
import { useSearchParams } from 'react-router-dom';
import { listServers } from '../api/servers';
import TerminalView from '../components/Terminal/TerminalView';

export default function TerminalPage() {
  const [search] = useSearchParams();
  const servers = useQuery({ queryKey: ['servers'], queryFn: () => listServers() });
  const [tabs, setTabs] = useState<string[]>([]);
  const [active, setActive] = useState<string>();
  const serverMap = useMemo(
    () => new Map((servers.data?.items ?? []).map((server) => [server.id, server])),
    [servers.data?.items],
  );

  useEffect(() => {
    const serverId = search.get('serverId');
    if (serverId && !tabs.includes(serverId)) {
      setTabs((current) => [...current, serverId]);
      setActive(serverId);
    }
  }, [search, tabs]);

  return (
    <>
      <div className="page-title">
        <Typography.Title level={3}>终端</Typography.Title>
      </div>
      <div className="split-panel">
        <aside className="side-panel">
          {(servers.data?.items ?? []).map((server) => (
            <div
              key={server.id}
              className={`server-list-item ${active === server.id ? 'active' : ''}`}
              onClick={() => {
                setTabs((current) => (current.includes(server.id) ? current : [...current, server.id]));
                setActive(server.id);
              }}
            >
              <span>{server.name}</span>
              <Button size="small">打开</Button>
            </div>
          ))}
        </aside>
        <main className="main-panel">
          {tabs.length ? (
            <Tabs
              activeKey={active}
              onChange={setActive}
              type="editable-card"
              hideAdd
              onEdit={(targetKey) => {
                const next = tabs.filter((id) => id !== targetKey);
                setTabs(next);
                setActive(next[0]);
              }}
              items={tabs.map((serverId) => ({
                key: serverId,
                label: serverMap.get(serverId)?.name ?? serverId,
                children: <TerminalView serverId={serverId} />,
              }))}
            />
          ) : (
            <div className="terminal-empty">选择一台服务器打开终端</div>
          )}
        </main>
      </div>
    </>
  );
}
