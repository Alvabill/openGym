import { baseLang, getLang, t } from './i18n-core.js'

// These gateway-specific hints are currently translated only in Simplified Chinese.
// Keep them out of the shared locale packs until all supported languages have copy.
const zh = {
  'Extra request headers': '额外请求头',
  'Check extra request headers: {0}': '请检查额外请求头：{0}',
  'Use only non-secret gateway headers here. Never paste an API key; use the API key field below. If your gateway requires Version, enter the exact value from its documentation.': '这里只填写网关要求的非敏感请求头。不要粘贴 API 密钥；请使用下方的密钥输入框。如果网关要求 Version，请按它的文档填写准确的值。',
  'Version: value from gateway documentation': 'Version: 按网关文档填写的值',
}

export function coachSetupT(source, ...args) {
  const translated = baseLang(getLang()) === 'zh' ? zh[source] : null
  if (!translated) return t(source, ...args)
  return args.reduce((value, arg, i) => value.replaceAll('{' + i + '}', arg), translated)
}
