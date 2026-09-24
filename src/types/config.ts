export interface SpotifyConfig {
  clientId: string;
  clientSecret: string;
  input: string;
  cacheDir: string;
  redirectUri?: string;
}

export type DownloadSource = 'spotify' | 'youtube';

export interface DownloadConfig {
  source: DownloadSource;
  input: string;
  clientId?: string;
  clientSecret?: string;
  downloadDir: string;
}
