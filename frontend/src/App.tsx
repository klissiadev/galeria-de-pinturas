import { useEffect, useMemo, useRef, useState } from "react";
import data from "./data/mockData.json";
import {
  buildInitialProfile,
  buildTasteProfile,
  recommend,
  recommendFromRatings,
  updateProfileWithRatings,
  type CategoryGroup,
  type Painting,
  type Rating,
  type Recommendation,
  type SelectedCategories,
} from "./recommender";

type Mode = "existing" | "custom";

const paintings = data.paintings as Painting[];
const paintingMap = new Map(paintings.map((painting) => [painting.id, painting]));
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
            aria-label={`Avaliar com ${star} ${star === 1 ? "estrela" : "estrelas"}`}
            onClick={() => onChange(star)}
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

function AttributeChips({ values, compact = false }: { values: string[]; compact?: boolean }) {
  if (!values.length) return null;
  return (
    <div className={`subject-chips ${compact ? "compact" : ""}`}>
      {values.map((value) => (
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
}: {
  recommendation: Recommendation;
  onClose: () => void;
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
}: {
  recommendation: Recommendation;
  rank: number;
  onDetails: () => void;
}) {
  const painting = paintingMap.get(recommendation.paintingId)!;
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
  onChange,
  onContinue,
  onSkip,
  editing,
}: {
  selected: SelectedCategories;
  onChange: (value: SelectedCategories) => void;
  onContinue: () => void;
  onSkip: () => void;
  editing: boolean;
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
  const matchingArtists = data.categories.artists
    .filter((artist) => artist.toLocaleLowerCase().includes(artistQuery.toLocaleLowerCase()))
    .slice(0, 5);

  return (
    <div className="onboarding" aria-labelledby="onboarding-title">
      <div className="step-indicator">
        <span>Etapa 1 de 2</span>
        <div>
          <i className="active" />
          <i />
        </div>
      </div>
      <div className="eyebrow">Comece pelo que desperta seu olhar</div>
      <h2 id="onboarding-title">O que você gosta de ver?</h2>
      <p>
        Escolha pelo menos duas categorias. Toque novamente para marcar “Gosto muito” e uma terceira
        vez para desmarcar.
      </p>

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
            {data.categories[group]
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
          {data.categories[group].length > (group === "artists" ? 8 : 10) && (
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
          disabled={selectedCount < 2}
          onClick={onContinue}
        >
          {editing ? "Salvar e recalcular" : "Continuar"} <span>→</span>
        </button>
        {!editing && (
          <button type="button" className="skip-button" onClick={onSkip}>
            Pular e avaliar obras direto
          </button>
        )}
      </div>
    </div>
  );
}

function App() {
  const [mode, setMode] = useState<Mode>("existing");
  const [userId, setUserId] = useState("u01");
  const [count, setCount] = useState<5 | 10>(5);
  const [diversify, setDiversify] = useState(false);
  const [customRatings, setCustomRatings] = useState<Rating[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<SelectedCategories>(emptyCategories);
  const [onboardingStep, setOnboardingStep] = useState<1 | 2>(1);
  const [editingCategories, setEditingCategories] = useState(false);
  const [customResults, setCustomResults] = useState<Recommendation[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Recommendation | null>(null);

  const user = data.users.find((item) => item.id === userId)!;
  const existingProfile = useMemo(
    () => updateProfileWithRatings(buildInitialProfile(emptyCategories()), user.ratings, paintings),
    [user],
  );
  const customProfile = useMemo(
    () =>
      updateProfileWithRatings(buildInitialProfile(selectedCategories), customRatings, paintings),
    [selectedCategories, customRatings],
  );
  const tasteProfile = buildTasteProfile(mode === "existing" ? existingProfile : customProfile);
  const selectedCount = Object.values(selectedCategories).flat().length;
  const prioritizedPaintings = useMemo(() => {
    if (!selectedCount) return paintings.slice(0, 24);
    const selectedValues = new Set(
      Object.values(selectedCategories)
        .flat()
        .map((item) => item.value),
    );
    const matches = paintings.filter(
      (painting) =>
        selectedValues.has(painting.style) ||
        selectedValues.has(painting.broadStyle) ||
        selectedValues.has(painting.artist) ||
        selectedValues.has(painting.school) ||
        selectedValues.has(painting.broadTheme) ||
        selectedValues.has(painting.theme),
    );
    const exploration = paintings.filter((painting) => !matches.includes(painting));
    return [...matches.slice(0, 18), ...exploration.slice(0, 6)].slice(0, 24);
  }, [selectedCategories, selectedCount]);
  const existingRecommendations = data.recommendations[
    userId as keyof typeof data.recommendations
  ] as Recommendation[];
  const recommendations =
    mode === "existing"
      ? diversify
        ? recommendFromRatings(paintings, user.ratings, true)
        : existingRecommendations
      : customResults;

  const updateCustomRating = (paintingId: string, rating: number) => {
    setCustomResults(null);
    setError(null);
    setCustomRatings((current) => [
      ...current.filter((item) => item.paintingId !== paintingId),
      { paintingId, rating },
    ]);
  };

  const generate = () => {
    if (selectedCount < 2 && customRatings.length < 3) return;
    setLoading(true);
    setError(null);
    setCustomResults(null);
    window.setTimeout(() => {
      try {
        const nextResults = recommend(customProfile, paintings.length, paintings, diversify);
        if (!nextResults.length) throw new Error("Nenhuma recomendação disponível");
        setCustomResults(nextResults);
      } catch {
        setError(
          "Não foi possível gerar a curadoria agora. Revise suas avaliações e tente novamente.",
        );
      } finally {
        setLoading(false);
      }
    }, 750);
  };

  useEffect(() => {
    if (mode === "custom" && customResults) {
      setCustomResults(recommend(customProfile, paintings.length, paintings, diversify));
    }
  }, [diversify]); // updates generated custom recommendations when MMR changes

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
        <div className="toolbar">
          <div className="mode-tabs" role="tablist" aria-label="Modo de recomendação">
            <button
              role="tab"
              aria-selected={mode === "existing"}
              onClick={() => {
                setMode("existing");
                setError(null);
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
              }}
            >
              Montar meu perfil
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
      </header>

      <main id="main" className="layout">
        <aside className="sidebar" aria-labelledby="profile-title">
          <div className="section-heading">
            <div className="eyebrow">
              {mode === "existing" ? "Base de referência" : "Curadoria pessoal"}
            </div>
            <h1 id="profile-title">Perfil e histórico</h1>
          </div>

          {mode === "existing" ? (
            <>
              <label className="user-select">
                <span>Selecionar perfil</span>
                <select value={userId} onChange={(event) => setUserId(event.target.value)}>
                  {data.users.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="history-header">
                <span>Histórico de avaliações</span>
                <strong>{user.ratings.length} obras</strong>
              </div>
              <div className="history-list">
                {user.ratings.map((rating) => {
                  const painting = paintingMap.get(rating.paintingId)!;
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
                        <Stars value={rating.rating} compact />
                      </div>
                      {rating.rating <= 2 && <small>Não gostou</small>}
                    </div>
                  );
                })}
              </div>
            </>
          ) : onboardingStep === 1 ? (
            <CategoryOnboarding
              selected={selectedCategories}
              onChange={setSelectedCategories}
              editing={editingCategories}
              onContinue={() => {
                setOnboardingStep(2);
                if (editingCategories && customResults) generate();
                setEditingCategories(false);
              }}
              onSkip={() => {
                setSelectedCategories(emptyCategories());
                setOnboardingStep(2);
              }}
            />
          ) : (
            <>
              <div className="step-indicator">
                <span>Etapa 2 de 2 · opcional</span>
                <div>
                  <i className="active" />
                  <i className="active" />
                </div>
              </div>
              <div className="rating-step-heading">
                <div className="eyebrow">Refine seu perfil</div>
                <h2>Avalie algumas obras</h2>
                <p className="intro">
                  Priorizamos obras próximas às suas escolhas e incluímos novos caminhos para
                  ampliar a descoberta.
                </p>
              </div>
              <div className="rating-grid">
                {prioritizedPaintings.map((painting) => {
                  const rating =
                    customRatings.find((item) => item.paintingId === painting.id)?.rating ?? 0;
                  return (
                    <div className="rating-item" key={painting.id}>
                      <ArtImage painting={painting} thumbnail />
                      <div>
                        <strong>{painting.title}</strong>
                        <span>{painting.artist}</span>
                        <Stars
                          value={rating}
                          onChange={(value) => updateCustomRating(painting.id, value)}
                          compact
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="rating-actions">
                <div>
                  <strong>{customRatings.length}</strong> obras avaliadas
                  <span>
                    {selectedCount >= 2 ? "avaliação opcional" : "mínimo 3 sem categorias"}
                  </span>
                </div>
                <button
                  className="clear-button"
                  onClick={() => {
                    setCustomRatings([]);
                    setCustomResults(null);
                    setError(null);
                  }}
                  disabled={!customRatings.length}
                >
                  Limpar
                </button>
                <button
                  className="primary-button"
                  onClick={generate}
                  disabled={(selectedCount < 2 && customRatings.length < 3) || loading}
                >
                  Gerar recomendações <span>→</span>
                </button>
              </div>
            </>
          )}
          <TasteProfile
            profile={tasteProfile}
            onEdit={
              mode === "custom" && selectedCount > 0 && onboardingStep === 2
                ? () => {
                    setEditingCategories(true);
                    setOnboardingStep(1);
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
          ) : error && mode === "custom" ? (
            <div className="error-state" role="alert">
              <div aria-hidden="true">!</div>
              <div className="eyebrow">A curadoria foi interrompida</div>
              <h3>Algo saiu do esperado</h3>
              <p>{error}</p>
              <button type="button" onClick={generate}>
                Tentar novamente
              </button>
            </div>
          ) : recommendations ? (
            <div className="recommendation-list">
              {recommendations.slice(0, count).map((recommendation, index) => (
                <RecommendationCard
                  key={recommendation.paintingId}
                  recommendation={recommendation}
                  rank={index + 1}
                  onDetails={() => setSelected(recommendation)}
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
                Escolha categorias ou avalie algumas obras ao lado e selecione “Gerar recomendações”
                para iniciar a curadoria.
              </p>
            </div>
          )}
        </section>
      </main>
      <footer className="data-footer">Dados: National Gallery of Art Open Data (CC0)</footer>
      {selected && <DetailsModal recommendation={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

export default App;
