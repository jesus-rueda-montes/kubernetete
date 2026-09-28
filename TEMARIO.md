# Temario de Kubernetete

Plan completo del contenido: qué módulos hay en cada itinerario y nivel, y qué cubre cada uno. Sirve de guía para la fase 8. Estado: ✅ escrito · ⬜ pendiente.

- **Orden dentro de un itinerario:** nivel y después `order`. Cada módulo se desbloquea al aprobar el anterior del mismo itinerario.
- **Requisitos cruzados:** módulos de otros itinerarios que hay que aprobar antes; se indican con «requiere».
- **Tamaño orientativo:** de 1 a 3 lecciones, de 4 a 8 ejercicios y de 4 a 8 flashcards por módulo.
- **Referencia de nivel:**
  - Kubernetes: temario de las certificaciones CKAD y CKA.
  - Terraform: Terraform Associate.
  - Ansible: documentación oficial de Ansible.
  - Cloud: Associate Cloud Engineer de Google Cloud.

## Nivel 0 · Fundamentos (opcional)

| Módulo | Contenido |
|---|---|
| ✅ `f0-terminal-linux` | Terminal y sistema de ficheros, rutas, permisos (`chmod`), procesos, variables de entorno y tuberías. |
| ✅ `f0-redes` | IP, CIDR y subredes, puertos, TCP/UDP, DNS, HTTP/HTTPS y TLS; qué es un load balancer. |
| ✅ `f0-yaml` | Sintaxis YAML: mapas, listas, tipos, indentación, strings multilínea y errores típicos. JSON como subconjunto. |
| ✅ `f0-contenedores` | Contenedor frente a máquina virtual, imagen y contenedor, registros, Dockerfile y `docker run/ps/logs/build`. |

## Kubernetes

| Nivel | Módulo | Contenido |
|---|---|---|
| 1 | ✅ `l1-arquitectura` | Para qué sirve un orquestador; control plane (API server, etcd, scheduler, controller manager) y nodes (kubelet, kube-proxy, container runtime); el modelo declarativo y los bucles de reconciliación. |
| 1 | ✅ `l1-pods` | Pods: red compartida, ciclo de vida, manifest, `kubectl run/get/describe/logs/delete`. |
| 1 | ✅ `l1-namespaces-labels` | Namespaces, labels y selectors, annotations; `kubectl -n`, `-l`, `--show-labels`. |
| 2 | ✅ `l2-deployments` | ReplicaSet y Deployment, rolling update, rollback (`kubectl rollout`), escalar. |
| 2 | ✅ `l2-services` | Service ClusterIP, NodePort y LoadBalancer; selectors y endpoints; DNS del clúster; `kubectl expose` y `port-forward`. |
| 2 | ✅ `l2-configmaps-secrets` | ConfigMap y Secret, como variables de entorno y como volúmenes; base64 no es cifrado. |
| 2 | ✅ `l2-probes-recursos` | Liveness, readiness y startup probes; requests y limits; clases QoS; OOMKilled. |
| 3 | ✅ `l3-ingress` | Ingress e Ingress controller, reglas por host y por ruta, TLS; mención a Gateway API. |
| 3 | ✅ `l3-almacenamiento` | Volumes, PersistentVolume, PersistentVolumeClaim, StorageClass y provisión dinámica; access modes. |
| 3 | ✅ `l3-workloads` | StatefulSet, DaemonSet, Job y CronJob: cuándo usar cada uno. |
| 3 | ✅ `l3-scheduling` | nodeSelector, node affinity, pod (anti-)affinity, taints y tolerations. |
| 4 | ✅ `l4-rbac` | ServiceAccount, Role, ClusterRole, RoleBinding; `kubectl auth can-i`. |
| 4 | ✅ `l4-networkpolicies` | NetworkPolicy: deny por defecto, ingress y egress, selectors; requiere un CNI que las soporte. |
| 4 | ✅ `l4-autoscaling` | HPA, metrics-server; nociones de VPA y Cluster Autoscaler. |
| 4 | ✅ `l4-helm-kustomize` | Helm (chart, release, values, `helm install/upgrade/rollback`) y Kustomize. |
| 4 | ✅ `l4-crds-operators` | CustomResourceDefinition, controladores y el patrón operator. |
| 5 | ✅ `l5-troubleshooting` | Método de depuración: CrashLoopBackOff, ImagePullBackOff, Pending, Services sin endpoints, eventos y logs. |
| 5 | ✅ `l5-entrevista` | Preguntas de entrevista de todo el itinerario y escenarios de diseño. |

## Terraform

| Nivel | Módulo | Contenido |
|---|---|---|
| 1 | ✅ `l1-primer-recurso` | IaC, HCL, providers, resources, `init/plan/apply/destroy`. |
| 1 | ✅ `l1-variables-outputs` | Variables de entrada (tipos, default, validation, `.tfvars`), outputs, locals y referencias entre recursos. |
| 2 | ✅ `l2-state` | El state a fondo: qué guarda, drift, `terraform state list/show/mv/rm`, datos sensibles. |
| 2 | ✅ `l2-expresiones` | `count`, `for_each`, expresiones `for`, condicionales, funciones y data sources. |
| 3 | ✅ `l3-modulos` | Módulos: estructura, inputs y outputs, fuentes (local, Registry, git) y versionado. |
| 3 | ✅ `l3-backends` | Backend remoto en GCS/S3, locking, `terraform init -migrate-state`. |
| 3 | ✅ `l3-entornos` | Workspaces frente a directorios por entorno; estructura de un repo real. |
| 4 | ✅ `l4-ciclo-vida` | `lifecycle` (`prevent_destroy`, `create_before_destroy`, `ignore_changes`), `import`, `moved`, `-replace`. |
| 4 | ✅ `l4-ci-buenas-practicas` | `fmt`, `validate`, plan en las PR, versiones fijadas, `.terraform.lock.hcl`, secretos. |
| 5 | ✅ `l5-entrevista` | Preguntas de entrevista de todo el itinerario y escenarios. |

## Cloud (GCP principal + AWS/Azure)

| Nivel | Módulo | Contenido |
|---|---|---|
| 1 | ✅ `l1-que-es-cloud` | IaaS, PaaS y SaaS; modelo de responsabilidad compartida; CapEx frente a OpEx; elasticidad. |
| 1 | ✅ `l1-regiones-zonas` | Regiones y zonas, alta disponibilidad, latencia, recursos zonales, regionales y globales. |
| 2 | ✅ `l2-gcp-organizacion` | Organización, carpetas, proyectos y facturación en GCP; `gcloud` y la configuración. |
| 2 | ✅ `l2-iam` | IAM: principals, roles (básicos, predefinidos, personalizados), policies, service accounts y mínimo privilegio. |
| 2 | ✅ `l2-computo` | Compute Engine: tipos de máquina, discos, imágenes, VMs spot, grupos de instancias. |
| 2 | ✅ `l2-almacenamiento` | Cloud Storage: buckets, objetos y clases de almacenamiento; Persistent Disk y Filestore. |
| 3 | ✅ `l3-redes-vpc` | VPC, subredes, reglas de firewall, rutas, Cloud NAT, load balancers y Cloud DNS. |
| 3 | ✅ `l3-bases-de-datos` | Cloud SQL, Firestore, Spanner y BigQuery: cuándo elegir cada uno. |
| 3 | ✅ `l3-serverless` | Cloud Run y Cloud Run functions; cuándo serverless y cuándo Kubernetes. |
| 3 | ✅ `l3-gke` | GKE Standard frente a Autopilot, node pools, Workload Identity. Requiere `kubernetes/l2-services`. |
| 4 | ✅ `l4-observabilidad` | Cloud Logging y Cloud Monitoring, métricas, alertas, SLI/SLO. |
| 4 | ✅ `l4-cicd` | Cloud Build y Artifact Registry; pipelines de despliegue. |
| 4 | ✅ `l4-seguridad` | Secret Manager, Cloud KMS, defensa en profundidad. |
| 4 | ✅ `l4-costes` | Modelos de precio, descuentos, presupuestos y alertas, etiquetas para costes. |
| 5 | ✅ `l5-aws-azure` | Equivalencias de servicios entre GCP, AWS y Azure, y diferencias de modelo (cuentas, suscripciones, proyectos). |
| 5 | ✅ `l5-entrevista` | Diseño de arquitecturas y preguntas de entrevista. |

## Ansible

| Nivel | Módulo | Contenido |
|---|---|---|
| 1 | ✅ `l1-inventarios-adhoc` | Qué es Ansible (sin agente, SSH), inventario INI/YAML, grupos, comandos ad-hoc. |
| 1 | ✅ `l1-playbooks` | Playbooks, plays y tasks; `ansible-playbook`; `--check` y `--diff`. |
| 2 | ✅ `l2-modulos-idempotencia` | Módulos habituales (`apt`, `dnf`, `copy`, `template`, `service`, `file`, `user`) e idempotencia. |
| 2 | ✅ `l2-variables-jinja` | Variables y su precedencia, `group_vars`/`host_vars`, facts, plantillas Jinja2. |
| 3 | ✅ `l3-control-flujo` | Handlers, `when`, `loop`, `register`, tags. |
| 3 | ✅ `l3-roles` | Roles (estructura), Ansible Galaxy y collections. |
| 4 | ✅ `l4-vault-buenas-practicas` | Ansible Vault, `become`, `ansible-lint`, estructura de un proyecto real. |
| 5 | ✅ `l5-entrevista` | Preguntas de entrevista y comparación con Terraform. |

## Orden de producción
Primero los niveles 1 de todos los itinerarios, para que cada uno tenga un camino de entrada. Después se sube de nivel dentro de cada itinerario.
