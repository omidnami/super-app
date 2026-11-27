import { createConfiguredAccountingApi } from '@superapp/api-client'

export const accountingApi = createConfiguredAccountingApi(process.env.EXPO_PUBLIC_PLANET_API_URL)
