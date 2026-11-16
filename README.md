# Galeria de Pinturas — Sistema de Recomendação por Filtragem Baseada em Conteúdo (FBC)

Sistema de recomendação de pinturas baseado no acervo da *National Gallery of Art* (Open Data - CC0), desenvolvido conforme as especificações e critérios do **Guia do Trabalho — Sistema de Recomendação por Filtragem Baseada em Conteúdo**.

---

## 1. Visão Geral e Domínio

O sistema recomenda obras de arte com base nas características intrínsecas dos itens (estilo, tema, escola artística, artista, suporte e palavras-chave) e no perfil de interesse de cada usuário.

### Principais Funcionalidades:
1. **Representação dos Itens:** Espaço esparso multiatributo (`Theme`, `Style`, `School`, `Artist`, `Keywords`) combinado com TF-IDF de texto descritivo.
2. **Perfil do Usuário:** Vetor ponderado integrando preferências declaradas no onboarding ($\alpha$) e histórico com notas de 1 a 5 (pesos: 5 $\to$ +1.0, 4 $\to$ +0.5, 3 $\to$ 0.0, 2 $\to$ -0.5, 1 $\to$ -1.0).
3. **Similaridade do Cosseno & Top-N:** Ranking dos $N$ itens mais similares ($N \in \{5, 10\}$), com filtro estrito de obras já avaliadas.
4. **Explicabilidade:** Apresentação da contribuição percentual de cada atributo para a recomendação e identificação da obra pivô mais próxima no histórico do usuário.
5. **Diversificação Intra-Lista (MMR):** Redução da superespecialização postergando repetições consecutivas de um mesmo estilo/tema.
6. **Avaliação Experimental Offline:** Protocolo rigoroso 80/20 sem vazamento de dados, com cálculo de Precision@N, Recall@N, nDCG@N, Cobertura, Diversidade e Novidade, comparados a baselines (Aleatório e Mais Populares).
7. **Painel de Avaliação no Frontend:** Visualização interativa das métricas e estudos de caso qualitativos (incluindo discussão de casos de erro/limitação da FBC).

---

## 2. Estrutura do Repositório

```
galeria-de-pinturas/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   └── storage.py            # Persistência atômica de usuários, notas e categorias
│   ├── routes/
│   │   ├── categories.py         # Catálogo de estilos/temas/artistas para onboarding
│   │   ├── evaluation.py         # Endpoints para consulta e execução da avaliação offline
│   │   ├── paintings.py          # Consulta paginada do acervo e recomendações item-a-item
│   │   └── users.py              # Perfis, histórico, onboarding e recomendações por usuário
│   └── main.py                   # Ponto de entrada da API FastAPI (CORS configurado)
├── data/
│   ├── dataset/
│   │   ├── paintings.csv         # Catálogo com mais de 4.000 pinturas com metadados
│   │   ├── users.csv             # 200 usuários simulados
│   │   ├── ratings.csv           # Quase 5.000 avaliações com notas de 1 a 5
│   │   ├── user_categories.json  # Interesses declarados no onboarding
│   │   └── evaluation_results.json # Cache das métricas e casos qualitativos
│   ├── build_dataset.py          # Script de download e estruturação do acervo da NGA
│   └── generate_mock_users.py    # Geração dos usuários sintéticos e histórico realista
├── frontend/
│   ├── src/
│   │   ├── Api.ts                # Cliente HTTP para comunicação com o backend
│   │   ├── App.tsx               # Interface completa: Galeria e Painel de Avaliação
│   │   ├── Types.ts              # Tipagens TypeScript de obras, perfis e métricas
│   │   └── index.css             # Estilização editorial e responsiva
│   ├── package.json
│   └── vite.config.ts
├── recommendations/
│   ├── evaluator.py              # Motor de avaliação offline e cálculo das métricas
│   ├── painting_recommender.py   # Recomendação item-a-item via TF-IDF
│   └── profile_recommender.py    # Recomendação por perfil multiatributo com explicabilidade
├── evaluate.py                   # Script CLI para reproduzir os resultados com 1 comando
├── requirements                  # Dependências Python do backend
└── README.md
```

---

## 3. Como Instalar e Executar

### Pré-requisitos
- Python 3.10+
- Node.js 18+ e npm

### 3.1 Backend (FastAPI)
1. Instale as dependências:
   ```bash
   pip install -r requirements
   ```
2. Inicie o servidor FastAPI:
   ```bash
   uvicorn backend.main:app --reload --port 8000
   ```
   *A API estará disponível em `http://localhost:8000` (documentação interativa em `/docs`).*

### 3.2 Frontend (React + Vite)
1. Acesse a pasta do frontend e instale os pacotes:
   ```bash
   cd frontend
   npm install
   ```
2. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```
   *Abra o navegador em `http://localhost:5173`.*

---

## 4. Reprodução dos Resultados da Avaliação (Métricas)

Conforme exigido pelo critério de **Código e Reprodutibilidade**, todos os resultados experimentais podem ser reproduzidos com um único comando na raiz do projeto:

```bash
python evaluate.py
```

### Protocolo Experimental:
- **Divisão Treino/Teste:** 80% treino e 20% teste por usuário (com semente fixa `seed=42`).
- **Definição de Relevância:** Itens com nota $\ge 4$ no conjunto de teste.
- **Modelos Comparados:**
  1. `Aleatório (Baseline)`: Seleção uniforme de obras não consumidas.
  2. `Mais Populares (Baseline)`: Recomenda os itens com maior pontuação agregada no treino.
  3. `FBC (Filtragem Baseada em Conteúdo)`: Modelo proposto baseado em perfil multiatributo e similaridade do cosseno.
  4. `FBC com Diversificação (MMR)`: Modelo FBC com heurística anti-redundância para mitigar a superespecialização.

### Tabela de Resultados Obtidos:

| Modelo | Precision@5 | Recall@5 | nDCG@5 | Precision@10 | Recall@10 | nDCG@10 | Cobertura@10 | Diversidade@10 | Novidade@10 |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Aleatório (Baseline)** | 0.0020 | 0.0038 | 0.0038 | 0.0015 | 0.0054 | 0.0046 | 38.6% | 0.9254 | 12.19 |
| **Mais Populares (Baseline)** | 0.0030 | 0.0039 | 0.0041 | 0.0025 | 0.0064 | 0.0054 | 0.3% | 0.9524 | 10.17 |
| **FBC (Perfil de Conteúdo)** | **0.0472** | **0.0815** | **0.0669** | **0.0417** | **0.1292** | **0.0887** | 22.4% | 0.3984 | 11.99 |
| **FBC + Diversificação (MMR)** | 0.0382 | 0.0561 | 0.0517 | 0.0347 | 0.1134 | 0.0743 | 21.5% | **0.5591** | 11.98 |

*Observação sobre os números:* O modelo FBC supera o baseline aleatório em mais de **22x em Precision@5** e **20x em Recall@5**. A inclusão da diversificação (MMR) eleva a diversidade intra-lista em **+40%**, equilibrando o clássico *trade-off* entre acurácia e variedade.

---

## 5. Avaliação Qualitativa e Limitações da FBC

O sistema inclui 3 estudos de caso reais no dataset (acessíveis pelo painel ou via `python evaluate.py`):
1. **Caso de Sucesso 1 (Usuário 152):** Preferência consistente por modernismo/abstracionismo. O perfil direciona recomendações que coincidem com os acertos no teste.
2. **Caso de Sucesso 2 (Usuário 100):** Perfil eclético em múltiplos movimentos artísticos, onde a FBC equilibra os atributos preponderantes.
3. **Caso de Erro e Limitações (Usuário 1):** O usuário possui no histórico obras da série *Stations of the Cross* de Barnett Newman. O modelo priorizou exclusivamente outras obras da mesma série do mesmo artista, resultando em taxa de acerto nula no teste.
   - **Discussão:** Ilustra o fenômeno de **superespecialização (filter bubble)** e a dependência da granularidade dos metadados textuais na FBC, demonstrando a necessidade de diversificação e estratégias híbridas.
