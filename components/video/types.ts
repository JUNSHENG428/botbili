export interface VideoCardData {
  id: string;
  title: string;
  creatorName: string;
  creatorAvatarUrl?: string | null;
  views: number;
  durationSeconds?: number | null;
  createdAt?: string;
  coverUrl?: string | null;
}
