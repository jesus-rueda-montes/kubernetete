---
title: Diferencias de modelo
minutes: 13
---

## Qué problema resuelve

Traducir nombres no basta. Las tres nubes **organizan los recursos**, **dan permisos** y **montan las redes** de forma distinta. Si diseñas en AWS pensando como en GCP, cometerás errores: permisos donde no toca, redes que no se ven entre sí o entornos mal aislados.

Estas diferencias son justo lo que se pregunta cuando dices en una entrevista que conoces «las tres nubes».

## Analogía

Tres empresas con el mismo tipo de oficinas, pero con **organigramas distintos**: en una, los departamentos son proyectos dentro de carpetas; en otra, cada departamento es una **empresa filial** con su propia contabilidad (las cuentas de AWS); en la tercera, hay **suscripciones** con **archivadores** (grupos de recursos) dentro.

## Concepto

### Organización y aislamiento

| | GCP | AWS | Azure |
|---|---|---|---|
| Raíz | Organización | Organización (AWS Organizations) | Tenant de Microsoft Entra ID |
| Agrupación | Carpetas | Unidades organizativas (OU) | Management groups |
| **Límite de aislamiento y facturación** | **Proyecto** | **Cuenta** | **Suscripción** |
| Contenedor de recursos | (el proyecto) | (la cuenta; se agrupan con etiquetas) | **Grupo de recursos** |

- En AWS, **cada entorno suele ser una cuenta** distinta (dev, staging, prod), igual que en GCP se usa un proyecto por entorno.
- En Azure, todo recurso vive en un **grupo de recursos** dentro de una suscripción. Borrar el grupo **borra todo lo que contiene**, y los permisos y las etiquetas se pueden dar a nivel de grupo.

### Identidad y permisos

- **GCP**: una **allow policy** en un recurso (organización, carpeta, proyecto o recurso) une **principales** con **roles**. Se hereda hacia abajo.
- **AWS**: **políticas JSON** con `Effect`, `Action`, `Resource` (y `Condition`):
  - **Basadas en identidad** (se adjuntan a usuarios, grupos o roles) o **basadas en recurso** (por ejemplo, la *bucket policy* de S3).
  - Todo está **denegado por defecto**, y un **`Deny` explícito gana siempre** a cualquier `Allow`.
  - Las **SCP** limitan el **máximo** permitido en las cuentas, pero **no conceden** permisos.
- **Azure**: las identidades viven en **Microsoft Entra ID**; los permisos sobre recursos se dan con **Azure RBAC**: una *role assignment* = principal + rol + **ámbito** (management group, suscripción, grupo de recursos o recurso).

### Identidades de las aplicaciones

| | GCP | AWS | Azure |
|---|---|---|---|
| Identidad de una carga de trabajo | Cuenta de servicio | **Rol de IAM** asumido (credenciales temporales vía STS) | **Managed identity** |
| En Kubernetes | Workload Identity Federation for GKE | EKS Pod Identity o IRSA | Microsoft Entra Workload ID |

La idea es la misma en las tres: **nada de claves de larga duración**; la plataforma entrega credenciales temporales.

### Red y zonas

- **VPC**: en GCP es **global** con subredes **regionales**. En AWS es **regional** y cada subred está en **una sola zona de disponibilidad**. En Azure la VNet es regional y sus subredes abarcan la región.
- Conectar redes: **VPC Network Peering** en GCP, **VPC peering** o **Transit Gateway** en AWS, **VNet peering** en Azure.
- **Zonas**: en AWS, el nombre de zona (`us-east-1a`) se asigna **por cuenta**: `us-east-1a` puede ser un centro de datos distinto en otra cuenta. Para coordinar entre cuentas se usan los **AZ IDs** (`use1-az1`).

## Ejemplo

Una política de IAM de AWS que permite leer un bucket de S3:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:ListBucket"],
      "Resource": [
        "arn:aws:s3:::tienda-logs",
        "arn:aws:s3:::tienda-logs/*"
      ]
    }
  ]
}
```

- `ListBucket` se aplica al **bucket** (`arn:aws:s3:::tienda-logs`) y `GetObject` a los **objetos** (`.../*`): por eso hay dos ARN.
- El equivalente en GCP sería el rol `roles/storage.objectViewer` sobre el bucket.

Y en Azure, crear el contenedor de recursos antes que nada:

```bash
az group create --name tienda-rg --location westeurope
```

## Errores comunes

- **Poner dev y prod en la misma cuenta de AWS** «porque en GCP son proyectos distintos y aquí no hay proyectos»: el equivalente al proyecto es la cuenta.
- **Pensar que una SCP da permisos**: solo los limita; hace falta además una política de IAM.
- **Olvidar que un `Deny` explícito gana** en AWS y buscar el problema en los `Allow`.
- **Borrar un grupo de recursos de Azure** creyendo que solo borra el «grupo»: borra todos sus recursos.
- **Coordinar zonas entre cuentas de AWS por nombre** en vez de por AZ ID.
- **Usar claves de acceso de larga duración** en vez de roles, managed identities o cuentas de servicio con credenciales temporales.

## En la entrevista

**«¿Cuál es el equivalente de un proyecto de GCP en AWS y en Azure?»**
En AWS, la **cuenta**: es el límite de aislamiento, permisos y facturación, y se agrupan en OUs dentro de AWS Organizations. En Azure, la **suscripción**, organizada en management groups y con los recursos dentro de **grupos de recursos**.

**«¿Cómo se evalúan los permisos en AWS?»**
Todo empieza denegado. Se combinan las políticas basadas en identidad y en recurso; si alguna tiene un `Deny` explícito que aplica, se deniega aunque otra permita. Además, las SCP de la organización y los *permissions boundaries* ponen un techo: la acción tiene que estar permitida en todos los niveles.

## Resumen

- Aislamiento: **proyecto** (GCP) ≈ **cuenta** (AWS) ≈ **suscripción** (Azure); en Azure, además, **grupos de recursos**.
- AWS IAM: **políticas JSON**, denegado por defecto, **`Deny` explícito gana**; las **SCP** limitan, no conceden.
- Azure: identidades en **Entra ID**, permisos con **Azure RBAC** (principal + rol + ámbito).
- Identidad de apps: cuenta de servicio ≈ **rol de IAM** ≈ **managed identity**; siempre credenciales temporales.
- VPC de GCP global; AWS regional con **subredes zonales**; nombres de zona de AWS **por cuenta** (usa AZ IDs).
