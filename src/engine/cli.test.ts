import { describe, expect, test } from 'vitest'
import { loadRawContent } from '../content/rawContent'
import { CliSpecSchema, type CommandExercise } from '../content/schema'
import { applyCompletion, commonPrefix, complete, parseCommand, sameCommand, tokenize } from './cli'
import { gradeCommand } from './grade'

const kubectl = CliSpecSchema.parse(loadRawContent().cliSpecs['/content/cli-specs/kubectl.json'])

const parse = (line: string) => {
  const r = parseCommand(kubectl, line)
  if (!r.ok) throw new Error(r.errors.join('; '))
  return r.command
}
const errorsOf = (line: string) => {
  const r = parseCommand(kubectl, line)
  return r.ok ? [] : r.errors
}
const same = (a: string, b: string) => sameCommand(parse(a), parse(b))

describe('tokenize', () => {
  test('respeta comillas y posiciones', () => {
    expect(tokenize('kubectl  run x --labels="app=web, tier=fe"').map((t) => t.value)).toEqual([
      'kubectl',
      'run',
      'x',
      '--labels=app=web, tier=fe',
    ])
    expect(tokenize('a  bc').map((t) => [t.start, t.end])).toEqual([
      [0, 1],
      [3, 5],
    ])
  })
})

describe('parseCommand', () => {
  test('normaliza alias de recursos y formas de flags', () => {
    expect(parse('kubectl get po -n dev -o wide')).toEqual({
      path: ['kubectl', 'get'],
      positionals: ['pods'],
      flags: { namespace: 'dev', output: 'wide' },
      trailing: [],
    })
  })

  test('equivalencias: orden de flags, corto/largo, =, flags agrupados', () => {
    expect(same('kubectl get pods -n dev -o yaml', 'kubectl get pod --output=yaml --namespace dev')).toBe(true)
    expect(same('kubectl -n dev get pods', 'kubectl get pods -n dev')).toBe(true)
    expect(same('kubectl get pods -ojson', 'kubectl get pods -o json')).toBe(true)
    expect(same('kubectl run t --image=busybox -it', 'kubectl run t -i -t --image busybox')).toBe(true)
    expect(same('kubectl scale deploy web --replicas=5', 'kubectl scale deployment web --replicas 5')).toBe(true)
  })

  test('diferencias reales no son equivalentes', () => {
    expect(same('kubectl get pods', 'kubectl get services')).toBe(false)
    expect(same('kubectl get pods -n dev', 'kubectl get pods -n prod')).toBe(false)
    expect(same('kubectl get pods web', 'kubectl get pods')).toBe(false)
  })

  test('lo que va tras -- se conserva aparte', () => {
    const c = parse('kubectl exec web -it -- sh -c "ls -l"')
    expect(c.positionals).toEqual(['web'])
    expect(c.flags).toEqual({ stdin: 'true', tty: 'true' })
    expect(c.trailing).toEqual(['sh', '-c', 'ls -l'])
  })

  test('errores útiles', () => {
    expect(errorsOf('kubectl gte pods')[0]).toBe('comando desconocido para kubectl: "gte"')
    expect(errorsOf('kubectl run web --imagen=nginx')).toEqual(['flag desconocido: --imagen'])
    expect(errorsOf('kubectl get pdos')).toEqual(['tipo desconocido: "pdos"'])
    expect(errorsOf('kubectl run web --restart=Sometimes')[0]).toMatch(/valor no válido para --restart/)
    expect(errorsOf('kubectl get pods -o')).toEqual(['el flag --output necesita un valor'])
    expect(errorsOf('kubectl')).toEqual([expect.stringMatching(/falta el subcomando/)])
    expect(errorsOf('kubeclt get pods')[0]).toMatch(/debe empezar por "kubectl"/)
  })

  test('el mismo flag corto significa cosas distintas según el subcomando', () => {
    // -f en logs es --follow (booleano); en get es --filename (con valor)
    expect(parse('kubectl logs web -f').flags).toEqual({ follow: 'true' })
    expect(parse('kubectl get -f pod.yaml').flags).toEqual({ filename: 'pod.yaml' })
  })
})

describe('complete', () => {
  const values = (line: string) => complete(kubectl, line).candidates.map((c) => c.value)

  test('nombre de la CLI y subcomandos', () => {
    expect(values('kub')).toEqual(['kubectl'])
    expect(values('kubectl sc')).toEqual(['scale'])
    expect(values('kubectl s')).toEqual(['scale', 'set'])
    expect(values('kubectl ')).toContain('describe')
  })

  test('recursos por nombre o alias', () => {
    expect(values('kubectl get po')).toEqual(['pods', 'poddisruptionbudgets']) // como en kubectl: varios empiezan por "po"
    expect(values('kubectl get conf')).toEqual(['configmaps'])
    expect(values('kubectl get deploy')).toEqual(['deployments'])
    expect(values('kubectl scale ')).toEqual(['deployments', 'replicasets', 'statefulsets'])
    expect(values('kubectl get pods ')).toEqual([]) // el nombre es libre
  })

  test('flags del subcomando + globales, sin repetir los ya usados', () => {
    expect(values('kubectl run web --im')).toEqual(['--image'])
    expect(values('kubectl get pods --n')).toEqual(['--namespace'])
    expect(values('kubectl get pods -n dev --n')).toEqual([])
    const shorts = values('kubectl get pods -')
    expect(shorts).toContain('-A')
    expect(shorts).toContain('--all-namespaces')
  })

  test('valores de flags', () => {
    expect(values('kubectl get pods -o ')).toEqual(['json', 'yaml', 'wide', 'name', 'jsonpath', 'custom-columns'])
    expect(values('kubectl get pods -o y')).toEqual(['yaml'])
    expect(values('kubectl run x --restart=N')).toEqual(['--restart=Never'])
  })

  test('applyCompletion: único candidato, prefijo común o nada', () => {
    const tab = (line: string) => applyCompletion(line, complete(kubectl, line))
    expect(tab('kubectl ge')).toEqual({ line: 'kubectl get ', changed: true })
    expect(tab('kubectl get pods --all')).toEqual({ line: 'kubectl get pods --all-namespaces ', changed: true })
    expect(tab('kubectl de')).toEqual({ line: 'kubectl de', changed: false }) // delete / describe: sin prefijo común más largo
    expect(tab('kubectl rollout re')).toEqual({ line: 'kubectl rollout res', changed: true }) // restart / resume
    expect(commonPrefix(['delete', 'describe'])).toBe('de')
  })
})

describe('gradeCommand', () => {
  const ex: CommandExercise = {
    id: 'x',
    type: 'command',
    cli: 'kubectl',
    prompt: 'p',
    hints: ['h'],
    solution: { explanation: 'e' },
    accepted: ['kubectl scale deployment web --replicas=5'],
    patterns: [],
  }

  test('acepta variantes equivalentes', () => {
    expect(gradeCommand(ex, 'kubectl scale deploy web --replicas 5', kubectl).correct).toBe(true)
    expect(gradeCommand(ex, '  kubectl   scale deployments web --replicas=5 ', kubectl).correct).toBe(true)
  })

  test('explica por qué falla', () => {
    expect(gradeCommand(ex, 'kubectl scale deploy web --replicas=3', kubectl)).toEqual({
      correct: false,
      feedback: 'El comando es válido, pero no hace lo que pide el enunciado.',
    })
    expect(gradeCommand(ex, 'kubectl scale deploy web --replica=5', kubectl).feedback).toBe('flag desconocido: --replica')
  })

  test('patrones regex como respaldo', () => {
    const withPattern = { ...ex, patterns: ['kubectl scale deploy(ment)?/web --replicas=5'] }
    expect(gradeCommand(withPattern, 'kubectl scale deploy/web --replicas=5', kubectl).correct).toBe(true)
  })
})

describe('estilo single-dash (terraform)', () => {
  const terraform = CliSpecSchema.parse(loadRawContent().cliSpecs['/content/cli-specs/terraform.json'])
  const tf = (line: string) => parseCommand(terraform, line)

  test('-flag, -flag=valor, -flag valor y --flag son equivalentes', () => {
    const a = tf('terraform apply -auto-approve -var-file=prod.tfvars')
    const b = tf('terraform apply --var-file prod.tfvars -auto-approve')
    expect(a.ok && b.ok && sameCommand(a.command, b.command)).toBe(true)
    expect(a.ok && a.command.flags).toEqual({ 'auto-approve': 'true', 'var-file': 'prod.tfvars' })
  })

  test('los booleanos con =false y los errores usan un guion', () => {
    expect(tf('terraform plan -input=false -out=tfplan').ok).toBe(true)
    expect(tf('terraform plan -autoapprove')).toEqual({ ok: false, errors: ['flag desconocido: -autoapprove'] })
    expect(tf('terraform plan -out')).toEqual({ ok: false, errors: ['el flag -out necesita un valor'] })
  })

  test('autocompleta con un guion', () => {
    expect(applyCompletion('terraform apply -auto', complete(terraform, 'terraform apply -auto')).line).toBe(
      'terraform apply -auto-approve ',
    )
    expect(complete(terraform, 'terraform init -backend=').candidates.map((c) => c.value)).toEqual([
      '-backend=true',
      '-backend=false',
    ])
    expect(complete(terraform, 'terraform state ').candidates.map((c) => c.value)).toContain('list')
  })
})

describe('CLI sin subcomandos (ansible)', () => {
  const ansible = CliSpecSchema.parse(loadRawContent().cliSpecs['/content/cli-specs/ansible.json'])

  test('el primer posicional es el patrón y los flags se normalizan', () => {
    const a = parseCommand(ansible, 'ansible web -m ping -i inventario.ini')
    const b = parseCommand(ansible, 'ansible --inventory=inventario.ini web --module-name ping')
    expect(a.ok && b.ok && sameCommand(a.command, b.command)).toBe(true)
    expect(a.ok && a.command.positionals).toEqual(['web'])
  })

  test('autocompleta flags y valores de módulo', () => {
    expect(complete(ansible, 'ansible all -m pi').candidates.map((c) => c.value)).toEqual(['ping'])
  })
})

describe('forma TIPO/NOMBRE de kubectl', () => {
  test('deploy/web equivale a deployment web', () => {
    expect(same('kubectl rollout undo deploy/web', 'kubectl rollout undo deployment web')).toBe(true)
    expect(same('kubectl scale deployment/web --replicas=2', 'kubectl scale deploy web --replicas=2')).toBe(true)
    expect(errorsOf('kubectl rollout undo cosa/web')).toEqual(['tipo desconocido: "cosa/web"'])
  })
})
