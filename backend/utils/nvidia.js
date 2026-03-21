import axios from 'axios';
import { readFile } from 'node:fs/promises';

const invokeUrl = "https://integrate.api.nvidia.com/v1/chat/completions";
const stream = true;

const headers = {
    "Authorization": "Bearer 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",
    "Accept": stream ? "text/event-stream" : "application/json"
};


const payload = {
    "model": "microsoft/phi-4-multimodal-instruct",
    "messages": [{ "role": "user", "content": "" }],
    "max_tokens": 512,
    "temperature": 0.10,
    "top_p": 0.70,
    "frequency_penalty": 0.00,
    "presence_penalty": 0.00,
    "stream": stream
};

Promise.resolve(
    axios.post(invokeUrl, payload, {
        headers: headers,
        responseType: stream ? 'stream' : 'json'
    })
)

    .then(response => {
        if (stream) {
            response.data.on('data', (chunk) => {
                console.log(chunk.toString());
            });
        } else {
            console.log(JSON.stringify(response.data));
        }
    })
    .catch(error => {
        console.error(error);
    });
