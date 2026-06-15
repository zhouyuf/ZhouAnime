import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout, Spin, Tag, Empty, Typography, Button } from 'antd';
import { ArrowLeftOutlined, UserOutlined } from '@ant-design/icons';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import Header from '../components/Header';
import Footer from '../components/Footer';
import SettingsModal from '../components/SettingsModal';
import { get, post } from '../utils/request';
import { getCachedAnimeItem, getCachedDetail, setCachedDetail, getCachedVideos, setCachedVideos, getCachedSeason, setCachedSeason } from '../utils/localCache';
import './Player.css';

const { Content } = Layout;
const { Text } = Typography;

function Player() {
  const { folderName } = useParams();
  const navigate = useNavigate();
  const wrapperRef = useRef(null);
  const videoElRef = useRef(null);
  const vjsRef = useRef(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [mediaItem, setMediaItem] = useState(null);
  const [detail, setDetail] = useState(null);
  const [credits, setCredits] = useState(null);
  const [seasons, setSeasons] = useState([]);
  const [episodes, setEpisodes] = useState([]);
  const [activeSeason, setActiveSeason] = useState(1);
  const [activeEpisode, setActiveEpisode] = useState(null);
  const [videoFiles, setVideoFiles] = useState([]);
  const [currentVideo, setCurrentVideo] = useState(null);
  const [paused, setPaused] = useState(true);
  const [loading, setLoading] = useState(true);
  const [tmdbKey, setTmdbKey] = useState('');

  // 加载配置和媒体信息
  useEffect(() => {
    const init = async () => {
      try {
        const config = await get('/api/tmdb/config');
        setTmdbKey(config.tmdbKey || '');
      } catch { /* ignore */ }
      // 从 localStorage 获取媒体信息
      const item = getCachedAnimeItem(folderName);
      if (item) setMediaItem({ ...item, folderName });
    };
    init();
  }, [folderName]);

  // 加载详情（含演职人员）
  useEffect(() => {
    if (!mediaItem || !tmdbKey) return;
    const { id, mediaType, folderName } = mediaItem;
    const type = mediaType || 'tv';

    // 优先从缓存读取
    const cached = getCachedDetail(folderName);
    if (cached) {
      setDetail(cached);
      setCredits(cached.credits || null);
      if (type === 'tv' && cached.seasons) {
        const validSeasons = cached.seasons.filter((s) => s.season_number > 0);
        setSeasons(validSeasons);
        if (validSeasons.length > 0) setActiveSeason(validSeasons[0].season_number);
      }
      setLoading(false);
      return;
    }

    post(`/api/tmdb/detail`, { id, mediaType: type })
      .then((detailData) => {
        setDetail(detailData);
        setCredits(detailData.credits || null);
        setCachedDetail(folderName, detailData);
        if (type === 'tv' && detailData.seasons) {
          const validSeasons = detailData.seasons.filter((s) => s.season_number > 0);
          setSeasons(validSeasons);
          if (validSeasons.length > 0) setActiveSeason(validSeasons[0].season_number);
        }
      })
      .finally(() => setLoading(false));
  }, [mediaItem, tmdbKey]);

  // 加载本地视频文件列表
  useEffect(() => {
    if (!mediaItem?.folderName) return;

    // 优先从缓存读取
    const cached = getCachedVideos(mediaItem.folderName);
    if (cached) {
      setVideoFiles(cached);
      if (mediaItem.mediaType !== 'tv' && cached.length > 0) setCurrentVideo(cached[0]);
      return;
    }

    post(`/api/anime/videos`, { name: mediaItem.folderName })
      .then((files) => {
        setVideoFiles(files || []);
        setCachedVideos(mediaItem.folderName, files || []);
        if (mediaItem.mediaType !== 'tv' && files.length > 0) setCurrentVideo(files[0]);
      })
      .catch(() => setVideoFiles([]));
  }, [mediaItem]);

  // 加载 TMDB 集数信息（仅电视剧）
  useEffect(() => {
    if (!mediaItem || !tmdbKey || mediaItem.mediaType !== 'tv' || !detail) return;

    // 优先从缓存读取
    const cached = getCachedSeason(mediaItem.folderName, activeSeason);
    if (cached) {
      setEpisodes(cached.episodes || []);
      setActiveEpisode(null);
      if (videoFiles.length > 0) {
        setCurrentVideo(videoFiles[0]);
        setActiveEpisode(cached.episodes?.[0] || null);
      }
      return;
    }

    post(`/api/tmdb/season`, { id: mediaItem.id, season: activeSeason })
      .then((data) => {
        setEpisodes(data.episodes || []);
        setCachedSeason(mediaItem.folderName, activeSeason, data);
        setActiveEpisode(null);
        if (videoFiles.length > 0) {
          setCurrentVideo(videoFiles[0]);
          setActiveEpisode(data.episodes?.[0] || null);
        }
      })
      .catch(() => setEpisodes([]));
  }, [mediaItem, tmdbKey, activeSeason, detail]);

  // 初始化 Video.js 播放器 + 切换视频源
  useEffect(() => {
    if (!currentVideo || !mediaItem?.folderName) return;

    // video 元素在 currentVideo 变化后才渲染，等待一帧
    const timer = setTimeout(() => {
      const videoEl = wrapperRef.current?.querySelector('video');
      if (!videoEl) return;

      // 初始化播放器（首次）
      if (!vjsRef.current) {
        const player = videojs(videoEl, {
          controls: true,
          autoplay: true,
          preload: 'auto',
          fluid: true,
          playbackRates: [0.5, 0.75, 1, 1.25, 1.5, 2],
          controlBar: {
            pictureInPictureToggle: true,
            remainingTimeDisplay: true,
            playbackRateMenuButton: true,
          },
        });
        player.on('play', () => setPaused(false));
        player.on('pause', () => setPaused(true));
        player.on('ended', () => setPaused(true));
        player.on('playing', () => setPaused(false));
        vjsRef.current = player;
      }

      // 切换视频源
      const player = vjsRef.current;
      const params = new URLSearchParams({ folder: mediaItem.folderName, file: currentVideo });
      const src = `/api/anime/stream/test?${params.toString()}`;
      const ext = currentVideo.match(/\.[^.]+$/)?.[0]?.toLowerCase();
      const typeMap = {
        '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.webm': 'video/webm',
        '.mkv': 'video/x-matroska', '.avi': 'video/x-msvideo',
        '.ts': 'video/mp2t', '.flv': 'video/x-flv',
      };
      player.src({ src, type: typeMap[ext] || 'video/mp4' });
      player.ready(() => player.play().catch(() => {}));
    }, 0);

    return () => clearTimeout(timer);
  }, [currentVideo, mediaItem]);

  // 组件卸载时销毁播放器
  useEffect(() => {
    return () => {
      if (vjsRef.current) { vjsRef.current.dispose(); vjsRef.current = null; }
    };
  }, []);

  // 点击集数播放对应视频
  const handleEpisodeClick = (ep, index) => {
    setActiveEpisode(ep);
    if (index < videoFiles.length) {
      setCurrentVideo(videoFiles[index]);
      wrapperRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const isTV = mediaItem?.mediaType === 'tv';
  const title = detail?.name || detail?.title || mediaItem?.title || folderName;
  const originalTitle = detail?.original_name || detail?.original_title || mediaItem?.originalTitle || '';
  const year = (detail?.first_air_date || detail?.release_date || mediaItem?.year || '').slice(0, 4);
  const rating = detail?.vote_average ? detail.vote_average.toFixed(1) : (mediaItem?.rating || 'N/A');
  const overview = detail?.overview || mediaItem?.description || '暂无简介';
  const poster = mediaItem?.poster;
  const genres = detail?.genres || [];
  const cast = credits?.cast?.slice(0, 12) || [];
  const crew = credits?.crew?.filter((c) =>
    ['Director', 'Writer', 'Screenplay', 'Creator'].includes(c.job)
  ).slice(0, 6) || [];

  if (loading) {
    return (
      <Layout className="player-layout">
        <Header onOpenSettings={() => setSettingsOpen(true)} />
        <Content className="player-content" style={{ display: 'flex', justifyContent: 'center', padding: '120px 0' }}>
          <Spin size="large" />
        </Content>
      </Layout>
    );
  }

  if (!mediaItem) {
    return (
      <Layout className="player-layout">
        <Header onOpenSettings={() => setSettingsOpen(true)} />
        <Content className="player-content" style={{ display: 'flex', justifyContent: 'center', padding: '120px 0' }}>
          <Empty description="未找到该媒体信息" />
        </Content>
      </Layout>
    );
  }

  return (
    <Layout className="player-layout">
      <Header onOpenSettings={() => setSettingsOpen(true)} />
      <Content className="player-content">
        <div style={{ padding: '16px 0' }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')}>返回首页</Button>
        </div>

        {/* 视频播放器 */}
        <div className="player-wrapper" ref={wrapperRef}>
          {currentVideo && paused && (
            <div className="player-episode-tag">
              {isTV && activeEpisode
                ? `S${activeSeason} E${activeEpisode.episode_number} · ${activeEpisode.name || ''}`
                : currentVideo}
            </div>
          )}
          {currentVideo ? (
            <div data-vjs-player style={{ width: '100%', height: '100%' }}>
              <video ref={videoElRef} className="video-js vjs-big-play-centered" />
            </div>
          ) : (
            <div
              className="player-placeholder"
              style={{
                backgroundImage: mediaItem?.backdrop ? `url(${mediaItem.backdrop})` : 'none',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            >
              <div className="player-placeholder-overlay" />
              <span className="player-placeholder-text">
                {videoFiles.length === 0 ? '未找到本地视频文件' : '请选择集数开始播放'}
              </span>
            </div>
          )}
        </div>

        {/* 影片信息 */}
        <div className="media-info">
          <div className="media-info-poster">
            {poster ? <img src={poster} alt={title} /> : (
              <div style={{ width: 220, height: 330, background: '#1a1a1a', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555' }}>无海报</div>
            )}
          </div>
          <div className="media-info-detail">
            <h1 className="media-info-title">{title}</h1>
            {originalTitle && originalTitle !== title && <p className="media-info-original">{originalTitle}</p>}
            <div className="media-info-meta">
              <span className="media-info-rating">⭐ {rating}</span>
              {year && <Tag>{year}</Tag>}
              <Tag color={isTV ? 'blue' : 'green'}>{isTV ? '电视剧' : '电影'}</Tag>
              {genres.map((g) => <Tag key={g.id} color="default">{g.name}</Tag>)}
            </div>
            <p className="media-info-overview">{overview}</p>
            <div className="credits-section">
              {crew.length > 0 && (
                <>
                  <h3 className="media-info-section-title">主要制作</h3>
                  <div className="credits-grid" style={{ marginBottom: 24 }}>
                    {crew.map((person) => (
                      <div key={`${person.id}-${person.job}`} className="credit-card">
                        {person.profile_path ? <img className="credit-photo" src={`https://image.tmdb.org/t/p/w200${person.profile_path}`} alt={person.name} /> : <div className="credit-photo-placeholder"><UserOutlined /></div>}
                        <div className="credit-name">{person.name}</div>
                        <div className="credit-role">{person.job}</div>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {cast.length > 0 && (
                <>
                  <h3 className="media-info-section-title">{isTV ? '声优 / 演员' : '演员'}</h3>
                  <div className="credits-grid">
                    {cast.map((person) => (
                      <div key={person.id} className="credit-card">
                        {person.profile_path ? <img className="credit-photo" src={`https://image.tmdb.org/t/p/w200${person.profile_path}`} alt={person.name} /> : <div className="credit-photo-placeholder"><UserOutlined /></div>}
                        <div className="credit-name">{person.name}</div>
                        <div className="credit-role">{person.character || ''}</div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* 集数选择器 */}
        {isTV && (
          <div className="episode-section">
            <h3 className="episode-section-title">选集</h3>
            {seasons.length > 0 && (
              <div className="season-tabs">
                {seasons.map((s) => (
                  <div key={s.season_number} className={`season-tab ${activeSeason === s.season_number ? 'season-tab-active' : ''}`} onClick={() => setActiveSeason(s.season_number)}>
                    第{s.season_number}季{s.episode_count > 0 && <span style={{ marginLeft: 4, fontSize: 11, opacity: 0.7 }}>({s.episode_count}集)</span>}
                  </div>
                ))}
              </div>
            )}
            {episodes.length > 0 ? (
              <div className="episode-grid">
                {episodes.map((ep, idx) => (
                  <div key={ep.episode_number} className={`episode-card ${activeEpisode?.episode_number === ep.episode_number ? 'episode-card-active' : ''} ${idx >= videoFiles.length ? 'episode-card-no-file' : ''}`} onClick={() => handleEpisodeClick(ep, idx)}>
                    <div className="episode-number">EP{ep.episode_number}</div>
                    <div className="episode-name" title={ep.name}>{ep.name || `第${ep.episode_number}集`}</div>
                  </div>
                ))}
              </div>
            ) : videoFiles.length > 0 ? (
              <div className="episode-grid">
                {videoFiles.map((file, idx) => (
                  <div key={file.path} className={`episode-card ${currentVideo?.path === file.path ? 'episode-card-active' : ''}`} onClick={() => setCurrentVideo(file)}>
                    <div className="episode-number">EP{idx + 1}</div>
                    <div className="episode-name" title={file.name}>{file.name}</div>
                  </div>
                ))}
              </div>
            ) : <Text style={{ color: '#666' }}>暂无集数信息</Text>}
          </div>
        )}

        {!isTV && videoFiles.length > 1 && (
          <div className="episode-section">
            <h3 className="episode-section-title">视频文件</h3>
            <div className="episode-grid">
              {videoFiles.map((file, idx) => (
                <div key={file.path} className={`episode-card ${currentVideo?.path === file.path ? 'episode-card-active' : ''}`} onClick={() => setCurrentVideo(file)}>
                  <div className="episode-number">#{idx + 1}</div>
                  <div className="episode-name" title={file.name}>{file.name}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Content>
      <Footer />
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </Layout>
  );
}

export default Player;
