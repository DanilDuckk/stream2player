import type { Artist } from '@/src/types/artist';
import type { Album } from '@/src/types/album';
import { PlaylistEntry } from "@/src/types/playlist";

export interface Track {
    name: string;
    artists: Artist[];
    album: Album;
    external_urls: { spotify: string };
}

export interface TrackMeta {
    title: string;
    artists: string[];
    album: string;
}

export interface ResolvedTrack {
    meta: TrackMeta;
    /** Direct media page URL, when the source provider already resolved one. */
    sourceUrl?: string;
}

export interface ItemsPage {
    items: PlaylistEntry[];
    next: string | null;
}
