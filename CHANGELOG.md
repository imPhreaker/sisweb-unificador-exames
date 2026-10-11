# Changelog

## 3.0.2

- Recusa endereços com `*` na configuração: um curinga como `https://*/` faria a extensão atuar em vários sites. Endereços assim salvos por versões anteriores são ignorados.
- O prazo de 20 segundos passa a valer também para o download do PDF; antes, uma resposta que não terminava travava a coleta.
- Quando o SISWeb mostra um erro em vez de abrir o exame, a interceptação de janelas é desfeita na hora; antes ficava ativa por até 20 segundos e um exame aberto manualmente nesse intervalo podia não aparecer.

## 3.0.1

- Corrige o bloqueio de pop-ups: o navegador bloqueava as janelas `EXAME` abertas em sequência pela coleta, e nada acontecia se o usuário não permitisse. Agora o PDF de cada exame é lido de um quadro oculto na própria página, sem abrir abas.
- Remove o rastreamento de abas no service worker; passa a exigir Chrome 102 ou mais recente.
- Ícone próprio da extensão.

## 3.0.0

- Tela de configuração (ícone da extensão ou Opções) para informar o endereço do SISWeb de cada município, com `http://` ou `https://` e porta. Os endereços deixaram de ficar fixos no código.
- Gera um PDF com todos os exames e um PDF por data de exame; os nomes dos arquivos incluem a ficha do paciente.
- Corrige exames omitidos: o mesmo exame em requisições/datas diferentes agora entra em cada data (antes só o primeiro era incluído).
- Considera apenas a ficha de paciente em primeiro plano, evitando misturar exames de fichas abertas por baixo.
- Quando o SISWeb não gera um resultado, segue com os demais e informa quais ficaram de fora e o motivo.
- Remove a permissão `tabs`; requer Chrome 119 ou mais recente.

## 2.1.1

- Versão inicial de uso interno, com endereços fixos.
