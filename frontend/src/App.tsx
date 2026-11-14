import { useEffect, useMemo, useRef, useState } from "react";
import data from "./data/mockData.json";
import {
  buildTasteProfile,
  recommendFromRatings,
  type Painting,
  type Rating,
  type Recommendation,
} from "./recommender";

type Mode = "existing" | "custom";

const paintings = data.paintings as Painting[];
const paintingMap = new Map(paintings.map((painting) => [painting.id, painting]));

function ArtImage({
  painting,
  className = "",
  eager = false,
}: {
  painting: Painting;
  className?: string;
  eager?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={`art-image ${className}`}>
      {!failed ? (
        <img
          src={painting.imageUrl}
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

function TasteProfile({ profile }: { profile: { name: string; weight: number }[] }) {
  return (
    <section className="taste-card" aria-labelledby="taste-title">
      <div className="eyebrow">Vetor de preferências</div>
      <h3 id="taste-title">Seu perfil de gosto</h3>
      {profile.length ? (
        <div className="taste-list">
          {profile.map((item) => (
            <div className="taste-row" key={item.name}>
              <div>
                <span>{item.name}</span>
                <strong>{Math.round(item.weight * 100)}%</strong>
              </div>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: `${item.weight * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted">Avalie ao menos 3 obras para revelar os seus principais atributos.</p>
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
            {painting.artist}, {painting.year}
          </p>
          <dl className="attributes">
            <div>
              <dt>Estilo</dt>
              <dd>{painting.style}</dd>
            </div>
            <div>
              <dt>Nacionalidade</dt>
              <dd>{painting.nationality}</dd>
            </div>
            <div>
              <dt>Museu / coleção</dt>
              <dd>{painting.museum}</dd>
            </div>
            <div>
              <dt>Similaridade do cosseno</dt>
              <dd>{recommendation.score.toFixed(2).replace(".", ",")}</dd>
            </div>
          </dl>
          <h3>Decomposição da explicação</h3>
          <div className="decomposition">
            {recommendation.matchedFeatures.map((feature) => (
              <div key={feature.name}>
                <span>{feature.name}</span>
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
  const similar = paintingMap.get(recommendation.mostSimilarHistoryItemId)!;
  return (
    <article className="recommendation-card">
      <div className="rank">#{rank}</div>
      <ArtImage painting={painting} className="recommendation-art" eager={rank <= 2} />
      <div className="recommendation-body">
        <div className="work-heading">
          <div>
            <h3>{painting.title}</h3>
            <p>
              {painting.artist} <span>·</span> {painting.year}
            </p>
          </div>
          <button className="details-button" type="button" onClick={onDetails}>
            Ver detalhes <span aria-hidden="true">↗</span>
          </button>
        </div>
        <div className="metadata">
          <span>{painting.style}</span>
          <i />
          <span>{painting.museum}</span>
        </div>
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
              <span key={feature.name}>
                {feature.name} <strong>+{feature.contribution.toFixed(2).replace(".", ",")}</strong>
              </span>
            ))}
          </div>
          {similar && (
            <div className="similar-work">
              <ArtImage painting={similar} />
              <div>
                <small>Mais parecida com</small>
                <strong>{similar.title}</strong>
              </div>
              <span>{recommendation.similarityToHistoryItem.toFixed(2).replace(".", ",")}</span>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function App() {
  const [mode, setMode] = useState<Mode>("existing");
  const [userId, setUserId] = useState("u01");
  const [count, setCount] = useState<5 | 10>(5);
  const [diversify, setDiversify] = useState(false);
  const [customRatings, setCustomRatings] = useState<Rating[]>([]);
  const [customResults, setCustomResults] = useState<Recommendation[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Recommendation | null>(null);

  const user = data.users.find((item) => item.id === userId)!;
  const activeRatings = mode === "existing" ? user.ratings : customRatings;
  const tasteProfile = useMemo(() => buildTasteProfile(paintings, activeRatings), [activeRatings]);
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
    if (customRatings.length < 3) return;
    setLoading(true);
    setError(null);
    setCustomResults(null);
    window.setTimeout(() => {
      try {
        const nextResults = recommendFromRatings(paintings, customRatings, diversify);
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
      setCustomResults(recommendFromRatings(paintings, customRatings, diversify));
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
                      <ArtImage painting={painting} />
                      <div>
                        <strong>{painting.title}</strong>
                        <span>{painting.artist}</span>
                        <Stars value={rating.rating} compact />
                      </div>
                      {rating.rating <= 2 && <small>Não gostou</small>}
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <p className="intro">Avalie obras para criarmos um vetor único de preferências.</p>
              <div className="rating-grid">
                {paintings.slice(0, 24).map((painting) => {
                  const rating =
                    customRatings.find((item) => item.paintingId === painting.id)?.rating ?? 0;
                  return (
                    <div className="rating-item" key={painting.id}>
                      <ArtImage painting={painting} />
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
                  <strong>{customRatings.length}</strong> obras avaliadas <span>mínimo 3</span>
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
                  disabled={customRatings.length < 3 || loading}
                >
                  Gerar recomendações <span>→</span>
                </button>
              </div>
            </>
          )}
          <TasteProfile profile={tasteProfile} />
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
                Avalie pelo menos três obras ao lado e selecione “Gerar recomendações” para iniciar
                a curadoria.
              </p>
            </div>
          )}
        </section>
      </main>
      {selected && <DetailsModal recommendation={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

export default App;
