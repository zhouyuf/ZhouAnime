import { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { ConfigProvider, theme, Layout, Empty, Spin } from 'antd';
import Header from './components/Header';
import HeroBanner from './components/HeroBanner';
import VideoCarousel from './components/VideoCarousel';
import SettingsModal from './components/SettingsModal';
import Footer from './components/Footer';
import Admin from './pages/Admin';
import Player from './pages/Player';
import { API_BASE } from './config';
import './App.css';

function HomePage() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mediaItems, setMediaItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/api/media`)
      .then((res) => res.json())
      .then((data) => setMediaItems(data))
      .catch(() => setMediaItems([]))
      .finally(() => setLoading(false));
  }, []);

  // 有 backdrop 的用于轮播横幅，取评分最高的前 5 个
  const heroSlides = mediaItems
    .filter((item) => item.backdrop)
    .slice(0, 5);

  // 按年份降序（最新）
  const latestVideos = [...mediaItems]
    .filter((item) => item.year)
    .sort((a, b) => parseInt(b.year) - parseInt(a.year));

  // 按评分降序（高分）
  const topRatedVideos = [...mediaItems]
    .filter((item) => item.rating && item.rating !== 'N/A')
    .sort((a, b) => parseFloat(b.rating) - parseFloat(a.rating));

  return (
    <Layout className="app-layout">
      <Header onOpenSettings={() => setSettingsOpen(true)} />
      <main className="main-content">
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '120px 0' }}>
            <Spin size="large" />
          </div>
        ) : mediaItems.length > 0 ? (
          <>
            {heroSlides.length > 0 && <HeroBanner slides={heroSlides} />}
            {latestVideos.length > 0 && <VideoCarousel title="最新上线" videos={latestVideos} />}
            {topRatedVideos.length > 0 && <VideoCarousel title="高分佳作" videos={topRatedVideos} />}
          </>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '120px 0' }}>
            <Empty
              description={
                <span style={{ color: '#888' }}>
                  暂无媒体数据，请先到管理后台导入本地媒体库
                </span>
              }
            />
          </div>
        )}
      </main>
      <Footer />
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </Layout>
  );
}

function App() {
  return (
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: '#f5c518',
          borderRadius: 8,
          colorBgContainer: '#141414',
        },
      }}
    >
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/play/:folderName" element={<Player />} />
      </Routes>
    </ConfigProvider>
  );
}

export default App;
