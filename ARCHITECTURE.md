# Multi-Tenant Platform Architecture Diagrams

## System Overview

```mermaid
flowchart TB
    subgraph Internet["Public Internet"]
        Users((End Users))
        Admins((Platform Admins))
    end

    subgraph Edge["Edge Layer"]
        DNS["DNS<br/>*.platform.com"]
        Traefik["Traefik v3<br/>Reverse Proxy"]
    end

    subgraph Platform["Platform Layer"]
        subgraph AdminStack["Admin Stack"]
            SuperAdmin["Super Admin<br/>Next.js"]
            ProvisioningAPI["Provisioning API<br/>Hono"]
            PlatformDB[("Platform DB<br/>PostgreSQL")]
        end
    end

    subgraph Tenants["Tenant Layer"]
        subgraph TenantA["Tenant A (tenant-a.platform.com)"]
            direction TB
            MA["Medusa API<br/>:9000"]
            AA["Admin UI<br/>:5173"]
            DA[("PostgreSQL")]
            RA["Redis"]
        end

        subgraph TenantB["Tenant B (tenant-b.platform.com)"]
            direction TB
            MB["Medusa API<br/>:9000"]
            AB["Admin UI<br/>:5173"]
            DB[("PostgreSQL")]
            RB["Redis"]
        end

        subgraph TenantN["Tenant N..."]
            direction TB
            MN["Medusa API"]
            AN["Admin UI"]
            DN[("PostgreSQL")]
            RN["Redis"]
        end
    end

    Users --> DNS
    Admins --> DNS
    DNS --> Traefik

    Traefik -->|"admin.platform.com"| SuperAdmin
    Traefik -->|"api.platform.com"| ProvisioningAPI
    Traefik -->|"tenant-a.platform.com"| MA
    Traefik -->|"tenant-a.platform.com/app"| AA
    Traefik -->|"tenant-b.platform.com"| MB
    Traefik -->|"tenant-n.platform.com"| MN

    SuperAdmin <--> ProvisioningAPI
    ProvisioningAPI <--> PlatformDB
    ProvisioningAPI -.->|"Docker API"| TenantA
    ProvisioningAPI -.->|"Docker API"| TenantB
    ProvisioningAPI -.->|"Docker API"| TenantN

    MA <--> DA
    MA <--> RA
    MB <--> DB
    MB <--> RB
    MN <--> DN
    MN <--> RN
```

---

## Tenant Provisioning Flow

```mermaid
sequenceDiagram
    autonumber
    participant Admin as Platform Admin
    participant UI as Super Admin Dashboard
    participant API as Provisioning API
    participant DB as Platform Database
    participant Docker as Docker Engine
    participant Traefik as Traefik Proxy

    Admin->>UI: Click "Create Tenant"
    UI->>UI: Show creation wizard
    Admin->>UI: Submit tenant details
    UI->>API: POST /tenants {name, subdomain, config}

    API->>DB: Insert tenant record (status: pending)
    DB-->>API: tenant_id

    Note over API,Docker: Container Provisioning

    API->>Docker: Create network (tenant_{id}_network)
    Docker-->>API: network_id

    API->>Docker: Create PostgreSQL container
    Docker-->>API: postgres_container_id
    API->>DB: Save resource record

    API->>Docker: Wait for PostgreSQL healthy
    Docker-->>API: healthy

    API->>Docker: Create Redis container
    Docker-->>API: redis_container_id
    API->>DB: Save resource record

    API->>Docker: Create Medusa container
    Docker-->>API: medusa_container_id
    API->>DB: Save resource record

    API->>Docker: Wait for Medusa healthy
    Docker-->>API: healthy

    Note over API,Traefik: Routing Configuration

    API->>Traefik: Add routing rule for subdomain
    Traefik-->>API: confirmed

    API->>DB: Update tenant status: running
    API-->>UI: {tenant_id, status: running, url}
    UI-->>Admin: Show success with tenant URL
```

---

## Tenant Lifecycle States

```mermaid
stateDiagram-v2
    [*] --> Requested: Create Tenant

    Requested --> Provisioning: Accept Request
    Provisioning --> Running: All Containers Up
    Provisioning --> Failed: Provisioning Error

    Failed --> Provisioning: Retry
    Failed --> Terminated: Cleanup

    Running --> Stopped: Stop Command
    Running --> Restarting: Restart Command
    Running --> Terminating: Delete Command

    Stopped --> Running: Start Command
    Stopped --> Terminating: Delete Command

    Restarting --> Running: Containers Up
    Restarting --> Failed: Restart Error

    Terminating --> Terminated: Cleanup Complete
    Terminated --> [*]

    note right of Running
        Tenant is fully operational
        - API responding
        - Admin UI accessible
        - DB connected
    end note

    note right of Stopped
        Containers exist but stopped
        - Data preserved
        - No resource usage
        - Quick restart possible
    end note
```

---

## Data Model

```mermaid
erDiagram
    TENANT {
        uuid id PK "Primary key"
        string name "Display name"
        string slug UK "URL-safe identifier"
        string subdomain UK "tenant.platform.com"
        enum status "pending|provisioning|running|stopped|failed|terminated"
        json config "Tenant configuration"
        string admin_email "Initial admin email"
        datetime created_at
        datetime updated_at
        datetime deleted_at "Soft delete"
    }

    TENANT_RESOURCE {
        uuid id PK
        uuid tenant_id FK
        enum resource_type "postgres|redis|medusa|network"
        string container_id "Docker container ID"
        string container_name "Docker container name"
        enum status "creating|running|stopped|error"
        int port "Exposed port"
        json metadata "Resource-specific data"
        datetime created_at
    }

    TENANT_EVENT {
        uuid id PK
        uuid tenant_id FK
        enum event_type "created|started|stopped|restarted|failed|deleted"
        string message "Event description"
        json details "Additional context"
        datetime created_at
    }

    TENANT_METRIC {
        uuid id PK
        uuid tenant_id FK
        enum metric_type "cpu|memory|disk|orders|revenue|customers"
        decimal value
        string unit "percent|bytes|count|currency"
        datetime recorded_at
    }

    PLATFORM_CONFIG {
        string key PK
        json value
        datetime updated_at
    }

    TENANT ||--o{ TENANT_RESOURCE : "has"
    TENANT ||--o{ TENANT_EVENT : "logs"
    TENANT ||--o{ TENANT_METRIC : "tracks"
```

---

## Network Isolation

```mermaid
flowchart TB
    subgraph External["External Network (Bridge)"]
        Traefik["Traefik<br/>:80, :443"]
    end

    subgraph PlatformNet["platform_network"]
        Admin["Admin App<br/>:3000"]
        API["Provisioning API<br/>:3001"]
        PlatformDB[("Platform DB<br/>:5432")]
    end

    subgraph TenantANet["tenant_alpha_network"]
        MedusaA["Medusa A<br/>:9000, :5173"]
        PostgresA[("PostgreSQL A<br/>:5432")]
        RedisA["Redis A<br/>:6379"]
    end

    subgraph TenantBNet["tenant_beta_network"]
        MedusaB["Medusa B<br/>:9000, :5173"]
        PostgresB[("PostgreSQL B<br/>:5432")]
        RedisB["Redis B<br/>:6379"]
    end

    Traefik ---|"platform_network"| Admin
    Traefik ---|"platform_network"| API
    API ---|"platform_network"| PlatformDB

    Traefik ---|"tenant_alpha_network"| MedusaA
    MedusaA --- PostgresA
    MedusaA --- RedisA

    Traefik ---|"tenant_beta_network"| MedusaB
    MedusaB --- PostgresB
    MedusaB --- RedisB

    TenantANet x--x TenantBNet
```

> **Note:** Tenant networks are isolated from each other. Only Traefik has access to route traffic into each tenant network.

---

## Metrics Collection Architecture

```mermaid
flowchart LR
    subgraph Tenants["Tenant Instances"]
        T1["Tenant 1<br/>Medusa"]
        T2["Tenant 2<br/>Medusa"]
        T3["Tenant N<br/>Medusa"]
    end

    subgraph Collection["Collection Layer"]
        Cron["Metrics Collector<br/>Cron: */5 * * * *"]
        Docker["Docker Stats API"]
    end

    subgraph Storage["Storage"]
        PlatformDB[("Platform DB<br/>tenant_metrics")]
    end

    subgraph Presentation["Presentation"]
        API["Provisioning API<br/>GET /analytics"]
        Dashboard["Analytics Dashboard"]
    end

    T1 -->|"GET /admin/metrics"| Cron
    T2 -->|"GET /admin/metrics"| Cron
    T3 -->|"GET /admin/metrics"| Cron
    Docker -->|"Container stats"| Cron

    Cron -->|"INSERT metrics"| PlatformDB

    PlatformDB --> API
    API --> Dashboard
```

### Collected Metrics

| Source | Metric | Frequency |
|--------|--------|-----------|
| Docker Stats | CPU % | 5 min |
| Docker Stats | Memory MB | 5 min |
| Docker Stats | Network I/O | 5 min |
| Medusa API | Order count | 5 min |
| Medusa API | Revenue | 5 min |
| Medusa API | Customer count | 5 min |
| Medusa API | Product count | 5 min |

---

## Deployment Architecture (OVH VPS)

```mermaid
flowchart TB
    subgraph OVH["OVH VPS"]
        subgraph Host["Host OS (Ubuntu 22.04)"]
            DockerD["Docker Daemon"]
            Volumes[("Docker Volumes<br/>/var/lib/docker/volumes")]
            Backup["Backup Agent"]
        end

        subgraph Containers["Docker Containers"]
            subgraph Platform["Platform Stack"]
                Traefik["Traefik"]
                Admin["Admin App"]
                API["Provisioning API"]
                PlatformPG[("Platform PostgreSQL")]
            end

            subgraph DynamicTenants["Dynamic Tenant Stacks"]
                direction LR
                TA["Tenant A Stack"]
                TB["Tenant B Stack"]
                TN["Tenant N Stack"]
            end
        end
    end

    subgraph External["External Services"]
        DNS["DNS Provider"]
        S3["S3 Backup Storage"]
        Monitoring["Uptime Monitoring"]
    end

    DNS -->|"*.platform.com"| Traefik
    Backup -->|"Daily backups"| S3
    Monitoring -->|"Health checks"| Traefik
```

---

## Request Routing (Traefik)

```mermaid
flowchart LR
    subgraph Requests["Incoming Requests"]
        R1["admin.platform.com"]
        R2["api.platform.com"]
        R3["tenant-a.platform.com"]
        R4["tenant-a.platform.com/app"]
        R5["tenant-b.platform.com"]
    end

    subgraph Traefik["Traefik Router"]
        Router["Dynamic Router<br/>(File Provider)"]
    end

    subgraph Services["Backend Services"]
        Admin["Admin App<br/>:3000"]
        API["Provisioning API<br/>:3001"]
        MedusaA_API["Medusa A API<br/>:9000"]
        MedusaA_Admin["Medusa A Admin<br/>:5173"]
        MedusaB_API["Medusa B API<br/>:9000"]
    end

    R1 --> Router
    R2 --> Router
    R3 --> Router
    R4 --> Router
    R5 --> Router

    Router -->|"Host: admin.*"| Admin
    Router -->|"Host: api.*"| API
    Router -->|"Host: tenant-a.* && !PathPrefix:/app"| MedusaA_API
    Router -->|"Host: tenant-a.* && PathPrefix:/app"| MedusaA_Admin
    Router -->|"Host: tenant-b.*"| MedusaB_API
```

---

## Component Communication

```mermaid
flowchart TB
    subgraph Frontend["Frontend Layer"]
        AdminUI["Super Admin Dashboard<br/>(Next.js)"]
        TenantAdmin["Tenant Admin UI<br/>(Medusa Admin)"]
        Storefront["Tenant Storefront<br/>(Custom)"]
    end

    subgraph Backend["Backend Layer"]
        ProvAPI["Provisioning API<br/>(Hono)"]
        MedusaAPI["Medusa Store API"]
        MedusaAdminAPI["Medusa Admin API"]
    end

    subgraph Data["Data Layer"]
        PlatformDB[("Platform DB")]
        TenantDB[("Tenant DB")]
        Redis["Redis Cache"]
    end

    subgraph Infra["Infrastructure"]
        Docker["Docker Engine"]
        Traefik["Traefik"]
    end

    AdminUI -->|"REST"| ProvAPI
    ProvAPI -->|"SQL"| PlatformDB
    ProvAPI -->|"Docker API"| Docker

    TenantAdmin -->|"REST"| MedusaAdminAPI
    Storefront -->|"REST"| MedusaAPI

    MedusaAPI --> TenantDB
    MedusaAPI --> Redis
    MedusaAdminAPI --> TenantDB
```

---

*These diagrams can be rendered using any Mermaid-compatible viewer (GitHub, VS Code with Mermaid extension, etc.)*
