---
title: Ansible Vault
minutes: 11
---

## Qué problema resuelve

Tus playbooks necesitan contraseñas: la de la base de datos, el token de un servicio, la clave de un certificado. Si las escribes en `group_vars/` en claro y lo subes a git, cualquiera con acceso al repositorio (o a una copia antigua) las tiene.

**Ansible Vault** **cifra** archivos o valores con una contraseña. Puedes versionarlos en git sin peligro, y Ansible los descifra en memoria al ejecutar el playbook.

## Analogía

Vault es una **caja fuerte** dentro de la carpeta del proyecto: la carpeta puede viajar a cualquier sitio (git, el portátil de un compañero), pero sin la combinación nadie lee lo que hay dentro. Ansible tiene la combinación solo mientras trabaja.

## Concepto

### Cifrar archivos completos

```bash
ansible-vault create group_vars/pro/vault.yml     # crea un archivo cifrado y abre el editor
ansible-vault edit group_vars/pro/vault.yml       # edita (descifra, abre, vuelve a cifrar)
ansible-vault view group_vars/pro/vault.yml       # solo mostrar
ansible-vault encrypt secretos.yml                # cifrar un archivo que ya existe
ansible-vault decrypt secretos.yml                # dejarlo en claro (¡cuidado!)
ansible-vault rekey group_vars/pro/vault.yml      # cambiar la contraseña
```

El archivo cifrado empieza por `$ANSIBLE_VAULT;1.1;AES256` y el resto es texto ilegible.

### Cifrar un solo valor

```bash
ansible-vault encrypt_string 'S3cr3t0!' --name db_password
```

Devuelve un bloque para pegar en un archivo de variables normal:

```yaml
db_password: !vault |
  $ANSIBLE_VAULT;1.1;AES256
  6231353063383766...
```

| | Archivo completo | Valor suelto (`encrypt_string`) |
|---|---|---|
| Legibilidad | No se ve qué variables hay | El resto del archivo sigue legible |
| Cambiar la contraseña | Fácil: `rekey` | Más trabajo: hay que volver a cifrar cada valor |

### El patrón `vars` + `vault`

Una convención muy extendida: en cada grupo, un archivo **en claro** que referencia variables con prefijo `vault_`, y otro **cifrado** con sus valores.

```text
group_vars/pro/
├── vars.yml      # db_password: "{{ vault_db_password }}"   (en claro: se ve qué existe)
└── vault.yml     # vault_db_password: S3cr3t0!             (cifrado)
```

Así puedes buscar dónde se usa `db_password` sin descifrar nada.

### Dar la contraseña al ejecutar

```bash
ansible-playbook site.yml --ask-vault-pass                        # la pide por teclado (-J)
ansible-playbook site.yml --vault-password-file ~/.vault_pro      # la lee de un archivo
```

- El archivo de contraseña **nunca** va en el repositorio (añádelo a `.gitignore`).
- Puede ser un **script** que obtenga la contraseña de un gestor de secretos (por ejemplo, Secret Manager). Así el pipeline no guarda la contraseña en disco.
- Con **vault IDs** (`--vault-id dev@prompt --vault-id pro@~/.vault_pro`) puedes usar contraseñas distintas por entorno.

### `no_log`

Aunque el secreto esté cifrado en el repositorio, **se descifra al ejecutar**, y puede aparecer en la salida:

```yaml
- name: Crear el usuario de la base de datos
  community.postgresql.postgresql_user:
    name: app
    password: "{{ db_password }}"
  no_log: true              # la salida de esta tarea no muestra sus datos
```

## Ejemplo

```bash
ansible-vault create group_vars/pro/vault.yml
# en el editor:  vault_db_password: S3cr3t0!

cat group_vars/pro/vault.yml
```

```text
$ANSIBLE_VAULT;1.1;AES256
38663735316166383965613964373938383837623262393466336638373938306165373130353430
3439...
```

```bash
ansible-playbook -i inventario/pro.ini site.yml --vault-password-file ~/.vault_pro
```

## Errores comunes

- **Subir el archivo de contraseña del vault** a git: anula todo el cifrado.
- **`ansible-vault decrypt` para editar** y olvidar volver a cifrar antes del commit. Usa `ansible-vault edit`.
- **Olvidar `no_log`**: el secreto aparece en la salida o en los logs del pipeline.
- **Una sola contraseña para todos los entornos**: quien puede desplegar en dev puede leer los secretos de pro. Usa vault IDs.
- **Cifrar todo el `group_vars`**: nadie sabe qué variables existen. Usa el patrón `vars` + `vault`.

## En la entrevista

**«¿Cómo gestionas secretos en Ansible?»**
Con Ansible Vault: los cifro (archivos `vault.yml` por grupo o valores con `encrypt_string`), los versiono en git y paso la contraseña al ejecutar con `--vault-password-file`, que puede ser un script que la lee de un gestor de secretos. Uso vault IDs para separar entornos y `no_log: true` en las tareas que manejan secretos.

**«¿Diferencia entre cifrar un archivo y cifrar una variable?»**
Cifrar el archivo oculta incluso qué variables existen y es fácil cambiar la contraseña con `rekey`. Cifrar solo el valor deja el archivo legible, pero rotar la contraseña es más costoso.

## Resumen

- **`ansible-vault create/edit/view/encrypt/decrypt/rekey`** para archivos; **`encrypt_string`** para valores.
- Patrón **`vars.yml`** (en claro, `{{ vault_x }}`) + **`vault.yml`** (cifrado).
- Contraseña con **`--ask-vault-pass`** o **`--vault-password-file`** (nunca en git); **vault IDs** por entorno.
- **`no_log: true`** en tareas con secretos.
