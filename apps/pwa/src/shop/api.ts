import { createConfiguredShopApi } from '@superapp/api-client'

export const shopApi = createConfiguredShopApi(import.meta.env.VITE_PLANET_API_URL)
