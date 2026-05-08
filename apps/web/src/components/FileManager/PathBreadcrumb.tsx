import { Breadcrumb, Button, Tooltip } from 'antd';
import { Home } from 'lucide-react';

export default function PathBreadcrumb({
  path,
  onChange,
}: {
  path: string;
  onChange: (path: string) => void;
}) {
  const parts = path.split('/').filter(Boolean);
  return (
    <div className="file-path">
      <Tooltip title="返回 Home">
        <Button icon={<Home size={16} />} onClick={() => onChange('.')} />
      </Tooltip>
      <Breadcrumb
        items={[
          { title: <a onClick={() => onChange('/')}>/</a> },
          ...parts.map((part, index) => ({
            title: (
              <a onClick={() => onChange(`/${parts.slice(0, index + 1).join('/')}`)}>{part}</a>
            ),
          })),
        ]}
      />
    </div>
  );
}
