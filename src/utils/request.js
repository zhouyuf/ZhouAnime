import { API_BASE } from '../config';

/**
 * 统一请求封装
 * 后端返回格式: { code: 200, message: "success", data: {} }
 * @param {string} url - API 路径（不含 base）
 * @param {RequestInit} options - fetch 选项
 * @returns {Promise<any>} - 返回 data 字段
 */
export async function request(url, options = {}) {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });

  const json = await res.json();

  if (json.code !== 200) {
    throw new Error(json.message || `请求失败: ${url}`);
  }

  return json.data;
}

/**
 * GET 请求
 */
export function get(url) {
  return request(url);
}

/**
 * POST 请求
 */
export function post(url, body) {
  return request(url, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/**
 * PUT 请求
 */
export function put(url, body) {
  return request(url, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

/**
 * DELETE 请求
 */
export function del(url) {
  return request(url, { method: 'DELETE' });
}
