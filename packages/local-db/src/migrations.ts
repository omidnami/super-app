export interface Migration {
  version: number
  name: string
  sql: string
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'initial_offline_schema',
    sql: `
      CREATE TABLE IF NOT EXISTS cached_conversations (
        owner_id TEXT NOT NULL,
        server_id TEXT NOT NULL,
        source TEXT NOT NULL,
        robot_id TEXT NOT NULL,
        chat_id TEXT NOT NULL,
        customer_json TEXT NOT NULL,
        support_level TEXT NOT NULL,
        status TEXT NOT NULL,
        assignee_json TEXT,
        last_message TEXT NOT NULL DEFAULT '',
        last_message_at TEXT,
        unread_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT,
        synced_at TEXT NOT NULL,
        cache_status TEXT NOT NULL DEFAULT 'synced',
        PRIMARY KEY (owner_id, server_id),
        UNIQUE (owner_id, source, robot_id, chat_id)
      );

      CREATE INDEX IF NOT EXISTS idx_conversations_owner_updated
        ON cached_conversations (owner_id, updated_at DESC);

      CREATE TABLE IF NOT EXISTS cached_messages (
        owner_id TEXT NOT NULL,
        server_id TEXT NOT NULL,
        conversation_id TEXT NOT NULL,
        client_mutation_id TEXT,
        sender TEXT NOT NULL,
        sender_id TEXT NOT NULL,
        text TEXT NOT NULL DEFAULT '',
        attachment_json TEXT,
        sent_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT,
        delivery_status TEXT NOT NULL DEFAULT 'sent',
        synced_at TEXT NOT NULL,
        cache_status TEXT NOT NULL DEFAULT 'synced',
        PRIMARY KEY (owner_id, server_id),
        FOREIGN KEY (owner_id, conversation_id)
          REFERENCES cached_conversations (owner_id, server_id)
          ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_messages_owner_conversation
        ON cached_messages (owner_id, conversation_id, sent_at ASC, server_id ASC);

      CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_client_mutation
        ON cached_messages (owner_id, client_mutation_id)
        WHERE client_mutation_id IS NOT NULL;

      CREATE TABLE IF NOT EXISTS sync_state (
        owner_id TEXT NOT NULL,
        dataset TEXT NOT NULL,
        cursor TEXT,
        last_synced_at TEXT,
        status TEXT NOT NULL DEFAULT 'idle',
        PRIMARY KEY (owner_id, dataset)
      );

      CREATE TABLE IF NOT EXISTS app_settings (
        owner_id TEXT NOT NULL,
        key TEXT NOT NULL,
        value_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (owner_id, key)
      );

      CREATE TABLE IF NOT EXISTS cached_orders (
        owner_id TEXT NOT NULL,
        server_id TEXT NOT NULL,
        code TEXT NOT NULL,
        customer_name TEXT NOT NULL,
        status TEXT NOT NULL,
        payment_status TEXT NOT NULL,
        total_amount INTEGER NOT NULL,
        currency TEXT NOT NULL DEFAULT 'IRR',
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT,
        synced_at TEXT NOT NULL,
        PRIMARY KEY (owner_id, server_id)
      );

      CREATE INDEX IF NOT EXISTS idx_orders_owner_updated
        ON cached_orders (owner_id, updated_at DESC);

      CREATE TABLE IF NOT EXISTS cached_products (
        owner_id TEXT NOT NULL,
        server_id TEXT NOT NULL,
        title TEXT NOT NULL,
        slug TEXT NOT NULL,
        status TEXT NOT NULL,
        price_amount INTEGER NOT NULL,
        currency TEXT NOT NULL DEFAULT 'IRR',
        inventory_quantity INTEGER NOT NULL DEFAULT 0,
        payload_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT,
        synced_at TEXT NOT NULL,
        PRIMARY KEY (owner_id, server_id)
      );

      CREATE INDEX IF NOT EXISTS idx_products_owner_updated
        ON cached_products (owner_id, updated_at DESC);

      CREATE TABLE IF NOT EXISTS cached_accounting_documents (
        owner_id TEXT NOT NULL,
        server_id TEXT NOT NULL,
        code TEXT NOT NULL,
        type TEXT NOT NULL,
        status TEXT NOT NULL,
        counterparty_name TEXT NOT NULL,
        total_amount INTEGER NOT NULL,
        currency TEXT NOT NULL DEFAULT 'IRR',
        payload_json TEXT NOT NULL,
        issued_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT,
        synced_at TEXT NOT NULL,
        PRIMARY KEY (owner_id, server_id)
      );

      CREATE INDEX IF NOT EXISTS idx_accounting_owner_updated
        ON cached_accounting_documents (owner_id, updated_at DESC);

      CREATE TABLE IF NOT EXISTS cached_reports (
        owner_id TEXT NOT NULL,
        report_key TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        synced_at TEXT NOT NULL,
        PRIMARY KEY (owner_id, report_key)
      );

      CREATE TABLE IF NOT EXISTS crm_contacts (
        owner_id TEXT NOT NULL,
        local_id TEXT NOT NULL,
        display_name TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        tags_json TEXT NOT NULL DEFAULT '[]',
        notes_json TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT,
        PRIMARY KEY (owner_id, local_id)
      );

      CREATE TABLE IF NOT EXISTS crm_tags (
        owner_id TEXT NOT NULL,
        local_id TEXT NOT NULL,
        title TEXT NOT NULL,
        color TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (owner_id, local_id)
      );

      CREATE TABLE IF NOT EXISTS crm_notes (
        owner_id TEXT NOT NULL,
        local_id TEXT NOT NULL,
        contact_id TEXT NOT NULL,
        body TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT,
        PRIMARY KEY (owner_id, local_id),
        FOREIGN KEY (owner_id, contact_id)
          REFERENCES crm_contacts (owner_id, local_id)
          ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS crm_tasks (
        owner_id TEXT NOT NULL,
        local_id TEXT NOT NULL,
        contact_id TEXT,
        title TEXT NOT NULL,
        due_at TEXT,
        completed INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT,
        PRIMARY KEY (owner_id, local_id)
      );

      CREATE TABLE IF NOT EXISTS crm_interactions (
        owner_id TEXT NOT NULL,
        local_id TEXT NOT NULL,
        contact_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        summary TEXT NOT NULL,
        occurred_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT,
        PRIMARY KEY (owner_id, local_id),
        FOREIGN KEY (owner_id, contact_id)
          REFERENCES crm_contacts (owner_id, local_id)
          ON DELETE CASCADE
      );
    `,
  },
  {
    version: 2,
    name: 'scope_conversation_cache_by_operator',
    sql: `
      ALTER TABLE cached_conversations
        ADD COLUMN project_id TEXT NOT NULL DEFAULT '';

      DELETE FROM cached_messages;
      DELETE FROM cached_conversations;
    `,
  },
]
