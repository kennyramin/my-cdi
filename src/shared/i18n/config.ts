import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import commonFr from './locales/fr/common.json'
import studentFr from './locales/fr/student.json'
import frequentationFr from './locales/fr/frequentation.json'
import statisticsFr from './locales/fr/statistics.json'
import exportFr from './locales/fr/export.json'
import commonEn from './locales/en/common.json'
import studentEn from './locales/en/student.json'
import frequentationEn from './locales/en/frequentation.json'
import statisticsEn from './locales/en/statistics.json'
import exportEn from './locales/en/export.json'

export const defaultNS = 'common'

i18n.use(initReactI18next).init({
  resources: {
    fr: {
      common: commonFr,
      student: studentFr,
      frequentation: frequentationFr,
      statistics: statisticsFr,
      export: exportFr
    },
    en: {
      common: commonEn,
      student: studentEn,
      frequentation: frequentationEn,
      statistics: statisticsEn,
      export: exportEn
    }
  },
  lng: 'fr',
  fallbackLng: 'fr',
  defaultNS,
  interpolation: { escapeValue: false }
})

export default i18n
