# RaceCore Lite — Beta 0.7.1

Projeto independente da Carrera. Abra index.html no navegador ou use Live Server no VS Code. XML, campeonato e Excel não requerem bibliotecas externas. OCR opcional carrega Tesseract.js 5.1.1 pela internet.

## Atualização 0.5 — contingência Kosmi
- Adaptado das funcionalidades descritas da Carrera Beta 0.11, usando o código Lite 0.3 disponível; não é cópia do código Carrera nem do Lite 0.4 anterior.
- Em Championship, compartilhe a aba do Kosmi (Chrome/Edge desktop em HTTPS), ou importe um print. O vídeo continua compartilhado enquanto a aba estiver aberta e o navegador permitir. Leitura OCR por clique, experimental; não há leitura automática contínua nem integração de gravação Kosmi. O OCR processa a imagem no navegador e depende do download de bibliotecas/modelos de terceiros.
- Texto reconhecido editável; parser sugere apenas linhas começando por posição e número de carro. Confira visualmente, preencha nome da sessão, escolha segmento, marque confirmação e aplique. Posições duplicadas são rejeitadas. Pode preencher manualmente sem OCR. As posições são projeções; não são resultados oficiais.
- Faixas finais conservadoras por campeonato, recalculadas a cada simulação. Não representam combinações conjuntas nem resolvem empates pendentes.
- Histórico e exportação XLSX permanecem via XML; não registrar tempos/pilotos por OCR sem validação. O formato da transmissão real ainda precisa de teste.
- GitHub Pages: substitua os oito arquivos na raiz do repositório RaceCore-Lite. Não alterar a Carrera.

## Atualização 0.3 preservada
- Painel do piloto identificado no último XML, com última mudança de nome por carro. O número do carro permanece fixo. Não alterna a dupla automaticamente a cada passagem pelos boxes.
- Identifica nomes individuais e abreviações inequívocas nos campos fullname, firstname/lastname e additional2, cruzados com a dupla cadastrada em data.js. Nomes conflitantes ou duplas sem identificação individual aparecem como indefinidos; o texto recebido é preservado para conferência.
- Se o nome permanece o mesmo entre leituras consecutivas e o contador avança uma volta, a volta recém-completada recebe a identificação observada. Primeira leitura, voltas retroativas, lacunas e transições sem certeza ficam indefinidas. Isso é uma atribuição por amostragem, não uma confirmação oficial de cada volta; o feed pode atualizar com atraso.
- Comparação consolidada por carro ou individual por piloto (inclusive contra o companheiro). Estatísticas individuais não usam melhores setores consolidados do carro. Correção manual no histórico, com origem registrada e exportada no XLSX.
- O histórico local do Beta 0.2 é preservado, mas suas voltas sem piloto ficam indefinidas. Não há sincronização entre aparelhos.
- Visual renovado e meta noindex/nofollow para reduzir indexação; não é proteção de acesso. O GitHub Pages continua público.

## Performance
- Clique Conectar ao vivo para ler current.xml do Cronotracker a cada 3 s. Também aceita importação manual de XML.
- Identifica grupo e nome reais (groupname/runname); aceita somente Challenge, separa por evento/pista/grupo/sessão. Não confundir classes Carrera/F4 com Challenge. Caso o nome oficial não contenha Challenge, o app recusa o feed até ajuste do adaptador.
- Compara #100 com qualquer carro da categoria ou o rival mais rápido. Melhores setores são independentes; modo Última volta usa somente setores cuja soma confere com a volta (tolerância 5 ms).
- O XML fornece apenas as últimas três voltas; capturas perdidas podem deixar lacunas. Setores não disponíveis não são inventados. A fonte de melhores setores é bestsection0/1/2.
- Histórico no localStorage do navegador; manter a página aberta durante sessões. Não sincroniza PC/celular.
- Exporta XLSX sem dependências, arquivo e aba com nome da sessão, opção de todas as sessões; cabeçalho B2 e margens A/1 vazias. Abas truncadas para limite Excel de 31 caracteres.
- Não há estratégia, combustível, cálculo ou monitoramento de duração de paradas. A mudança do nome no feed é o indicador de troca, não uma suposição baseada em pit stop.

## Championship
Preserva base Beta 0.1 e o motor de cálculo de Geral/Sport/Rookie, com descartes e projeção manual de resultados. Pontos históricos do arquivo PER261122_V1_IGA_PONTUAÇÃO(1).xlsm, regras arts. 155–161 do regulamento. Distância inicial 500 km ajustável. Empates não resolvidos são marcados. Não converte automaticamente posição ao vivo em pontos oficiais: confirme resultado, classificação e elegibilidade dos segmentos.

## Limitações
A estrutura XML foi baseada em amostra Cronotracker da F4 (campos label/result). O feed real da Challenge ainda deve ser confirmado na pista, inclusive nomes de classes, setores e CORS. Se o acesso direto falhar, importe o XML salvo; um proxy poderá ser necessário posteriormente. Não reconstrói todas as voltas anteriores ao início da captura.

## Beta 0.6 — painel de engenharia
- Layout compacto, navegação por módulos, cabeçalho de conexão, hora da última leitura e cobertura da sessão. Indicador diferencia XML importado, pausado, erro e XML recebido; conteúdo idêntico por mais de 30 s sinaliza ausência de mudança (não prova interrupção do feed).
- Última volta no painel e tabela geral, gráfico de delta por setor (escala simétrica relativa aos valores exibidos), cabeçalhos fixos nas tabelas, configurações de fonte e contingência recolhíveis. Não há tempos fictícios na interface.
- Limpar cenário preserva carros extras cadastrados. Pontos e histórico local usam as mesmas chaves da versão anterior. Nenhuma atualização da Carrera.
- A publicação real, CORS, OCR e identificação dos pilotos na transmissão continuam sujeitos a teste em pista. Não compartilhe dados confidenciais no repositório público.

### Testes desta entrega
- JavaScript verificado com Node. Interface executada em Chromium com HTML/CSS/JS incorporados para contornar bloqueio de navegação do ambiente de testes; desktop 1440 px e celular 390 px (sem overflow global).
- Dados de teste sintéticos: troca Giuliano → Raphael e atribuição de voltas consecutivas; posições iniciais P5/P2/P2 e 99/58/60 pontos; simulação completa e reset; download XLSX aberto por openpyxl com cabeçalho em B2.
- A navegação por HTTP/file foi bloqueada no ambiente de teste; persistência em origem real, rede ao vivo e OCR não foram validados. Nenhum dado simulado vem instalado no aplicativo.

## Beta 0.7 — campeonato ao vivo
- Ative em Championship → Ativar projeção ao vivo. XML de Interlagos, sessão de corrida Challenge, posições válidas; a cada 3 s atualiza Geral/Sport/Rookie e descarte.
- Feche manualmente cada segmento após confirmar classificação, 75%, penalidades e inscritos. O inicial não muda na segunda parte. Ao fechar o inicial, a projeção final começa vazia.
- Posição de pista é projeção, não resultado oficial. Feed inválido, carros desconhecidos, erro de conexão ou sessão inadequada preservam o último cenário e avisam. Pausar permite editar; Kosmi continua manual.
- Ao recarregar, o modo automático fica desligado e os segmentos congelados são preservados. A contagem de tempo desde a leitura não prova que o servidor está atualizado.

## 0.7.1 — revisão de operação
- Abre em Championship; status de atualidade visível acima dos cartões. Fonte XML configurável e salva por aparelho.
- Bloqueia fechamento ao vivo com classificação inválida, antiga ou conexão pausada. Para fechar manualmente, pause e confirme os resultados.
- Faixas de possibilidades do título durante modo ao vivo tratam segmentos abertos como indefinidos. Posições atuais seguem sendo projeções.
- Cada aparelho deve ativar a projeção e fechar os segmentos independentemente; não há sincronização de estado.
