# Changelog

## 3.0.0

- Tela de configuração (ícone da extensão ou Opções) para informar o endereço do SISWeb de cada município, com `http://` ou `https://` e porta. Os endereços deixaram de ficar fixos no código.
- Gera um PDF com todos os exames e um PDF por data de exame; os nomes dos arquivos incluem a ficha do paciente.
- Corrige exames omitidos: o mesmo exame em requisições/datas diferentes agora entra em cada data (antes só o primeiro era incluído).
- Considera apenas a ficha de paciente em primeiro plano, evitando misturar exames de fichas abertas por baixo.
- Quando o SISWeb não gera um resultado, segue com os demais e informa quais ficaram de fora e o motivo.
- Remove a permissão `tabs`; requer Chrome 119 ou mais recente.

## 2.1.1

- Versão inicial de uso interno, com endereços fixos.
