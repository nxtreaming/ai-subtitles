import ytdl from '@distube/ytdl-core';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from '@ffmpeg-installer/ffmpeg';
import fs from 'fs';
import path from 'path';

ffmpeg.setFfmpegPath(ffmpegPath.path);

/* ── YouTube helpers ── */

function extractYoutubeId(url: string): string | null {
    const m = url.match(
        /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
    );
    return m?.[1] || null;
}

export function isYoutubeUrl(url: string): boolean {
    return ytdl.validateURL(url) || extractYoutubeId(url) !== null;
}

/**
 * Downloads a YouTube video using @distube/ytdl-core with browser-like headers.
 * May fail on cloud/serverless environments due to YouTube's bot detection.
 */
export async function downloadYoutubeVideo(url: string, outputPath: string): Promise<void> {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    try {
        const stream = ytdl(url, {
            filter: 'videoandaudio',
            quality: 'highest',
            requestOptions: {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                },
            },
        });

        const fileStream = fs.createWriteStream(outputPath);

        await new Promise<void>((resolve, reject) => {
            stream.pipe(fileStream);
            stream.on('error', (err: Error) => {
                fileStream.close();
                // Clean up partial file
                if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
                reject(err);
            });
            fileStream.on('finish', resolve);
            fileStream.on('error', reject);
        });

        if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size === 0) {
            if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
            throw new Error('Download completed but output file is empty');
        }
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('YouTube download error:', message);

        // Provide a clear, actionable error for bot detection
        if (
            message.includes('Sign in') ||
            message.includes('bot') ||
            message.includes('confirm') ||
            message.includes('UNPLAYABLE') ||
            message.includes('unavailable')
        ) {
            throw new Error(
                'YouTube blocked this download (bot detection). Please download the video from YouTube and upload the file directly.'
            );
        }
        throw new Error(`Failed to download YouTube video: ${message}`);
    }
}

/* ── FFmpeg utilities ── */

export async function extractAudio(videoPath: string, audioPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(videoPath)) {
            return reject(new Error(`Media file does not exist at path: ${videoPath}`));
        }

        const dir = path.dirname(audioPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        ffmpeg(videoPath)
            .outputOptions(['-vn', '-acodec libmp3lame', '-ac 1', '-ar 16000'])
            .on('error', (err) => {
                console.error('FFmpeg Extract Error:', err);
                reject(err);
            })
            .on('end', () => resolve())
            .save(audioPath);
    });
}

export function getVideoInfo(videoPath: string): Promise<{ width: number; height: number; bitrate: number }> {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(videoPath, (err, metadata) => {
            if (err) return reject(err);
            const videoStream = metadata.streams.find(s => s.codec_type === 'video');
            resolve({
                width: videoStream?.width || 1920,
                height: videoStream?.height || 1080,
                bitrate: metadata.format.bit_rate ? parseInt(String(metadata.format.bit_rate)) : 0,
            });
        });
    });
}

export async function burnSubtitles(
    videoPath: string,
    srtPath: string,
    outputPath: string,
    options?: { targetHeight?: number }
): Promise<void> {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(videoPath)) return reject(new Error('Video path missing'));
        if (!fs.existsSync(srtPath)) return reject(new Error('SRT path missing'));

        const safeSrtPath = srtPath.replace(/\\/g, '/');
        const filters: string[] = [];

        if (options?.targetHeight) {
            filters.push(`scale=-2:'if(lt(ih,${options.targetHeight}),${options.targetHeight},ih)':flags=lanczos`);
        }

        filters.push(`subtitles='${safeSrtPath}':force_style='Fontname=Outfit,Fontsize=18,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=3,Outline=2,Shadow=0'`);

        ffmpeg(videoPath)
            .outputOptions([
                '-vf', filters.join(','),
                '-c:v libx264',
                '-crf 17',
                '-preset medium',
                '-pix_fmt yuv420p',
                '-c:a copy',
            ])
            .on('error', (err) => {
                console.error('FFmpeg Burn Error:', err);
                reject(err);
            })
            .on('end', () => resolve())
            .save(outputPath);
    });
}
