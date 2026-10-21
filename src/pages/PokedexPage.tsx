import { useMemo, useState } from "react";
import { ChevronRight, CircleHelp, Dna, Sparkles } from "lucide-react";
import { GENERATIONS } from "../lib/constants";
import { formatNumber, getGenerationStats } from "../lib/collection";
import type { AppData, Catalog, CatalogCard } from "../types";
import { ProgressBar } from "../components/Shared";

interface PokedexPageProps {
  catalog: Catalog;
  data: AppData;
  onOpenCard: (card: CatalogCard) => void;
}

export function PokedexPage({ catalog, data, onOpenCard }: PokedexPageProps) {
  const stats = getGenerationStats(data);
  const [activeGeneration, setActiveGeneration] = useState(1);
  const cardByKey = useMemo(
    () => new Map(catalog.cards.map((card) => [card.key, card])),
    [catalog.cards],
  );
  const caughtSpecies = useMemo(() => {
    const species = new Map<number, { name: string; card?: CatalogCard }>();
    for (const copy of data.collection) {
      for (const dexId of copy.dexIds ?? []) {
        if (!species.has(dexId)) {
          species.set(dexId, { name: copy.name, card: cardByKey.get(copy.cardKey) });
        }
      }
    }
    return species;
  }, [cardByKey, data.collection]);
  const allCaught = new Set(caughtSpecies.keys()).size;
  const generation = stats.find((item) => item.id === activeGeneration) ?? stats[0];
  const generationSpecies = [...caughtSpecies.entries()]
    .filter(([dexId]) => dexId >= generation.start && dexId <= generation.end)
    .sort((a, b) => a[0] - b[0]);

  return (
    <div className="page-stack pokedex-page">
      <section className="pokedex-hero">
        <div>
          <span className="hero-kicker">
            <Dna size={15} /> Species collection
          </span>
          <h1>Your Pokédex</h1>
          <p>
            Every unique species found on one of your cards counts toward your Pokédex.
            Add multiple cards of the same Pokémon and it still counts once.
          </p>
        </div>
        <div className="pokedex-total">
          <span>Species discovered</span>
          <strong>{formatNumber(allCaught)}</strong>
          <span>of 1,025</span>
          <ProgressBar value={(allCaught / 1025) * 100} />
        </div>
      </section>

      <section className="generation-grid">
        {stats.map((item) => (
          <button
            type="button"
            key={item.id}
            className={`generation-card ${activeGeneration === item.id ? "active" : ""}`}
            onClick={() => setActiveGeneration(item.id)}
            style={{ "--generation-accent": item.accent } as React.CSSProperties}
          >
            <span>{item.roman}</span>
            <div>
              <h2>{item.name}</h2>
              <p>{item.caught} / {item.total} species</p>
            </div>
            <strong>{Math.round(item.percent)}%</strong>
            <ProgressBar value={item.percent} color={item.accent} />
          </button>
        ))}
      </section>

      <section className="surface generation-detail">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Generation {generation.roman}</span>
            <h2>{generation.name} discoveries</h2>
          </div>
          <div className="generation-progress-number" style={{ color: generation.accent }}>
            {generation.caught}
            <span> / {generation.total}</span>
          </div>
        </div>
        {generationSpecies.length === 0 ? (
          <div className="small-empty">
            <Sparkles size={25} />
            <p>
              No {generation.name} species discovered yet. Open cards with a detected
              Pokédex number to add them automatically.
            </p>
          </div>
        ) : (
          <div className="species-grid">
            {generationSpecies.map(([dexId, species]) => (
              <button
                type="button"
                className="species-card"
                key={dexId}
                onClick={() => species.card && onOpenCard(species.card)}
                disabled={!species.card}
              >
                <span>#{String(dexId).padStart(4, "0")}</span>
                <strong>{species.name}</strong>
                {species.card && <ChevronRight size={15} />}
              </button>
            ))}
          </div>
        )}
        <div className="pokedex-note">
          <CircleHelp size={16} />
          Species data is attached when a card is added. Existing copies without species
          data remain in your collection and are not removed.
        </div>
      </section>

      <section className="surface generation-map">
        <div className="section-heading">
          <div>
            <span className="eyebrow">National dex</span>
            <h2>Generation map</h2>
          </div>
        </div>
        <div className="generation-map-track">
          {GENERATIONS.map((item) => {
            const stat = stats.find((entry) => entry.id === item.id);
            const total = item.end - item.start + 1;
            return (
              <button
                type="button"
                key={item.id}
                onClick={() => setActiveGeneration(item.id)}
                className="generation-map-segment"
                style={{
                  flex: total,
                  background: item.accent,
                  opacity: stat && stat.caught > 0 ? 0.25 + (stat.percent / 100) * 0.75 : 0.16,
                }}
                title={`${item.name}: ${stat?.caught ?? 0}/${total}`}
              >
                {item.roman}
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
