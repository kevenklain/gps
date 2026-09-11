# Convenções de desenvolvimento deste projeto

- Preferir código verboso, explícito e didático, conforme solicitado pelo usuário.
- Manter a organização atual: frontend HTML/CSS/JavaScript em `public/app`, rotas
  em `routes`, autorização em middleware, HTTP em controllers, regras de negócio
  compartilhadas em services e persistência por models Eloquent.
- Usar nomes descritivos, etapas intermediárias legíveis e blocos com chaves.
  Explicar constantes, unidades de medida, transações e regras de negócio.
- Comentar como cada funcionalidade se comunica: evento da tela, endpoint HTTP,
  autenticação, controller, service quando houver, models, tabelas e resposta JSON.
- Nos comentários, explicar a responsabilidade e o motivo da operação. Atualizar
  os comentários ao alterar o comportamento correspondente.
- Atualizar `docs/LOGICA.md` quando mudar fluxos de comunicação ou arquitetura.
- Seguir o estilo existente em cada camada. Criar novas camadas quando tiverem
  uma responsabilidade concreta; priorizar a facilidade de acompanhar o fluxo.
