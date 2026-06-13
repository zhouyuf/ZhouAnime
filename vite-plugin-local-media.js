import fs from 'fs';
import path from 'path';

const DATA_DIR = path.resolve('data');
const CACHE_FILE = path.join(DATA_DIR, 'media-cache.json');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');

// 确保 data 目录存在
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

// 读取缓存
function readCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
    }
  } catch { /* ignore */ }
  return {};
}

// 写入缓存
function writeCache(data) {
  ensureDataDir();
  fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// 读取配置
function readConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
    }
  } catch { /* ignore */ }
  return { localPath: '', tmdbKey: '' };
}

// 写入配置
function writeConfig(data) {
  ensureDataDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// 读取请求体
function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}


/**
 * Vite 插件：提供本地目录读取、TMDB API 代理、数据缓存
 */
export default function localMediaPlugin() {
  return {
    name: 'local-media-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        // CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
          res.writeHead(204);
          res.end();
          return;
        }

        // GET /api/config — 读取配置
        if (req.url === '/api/config' && req.method === 'GET') {
          const config = readConfig();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(config));
          return;
        }

        // PUT /api/config — 写入配置（body: { localPath, tmdbKey }）
        if (req.url === '/api/config' && req.method === 'PUT') {
          try {
            const body = await readBody(req);
            const data = JSON.parse(body);
            const config = {
              localPath: (data.localPath || '').trim(),
              tmdbKey: (data.tmdbKey || '').trim(),
            };
            writeConfig(config);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true }));
          } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
          }
          return;
        }

        // GET /api/media — 返回已匹配的媒体列表（首页用）
        if (req.url === '/api/media' && req.method === 'GET') {
          const config = readConfig();
          const cache = readCache();
          const items = Object.entries(cache)
            .filter(([, v]) => v.matched)
            .map(([folderName, v]) => ({
              ...v,
              folderName,
              folderPath: path.join(config.localPath || '', folderName),
            }));
          items.sort((a, b) => parseFloat(b.rating || 0) - parseFloat(a.rating || 0));
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(items));
          return;
        }

        // GET /api/videos?path=xxx — 列出目录下的视频文件（第一层）
        if (req.url.startsWith('/api/videos')) {
          const url = new URL(req.url, 'http://localhost');
          const dirPath = url.searchParams.get('path');

          if (!dirPath) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: '缺少 path 参数' }));
            return;
          }

          try {
            const resolved = path.resolve(dirPath);
            if (!fs.existsSync(resolved)) {
              res.writeHead(404, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: '路径不存在' }));
              return;
            }

            const VIDEO_EXTS = new Set(['.mkv', '.mp4', '.avi', '.wmv', '.flv', '.mov', '.rmvb', '.ts', '.m4v', '.webm']);
            const SUB_EXTS = new Set(['.srt', '.ass', '.ssa', '.vtt', '.sub']);
            const entries = fs.readdirSync(resolved, { withFileTypes: true });

            // 收集所有字幕文件，按基础名分组
            const subMap = {};
            entries.forEach((e) => {
              if (e.isFile() && SUB_EXTS.has(path.extname(e.name).toLowerCase())) {
                const baseName = e.name.replace(/\.[^.]+$/, '');
                if (!subMap[baseName]) subMap[baseName] = [];
                subMap[baseName].push({
                  name: e.name,
                  path: path.join(resolved, e.name),
                  ext: path.extname(e.name).toLowerCase(),
                });
              }
            });

            const videos = entries
              .filter((e) => e.isFile() && VIDEO_EXTS.has(path.extname(e.name).toLowerCase()))
              .map((e) => {
                const baseName = e.name.replace(/\.[^.]+$/, '');
                const subtitles = subMap[baseName] || [];
                return {
                  name: e.name,
                  path: path.join(resolved, e.name),
                  ext: path.extname(e.name).toLowerCase(),
                  subtitles,
                };
              })
              .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN', { numeric: true }));

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(videos));
          } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
          }
          return;
        }

        // GET /api/subtitle/raw?path=xxx — 返回原始字幕文件（供 JASSUB 使用）
        if (req.url.startsWith('/api/subtitle/raw')) {
          const url = new URL(req.url, 'http://localhost');
          const filePath = url.searchParams.get('path');

          if (!filePath) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: '缺少 path 参数' }));
            return;
          }

          try {
            const resolved = path.resolve(filePath);
            if (!fs.existsSync(resolved)) {
              res.writeHead(404, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: '文件不存在' }));
              return;
            }
            console.log(`[SUB] ${path.basename(resolved)}`);
            const content = fs.readFileSync(resolved, 'utf-8');
            res.writeHead(200, {
              'Content-Type': 'text/plain; charset=utf-8',
              'Content-Length': Buffer.byteLength(content, 'utf-8'),
            });
            res.end(content);
          } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
          }
          return;
        }

        // GET /api/stream?path=xxx — 流式播放本地视频文件（支持 Range 请求）
        if (req.url.startsWith('/api/stream')) {
          const url = new URL(req.url, 'http://localhost');
          const filePath = url.searchParams.get('path');

          if (!filePath) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: '缺少 path 参数' }));
            return;
          }

          try {
            const resolved = path.resolve(filePath);
            if (!fs.existsSync(resolved)) {
              res.writeHead(404, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: '文件不存在' }));
              return;
            }

            const stat = fs.statSync(resolved);
            const fileSize = stat.size;
            const ext = path.extname(resolved).toLowerCase();
            console.log(`[STREAM] ${path.basename(resolved)} (${(fileSize / 1024 / 1024).toFixed(1)}MB)`);

            const mimeMap = {
              '.mkv': 'video/x-matroska',
              '.mp4': 'video/mp4',
              '.avi': 'video/x-msvideo',
              '.wmv': 'video/x-ms-wmv',
              '.flv': 'video/x-flv',
              '.mov': 'video/quicktime',
              '.ts': 'video/mp2t',
              '.m4v': 'video/mp4',
              '.webm': 'video/webm',
              '.rmvb': 'application/vnd.rn-realmedia-vbr',
              '.srt': 'application/x-subrip',
              '.vtt': 'text/vtt',
              '.sub': 'text/plain',
            };
            const contentType = mimeMap[ext] || 'application/octet-stream';

            const range = req.headers.range;
            if (range) {
              const parts = range.replace(/bytes=/, '').split('-');
              const start = parseInt(parts[0], 10);
              const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
              const chunkSize = end - start + 1;

              res.writeHead(206, {
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunkSize,
                'Content-Type': contentType,
              });
              fs.createReadStream(resolved, { start, end }).pipe(res);
            } else {
              res.writeHead(200, {
                'Content-Length': fileSize,
                'Content-Type': contentType,
                'Accept-Ranges': 'bytes',
              });
              fs.createReadStream(resolved).pipe(res);
            }
          } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
          }
          return;
        }

        // GET /api/folders?path=xxx
        if (req.url.startsWith('/api/folders')) {
          const url = new URL(req.url, 'http://localhost');
          const dirPath = url.searchParams.get('path');

          if (!dirPath) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: '缺少 path 参数' }));
            return;
          }

          try {
            const resolved = path.resolve(dirPath);
            if (!fs.existsSync(resolved)) {
              res.writeHead(404, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: '路径不存在' }));
              return;
            }

            const entries = fs.readdirSync(resolved, { withFileTypes: true });
            const folders = entries
              .filter((e) => e.isDirectory())
              .map((e) => ({
                name: e.name,
                path: path.join(resolved, e.name),
              }));

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(folders));
          } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
          }
          return;
        }

        // GET /api/tmdb?query=xxx&apiKey=xxx
        if (req.url.startsWith('/api/tmdb') && !req.url.startsWith('/api/tmdb/detail') && !req.url.startsWith('/api/tmdb/credits') && !req.url.startsWith('/api/tmdb/season')) {
          const url = new URL(req.url, 'http://localhost');
          const query = url.searchParams.get('query');
          const apiKey = url.searchParams.get('apiKey');

          if (!query || !apiKey) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: '缺少 query 或 apiKey 参数' }));
            return;
          }

          const tmdbUrl = `https://api.themoviedb.org/3/search/multi?query=${encodeURIComponent(query)}&api_key=${apiKey}&language=zh-CN&page=1`;
          console.log(`[TMDB] URL: ${tmdbUrl}`);

          fetch(tmdbUrl)
            .then((r) => r.json())
            .then((data) => {
              // 过滤：排除成人内容、无效条目
              console.log(`[TMDB] 原始结果 count=${data.results ? data.results.length : 0}`);
              let results = (data.results || []).filter(
                (r) => !r.adult && (r.media_type === 'movie' || r.media_type === 'tv')
              );

              // 排序：标题精确匹配优先，再按人气+评分加权
              const queryLower = query.toLowerCase();
              results.sort((a, b) => {
                const aTitle = (a.title || a.name || '').toLowerCase();
                const bTitle = (b.title || b.name || '').toLowerCase();
                const aExact = aTitle === queryLower ? 0 : 1;
                const bExact = bTitle === queryLower ? 0 : 1;
                if (aExact !== bExact) return aExact - bExact;
                return (b.popularity || 0) + (b.vote_average || 0) * 2
                     - (a.popularity || 0) - (a.vote_average || 0) * 2;
              });

              data.results = results;
              console.log(`[TMDB] query="${query}" results=${results.length}`);
              if (results.length > 0) {
                const top = results[0];
                console.log(`  → [${top.media_type}] ${top.name || top.title} (${(top.first_air_date || top.release_date || '').slice(0, 4)}) ⭐${top.vote_average}`);
              } else {
                console.log(`  → 无匹配结果`);
              }
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(data));
            })
            .catch((err) => {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: err.message }));
            });
          return;
        }

        // GET /api/tmdb/detail?id=xxx&mediaType=tv&apiKey=xxx
        if (req.url.startsWith('/api/tmdb/detail')) {
          const url = new URL(req.url, 'http://localhost');
          const id = url.searchParams.get('id');
          const mediaType = url.searchParams.get('mediaType') || 'tv';
          const apiKey = url.searchParams.get('apiKey');

          if (!id || !apiKey) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: '缺少 id 或 apiKey 参数' }));
            return;
          }

          const tmdbUrl = `https://api.themoviedb.org/3/${mediaType}/${id}?api_key=${apiKey}&language=zh-CN`;
          fetch(tmdbUrl).then((r) => r.json()).then((data) => {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(data));
          }).catch((err) => {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
          });
          return;
        }

        // GET /api/tmdb/credits?id=xxx&mediaType=tv&apiKey=xxx
        if (req.url.startsWith('/api/tmdb/credits')) {
          const url = new URL(req.url, 'http://localhost');
          const id = url.searchParams.get('id');
          const mediaType = url.searchParams.get('mediaType') || 'tv';
          const apiKey = url.searchParams.get('apiKey');

          if (!id || !apiKey) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: '缺少 id 或 apiKey 参数' }));
            return;
          }

          const tmdbUrl = `https://api.themoviedb.org/3/${mediaType}/${id}/credits?api_key=${apiKey}&language=zh-CN`;
          fetch(tmdbUrl).then((r) => r.json()).then((data) => {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(data));
          }).catch((err) => {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
          });
          return;
        }

        // GET /api/tmdb/season?id=xxx&season=1&apiKey=xxx
        if (req.url.startsWith('/api/tmdb/season')) {
          const url = new URL(req.url, 'http://localhost');
          const id = url.searchParams.get('id');
          const season = url.searchParams.get('season') || '1';
          const apiKey = url.searchParams.get('apiKey');

          if (!id || !apiKey) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: '缺少 id 或 apiKey 参数' }));
            return;
          }

          const tmdbUrl = `https://api.themoviedb.org/3/tv/${id}/season/${season}?api_key=${apiKey}&language=zh-CN`;
          fetch(tmdbUrl).then((r) => r.json()).then((data) => {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(data));
          }).catch((err) => {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
          });
          return;
        }

        // GET /api/cache — 读取全部缓存
        if (req.url === '/api/cache' && req.method === 'GET') {
          const cache = readCache();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(cache));
          return;
        }

        // POST /api/cache — 合并写入缓存（body: { key: value, ... }）
        if (req.url === '/api/cache' && req.method === 'POST') {
          try {
            const body = await readBody(req);
            const newData = JSON.parse(body);
            const existing = readCache();
            const merged = { ...existing, ...newData };
            writeCache(merged);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true, count: Object.keys(merged).length }));
          } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
          }
          return;
        }

        // DELETE /api/cache?key=xxx — 删除单条缓存
        if (req.url.startsWith('/api/cache') && req.method === 'DELETE') {
          try {
            const url = new URL(req.url, 'http://localhost');
            const key = url.searchParams.get('key');
            if (!key) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: '缺少 key 参数' }));
              return;
            }
            const existing = readCache();
            if (!(key in existing)) {
              res.writeHead(404, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: '缓存项不存在' }));
              return;
            }
            delete existing[key];
            writeCache(existing);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true }));
          } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
          }
          return;
        }

        next();
      });
    },
  };
}
