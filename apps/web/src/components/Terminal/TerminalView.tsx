import { useEffect, useRef, useState } from 'react';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Terminal } from '@xterm/xterm';
import { Button, Space, Tag, Tooltip } from 'antd';
import { RotateCcw, Trash2 } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

export default function TerminalView({ serverId }: { serverId: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const token = useAuthStore((state) => state.accessToken);
  const [status, setStatus] = useState('idle');

  const connect = () => {
    if (!ref.current || !token) return;
    wsRef.current?.close();
    ref.current.innerHTML = '';
    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'JetBrains Mono, Menlo, Monaco, Consolas, monospace',
      theme: { background: '#07110e', foreground: '#dce8de', cursor: '#f3cf69' },
      allowProposedApi: true,
    });
    const fit = new FitAddon();
    terminal.loadAddon(fit);
    terminal.loadAddon(new WebLinksAddon());
    terminal.open(ref.current);
    fit.fit();
    terminal.writeln('Connecting...');
    terminalRef.current = terminal;
    fitRef.current = fit;

    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(
      `${protocol}://${window.location.host}/ws/ssh?serverId=${serverId}&token=${encodeURIComponent(token)}`,
    );
    wsRef.current = ws;
    setStatus('connecting');

    terminal.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'input', data }));
    });

    ws.onopen = () => {
      fit.fit();
      const dimensions = fit.proposeDimensions();
      if (dimensions) ws.send(JSON.stringify({ type: 'resize', ...dimensions }));
    };
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === 'output') terminal.write(message.data);
      if (message.type === 'status') setStatus(message.status);
      if (message.type === 'error') {
        setStatus('error');
        terminal.writeln(`\r\n${message.message}`);
      }
      if (message.type === 'close') setStatus('closed');
    };
    ws.onclose = () => setStatus((current) => (current === 'error' ? current : 'closed'));

    const observer = new ResizeObserver(() => {
      fit.fit();
      const dimensions = fit.proposeDimensions();
      if (dimensions && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'resize', ...dimensions }));
      }
    });
    observer.observe(ref.current);

    return () => {
      observer.disconnect();
      ws.close();
      terminal.dispose();
    };
  };

  useEffect(() => {
    const cleanup = connect();
    return cleanup;
  }, [serverId, token]);

  return (
    <>
      <div className="toolbar" style={{ padding: '10px 10px 0' }}>
        <Tag color={status === 'connected' ? 'green' : status === 'error' ? 'red' : 'default'}>
          {status}
        </Tag>
        <Space>
          <Tooltip title="重连">
            <Button icon={<RotateCcw size={16} />} onClick={connect} />
          </Tooltip>
          <Tooltip title="清屏">
            <Button icon={<Trash2 size={16} />} onClick={() => terminalRef.current?.clear()} />
          </Tooltip>
        </Space>
      </div>
      <div className="terminal-wrap">
        <div ref={ref} style={{ height: '100%' }} />
      </div>
    </>
  );
}
