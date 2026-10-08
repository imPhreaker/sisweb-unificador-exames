<img src="icons/icon.svg" alt="" width="96" align="right">

# SISWeb Unificador de Exames

Extensão para navegadores baseados em Chromium (Chrome, Edge, Brave e outros) que reúne em PDF os resultados de exames laboratoriais exibidos no prontuário do **SISWeb**. Em vez de abrir cada resultado separadamente, o profissional clica uma vez e recebe:

- um PDF com **todos os exames** do paciente, das datas mais recentes para as mais antigas;
- um PDF **por data de exame**, quando houver exames de mais de uma data.

Todo o processamento acontece no próprio navegador. Nenhum PDF, dado clínico ou credencial é enviado para fora do SISWeb.

> Projeto independente, sem vínculo com o fornecedor do SISWeb. Use por sua conta e confira sempre os resultados no sistema de origem.

## Requisitos

- Chrome 102 ou mais recente (ou navegador Chromium equivalente).
- Acesso ao SISWeb do seu município, com usuário já autenticado.

## Instalação

1. Baixe o arquivo `.zip` da versão mais recente em [Releases](../../releases).
2. Extraia o conteúdo para uma pasta permanente (por exemplo, `Documentos\sisweb-unificador-exames`).
3. Abra `chrome://extensions` (no Edge, `edge://extensions`).
4. Ative o **Modo do desenvolvedor**.
5. Clique em **Carregar sem compactação** e selecione a pasta extraída.
6. A tela de configuração abre automaticamente.

Também é possível clonar este repositório e carregar a pasta diretamente — ela já contém tudo o que a extensão precisa.

### Atualização

Substitua os arquivos **na mesma pasta** pelos da nova versão e clique em **Recarregar** no cartão da extensão em `chrome://extensions`. Mantendo a mesma pasta, os endereços configurados são preservados; se carregar a extensão a partir de outra pasta, o navegador a trata como uma nova extensão e será preciso configurar de novo.

## Configuração

Cada município acessa o SISWeb por um endereço próprio. Informe o seu:

1. Clique no ícone da extensão na barra do navegador (ou em **Detalhes → Opções da extensão**).
2. Digite o endereço do SISWeb, começando com `http://` ou `https://` — por exemplo `https://sisweb.municipio.gov.br/sis/` ou `http://servidor:8099/sis/`.
3. Clique em **Adicionar** e confirme a permissão solicitada pelo navegador.
4. Recarregue a página do SISWeb.

A extensão atua em toda a origem informada (protocolo, domínio e porta); o caminho depois do domínio é ignorado. É possível cadastrar mais de um endereço. Remover um endereço também revoga o acesso a ele.

## Uso

1. No SISWeb, abra o paciente e entre em **Monitor** (por exemplo, em Ambulatório → Observados).
2. Na caixa lateral **Exames**, clique em **Baixar todos (PDF)**.
3. Aguarde a coleta — o andamento aparece logo abaixo do botão.
4. Use **Abrir** ou **Baixar** no PDF com todos os exames ou no PDF da data desejada.

Os arquivos recebem nomes como:

- `SISWeb-ficha-12345-exames-todos-2026-10-08.pdf` (data em que foi gerado);
- `SISWeb-ficha-12345-exames-2026-10-01.pdf` (data dos exames).

Se a ficha do paciente não for encontrada na tela, o trecho `ficha-12345` é omitido.

### Como funciona

Para cada exame da lista, a extensão aciona o mesmo comando que o SISWeb executa ao clicar no ícone do exame. Normalmente o sistema abriria uma nova janela `EXAME` com o PDF; durante a coleta, a extensão faz essa janela ser criada como um quadro oculto dentro da própria página, lê dali o PDF e o descarta. Assim nenhuma aba é aberta e o bloqueador de pop-ups do navegador não interfere. No fim, as páginas são reunidas com a biblioteca [pdf-lib](https://pdf-lib.js.org/).

- Cada exame de cada requisição entra uma única vez; o mesmo exame em datas diferentes gera páginas separadas.
- Só são considerados os exames da ficha em primeiro plano, mesmo que outras fichas estejam abertas por baixo.
- Se o SISWeb não conseguir gerar algum resultado, a extensão segue com os demais e informa ao final quais exames ficaram de fora e a mensagem do sistema.

## Permissões

| Permissão | Para quê |
|---|---|
| Acesso aos endereços cadastrados | Concedido por você na configuração; a extensão não roda em nenhum outro site. |
| `storage` | Guardar os endereços cadastrados. |
| `scripting` | Ativar a extensão somente nos endereços cadastrados. |

## Limitações conhecidas

- Depende da estrutura atual das telas do SISWeb (a ação `FREXAMES` nos ícones de exame e a página `EXAME` aberta com `window.open`). Mudanças do fornecedor nessas telas podem exigir ajustes na extensão.
- Testada no módulo Ambulatório (Observados → Monitor). Outras telas com lista de exames podem funcionar, mas não foram verificadas.
- Os exames são obtidos um de cada vez; listas grandes levam alguns segundos por exame.

## Problemas e sugestões

Abra uma [issue](../../issues) descrevendo o navegador, a versão da extensão e a tela do SISWeb. **Não inclua nomes de pacientes, números de ficha, capturas de tela com dados clínicos nem endereços internos da sua prefeitura.**

## Desenvolvimento

```bash
npm install
npm run check
```

- `npm run update-pdf-lib` copia a pdf-lib instalada em `node_modules` para `pdf-lib.min.js`.
- Para publicar uma versão, atualize `version` em `manifest.json` e `package.json`, registre as mudanças no `CHANGELOG.md` e envie uma tag `vX.Y.Z`; o GitHub Actions gera o `.zip` e a Release.

## Licença

Copyright (C) 2026 Phreaker ([@imPhreaker](https://github.com/imPhreaker)).

Este programa é software livre: você pode redistribuí-lo e/ou modificá-lo sob os termos da [GNU General Public License](LICENSE), publicada pela Free Software Foundation, na versão 3 da licença ou (a seu critério) qualquer versão posterior. Ele é distribuído na esperança de ser útil, mas **sem nenhuma garantia**, nem mesmo a garantia implícita de comercialização ou adequação a um propósito específico. Veja o arquivo [LICENSE](LICENSE) para os detalhes.

Licenças das bibliotecas incluídas: veja [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
