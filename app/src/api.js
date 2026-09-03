import { request } from './utils/request';

// 后端为 Sz-Admin，com.sz.applet 包自动挂 /admin 前缀
export const api = {
  kdf: (username) => request('GET', '/admin/passvault/kdf?username=' + encodeURIComponent(username)),
  register: (data) => request('POST', '/admin/passvault/register', data),
  login: (data) => request('POST', '/admin/passvault/login', data),
  getKey: () => request('GET', '/admin/passvault/key'),
  rekey: (data) => request('PUT', '/admin/passvault/key', data),
  listItems: () => request('GET', '/admin/passvault/items'),
  createItem: (data) => request('POST', '/admin/passvault/items', data),
  updateItem: (id, data) => request('PUT', '/admin/passvault/items/' + id, data),
  deleteItem: (id) => request('DELETE', '/admin/passvault/items/' + id),
};
