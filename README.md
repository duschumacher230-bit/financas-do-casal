# Finanças do Casal

App web para o casal controlar renda, despesas pessoais e do casal, a divisão proporcional à renda e o cofrinho da viagem.

**Abrir o app:** https://duschumacher230-bit.github.io/financas-do-casal/

## Como funciona
- Login por e-mail e senha (Firebase Authentication). O cadastro aberto está desligado: só entra quem for adicionado no console do Firebase (Authentication → Usuários → Adicionar usuário).
- Primeiro acesso: a pessoa usa **Esqueci minha senha** na tela de login para criar a própria senha.
- Dados no Cloud Firestore (São Paulo), protegidos por `firestore.rules`:
  - `usuarios/{uid}/lancamentos` — lançamentos "Só meu": só o próprio dono lê e escreve.
  - `resumos/{uid}` — totais do mês de cada um (o que o outro enxerga).
  - `conjunto`, `cofrinho` — os dois leem; cada um altera só o que lançou.
  - `membros`, `config`, `acertos` — nome/cor, divisão do casal, meta da viagem e acerto do mês.

## Desenvolvimento
- Código-fonte em `src/`. `npm run build` gera `index.html` e `app.js` na raiz (publicados pelo GitHub Pages).
- `npm test` roda os testes dos cálculos (divisão, acerto, cofrinho, parcelas).
