import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mockData } from './data.mjs'

const currentDirectory = dirname(fileURLToPath(import.meta.url))
const fixtureDirectory = resolve(currentDirectory, 'fixtures')
await mkdir(fixtureDirectory, { recursive: true })

const fixtures = {
  conversations: mockData.conversations,
  messages: mockData.messages,
  orders: mockData.orders,
  products: mockData.products,
  'accounting-documents': mockData.accountingDocuments,
  attachments: mockData.attachments,
  'sync-changes': mockData.syncChanges,
}

for (const [name, value] of Object.entries(fixtures)) {
  await writeFile(
    resolve(fixtureDirectory, `${name}.json`),
    `${JSON.stringify(value, null, 2)}\n`,
    'utf8',
  )
}

console.log(`Generated ${Object.keys(fixtures).length} fixture files.`)
