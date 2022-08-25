import { ConfigProviderMemory } from '@basemaps/config';
import { Config, LogConfig } from '@basemaps/shared';
import { fsa } from '@chunkd/fs';
import os from 'os';
import {WorkerRpcPool} from '@wtrpc/core'

import 'sharp' // Needs to be imported or everything dies
import { createGunzip } from 'zlib';
const workerUrl = new URL('./tile-generator-worker.mjs', import.meta.url, );
const threadCount = os.cpus().length / 8;

const pool = new WorkerRpcPool(threadCount, workerUrl);

// Create tiles per worker invocation
const WorkerTaskSize = 500;

async function main() {
    // Load the basemaps config from the latest version in s3
    await fsa.write('./config-latest.json', fsa.stream('s3://linz-basemaps/config/config-latest.json.gz').pipe(createGunzip()))

    // Ensure the config is valid before we start tiling
    const configJson = await fsa.readJson('./config-latest.json');
    const mem = ConfigProviderMemory.fromJson(configJson);
    mem.createVirtualTileSets();
    Config.setConfigProvider(mem);

    const { tiles } = await fsa.readJson('./data/tiles.json');
    tiles.push('')
    // Let multiple processes run one forward one backwards
    if (process.argv.includes('--reverse')) {
        tiles.sort((a, b) => b.length - a.length)
    } else {
        tiles.sort((a, b) => a.length - b.length)
    }

    const promises = [];
    let currentTiles = tiles;
    while (currentTiles.length > 0) {
        const todo = currentTiles.slice(0, WorkerTaskSize);
        currentTiles = currentTiles.slice(WorkerTaskSize);
        promises.push(pool.run('tile', todo));
    }

    await Promise.all(promises);
    await pool.close();
}


main().catch(e => LogConfig.get().fatal({err: e}, 'Failed'));