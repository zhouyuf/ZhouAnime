import { useState, useEffect, useRef } from 'react';
import { Typography, Empty, Alert, Button, Progress, Table, Tag, Space, Popconfirm, message, Tooltip, Image, Modal, Radio, Spin } from 'antd';
import { FolderOpenOutlined, ReloadOutlined, StopOutlined, SettingOutlined, SyncOutlined, DeleteOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { get, post, del } from '../utils/request';
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
    if (!tmdbKey) return;
    const query = cleanFolderName(folderName);
    setRematchModal({ open: true, folderName, results: [], loading: true, selected: null });
    try {
      const tmdbData = await get(`/api/tmdb?query=${encodeURIComponent(query)}&apiKey=${tmdbKey}`);
      setRematchModal((prev) => ({ ...prev, results: tmdbData.results || [], loading: false }));
    } catch {
      message.error('搜索失败');
      setRematchModal((prev) => ({ ...prev, loading: false }));
    }
  };

  // 确认选择的匹配结果
  const handleRematchConfirm = async () => {
    const { folderName, results, selected } = rematchModal;
    if (selected === null) return;

    const item = results[selected];
    const result = buildMediaResult(item, folderName);

    try {
      await post('/api/cache', { [folderName]: result });

      setMediaItems((prev) =>
        prev.map((m) =>
          m.folderName === folderName ? { ...result, folderName, folderPath: m.folderPath } : m
        )
      );
      message.success(`"${folderName}" 已匹配为 "${result.title}"`);
      setRematchModal({ open: false, folderName: '', results: [], loading: false, selected: null });
    } catch {
      message.error('保存失败');
    }
  };

  // 单条删除
  const handleDelete = async (folderName) => {
    try {
      await del(`/api/cache?key=${encodeURIComponent(folderName)}`);
      setMediaItems((prev) => prev.filter((item) => item.folderName !== folderName));
      message.success(`"${folderName}" 已从缓存中删除`);
    } catch {
      message.error('删除失败');
    }
  };

  // 停止导入
  const handleStop = () => {
    stopRef.current = true;
  };

  // 加载数据
  const fetchMedia = async () => {
    if (!localPath || !tmdbKey) return;

    stopRef.current = false;
    setLoading(true);
    setError(null);
    setMediaItems([]);
    setLogs([]);
    setProgress({ current: 0, total: 0, currentName: '' });

    try {
      // 1. 读取文件夹列表
      const folderData = await get(`/api/folders?path=${encodeURIComponent(localPath)}`);

      if (folderData.length === 0) {
        setLoading(false);
        return;
      }

      // 2. 加载缓存
      let cache = {};
      try {
        cache = await get('/api/cache');
      } catch { /* ignore */ }

      // 3. 区分已缓存和未缓存的文件夹
      const cached = [];
      const uncached = [];
      for (const folder of folderData) {
        if (cache[folder.name]) {
          cached.push({ ...cache[folder.name], folderName: folder.name, folderPath: folder.path });
        } else {
          uncached.push(folder);
        }
      }

      if (cached.length > 0) {
        setMediaItems(cached);
      }

      if (uncached.length === 0) {
        setLoading(false);
        return;
      }

      setProgress({ current: 0, total: uncached.length, currentName: '' });

      // 4. 逐条查询 TMDB，每完成一条立即更新表格
      const newCacheEntries = {};
      const allItems = [...cached];

      for (let i = 0; i < uncached.length; i++) {
        if (stopRef.current) {
          setLogs((prev) => [...prev, `⏹️ 用户手动停止导入`]);
          break;
        }

        const folder = uncached[i];
        const query = cleanFolderName(folder.name);

        setProgress((prev) => ({ ...prev, current: i, currentName: query }));

        let item;
        try {
          const tmdbData = await get(`/api/tmdb?query=${encodeURIComponent(query)}&apiKey=${tmdbKey}`);

          const resultCount = tmdbData.results?.length || 0;
          if (resultCount > 0) {
            const top = tmdbData.results[0];
            const title = top.title || top.name || query;
            const year = (top.release_date || top.first_air_date || '').slice(0, 4);
            const rating = top.vote_average ? top.vote_average.toFixed(1) : 'N/A';
            setLogs((prev) => [...prev, `✅ [${i + 1}] "${query}" → ${title} (${year}) ⭐${rating}  共${resultCount}条结果`]);
          } else {
            setLogs((prev) => [...prev, `❌ [${i + 1}] "${query}" → 未找到匹配结果`]);
          }

          const result = resultCount > 0
            ? buildMediaResult(tmdbData.results[0], folder.name)
            : buildFallbackResult(folder.name);

          newCacheEntries[folder.name] = result;
          item = { ...result, folderName: folder.name, folderPath: folder.path };
        } catch {
          setLogs((prev) => [...prev, `⚠️ [${i + 1}] "${query}" → 请求失败`]);
          const fallback = buildFallbackResult(folder.name);
          item = { ...fallback, folderName: folder.name, folderPath: folder.path };
        }

        allItems.push(item);
        setMediaItems([...allItems]);
        setProgress((prev) => ({ ...prev, current: i + 1 }));
      }

      // 5. 写入缓存
      if (Object.keys(newCacheEntries).length > 0) {
        try {
          await post('/api/cache', newCacheEntries);
        } catch { /* ignore */ }
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
      const data = await get('/api/config');
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
            onClick={fetchMedia}
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
            onClick={fetchMedia}
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
                const title = item.title || item.name || '';
                const originalTitle = item.original_title || item.original_name || '';
                const year = (item.release_date || item.first_air_date || '').slice(0, 4);
                const rating = item.vote_average ? item.vote_average.toFixed(1) : 'N/A';
                const typeLabel = item.media_type === 'tv' ? '电视剧' : '电影';
                const poster = item.poster_path
                  ? `https://image.tmdb.org/t/p/w200${item.poster_path}`
                  : null;

                return (
                  <div
                    key={item.id}
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
                        {originalTitle && originalTitle !== title && (
                          <Text style={{ color: '#666', fontSize: 12, marginLeft: 8 }}>{originalTitle}</Text>
                        )}
                      </div>
                      <div className="rematch-meta">
                        <Tag color={item.media_type === 'tv' ? 'blue' : 'green'}>{typeLabel}</Tag>
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
