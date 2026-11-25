import { createConfiguredConversationApi } from '@superapp/api-client'

export const conversationApi = createConfiguredConversationApi(import.meta.env.VITE_PLANET_API_URL)
