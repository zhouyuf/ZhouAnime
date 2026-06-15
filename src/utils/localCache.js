const FOLDERS_KEY = 'anime_folders';
const CACHE_KEY = 'anime_cache';
const DETAIL_KEY = 'anime_detail';
const VIDEOS_KEY = 'anime_videos';
const SEASON_KEY = 'anime_season';

/**
 * 获取缓存的文件夹名列表
 * @returns {string[] | null}
 */
export function getCachedFolders() {
  try {
    const data = localStorage.getItem(FOLDERS_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

/**
 * 缓存文件夹名列表
 * @param {string[]} folders
 */
export function setCachedFolders(folders) {
  localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
}

/**
 * 获取所有缓存的影片信息
 * @returns {Record<string, object>}
 */
export function getCachedAnime() {
  try {
    const data = localStorage.getItem(CACHE_KEY);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

/**
 * 获取单个影片缓存
 * @param {string} folderName
 * @returns {object | null}
 */
export function getCachedAnimeItem(folderName) {
  const cache = getCachedAnime();
  return cache[folderName] || null;
}

/**
 * 保存单个或多个影片信息到缓存
 * @param {Record<string, object>} entries - { folderName: animeInfo }
 */
export function setCachedAnime(entries) {
  const cache = getCachedAnime();
  Object.assign(cache, entries);
  localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
}

/**
 * 删除单个影片缓存
 * @param {string} folderName
 */
export function removeCachedAnime(folderName) {
  const cache = getCachedAnime();
  delete cache[folderName];
  localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
}

/**
 * 获取缓存的影片详情
 * @param {string} folderName
 * @returns {object | null}
 */
export function getCachedDetail(folderName) {
  try {
    const data = localStorage.getItem(DETAIL_KEY);
    const cache = data ? JSON.parse(data) : {};
    return cache[folderName] || null;
  } catch {
    return null;
  }
}

/**
 * 缓存影片详情
 * @param {string} folderName
 * @param {object} detail
 */
export function setCachedDetail(folderName, detail) {
  try {
    const data = localStorage.getItem(DETAIL_KEY);
    const cache = data ? JSON.parse(data) : {};
    cache[folderName] = detail;
    localStorage.setItem(DETAIL_KEY, JSON.stringify(cache));
  } catch { /* ignore */ }
}

/**
 * 获取缓存的视频文件列表
 * @param {string} folderName
 * @returns {string[] | null}
 */
export function getCachedVideos(folderName) {
  try {
    const data = localStorage.getItem(VIDEOS_KEY);
    const cache = data ? JSON.parse(data) : {};
    return cache[folderName] || null;
  } catch {
    return null;
  }
}

/**
 * 缓存视频文件列表
 * @param {string} folderName
 * @param {string[]} videos
 */
export function setCachedVideos(folderName, videos) {
  try {
    const data = localStorage.getItem(VIDEOS_KEY);
    const cache = data ? JSON.parse(data) : {};
    cache[folderName] = videos;
    localStorage.setItem(VIDEOS_KEY, JSON.stringify(cache));
  } catch { /* ignore */ }
}

/**
 * 获取缓存的季信息
 * @param {string} folderName
 * @param {number} seasonNumber
 * @returns {object | null}
 */
export function getCachedSeason(folderName, seasonNumber) {
  try {
    const data = localStorage.getItem(SEASON_KEY);
    const cache = data ? JSON.parse(data) : {};
    const key = `${folderName}_s${seasonNumber}`;
    return cache[key] || null;
  } catch {
    return null;
  }
}

/**
 * 缓存季信息
 * @param {string} folderName
 * @param {number} seasonNumber
 * @param {object} season
 */
export function setCachedSeason(folderName, seasonNumber, season) {
  try {
    const data = localStorage.getItem(SEASON_KEY);
    const cache = data ? JSON.parse(data) : {};
    const key = `${folderName}_s${seasonNumber}`;
    cache[key] = season;
    localStorage.setItem(SEASON_KEY, JSON.stringify(cache));
  } catch { /* ignore */ }
}
