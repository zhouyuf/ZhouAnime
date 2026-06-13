import { useState, useEffect } from 'react';
import { Modal, Input, Button, Space, message, Typography, Alert } from 'antd';
import { FolderOpenOutlined, KeyOutlined } from '@ant-design/icons';
import './SettingsModal.css';

const { Text, Link } = Typography;

function SettingsModal({ open, onClose, onSave }) {
  const [localPath, setLocalPath] = useState('');
  const [tmdbKey, setTmdbKey] = useState('');
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (open) {
      fetch('/api/config')
        .then((res) => res.json())
        .then((config) => {
          setLocalPath(config.localPath || '');
          setTmdbKey(config.tmdbKey || '');
        })
        .catch(() => {
          setLocalPath('');
          setTmdbKey('');
        });
    }
  }, [open]);

  const handleSave = async () => {
    try {
      await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ localPath: localPath.trim(), tmdbKey: tmdbKey.trim() }),
      });
      message.success('设置已保存');
      onSave?.();
      onClose();
    } catch {
      message.error('保存失败');
    }
  };

  const handleTestPath = async () => {
    if (!localPath.trim()) {
      message.warning('请先输入路径');
      return;
    }
    setTesting(true);
    try {
      const res = await fetch(`/api/folders?path=${encodeURIComponent(localPath.trim())}`);
      const data = await res.json();
      if (res.ok) {
        message.success(`路径有效，发现 ${data.length} 个文件夹`);
      } else {
        message.error(data.error || '路径无效');
      }
    } catch {
      message.error('无法连接服务器');
    } finally {
      setTesting(false);
    }
  };

  return (
    <Modal
      title="设置"
      open={open}
      onCancel={onClose}
      footer={null}
      width={520}
      className="settings-modal"
    >
      <div className="settings-section">
        <h4>本地媒体路径</h4>
        <p className="settings-hint">
          输入存放影视的本地文件夹路径，将自动读取第一层子文件夹名称
        </p>
        <Space.Compact style={{ width: '100%' }}>
          <Input
            prefix={<FolderOpenOutlined />}
            placeholder="例如: E:\Media\Movies"
            value={localPath}
            onChange={(e) => setLocalPath(e.target.value)}
          />
          <Button onClick={handleTestPath} loading={testing}>
            测试
          </Button>
        </Space.Compact>
      </div>

      <div className="settings-section">
        <h4>TMDB API Key</h4>
        <p className="settings-hint">
          用于自动获取影片海报和梗概。免费申请：
          <Link
            href="https://www.themoviedb.org/settings/api"
            target="_blank"
            style={{ color: '#f5c518' }}
          >
            themoviedb.org
          </Link>
        </p>
        <Input
          prefix={<KeyOutlined />}
          placeholder="输入你的 TMDB API Key"
          value={tmdbKey}
          onChange={(e) => setTmdbKey(e.target.value)}
          type="password"
        />
      </div>

      <Alert
        message="TMDB API Key 需要在 https://www.themoviedb.org 免费注册后获取"
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <div className="settings-footer">
        <Button onClick={onClose}>取消</Button>
        <Button type="primary" onClick={handleSave}>
          保存
        </Button>
      </div>
    </Modal>
  );
}

export default SettingsModal;
