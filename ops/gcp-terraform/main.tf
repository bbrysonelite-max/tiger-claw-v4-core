terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

locals {
  common_labels = {
    env  = "production"
    app  = "tiger-claw"
    tier = "infra"
  }
}

# ------------------------------------------------------------------------------
# Enable Required APIs
# ------------------------------------------------------------------------------
resource "google_project_service" "required_apis" {
  for_each = toset([
    "run.googleapis.com",
    "sqladmin.googleapis.com",
    "redis.googleapis.com",
    "secretmanager.googleapis.com",
    "servicenetworking.googleapis.com",
    "vpcaccess.googleapis.com",
    "cloudbuild.googleapis.com",
    "containerregistry.googleapis.com",
  ])
  service            = each.key
  disable_on_destroy = false
}

# ------------------------------------------------------------------------------
# Network / VPC (Required for private Cloud SQL + Redis)
# ------------------------------------------------------------------------------
resource "google_compute_network" "vpc" {
  name                    = "tiger-claw-vpc"
  auto_create_subnetworks = "false"
  project                 = var.project_id
  depends_on              = [google_project_service.required_apis]
}

resource "google_compute_subnetwork" "subnet" {
  name                     = "tiger-claw-subnet"
  region                   = var.region
  network                  = google_compute_network.vpc.name
  ip_cidr_range            = "10.10.0.0/24"
  private_ip_google_access = true
}

# ------------------------------------------------------------------------------
# Cloud NAT (Allows VPC instances/connectors to reach the public internet)
# ------------------------------------------------------------------------------
resource "google_compute_router" "router" {
  name    = "tiger-claw-router"
  region  = var.region
  network = google_compute_network.vpc.id
}

resource "google_compute_router_nat" "nat" {
  name                               = "tiger-claw-nat"
  router                             = google_compute_router.router.name
  region                             = var.region
  nat_ip_allocate_option             = "AUTO_ONLY"
  source_subnetwork_ip_ranges_to_nat = "ALL_SUBNETWORKS_ALL_IP_RANGES"

  log_config {
    enable = true
    filter = "ERRORS_ONLY"
  }
}

resource "google_compute_global_address" "private_ip_address" {
  name          = "tiger-claw-private-ip"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 16
  network       = google_compute_network.vpc.id
}

resource "google_service_networking_connection" "private_vpc_connection" {
  network                 = google_compute_network.vpc.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_ip_address.name]
}

# ------------------------------------------------------------------------------
# VPC Connector (Cloud Run → private VPC for SQL/Redis)
# ------------------------------------------------------------------------------
resource "google_vpc_access_connector" "connector" {
  name          = "tiger-claw-connector"
  region        = var.region
  network       = google_compute_network.vpc.name
  ip_cidr_range = "10.8.0.0/28"
  min_instances = 2
  max_instances = 10

  depends_on = [google_project_service.required_apis]
}

# ------------------------------------------------------------------------------
# Cloud SQL (PostgreSQL HA)
# ------------------------------------------------------------------------------
resource "google_sql_database_instance" "master" {
  name                = "tiger-claw-postgres-ha"
  database_version    = "POSTGRES_15"
  region              = var.region
  deletion_protection = true

  settings {
    tier              = "db-custom-2-8192" # 2 vCPU, 8GB RAM
    availability_type = "REGIONAL"         # Cross-zone HA failover
    user_labels       = merge(local.common_labels, { tier = "data" })

    backup_configuration {
      enabled                        = true
      point_in_time_recovery_enabled = true
    }

    ip_configuration {
      ipv4_enabled    = true # Require public IP for local MCP access
      private_network = google_compute_network.vpc.id
    }

    insights_config {
      query_insights_enabled  = true
      query_string_length     = 1024
      record_application_tags = true
      record_client_address   = false
    }
  }

  depends_on = [google_service_networking_connection.private_vpc_connection]
}

resource "google_sql_database_instance" "replica" {
  name                 = "tiger-claw-postgres-replica"
  database_version     = "POSTGRES_15"
  region               = var.region
  master_instance_name = google_sql_database_instance.master.name
  deletion_protection  = false

  settings {
    tier              = "db-custom-2-8192"
    availability_type = "ZONAL"
    user_labels       = merge(local.common_labels, { tier = "data-replica" })

    ip_configuration {
      ipv4_enabled    = true
      private_network = google_compute_network.vpc.id
    }
  }

  depends_on = [google_sql_database_instance.master]
}

resource "google_sql_database" "database" {
  name     = "tiger_claw_shared"
  instance = google_sql_database_instance.master.name
}

resource "google_sql_user" "botcraft" {
  name     = "botcraft"
  instance = google_sql_database_instance.master.name
  password = var.db_password
}

# ------------------------------------------------------------------------------
# Cloud Memorystore (Redis HA) — BullMQ queues + chat history
# ------------------------------------------------------------------------------
resource "google_redis_instance" "tiger_cache" {
  name               = "tiger-claw-redis-ha"
  tier               = "STANDARD_HA" # Cross-zone replication
  memory_size_gb     = 5
  region             = var.region
  redis_version      = "REDIS_6_X"
  display_name       = "Tiger Claw Queues"
  authorized_network = google_compute_network.vpc.id
  labels             = merge(local.common_labels, { tier = "cache" })

  redis_configs = {
    "maxmemory-policy" = "noeviction"
  }

  depends_on = [google_service_networking_connection.private_vpc_connection]
}

# ------------------------------------------------------------------------------
# Cloud Run Service (replaces GKE — stateless multi-tenant)
# Min 1 instance to prevent cold starts, auto-scales to 10.
# All secrets injected from Secret Manager.
# ------------------------------------------------------------------------------
resource "google_cloud_run_v2_service" "api" {
  name     = "tiger-claw-api"
  location = var.region
  labels   = merge(local.common_labels, { tier = "compute" })

  template {
    scaling {
      min_instance_count = 2
      max_instance_count = 100
    }

    vpc_access {
      connector = google_vpc_access_connector.connector.id
      egress    = "ALL_TRAFFIC"
    }

    containers {
      image = "gcr.io/${var.project_id}/tiger-claw-api:latest"

      ports {
        container_port = 4000
      }

      resources {
        limits = {
          cpu    = "2"
          memory = "2Gi"
        }
        cpu_idle = false
      }

      volume_mounts {
        name       = "secret-db-url"
        mount_path = "/secrets/DATABASE_URL"
      }
      volume_mounts {
        name       = "secret-redis-url"
        mount_path = "/secrets/REDIS_URL"
      }
      volume_mounts {
        name       = "secret-google-api-key"
        mount_path = "/secrets/GOOGLE_API_KEY"
      }
      volume_mounts {
        name       = "secret-stripe-secret"
        mount_path = "/secrets/STRIPE_SECRET_KEY"
      }
      volume_mounts {
        name       = "secret-stripe-webhook"
        mount_path = "/secrets/STRIPE_WEBHOOK_SECRET"
      }
      volume_mounts {
        name       = "secret-admin-token"
        mount_path = "/secrets/ADMIN_TOKEN"
      }
      volume_mounts {
        name       = "secret-bot-token"
        mount_path = "/secrets/ADMIN_TELEGRAM_BOT_TOKEN"
      }
      volume_mounts {
        name       = "secret-encryption-key"
        mount_path = "/secrets/ENCRYPTION_KEY"
      }

      startup_probe {
        timeout_seconds   = 10
        period_seconds    = 15
        failure_threshold = 5
        http_get {
          path = "/health"
          port = 4000
        }
      }

      liveness_probe {
        timeout_seconds   = 5
        period_seconds    = 30
        failure_threshold = 3
        http_get {
          path = "/health"
          port = 4000
        }
      }

      env {
        name  = "REVISION_TIMESTAMP"
        value = "1773816000"
      }
      env {
        name  = "NODE_ENV"
        value = "production"
      }
      env {
        name  = "ALLOWED_ORIGINS"
        value = "https://app.tigerclaw.io,https://tigerclaw.io,https://thegoods.ai,https://tiger-claw-frontend-tnyyn7xjtq-uc.a.run.app"
      }

      # Secrets from Secret Manager (Legacy Env injection)
      dynamic "env" {
        for_each = {
          DATABASE_URL              = "tiger-claw-database-url"
          DATABASE_READ_URL         = "tiger-claw-database-url" # Placeholder — in production this would be a separate secret or connection string
          REDIS_URL                 = "tiger-claw-redis-url"
          
          FRONTEND_URL              = "FRONTEND_URL"
          TIGER_CLAW_API_URL        = "TIGER_CLAW_API_URL"

          GOOGLE_API_KEY            = "tiger-claw-google-api-key"
          STRIPE_SECRET_KEY         = "tiger-claw-stripe-secret-key"
          STRIPE_WEBHOOK_SECRET     = "tiger-claw-stripe-webhook-secret"
          ADMIN_TOKEN               = "tiger-claw-admin-token"
          ADMIN_TELEGRAM_BOT_TOKEN  = "tiger-claw-admin-telegram-bot-token"
          ADMIN_TELEGRAM_CHAT_ID    = "tiger-claw-admin-telegram-chat-id"
          TIGER_CLAW_HIVE_TOKEN     = "tiger-claw-hive-token"
          PLATFORM_ONBOARDING_KEY   = "tiger-claw-platform-onboarding-key"
          PLATFORM_EMERGENCY_KEY    = "tiger-claw-platform-emergency-key"
          ENCRYPTION_KEY            = "tiger-claw-encryption-key"
          STRIPE_PRICE_BYOK         = "tiger-claw-stripe-price-byok"
          SERPER_KEY_1              = "tiger-claw-serper-key-1"
          SERPER_KEY_2              = "tiger-claw-serper-key-2"
          SERPER_KEY_3              = "tiger-claw-serper-key-3"
        }
        content {
          name = env.key
          value_source {
            secret_key_ref {
              secret  = env.value
              version = "latest"
            }
          }
        }
      }
    }

    volumes {
      name = "secret-db-url"
      secret {
        secret = "tiger-claw-database-url"
        items {
          version = "latest"
          path    = "DATABASE_URL"
        }
      }
    }
    volumes {
      name = "secret-redis-url"
      secret {
        secret = "tiger-claw-redis-url"
        items {
          version = "latest"
          path    = "REDIS_URL"
        }
      }
    }
    volumes {
      name = "secret-google-api-key"
      secret {
        secret = "tiger-claw-google-api-key"
        items {
          version = "latest"
          path    = "GOOGLE_API_KEY"
        }
      }
    }
    volumes {
      name = "secret-stripe-secret"
      secret {
        secret = "tiger-claw-stripe-secret-key"
        items {
          version = "latest"
          path    = "STRIPE_SECRET_KEY"
        }
      }
    }
    volumes {
      name = "secret-stripe-webhook"
      secret {
        secret = "tiger-claw-stripe-webhook-secret"
        items {
          version = "latest"
          path    = "STRIPE_WEBHOOK_SECRET"
        }
      }
    }
    volumes {
      name = "secret-admin-token"
      secret {
        secret = "tiger-claw-admin-token"
        items {
          version = "latest"
          path    = "ADMIN_TOKEN"
        }
      }
    }
    volumes {
      name = "secret-bot-token"
      secret {
        secret = "tiger-claw-admin-telegram-bot-token"
        items {
          version = "latest"
          path    = "ADMIN_TELEGRAM_BOT_TOKEN"
        }
      }
    }
    volumes {
      name = "secret-encryption-key"
      secret {
        secret = "tiger-claw-encryption-key"
        items {
          version = "latest"
          path    = "ENCRYPTION_KEY"
        }
      }
    }

    timeout = "300s"
  }

  depends_on = [google_project_service.required_apis]
}

# Allow public access (Telegram webhooks, Stripe webhooks, wizard)
resource "google_cloud_run_v2_service_iam_member" "public" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.api.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# ------------------------------------------------------------------------------
# Outputs
# ------------------------------------------------------------------------------
output "api_url" {
  value       = google_cloud_run_v2_service.api.uri
  description = "Cloud Run API URL"
}

output "sql_connection_name" {
  value       = google_sql_database_instance.master.connection_name
  description = "Cloud SQL connection name for proxy"
}

output "redis_host" {
  value       = google_redis_instance.tiger_cache.host
  description = "Redis HA host"
}
