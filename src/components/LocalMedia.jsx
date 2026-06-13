import { useState, useEffect, useRef } from 'react';
import { Typography, Empty, Alert, Button, Progress, Table, Tag, Space, Popconfirm, message, Tooltip, Image, Modal, Radio, Spin } from 'antd';
import { FolderOpenOutlined, ReloadOutlined, StopOutlined, SettingOutlined, SyncOutlined, DeleteOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { get, post } from '../utils/request';
import { getCachedFolders, setCachedFolders, getCachedAnime, setCachedAnime, removeCachedAnime } from '../utils/localCache';
import './LocalMedia.css';

const { Text } = Typography;

// 从文件夹名清理出可能的影片名称
function cleanFolderName(name) {
  return name
    .replace(/\.(2160p|1080p|720p|480p|4K|BluRay|WEB-DL|BDRip|HDRip|DVDRip|REMUX|HEVC|x264|x265|AAC|FLAC|DTS|Atmos).*$/i, '')
    .replace(/[\.\[\]_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// TMDB genre_ids 简易映射
const GENRE_MAP = {
  16: '动画', 10759: '动作冒险', 28: '动作', 12: '冒险', 35: '喜剧',
  80: '犯罪', 18: '剧情', 10751: '家庭', 14: '奇幻', 36: '历史',
  27: '恐怖', 10402: '音乐', 9648: '悬疑', 10749: '爱情', 878: '科幻',
  53: '惊悚', 10752: '战争', 37: '西部', 10765: '科幻奇幻', 99: '纪录',
  10768: '战争政治',
};

function getGenreLabel(item) {
  const ids = item.genre_ids || [];
  // 优先取非"动画"类型的标签，动画作为补充
  const labels = ids.map((id) => GENRE_MAP[id]).filter(Boolean);
  const nonAnimation = labels.find((l) => l !== '动画');
  if (nonAnimation) return nonAnimation;
  if (labels.length > 0) return labels[0];
  return item.media_type === 'tv' ? '电视剧' : '电影';
}

// 从 TMDB 搜索结果构建影片数据
function buildMediaResult(item, folderName) {
  const isTV = item.media_type === 'tv';
  return {
    id: item.id,
    title: item.title || item.name || folderName,
    originalTitle: item.original_title || item.original_name || '',
    year: (item.release_date || item.first_air_date || '').slice(0, 4),
    rating: item.vote_average ? item.vote_average.toFixed(1) : 'N/A',
    genre: getGenreLabel(item),
    description: item.overview || '暂无简介',
    poster: item.poster_path
      ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
      : null,
    backdrop: item.backdrop_path
      ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}`
      : null,
    mediaType: isTV ? 'tv' : 'movie',
    matched: true,
  };
}

// 构建未匹配的占位数据
function buildFallbackResult(folderName) {
  return {
    id: folderName,
    title: cleanFolderName(folderName),
    year: '',
    rating: 'N/A',
    genre: '',
    description: '未找到匹配信息',
    poster: null,
    matched: false,
  };
}

/**
 * 本地媒体库组件
 * @param {boolean} embedded - 嵌入模式（用于管理页面），不显示外层 section 和标题
 */
function LocalMedia({ onOpenSettings, configSaved, embedded = false }) {
  const [mediaItems, setMediaItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState({ current: 0, total: 0, currentName: '' });
  const [reimporting, setReimporting] = useState({});
  const [config, setConfig] = useState({ localPath: '', tmdbKey: '' });
  const [logs, setLogs] = useState([]);
  const logsEndRef = useRef(null);
  const stopRef = useRef(false);
  const [rematchModal, setRematchModal] = useState({ open: false, folderName: '', results: [], loading: false, selected: null });

  const localPath = config.localPath;
  const tmdbKey = config.tmdbKey;

  // 打开重新匹配弹窗
  const handleReimport = async (folderName) => {
    setRematchModal({ open: true, folderName, results: [], loading: true, selected: null });
    try {
      const data = await post(`/api/anime/research`, { name: folderName });
      setRematchModal((prev) => ({ ...prev, results: Array.isArray(data) ? data : [], loading: false }));
    } catch {
      message.error('搜索失败');
      setRematchModal((prev) => ({ ...prev, loading: false }));
    }
  };

  // 确认选择的匹配结果
  const handleRematchConfirm = () => {
    const { folderName, results, selected } = rematchModal;
    if (selected === null) return;

    const item = results[selected];
    const result = {
      id: item.tmdbId || folderName,
      title: item.name || cleanFolderName(folderName),
      originalTitle: item.originalName || '',
      year: (item.releaseDate || '').slice(0, 4),
      rating: item.voteAverage ? item.voteAverage.toFixed(1) : 'N/A',
      genre: item.mediaType === 'tv' ? '电视剧' : '电影',
      description: item.overview || '暂无简介',
      poster: item.posterUrl || null,
      backdrop: item.backdropUrl || null,
      mediaType: item.mediaType || 'movie',
      matched: true,
    };

    // 保存到 localStorage
    setCachedAnime({ [folderName]: result });

    setMediaItems((prev) =>
      prev.map((m) =>
        m.folderName === folderName ? { ...result, folderName, folderPath: m.folderPath } : m
      )
    );
    message.success(`"${folderName}" 已匹配为 "${result.title}"`);
    setRematchModal({ open: false, folderName: '', results: [], loading: false, selected: null });
  };

  // 单条删除
  const handleDelete = (folderName) => {
    removeCachedAnime(folderName);
    setMediaItems((prev) => prev.filter((item) => item.folderName !== folderName));
    message.success(`"${folderName}" 已从缓存中删除`);
  };

  // 停止导入
  const handleStop = () => {
    stopRef.current = true;
  };

  // 加载数据（两阶段：先获取文件夹列表，再逐个查询详情）
  const fetchMedia = async (forceRefresh = false) => {
    if (!localPath || !tmdbKey) return;

    stopRef.current = false;
    setLoading(true);
    setError(null);
    setMediaItems([]);
    setLogs([]);
    setProgress({ current: 0, total: 0, currentName: '' });

    try {
      // 1. 从 localStorage 加载缓存（强制刷新时跳过）
      if (forceRefresh) {
        localStorage.removeItem('anime_folders');
        localStorage.removeItem('anime_cache');
      }
      const cache = getCachedAnime();

      // 2. 获取文件夹列表（优先用缓存）
      let folderNames = getCachedFolders();
      if (!folderNames) {
        folderNames = await get(`/api/anime/folders`);
        if (folderNames && folderNames.length > 0) {
          setCachedFolders(folderNames);
        }
      }

      if (!folderNames || folderNames.length === 0) {
        setLoading(false);
        return;
      }

      // 3. 用文件夹名生成 Table 占位行
      const items = folderNames.map((name) => {
        if (cache[name]) {
          return { ...cache[name], folderName: name, searching: false };
        }
        return {
          id: name,
          title: cleanFolderName(name),
          originalTitle: '',
          year: '',
          rating: 'N/A',
          genre: '',
          description: '',
          poster: null,
          backdrop: null,
          mediaType: 'movie',
          matched: false,
          folderName: name,
          searching: true,
        };
      });

      setMediaItems([...items]);
      setProgress({ current: 0, total: folderNames.length, currentName: '' });

      // 4. 找出需要查询的未缓存文件夹
      const uncachedNames = folderNames.filter((name) => !cache[name]);

      if (uncachedNames.length === 0) {
        setLogs((prev) => [...prev, `✅ 全部从缓存加载，共 ${folderNames.length} 个文件夹`]);
        setLoading(false);
        return;
      }

      // 5. 逐个查询详情，每完成一个立即更新对应行
      const newCacheEntries = {};

      for (let i = 0; i < uncachedNames.length; i++) {
        if (stopRef.current) {
          setLogs((prev) => [...prev, `⏹️ 用户手动停止导入`]);
          break;
        }

        const name = uncachedNames[i];
        setProgress((prev) => ({ ...prev, current: i, currentName: name }));

        try {
          const data = await post(`/api/anime/search`, { name });

          const result = {
            id: data.tmdbId || name,
            title: data.name || cleanFolderName(name),
            originalTitle: data.originalName || '',
            year: (data.releaseDate || '').slice(0, 4),
            rating: data.voteAverage ? data.voteAverage.toFixed(1) : 'N/A',
            genre: data.mediaType === 'tv' ? '电视剧' : '电影',
            description: data.overview || '暂无简介',
            poster: data.posterUrl || null,
            backdrop: data.backdropUrl || null,
            mediaType: data.mediaType || 'movie',
            matched: !!data.matched,
            folderName: name,
            searching: false,
          };

          newCacheEntries[name] = result;

          // 日志
          if (result.matched) {
            setLogs((prev) => [...prev, `✅ [${i + 1}/${uncachedNames.length}] "${name}" → ${result.title} (${result.year}) ⭐${result.rating}`]);
          } else {
            setLogs((prev) => [...prev, `❌ [${i + 1}/${uncachedNames.length}] "${name}" → 未找到匹配结果`]);
          }

          // 更新对应行
          setMediaItems((prev) =>
            prev.map((item) => (item.folderName === name ? result : item))
          );
        } catch {
          setLogs((prev) => [...prev, `⚠️ [${i + 1}/${uncachedNames.length}] "${name}" → 请求失败`]);
          setMediaItems((prev) =>
            prev.map((item) =>
              item.folderName === name ? { ...item, searching: false } : item
            )
          );
        }

        setProgress((prev) => ({ ...prev, current: i + 1 }));
      }

      // 6. 写入 localStorage 缓存
      if (Object.keys(newCacheEntries).length > 0) {
        setCachedAnime(newCacheEntries);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 加载配置
  const loadConfig = async () => {
    try {
      const data = await get('/api/tmdb/config');
      setConfig(data);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    loadConfig();
  }, [configSaved]);

  useEffect(() => {
    fetchMedia();
  }, [localPath, tmdbKey]);

  // 日志自动滚动到底部
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // 表格列定义
  const columns = [
    {
      title: '海报',
      dataIndex: 'poster',
      key: 'poster',
      width: 80,
      render: (poster, record) => (
        poster ? (
          <Image
            src={poster}
            alt={record.title}
            width={56}
            height={84}
            style={{ objectFit: 'cover', borderRadius: 4 }}
            preview={{ src: record.backdrop || poster }}
            fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAAAyCAYAAAAeP4ixAAAABGdBTUEAALGPC/xhBQAAAAlwSFlzAAAOwgAADsIBFShKgAAAABl0RVh0U29mdHdhcmUAcGFpbnQubmV0IDQuMC4xNkRpr/UAAAB8SURBVGhD7c0xDQAgDATRqYAFWKMVWqEVWoG9kEBiQf5v4HIJAAAAAAAAAAD4k5xz7n3OzP7fd8659zkz+3/fOefe58zs/33nnHufM7P/951z7n3OzP7fd8659zkz+3/fOefe58zs/33nnHufM7P/951z7n3OzP7fd8659z4PeB8Q7U+YAAAAABJRU5ErkJggg=="
          />
        ) : (
          <div style={{ width: 56, height: 84, background: '#2a2a2a', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555', fontSize: 11 }}>
            无图
          </div>
        )
      ),
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      width: 180,
      ellipsis: true,
      render: (title, record) => (
        <div>
          <Text strong style={{ color: '#e0e0e0' }}>{title}</Text>
          {record.originalTitle && record.originalTitle !== title && (
            <div>
              <Text style={{ color: '#666', fontSize: 12 }}>{record.originalTitle}</Text>
            </div>
          )}
        </div>
      ),
    },
    {
      title: '匹配结果',
      dataIndex: 'matched',
      key: 'matched',
      width: 100,
      render: (matched) => matched ? (
        <Tag icon={<CheckCircleOutlined />} color="success">已匹配</Tag>
      ) : (
        <Tag icon={<CloseCircleOutlined />} color="error">未匹配</Tag>
      ),
    },
    {
      title: '年份',
      dataIndex: 'year',
      key: 'year',
      width: 70,
      render: (year) => <Text style={{ color: '#aaa' }}>{year || '-'}</Text>,
    },
    {
      title: '评分',
      dataIndex: 'rating',
      key: 'rating',
      width: 70,
      render: (rating) => (
        <Text style={{ color: rating !== 'N/A' ? '#f5c518' : '#555', fontWeight: 600 }}>
          {rating}
        </Text>
      ),
    },
    {
      title: '类型',
      dataIndex: 'genre',
      key: 'genre',
      width: 80,
      render: (genre) => genre ? <Tag color="default">{genre}</Tag> : '-',
    },
    {
      title: '简介',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (desc) => (
        <Tooltip title={desc}>
          <Text style={{ color: '#888', fontSize: 13 }}>
            {desc && desc.length > 60 ? desc.slice(0, 60) + '...' : desc || '-'}
          </Text>
        </Tooltip>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="重新匹配">
            <Button
              type="text"
              size="small"
              icon={<SyncOutlined spin={reimporting[record.folderName]} />}
              style={{ color: '#f5c518' }}
              onClick={() => handleReimport(record.folderName)}
              loading={reimporting[record.folderName]}
            />
          </Tooltip>
          <Popconfirm
            title="确定删除此缓存？"
            description={`将删除 "${record.folderName}" 的匹配数据`}
            onConfirm={() => handleDelete(record.folderName)}
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Tooltip title="删除">
              <Button
                type="text"
                size="small"
                icon={<DeleteOutlined />}
                style={{ color: '#ff4d4f' }}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // 嵌入模式：不显示外层 section 和标题
  const Wrapper = embedded ? 'div' : 'section';
  const wrapperClass = embedded ? 'local-media-embedded' : 'local-media';

  if (!localPath || !tmdbKey) {
    return (
      <Wrapper className={wrapperClass}>
        {!embedded && (
          <div className="local-media-header">
            <Text className="local-media-title" style={{ fontSize: 20, fontWeight: 600 }}>
              <FolderOpenOutlined /> 本地媒体库
            </Text>
          </div>
        )}
        <Empty
          description={
            <span style={{ color: '#888' }}>
              请先配置本地路径和 TMDB API Key
            </span>
          }
        >
          <Button type="primary" icon={<SettingOutlined />} onClick={onOpenSettings}>
            打开设置
          </Button>
        </Empty>
      </Wrapper>
    );
  }

  return (
    <Wrapper className={wrapperClass}>
      {!embedded && (
        <div className="local-media-header">
          <Text className="local-media-title" style={{ fontSize: 20, fontWeight: 600 }}>
            <FolderOpenOutlined /> 本地媒体库
          </Text>
          <span className="local-media-path">{localPath}</span>
          <Button
            type="text"
            icon={<ReloadOutlined />}
            onClick={() => fetchMedia(true)}
            loading={loading}
            style={{ color: '#f5c518' }}
          >
            刷新
          </Button>
          {loading && (
            <Button
              type="text"
              icon={<StopOutlined />}
              onClick={handleStop}
              style={{ color: '#ff4d4f' }}
            >
              停止
            </Button>
          )}
        </div>
      )}

      {embedded && (
        <div className="local-media-embedded-header">
          <span className="local-media-path">{localPath}</span>
          <Button
            type="text"
            icon={<ReloadOutlined />}
            onClick={() => fetchMedia(true)}
            loading={loading}
            style={{ color: '#f5c518' }}
          >
            刷新
          </Button>
          {loading && (
            <Button
              type="text"
              icon={<StopOutlined />}
              onClick={handleStop}
              style={{ color: '#ff4d4f' }}
            >
              停止
            </Button>
          )}
        </div>
      )}

      {error && (
        <Alert
          message="加载失败"
          description={error}
          type="error"
          showIcon
          closable
          style={{ marginBottom: 16 }}
        />
      )}

      {loading && (
        <div className="local-media-progress">
          <div className="progress-info">
            <Text className="progress-count">
              正在导入 {progress.current} / {progress.total}
            </Text>
            {progress.currentName && (
              <Text className="progress-name" ellipsis>
                🎬 {progress.currentName}
              </Text>
            )}
          </div>
          <Progress
            percent={progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0}
            strokeColor="#f5c518"
            trailColor="#2a2a2a"
            showInfo={true}
            format={(percent) => `${percent}%`}
          />
          {logs.length > 0 && (
            <div className="local-media-logs">
              {logs.map((log, idx) => (
                <div key={idx} className="log-line">{log}</div>
              ))}
              <div ref={logsEndRef} />
            </div>
          )}
        </div>
      )}

      {!loading && mediaItems.length > 0 ? (
        <Table
          dataSource={mediaItems}
          columns={columns}
          rowKey={(record) => record.folderName || record.id}
          pagination={false}
          scroll={{ x: 900 }}
          size="middle"
          className="media-table"
        />
      ) : (
        !loading && !error && <Empty description="未发现文件夹" />
      )}

      {/* 重新匹配弹窗 */}
      <Modal
        title={`重新匹配 — ${rematchModal.folderName}`}
        open={rematchModal.open}
        onCancel={() => setRematchModal({ open: false, folderName: '', results: [], loading: false, selected: null })}
        onOk={handleRematchConfirm}
        okText="确认匹配"
        cancelText="取消"
        okButtonProps={{ disabled: rematchModal.selected === null }}
        width={640}
        className="rematch-modal"
      >
        {rematchModal.loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Spin />
          </div>
        ) : rematchModal.results.length === 0 ? (
          <Empty description="未找到匹配结果" />
        ) : (
          <Radio.Group
            value={rematchModal.selected}
            onChange={(e) => setRematchModal((prev) => ({ ...prev, selected: e.target.value }))}
            style={{ width: '100%' }}
          >
            <div className="rematch-list">
              {rematchModal.results.map((item, idx) => {
                const title = item.name || '';
                const originalName = item.originalName || '';
                const year = (item.releaseDate || '').slice(0, 4);
                const rating = item.voteAverage ? item.voteAverage.toFixed(1) : 'N/A';
                const typeLabel = item.mediaType === 'tv' ? '电视剧' : '电影';
                const poster = item.posterUrl || null;

                return (
                  <div
                    key={item.tmdbId || idx}
                    className={`rematch-item ${rematchModal.selected === idx ? 'rematch-item-selected' : ''}`}
                    onClick={() => setRematchModal((prev) => ({ ...prev, selected: idx }))}
                  >
                    <Radio value={idx} style={{ position: 'absolute', top: 12, left: 12 }} />
                    {poster ? (
                      <Image
                        src={poster}
                        alt={title}
                        width={50}
                        height={75}
                        style={{ objectFit: 'cover', borderRadius: 4, flexShrink: 0 }}
                        preview={false}
                      />
                    ) : (
                      <div className="rematch-poster-empty">无图</div>
                    )}
                    <div className="rematch-info">
                      <div className="rematch-title">
                        <Text strong style={{ color: '#e0e0e0' }}>{title}</Text>
                        {originalName && originalName !== title && (
                          <Text style={{ color: '#666', fontSize: 12, marginLeft: 8 }}>{originalName}</Text>
                        )}
                      </div>
                      <div className="rematch-meta">
                        <Tag color={item.mediaType === 'tv' ? 'blue' : 'green'}>{typeLabel}</Tag>
                        {year && <Text style={{ color: '#aaa', fontSize: 12 }}>{year}</Text>}
                        <Text style={{ color: '#f5c518', fontSize: 12, fontWeight: 600 }}>⭐ {rating}</Text>
                      </div>
                      {item.overview && (
                        <Text style={{ color: '#888', fontSize: 12 }} ellipsis={{ rows: 2 }}>
                          {item.overview}
                        </Text>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Radio.Group>
        )}
      </Modal>
    </Wrapper>
  );
}

export default LocalMedia;
