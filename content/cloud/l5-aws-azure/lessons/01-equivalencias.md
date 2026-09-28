---
title: Equivalencias de servicios
minutes: 12
---

## Qué problema resuelve

Has aprendido la nube con GCP, pero en las ofertas de empleo y en las entrevistas aparecen **AWS** y **Azure** tanto o más. La buena noticia: los **conceptos son los mismos** (máquinas virtuales, almacenamiento de objetos, Kubernetes gestionado, IAM…). Lo que cambia son los **nombres** y algunos **detalles de modelo**.

Si sabes traducir, puedes decir en una entrevista: «Lo he hecho en GCP con Cloud Run; en AWS lo equivalente sería ECS con Fargate».

## Analogía

Es como conducir en otro país: el coche tiene volante, pedales y marchas en todos. Cambian las **señales** (los nombres) y alguna **norma** (el modelo), pero no tienes que volver a aprender a conducir.

## Concepto

### Cómputo y contenedores

| Qué es | GCP | AWS | Azure |
|---|---|---|---|
| Máquinas virtuales | Compute Engine | EC2 | Virtual Machines |
| Grupos con autoescalado | Managed Instance Groups | Auto Scaling groups | Virtual Machine Scale Sets |
| Kubernetes gestionado | GKE | EKS | AKS |
| Contenedores serverless | Cloud Run | ECS con Fargate | Container Apps |
| Funciones | Cloud Run functions | Lambda | Azure Functions |
| Registro de imágenes | Artifact Registry | ECR | Azure Container Registry |

### Almacenamiento y bases de datos

| Qué es | GCP | AWS | Azure |
|---|---|---|---|
| Objetos | Cloud Storage | S3 | Blob Storage |
| Discos de bloque | Persistent Disk / Hyperdisk | EBS | Managed Disks |
| Archivos (NFS) | Filestore | EFS | Azure Files |
| SQL gestionado | Cloud SQL | RDS | Azure Database for PostgreSQL / MySQL, Azure SQL |
| NoSQL | Firestore / Bigtable | DynamoDB | Cosmos DB |
| Data warehouse | BigQuery | Redshift | Microsoft Fabric / Synapse |

### Red

| Qué es | GCP | AWS | Azure |
|---|---|---|---|
| Red privada | VPC (**global**) | VPC (regional) | VNet (regional) |
| Balanceo de carga | Cloud Load Balancing | Elastic Load Balancing (ALB, NLB) | Load Balancer, Application Gateway, Front Door |
| DNS | Cloud DNS | Route 53 | Azure DNS |
| CDN | Cloud CDN | CloudFront | Front Door |
| WAF | Cloud Armor | AWS WAF | Azure WAF |

### Seguridad, operación y entrega

| Qué es | GCP | AWS | Azure |
|---|---|---|---|
| Identidad y permisos | Cloud IAM | IAM | Microsoft Entra ID + Azure RBAC |
| Secretos | Secret Manager | Secrets Manager | Key Vault |
| Claves de cifrado | Cloud KMS | KMS | Key Vault |
| Guardarraíles de organización | Organization Policy | SCP (Organizations) | Azure Policy |
| Logs y métricas | Cloud Logging / Monitoring | CloudWatch | Azure Monitor |
| Auditoría | Cloud Audit Logs | CloudTrail | Activity Log |
| Mensajería | Pub/Sub | SNS / SQS | Service Bus / Event Hubs |
| Compilación | Cloud Build | CodeBuild | Azure Pipelines |

### En Terraform

Cada nube tiene su provider: **`google`**, **`aws`** y **`azurerm`**. El lenguaje, el state y los módulos funcionan igual; cambian los tipos de recurso (`google_storage_bucket`, `aws_s3_bucket`, `azurerm_storage_account`).

## Ejemplo

La misma tarea en las tres CLIs: «¿quién soy?» y «conéctame al clúster de Kubernetes».

```bash
# GCP
gcloud auth list
gcloud container clusters get-credentials tienda --region=europe-west1

# AWS
aws sts get-caller-identity
aws eks update-kubeconfig --name tienda --region eu-west-1

# Azure
az account show
az aks get-credentials --resource-group tienda-rg --name tienda
```

En los tres casos, el resultado es un contexto nuevo en `~/.kube/config`: a partir de ahí, `kubectl` funciona igual.

## Errores comunes

- **Traducir nombre a nombre sin mirar el modelo**: la VPC de GCP es global; la de AWS y la VNet de Azure son regionales.
- **Pensar que Key Vault es solo para claves**: en Azure guarda secretos, claves y certificados.
- **Comparar Cloud Run con Lambda**: Lambda ejecuta funciones; lo más parecido a Cloud Run (contenedores serverless) es Fargate o Container Apps.
- **Creer que hay que aprenderlo todo de cero**: los conceptos se transfieren; céntrate en las diferencias de modelo.

## En la entrevista

**«Solo has trabajado con GCP. ¿Cómo te adaptarías a AWS?»**
Los conceptos se transfieren: VMs, redes, IAM, Kubernetes gestionado, almacenamiento de objetos. Tengo un mapa mental de equivalencias (EC2, S3, EKS, RDS, IAM) y conozco las diferencias de modelo que más importan: la cuenta como límite de aislamiento, las políticas IAM en JSON y la VPC regional. Terraform funciona igual con otro provider.

**«¿Cuál es el equivalente de GKE en AWS y en Azure?»**
EKS en AWS y AKS en Azure. Los tres gestionan el control plane; cambian la integración de identidad (Workload Identity Federation en GKE, EKS Pod Identity o IRSA en EKS, Microsoft Entra Workload ID en AKS), la red y los modos gestionados de nodos.

## Resumen

- Mismos conceptos, **distintos nombres**: EC2/VMs, S3/Blob, EKS/AKS, RDS/Azure Database, CloudWatch/Azure Monitor.
- Contenedores serverless: Cloud Run ≈ **Fargate** ≈ **Container Apps**; funciones: **Lambda**, **Azure Functions**.
- Secretos: Secret Manager ≈ **Secrets Manager** ≈ **Key Vault**; guardarraíles: Org Policy ≈ **SCP** ≈ **Azure Policy**.
- VPC de GCP **global**; VPC de AWS y VNet de Azure **regionales**.
- Terraform: providers `google`, `aws` y `azurerm`; mismo flujo de trabajo.
