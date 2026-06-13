import { useState } from 'react';
import { Layout, Typography, Breadcrumb, Card, Space, Button, Divider } from 'antd';
import { HomeOutlined, SettingOutlined, DatabaseOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import LocalMedia from '../components/LocalMedia';
import SettingsModal from '../components/SettingsModal';
import './Admin.css';

const { Content } = Layout;
const { Title, Text } = Typography;

function Admin() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [configSaved, setConfigSaved] = useState(0);
  const navigate = useNavigate();

  return (
    <Layout className="admin-layout">
      <Header onOpenSettings={() => setSettingsOpen(true)} />
      <Content className="admin-content">
        <div className="admin-container">
          {/* 面包屑导航 */}
          <Breadcrumb
            className="admin-breadcrumb"
            items={[
              {
                title: (
                  <span onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
                    <HomeOutlined /> 首页
                  </span>
                ),
              },
              {
                title: (
                  <span>
                    <SettingOutlined /> 管理后台
                  </span>
                ),
              },
            ]}
          />

          {/* 页面标题 */}
          <div className="admin-header">
            <div>
              <Title level={2} className="admin-title">
                <DatabaseOutlined /> 媒体库管理
              </Title>
              <Text className="admin-desc">
                管理本地媒体库，导入和更新影片信息
              </Text>
            </div>
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate('/')}
            >
              返回首页
            </Button>
          </div>

          <Divider />

          {/* 媒体库导入 */}
          <Card
            title={
              <Space>
                <DatabaseOutlined style={{ color: '#f5c518' }} />
                <span>本地媒体库导入</span>
              </Space>
            }
            className="admin-card"
            extra={
              <Button
                type="primary"
                icon={<SettingOutlined />}
                onClick={() => setSettingsOpen(true)}
              >
                配置路径
              </Button>
            }
          >
            <LocalMedia onOpenSettings={() => setSettingsOpen(true)} configSaved={configSaved} embedded />
          </Card>

          {/* 预留其他管理功能 */}
          <Card
            title={
              <Space>
                <SettingOutlined style={{ color: '#f5c518' }} />
                <span>系统设置</span>
              </Space>
            }
            className="admin-card"
          >
            <div className="admin-placeholder">
              <Text type="secondary">更多管理功能开发中...</Text>
            </div>
          </Card>
        </div>
      </Content>

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSave={() => setConfigSaved((prev) => prev + 1)}
      />
    </Layout>
  );
}

export default Admin;
