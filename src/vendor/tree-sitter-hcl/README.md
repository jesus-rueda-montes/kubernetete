# tree-sitter-terraform.wasm (vendorizado)

- Origen: paquete npm `@tree-sitter-grammars/tree-sitter-hcl@1.2.0`
  (https://github.com/tree-sitter-grammars/tree-sitter-hcl), archivo `tree-sitter-terraform.wasm`.
- Licencia: Apache-2.0 (ver `LICENSE` en esta carpeta).
- Se copia en lugar de instalar el paquete porque su script `install` intenta compilar
  bindings nativos (node-gyp), que no necesitamos y fallan sin toolchain de C++.
- Se carga con `web-tree-sitter` (dependencia normal en package.json). Si se actualiza
  web-tree-sitter a una versión mayor, comprobar la compatibilidad de ABI con esta gramática
  (los tests de `src/engine/hcl.test.ts` fallarían).
