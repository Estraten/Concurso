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

- **Meu edital:** disciplinas e aulas/tópicos editáveis, coluna de incidência de provas em percentual, busca, filtros e conclusão manual dos tópicos.
- **Ciclo de estudos:** múltiplos ciclos, seleção de disciplinas, dias da semana e horas por dia. Pesos distribuem proporcionalmente a meta semanal entre as disciplinas. Cada sessão registra disciplina, aula, data, tipo, duração, questões e acertos.
- **Estatísticas:** horas por disciplina e ao longo dos dias, gráfico de acertos por aula, totais por disciplina e detalhamento por aula. Filtros por disciplina, ciclo e período, com exportação de relatório CSV.
- **Caderno de erros:** registros agrupados por aula, descrição do erro, resposta correta e marcação de revisão.
- **Anotações:** fonte e tamanho, negrito, itálico, sublinhado, tachado, títulos, alinhamentos, listas, cores, grifos, citações, links, desfazer e refazer. Materiais podem ser anexados a cada anotação.
- **Backup:** exportação e restauração de todos os dados e anexos por JSON, com validação e confirmação antes da substituição.

## Edital e planilha de referência

O acesso à planilha fornecida e aos sites oficiais foi bloqueado pela rede do ambiente durante o desenvolvimento. A base de **11 disciplinas e 78 tópicos** é uma estrutura inicial sugerida para a preparação, **não uma transcrição integral ou validada de um edital oficial**. Nenhuma hora, resultado de estudo ou incidência foi inventada. Confira e ajuste o conteúdo de acordo com o edital do concurso desejado. A confirmação manual dessa revisão fica em Configurações.

Para importar o conteúdo correto, use **Importar edital**, baixe o modelo e preencha um CSV com uma linha por tópico:

```csv
disciplina;topico;incidencia
Direito Tributário;Obrigação tributária;
Direito Tributário;Crédito tributário;
```

As colunas `disciplina` e `topico` (ou `aula`) são obrigatórias; `incidencia` é opcional, de 0 a 100. Não preencha percentuais sem uma análise real de provas. São aceitos separadores ponto e vírgula ou vírgula, campos entre aspas e números brasileiros. A importação mescla aulas por nome, preservando o progresso. A opção de substituir o edital apaga os registros associados e exige confirmação; exporte um backup antes.

Referência fornecida pelo usuário: [Google Planilhas](https://docs.google.com/spreadsheets/d/1u8Zwx05sgHHI8Yi_bBXLXv04ir6uG_KydogSheURf5o/edit?usp=sharing).

## Cálculos

- Horas semanais = horas por dia × número de dias selecionados.
- Estimativa mensal = horas semanais × 52 ÷ 12 (aproximadamente 4,33 semanas).
- Meta semanal da disciplina = meta semanal × peso da disciplina ÷ soma dos pesos.
- Aproveitamento por aula, disciplina ou geral = soma de acertos ÷ soma de questões. Não é a média dos percentuais das sessões.
- Sessões de teoria ou revisão sem questões contam para o tempo, mas não alteram o aproveitamento. Sem questões, o site exibe `—`; zero acertos em questões respondidas resulta em `0%`.
- O acompanhamento semanal usa segunda a domingo. Datas de estudo usam o fuso `America/Rio_Branco`. Horas não são alteradas pelo fuso.

## Armazenamento

Os registros e materiais ficam no **IndexedDB deste navegador**. Eles persistem após recarregar a página, mas não são sincronizados entre dispositivos. Limpar dados do navegador, trocar de origem/porta ou usar janela privada pode tornar os registros indisponíveis. Exporte backups regularmente e use a restauração para transferir dados entre dispositivos.

Anexos: até 5 MB por arquivo, 30 arquivos por anotação e 100 MB de anexos no total. Backups incluem os arquivos em base64. A restauração aceita JSON de até 250 MB e higieniza o HTML das anotações. Exclusões de disciplina ou tópico também removem os registros associados, mediante confirmação.

## Verificação

```bash
npm test
npm run build
```

Os testes cobrem a ponderação dos acertos, metas de ciclos, exclusões relacionadas, integridade dos backups e importação CSV. O fluxo também foi verificado em Chromium: cadastro, sessões, gráficos, erros, formatação, anexos, recarga, exportação/restauração e navegação em tela de 390 px.

Para futuras tarefas no ambiente da nuvem, use este checkout existente. Cada tarefa já é isolada; não crie um Git worktree sem solicitação explícita. Dependências e arquivos podem ser mantidos no snapshot, mas o processo Vite precisa ser iniciado novamente.
