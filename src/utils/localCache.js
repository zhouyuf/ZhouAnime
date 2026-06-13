const FOLDERS_KEY = 'anime_folders';
const CACHE_KEY = 'anime_cache';

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
