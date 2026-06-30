"use client";

import { useEffect, useRef, useState } from "react";
import type { Player } from "@/lib/site-data";

export function CoreRosterCarousel({ players }: { players: Player[] }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const startIndex = Math.floor(players.length / 2);
  const [active, setActive] = useState(startIndex);

  function scrollTo(index: number) {
    const viewport = viewportRef.current;
    const card = viewport?.querySelector<HTMLElement>(`[data-player-index="${index}"]`);
    if (!viewport || !card) return;
    card.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    setActive(index);
  }

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    let frame = 0;
    const startCard = viewport.querySelector<HTMLElement>(`[data-player-index="${startIndex}"]`);
    if (startCard) {
      const cardCenter = startCard.offsetLeft + startCard.offsetWidth / 2;
      viewport.scrollLeft = Math.max(0, cardCenter - viewport.clientWidth / 2);
    }

    const updateActive = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const cards = Array.from(viewport.querySelectorAll<HTMLElement>("[data-player-index]"));
        const center = viewport.getBoundingClientRect().left + viewport.clientWidth / 2;
        const closest = cards.reduce(
          (best, card) => {
            const rect = card.getBoundingClientRect();
            const distance = Math.abs(rect.left + rect.width / 2 - center);
            return distance < best.distance ? { index: Number(card.dataset.playerIndex), distance } : best;
          },
          { index: 0, distance: Number.POSITIVE_INFINITY },
        );
        setActive(closest.index);
      });
    };

    updateActive();
    viewport.addEventListener("scroll", updateActive, { passive: true });
    window.addEventListener("resize", updateActive);

    return () => {
      window.cancelAnimationFrame(frame);
      viewport.removeEventListener("scroll", updateActive);
      window.removeEventListener("resize", updateActive);
    };
  }, [startIndex]);

  return (
    <section className="roster-carousel page-section" aria-label="SHD core roster">
      <div className="roster-viewport" ref={viewportRef}>
        <div className="roster-stage">
          {players.map((player, index) => (
            <article
              className={`player-card ${index === 2 ? "is-featured" : ""}`}
              data-player-index={index}
              key={player.id}
            >
              <img alt="" aria-hidden="true" className="player-rank-mark" src={`/ranks/${player.peak}.png`} />
              <span className="status-pill">{player.status}</span>
              <h2>{player.displayName}</h2>
              <p className="player-handle">{player.handle}</p>
              <div className="player-copy">
                <p className="player-role">{player.role}</p>
                <dl className="player-stat-list">
                  <div>
                    <dt>HS%</dt>
                    <dd>{player.stats.hs}</dd>
                  </div>
                  <div>
                    <dt>WIN%</dt>
                    <dd>{player.stats.win}</dd>
                  </div>
                  <div>
                    <dt>KDA</dt>
                    <dd>{player.stats.kda}</dd>
                  </div>
                </dl>
              </div>
              <div className="agent-list">
                {player.agents.map((agent) => (
                  <span key={agent}>{agent}</span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </div>
      <div className="roster-controls" aria-label="Core roster carousel controls">
        <button aria-label="Previous player" onClick={() => scrollTo(Math.max(0, active - 1))} type="button">
          ‹
        </button>
        <div className="roster-dots" aria-label={`${active + 1} of ${players.length}`}>
          {players.map((player, index) => (
            <button
              aria-label={`Show ${player.displayName}`}
              aria-current={active === index}
              className={active === index ? "active" : ""}
              key={player.id}
              onClick={() => scrollTo(index)}
              type="button"
            />
          ))}
        </div>
        <button aria-label="Next player" onClick={() => scrollTo(Math.min(players.length - 1, active + 1))} type="button">
          ›
        </button>
      </div>
    </section>
  );
}
