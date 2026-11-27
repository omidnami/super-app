import { createConfiguredAccountingApi } from '@superapp/api-client'

export const accountingApi = createConfiguredAccountingApi(import.meta.env.VITE_PLANET_API_URL)
