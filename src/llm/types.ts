export interface AlignmentResult {
  verdict: string;
  confidence: number;
  suggested_product: string;
  reason: string;
}

export interface PulseMatch {
  pulse_id: string;
  confidence: number;
  reason: string;
}

export interface PulseMatchingResult {
  matches: PulseMatch[];
  notes: string;
}

export interface IdeaCandidate {
  id: string;
  title: string;
  why: string;
}

export interface IdeaShortlistResult {
  candidate_ideas: IdeaCandidate[];
  notes: string;
}

export interface IdeaMatch {
  idea_page_id: string;
  confidence: number;
  reasoning: string;
}

export interface IdeaMatchingResult {
  matched_ideas: IdeaMatch[];
  notes: string;
}
