export async function createIdentityTables(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS schools (
      id UUID PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS tenants (
      id UUID PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      tenant_type TEXT NOT NULL DEFAULT 'school' CHECK (tenant_type IN ('school', 'business', 'government', 'class', 'community', 'event', 'other')),
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS school_memberships (
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('superadmin', 'school_admin')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CHECK (
        (role = 'superadmin' AND school_id IS NULL)
        OR
        (role = 'school_admin' AND school_id IS NOT NULL)
      ),
      UNIQUE (user_id, school_id, role)
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS tenant_memberships (
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('superadmin', 'tenant_admin', 'analyst')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, tenant_id, role)
    );
  `;
}
