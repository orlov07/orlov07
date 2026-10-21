import { describe, expect, it } from "vitest";
import { applyPoint, createMatch, displayPoint, finishMatch, pauseMatch, resumeMatch, revertLastPoint, startMatch } from "./index";

const live = () => startMatch(createMatch({ id: "test", teamA: "A", teamB: "B" }));
const points = (initial: ReturnType<typeof live>, team: "A" | "B", amount: number) => {
  let state = initial;
  for (let index = 0; index < amount; index += 1) state = applyPoint(state, team);
  return state;
};

describe("scoring engine", () => {
  it("exibe a sequência 0, 15, 30 e 40", () => {
    let state = live(); expect(displayPoint(state, "A")).toBe("0");
    state = applyPoint(state, "A"); expect(displayPoint(state, "A")).toBe("15");
    state = applyPoint(state, "A"); expect(displayPoint(state, "A")).toBe("30");
    state = applyPoint(state, "A"); expect(displayPoint(state, "A")).toBe("40");
  });
  it("fecha game no-ad no quarto ponto e alterna o saque", () => {
    const state = points(live(), "A", 4);
    expect(state.sets[0]).toEqual({ gamesA: 1, gamesB: 0 }); expect(state.server).toBe("B");
  });
  it("encerra partida em dois sets", () => {
    let state = live(); state = points(state, "A", 4 * 6); state = points(state, "A", 4 * 6);
    expect(state.status).toBe("finished"); expect(state.winner).toBe("A"); expect(state.setsWon.A).toBe(2);
  });
  it("desfaz o último ponto de forma imutável", () => {
    const first = live(); const scored = applyPoint(first, "B"); const reverted = revertLastPoint(scored);
    expect(reverted.points.B).toBe(0); expect(scored.points.B).toBe(1); expect(reverted.version).toBe(3);
  });
  it("desfaz corretamente depois de pausar a partida", () => {
    const scored = applyPoint(live(), "A");
    const paused = pauseMatch(scored);
    const reverted = revertLastPoint(paused);
    expect(reverted.points.A).toBe(0);
    expect(reverted.status).toBe("paused");
    expect(reverted.history).toHaveLength(0);
  });
  it("desfaz um ponto que fechou o game", () => {
    const scored = points(live(), "A", 4);
    const reverted = revertLastPoint(scored);
    expect(reverted.sets[0]).toEqual({ gamesA: 0, gamesB: 0 });
    expect(displayPoint(reverted, "A")).toBe("40");
  });
  it("permite finalizar manualmente e desfazer a finalização", () => {
    const running = applyPoint(live(), "A");
    const finished = finishMatch(running, "A");
    expect(finished.status).toBe("finished");
    expect(finished.winner).toBe("A");
    const reopened = revertLastPoint(finished);
    expect(reopened.status).toBe("live");
    expect(reopened.winner).toBeNull();
  });
  it("recusa ponto antes do início", () => expect(() => applyPoint(createMatch({ teamA: "A", teamB: "B" }), "A")).toThrow());
  it("exige vantagem de dois pontos quando no-ad está desligado", () => {
    let state = startMatch(createMatch({ teamA: "A", teamB: "B", rules: { noAd: false } }));
    state = points(state, "A", 3); state = points(state, "B", 3); state = applyPoint(state, "A");
    expect(displayPoint(state, "A")).toBe("AD");
    state = applyPoint(state, "B"); expect(displayPoint(state, "A")).toBe("40");
    state = applyPoint(applyPoint(state, "B"), "B"); expect(state.sets[0]?.gamesB).toBe(1);
  });
  it("pausa e retoma sem aceitar pontos durante a pausa", () => {
    const paused = pauseMatch(live());
    expect(() => applyPoint(paused, "A")).toThrow();
    expect(resumeMatch(paused).status).toBe("live");
  });
  it("alterna o saque após o primeiro ponto e a cada dois no tie-break", () => {
    let state = live();
    for (let game = 0; game < 6; game += 1) { state = points(state, "A", 4); state = points(state, "B", 4); }
    expect(state.sets[0]).toEqual({ gamesA: 6, gamesB: 6 });
    const initialServer = state.server;
    state = applyPoint(state, "A"); expect(state.server).not.toBe(initialServer);
    const secondServer = state.server;
    state = applyPoint(state, "B"); expect(state.server).toBe(secondServer);
    state = applyPoint(state, "A"); expect(state.server).toBe(initialServer);
  });
});
