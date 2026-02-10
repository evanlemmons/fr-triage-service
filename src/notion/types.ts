export interface FeatureRequest {
  id: string;
  url: string;
  title: string;
  content: string;
  existingPulseRelationIds: string[];
  existingIdeaRelationIds: string[];
}

export interface PulseItem {
  id: string;
  title: string;
  content: string;
}

export interface IdeaTitle {
  id: string;
  title: string;
}

export interface IdeaWithContent {
  id: string;
  title: string;
  content: string;
}
