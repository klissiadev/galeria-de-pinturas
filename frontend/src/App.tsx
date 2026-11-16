import { useEffect, useRef, useState } from "react";
import { api, paintingCache } from "./Api";
import type {
  CategoryGroup,
  EvaluationData,
  Painting,
  QualitativeCase,
  Rating,
  Recommendation,
  SelectedCategories,
  TasteItem,
  UserSummary,
} from "./Types";

type Mode = "existing" | "custom";

const paintingMap = paintingCache;
const featureTypeLabels = {
  theme: "tema",
  style: "estilo",
  school: "escola",
  keyword: "palavra-chave",
  artist: "artista",
} as const;

function ArtImage({
  painting,
  className = "",
  eager = false,
  thumbnail = false,
}: {
  painting: Painting;
  className?: string;
  eager?: boolean;
  thumbnail?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={`art-image ${className}`}>
      {!failed ? (
        <img
          src={thumbnail ? painting.thumbUrl : painting.imageUrl}
          alt={`${painting.title}, de ${painting.artist}`}
          loading={eager ? "eager" : "lazy"}
          onError={() => setFailed(true)}
        />
      ) : (
        <div
          className="image-fallback"
          role="img"
          aria-label={`Imagem indisponível de ${painting.title}`}
        >
          <span aria-hidden="true">◇</span>
          <small>Acervo digital</small>
        </div>
      )}
    </div>
  );
}

function Stars({
  value,
  onChange,
  compact = false,
}: {
  value: number;
  onChange?: (value: number) => void;
  compact?: boolean;
}) {
  return (
    <div className={`stars ${compact ? "compact" : ""}`} aria-label={`${value} de 5 estrelas`}>
      {[1, 2, 3, 4, 5].map((star) =>
        onChange ? (
          <button
            key={star}
            type="button"
            className={star <= value ? "filled" : ""}
            aria-label={
              star === value
                ? "Remover esta avaliação"
                : `Avaliar com ${star} ${star === 1 ? "estrela" : "estrelas"}`
            }
            onClick={() => onChange(star === value ? 0 : star)}
          >
            ★
          </button>
        ) : (
          <span key={star} className={star <= value ? "filled" : ""} aria-hidden="true">
            ★
          </span>
        ),
      )}
    </div>
  );
}

function RatingControls({
  value,
  onRate,
  label = "Avalie esta recomendação",
}: {
  value: number;
  onRate: (rating: number) => void;
  label?: string;
}) {
  return (
    <div className="recommendation-rating">
      <div>
        <small>{label}</small>
        <Stars value={value} onChange={onRate} />
      </div>
      <button type="button" onClick={() => onRate(1)}>
        Não me interessa
      </button>
    </div>
  );
}

function AttributeChips({ values, compact = false }: { values: string[]; compact?: boolean }) {
  const unique = [...new Set(values.filter(Boolean))];
  if (!unique.length) return null;
  return (
    <div className={`subject-chips ${compact ? "compact" : ""}`}>
      {unique.map((value) => (
        <span key={value}>{value}</span>
      ))}
    </div>
  );
}

function TasteProfile({
  profile,
  onEdit,
}: {
  profile: { name: string; type: string; weight: number }[];
  onEdit?: () => void;
}) {
  return (
    <section className="taste-card" aria-labelledby="taste-title">
      <div className="eyebrow">Vetor de preferências</div>
      <div className="taste-heading">
        <h3 id="taste-title">Seu perfil de gosto</h3>
        {onEdit && (
          <button type="button" onClick={onEdit}>
            Editar categorias
          </button>
        )}
      </div>
      {profile.length ? (
        <div className="taste-list">
          {profile.map((item) => (
            <div className="taste-row" key={`${item.type}-${item.name}`}>
              <div>
                <span>
                  <small>{item.type}</small>
                  {item.name}
                </span>
                <strong>{Math.round(item.weight * 100)}%</strong>
              </div>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: `${item.weight * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted">
          Escolha categorias ou avalie obras para revelar os seus principais atributos.
        </p>
      )}
    </section>
  );
}

function DetailsModal({
  recommendation,
  onClose,
  rating,
  onRate,
}: {
  recommendation: Recommendation;
  onClose: () => void;
  rating: number;
  onRate: (rating: number) => void;
}) {
  const painting = paintingMap.get(recommendation.paintingId)!;
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          className="close-button"
          ref={closeRef}
          onClick={onClose}
          aria-label="Fechar detalhes"
        >
          ×
        </button>
        <ArtImage painting={painting} className="modal-art" />
        <div className="modal-content">
          <div className="eyebrow">Ficha completa da obra</div>
          <h2 id="modal-title">{painting.title}</h2>
          <p className="modal-artist">
            {painting.artist}, {painting.displayDate}
          </p>
          <dl className="attributes">
            {painting.style && (
              <div>
                <dt>Estilo</dt>
                <dd>{painting.style}</dd>
              </div>
            )}
            <div>
              <dt>Escola</dt>
              <dd>{painting.school}</dd>
            </div>
            <div>
              <dt>Tema</dt>
              <dd>
                <AttributeChips values={[painting.broadTheme, painting.theme]} compact />
              </dd>
            </div>
            <div>
              <dt>Técnica / suporte</dt>
              <dd>{painting.medium}</dd>
            </div>
            {painting.keywords.length > 0 && (
              <div>
                <dt>Palavras-chave</dt>
                <dd>
                  <AttributeChips values={painting.keywords} compact />
                </dd>
              </div>
            )}
            <div>
              <dt>Similaridade do cosseno</dt>
              <dd>{recommendation.score.toFixed(2).replace(".", ",")}</dd>
            </div>
          </dl>
          <RatingControls value={rating} onRate={onRate} />
          <h3>Decomposição da explicação</h3>
          <div className="decomposition">
            {recommendation.matchedFeatures.map((feature) => (
              <div key={`${feature.origin}-${feature.name}`}>
                <span>
                  <small>{featureTypeLabels[feature.type]}</small>
                  {feature.origin === "selection"
                    ? `Você escolheu: ${feature.name.replace(/^[^:]+: /, "")}`
                    : `Das obras avaliadas: ${feature.name.replace(/^[^:]+: /, "")}`}
                </span>
                <strong>+{feature.contribution.toFixed(2).replace(".", ",")}</strong>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${feature.contribution * 200}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function RecommendationCard({
  recommendation,
  rank,
  onDetails,
  rating,
  onRate,
}: {
  recommendation: Recommendation;
  rank: number;
  onDetails: () => void;
  rating: number;
  onRate: (rating: number) => void;
}) {
  const painting = paintingMap.get(recommendation.paintingId)!;
  const [expanded, setExpanded] = useState(false);
  const disclosureId = `recommendation-details-${painting.id}`;
  const similar = recommendation.mostSimilarHistoryItemId
    ? paintingMap.get(recommendation.mostSimilarHistoryItemId)
    : undefined;
  return (
    <article className="recommendation-card">
      <div className="rank">#{rank}</div>
      <ArtImage painting={painting} className="recommendation-art" eager={rank <= 2} />
      <div className="recommendation-body">
        <div className="work-heading">
          <div>
            <h3>{painting.title}</h3>
            <p>
              {painting.artist} <span>·</span> {painting.displayDate}
            </p>
          </div>
          <button className="details-button" type="button" onClick={onDetails}>
            Ver detalhes <span aria-hidden="true">↗</span>
          </button>
        </div>
        <div className="metadata">
          {painting.style && (
            <>
              <span>{painting.style}</span>
              <i />
            </>
          )}
          <span>{painting.school}</span>
        </div>
        <AttributeChips values={[painting.broadTheme, painting.theme, ...painting.keywords]} />
        <RatingControls value={rating} onRate={onRate} />
        <div className="recommendation-toggle-row">
          <button
            type="button"
            className="recommendation-toggle"
            aria-expanded={expanded}
            aria-controls={disclosureId}
            onClick={() => setExpanded((current) => !current)}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true" className={expanded ? "expanded" : ""}>
              <path d="m3 6 5 5 5-5" />
            </svg>
            {expanded ? "Ocultar" : "Por que recomendamos?"}
          </button>
          <span>Similaridade {recommendation.score.toFixed(2).replace(".", ",")}</span>
        </div>
        <div
          id={disclosureId}
          className={`recommendation-disclosure ${expanded ? "expanded" : ""}`}
          aria-hidden={!expanded}
        >
          <div className="score-row">
            <div>
              <span>Similaridade do cosseno</span>
              <strong>{recommendation.score.toFixed(2).replace(".", ",")}</strong>
            </div>
            <div className="score-track">
              <div style={{ width: `${recommendation.score * 100}%` }} />
            </div>
          </div>
          <div className="explanation">
            <div className="eyebrow">Por que recomendamos?</div>
            <div className="chips">
              {recommendation.matchedFeatures.map((feature) => (
                <span
                  key={`${feature.origin}-${feature.name}`}
                  className={`explanation-chip ${feature.origin}`}
                >
                  <span className="source-icon" aria-hidden="true">
                    {feature.origin === "selection" ? "✓" : "◷"}
                  </span>
                  <small>{featureTypeLabels[feature.type]}</small>
                  {feature.origin === "selection"
                    ? `Você escolheu: ${feature.name.replace(/^[^:]+: /, "")}`
                    : `Das obras que você avaliou: ${feature.name.replace(/^[^:]+: /, "")}`}
                  <strong>+{feature.contribution.toFixed(2).replace(".", ",")}</strong>
                </span>
              ))}
            </div>
            {similar && (
              <div className="similar-work">
                <ArtImage painting={similar} thumbnail />
                <div>
                  <small>Mais parecida com</small>
                  <strong>{similar.title}</strong>
                </div>
                <span>{recommendation.similarityToHistoryItem?.toFixed(2).replace(".", ",")}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

const emptyCategories = (): SelectedCategories => ({
  styles: [],
  themes: [],
  schools: [],
  artists: [],
});

function CategoryOnboarding({
  selected,
  catalog,
  onChange,
  variant,
  profileName = "",
  onNameChange,
  onSave,
  onCancel,
}: {
  selected: SelectedCategories;
  catalog: Record<CategoryGroup, string[]>;
  onChange: (value: SelectedCategories) => void;
  variant: "create" | "adjust";
  profileName?: string;
  onNameChange?: (value: string) => void;
  onSave: () => void;
  onCancel?: () => void;
}) {
  const [artistQuery, setArtistQuery] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<CategoryGroup[]>([]);
  const groupNames: Record<CategoryGroup, string> = {
    styles: "Estilos",
    themes: "Temas",
    schools: "Escola",
    artists: "Artistas",
  };
  const selectedCount = Object.values(selected).flat().length;
  const toggle = (group: CategoryGroup, value: string) => {
    const current = selected[group].find((item) => item.value === value);
    const nextGroup = current
      ? current.weight === 1
        ? selected[group].map((item) =>
            item.value === value ? { ...item, weight: 2 as const } : item,
          )
        : selected[group].filter((item) => item.value !== value)
      : [...selected[group], { value, weight: 1 as const }];
    onChange({ ...selected, [group]: nextGroup });
  };
  const [matchingArtists, setMatchingArtists] = useState<string[]>([]);
  useEffect(() => {
    if (!artistQuery.trim()) {
      setMatchingArtists([]);
      return;
    }
    let cancelled = false;
    const timeout = window.setTimeout(() => {
      api
        .searchArtists(artistQuery)
        .then((names) => !cancelled && setMatchingArtists(names))
        .catch(() => !cancelled && setMatchingArtists([]));
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [artistQuery]);

  return (
    <div className="onboarding" aria-labelledby="onboarding-title">
      <div className="eyebrow">Comece pelo que desperta seu olhar</div>
      <h2 id="onboarding-title">
        {variant === "create" ? "Crie seu perfil" : "Ajuste seus interesses"}
      </h2>
      <p>
        Escolha pelo menos duas categorias. Toque novamente para marcar “Gosto muito” e uma terceira
        vez para desmarcar.
      </p>
      {variant === "create" && (
        <label className="profile-name">
          <span>Nome do perfil</span>
          <input
            value={profileName}
            onChange={(event) => onNameChange?.(event.target.value)}
            placeholder="Ex.: Meu perfil de arte"
            maxLength={40}
          />
        </label>
      )}

      {(Object.keys(groupNames) as CategoryGroup[]).map((group) => (
        <fieldset className="category-group" key={group}>
          <legend>{groupNames[group]}</legend>
          {group === "artists" && (
            <div className="artist-search">
              <label htmlFor="artist-search">Buscar artista</label>
              <input
                id="artist-search"
                value={artistQuery}
                onChange={(event) => setArtistQuery(event.target.value)}
                placeholder="Digite um nome..."
                autoComplete="off"
              />
              {artistQuery && (
                <div
                  className="artist-suggestions"
                  role="listbox"
                  aria-label="Sugestões de artistas"
                >
                  {matchingArtists.map((artist) => (
                    <button
                      type="button"
                      role="option"
                      aria-selected={Boolean(
                        selected.artists.find((item) => item.value === artist),
                      )}
                      key={artist}
                      onClick={() => {
                        toggle("artists", artist);
                        setArtistQuery("");
                      }}
                    >
                      {artist}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="category-chips">
            {catalog[group]
              .slice(0, expandedGroups.includes(group) ? undefined : group === "artists" ? 8 : 10)
              .map((value) => {
                const choice = selected[group].find((item) => item.value === value);
                return (
                  <button
                    type="button"
                    key={value}
                    aria-pressed={Boolean(choice)}
                    className={choice ? `selected weight-${choice.weight}` : ""}
                    onClick={() => toggle(group, value)}
                    title={
                      choice?.weight === 2
                        ? "Gosto muito — clique para desmarcar"
                        : choice
                          ? "Gosto — clique para aumentar o interesse"
                          : "Selecionar categoria"
                    }
                  >
                    {value}
                    {choice && (
                      <span aria-label={choice.weight === 2 ? "Gosto muito" : "Gosto"}>
                        {choice.weight === 2 ? "••" : "•"}
                      </span>
                    )}
                  </button>
                );
              })}
          </div>
          {catalog[group].length > (group === "artists" ? 8 : 10) && (
            <button
              type="button"
              className="show-more-button"
              onClick={() =>
                setExpandedGroups((current) =>
                  current.includes(group)
                    ? current.filter((item) => item !== group)
                    : [...current, group],
                )
              }
            >
              {expandedGroups.includes(group) ? "Ver menos" : "Ver mais"}
            </button>
          )}
        </fieldset>
      ))}

      <div className="onboarding-actions">
        <span>
          <strong>{selectedCount}</strong> categorias escolhidas
        </span>
        <button
          type="button"
          className="primary-button"
          disabled={selectedCount < 2 || (variant === "create" && !profileName.trim())}
          onClick={onSave}
        >
          {variant === "create" ? "Salvar perfil e ver recomendações" : "Salvar interesses"}{" "}
          <span>→</span>
        </button>
        {onCancel && (
          <button type="button" className="skip-button" onClick={onCancel}>
            Cancelar
          </button>
        )}
      </div>
    </div>
  );
}

const STORAGE_KEY = "galeria-sugerida:created-profiles-v2";

/** Só guardamos no navegador quais perfis foram criados aqui (para o selo "Criado por você"). */
function readCreatedIds(): string[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Erro inesperado ao falar com a API.";

function EvaluationDashboard() {
  const [data, setData] = useState<EvaluationData | null>(null);
  const [cases, setCases] = useState<QualitativeCase[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = () => {
    setLoading(true);
    Promise.all([api.getEvaluationMetrics(), api.getQualitativeCases()])
      .then(([metricsData, casesData]) => {
        setData(metricsData);
        setCases(casesData);
        setError(null);
      })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRunEvaluation = async () => {
    setRunning(true);
    try {
      await api.runEvaluation({ seed: 42, min_ratings: 5 });
      loadData();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setRunning(false);
    }
  };

  if (loading) {
    return (
      <main className="metrics-container">
        <div className="empty-state">
          <h3>Carregando avaliação experimental...</h3>
          <p className="muted">Calculando métricas e baselines offline.</p>
        </div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="metrics-container">
        <div className="empty-state">
          <h3>Erro ao carregar métricas</h3>
          <p>{error}</p>
          <button type="button" className="rerun-btn" onClick={loadData}>
            Tentar novamente
          </button>
        </div>
      </main>
    );
  }

  const { metadata, models } = data;
  const fbc = models.fbc?.metrics;
  const fbcMmr = models.fbc_mmr?.metrics;
  const random = models.random?.metrics;

  const p5Gain =
    random && fbc
      ? Math.round(((fbc["precision@5"] - random["precision@5"]) / (random["precision@5"] || 0.001)) * 100)
      : 0;
  const r5Gain =
    random && fbc
      ? Math.round(((fbc["recall@5"] - random["recall@5"]) / (random["recall@5"] || 0.001)) * 100)
      : 0;
  const ndcg5Gain =
    random && fbc
      ? Math.round(((fbc["ndcg@5"] - random["ndcg@5"]) / (random["ndcg@5"] || 0.001)) * 100)
      : 0;
  const ildGain =
    fbc && fbcMmr && fbc["diversity@5"] > 0
      ? Math.round(((fbcMmr["diversity@5"] - fbc["diversity@5"]) / fbc["diversity@5"]) * 100)
      : 0;

  return (
    <main className="metrics-container">
      <div className="metrics-header">
        <div className="metrics-title">
          <h1>Avaliação Experimental & Métricas</h1>
          <p>
            Protocolo offline com split 80/20 por usuário, comparando FBC contra baselines obrigatórios
            conforme o Guia do Trabalho.
          </p>
        </div>
        <button
          type="button"
          className="rerun-btn"
          disabled={running}
          onClick={handleRunEvaluation}
        >
          {running ? "Calculando..." : "↻ Recalcular Avaliação Offline"}
        </button>
      </div>

      <div className="metrics-meta-bar">
        <span className="meta-chip">
          Usuários avaliados: <strong>{metadata.num_users_evaluated}</strong>
        </span>
        <span className="meta-chip">
          Catálogo total: <strong>{metadata.num_total_paintings} pinturas</strong>
        </span>
        <span className="meta-chip">
          Divisão: <strong>80% treino / 20% teste</strong>
        </span>
        <span className="meta-chip">
          Relevância: <strong>Nota ≥ {metadata.relevance_threshold}</strong>
        </span>
        <span className="meta-chip">
          Semente fixa: <strong>{metadata.seed}</strong>
        </span>
      </div>

      <div className="metrics-kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">Precision@5 (FBC)</div>
          <div className="kpi-value-row">
            <span className="kpi-value">{(fbc?.["precision@5"] ?? 0).toFixed(4)}</span>
            <span className="kpi-gain-badge">+{p5Gain}% vs Aleatório</span>
          </div>
          <div className="kpi-subtext">Taxa de acertos relevantes no Top-5 (Aleatório: {random?.["precision@5"]?.toFixed(4)})</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">Recall@5 (FBC)</div>
          <div className="kpi-value-row">
            <span className="kpi-value">{(fbc?.["recall@5"] ?? 0).toFixed(4)}</span>
            <span className="kpi-gain-badge">+{r5Gain}% vs Aleatório</span>
          </div>
          <div className="kpi-subtext">Cobertura dos itens relevantes de teste (Aleatório: {random?.["recall@5"]?.toFixed(4)})</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">nDCG@5 (FBC)</div>
          <div className="kpi-value-row">
            <span className="kpi-value">{(fbc?.["ndcg@5"] ?? 0).toFixed(4)}</span>
            <span className="kpi-gain-badge">+{ndcg5Gain}% vs Aleatório</span>
          </div>
          <div className="kpi-subtext">Qualidade e ranking posicional das recomendações (Aleatório: {random?.["ndcg@5"]?.toFixed(4)})</div>
        </div>

        <div className="kpi-card variant-diversity">
          <div className="kpi-label">Diversidade Intra-Lista (MMR)</div>
          <div className="kpi-value-row">
            <span className="kpi-value">{(fbcMmr?.["diversity@5"] ?? 0).toFixed(4)}</span>
            <span className="kpi-gain-badge" style={{ background: "#fdf0ec", color: "var(--terracotta)" }}>
              +{ildGain}% vs FBC puro
            </span>
          </div>
          <div className="kpi-subtext">Dissimilaridade média par-a-par reduzindo superespecialização (FBC: {fbc?.["diversity@5"]?.toFixed(4)})</div>
        </div>
      </div>

      <section className="metrics-section">
        <div className="metrics-section-title">
          <span>Tabela Comparativa Completa — Top-5 e Top-10</span>
        </div>
        <div className="table-responsive">
          <table className="eval-table">
            <thead>
              <tr>
                <th>Modelo</th>
                <th>P@5</th>
                <th>R@5</th>
                <th>nDCG@5</th>
                <th>P@10</th>
                <th>R@10</th>
                <th>nDCG@10</th>
                <th>Cobertura@10</th>
                <th>Diversidade@10</th>
                <th>Novidade@10</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(models).map(([key, model]) => {
                const isFBC = key === "fbc" || key === "fbc_mmr";
                const isBaseline = key === "random" || key === "popularity";
                const m = model.metrics;
                return (
                  <tr key={key} className={isFBC ? "highlight-row" : ""}>
                    <td>
                      <strong>{model.label}</strong>
                      {isBaseline && <span className="badge-baseline">Baseline</span>}
                      {isFBC && <span className="badge-model">FBC Proposto</span>}
                    </td>
                    <td>{m["precision@5"].toFixed(4)}</td>
                    <td>{m["recall@5"].toFixed(4)}</td>
                    <td>{m["ndcg@5"].toFixed(4)}</td>
                    <td>{m["precision@10"].toFixed(4)}</td>
                    <td>{m["recall@10"].toFixed(4)}</td>
                    <td>{m["ndcg@10"].toFixed(4)}</td>
                    <td>{(m["coverage@10"] * 100).toFixed(1)}%</td>
                    <td>{m["diversity@10"].toFixed(4)}</td>
                    <td>{m["novelty@10"].toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {cases && cases.length > 0 && (
        <section className="metrics-section">
          <div className="metrics-section-title">
            <span>Avaliação Qualitativa: Casos Reais & Análise de Limitações</span>
          </div>
          <div className="qualitative-grid">
            {cases.map((c, idx) => (
              <article
                key={idx}
                className={`case-card ${c.is_error ? "is-error" : "is-success"}`}
              >
                <div className="case-header">
                  <h3>{c.title}</h3>
                  <span className={`case-badge ${c.is_error ? "error" : "success"}`}>
                    {c.is_error ? "Discussão de Limitação / Erro" : "Caso de Sucesso"}
                  </span>
                </div>
                <p className="case-description">{c.description}</p>
                <div style={{ display: "flex", gap: "16px", marginBottom: "16px", fontSize: "13px" }}>
                  <span>Usuário ID: <strong>{c.user_id}</strong></span>
                  <span>Precision@5 no usuário: <strong>{(c.metrics.precision_at_5 * 100).toFixed(0)}%</strong></span>
                  <span>Recall@5 no usuário: <strong>{(c.metrics.recall_at_5 * 100).toFixed(0)}%</strong></span>
                </div>

                <div className="case-subheading">Amostra do Histórico de Treino</div>
                <div className="case-paintings-row">
                  {c.train_sample.map((item, pIdx) => (
                    <div key={pIdx} className="case-painting-mini">
                      <img
                        src={item.painting.thumbnail || item.painting.url}
                        alt={item.painting.title}
                        className="case-painting-thumb"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = "none";
                        }}
                      />
                      <div className="case-painting-info">
                        <div className="case-painting-title">{item.painting.title}</div>
                        <div className="case-painting-artist">{item.painting.artist}</div>
                        <div style={{ color: "#d97706", fontWeight: 600, marginTop: "4px" }}>
                          {"★".repeat(item.rating)}{"☆".repeat(5 - item.rating)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="case-subheading">Top-5 Recomendações Geradas pelo Modelo FBC</div>
                <div className="case-paintings-row">
                  {c.recommendations.map((item, rIdx) => (
                    <div key={rIdx} className="case-painting-mini">
                      <img
                        src={item.painting.thumbnail || item.painting.url}
                        alt={item.painting.title}
                        className="case-painting-thumb"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = "none";
                        }}
                      />
                      <div className="case-painting-info">
                        <div className="case-painting-title">{item.painting.title}</div>
                        <div className="case-painting-artist">{item.painting.artist}</div>
                        {item.is_hit && (
                          <span className="tag-eval-hit">✓ Relevante no Teste (Acerto)</span>
                        )}
                        {!item.is_hit && item.test_rating && item.test_rating <= 2 && (
                          <span className="tag-eval-dislike">✗ Desgostou no Teste (Erro)</span>
                        )}
                        {!item.is_hit && (!item.test_rating || item.test_rating === 3) && (
                          <span className="tag-eval-unrated">Não avaliado no Teste</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {c.is_error && (
                  <div className="case-analysis-box">
                    <strong>Por que a FBC falha neste cenário?</strong>
                    <br />
                    A Filtragem Baseada em Conteúdo sofre do efeito clássico de <em>superespecialização (filter bubble)</em>:
                    ao identificar forte associação em atributos como artista e estilo, o modelo concentra
                    suas recomendações nas mesmas séries ou movimentos artísticos já consumidos, perdendo capacidade de
                    apresentar novidades estéticas (serendipidade) e ignorando atributos sutis não representados no texto.
                    A diversificação (MMR) e abordagens híbridas são as estratégias recomendadas para mitigar essa deficiência.
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

function App() {
  const [view, setView] = useState<"gallery" | "evaluation">("gallery");
  const [mode, setMode] = useState<Mode>("existing");
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [userId, setUserId] = useState("");
  const [count, setCount] = useState<5 | 10>(5);
  const [diversify, setDiversify] = useState(false);
  const [createdIds, setCreatedIds] = useState<string[]>(readCreatedIds);
  const [catalog, setCatalog] = useState<Record<CategoryGroup, string[]>>({
    styles: [],
    themes: [],
    schools: [],
    artists: [],
  });
  const [existingRatings, setExistingRatings] = useState<Rating[]>([]);
  const [userCategories, setUserCategories] = useState<SelectedCategories>(emptyCategories);
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);
  const [recommendationsData, setRecommendationsData] = useState<Recommendation[] | null>(null);
  const [recsLoading, setRecsLoading] = useState(false);
  const [tasteExisting, setTasteExisting] = useState<TasteItem[]>([]);
  const [tastePreview, setTastePreview] = useState<TasteItem[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<SelectedCategories>(emptyCategories);
  const [profileName, setProfileName] = useState("");
  const [adjustingInterests, setAdjustingInterests] = useState(false);
  const [interestDraft, setInterestDraft] = useState<SelectedCategories>(emptyCategories);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Recommendation | null>(null);
  const [historyNotice, setHistoryNotice] = useState<{
    paintingId: string;
    previousRating?: number;
    targetUserId: string;
    message: string;
  } | null>(null);

  const allUsers = users.map((item) => ({ ...item, createdByUser: createdIds.includes(item.id) }));
  const user = allUsers.find((item) => item.id === userId);
  const isCreatedProfile = createdIds.includes(userId);
  const currentRatings = existingRatings;
  const selectedCount = Object.values(selectedCategories).flat().length;
  const recommendations = mode === "existing" ? recommendationsData : null;
  const loading = mode === "existing" && recsLoading && recommendationsData === null;
  const tasteProfile = mode === "existing" ? tasteExisting : tastePreview;
  const ratingsKey = existingRatings.map((item) => `${item.paintingId}:${item.rating}`).join(",");
  const categoriesKey = JSON.stringify(userCategories);

  const loadUsers = async (selectId?: string) => {
    setUsersLoading(true);
    try {
      const list = await api.listUsers();
      setUsers(list);
      setUserId((current) =>
        selectId ?? (list.some((item) => item.id === current) ? current : (list[0]?.id ?? "")),
      );
      setError(null);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setUsersLoading(false);
    }
  };

  // carga inicial: perfis e catálogo de categorias
  useEffect(() => {
    void loadUsers();
    api.categories().then(setCatalog).catch((caught) => setError(errorMessage(caught)));
  }, []);

  // dados do perfil selecionado: categorias e histórico
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setLoadedUserId(null);
    setRecommendationsData(null);
    setTasteExisting([]);
    Promise.all([api.getUser(userId), api.history(userId)])
      .then(([detail, ratings]) => {
        if (cancelled) return;
        setUserCategories(detail.categories);
        setExistingRatings(ratings);
        setLoadedUserId(userId);
      })
      .catch((caught) => !cancelled && setError(errorMessage(caught)));
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // recomendações e vetor de preferências (refeitos quando notas, interesses, N ou MMR mudam)
  useEffect(() => {
    if (mode !== "existing" || !userId || loadedUserId !== userId) return;
    let cancelled = false;
    setRecsLoading(true);
    Promise.all([api.recommendations(userId, count, diversify), api.tasteProfile(userId)])
      .then(([recs, taste]) => {
        if (cancelled) return;
        setRecommendationsData(recs);
        setTasteExisting(taste);
        setError(null);
      })
      .catch((caught) => !cancelled && setError(errorMessage(caught)))
      .finally(() => !cancelled && setRecsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [mode, userId, loadedUserId, count, diversify, ratingsKey, categoriesKey]);

  // pré-visualização do vetor de preferências ao criar perfil (ainda não salvo)
  useEffect(() => {
    if (mode !== "custom") return;
    if (selectedCount === 0) {
      setTastePreview([]);
      return;
    }
    let cancelled = false;
    const timeout = window.setTimeout(() => {
      api
        .previewTaste(selectedCategories)
        .then((items) => !cancelled && setTastePreview(items))
        .catch(() => undefined);
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [mode, selectedCategories, selectedCount]);

  const setLocalRating = (paintingId: string, rating: number) =>
    setExistingRatings((current) => {
      const others = current.filter((item) => item.paintingId !== paintingId);
      return rating === 0 ? others : [...others, { paintingId, rating }];
    });

  const sendRating = (targetUserId: string, paintingId: string, rating: number) =>
    rating === 0
      ? api.deleteRating(targetUserId, paintingId)
      : api.putRating(targetUserId, paintingId, rating);

  const updateRating = (paintingId: string, rating: number) => {
    const previousRating = currentRatings.find((item) => item.paintingId === paintingId)?.rating;
    setLocalRating(paintingId, rating);
    setError(null);
    setHistoryNotice({
      paintingId,
      previousRating,
      targetUserId: userId,
      message:
        rating === 0
          ? "Avaliação removida"
          : previousRating
            ? "Avaliação atualizada"
            : "Adicionada ao histórico",
    });
    sendRating(userId, paintingId, rating).catch((caught) => {
      setLocalRating(paintingId, previousRating ?? 0);
      setError(errorMessage(caught));
    });
  };

  const undoHistoryChange = () => {
    if (!historyNotice) return;
    const { paintingId, previousRating, targetUserId } = historyNotice;
    if (targetUserId === userId) setLocalRating(paintingId, previousRating ?? 0);
    sendRating(targetUserId, paintingId, previousRating ?? 0).catch((caught) =>
      setError(errorMessage(caught)),
    );
    setHistoryNotice(null);
  };

  const createProfile = async () => {
    if (!profileName.trim() || selectedCount < 2) return;
    try {
      const created = await api.createProfile(profileName.trim(), selectedCategories);
      setCreatedIds((current) => [...current, created.id]);
      await loadUsers(created.id);
      setMode("existing");
      setProfileName("");
      setSelectedCategories(emptyCategories());
      setAdjustingInterests(false);
      setSelected(null);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  };

  const saveInterests = async () => {
    if (Object.values(interestDraft).flat().length < 2) return;
    try {
      setUserCategories(await api.putCategories(userId, interestDraft));
      setAdjustingInterests(false);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  };

  const deleteCreatedProfile = async () => {
    const name = users.find((item) => item.id === userId)?.name ?? "";
    if (!isCreatedProfile || !window.confirm(`Excluir o perfil “${name}” e todo o seu histórico?`)) {
      return;
    }
    try {
      await api.deleteUser(userId);
      setCreatedIds((current) => current.filter((id) => id !== userId));
      setSelected(null);
      setHistoryNotice(null);
      await loadUsers();
    } catch (caught) {
      setError(errorMessage(caught));
    }
  };

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(createdIds));
    } catch {
      // O app continua funcionando sem armazenamento do navegador.
    }
  }, [createdIds]);

  useEffect(() => {
    if (!historyNotice) return;
    const timeout = window.setTimeout(() => setHistoryNotice(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [historyNotice]);

  if (!user) {
    return (
      <div className="app-shell">
        <main className="layout">
          <section className="results" aria-live="polite">
            {error ? (
              <div className="error-state" role="alert">
                <div aria-hidden="true">!</div>
                <div className="eyebrow">Sem conexão com a API</div>
                <h3>Não foi possível carregar os perfis</h3>
                <p>{error}</p>
                <button type="button" onClick={() => void loadUsers()}>
                  Tentar novamente
                </button>
              </div>
            ) : (
              <p className="muted">{usersLoading ? "Carregando a galeria…" : "Nenhum perfil encontrado."}</p>
            )}
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#main" aria-label="Galeria Sugerida — início">
          <span className="brand-mark" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span>
            Galeria <em>Sugerida</em>
          </span>
        </a>

        <div className="nav-view-switcher" role="tablist" aria-label="Navegação da Aplicação">
          <button
            type="button"
            role="tab"
            className={`nav-view-btn ${view === "gallery" ? "active" : ""}`}
            aria-selected={view === "gallery"}
            onClick={() => setView("gallery")}
          >
            Galeria & Recomendações
          </button>
          <button
            type="button"
            role="tab"
            className={`nav-view-btn ${view === "evaluation" ? "active" : ""}`}
            aria-selected={view === "evaluation"}
            onClick={() => setView("evaluation")}
          >
            Avaliação do Modelo & Métricas
          </button>
        </div>

        {view === "gallery" && (
          <div className="toolbar">
            <div className="mode-tabs" role="tablist" aria-label="Modo de recomendação">
              <button
                role="tab"
                aria-selected={mode === "existing"}
                onClick={() => {
                  setMode("existing");
                  setError(null);
                  setAdjustingInterests(false);
                  setSelected(null);
                }}
              >
                Usuário existente
              </button>
              <button
                role="tab"
                aria-selected={mode === "custom"}
                onClick={() => {
                  setMode("custom");
                  setError(null);
                  setAdjustingInterests(false);
                  setSelected(null);
                }}
              >
                Criar perfil
              </button>
            </div>
            <label className="select-label">
              <span>Quantidade de recomendações (N)</span>
              <select
                value={count}
                onChange={(event) => setCount(Number(event.target.value) as 5 | 10)}
              >
                <option value={5}>5 obras</option>
                <option value={10}>10 obras</option>
              </select>
            </label>
            <div className="switch-wrap">
              <button
                type="button"
                className={`switch ${diversify ? "on" : ""}`}
                role="switch"
                aria-checked={diversify}
                onClick={() => setDiversify((value) => !value)}
              >
                <span />
              </button>
              <span>
                Diversificar resultados <small>(MMR)</small>
              </span>
              <span className="tooltip">
                <button aria-label="Sobre diversificação dos resultados">?</button>
                <span role="tooltip">
                  Reduz recomendações muito parecidas entre si, ampliando a variedade do resultado.
                </span>
              </span>
            </div>
          </div>
        )}
      </header>

      {view === "evaluation" ? (
        <EvaluationDashboard />
      ) : (
        <main id="main" className="layout">
        <aside className="sidebar" aria-labelledby="profile-title">
          <div className="section-heading">
            <div className="eyebrow">
              {mode === "existing" ? "Base de referência" : "Curadoria pessoal"}
            </div>
            <h1 id="profile-title">
              {mode === "existing" ? "Perfil e histórico" : "Criar perfil"}
            </h1>
          </div>

          {mode === "existing" ? (
            <>
              <label className="user-select">
                <span>Selecionar perfil</span>
                <select
                  value={userId}
                  onChange={(event) => {
                    setUserId(event.target.value);
                    setAdjustingInterests(false);
                    setSelected(null);
                  }}
                >
                  {allUsers.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                      {item.createdByUser ? " — Criado por você" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <div className="profile-controls">
                <div>
                  {isCreatedProfile && <span className="local-badge">Criado por você</span>}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setInterestDraft(userCategories);
                    setAdjustingInterests(true);
                  }}
                >
                  Ajustar interesses
                </button>
                {isCreatedProfile && (
                  <button type="button" className="delete-profile" onClick={deleteCreatedProfile}>
                    Excluir perfil
                  </button>
                )}
              </div>
              {adjustingInterests ? (
                <CategoryOnboarding
                  selected={interestDraft}
                  onChange={setInterestDraft}
                  variant="adjust"
                  catalog={catalog}
                  onSave={saveInterests}
                  onCancel={() => setAdjustingInterests(false)}
                />
              ) : (
                <>
                  <div className="history-header">
                    <span>Histórico de avaliações</span>
                    <strong>{existingRatings.length} obras</strong>
                  </div>
                  <div className="history-list">
                    {existingRatings.map((rating) => {
                      const painting = paintingMap.get(rating.paintingId);
                      if (!painting) return null;
                      return (
                        <div
                          className={`history-item ${rating.rating <= 2 ? "disliked" : ""}`}
                          key={rating.paintingId}
                        >
                          <ArtImage painting={painting} thumbnail />
                          <div>
                            <strong>{painting.title}</strong>
                            <span>{painting.artist}</span>
                            <AttributeChips
                              values={[painting.broadTheme, ...painting.keywords.slice(0, 1)]}
                              compact
                            />
                            <Stars
                              value={rating.rating}
                              onChange={(value) => updateRating(rating.paintingId, value)}
                              compact
                            />
                          </div>
                          {rating.rating <= 2 && <small>Não gostou</small>}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </>
          ) : (
            <CategoryOnboarding
              selected={selectedCategories}
              onChange={setSelectedCategories}
              variant="create"
              catalog={catalog}
              profileName={profileName}
              onNameChange={setProfileName}
              onSave={createProfile}
            />
          )}
          <TasteProfile
            profile={tasteProfile}
            onEdit={
              mode === "existing" && !adjustingInterests
                ? () => {
                    setInterestDraft(userCategories);
                    setAdjustingInterests(true);
                  }
                : undefined
            }
          />
        </aside>

        <section className="results" aria-labelledby="results-title" aria-live="polite">
          <div className="results-heading">
            <div>
              <div className="eyebrow">Curadoria algorítmica</div>
              <h2 id="results-title">Recomendações Top–N</h2>
            </div>
            {recommendations && !loading && (
              <span>
                {Math.min(count, recommendations.length)} resultados ordenados por afinidade
              </span>
            )}
          </div>
          {loading ? (
            <div className="skeleton-list" aria-label="Carregando recomendações">
              {[1, 2, 3].map((item) => (
                <div className="skeleton-card" key={item}>
                  <i />
                  <div>
                    <b />
                    <b />
                    <b />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="error-state" role="alert">
              <div aria-hidden="true">!</div>
              <div className="eyebrow">A curadoria foi interrompida</div>
              <h3>Algo saiu do esperado</h3>
              <p>{error}</p>
              <button type="button" onClick={() => setError(null)}>
                Fechar aviso
              </button>
            </div>
          ) : recommendations ? (
            <div className="recommendation-list">
              {recommendations.slice(0, count).map((recommendation, index) => (
                <RecommendationCard
                  key={`${userId}-${count}-${diversify}-${existingRatings
                    .map((rating) => `${rating.paintingId}:${rating.rating}`)
                    .join(",")}-${recommendation.paintingId}`}
                  recommendation={recommendation}
                  rank={index + 1}
                  onDetails={() => setSelected(recommendation)}
                  rating={
                    currentRatings.find((item) => item.paintingId === recommendation.paintingId)
                      ?.rating ?? 0
                  }
                  onRate={(rating) => updateRating(recommendation.paintingId, rating)}
                />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-art" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
              <div className="eyebrow">A galeria aguarda seu olhar</div>
              <h3>Suas recomendações aparecerão aqui</h3>
              <p>
                {mode === "custom"
                  ? "Dê um nome ao perfil e escolha ao menos duas categorias para começar."
                  : "Ajuste seus interesses para iniciar uma nova curadoria."}
              </p>
            </div>
          )}
        </section>
      </main>
      )}
      <footer className="data-footer">Dados: National Gallery of Art Open Data (CC0)</footer>
      {historyNotice && (
        <div className="history-notice" role="status">
          <span>{historyNotice.message}</span>
          <button type="button" onClick={undoHistoryChange}>
            Desfazer
          </button>
        </div>
      )}
      {selected && (
        <DetailsModal
          recommendation={selected}
          onClose={() => setSelected(null)}
          rating={
            currentRatings.find((item) => item.paintingId === selected.paintingId)?.rating ?? 0
          }
          onRate={(rating) => updateRating(selected.paintingId, rating)}
        />
      )}
    </div>
  );
}

export default App;