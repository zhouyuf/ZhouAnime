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
  return request(url, {
    method: 'GET',
  });
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

/**
 * SSE 流式请求
 * 后端通过 text/event-stream 逐条返回数据
 * @param {string} url - API 路径（不含 base）
 * @param {object} callbacks - 回调函数
 * @param {function} callbacks.onMessage - 每收到一条数据时回调
 * @param {function} [callbacks.onDone] - 流结束时回调
 * @param {function} [callbacks.onError] - 错误回调
 * @returns {AbortController} - 可通过 controller.abort() 中断连接
 */
export function sse(url, { onMessage, onDone, onError }) {
  const controller = new AbortController();

  fetch(`${API_BASE}${url}`, {
    headers: { Accept: 'text/event-stream' },
    signal: controller.signal,
  })
    .then(async (res) => {
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `SSE 请求失败: ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // 保留不完整的行

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data:')) {
            const jsonStr = trimmed.slice(5).trim();
            if (jsonStr) {
              try {
                const data = JSON.parse(jsonStr);
                onMessage(data);
              } catch {
                // 非 JSON 数据，忽略
              }
            }
          }
        }
      }

      // 处理 buffer 中剩余数据
      if (buffer.trim().startsWith('data:')) {
        const jsonStr = buffer.trim().slice(5).trim();
        if (jsonStr) {
          try {
            const data = JSON.parse(jsonStr);
            onMessage(data);
          } catch { /* ignore */ }
        }
      }

      onDone?.();
    })
    .catch((err) => {
      if (err.name !== 'AbortError') {
        onError?.(err);
      }
    });

  return controller;
}
