declare module "NeteaseCloudMusicApi" {
  interface ApiResponse {
    status: number;
    body: any;
  }

  interface SongDetailOptions {
    ids: string;
  }

  interface SongUrlOptions {
    id: string;
    br?: number;
  }

  export function song_detail(options: SongDetailOptions): Promise<ApiResponse>;
  export function song_url(options: SongUrlOptions): Promise<ApiResponse>;
  export function lyric(options: { id: string }): Promise<ApiResponse>;
}
