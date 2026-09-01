const https = require('https');

/**
 * Gemini-based face detection.
 *
 * Uses the generateContent API to detect faces in an image and returns the
 * bounding boxes. Object detection in Gemini returns normalized coordinates
 * [y0, x0, y1, x1] scaled to 0-1000 (unless normalizedCoords is set to false
 * with image_config).
 *
 * Configure in .env:
 *   GEMINI_API_KEY = your Gemini API key (starts with AIza... or AQ.)
 *   GEMINI_MODEL   = e.g. gemini-2.5-flash
 */
class GeminiFaceRecognitionService {
    constructor() {
        this.apiKey = process.env.GEMINI_API_KEY || '';
        this.model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
        this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
    }

    isConfigured() {
        return !!this.apiKey;
    }

    /**
     * Detect faces in an image.
     * @param {Buffer} imageBuffer - raw image bytes
     * @param {string} mimeType - e.g. image/jpeg, image/png
     */
    async detectFaces(imageBuffer, mimeType = 'image/jpeg') {
        if (!this.isConfigured()) {
            throw new Error('Gemini API key not configured (set GEMINI_API_KEY in .env)');
        }

        const base64 = imageBuffer.toString('base64');

        const prompt = [
            { text: 'Detect all human faces in this image. For every face, output the bounding box in the key "box_2d" as [y0, x0, y1, x1] with normalized coordinates between 0 and 1000, plus a "label" naming the person (or "Person N"). Only output a JSON list, no other text.' },
            { inline_data: { mime_type: mimeType, data: base64 } },
        ];

        const body = {
            contents: [{ parts: prompt }],
            generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 2048,
            },
        };

        const responseData = await this._request(body);
        return this._extractDetections(responseData);
    }

    _request(body) {
        return new Promise((resolve, reject) => {
            const url = new URL(`${this.baseUrl}/models/${this.model}:generateContent`);
            url.searchParams.set('key', this.apiKey);

            const payload = JSON.stringify(body);
            const options = {
                hostname: url.hostname,
                path: url.pathname + url.search,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(payload),
                },
            };

            const req = https.request(options, res => {
                let data = '';
                res.on('data', chunk => (data += chunk));
                res.on('end', () => {
                    let json;
                    try {
                        json = JSON.parse(data);
                    } catch (e) {
                        return reject(new Error(`Invalid response from Gemini: ${data.slice(0, 300)}`));
                    }
                    if (json.error) {
                        return reject(new Error(`Gemini API error: ${json.error.message || json.error.status}`));
                    }
                    resolve(json);
                });
            });

            req.on('error', reject);
            req.setTimeout(30000, () => req.destroy(new Error('Gemini request timed out')));
            req.write(payload);
            req.end();
        });
    }

    _extractDetections(data) {
        try {
            const text = data.candidates?.[0]?.content?.parts
                ?.map(p => p.text)
                .filter(Boolean)
                .join('') || '';

            // Gemini may wrap JSON in ```json ... ``` fences
            const cleaned = text.replace(/```json|```/g, '').trim();
            const start = cleaned.indexOf('[');
            const end = cleaned.lastIndexOf(']');
            if (start === -1 || end === -1) return [];
            const items = JSON.parse(cleaned.slice(start, end + 1));

            return items.map((item, i) => {
                const box = item.box_2d;
                let x, y, width, height;

                if (Array.isArray(box) && box.length >= 4) {
                    const [y0, x0, y1, x1] = box;
                    // normalized 0-1000 -> convert to fraction of image
                    x = x0 / 1000;
                    y = y0 / 1000;
                    width = (x1 - x0) / 1000;
                    height = (y1 - y0) / 1000;
                } else {
                    x = item.x || 0;
                    y = item.y || 0;
                    width = item.width || 0;
                    height = item.height || 0;
                }

                return {
                    id: `face-${i + 1}`,
                    faceId: `face-${i + 1}`,
                    label: item.label || `Person ${i + 1}`,
                    confidence: 100,
                    // normalized (0-1) coordinates expected by the frontend
                    x,
                    y,
                    width,
                    height,
                };
            });
        } catch (e) {
            console.error('Failed to parse Gemini detections:', e.message);
            return [];
        }
    }
}

module.exports = new GeminiFaceRecognitionService();
