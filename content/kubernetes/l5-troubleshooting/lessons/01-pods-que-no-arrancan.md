---
title: Método y Pods que no arrancan
minutes: 14
---

## Qué problema resuelve

«La aplicación no funciona» es el mensaje más habitual y el menos útil. En Kubernetes hay muchas piezas (Deployment, ReplicaSet, Pod, contenedor, imagen, nodo, Service…) y el fallo puede estar en cualquiera.

Sin un **método**, se prueba al azar: reiniciar, borrar Pods, cambiar cosas… y se pierde tiempo y pistas. En las entrevistas (y en el examen CKA) el troubleshooting es de lo que más se evalúa, y lo que se valora es **el orden** con el que investigas.

## Analogía

Es el **médico de urgencias**: no receta al azar. Primero mira las **constantes** (`kubectl get`), luego **pregunta qué ha pasado** (`kubectl describe` y los eventos), después pide **análisis** (`kubectl logs`) y, si hace falta, **explora por dentro** (`kubectl exec` o `kubectl debug`).

## Concepto

### El método, de fuera hacia dentro

1. **`kubectl get pods`** (con `-o wide` para ver el nodo): ¿en qué **estado** está y cuántos **reinicios** lleva?
2. **`kubectl describe pod NOMBRE`**: la configuración real y, al final, los **Events**. Ahí suele estar la causa.
3. **`kubectl logs NOMBRE`**: lo que escribió la aplicación. Si se reinició, **`--previous`** muestra los logs del contenedor **anterior**, el que falló.
4. **`kubectl exec`** o **`kubectl debug`**: entrar y comprobar desde dentro.
5. Subir un nivel si hace falta: el Deployment, el ReplicaSet (`kubectl describe rs`) o el nodo.

Los eventos se pueden ver también con **`kubectl events --for pod/NOMBRE`** o `kubectl get events --sort-by=.metadata.creationTimestamp`. **Solo se guardan 1 hora** por defecto (`--event-ttl` del API server): mira pronto.

### Los estados típicos y su causa

| Estado | Qué significa | Causas habituales |
|---|---|---|
| **Pending** | El scheduler no encuentra nodo | Requests mayores que lo libre, taints sin toleration, nodeSelector/affinity imposibles, PVC sin enlazar |
| **ImagePullBackOff** / **ErrImagePull** | No puede descargar la imagen | Nombre o tag mal escrito, repositorio privado sin `imagePullSecrets`, sin permisos en el registro |
| **CreateContainerConfigError** | Falta algo para crear el contenedor | ConfigMap o Secret referenciado que no existe (o una clave que no existe) |
| **CrashLoopBackOff** | El contenedor arranca y termina una y otra vez | Error de la aplicación, configuración incorrecta, comando equivocado, liveness probe que lo mata |
| **OOMKilled** (en `Last State`) | Superó su **limit** de memoria | Limit demasiado bajo o fuga de memoria; código de salida **137** |
| **Running** pero **0/1 READY** | Arrancó pero la readiness probe falla | Probe mal configurada, dependencia caída; no recibe tráfico |

### CrashLoopBackOff en detalle

- No es un error en sí: es Kubernetes **esperando** antes de reintentar. La espera crece (10 s, 20 s, 40 s…) hasta un **máximo de 5 minutos**, y se reinicia tras 10 minutos funcionando bien.
- La causa está en **`kubectl logs --previous`** y en el **código de salida** (`describe`, sección `Last State`):
  - **1**: error de la aplicación.
  - **137**: lo mataron con SIGKILL (a menudo **OOMKilled**, o la liveness probe).
  - **127**: comando no encontrado (el `command` apunta a algo que no existe en la imagen).

## Ejemplo

```text
$ kubectl get pods
NAME                   READY   STATUS             RESTARTS      AGE
api-7d9c5b6f4-x2kqp    0/1     CrashLoopBackOff   5 (48s ago)   4m

$ kubectl describe pod api-7d9c5b6f4-x2kqp
...
    Last State:     Terminated
      Reason:       Error
      Exit Code:    1
...
Events:
  Type     Reason   Age                 From     Message
  ----     ------   ----                ----     -------
  Warning  BackOff  12s (x20 over 4m)   kubelet  Back-off restarting failed container api

$ kubectl logs api-7d9c5b6f4-x2kqp --previous
Error: variable DATABASE_URL no definida
```

Conclusión: a la aplicación le falta una variable de entorno. Se corrige el Deployment (no el Pod) y se aplica de nuevo.

## Errores comunes

- **Borrar el Pod como primera medida**: el nuevo tendrá el mismo problema, y pierdes los logs y eventos del antiguo.
- **Mirar `kubectl logs` sin `--previous`** en un CrashLoopBackOff: ves el contenedor que acaba de arrancar, no el que falló.
- **Editar el Pod en vez del Deployment**: el ReplicaSet lo recreará con la configuración antigua.
- **Buscar en los logs un problema de Pending**: el contenedor ni ha arrancado; la causa está en los eventos del scheduler.
- **Esperar demasiado**: los eventos desaparecen tras 1 hora por defecto.

## En la entrevista

**«Un Pod está en CrashLoopBackOff. ¿Qué haces?»**
`kubectl describe pod` para ver los eventos, el `Last State` y el código de salida; `kubectl logs --previous` para ver por qué falló el contenedor anterior. Si es 137, compruebo OOMKilled y los limits, o una liveness probe demasiado agresiva. Si es 1, un error de la aplicación: configuración, variables o dependencias. Corrijo en el Deployment.

**«Un Pod se queda en Pending. ¿Por qué puede ser?»**
El scheduler no encuentra un nodo válido. En los eventos (`FailedScheduling`) dice por qué: recursos insuficientes para las requests, taints sin toleration, affinity o nodeSelector imposibles, o un PVC sin enlazar.

## Resumen

- Método: **get → describe (eventos) → logs (`--previous`) → exec/debug → subir un nivel**.
- **Pending** = scheduling; **ImagePullBackOff** = imagen; **CreateContainerConfigError** = falta ConfigMap/Secret.
- **CrashLoopBackOff**: reintento con espera de hasta 5 min; causa en `logs --previous` y el código de salida.
- **137** = SIGKILL (OOMKilled o liveness); **1** = error de la app; **127** = comando no encontrado.
- Los eventos duran **1 hora** por defecto; corrige en el **Deployment**, no en el Pod.
