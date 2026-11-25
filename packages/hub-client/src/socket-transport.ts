import { io } from 'socket.io-client'
import type { HubMessage } from '@superapp/chat-contracts'
import type { HubAck, HubEvent, HubTransport } from './types'

export function createSocketIoHubTransport(): HubTransport {
  let socket: ReturnType<typeof io> | null = null
  const listeners = new Set<(event: HubEvent) => void>()
  const emit = (event: HubEvent) => listeners.forEach((listener) => listener(event))

  return {
    connect({ url, connectionToken }) {
      return new Promise<void>((resolve, reject) => {
        socket = io(url, {
          transports: ['websocket'],
          auth: { connection_token: connectionToken },
          autoConnect: false,
          reconnection: false,
        })

        const timeout = window.setTimeout(() => {
          cleanup()
          socket?.close()
          reject(new Error('Hub authentication timeout'))
        }, 12000)

        const cleanup = () => {
          window.clearTimeout(timeout)
          socket?.off('authenticated', onAuthenticated)
          socket?.off('connect_error', onConnectError)
        }
        const onAuthenticated = (payload: { project_id?: string; role?: string }) => {
          cleanup()
          emit({ type: 'authenticated', payload })
          resolve()
        }
        const onConnectError = (error: Error) => {
          cleanup()
          emit({ type: 'connect_error', error: error.message })
          reject(error)
        }

        socket.on('connect', () => emit({ type: 'connect' }))
        socket.on('authenticated', onAuthenticated)
        socket.on('connect_error', onConnectError)
        socket.on('disconnect', (reason) => emit({ type: 'disconnect', reason }))
        socket.on('chat', (message: HubMessage) => emit({ type: 'chat', message }))
        socket.on('chat_error', (error: HubAck) => emit({ type: 'chat_error', error }))
        socket.connect()
      })
    },

    disconnect() {
      socket?.disconnect()
      socket = null
    },

    send(message: HubMessage) {
      return new Promise<HubAck>((resolve) => {
        if (!socket?.connected) {
          resolve({ status: false, code: 'DISCONNECTED', message: 'Hub is disconnected' })
          return
        }
        const timeout = window.setTimeout(() => {
          resolve({ status: false, code: 'TIMEOUT', message: 'Hub acknowledgement timeout' })
        }, 10000)
        socket.emit('chat', message, (ack: HubAck) => {
          window.clearTimeout(timeout)
          resolve(ack)
        })
      })
    },

    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
