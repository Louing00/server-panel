import { Breadcrumb, Button } from 'antd';
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
      <Button icon={<Home size={16} />} onClick={() => onChange('.')} />
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
