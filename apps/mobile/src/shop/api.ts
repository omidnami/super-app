import { createConfiguredShopApi } from '@superapp/api-client'

export const shopApi = createConfiguredShopApi(process.env.EXPO_PUBLIC_PLANET_API_URL)
