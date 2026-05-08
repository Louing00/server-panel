CREATE TYPE "UserRole" AS ENUM ('admin', 'operator', 'readonly', 'auditor');
CREATE TYPE "UserStatus" AS ENUM ('active', 'disabled');
CREATE TYPE "AuthType" AS ENUM ('password', 'privateKey', 'privateKeyWithPassphrase');
CREATE TYPE "ServerStatus" AS ENUM ('unknown', 'online', 'offline');

CREATE TABLE "users" (
  "id" UUID NOT NULL,
  "username" VARCHAR(64) NOT NULL,
  "password_hash" TEXT NOT NULL,
  "role" "UserRole" NOT NULL DEFAULT 'operator',
  "status" "UserStatus" NOT NULL DEFAULT 'active',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "last_login_at" TIMESTAMP(3),
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "refresh_tokens" (
  "id" UUID NOT NULL,
  "token_hash" TEXT NOT NULL,
  "user_id" UUID NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "revoked_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "server_groups" (
  "id" UUID NOT NULL,
  "name" VARCHAR(128) NOT NULL,
  "description" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "server_groups_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "credentials" (
  "id" UUID NOT NULL,
  "type" "AuthType" NOT NULL,
  "encrypted_payload" TEXT NOT NULL,
  "key_version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "credentials_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "servers" (
  "id" UUID NOT NULL,
  "group_id" UUID,
  "name" VARCHAR(128) NOT NULL,
  "host" VARCHAR(255) NOT NULL,
  "port" INTEGER NOT NULL DEFAULT 22,
  "username" VARCHAR(128) NOT NULL,
  "auth_type" "AuthType" NOT NULL,
  "credential_id" UUID,
  "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "description" TEXT,
  "status" "ServerStatus" NOT NULL DEFAULT 'unknown',
  "last_success_at" TIMESTAMP(3),
  "last_failure_at" TIMESTAMP(3),
  "last_failure_reason" TEXT,
  "created_by" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "servers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "audit_logs" (
  "id" UUID NOT NULL,
  "user_id" UUID,
  "action" VARCHAR(128) NOT NULL,
  "resource_type" VARCHAR(64),
  "resource_id" UUID,
  "ip" VARCHAR(64),
  "user_agent" TEXT,
  "detail" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ssh_sessions" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "server_id" UUID NOT NULL,
  "status" VARCHAR(32) NOT NULL,
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ended_at" TIMESTAMP(3),
  "close_reason" TEXT,
  CONSTRAINT "ssh_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");
CREATE INDEX "servers_host_idx" ON "servers"("host");
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

ALTER TABLE "refresh_tokens"
  ADD CONSTRAINT "refresh_tokens_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "servers"
  ADD CONSTRAINT "servers_group_id_fkey"
  FOREIGN KEY ("group_id") REFERENCES "server_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "servers"
  ADD CONSTRAINT "servers_credential_id_fkey"
  FOREIGN KEY ("credential_id") REFERENCES "credentials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "servers"
  ADD CONSTRAINT "servers_created_by_fkey"
  FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "audit_logs"
  ADD CONSTRAINT "audit_logs_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "audit_logs"
  ADD CONSTRAINT "audit_logs_resource_id_fkey"
  FOREIGN KEY ("resource_id") REFERENCES "servers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ssh_sessions"
  ADD CONSTRAINT "ssh_sessions_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ssh_sessions"
  ADD CONSTRAINT "ssh_sessions_server_id_fkey"
  FOREIGN KEY ("server_id") REFERENCES "servers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
