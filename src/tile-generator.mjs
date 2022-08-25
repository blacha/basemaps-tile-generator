import { ConfigProviderMemory } from '@basemaps/config';
import { Config } from '@basemaps/shared';
import { fsa } from '@chunkd/fs';
import os from 'os';
import {WorkerRpcPool} from '@wtrpc/core'

import 'sharp' // Needs to be imported or everything dies
const workerUrl = new URL('./tile-generator-worker.mjs', import.meta.url, );
const threadCount = os.cpus().length / 8;

const pool = new WorkerRpcPool(threadCount, workerUrl);

async function main() {
    const configJson = await fsa.readJson('./config-latest.json');
    const mem = ConfigProviderMemory.fromJson(configJson);
    mem.createVirtualTileSets();
    Config.setConfigProvider(mem);
    const { tiles } = await fsa.readJson('./data/tiles.json');
    tiles.push('')
    if (process.argv.includes('--reverse')) {
        tiles.sort((a, b) => b.length - a.length)
    } else {
        tiles.sort((a, b) => a.length - b.length)
    }

    const promises = [];
    let currentTiles = tiles;
    while (currentTiles.length > 0) {
        const todo = currentTiles.slice(0, 250);
        currentTiles = currentTiles.slice(250);
        promises.push(pool.run('tile', todo));
    }

    await Promise.all(promises);

    await pool.close();

}


main();