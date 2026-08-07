import { describe, expect, it } from 'vitest'
import {
  localizeBehaviour,
  localizeGeneratedName,
  localizeSeason,
  localizeWorldText,
} from './i18n'

describe('Traditional Chinese localization', () => {
  it('localizes stable simulation vocabulary', () => {
    expect(localizeBehaviour('migrate', 'zh-HK')).toBe('遷徙')
    expect(localizeSeason('long-rain', 'zh-HK')).toBe('長雨季')
    expect(localizeBehaviour('migrate', 'en')).toBe('Migrate')
  })

  it('localizes generated species and group names without changing stored data', () => {
    expect(localizeGeneratedName('Verdant grazer', 'zh-HK')).toBe('翠綠食草獸')
    expect(localizeGeneratedName('Swift reedrunner', 'zh-HK')).toBe('迅捷蘆原奔獸')
    expect(localizeGeneratedName('Meadow herd 402', 'zh-HK')).toBe('草原獸群 402')
    expect(localizeGeneratedName('Ember pack 91', 'en')).toBe('Ember pack 91')
  })

  it('localizes current dynamic world-event templates', () => {
    expect(localizeWorldText('A living world awakens', 'zh-HK')).toBe('一個生命世界甦醒了')
    expect(localizeWorldText('Seed MOSS-1738 has begun its first day.', 'zh-HK')).toBe('種子 MOSS-1738 已展開第一天。')
    expect(localizeWorldText('Generation 8 has arrived', 'zh-HK')).toBe('第 8 代已誕生')
    expect(localizeWorldText('Swift reedrunner #73 differs strongly in speed, vision.', 'zh-HK')).toBe('迅捷蘆原奔獸 #73 在速度、視野方面有明顯差異。')
    expect(localizeWorldText('Ember pack 91 begins migrating', 'zh-HK')).toBe('餘燼獵群 91開始遷徙')
  })
})
