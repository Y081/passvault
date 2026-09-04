// 站点匹配：只做 hostname 层面的同站判断，用于「此网站」分组的排序展示。
// 刻意不做协议/端口/路径匹配——匹配结果只是列表排序权重，最终选择权在用户。
// endsWith('.' + host) 而非 endsWith(host)，保证 evil-example.com 不会误配 example.com。

export function hostOf(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

export function isSameSite(entryUrl, origin) {
  const a = hostOf(entryUrl);
  const b = hostOf(origin);
  if (!a || !b) return false;
  if (a === b) return true;
  return a.endsWith('.' + b) || b.endsWith('.' + a);
}
