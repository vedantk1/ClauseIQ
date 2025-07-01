export interface HighlightArea {
  height: number;
  left: number;
  pageIndex: number;
  top: number;
  width: number;
}

export interface Highlight {
  id: string;
  documentId: string;
  userId: string;
  content: string;
  comment: string;
  areas: HighlightArea[];
  aiRewrite?: string;
  createdAt: Date;
  updatedAt: Date;
}
