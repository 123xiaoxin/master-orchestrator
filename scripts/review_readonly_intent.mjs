import { readFile } from 'node:fs/promises'
import { reviewTranscript } from '../evals/readonly-intent/review.mjs'
const [transcriptPath,reviewPath]=process.argv.slice(2)
if(!transcriptPath)throw new Error('transcript.json [review.json] required; no model is called')
const read=async p=>JSON.parse(await readFile(p,'utf8'))
console.log(JSON.stringify(reviewTranscript(await read(transcriptPath),reviewPath?await read(reviewPath):undefined),null,2))
