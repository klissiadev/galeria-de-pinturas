import { useEffect, useMemo, useRef, useState } from "react";
import data from "./data/mockData.json";
import {
  PROFILE_ALPHA,
  buildProfile,
  buildTasteProfile,
  recommend,
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
  onChange,
  variant,
  profileName = "",
  onNameChange,
  onSave,
  onCancel,
}: {
  selected: SelectedCategories;
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
  const matchingArtists = data.categories.artists
    .filter((artist) => artist.toLocaleLowerCase().includes(artistQuery.toLocaleLowerCase()))
    .slice(0, 5);

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

type CreatedProfile = {
  id: string;
  name: string;
  selectedCategories: SelectedCategories;
  createdByUser: true;
};

type PersistedGalleryState = {
  createdProfiles: CreatedProfile[];
  ratingsByUser: Record<string, Rating[]>;
  categoryOverrides: Record<string, SelectedCategories>;
};

const STORAGE_KEY = "galeria-sugerida:profiles-v1";

function readPersistedState(): PersistedGalleryState {
  const fallback: PersistedGalleryState = {
    createdProfiles: [],
    ratingsByUser: {},
    categoryOverrides: {},
  };
  if (typeof window === "undefined") return fallback;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored ? { ...fallback, ...JSON.parse(stored) } : fallback;
  } catch {
    return fallback;
  }
}

function App() {
  const initialPersisted = useRef(readPersistedState()).current;
  const [mode, setMode] = useState<Mode>("existing");
  const [userId, setUserId] = useState("u01");
  const [count, setCount] = useState<5 | 10>(5);
  const [diversify, setDiversify] = useState(false);
  const [createdProfiles, setCreatedProfiles] = useState<CreatedProfile[]>(
    initialPersisted.createdProfiles,
  );
  const [categoryOverrides, setCategoryOverrides] = useState<Record<string, SelectedCategories>>(
    initialPersisted.categoryOverrides,
  );
  const [ratingsByUser, setRatingsByUser] = useState<Record<string, Rating[]>>(() => ({
    ...Object.fromEntries(data.users.map((user) => [user.id, [...user.ratings]])),
    ...initialPersisted.ratingsByUser,
  }));
  const [selectedCategories, setSelectedCategories] = useState<SelectedCategories>(emptyCategories);
  const [profileName, setProfileName] = useState("");
  const [adjustingInterests, setAdjustingInterests] = useState(false);
  const [interestDraft, setInterestDraft] = useState<SelectedCategories>(emptyCategories);
  const [loading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Recommendation | null>(null);
  const [historyNotice, setHistoryNotice] = useState<{
    paintingId: string;
    previousRating?: number;
    targetUserId: string;
    message: string;
  } | null>(null);

  const baseUsers = data.users.map((user) => ({
    id: user.id,
    name: user.name,
    selectedCategories: (user as typeof user & { selectedCategories?: SelectedCategories })
      .selectedCategories,
    createdByUser: false as const,
  }));
  const allUsers = [...baseUsers, ...createdProfiles];
  const user = allUsers.find((item) => item.id === userId) ?? allUsers[0];
  const isCreatedProfile = user.createdByUser;
  const existingRatings = ratingsByUser[userId] ?? [];
  const userCategories = isCreatedProfile
    ? user.selectedCategories
    : (categoryOverrides[userId] ?? user.selectedCategories ?? emptyCategories());
  const hasLocalOverride = !isCreatedProfile && Boolean(categoryOverrides[userId]);
  const existingProfile = useMemo(
    () => buildProfile(existingRatings, userCategories, PROFILE_ALPHA),
    [existingRatings, userCategories],
  );
  const creationProfile = useMemo(
    () => buildProfile([], selectedCategories, PROFILE_ALPHA),
    [selectedCategories],
  );
  const tasteProfile = buildTasteProfile(mode === "existing" ? existingProfile : creationProfile);
  const currentRatings = existingRatings;
  const selectedCount = Object.values(selectedCategories).flat().length;
  const recommendations =
    mode === "existing"
      ? recommend(
          existingProfile,
          paintings.length,
          existingRatings.map((rating) => rating.paintingId),
          diversify,
        )
      : null;

  const updateRating = (paintingId: string, rating: number) => {
    const previousRating = currentRatings.find((item) => item.paintingId === paintingId)?.rating;
    const update = (ratings: Rating[]) =>
      rating === 0
        ? ratings.filter((item) => item.paintingId !== paintingId)
        : [...ratings.filter((item) => item.paintingId !== paintingId), { paintingId, rating }];
    setRatingsByUser((current) => ({
      ...current,
      [userId]: update(current[userId] ?? []),
    }));
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
  };

  const undoHistoryChange = () => {
    if (!historyNotice) return;
    const restore = (ratings: Rating[]) => {
      const withoutCurrent = ratings.filter((item) => item.paintingId !== historyNotice.paintingId);
      return historyNotice.previousRating
        ? [
            ...withoutCurrent,
            {
              paintingId: historyNotice.paintingId,
              rating: historyNotice.previousRating,
            },
          ]
        : withoutCurrent;
    };
    setRatingsByUser((current) => ({
      ...current,
      [historyNotice.targetUserId]: restore(current[historyNotice.targetUserId] ?? []),
    }));
    setHistoryNotice(null);
  };

  const createProfile = () => {
    if (!profileName.trim() || selectedCount < 2) return;
    const id = `local-${Date.now()}`;
    const profile: CreatedProfile = {
      id,
      name: profileName.trim(),
      selectedCategories,
      createdByUser: true,
    };
    setCreatedProfiles((current) => [...current, profile]);
    setRatingsByUser((current) => ({ ...current, [id]: [] }));
    setUserId(id);
    setMode("existing");
    setProfileName("");
    setSelectedCategories(emptyCategories());
    setAdjustingInterests(false);
    setSelected(null);
  };

  const saveInterests = () => {
    if (Object.values(interestDraft).flat().length < 2) return;
    if (isCreatedProfile) {
      setCreatedProfiles((current) =>
        current.map((profile) =>
          profile.id === userId ? { ...profile, selectedCategories: interestDraft } : profile,
        ),
      );
    } else {
      setCategoryOverrides((current) => ({
        ...current,
        [userId]: interestDraft,
      }));
    }
    setAdjustingInterests(false);
  };

  const restoreOriginalProfile = () => {
    setCategoryOverrides((current) => {
      const next = { ...current };
      delete next[userId];
      return next;
    });
    setAdjustingInterests(false);
  };

  const deleteCreatedProfile = () => {
    if (
      !isCreatedProfile ||
      !window.confirm(`Excluir o perfil “${user.name}” e todo o seu histórico?`)
    ) {
      return;
    }
    setCreatedProfiles((current) => current.filter((profile) => profile.id !== userId));
    setRatingsByUser((current) => {
      const next = { ...current };
      delete next[userId];
      return next;
    });
    setUserId(data.users[0].id);
    setSelected(null);
    setHistoryNotice(null);
  };

  useEffect(() => {
    const stored: PersistedGalleryState = {
      createdProfiles,
      ratingsByUser,
      categoryOverrides,
    };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    } catch {
      // The app remains usable in private mode or when browser storage is unavailable.
    }
  }, [createdProfiles, ratingsByUser, categoryOverrides]);

  useEffect(() => {
    if (!historyNotice) return;
    const timeout = window.setTimeout(() => setHistoryNotice(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [historyNotice]);

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
      </header>

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
                  {hasLocalOverride && (
                    <span className="customized-badge">Perfil personalizado</span>
                  )}
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
                {hasLocalOverride && (
                  <button type="button" onClick={restoreOriginalProfile}>
                    Restaurar perfil original
                  </button>
                )}
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
          ) : error && mode === "custom" ? (
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
