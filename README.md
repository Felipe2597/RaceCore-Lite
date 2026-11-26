# RaceCore Lite — Beta 0.2

Projeto independente da Carrera. Abra index.html no navegador ou use Live Server no VS Code. Não requer bibliotecas externas.

## Performance
- Clique Conectar ao vivo para ler current.xml do Cronotracker a cada 3 s. Também aceita importação manual de XML.
- Identifica grupo e nome reais (groupname/runname); aceita somente Challenge, separa por evento/pista/grupo/sessão. Não confundir classes Carrera/F4 com Challenge. Caso o nome oficial não contenha Challenge, o app recusa o feed até ajuste do adaptador.
- Compara #100 com qualquer carro da categoria ou o rival mais rápido. Melhores setores são independentes; modo Última volta usa somente setores cuja soma confere com a volta (tolerância 5 ms).
- O XML fornece apenas as últimas três voltas; capturas perdidas podem deixar lacunas. Setores não disponíveis não são inventados. A fonte de melhores setores é bestsection0/1/2.
- Histórico no localStorage do navegador; manter a página aberta durante sessões. Não sincroniza PC/celular.
- Exporta XLSX sem dependências, arquivo e aba com nome da sessão, opção de todas as sessões; cabeçalho B2 e margens A/1 vazias. Abas truncadas para limite Excel de 31 caracteres.
- Não há estratégia, box, combustível ou tempos de parada.

## Championship
Preserva base Beta 0.1 e o motor de cálculo de Geral/Sport/Rookie, com descartes e projeção manual de resultados. Pontos históricos do arquivo PER261122_V1_IGA_PONTUAÇÃO(1).xlsm, regras arts. 155–161 do regulamento. Distância inicial 500 km ajustável. Empates não resolvidos são marcados. Não converte automaticamente posição ao vivo em pontos oficiais: confirme resultado, classificação e elegibilidade dos segmentos.

## Limitações
A estrutura XML foi baseada em amostra Cronotracker da F4 (campos label/result). O feed real da Challenge ainda deve ser confirmado na pista, inclusive nomes de classes, setores e CORS. Se o acesso direto falhar, importe o XML salvo; um proxy poderá ser necessário posteriormente. Não reconstrói todas as voltas anteriores ao início da captura.
