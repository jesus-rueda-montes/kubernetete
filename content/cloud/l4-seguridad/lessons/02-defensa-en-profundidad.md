---
title: Defensa en profundidad
minutes: 13
---

## Qué problema resuelve

Ninguna medida de seguridad es perfecta. Un permiso mal dado, una regla de firewall demasiado abierta o una clave filtrada pueden pasar. Si **toda** la seguridad depende de una sola barrera, un único fallo lo expone todo.

**Defensa en profundidad** significa poner **varias capas independientes**: si una falla, la siguiente sigue protegiendo. En Google Cloud esas capas son:

- **Identidad** (IAM y cuentas de servicio).
- **Políticas de organización**: prohibiciones que se aplican a todos los proyectos.
- **Red**: firewall, VPC privadas y **VPC Service Controls**.
- **Borde**: **Cloud Armor** e **IAP** delante de las aplicaciones.
- **Detección**: **Security Command Center** y los audit logs.

## Analogía

Un castillo no confía solo en la muralla: tiene **foso**, **muralla**, **puerta con guardia** que pide identificación, **torre de vigilancia** y **cámara acorazada** para el tesoro. Un atacante que cruza el foso aún tiene que pasar todo lo demás, y la torre lo ve venir.

## Concepto

### Políticas de organización (*Organization Policy*)

IAM dice **quién** puede hacer algo. Las políticas de organización dicen **qué no se puede hacer, lo haga quien lo haga**, aunque tenga rol de propietario.

- Se definen con **restricciones** (*constraints*) sobre la organización, una carpeta o un proyecto, y **se heredan hacia abajo** en la jerarquía.
- Ejemplos habituales:
  - `gcp.resourceLocations`: solo se pueden crear recursos en ciertas regiones (por ejemplo, solo en la UE).
  - `compute.vmExternalIpAccess`: qué VMs pueden tener IP externa (normalmente, ninguna).
  - `iam.disableServiceAccountKeyCreation`: prohíbe crear claves JSON de cuentas de servicio.
  - `storage.publicAccessPrevention`: impide que los buckets sean públicos.
  - `iam.allowedPolicyMemberDomains`: solo se pueden dar permisos a identidades de tu dominio.

Son **guardarraíles**: evitan errores y malas prácticas antes de que ocurran.

### VPC Service Controls

IAM protege frente a **quién** accede, pero no frente a **desde dónde**. Si alguien roba las credenciales de una cuenta de servicio con acceso a un bucket, podría copiar los datos a **su propio proyecto** desde su casa.

**VPC Service Controls** crea un **perímetro de servicio** alrededor de proyectos y APIs de Google (Cloud Storage, BigQuery…):

- Las peticiones desde **fuera del perímetro** se rechazan, aunque las credenciales sean válidas.
- Impide copiar datos **a proyectos fuera del perímetro**: protege contra la **exfiltración de datos**.
- Se permiten excepciones con **niveles de acceso** (por IP, identidad…) y **reglas de entrada y salida**.
- Tiene un **modo dry run** para ver qué se bloquearía antes de aplicarlo.

### Cloud Armor

**WAF** (*Web Application Firewall*) y protección **anti-DDoS** que se aplica en el borde de Google, delante del **balanceador de carga** de aplicaciones externo.

- **Políticas de seguridad** con reglas ordenadas por prioridad: permitir o denegar por IP, país, cabeceras…
- **Reglas WAF preconfiguradas** basadas en el **OWASP Core Rule Set**: `sqli-v422-stable` (inyección SQL), `xss-v422-stable` (cross-site scripting), etc., usadas con `evaluatePreconfiguredWaf()`.
- **Limitación de tasa** (*rate limiting*) por cliente.
- **Adaptive Protection**: detecta con aprendizaje automático ataques DDoS de capa 7 y propone reglas.

### Identity-Aware Proxy (IAP)

La idea de **zero trust** (*BeyondCorp* en Google): no se confía en alguien por estar «dentro de la red»; **cada petición** se autentica y autoriza por **identidad** y contexto.

- **IAP para aplicaciones web**: se pone delante de una aplicación (en un balanceador, Cloud Run, App Engine) y **solo deja pasar a usuarios autenticados con el rol** `roles/iap.httpsResourceAccessor`. Sustituye a una VPN para herramientas internas.
- **IAP TCP forwarding**: SSH o RDP a VMs **sin IP externa**. El firewall solo tiene que permitir la entrada desde el rango de IAP **`35.235.240.0/20`**, y el usuario necesita `roles/iap.tunnelResourceAccessor`.

### Security Command Center

El **panel central de seguridad** de la organización:

- **Inventario** de recursos.
- **Hallazgos** (*findings*): buckets públicos, puertos abiertos a Internet, claves de cuentas de servicio antiguas, vulnerabilidades en imágenes, actividad sospechosa…
- Niveles de servicio con más o menos detectores (Standard, Premium).

## Ejemplo

```bash
# Firewall: SSH solo desde el rango de IAP, solo a las VMs con la etiqueta ssh
gcloud compute firewall-rules create permitir-ssh-iap \
  --network=tienda-vpc --direction=INGRESS --action=ALLOW --rules=tcp:22 \
  --source-ranges=35.235.240.0/20 --target-tags=ssh

# Entrar por SSH a una VM sin IP externa, a través de IAP
gcloud compute ssh web-1 --zone=europe-west1-b --tunnel-through-iap
```

Y en una política de Cloud Armor, una regla que bloquea inyección SQL:

```text
Expresión:  evaluatePreconfiguredWaf('sqli-v422-stable')
Acción:     deny-403
Prioridad:  1000
```

## Errores comunes

- **Confiar solo en IAM**: unas credenciales robadas bastan. Añade VPC Service Controls a los datos sensibles.
- **Abrir SSH (22) a `0.0.0.0/0`**: se ataca a los pocos minutos. Usa IAP TCP forwarding y VMs sin IP externa.
- **Pensar que una política de organización se puede saltar con el rol de propietario**: no se puede; ese es su propósito.
- **Aplicar un perímetro de VPC Service Controls directamente**: puede romper integraciones. Empieza en **dry run**.
- **Poner Cloud Armor y olvidar que solo protege lo que pasa por el balanceador**: si el backend también es accesible directamente, el atacante lo esquiva.

## En la entrevista

**«¿Cómo evitarías que los datos de BigQuery se copien fuera de la empresa aunque roben unas credenciales?»**
Con un perímetro de VPC Service Controls alrededor de los proyectos con datos: las peticiones desde fuera del perímetro se rechazan y no se pueden copiar datos a proyectos externos. Además, IAM de mínimo privilegio, sin claves JSON (política de organización) y audit logs.

**«¿Cómo das acceso a una herramienta interna sin VPN?»**
Con Identity-Aware Proxy: cada petición se autentica con la cuenta de Google del usuario y solo pasan quienes tienen el rol de IAP sobre esa aplicación. Es el modelo zero trust. Para SSH, IAP TCP forwarding a VMs sin IP externa.

## Resumen

- **Defensa en profundidad**: varias capas independientes; si una falla, quedan las demás.
- **Políticas de organización**: prohibiciones heredadas que ni el propietario puede saltarse (regiones, IP externas, claves de cuenta de servicio, buckets públicos).
- **VPC Service Controls**: perímetro contra la **exfiltración** aunque las credenciales sean válidas; empieza en dry run.
- **Cloud Armor**: WAF (OWASP CRS) y anti-DDoS delante del balanceador. **IAP**: zero trust para web y SSH (`35.235.240.0/20`).
- **Security Command Center**: inventario y hallazgos de seguridad de toda la organización.
