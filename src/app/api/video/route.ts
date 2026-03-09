import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const jobId = searchParams.get('jobId');

        if (!jobId) {
            return NextResponse.json({ error: 'No jobId provided' }, { status: 400 });
        }

        // Sanitize jobId to prevent directory traversal
        const safeJobId = jobId.replace(/[^a-zA-Z0-9-]/g, '');
        if (safeJobId !== jobId) {
            return NextResponse.json({ error: 'Invalid jobId' }, { status: 400 });
        }

        const isProduction = process.env.NODE_ENV === 'production';
        const baseTempDir = isProduction
            ? path.join('/tmp', 'substudio')
            : path.join(process.cwd(), 'public', 'temp');

        const videoPath = path.join(baseTempDir, `${jobId}.mp4`);

        if (!fs.existsSync(videoPath)) {
            return NextResponse.json({ error: 'Video not found' }, { status: 404 });
        }

        const stat = fs.statSync(videoPath);
        const fileSize = stat.size;

        // Handle range requests for video seeking
        const range = req.headers.get('range');

        if (range) {
            const parts = range.replace(/bytes=/, '').split('-');
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
            const chunkSize = end - start + 1;

            const fileStream = fs.createReadStream(videoPath, { start, end });
            const readable = new ReadableStream({
                start(controller) {
                    fileStream.on('data', (chunk: Buffer | string) => controller.enqueue(typeof chunk === 'string' ? Buffer.from(chunk) : chunk));
                    fileStream.on('end', () => controller.close());
                    fileStream.on('error', (err) => controller.error(err));
                },
            });

            return new NextResponse(readable, {
                status: 206,
                headers: {
                    'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                    'Accept-Ranges': 'bytes',
                    'Content-Length': String(chunkSize),
                    'Content-Type': 'video/mp4',
                },
            });
        }

        const fileBuffer = fs.readFileSync(videoPath);
        return new NextResponse(fileBuffer, {
            headers: {
                'Content-Length': String(fileSize),
                'Content-Type': 'video/mp4',
                'Accept-Ranges': 'bytes',
            },
        });
    } catch (error: unknown) {
        console.error('Video serve error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal Error' },
            { status: 500 }
        );
    }
}
