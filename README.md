# Aprova — organização para concursos

Site em português para organizar a preparação para **Analista-Tributário da Receita Federal**. Desenvolvido com React, TypeScript e Vite, com gráficos Recharts e editor Tiptap.

## Executar

Requer Node.js 22.12+ ou 24 e npm. No checkout existente:

```bash
cd /workspace/Concurso
npm ci --cache /workspace/.cache/npm
npm run dev -- --port 5173
```

O servidor de desenvolvimento usa a porta 5173. Para produção:

```bash
npm run build
npm run preview -- --port 4173
```

A pasta `dist/` contém os arquivos para hospedagem estática. O aplicativo não depende de servidor de banco de dados, conta de usuário ou chaves de API. Use uma origem estável e HTTPS quando for hospedá-lo, pois os dados são vinculados ao navegador e à origem do site.

## Funcionalidades

- **Meus concursos:** o cartão “Meu objetivo” abre um dropdown para alternar concursos ou criar um novo. Informe nome, cargo opcional e tipo (fiscal, policial, tribunais e outras áreas). Cada concurso possui seu próprio edital, ciclos, sessões, estatísticas, erros, anotações e anexos.
- **Meu edital:** disciplinas e aulas/tópicos editáveis, coluna de incidência de provas em percentual, busca, filtros e conclusão manual dos tópicos.
- **Ciclo de estudos:** cada ciclo é uma semana de sete dias, começando na segunda-feira e terminando no domingo. Escolha a segunda-feira de início, as disciplinas e os dias e horas de cada uma. Um resumo mostra as metas e o estudo realizado em cada dia. Novos ciclos copiam os horários, mas não as sessões.
- **Estatísticas:** horas por disciplina e ao longo dos dias, gráfico de acertos por aula, totais por disciplina e detalhamento por aula. Filtros por disciplina, ciclo e período, com exportação de relatório CSV.
- **Caderno de erros:** registros agrupados por aula, filtro por disciplina, descrição e resposta correta com editor de texto, formatação, fontes, alinhamento, grifos e imagens coladas com Ctrl+V. Também permite marcar erros como revisados.
- **Anotações:** fonte e tamanho, negrito, itálico, sublinhado, tachado, títulos, alinhamentos, listas, cores, grifos, citações, links, desfazer e refazer. Filtro por disciplina, imagens coladas com Ctrl+V e materiais anexados a cada anotação.
- **Backup:** exportação e restauração de todos os dados e anexos por JSON, com validação e confirmação antes da substituição.

## Criar e alternar concursos

1. Clique no cartão **Meu objetivo**, no menu lateral.
2. Escolha um concurso da lista ou clique em **Criar novo concurso**.
3. Preencha nome, cargo (opcional) e tipo de concurso.
4. Comece com um edital em branco ou marque a opção de copiar as disciplinas e os tópicos do concurso atual. A cópia recebe identificadores próprios e progresso zerado; ciclos, sessões, erros, anotações e anexos não são copiados.
5. Depois de criar, cadastre ou importe o edital do novo concurso.

A seleção e os dados são salvos no navegador. Ao alternar concursos, todas as páginas passam a mostrar somente os registros do concurso selecionado. Nas Configurações, é possível ajustar seu nome, cargo e tipo.

## Edital e planilha de referência

O acesso à planilha fornecida e aos sites oficiais foi bloqueado pela rede do ambiente durante o desenvolvimento. A base do concurso inicial da Receita Federal, com **11 disciplinas e 78 tópicos**, é uma estrutura sugerida para a preparação, **não uma transcrição integral ou validada de um edital oficial**. Nenhuma hora, resultado de estudo ou incidência foi inventada. Confira e ajuste o conteúdo de acordo com o edital do concurso desejado. A confirmação manual dessa revisão fica em Configurações.

Para importar o conteúdo correto, use **Importar edital**, baixe o modelo e preencha um CSV com uma linha por tópico:

```csv
disciplina;topico;incidencia
Direito Tributário;Obrigação tributária;
Direito Tributário;Crédito tributário;
```

As colunas `disciplina` e `topico` (ou `aula`) são obrigatórias; `incidencia` é opcional, de 0 a 100. Não preencha percentuais sem uma análise real de provas. São aceitos separadores ponto e vírgula ou vírgula, campos entre aspas e números brasileiros. A importação mescla aulas por nome, preservando o progresso. A opção de substituir o edital apaga os registros associados e exige confirmação; exporte um backup antes.

Referência fornecida pelo usuário: [Google Planilhas](https://docs.google.com/spreadsheets/d/1u8Zwx05sgHHI8Yi_bBXLXv04ir6uG_KydogSheURf5o/edit?usp=sharing).

## Cálculos

- Horas de cada dia = soma dos horários das disciplinas nesse dia. A carga diária pode variar durante a semana.
- Horas semanais = soma das horas planejadas de segunda-feira a domingo.
- Média diária = horas da semana ÷ quantidade de dias com estudo planejado.
- Estimativa mensal = horas semanais × 52 ÷ 12 (aproximadamente 4,33 semanas).
- Meta semanal da disciplina = soma dos horários escolhidos para ela nos sete dias. Aceita horas com vírgula ou ponto, como `1,5` ou `1.5` para 1h30. Não permite planejamento superior a 24 horas no mesmo dia.
- Aproveitamento por aula, disciplina ou geral = soma de acertos ÷ soma de questões. Não é a média dos percentuais das sessões.
- Sessões de teoria ou revisão sem questões contam para o tempo, mas não alteram o aproveitamento. Sem questões, o site exibe `—`; zero acertos em questões respondidas resulta em `0%`.
- Cada ciclo tem um período fixo de segunda a domingo. As sessões devem pertencer a esse período e não podem ter data futura. Um ciclo que já contém sessões não pode ser movido para outra semana; crie um novo ciclo para preservar os registros.
- Datas de estudo usam o fuso `America/Rio_Branco`. Horas não são alteradas pelo fuso.

## Armazenamento

Os registros e materiais de todos os concursos ficam no **IndexedDB deste navegador**. O botão Backup exporta todos os concursos em um único JSON. Eles persistem após recarregar a página, mas não são sincronizados entre dispositivos. Limpar dados do navegador, trocar de origem/porta ou usar janela privada pode tornar os registros indisponíveis. Exporte backups regularmente e use a restauração para transferir dados entre dispositivos.

Anexos: até 5 MB por arquivo, 30 arquivos por anotação e 100 MB de anexos no total. Backups incluem os arquivos em base64. Imagens inseridas no texto podem ter até 3 MB cada, em PNG, JPEG, GIF ou WebP; cada texto aceita até 12 MB de conteúdo. Imagens coladas ficam incorporadas ao HTML e são incluídas no backup. A restauração aceita JSON de até 250 MB e higieniza o HTML de anotações e erros. Exclusões de disciplina ou tópico também removem os registros associados, mediante confirmação.

## Compatibilidade com registros antigos

O formato 3 permite vários concursos. Registros únicos dos formatos 1 e 2 são migrados para um primeiro concurso, preservando o edital, histórico, materiais e anotações. Novos backups incluem todos os concursos, seus tipos e a seleção atual. Restaurar um backup completo do formato 3 substitui todos os concursos, após confirmação. Um backup antigo dos formatos 1 ou 2 substitui somente o concurso escolhido no momento da importação; os demais concursos são mantidos.

Dados e backups da versão 1 são convertidos automaticamente para a versão 2. Ciclos antigos com sessões em mais de uma semana são separados por semana, mantendo todas as sessões, seus identificadores, horas, questões e acertos. O antigo orçamento por pesos é distribuído em minutos por dia sem perder o total diário. Textos antigos do caderno de erros são convertidos para HTML, preservando o conteúdo e as quebras de linha. Notas e anexos são mantidos. Não limpe o armazenamento ao atualizar o site; publique na mesma origem para continuar acessando seus registros.

## Verificação

```bash
npm test
npm run build
```

Os 21 testes cobrem a ponderação dos acertos, horários individuais, períodos de segunda a domingo, limites de planejamento, migração sem perda de registros, separação entre concursos, cópia de edital sem histórico, atualizações pendentes após alternância, exclusões relacionadas, integridade dos backups e importação CSV. O fluxo também foi verificado em Chromium: cadastro, sessões, gráficos, erros, formatação, anexos, recarga, exportação/restauração e navegação em tela de 390 px.

Para futuras tarefas no ambiente da nuvem, use este checkout existente. Cada tarefa já é isolada; não crie um Git worktree sem solicitação explícita. Dependências e arquivos podem ser mantidos no snapshot, mas o processo Vite precisa ser iniciado novamente.
