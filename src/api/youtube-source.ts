import { ResolvedCollection } from '@/src/types/playlist';
import { ResolvedTrack } from '@/src/types/track';
import {
    buildYtDlpMetadataArgs,
    Logger,
    runYtDlpJson,
} from '@/src/api/youtube-fetcher';

interface YtDlpEntry {
    id?: string;
    title?: string;
    uploader?: string;
    channel?: string;
    artist?: string;
    track?: string;
    album?: string;
    url?: string;
    webpage_url?: string;
}

interface YoutubeSourceConfig {
    input: string;
}

function stringValue(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function asEntry(value: unknown): YtDlpEntry {
    return (value && typeof value === 'object' ? value : {}) as YtDlpEntry;
}

function sourceUrl(entry: YtDlpEntry): string | undefined {
    const directUrl = stringValue(entry.webpage_url) ?? stringValue(entry.url);
    if (directUrl?.startsWith('http')) return directUrl;
    const id = stringValue(entry.id) ?? directUrl;
    return id ? `https://www.youtube.com/watch?v=${encodeURIComponent(id)}` : undefined;
}

function toResolvedTrack(entry: YtDlpEntry, fallbackAlbum: string): ResolvedTrack | null {
    const title = stringValue(entry.title) ?? stringValue(entry.track);
    if (!title) return null;

    return {
        meta: {
            title,
            artists: [
                stringValue(entry.channel)
                    ?? stringValue(entry.uploader)
                    ?? stringValue(entry.artist)
                    ?? 'Unknown Artist',
            ],
            album: stringValue(entry.album) ?? fallbackAlbum,
        },
        sourceUrl: sourceUrl(entry),
    };
}

function playlistEntries(data: Record<string, unknown>): YtDlpEntry[] {
    return Array.isArray(data.entries) ? data.entries.map(asEntry) : [];
}

export function createYoutubeSource(
    cfg: YoutubeSourceConfig,
    log: Logger = console.log,
) {
    return {
        async getTracks(isPlaylist: boolean, signal?: AbortSignal): Promise<ResolvedCollection> {
            const input = cfg.input.trim();
            if (!input) throw new Error('YouTube URL is required.');

            log(`[INFO] Fetching ${isPlaylist ? 'playlist' : 'track'} from YouTube...`);
            const data = await runYtDlpJson(
                buildYtDlpMetadataArgs(input, isPlaylist),
                signal,
            );

            if (isPlaylist) {
                const name = stringValue(data.title) ?? 'YouTube Playlist';
                const tracks = playlistEntries(data)
                    .map((entry) => toResolvedTrack(entry, name))
                    .filter((track): track is ResolvedTrack => Boolean(track && track.sourceUrl));

                if (!tracks.length) {
                    throw new Error('The YouTube playlist contains no downloadable tracks.');
                }
                return { name, tracks };
            }

            const track = toResolvedTrack(asEntry(data), 'YouTube');
            if (!track?.sourceUrl) throw new Error('YouTube did not return a downloadable track.');
            return { name: track.meta.title, tracks: [track] };
        },
    };
}
