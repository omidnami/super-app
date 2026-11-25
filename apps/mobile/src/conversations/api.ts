import { createConfiguredConversationApi } from '@superapp/api-client'

export const conversationApi = createConfiguredConversationApi(
  process.env.EXPO_PUBLIC_PLANET_API_URL,
)
