import { Layout, Input, Menu, Button, Tooltip } from 'antd';
import { SearchOutlined, PlaySquareOutlined, VideoCameraOutlined, PlayCircleOutlined, TrophyOutlined, SettingOutlined, DashboardOutlined } from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import './Header.css';

const { Header: AntHeader } = Layout;

function Header({ onOpenSettings }) {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { key: 'movies', label: '电影', icon: <PlaySquareOutlined /> },
    { key: 'tv', label: '电视剧', icon: <VideoCameraOutlined /> },
    { key: 'anime', label: '动漫', icon: <PlayCircleOutlined /> },
    { key: 'top', label: '排行榜', icon: <TrophyOutlined /> },
  ];

  return (
    <AntHeader className="site-header">
      <div className="header-inner">
        <div className="header-logo" onClick={() => navigate('/')}>
          <span className="logo-text">Zhou</span>
          <span className="logo-highlight">Anime</span>
        </div>
        <Input.Search
          className="header-search"
          placeholder="搜索电影、电视剧、动漫..."
          allowClear
          size="large"
          prefix={<SearchOutlined style={{ color: '#888' }} />}
        />
        <Menu
          className="header-nav"
          mode="horizontal"
          items={navItems}
          theme="dark"
          selectable={false}
        />
        <Tooltip title="管理后台">
          <Button
            type="text"
            icon={<DashboardOutlined />}
            className="header-settings-btn"
            onClick={() => navigate('/admin')}
          />
        </Tooltip>
        <Tooltip title="设置">
          <Button
            type="text"
            icon={<SettingOutlined />}
            className="header-settings-btn"
            onClick={onOpenSettings}
          />
        </Tooltip>
      </div>
    </AntHeader>
  );
}

export default Header;
