import { getToken } from './session';

export const BASE_URL = import.meta.env.VITE_API_BASE || 'https://m.colin-web4.cn/api';

// 后端契约与 app/src/api.js 一致：Sz-Admin 统一响应 { code: "0000", message, data }
async function request(method, path, data) {
  const token = await getToken();
  const res = await fetch(BASE_URL + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + token,
    },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  let body = null;
  try {
    body = await res.json();
  } catch {
    // 非 JSON 响应按 HTTP 状态报错
  }
  if (res.status === 200 && body && body.code === '0000') return body.data;
  const err = new Error((body && body.message) || 'HTTP ' + res.status);
  err.auth = res.status === 401 || (body && body.code === 'C105');
  throw err;
}

export const api = {
  kdf: (username) => request('GET', '/admin/passvault/kdf?username=' + encodeURIComponent(username)),
  register: (data) => request('POST', '/admin/passvault/register', data),
  login: (data) => request('POST', '/admin/passvault/login', data),
  getKey: () => request('GET', '/admin/passvault/key'),
  listItems: () => request('GET', '/admin/passvault/items'),
  createItem: (data) => request('POST', '/admin/passvault/items', data),
  updateItem: (id, data) => request('PUT', '/admin/passvault/items/' + id, data),
  deleteItem: (id) => request('DELETE', '/admin/passvault/items/' + id),
};
