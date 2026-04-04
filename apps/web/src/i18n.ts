import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import commonPt from '@/locales/pt/common.json'

void i18n.use(initReactI18next).init({
  lng: 'pt',
  fallbackLng: 'pt',
  defaultNS: 'common',
  ns: ['common'],
  resources: {
    pt: { common: commonPt },
  },
  interpolation: { escapeValue: false },
})

export default i18n
