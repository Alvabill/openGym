import { baseLang, getLang, t } from './i18n-core.js'
import adminZh from './admin-zh.js'

// The admin dashboard has a Chinese operator pack without adding hundreds of new keys to
// every end-user locale. Existing translations still apply to shared UI strings.
export function adminT(source, ...args) {
  const translated = baseLang(getLang()) === 'zh' ? adminZh[source] : null
  if (!translated) return t(source, ...args)
  return args.reduce((value, arg, i) => value.replaceAll('{' + i + '}', arg), translated)
}
