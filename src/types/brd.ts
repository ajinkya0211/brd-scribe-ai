
export interface Section {
  title: string;
  level: number;
  content: string;
  summary?: string;
  startIndex?: number;
  endIndex?: number;
}

export interface AIEditRequest {
  prompt: string;
  sections: Section[];
}

export interface AIEditResponse {
  sectionsToUpdate: {
    title: string;
    reasoning: string;
  }[];
  updatedSections: {
    title: string;
    content: string;
  }[];
  summaryOfChanges: string[];
}
