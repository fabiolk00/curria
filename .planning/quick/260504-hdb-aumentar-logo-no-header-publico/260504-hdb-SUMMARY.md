# Summary

## Resultado

A logo do header/navbar público foi aumentada. A navbar agora tem mais altura e o componente `Logo` recebe tamanho maior apenas nesse contexto público.

## Arquivo alterado

- `src/components/landing/header.tsx`

## Validação

- `npm run typecheck`: passou
- `npm run lint`: passou
- `npm run build`: passou após repetir um erro transitório de cache do Next.
- `http://localhost:3002/`: 200, usando `trampofy-logo.svg`.
