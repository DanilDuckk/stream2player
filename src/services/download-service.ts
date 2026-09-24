import { createSpotify } from '@/src/api/spotify-fetcher';
import { downloadTrack } from '@/src/api/youtube-fetcher';
import { createYoutubeSource } from '@/src/api/youtube-source';
import { DownloadConfig } from '@/src/types/config';
import { StopError } from '@/src/types/error';

export interface DownloadCallbacks {
    log: (line: string) => void;
    progress: (done: number, total: number) => void;
}

interface DownloadServiceOptions extends DownloadCallbacks {
    cacheDir: string;
    signal: AbortSignal;
}

function sourceName(source: DownloadConfig['source']): string {
    return source === 'spotify' ? 'Spotify' : 'YouTube';
}

export async function runDownload(
    config: DownloadConfig,
    { cacheDir, signal, log, progress }: DownloadServiceOptions,
): Promise<{ ok: boolean; stopped: boolean }> {
    if (!config.input.trim()) {
        log('[ERROR] Please enter a playlist or track URL/ID.');
        return { ok: false, stopped: false };
    }

    if (config.source === 'spotify' && (!config.clientId || !config.clientSecret)) {
        log('[ERROR] Please fill in Spotify Client ID and Client Secret.');
        return { ok: false, stopped: false };
    }

    const collection = config.source === 'spotify'
        ? await createSpotify({
            clientId: config.clientId as string,
            clientSecret: config.clientSecret as string,
            input: config.input,
            cacheDir,
        }, log).getTracks()
        : await createYoutubeSource({
            input: config.input,
        }, log).getTracks(signal);

    log(`[INFO] ${sourceName(config.source)} collection "${collection.name}" — `
        + `${collection.tracks.length} tracks. Starting download...`);

    let done = 0;
    let ok = 0;
    let failed = 0;

    for (const track of collection.tracks) {
        if (signal.aborted) break;

        log('---------------------------------------------');
        log(`[STATUS] ${done + 1}/${collection.tracks.length}`);
        try {
            await downloadTrack(
                track.meta,
                'mp3',
                config.downloadDir,
                log,
                signal,
                config.source === 'youtube'
                    ? {
                        sourceUrl: track.sourceUrl,
                    }
                    : {},
            );
            ok += 1;
            log('[INFO] SUCCESS');
        } catch (err) {
            if (err instanceof StopError || signal.aborted) {
                log('[INFO] Stopped by user.');
                break;
            }
            failed += 1;
            log(`[ERROR] ${err instanceof Error ? err.message : String(err)}`);
        }
        done += 1;
        progress(done, collection.tracks.length);
    }

    if (!signal.aborted) {
        log(`[INFO] Done. Success: ${ok}, failed: ${failed}. Folder: ${config.downloadDir}`);
    }
    return { ok: true, stopped: signal.aborted };
}
