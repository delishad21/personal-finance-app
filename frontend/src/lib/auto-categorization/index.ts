import { HeuristicStrategy } from "./strategies/heuristics";
import { HistoricalMatcherStrategy } from "./strategies/historicalMatcher";
import { runAutoCategorization } from "./engine";
import { AutoCategorizationContext, AutoLabelSettings } from "./types";

export async function applyAutoCategorization(
  context: AutoCategorizationContext,
  settings: AutoLabelSettings,
) {
  const strategies = [new HistoricalMatcherStrategy(), new HeuristicStrategy()];
  return runAutoCategorization(context, strategies, settings);
}

export type { ParsedImportTransaction, AutoSuggestion } from "./types";
