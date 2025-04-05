/// THIS FILE CONTAINS SOME CODES FROM THE @FFMPEG/UTIL PACKAGE
/// WITH SOME MODIFICATIONS

const ERROR_RESPONSE_BODY_READER = Error;
const ERROR_INCOMPLETED_DOWNLOAD = Error;

interface DownloadProgressEvent {
    url: string | URL;
    total: number;
    received: number;
    delta: number;
    done: boolean;
}
type ProgressCallback = (event: DownloadProgressEvent) => void;

export function isRelativePath(path: string) {
	try {
		new URL(path);
		return false; // If URL constructor succeeds, it's absolute
	} catch (e) {
		return true; // If it throws, it's relative
	}
}

export const downloadWithProgress = async (url: string | URL, cb?: ProgressCallback) => {
    // First make a HEAD request to check if Content-Length is available
    const headResp = await fetch(url, { method: 'HEAD' });
    const total = parseInt(headResp.headers.get('Content-Length') || "-1");

    // Then make the actual GET request
    const resp = await fetch(url);
    let buf;
    try {
        const reader = resp.body?.getReader();
        if (!reader)
            throw ERROR_RESPONSE_BODY_READER;
        const chunks = [];
        let received = 0;
        for (;;) {
            const { done, value } = await reader.read();
            const delta = value ? value.length : 0;
            if (done) {
                if (total != -1 && total !== received)
                    throw ERROR_INCOMPLETED_DOWNLOAD;
                cb && cb({ url, total, received, delta, done });
                break;
            }
            chunks.push(value);
            received += delta;
            cb && cb({ url, total, received, delta, done });
        }
        const data = new Uint8Array(received);
        let position = 0;
        for (const chunk of chunks) {
            data.set(chunk, position);
            position += chunk.length;
        }
        buf = data.buffer;
    }
    catch (e) {
        console.log(`failed to send download progress event: `);
		console.error(e)
        // If progress tracking fails, make a fresh request to get the data
        const freshResp = await fetch(url);
        buf = await freshResp.arrayBuffer();
        cb &&
            cb({
                url,
                total: buf.byteLength,
                received: buf.byteLength,
                delta: 0,
                done: true,
            });
    }
    return buf;
};

export const toBlobURL = async (url: string, mimeType: string, progress?: boolean, cb?: ProgressCallback) => {
    const buf = progress
        ? await downloadWithProgress(url, cb)
        : await (await fetch(url)).arrayBuffer();
    const blob = new Blob([buf], { type: mimeType });
    return URL.createObjectURL(blob);
};
